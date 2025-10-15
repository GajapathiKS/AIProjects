import { defineConfig } from '@playwright/test';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'on'
  },
  // Ensure the Angular dev server starts from the project root regardless of where Playwright is launched
  webServer: {
    command: 'npm start -- --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: path.resolve(__dirname)
  }
});
