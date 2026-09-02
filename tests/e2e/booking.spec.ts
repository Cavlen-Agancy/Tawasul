import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const patient = { email: 'e2e.patient@test.com', password: 'TestPass123!' }

let doctorId = ''

/**
 * Waits until the Vue/Nuxt client has hydrated (the `#__nuxt` root gets `data-v-app`).
 */
async function gotoReady(page: Page, path: string) {
  await page.goto(path)
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null
    return root && '__vue_app__' in root
  }, { timeout: 30_000 })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(250)
}

async function loginAsPatient(page: Page) {
  await gotoReady(page, '/login')
  await page.getByTestId('login-email').fill(patient.email)
  await page.getByTestId('login-password').fill(patient.password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL('**/dashboard', { timeout: 30_000 })
  await page.waitForTimeout(500)
}

/**
 * The app restores auth state only on the client (plugins/auth.ts), so a full SSR
 * page load of an auth-guarded route gets a 302 → /login bounce. Navigate to /book
 * via the Nuxt router instead so the client-side auth state is preserved.
 */
async function spaNavigateTo(page: Page, path: string) {
  await page.evaluate((p) => {
    const app = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: any }) | null
    app?.__vue_app__?.config?.globalProperties?.$router?.push(p)
  }, path)
  await page.waitForURL(`**${path}`, { timeout: 20_000 })
  await page.waitForTimeout(300)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Returns an ISO date that is a fixed number of days in the future but within the
 * next month, guaranteeing future available slots regardless of when the test runs.
 */
function futureTargetDate(): { date: string; monthForDisplay: number } {
  const base = new Date()
  const month = new Date(base.getFullYear(), base.getMonth() + 1, 1)
  const target = new Date(month.getFullYear(), month.getMonth(), 12)
  return { date: ymd(target), monthForDisplay: month.getMonth() + 1 }
}

test.beforeAll(async () => {
  // Ensure the e2e patient exists (matches global-setup).
  await prisma.user.upsert({
    where: { email: patient.email },
    update: { isActive: true, emailVerified: true },
    create: {
      name: 'E2E Patient',
      email: patient.email,
      password: await bcrypt.hash(patient.password, 12),
      accountType: 'PATIENT',
      emailVerified: true,
      isActive: true,
    },
  })

  // Create a dedicated doctor available on ALL days, 09:00–21:00.
  const slug = `e2e-dr-${Date.now()}`
  const user = await prisma.user.create({
    data: {
      email: `${slug}@test.com`,
      name: 'Dr E2E Booking',
      password: await bcrypt.hash('TestPass123!', 12),
      accountType: 'DOCTOR',
      emailVerified: true,
      isActive: true,
    },
  })
  const doctor = await prisma.doctor.create({
    data: {
      userId: user.id,
      slug,
      bio: 'E2E booking doctor',
      specializations: ['Marital Counseling'],
      isActive: true,
    },
  })
  doctorId = doctor.id
  for (let day = 0; day <= 6; day++) {
    await prisma.availability.create({
      data: { doctorId: doctor.id, dayOfWeek: day, startTime: '09:00', endTime: '21:00', sessionDuration: 60 },
    })
  }
})

test.afterAll(async () => {
  await prisma.availability.deleteMany({ where: { doctorId } }).catch(() => undefined)
  await prisma.blockedSlot.deleteMany({ where: { doctorId } }).catch(() => undefined)
  await prisma.booking.deleteMany({ where: { doctorId } }).catch(() => undefined)
  const doc = await prisma.doctor.findUnique({ where: { id: doctorId } })
  await prisma.doctor.deleteMany({ where: { id: doctorId } }).catch(() => undefined)
  if (doc) await prisma.user.deleteMany({ where: { id: doc.userId } }).catch(() => undefined)
  await prisma.$disconnect()
})

test.describe('Booking Flow', () => {
  test('books a session end-to-end with mocked payment and shows the success page', async ({ page }) => {
    page.on('response', async (r) => {
      if (r.url().includes('/api/booking/') && !r.url().includes('/api/booking/available')) {
        console.log('DIAG booking resp:', r.status(), r.url().replace('http://127.0.0.1:3456', ''))
        try { console.log('DIAG booking body:', (await r.text()).slice(0, 150)) } catch {}
      }
      if (r.url().includes('/api/auth/me')) {
        console.log('DIAG me resp:', r.status())
      }
    })
    await loginAsPatient(page)

    const { date, monthForDisplay } = futureTargetDate()
    const todayMonthForDisplay = new Date().getMonth() + 1

    await spaNavigateTo(page, '/book')

    // Navigate to the target month if needed (fullcalendar month nav now drives the view).
    if (monthForDisplay !== todayMonthForDisplay) {
      await page.getByRole('button', { name: 'Next month' }).click()
      await page.waitForTimeout(800)
    }

    const cell = page.locator(`.fc-day[data-date="${date}"]`)
    await expect(cell).toHaveClass(/fc-tawasul-available/, { timeout: 25_000 })
    await cell.locator('.fc-daygrid-day-frame').click()

    // Pick the first available slot.
    const slotBtn = page.locator('[data-testid^="booking-slot-"]').first()
    await expect(slotBtn).toBeVisible({ timeout: 20_000 })
    const slotTime = (await slotBtn.textContent())?.trim()
    await slotBtn.click()

    // Review step.
    await expect(page.getByRole('heading', { name: 'Review your booking' })).toBeVisible()
    expect(slotTime).toBeTruthy()

    // Confirm and pay → mock payment → redirect to success.
    const paymentNav = page.waitForURL('**/booking/success**', { timeout: 40_000 })
    await page.getByTestId('confirm-pay').click()
    await paymentNav
    await page.waitForTimeout(1000)

    console.log('DIAG url:', page.url())
    console.log('DIAG cookies:', JSON.stringify((await page.context().cookies()).map((c) => ({ name: c.name, domain: c.domain, path: c.path }))))
    const dbBooking = await prisma.booking.findFirst({ where: { doctorId }, include: { payment: true }, orderBy: { createdAt: 'desc' } })
    console.log('DIAG booking:', JSON.stringify(dbBooking ? { id: dbBooking.id, status: dbBooking.status, pay: dbBooking.payment?.status } : null))

    await expect(page.getByRole('heading', { name: 'Booking Confirmed' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/session has been confirmed/)).toBeVisible()

    // Verify DB state: booking confirmed, payment succeeded.
    const booking = await prisma.booking.findFirst({
      where: { doctorId },
      include: { payment: true },
      orderBy: { createdAt: 'desc' },
    })
    expect(booking).toBeTruthy()
    expect(booking?.status).toBe('CONFIRMED')
    expect(booking?.payment?.status).toBe('SUCCESS')
  })

  test('unauthicated user is redirected to /login from /book', async ({ page }) => {
    await page.goto('/book')
    await page.waitForURL('**/login', { timeout: 20_000 })
  })
})
