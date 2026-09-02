import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  webServer: {
    command: 'node .output/server/index.mjs',
    url: 'http://127.0.0.1:3456',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})