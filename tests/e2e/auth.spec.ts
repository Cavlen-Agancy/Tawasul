import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const patient = { email: 'e2e.patient@test.com', password: 'TestPass123!' }
const doctor = { email: 'e2e.doctor@test.com', password: 'TestPass123!' }
const staff = { email: 'e2e.staff@test.com', password: 'TestPass123!' }

/**
 * Waits until the Vue/Nuxt client has hydrated (the `#__nuxt` root gets `data-v-app`).
 * Filling a form before hydration can trigger a native browser GET submit because the
 * `@submit.prevent` handler is not attached yet — so we always wait before interacting.
 */
async function gotoReady(page: Page, path: string) {
  await page.goto(path)
  // Wait until Vue has actually mounted into #__nuxt. Nuxt does not set a `data-v-app`
  // attribute on the root, so detect hydration via the `__vue_app__` property that
  // `createApp().mount()` sets on the container element.
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null
    return root && '__vue_app__' in root
  }, { timeout: 30_000 })
  // Let Vue patch/delegate the form submit handlers (and finish any in-flight requests
  // such as the auth plugin's fetchMe) before we start interacting. Without this settle,
  // a submit click during a cold dev-server compile can fall through to a native browser
  // GET (URL gets ?name=...&password=... query params) because @submit.prevent is not yet
  // attached.
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  await page.waitForTimeout(250)
}

async function loginAs(page: Page, email: string, password: string) {
  await gotoReady(page, '/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
}

test.describe('Patient Registration Flow', () => {
  test('registers a new patient and shows the check-your-email screen', async ({ page }) => {
    const email = `test-patient-${Date.now()}@example.com`
    await gotoReady(page, '/register')
    await page.getByTestId('register-name').fill('Test Patient')
    await page.getByTestId('register-email').fill(email)
    await page.getByTestId('register-password').fill('TestPass123!')
    await page.getByTestId('register-confirm').fill('TestPass123!')
    const apiDone = page.waitForResponse((r) => r.url().includes('/api/auth/register'), { timeout: 30_000 })
    await page.getByTestId('register-submit').click()
    await apiDone

    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
    await expect(page.getByText(/verification link to/)).toBeVisible()
  })
})

test.describe('Email Verification Flow', () => {
  test('verifies the email with a valid token', async ({ page }) => {
    const prisma = new PrismaClient()
    const email = `verify-${Date.now()}@example.com`
    const hashed = await bcrypt.hash('TestPass123!', 12)
    await prisma.user.create({
      data: {
        name: 'Verify Tester',
        email,
        password: hashed,
        accountType: 'PATIENT',
        emailVerified: false,
        isActive: true,
        emailVerificationToken: 'verify-token-e2e',
        emailVerificationExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    })
    await prisma.$disconnect()

    await gotoReady(page, '/verify-email?token=verify-token-e2e')
    await expect(page.getByTestId('verify-success')).toContainText('Email verified. You can now log in.')
    await expect(page.getByRole('link', { name: 'Go to login' })).toBeVisible()
  })
})

test.describe('Login Flow', () => {
  test('patient logs in and is redirected to /dashboard', async ({ page }) => {
    await loginAs(page, patient.email, patient.password)
    await page.waitForURL('**/dashboard')
    await expect(page.getByRole('heading', { name: 'Patient Dashboard' })).toBeVisible()
  })

  test('doctor logs in and is redirected to /doctor', async ({ page }) => {
    await loginAs(page, doctor.email, doctor.password)
    await page.waitForURL('**/doctor')
    await expect(page.getByRole('heading', { name: 'Doctor Dashboard' })).toBeVisible()
  })

  test('staff logs in and is redirected to /admin', async ({ page }) => {
    await loginAs(page, staff.email, staff.password)
    await page.waitForURL('**/admin')
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible()
  })

  test('wrong password shows Invalid credentials and stays on /login', async ({ page }) => {
    await loginAs(page, patient.email, 'WrongPass123!')
    await expect(page.getByTestId('login-error')).toContainText('Invalid credentials')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Logout Flow', () => {
  test('logs out and redirects to /login with cookie cleared', async ({ page }) => {
    await loginAs(page, patient.email, patient.password)
    await page.waitForURL('**/dashboard')

    const cookiesAfterLogin = await page.context().cookies()
    expect(cookiesAfterLogin.some((c) => c.name === 'auth_token')).toBe(true)

    await page.request.post('/api/auth/logout')
    await gotoReady(page, '/dashboard')
    await page.waitForURL('**/login')
  })
})

test.describe('Guest Middleware Redirects', () => {
  test('logged-in patient visiting /login is redirected to /dashboard', async ({ page }) => {
    await loginAs(page, patient.email, patient.password)
    await page.waitForURL('**/dashboard')
    await gotoReady(page, '/login')
    await page.waitForURL('**/dashboard')
    await expect(page.getByRole('heading', { name: 'Patient Dashboard' })).toBeVisible()
  })
})

test.describe('Auth Middleware Redirects', () => {
  test('logged-out user visiting /dashboard is redirected to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL('**/login')
  })
})

test.describe('Forgot Password Flow', () => {
  test('sends a reset link and disables the button', async ({ page }) => {
    await gotoReady(page, '/forgot-password')
    await page.getByTestId('forgot-email').fill(patient.email)
    await page.getByTestId('forgot-submit').click()
    await expect(page.getByTestId('forgot-success')).toContainText(
      'If this email exists, a reset link has been sent.',
    )
  })
})

test.describe('Reset Password Flow', () => {
  test('resets the password and redirects to login', async ({ page }) => {
    const prisma = new PrismaClient()
    const email = `reset-${Date.now()}@example.com`
    const hashed = await bcrypt.hash('OldPass123!', 12)
    await prisma.user.create({
      data: {
        name: 'Reset Tester',
        email,
        password: hashed,
        accountType: 'PATIENT',
        emailVerified: true,
        isActive: true,
        passwordResetToken: 'reset-token-e2e',
        passwordResetExpiry: new Date(Date.now() + 60 * 60 * 1000),
      },
    })
    await prisma.$disconnect()

    await gotoReady(page, '/reset-password?token=reset-token-e2e')
    await page.getByTestId('reset-password').fill('NewPass123!')
    await page.getByTestId('reset-confirm').fill('NewPass123!')
    await page.getByTestId('reset-submit').click()

    await expect(page.getByTestId('reset-success')).toContainText('Password updated successfully.')
    await page.waitForURL('**/login', { timeout: 10_000 })
  })
})
