import { defineConfig } from 'playwright/test'
import base from './playwright.multiplayer.config.mjs'

export default defineConfig({
  ...base,
  testMatch: 'design-system-ui.spec.mjs',
  timeout: 180_000,
  outputDir: 'test-results/ui',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/ui-summary.json' }],
    ['html', { outputFolder: 'playwright-report/ui', open: 'never' }],
  ],
  use: {
    ...base.use,
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
