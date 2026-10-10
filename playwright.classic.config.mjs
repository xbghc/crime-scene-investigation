import { defineConfig } from 'playwright/test'
import { randomUUID } from 'node:crypto'
import base from './playwright.multiplayer.config.mjs'

export default defineConfig({
  ...base,
  testMatch: 'classic-paths.spec.mjs',
  timeout: 180_000,
  outputDir: 'test-results/classic',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/classic', open: 'never' }]],
  webServer: [
    {
      command: 'node --import tsx e2e/scenario-server.ts',
      cwd: './server',
      url: 'http://127.0.0.1:8040/api/health',
      reuseExistingServer: false,
      env: { NODE_ENV: 'test', GAME_PASSWORD: '123456', JWT_SECRET: randomUUID() },
    },
    base.webServer[1],
  ],
})
