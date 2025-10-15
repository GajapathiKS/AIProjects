import { expect, Page } from '@playwright/test';

const DEFAULT_USERNAME = process.env.TEST_USERNAME ?? 'admin';
const DEFAULT_PASSWORD = process.env.TEST_PASSWORD ?? 'P@ssword1';

export async function login(page: Page) {
  await page.goto('/login');

  const usernameField = page.getByLabel('Username');
  const passwordField = page.getByLabel('Password');

  await expect(usernameField).toBeVisible();
  await usernameField.fill(DEFAULT_USERNAME);

  // Try a few candidate passwords to accommodate different seeded environments
  const candidates = Array.from(new Set([
    DEFAULT_PASSWORD,
    'P@ssword1',
    'ChangeMe123!'
  ]));

  let loggedIn = false;
  for (const pw of candidates) {
    await passwordField.fill(pw);
    await page.getByRole('button', { name: /sign in/i }).click();
    // Wait briefly for navigation away from /login
    try {
      await page.waitForURL(url => !String(url).includes('/login'), { timeout: 6000 });
      loggedIn = true;
      break;
    } catch {
      // stay in loop, try next password
    }
  }

  if (!loggedIn) {
    // Attach a screenshot for debugging and fail fast
    await page.screenshot({ path: 'test-results/login-failed.png', fullPage: true }).catch(() => {});
    throw new Error('Login failed: could not navigate away from /login with provided credentials');
  }

  // Verify we landed on the home route and the Dashboard nav link is visible
  await expect(page).toHaveURL(/\/?$/);
  await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
}
