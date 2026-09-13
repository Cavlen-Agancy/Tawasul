import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const patient = { email: 'e2e.patient@test.com', password: 'TestPass123!' }
const doctor = { email: 'e2e.doctor@test.com', password: 'TestPass123!' }

let doctorId = ''
let bookingNowId = '' // CONFIRMED, today near now (calendar event today)
let bookingFutureId = '' // CONFIRMED, +7 days
let bookingSessionId = '' // CONFIRMED, today ~30 min away
let pastConfirmedId = '' // CONFIRMED, -8 days (past, visible in calendar)
let pastCancelledId = '' // CANCELLED, -7 days (past, visible in calendar)
let bookingPendingId = '' // PENDING, +10 days, doctorId null (under review)
let blockedDate = '' // next-month day 21 blocked => unavailable (not bookable)
let blockedSlotIds: string[] = []
let paymentId = ''

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function hhmm(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

/**
 * `@db.Date` stores UTC-midnight calendar days (see prod `create.post.ts`).
 * Fixtures wrap intended local days the same way so the calendar shows them
 * on the intended day in every timezone.
 */
function utcDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

/** A deterministic future day in the NEXT month (guaranteed available: doctor works all days). */
function futureTargetDate(): { date: string } {
  const base = new Date()
  const month = new Date(base.getFullYear(), base.getMonth() + 1, 1)
  const target = new Date(month.getFullYear(), month.getMonth(), 12)
  return { date: ymd(target) }
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** Formats an "HH:MM" string the same way the page does, e.g. "11:00 AM". */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map((v) => parseInt(v, 10))
  const period = (h || 0) >= 12 ? 'PM' : 'AM'
  const hour = (h || 0) % 12 === 0 ? 12 : (h || 0) % 12
  return `${hour}:${String(m).padStart(2, '0')} ${period}`
}

async function gotoReady(page: Page, path: string) {
  await page.goto(path)
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null
    return root && '__vue_app__' in root
  }, { timeout: 30_000 })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(250)
}

async function loginAs(page: Page, email: string, password: string, expected: string) {
  await gotoReady(page, '/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL(`**${expected}`, { timeout: 30_000 })
  await page.waitForTimeout(500)
}

async function spaNavigateTo(page: Page, path: string) {
  const before = new URL(page.url()).pathname
  await page.evaluate((p) => {
    const app = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: any }) | null
    app?.__vue_app__?.config?.globalProperties?.$router?.push(p)
  }, path)
  const started = Date.now()
  while (Date.now() - started < 20_000) {
    if (new URL(page.url()).pathname !== before) break
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(400)
}

/** Navigate the main calendar to the given year/month using the toolbar next/prev buttons. */
async function gotoMonth(page: Page, year: number, month: number) {
  const target = monthLabel(year, month)
  // Reset to today so month math starts from a known point.
  await page.getByTestId('calendar-today').click()
  await page.waitForTimeout(250)
  const today = new Date()
  const diffMonths = (year - today.getFullYear()) * 12 + (month - (today.getMonth() + 1))
  if (diffMonths === 0) {
    await expect(page.getByTestId('calendar-label')).toHaveText(target, { timeout: 15_000 })
    return
  }
  const testid = diffMonths < 0 ? 'cal-prev' : 'cal-next'
  // Guard against a flaky reset: click in the correct direction until the label matches.
  for (let i = 0; i < Math.abs(diffMonths) + 6; i++) {
    const current = (await page.getByTestId('calendar-label').textContent())?.trim() ?? ''
    if (current === target) break
    await page.getByTestId(testid).click()
    await page.waitForTimeout(250)
  }
  await expect(page.getByTestId('calendar-label')).toHaveText(target, { timeout: 15_000 })
}

test.beforeAll(async () => {
  await prisma.user.upsert({
    where: { email: patient.email },
    update: { isActive: true, emailVerified: true, name: 'E2E Patient' },
    create: {
      name: 'E2E Patient',
      email: patient.email,
      password: await bcrypt.hash(patient.password, 12),
      accountType: 'PATIENT',
      emailVerified: true,
      isActive: true,
    },
  })
  await prisma.user.upsert({
    where: { email: doctor.email },
    update: { isActive: true, emailVerified: true },
    create: {
      name: 'Dr. E2E Doctor',
      email: doctor.email,
      password: await bcrypt.hash(doctor.password, 12),
      accountType: 'DOCTOR',
      emailVerified: true,
      isActive: true,
    },
  })

  const slug = `e2e-pd-${Date.now()}`
  const docUser = await prisma.user.create({
    data: {
      email: `${slug}@test.com`,
      name: 'Dr. Patient Dashboard',
      password: await bcrypt.hash('TestPass123!', 12),
      accountType: 'DOCTOR',
      emailVerified: true,
      isActive: true,
    },
  })
  const doc = await prisma.doctor.create({
    data: {
      userId: docUser.id,
      slug,
      bio: 'E2E patient dashboard doctor',
      specializations: ['Marital Counseling'],
      isActive: true,
    },
  })
  doctorId = doc.id
  for (let day = 0; day <= 6; day++) {
    await prisma.availability.create({
      data: { doctorId: doc.id, dayOfWeek: day, startTime: '08:00', endTime: '22:00', sessionDuration: 60 },
    })
  }

  const patientUser = await prisma.user.findUniqueOrThrow({ where: { email: patient.email } })

  // Booking today near now (calendar event on today's cell).
  const startNow = new Date(Date.now() + 3 * 60 * 1000)
  const nowBooking = await prisma.booking.create({
    data: {
      userId: patientUser.id,
      doctorId: doc.id,
      date: utcDay(new Date()),
      startTime: hhmm(startNow),
      endTime: hhmm(new Date(startNow.getTime() + 60 * 60 * 1000)),
      service: 'Marital Counseling',
      status: 'CONFIRMED',
    },
  })
  bookingNowId = nowBooking.id

  // Booking +7 days.
  const futureBooking = await prisma.booking.create({
    data: {
      userId: patientUser.id,
      doctorId: doc.id,
      date: utcDay(daysFromNow(7)),
      startTime: '10:00',
      endTime: '11:00',
      service: 'Marital Counseling',
      status: 'CONFIRMED',
    },
  })
  bookingFutureId = futureBooking.id

  // Booking today ~30 min away (session countdown test).
  const sessionStart = new Date(Date.now() + 30 * 60 * 1000)
  const sessionBooking = await prisma.booking.create({
    data: {
      userId: patientUser.id,
      doctorId: doc.id,
      date: utcDay(new Date()),
      startTime: hhmm(sessionStart),
      endTime: hhmm(new Date(sessionStart.getTime() + 60 * 60 * 1000)),
      service: 'Marital Counseling',
      status: 'CONFIRMED',
    },
  })
  bookingSessionId = sessionBooking.id

  const pastConfirmed = await prisma.booking.create({
    data: {
      userId: patientUser.id,
      doctorId: doc.id,
      date: utcDay(daysFromNow(-8)),
      startTime: '10:00',
      endTime: '11:00',
      service: 'Marital Counseling',
      status: 'CONFIRMED',
    },
  })
  pastConfirmedId = pastConfirmed.id

  const pastCancelled = await prisma.booking.create({
    data: {
      userId: patientUser.id,
      doctorId: doc.id,
      date: utcDay(daysFromNow(-7)),
      startTime: '10:00',
      endTime: '11:00',
      service: 'Marital Counseling',
      status: 'CANCELLED',
    },
  })
  pastCancelledId = pastCancelled.id

  const pendingBooking = await prisma.booking.create({
    data: {
      userId: patientUser.id,
      doctorId: null,
      date: utcDay(daysFromNow(10)),
      startTime: '10:00',
      endTime: '11:00',
      service: 'Marital Counseling',
      status: 'PENDING',
    },
  })
  bookingPendingId = pendingBooking.id

  const payment = await prisma.payment.create({
    data: { bookingId: nowBooking.id, amount: 250, currency: 'EGP', status: 'SUCCESS' },
  })
  paymentId = payment.id

  // Block an entire future day (next-month day 21) across ALL active doctors so that
  // the date truly reports as unavailable, while keeping day 12 (futureTargetDate) bookable.
  blockedDate = `${futureTargetDate().date.slice(0, 8)}21`
  const activeDoctors = await prisma.doctor.findMany({ where: { isActive: true }, select: { id: true } })
  // BlockedSlot.date is a @db.Date column; a local-midnight Date maps to the previous
  // calendar day in non-UTC timezones, so construct the date from UTC components.
  const [bY, bM, bD] = blockedDate.split('-').map((v) => parseInt(v, 10))
  const blockedDay = new Date(Date.UTC(bY, bM - 1, bD))
  for (const d of activeDoctors) {
    const bs = await prisma.blockedSlot.create({
      data: { doctorId: d.id, date: blockedDay, startTime: '00:00', endTime: '23:59' },
    })
    blockedSlotIds.push(bs.id)
  }
})

test.afterAll(async () => {
  await prisma.sessionRoom
    .deleteMany({ where: { bookingId: { in: [bookingNowId, bookingFutureId, bookingSessionId, pastConfirmedId, pastCancelledId, bookingPendingId] } } })
    .catch(() => undefined)
  await prisma.payment.deleteMany({ where: { id: paymentId } }).catch(() => undefined)
  await prisma.booking
    .deleteMany({ where: { id: { in: [bookingNowId, bookingFutureId, bookingSessionId, pastConfirmedId, pastCancelledId, bookingPendingId] } } })
    .catch(() => undefined)
  if (blockedSlotIds.length > 0) {
    await prisma.blockedSlot.deleteMany({ where: { id: { in: blockedSlotIds } } }).catch(() => undefined)
  }
  await prisma.blockedSlot.deleteMany({ where: { doctorId } }).catch(() => undefined)
  await prisma.availability.deleteMany({ where: { doctorId } }).catch(() => undefined)
  const doc = await prisma.doctor.findUnique({ where: { id: doctorId } })
  await prisma.doctor.deleteMany({ where: { id: doctorId } }).catch(() => undefined)
  if (doc) await prisma.user.deleteMany({ where: { id: doc.userId } }).catch(() => undefined)
  await prisma.$disconnect()
})

test.describe('Patient Dashboard', () => {
  test('unauthenticated user is redirected to /login from /dashboard/appointments', async ({ page }) => {
    await page.goto('/dashboard/appointments')
    await page.waitForURL('**/login', { timeout: 20_000 })
  })

  test('non-patient (doctor) is redirected to /doctor/calendar', async ({ page }) => {
    await loginAs(page, doctor.email, doctor.password, '/doctor/calendar')
    await spaNavigateTo(page, '/dashboard/appointments')
    await page.waitForURL('**/doctor/calendar', { timeout: 20_000 })
    await expect(page.getByTestId('page-title')).toHaveText('My Calendar')
  })

  test('dashboard redirects to /dashboard/appointments', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await spaNavigateTo(page, '/dashboard')
    await page.waitForURL('**/dashboard/appointments', { timeout: 20_000 })
    await expect(page.getByTestId('page-title')).toHaveText('My Appointments')
  })

  // A) Calendar shows the current month and the week starts on Saturday
  test('calendar shows the current month starting Saturday', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await expect(page.getByTestId('page-title')).toHaveText('My Appointments', { timeout: 20_000 })
    await expect(page.locator('.fc-daygrid-body')).toBeVisible({ timeout: 20_000 })
    const firstHeader = page.locator('.fc-col-header-cell').first()
    await expect(firstHeader).toContainText('Sat', { timeout: 20_000 })
  })

  // B) Clicking a past date opens nothing
  test('clicking a past date does nothing', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const pastDate = ymd(daysFromNow(-2))
    const [py, pm] = pastDate.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, py, pm)
    const cell = page.locator(`.fc-day[data-date="${pastDate}"]`)
    await expect(cell).toHaveClass(/fc-past/, { timeout: 20_000 })
    await cell.locator('.fc-daygrid-day-frame').click({ force: true })
    await expect(page.getByTestId('booking-flow')).toHaveCount(0)
    await expect(page.getByTestId('booking-detail')).toHaveCount(0)
  })

  // C) Clicking a holiday shows an info toast and opens nothing
  test('clicking a holiday shows a closed toast', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const holiday = '2027-01-07'
    await gotoMonth(page, 2027, 1)
    const cell = page.locator(`.fc-day[data-date="${holiday}"]`)
    await cell.locator('.fc-daygrid-day-frame').click({ force: true })
    await expect(page.getByTestId('toast-info')).toContainText('Clinic closed for a public holiday', { timeout: 20_000 })
    await expect(page.getByTestId('booking-flow')).toHaveCount(0)
    await gotoMonth(page, new Date().getFullYear(), new Date().getMonth() + 1)
  })

  // D) Clicking a confirmed booking event opens the detail panel with Join/Cancel
  test('confirmed booking event opens detail with Join and Cancel', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const date = ymd(daysFromNow(7))
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const chip = page.locator(`.fc-event[data-booking-id="${bookingFutureId}"]`)
    await expect(chip).toBeVisible({ timeout: 20_000 })
    await chip.click()
    const detail = page.getByTestId('booking-detail')
    await expect(detail).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId(`detail-status-${bookingFutureId}`)).toContainText('Confirmed')
    await expect(detail).toContainText('Online')
    const join = page.getByTestId(`join-${bookingFutureId}`)
    await expect(join).toBeDisabled()
    await expect(join).toHaveAttribute('title', 'Available 5 minutes before your session')
    await expect(page.getByTestId('detail-cancel')).toBeEnabled()
  })

  // E) Pending booking opens the detail panel with review note and Edit/Cancel buttons
  test('pending booking opens detail with review note and Edit/Cancel buttons', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const date = ymd(daysFromNow(10))
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const chip = page.locator(`.fc-event[data-booking-id="${bookingPendingId}"]`)
    await expect(chip).toBeVisible({ timeout: 20_000 })
    await chip.click()
    const detail = page.getByTestId('booking-detail')
    await expect(detail).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId(`detail-status-${bookingPendingId}`)).toContainText('Pending')
    await expect(detail).toContainText('Waiting for admin confirmation')
    await expect(detail).toContainText('Online')
    await expect(page.getByTestId(`join-${bookingPendingId}`)).toHaveCount(0)
    await expect(page.getByTestId('detail-reschedule')).toBeEnabled()
    await expect(page.getByTestId('detail-cancel')).toBeEnabled()
  })

  // E1) Booking within 24h shows Edit/Cancel disabled with an explanation
  test('booking within 24h shows disabled Edit and Cancel buttons', async ({ page }) => {
    const patientUser = await prisma.user.findUniqueOrThrow({ where: { email: patient.email } })
    const sessionStart = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const soonPending = await prisma.booking.create({
      data: {
        userId: patientUser.id,
        doctorId: null,
        date: utcDay(sessionStart),
        startTime: hhmm(sessionStart),
        endTime: hhmm(new Date(sessionStart.getTime() + 60 * 60 * 1000)),
        service: 'Marital Counseling',
        status: 'PENDING',
      },
    })
    try {
      await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
      const date = ymd(sessionStart)
      const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
      await gotoMonth(page, ty, tm)
      const chip = page.locator(`.fc-event[data-booking-id="${soonPending.id}"]`)
      await expect(chip).toBeVisible({ timeout: 20_000 })
      await chip.click()
      await expect(page.getByTestId('booking-detail')).toBeVisible({ timeout: 20_000 })
      await expect(page.getByTestId(`detail-status-${soonPending.id}`)).toContainText('Pending')
      await expect(page.getByTestId('detail-reschedule')).toBeDisabled()
      await expect(page.getByTestId('detail-cancel')).toBeDisabled()
      await expect(page.getByTestId('booking-detail')).toContainText('Changes close 24 hours before your session')
    } finally {
      await prisma.booking.deleteMany({ where: { id: soonPending.id } }).catch(() => undefined)
    }
  })

  // E4) Editing a pending booking opens the inline picker, picks a slot, and updates the time
  test('edit opens inline picker, reschedules pending booking, and refreshes', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const date = ymd(daysFromNow(10))
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const chip = page.locator(`.fc-event[data-booking-id="${bookingPendingId}"]`)
    await expect(chip).toBeVisible({ timeout: 20_000 })
    await chip.click()
    await expect(page.getByTestId('booking-detail')).toBeVisible({ timeout: 20_000 })

    await page.getByTestId('detail-reschedule').click()
    const box = page.getByTestId('reschedule-box')
    await expect(box).toBeVisible({ timeout: 20_000 })

    // Pick a different slot than the current one ('10:00').
    const slotButtons = page.locator('[data-testid^="reschedule-slot-"]')
    const slotCount = await slotButtons.count()
    let chosen = ''
    for (let i = 0; i < slotCount; i++) {
      const id = (await slotButtons.nth(i).getAttribute('data-testid')) ?? ''
      const time = id.replace('reschedule-slot-', '')
      if (time !== '10:00') {
        chosen = time
        await slotButtons.nth(i).click()
        break
      }
    }
    expect(chosen).not.toBe('')
    await expect(page.getByTestId('reschedule-confirm')).toBeEnabled()
    await page.getByTestId('reschedule-confirm').click()

    await expect(page.getByTestId('toast-success')).toBeVisible({ timeout: 20_000 })
    // The detail panel refreshes with the new time.
    await expect(page.getByTestId('booking-detail')).toContainText(formatTime(chosen), { timeout: 20_000 })
  })

  // E2) Legend prioritises the patient's booking states
  test('legend order prioritises booking states', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const legend = page.getByTestId('calendar-legend')
    await expect(legend).toBeVisible({ timeout: 20_000 })
    const text = (await legend.textContent()) ?? ''
    const order = ['Online confirmed', 'In-clinic confirmed', 'Pending', 'Available']
    let lastIndex = -1
    for (const label of order) {
      const i = text.indexOf(label)
      expect(i).toBeGreaterThan(lastIndex)
      lastIndex = i
    }
  })

  // E3) Outside-month dates are dimmed and not clickable
  test('outside-month dates are dimmed and not clickable', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const other = page.locator('.fc-day.fc-day-other').first()
    await expect(other).toBeVisible({ timeout: 20_000 })
    await other.locator('.fc-daygrid-day-frame').click({ force: true })
    await expect(page.getByTestId('booking-flow')).toHaveCount(0)
    await expect(page.getByTestId('booking-detail')).toHaveCount(0)
  })

  // E4) Clicking a Friday opens the booking flow like any normal day
  test('friday opens the booking flow like a normal day', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    // Next Friday strictly after today. Skip forward while the day is a
    // holiday (not clickable).
    let fri = ''
    for (let i = 0; i < 4; i++) {
      fri = await page.evaluate((weeks: number) => {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const d = new Date(today)
        do { d.setDate(d.getDate() + 1) } while (d.getDay() !== 5 || d <= today)
        d.setDate(d.getDate() + weeks * 7)
        const p = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      }, i)
      const [fy, fm] = fri.split('-').map((v) => parseInt(v, 10))
      await gotoMonth(page, fy, fm)
      const cls = await page.locator(`.fc-day[data-date="${fri}"]`).getAttribute('class')
      if (cls && !cls.includes('fc-holiday')) break
    }
    const [fy, fm] = fri.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, fy, fm)
    const cell = page.locator(`.fc-day[data-date="${fri}"]`)
    await expect(cell).toBeVisible({ timeout: 20_000 })
    await cell.locator('.fc-daygrid-day-top').click()
    await expect(page.getByTestId('booking-flow')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('flow-step-1')).toBeVisible()
    await page.getByTestId('flow-close').click()
  })

  // E4b) Saturday behaves like a normal weekday (booking flow opens)
  test('saturday behaves like a normal weekday', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    // Next Saturday strictly after today. The seed schedule covers Saturdays,
    // so free slots are expected. Skip forward while the day is a holiday.
    let sat = ''
    for (let i = 0; i < 4; i++) {
      sat = await page.evaluate((weeks: number) => {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const d = new Date(today)
        do { d.setDate(d.getDate() + 1) } while (d.getDay() !== 6 || d <= today)
        d.setDate(d.getDate() + weeks * 7)
        const p = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      }, i)
      const [sy, sm] = sat.split('-').map((v) => parseInt(v, 10))
      await gotoMonth(page, sy, sm)
      const cls = await page.locator(`.fc-day[data-date="${sat}"]`).getAttribute('class')
      if (cls && !cls.includes('fc-holiday')) break
    }
    const [sy, sm] = sat.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, sy, sm)
    const cell = page.locator(`.fc-day[data-date="${sat}"]`)
    await expect(cell).toBeVisible({ timeout: 20_000 })
    await cell.locator('.fc-daygrid-day-top').click()
    await expect(page.getByTestId('booking-flow')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('flow-next-1').click()
    await expect(page.getByTestId('flow-step-2')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-testid^="flow-slot-"]').first()).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('flow-close').click()
  })

  // E5) Available days show a magenta "+" marker in the day cell
  test('available days show a magenta plus marker', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const cell = page.locator('.fc-day.fc-can-book').first()
    await expect(cell).toBeVisible({ timeout: 20_000 })
    const top = cell.locator('.fc-daygrid-day-top')
    const markerColor = await top.evaluate((el) => window.getComputedStyle(el, '::after').color)
    expect(markerColor).toBe('rgb(233, 30, 140)')
    const markerContent = await top.evaluate((el) => window.getComputedStyle(el, '::after').content)
    expect(markerContent).toContain('+')
  })

  // E6) A booked day renders its event chip and still offers remaining slots in the flow
  test('booked day shows event chip plus remaining slots in flow', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const date = ymd(daysFromNow(10))
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const chip = page.locator(`.fc-event[data-booking-id="${bookingPendingId}"]`)
    await expect(chip).toBeVisible({ timeout: 20_000 })
    const cell = page.locator(`.fc-day[data-date="${date}"]`)
    await cell.locator('.fc-daygrid-day-top').click()
    await expect(page.getByTestId('booking-flow')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('flow-next-1').click()
    await expect(page.getByTestId('flow-step-2')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-testid^="flow-slot-"]').first()).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('flow-close').click()
  })

  // E7) Slots fetch failure shows an inline error and reselecting recovers
  test('slots fetch failure shows inline error and reselecting recovers', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await page.route('**/api/booking/available-slots*', (route) => route.abort())
    // Next Wednesday strictly after today: no fixture bookings land on Wednesdays.
    // Skip forward while the cell is a holiday (not clickable).
    let wed = ''
    for (let i = 0; i < 4; i++) {
      wed = await page.evaluate((weeks: number) => {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const d = new Date(today)
        do { d.setDate(d.getDate() + 1) } while (d.getDay() !== 3 || d <= today)
        d.setDate(d.getDate() + weeks * 7)
        const p = (n: number) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      }, i)
      const [wy, wm] = wed.split('-').map((v) => parseInt(v, 10))
      await gotoMonth(page, wy, wm)
      const cls = await page.locator(`.fc-day[data-date="${wed}"]`).getAttribute('class')
      if (cls && !cls.includes('fc-holiday')) break
    }
    const [wy, wm] = wed.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, wy, wm)
    const cell = page.locator(`.fc-day[data-date="${wed}"]`)
    await cell.locator('.fc-daygrid-day-top').click()
    await expect(page.getByTestId('booking-flow')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('flow-next-1').click()
    await expect(page.getByTestId('flow-step-2')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('flow-error')).toBeVisible({ timeout: 20_000 })
    await page.unrouteAll({ behavior: 'wait' })
    await page.getByTestId(`flow-day-${wed}`).click()
    await expect(page.locator('[data-testid^="flow-slot-"]').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('flow-error')).toHaveCount(0)
    await page.getByTestId('flow-close').click()
  })

  // F) Join button is active near session time and opens the session page
  test('join button is active near session time and opens the session page', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const chip = page.locator(`.fc-event[data-booking-id="${bookingNowId}"]`)
    await expect(chip).toBeVisible({ timeout: 20_000 })
    await chip.click()
    const join = page.getByTestId(`join-${bookingNowId}`)
    await expect(join).toBeVisible({ timeout: 20_000 })
    await expect(join).toBeEnabled({ timeout: 20_000 })
    await join.click()
    await page.waitForURL(`**/dashboard/session/${bookingNowId}`, { timeout: 20_000 })
  })

  // G) Join stays disabled outside the window
  test('join button stays disabled outside the join window', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const chip = page.locator(`.fc-event[data-booking-id="${bookingSessionId}"]`)
    await expect(chip).toBeVisible({ timeout: 20_000 })
    await chip.click()
    const join = page.getByTestId(`join-${bookingSessionId}`)
    await expect(join).toBeVisible({ timeout: 20_000 })
    await expect(join).toBeDisabled()
    await page.getByTestId('detail-close').click()
  })

  // H) Clicking an available day opens the booking flow at step 1
  test('available day opens the booking flow', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const slotCell = page.locator('.fc-day.fc-can-book').first()
    await expect(slotCell).toBeVisible({ timeout: 20_000 })
    const date = await slotCell.getAttribute('data-date')
    expect(date).toBeTruthy()
    await slotCell.locator('.fc-daygrid-day-top').click()
    await expect(page.getByTestId('booking-flow')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('flow-step-1')).toBeVisible()
    await expect(page.getByTestId('flow-progress')).toContainText('Step 1 of 3')
    await page.getByTestId('flow-next-1').click()
    await expect(page.getByTestId('flow-step-2')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId(`flow-day-${date}`)).toBeVisible()
    await expect(page.locator('[data-testid^="flow-slot-"]').first()).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('flow-close').click()
  })

  // H2) Sidebar mini calendar and upcoming sessions reflect bookings
  test('mini calendar and upcoming sessions reflect bookings', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await expect(page.getByTestId('mini-calendar')).toBeVisible({ timeout: 20_000 })
    // Today's fixtures always land in the mini calendar's initial month.
    const today = ymd(new Date())
    const miniDay = page.getByTestId(`mini-day-${today}`)
    await expect(miniDay).toBeVisible({ timeout: 20_000 })
    await expect(miniDay.getByTestId('mini-booking-dot')).toBeVisible()
    await expect(page.getByTestId(`upcoming-${bookingFutureId}`)).toBeVisible()
    await miniDay.click()
    await expect(page.getByTestId('calendar-label')).toBeVisible({ timeout: 20_000 })
  })

  // H3) View switcher changes between Monthly, Weekly, and Daily
  test('view switcher changes calendar views', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await expect(page.locator('.fc-daygrid-body')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('view-weekly').click()
    await expect(page.locator('.fc-timegrid')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('day-slots-strip')).toBeVisible()
    await page.getByTestId('view-daily').click()
    await expect(page.locator('.fc-timegrid')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('view-monthly').click()
    await expect(page.locator('.fc-daygrid-body')).toBeVisible({ timeout: 20_000 })
  })

  // I) Cancel moves the booking to Cancelled state in the detail panel
  test('cancelling an appointment shows Cancelled state', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const date = ymd(daysFromNow(7))
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const chip = page.locator(`.fc-event[data-booking-id="${bookingFutureId}"]`)
    await expect(chip).toBeVisible({ timeout: 20_000 })
    await chip.click()
    await expect(page.getByTestId('booking-detail')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('detail-cancel').click()
    await expect(page.getByTestId('cancel-box')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId(`cancel-confirm-${bookingFutureId}`).click()
    await expect(page.getByTestId(`detail-status-${bookingFutureId}`)).toContainText('Cancelled', { timeout: 20_000 })
    await expect(page.getByTestId('detail-cancel')).toHaveCount(0)
    await expect(page.getByTestId(`join-${bookingFutureId}`)).toHaveCount(0)
    await expect(page.getByTestId('detail-reschedule')).toHaveCount(0)
  })

  test('payments page loads with payment history', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await spaNavigateTo(page, '/dashboard/payments')
    await expect(page.getByTestId('page-title')).toHaveText('My Payments', { timeout: 20_000 })
    await expect(page.getByTestId('payment-row').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('EGP 250.00').first()).toBeVisible()
    await expect(page.getByText('SUCCESS').first()).toBeVisible()
  })

  test('payments page renders mobile card list', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await spaNavigateTo(page, '/dashboard/payments')
    await expect(page.getByTestId('page-title')).toHaveText('My Payments', { timeout: 20_000 })
    await expect(page.getByTestId('payment-card').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('payment-card').getByText('EGP 250.00').first()).toBeVisible()
  })

  test('profile page loads pre-filled and updates', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await spaNavigateTo(page, '/dashboard/profile')
    await expect(page.getByTestId('page-title')).toHaveText('Profile', { timeout: 20_000 })
    await expect(page.getByTestId('profile-email')).toContainText(patient.email)
    await expect(page.getByTestId('profile-name')).toHaveValue('E2E Patient')
    const toast = page.getByTestId('toast-success')
    await page.getByTestId('profile-name').fill('Updated Patient')
    await page.getByTestId('profile-phone').fill('+20123456789')
    await page.getByTestId('save-profile').click()
    await expect(toast).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('profile-name')).toHaveValue('Updated Patient')
  })

  test('session page shows countdown when outside the time window', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await spaNavigateTo(page, `/dashboard/session/${bookingSessionId}`)
    await expect(page.getByTestId('session-waiting')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Your session starts soon' })).toBeVisible()
  })

  test('meeting lobby shows the waiting state outside the join window', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await spaNavigateTo(page, `/meeting/${bookingSessionId}/lobby`)
    await expect(page.getByTestId('meeting-waiting')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Meeting not open yet' })).toBeVisible()
  })

  test('sidebar navigation works and logout redirects', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.getByTestId('nav-payments').click()
    await expect(page.getByTestId('page-title')).toHaveText('My Payments', { timeout: 20_000 })
    await page.getByTestId('nav-profile').click()
    await expect(page.getByTestId('page-title')).toHaveText('Profile', { timeout: 20_000 })
    await page.getByTestId('nav-appointments').click()
    await expect(page.getByTestId('page-title')).toHaveText('My Appointments', { timeout: 20_000 })
    await page.getByTestId('nav-logout').click()
    await page.waitForURL('**/login', { timeout: 20_000 })
  })

  test('mobile bottom nav works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await page.getByTestId('mobile-nav-payments').click()
    await expect(page.getByTestId('page-title')).toHaveText('My Payments', { timeout: 20_000 })
    await page.getByTestId('mobile-nav-profile').click()
    await expect(page.getByTestId('page-title')).toHaveText('Profile', { timeout: 20_000 })
    await page.getByTestId('mobile-nav-appointments').click()
    await expect(page.getByTestId('page-title')).toHaveText('My Appointments', { timeout: 20_000 })
  })

  // J) Mobile appointments page does not overlap or overflow horizontally
  test('mobile appointments page does not overflow horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await expect(page.locator('.fc-daygrid-body')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('mini-calendar')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('book-session')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})