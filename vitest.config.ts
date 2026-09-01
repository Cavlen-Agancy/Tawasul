import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['tests/api/setup.ts'],
    include: ['tests/**/*.{test,spec}.ts'],
    // API tests hit the shared dev PostgreSQL; keep them isolated per-file
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
})