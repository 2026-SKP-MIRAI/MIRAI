import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 300_000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: false,
    video: 'on',
    screenshot: 'on',
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      slowMo: 500,
    },
  },
  outputDir: './e2e/test-results',
  webServer: {
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
