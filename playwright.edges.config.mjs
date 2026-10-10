import { defineConfig } from 'playwright/test'
import base from './playwright.multiplayer.config.mjs'

export default defineConfig({
  ...base,
  testMatch: ['room-edges.spec.mjs', 'gameplay-edges.spec.mjs'],
  timeout: 150_000,
  outputDir: 'test-results/edges',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/edges-summary.json' }],
    ['html', { outputFolder: 'playwright-report/edges', open: 'never' }],
  ],
})
