import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const patient = { email: 'e2e.patient@test.com', password: 'TestPass123!' }
const doctor = { email: 'e2e.doctor@test.com', password: 'TestPass123!' }

let doctorId = ''
let bookingNowId = '' // CONFIRMED, starts in ~3 min (join window open)
let bookingFutureId = '' // CONFIRMED, >24h out (cancel allowed, join disabled)
let bookingSessionId = '' // CONFIRMED, starts in ~30 min (outside join window, never cancelled)
let pastConfirmedId = '' // CONFIRMED, in the past (Past tab -> Completed)
let pastCancelledId = '' // CANCELLED (Past tab -> Cancelled)
let paymentId = ''

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function hhmm(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
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

/**
 * Auth is restored client-side only, so cross-page navigation of protected routes
 * must go through the Nuxt router to preserve the auth state.
 */
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

  // Booking starting in ~3 minutes (join window open).
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

  // Booking >24h out (cancel allowed, join disabled).
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

  // Booking starting in ~30 minutes (outside join window, stays CONFIRMED for session countdown test).
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
      date: daysFromNow(-7),
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
      date: daysFromNow(-6),
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
})

test.afterAll(async () => {
  await prisma.sessionRoom
    .deleteMany({ where: { bookingId: { in: [bookingNowId, bookingFutureId, bookingSessionId] } } })
    .catch(() => undefined)
  await prisma.payment.deleteMany({ where: { id: paymentId } }).catch(() => undefined)
  await prisma.booking
    .deleteMany({
      where: { id: { in: [bookingNowId, bookingFutureId, bookingSessionId, pastConfirmedId, pastCancelledId] } },
    })
    .catch(() => undefined)
  await prisma.availability.deleteMany({ where: { doctorId } }).catch(() => undefined)
  await prisma.blockedSlot.deleteMany({ where: { doctorId } }).catch(() => undefined)
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

  test('appointments page loads with upcoming bookings', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await page.waitForURL('**/dashboard/appointments', { timeout: 20_000 })

    await expect(page.getByTestId('page-title')).toHaveText('My Appointments')
    await expect(page.getByText('Dr. Patient Dashboard').first()).toBeVisible({ timeout: 20_000 })

    // Upcoming tab active by default
    await expect(page.getByTestId('appointment-card').first()).toBeVisible({ timeout: 20_000 })

    // Join button for the near-start booking is enabled (within window)
    await expect(page.getByTestId(`join-${bookingNowId}`)).toBeVisible()
    await expect(page.getByTestId(`join-${bookingNowId}`)).not.toHaveClass(/pointer-events-none/)

    // Join button for the future booking is disabled (outside window)
    await expect(page.getByTestId(`join-${bookingFutureId}`)).toHaveClass(/pointer-events-none/)

    // Exactly one cancel button (only the >24h future booking is cancellable)
    await expect(page.getByTestId('cancel-booking')).toHaveCount(1)
  })

  test('appointments tabs switch between upcoming and past', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await page.waitForURL('**/dashboard/appointments', { timeout: 20_000 })

    await page.getByTestId('tab-past').click()
    await expect(page.getByText('Completed').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Cancelled').first()).toBeVisible()

    await page.getByTestId('tab-upcoming').click()
    await expect(page.getByTestId(`join-${bookingNowId}`)).toBeVisible({ timeout: 20_000 })
  })

  test('cancel appointment moves the card to the past tab', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await page.waitForURL('**/dashboard/appointments', { timeout: 20_000 })

    await page.getByTestId('cancel-booking').first().click()
    await expect(page.getByTestId('cancel-dialog-confirm')).toBeVisible()
    await page.getByTestId('cancel-dialog-confirm').click()

    // Card moved out of upcoming
    await expect(page.getByTestId(`join-${bookingFutureId}`)).not.toBeVisible({ timeout: 20_000 })

    // Appears in past tab as Cancelled
    await page.getByTestId('tab-past').click()
    await expect(page.getByText('Cancelled').first()).toBeVisible({ timeout: 20_000 })
  })

  test('payments page loads with payment history', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await spaNavigateTo(page, '/dashboard/payments')

    await expect(page.getByTestId('page-title')).toHaveText('My Payments')
    await expect(page.getByTestId('payment-row').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('EGP 250.00').first()).toBeVisible()
    await expect(page.getByText('SUCCESS').first()).toBeVisible()
  })

  test('payments page renders mobile card list', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await spaNavigateTo(page, '/dashboard/payments')

    await expect(page.getByTestId('page-title')).toHaveText('My Payments')
    await expect(page.getByTestId('payment-card').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('payment-card').getByText('EGP 250.00').first()).toBeVisible()
  })

  test('profile page loads pre-filled and updates', async ({ page }) => {
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')
    await spaNavigateTo(page, '/dashboard/profile')

    await expect(page.getByTestId('page-title')).toHaveText('Profile')
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
    await expect(page.getByTestId('page-title')).toHaveText('My Payments')

    await page.getByTestId('nav-profile').click()
    await expect(page.getByTestId('page-title')).toHaveText('Profile')

    await page.getByTestId('nav-appointments').click()
    await expect(page.getByTestId('page-title')).toHaveText('My Appointments')

    await page.getByTestId('nav-logout').click()
    await page.waitForURL('**/login', { timeout: 20_000 })
  })

  test('mobile bottom nav works', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await loginAs(page, patient.email, patient.password, '/dashboard/appointments')

    await page.getByTestId('mobile-nav-payments').click()
    await expect(page.getByTestId('page-title')).toHaveText('My Payments')

    await page.getByTestId('mobile-nav-profile').click()
    await expect(page.getByTestId('page-title')).toHaveText('Profile')

    await page.getByTestId('mobile-nav-appointments').click()
    await expect(page.getByTestId('page-title')).toHaveText('My Appointments')
  })
})