import { defineConfig, devices } from 'playwright/test'
import effects from './playwright.effects.config.mjs'

export default defineConfig({
  ...effects,
  testMatch: 'mobile-gameplay.spec.mjs',
  timeout: 240_000,
  outputDir: 'test-results/mobile',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/mobile-summary.json' }],
    ['html', { outputFolder: 'playwright-report/mobile', open: 'never' }],
  ],
  use: {
    ...effects.use,
    // Each isolated-player context below owns its trace and diagnostics.
    trace: 'off',
    reducedMotion: 'reduce',
    screenshot: 'only-on-failure',
    launchOptions: {},
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
          : {},
      },
    },
    {
      name: 'webkit-phone-smoke',
      grep: /@phone-smoke/,
      use: {
        ...devices['iPhone 13'],
        browserName: 'webkit',
        viewport: { width: 390, height: 844 },
        // Never send a Chromium executable override to WebKit.
        launchOptions: {},
      },
    },
  ],
})
