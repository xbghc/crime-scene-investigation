import { defineConfig } from 'playwright/test'
import { randomUUID } from 'node:crypto'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'multiplayer-ui.spec.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: 'test-results/multiplayer',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/rooms', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8030',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
      : {},
  },
  webServer: [
    {
      command: 'node --import tsx src/index.ts',
      cwd: './server',
      url: 'http://127.0.0.1:8040/api/health',
      reuseExistingServer: false,
      env: {
        PORT: '8040',
        GAME_PASSWORD: '123456',
        JWT_SECRET: randomUUID(),
      },
    },
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8030 --strictPort',
      cwd: './client',
      url: 'http://127.0.0.1:8030',
      reuseExistingServer: false,
    },
  ],
})
