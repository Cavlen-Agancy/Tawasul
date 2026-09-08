import { test, expect, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const fullStaff = { email: 'e2e.admin.full@test.com', password: 'TestPass123!' }
const limitedStaff = { email: 'e2e.admin.limited@test.com', password: 'TestPass123!' }

const ALL_PERMISSIONS = [
  'APPOINTMENTS:READ',
  'APPOINTMENTS:UPDATE',
  'APPOINTMENTS:DELETE',
  'PATIENTS:READ',
  'DOCTORS:CREATE',
  'DOCTORS:READ',
  'DOCTORS:UPDATE',
  'PAYMENTS:READ',
  'SETTINGS:READ',
  'SETTINGS:UPDATE',
  'STAFF:CREATE',
  'STAFF:READ',
  'STAFF:UPDATE',
  'STAFF:DELETE',
]

async function createStaff(email: string, permissions: string[]) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { isActive: true, emailVerified: true, accountType: 'STAFF' },
    create: {
      name: email === fullStaff.email ? 'E2E Full Admin' : 'E2E Limited Staff',
      email,
      password: await bcrypt.hash('TestPass123!', 12),
      accountType: 'STAFF',
      emailVerified: true,
      isActive: true,
    },
  })
  await prisma.permission.deleteMany({ where: { userId: user.id } })
  if (permissions.length > 0) {
    await prisma.permission.createMany({
      data: permissions.map((p) => {
        const [resource, action] = p.split(':')
        return { userId: user.id, resource: resource as never, action: action as never }
      }),
    })
  }
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

test.beforeAll(async () => {
  await createStaff(fullStaff.email, ALL_PERMISSIONS)
  await createStaff(limitedStaff.email, ['APPOINTMENTS:READ'])
})

test.afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [fullStaff.email, limitedStaff.email] } } }).catch(() => undefined)
  await prisma.$disconnect()
})

test.describe('Admin Panel routes', () => {
  test('unauthenticated user is redirected to /login from /admin', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL('**/login', { timeout: 20_000 })
  })

  test('/admin renders the Overview dashboard', async ({ page }) => {
    await loginAs(page, fullStaff.email, fullStaff.password, '/admin')
    await expect(page.getByTestId('page-title')).toHaveText('Admin Overview', { timeout: 20_000 })
    await expect(page.getByText('Total Bookings').first()).toBeVisible({ timeout: 20_000 })
  })

  const routes: Array<[string, string]> = [
    ['/admin/appointments', 'Appointments'],
    ['/admin/doctors', 'Manage Doctors'],
    ['/admin/patients', 'Manage Patients'],
    ['/admin/payments', 'Payments'],
    ['/admin/staff', 'Manage Staff'],
    ['/admin/settings', 'Settings'],
  ]
  for (const [path, title] of routes) {
    test(`${path} renders its own page`, async ({ page }) => {
      await loginAs(page, fullStaff.email, fullStaff.password, '/admin')
      await page.goto(path)
      await expect(page.getByTestId('page-title')).toHaveText(title, { timeout: 20_000 })
    })
  }

  test('/admin/appointments does not show the Overview', async ({ page }) => {
    await loginAs(page, fullStaff.email, fullStaff.password, '/admin')
    await page.goto('/admin/appointments')
    await expect(page.getByTestId('page-title')).toHaveText('Appointments', { timeout: 20_000 })
    await expect(page.getByText('Total Bookings')).toHaveCount(0)
  })

  test('staff without DOCTORS:READ is redirected from /admin/doctors to /admin', async ({ page }) => {
    await loginAs(page, limitedStaff.email, limitedStaff.password, '/admin')
    await page.goto('/admin/doctors')
    await page.waitForURL('**/admin', { timeout: 20_000 })
    await expect(page).not.toHaveURL(/\/admin\/doctors/)
  })

  test('staff with APPOINTMENTS:READ can open /admin/appointments', async ({ page }) => {
    await loginAs(page, limitedStaff.email, limitedStaff.password, '/admin')
    await page.goto('/admin/appointments')
    await expect(page.getByTestId('page-title')).toHaveText('Appointments', { timeout: 20_000 })
  })

  test('staff with only APPOINTMENTS:READ is blocked from all other admin pages', async ({ page }) => {
    await loginAs(page, limitedStaff.email, limitedStaff.password, '/admin')
    const denied = ['/admin/doctors', '/admin/patients', '/admin/payments', '/admin/staff', '/admin/settings']
    for (const path of denied) {
      await page.goto(path)
      await page.waitForURL('**/admin', { timeout: 20_000 })
      await expect(page).not.toHaveURL(new RegExp(`${path}$`))
    }
  })
})
