import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:3456',
    headless: true,
  },
  webServer: {
    command: 'HOST=127.0.0.1 PORT=3456 npx nuxt dev --port 3456 --host 127.0.0.1',
    url: 'http://127.0.0.1:3456',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})