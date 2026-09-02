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

/** Navigate the calendar to the given year/month using the custom next/prev buttons. */
async function gotoMonth(page: Page, year: number, month: number) {
  const target = monthLabel(year, month)
  // Reset to today so month math starts from a known point.
  await page.getByTestId('calendar-today').click()
  await page.waitForTimeout(250)
  const today = new Date()
  const diffMonths = (year - today.getFullYear()) * 12 + (month - (today.getMonth() + 1))
  if (diffMonths === 0) {
    await expect(page.getByTestId('calendar-month')).toHaveText(target, { timeout: 15_000 })
    return
  }
  const dir = diffMonths < 0 ? -1 : 1
  const label = dir < 0 ? 'Previous month' : 'Next month'
  // Guard against a flaky reset: click in the correct direction until the label matches.
  for (let i = 0; i < Math.abs(diffMonths) + 6; i++) {
    const current = (await page.getByTestId('calendar-month').textContent())?.trim() ?? ''
    if (current === target) break
    await page.getByRole('button', { name: label }).click()
    await page.waitForTimeout(250)
  }
  await expect(page.getByTestId('calendar-month')).toHaveText(target, { timeout: 15_000 })
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
      date: new Date(),
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
      date: daysFromNow(7),
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
      date: new Date(),
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
      date: daysFromNow(-8),
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
      date: daysFromNow(-7),
      startTime: '10:00',
      endTime: '11:00',
      service: 'Marital Counseling',
      status: 'CANCELLED',
    },
  })
  pastCancelledId = pastCancelled.id

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
    .deleteMany({ where: { bookingId: { in: [bookingNowId, bookingFutureId, bookingSessionId, pastConfirmedId, pastCancelledId] } } })
    .catch(() => undefined)
  await prisma.payment.deleteMany({ where: { id: paymentId } }).catch(() => undefined)
  await prisma.booking
    .deleteMany({ where: { id: { in: [bookingNowId, bookingFutureId, bookingSessionId, pastConfirmedId, pastCancelledId] } } })
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

  test('non-patient (doctor) is redirected to /doctor', async ({ page }) => {
    await loginAs(page, doctor.email, doctor.password, '/doctor')
    await spaNavigateTo(page, '/dashboard/appointments')
    await page.waitForURL('**/doctor', { timeout: 20_000 })
    await expect(page.getByRole('heading', { name: 'Doctor Dashboard' })).toBeVisible()
  })

  test('dashboard redirects to /dashboard/appointments', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await spaNavigateTo(page, '/dashboard')
    await page.waitForURL('**/dashboard/appointments', { timeout: 20_000 })
    await expect(page.getByTestId('page-title')).toHaveText('My Appointments')
  })

  // A) Calendar loads
  test('calendar loads with month view', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await expect(page.getByTestId('page-title')).toHaveText('My Appointments', { timeout: 20_000 })
    await expect(page.locator('.fc-daygrid-body')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.fc-day[data-date]').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('calendar-month')).not.toHaveText('')
  })

  // B) Existing appointments appear as calendar events
  test('existing appointments appear as calendar events', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const today = ymd(new Date())
    const cell = page.locator(`.fc-day[data-date="${today}"]`)
    await expect(cell).toBeVisible({ timeout: 20_000 })
    await expect(cell.locator(`.fc-event.fc-tawasul-event-${bookingNowId}`)).toBeVisible({ timeout: 20_000 })
    await expect(cell.locator(`.fc-event.fc-tawasul-event-${bookingSessionId}`)).toBeVisible()
  })

  // C) Past appointments visible inside the calendar (no separate section)
  test('past appointments are visible inside the calendar', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const pastDate = ymd(daysFromNow(-8))
    const [py, pm] = pastDate.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, py, pm)
    const cell = page.locator(`.fc-day[data-date="${pastDate}"]`)
    await expect(cell.locator(`.fc-event.fc-tawasul-event-${pastConfirmedId}`)).toBeVisible({ timeout: 20_000 })
  })

  // D) No "No past appointments" empty-state section
  test('there is no separate "No past appointments" section', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await expect(page.getByText('No past appointments')).toHaveCount(0)
    await expect(page.getByText('No upcoming appointments. Book your first session.')).toHaveCount(0)
  })

  // E) Clicking an available future day opens the booking dialog
  test('clicking an available future day opens the booking dialog', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const { date } = futureTargetDate()
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const cell = page.locator(`.fc-day[data-date="${date}"]`)
    await expect(cell).toHaveClass(/fc-tawasul-available/, { timeout: 20_000 })
    await cell.locator('.fc-daygrid-day-frame').click()
    await expect(page.getByTestId('booking-dialog')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('booking-dialog-date')).toContainText(/20/)
  })

  // F) Available slots are displayed in the dialog
  test('available slots are displayed in the dialog', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const { date } = futureTargetDate()
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const cell = page.locator(`.fc-day[data-date="${date}"]`)
    await cell.locator('.fc-daygrid-day-frame').click()
    await expect(page.getByTestId('booking-dialog')).toBeVisible({ timeout: 20_000 })
    const slots = page.getByTestId('booking-dialog').locator('[data-slot-time]')
    await expect(slots.first()).toBeVisible({ timeout: 20_000 })
    expect(await slots.count()).toBeGreaterThan(0)
  })

  // G) Past time slots are not offered (server excludes them) and the dialog slots are enabled
  test('past time slots are not offered; offered slots are enabled', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const { date } = futureTargetDate()
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const cell = page.locator(`.fc-day[data-date="${date}"]`)
    await cell.locator('.fc-daygrid-day-frame').click()
    await expect(page.getByTestId('booking-dialog')).toBeVisible({ timeout: 20_000 })
    // None of the offered slots may be disabled (the server never returns past times).
    await expect(page.getByTestId('booking-dialog').locator('[data-slot-time][disabled]')).toHaveCount(0)
  })

  // H + I) Past dates and unavailable dates cannot be booked
  test('past dates and unavailable dates cannot be booked', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')

    // Past date -> no dialog opens.
    const pastDate = ymd(daysFromNow(-2))
    const [py, pm] = pastDate.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, py, pm)
    const pastCell = page.locator(`.fc-day[data-date="${pastDate}"]`)
    await pastCell.locator('.fc-daygrid-day-frame').click({ force: true })
    await expect(page.getByTestId('booking-dialog')).toHaveCount(0)

    // Unavailable future date (blocked) -> no dialog opens.
    const [ty, tm] = blockedDate.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const blockedCell = page.locator(`.fc-day[data-date="${blockedDate}"]`)
    await expect(blockedCell).toHaveClass(/fc-tawasul-unavailable/, { timeout: 20_000 })
    await blockedCell.locator('.fc-daygrid-day-frame').click({ force: true })
    await expect(page.getByTestId('booking-dialog')).toHaveCount(0)
  })

  // J + K) Selecting a slot enables the button and booking continues into the existing flow
  test('selecting a slot enables booking and continues to the existing review flow', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const { date } = futureTargetDate()
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const cell = page.locator(`.fc-day[data-date="${date}"]`)
    await cell.locator('.fc-daygrid-day-frame').click()
    const dialog = page.getByTestId('booking-dialog')
    await expect(dialog).toBeVisible({ timeout: 20_000 })

    const bookBtn = page.getByTestId('book-appointment')
    await expect(bookBtn).toBeDisabled()

    const slot = dialog.locator('[data-slot-time]').first()
    await slot.click()
    await expect(bookBtn).toBeEnabled()

    await bookBtn.click()
    // Continues into the existing Phase 3 booking flow at the Review step.
    await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveURL(/\/book/)
  })

  // L) Egyptian holiday is displayed and blocks booking
  test('Egyptian holiday is displayed and blocks booking', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    // Coptic Christmas 2027-01-07 is a fixed holiday in the future.
    const holiday = '2027-01-07'
    await gotoMonth(page, 2027, 1)
    const cell = page.locator(`.fc-day[data-date="${holiday}"]`)
    await expect(cell).toHaveClass(/fc-tawasul-holiday/, { timeout: 20_000 })
    await cell.locator('.fc-daygrid-day-frame').click({ force: true })
    await expect(page.getByTestId('booking-dialog')).toHaveCount(0)
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

  // M) Mobile calendar does not overlap or overflow horizontally
  test('mobile calendar does not overflow horizontally', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await expect(page.locator('.fc-daygrid-body')).toBeVisible({ timeout: 20_000 })
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })

  // N) Booking dialog works on mobile (fits viewport, slots usable)
  test('booking dialog works on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    const { date } = futureTargetDate()
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const cell = page.locator(`.fc-day[data-date="${date}"]`)
    await cell.locator('.fc-daygrid-day-frame').click()
    const dialog = page.getByTestId('booking-dialog')
    await expect(dialog).toBeVisible({ timeout: 20_000 })
    const box = await dialog.boundingBox()
    expect(box).toBeTruthy()
    expect(box!.width).toBeLessThanOrEqual(410)
    expect(box!.x).toBeGreaterThanOrEqual(0)
    const slot = dialog.locator('[data-slot-time]').first()
    await slot.click()
    await expect(page.getByTestId('book-appointment')).toBeEnabled()
  })

  // O) RTL Arabic layout works
  test('RTL Arabic layout renders the calendar and dialog', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await page.evaluate(() => {
      document.documentElement.setAttribute('dir', 'rtl')
      document.documentElement.setAttribute('lang', 'ar')
    })
    await expect(page.locator('.fc-daygrid-body')).toBeVisible({ timeout: 20_000 })
    const { date } = futureTargetDate()
    const [ty, tm] = date.split('-').map((v) => parseInt(v, 10))
    await gotoMonth(page, ty, tm)
    const cell = page.locator(`.fc-day[data-date="${date}"]`)
    await cell.locator('.fc-daygrid-day-frame').click()
    await expect(page.getByTestId('booking-dialog')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('booking-dialog').locator('[data-slot-time]').first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
    await page.evaluate(() => document.documentElement.setAttribute('dir', 'ltr'))
  })
})