import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'on'
  },
  webServer: [
    {
      command: 'npm start -- --port 4200',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      cwd: '.',
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
});
