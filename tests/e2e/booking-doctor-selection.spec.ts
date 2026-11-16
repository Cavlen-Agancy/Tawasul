import { test, expect, type Page } from '@playwright/test'

const patient = { email: 'e2e.patient@test.com', password: 'TestPass123!' }

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
  await page.waitForURL('**/dashboard/**', { timeout: 30_000 })
}

async function openBook(page: Page) {
  await loginAsPatient(page)
  await gotoReady(page, '/book')
  await expect(page.getByTestId('doctors-grid')).toBeVisible({ timeout: 30_000 })
}

function columnCount(value: string): number {
  return value.split(' ').filter((part) => part.trim() && part.trim() !== 'none').length
}

test.describe('Doctor-first booking', () => {
  test('shows at most 12 doctor cards and paginates to different records', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openBook(page)

    const cards = page.locator('[data-testid^="doctor-card-"]')
    const firstPageCount = await cards.count()
    expect(firstPageCount).toBeGreaterThan(0)
    expect(firstPageCount).toBeLessThanOrEqual(12)

    const gridColumns = await page.getByTestId('doctors-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    // Large profile cards: three columns on desktop (never a cramped four-up).
    expect(columnCount(gridColumns)).toBe(3)

    const firstPageFirstId = await cards.first().getAttribute('data-testid')
    const next = page.getByTestId('doctors-next')
    if (await next.isVisible().catch(() => false)) {
      await next.click()
      await expect(page.getByTestId('doctors-page-label')).toContainText('Page 2')
      const secondPageFirstId = await cards.first().getAttribute('data-testid')
      expect(secondPageFirstId).not.toBe(firstPageFirstId)
      await expect(page.getByTestId('doctors-prev')).toBeEnabled()
    }
  })

  test('selecting a doctor reveals the session-type and time controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openBook(page)

    await expect(page.getByTestId('select-doctor-first')).toBeVisible()
    await page.locator('[data-testid^="doctor-card-"]').first().click()
    await expect(page.getByTestId('select-doctor-first')).toHaveCount(0)
    await expect(page.getByTestId('session-type-online')).toBeVisible()
    await expect(page.getByTestId('session-type-in-clinic')).toBeVisible()
  })

  test('tablet uses two columns and mobile uses one without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 })
    await openBook(page)
    const tabletColumns = await page.getByTestId('doctors-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    expect(columnCount(tabletColumns)).toBe(2)

    await page.setViewportSize({ width: 390, height: 844 })
    const mobileColumns = await page.getByTestId('doctors-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns)
    expect(columnCount(mobileColumns)).toBe(1)

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  })
})

test.describe('Doctor booking journey', () => {
  test('online booking reaches verified payment confirmation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openBook(page)
    await page.locator('[data-testid^="doctor-card-"]').first().click()

    const availableDay = page.locator('.fc-tawasul-available').first()
    await expect(availableDay).toBeVisible({ timeout: 30_000 })
    await availableDay.click()

    const slot = page.locator('[data-testid^="booking-slot-"]').first()
    await expect(slot).toBeVisible({ timeout: 30_000 })
    await slot.click()

    await expect(page.getByTestId('confirm-pay')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('confirm-pay').click()

    await page.waitForURL('**/booking/success**', { timeout: 60_000 })
    await expect(page.getByText('Booking Confirmed')).toBeVisible({ timeout: 20_000 })
  })

  test('in-clinic booking confirms without a payment step', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openBook(page)
    await page.locator('[data-testid^="doctor-card-"]').first().click()
    await page.getByTestId('session-type-in-clinic').click()

    const availableDay = page.locator('.fc-tawasul-available').first()
    await expect(availableDay).toBeVisible({ timeout: 30_000 })
    await availableDay.click()

    const slot = page.locator('[data-testid^="booking-slot-"]').first()
    await expect(slot).toBeVisible({ timeout: 30_000 })
    await slot.click()

    await expect(page.getByTestId('confirm-pay')).toBeVisible({ timeout: 20_000 })
    await page.getByTestId('confirm-pay').click()

    await page.waitForURL('**/booking/success**', { timeout: 30_000 })
    await expect(page.getByText('Booking Confirmed')).toBeVisible({ timeout: 20_000 })
  })
})

test.describe('Doctor switching', () => {
  test('switching doctors clears the previously selected day and slots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await openBook(page)
    const cards = page.locator('[data-testid^="doctor-card-"]')
    await cards.nth(0).click()

    const availableDay = page.locator('.fc-tawasul-available').first()
    await expect(availableDay).toBeVisible({ timeout: 30_000 })
    await availableDay.click()
    await expect(page.locator('[data-testid^="booking-slot-"]').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Available times on/)).toBeVisible()

    await cards.nth(1).click()
    await expect(page.getByText(/Available times on/)).toHaveCount(0)
    await expect(page.getByTestId('session-type-online')).toBeVisible()
  })
})
