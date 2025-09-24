import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: 'dotnet run --project ../backend/src/TodoApp.Api/TodoApp.Api.csproj --urls http://localhost:5000',
      url: 'http://localhost:5000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      cwd: '.',
      stdout: 'pipe',
      stderr: 'pipe'
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      cwd: './frontend',
      stdout: 'pipe',
      stderr: 'pipe'
    }
  ]
});
