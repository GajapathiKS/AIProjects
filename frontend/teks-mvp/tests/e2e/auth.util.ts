import { expect, Page } from '@playwright/test';

const DEFAULT_USERNAME = process.env.TEST_USERNAME ?? 'admin';
const DEFAULT_PASSWORD = process.env.TEST_PASSWORD ?? 'ChangeMe123!';

export async function login(page: Page) {
  // Navigate directly to login, clear any prior session if needed, then retry
  await page.goto('/login');

  const usernameField = page.locator('[data-testid="username"], input[formcontrolname="username"]').first();
  const passwordField = page.locator('[data-testid="password"], input[formcontrolname="password"]').first();

  try {
    await expect(usernameField).toBeVisible({ timeout: 8000 });
  } catch {
    await page.evaluate(() => { try { localStorage.removeItem('teks-auth'); } catch {} });
    await page.goto('/login');
  }

  await expect(usernameField).toBeVisible({ timeout: 10000 });
  await usernameField.fill(DEFAULT_USERNAME);

  // Try a couple of common seed passwords
  const candidates = Array.from(new Set([
    DEFAULT_PASSWORD,
    'ChangeMe123!',
    'P@ssword1'
  ]));

  let loggedIn = false;
  for (const pw of candidates) {
    await passwordField.fill(pw);
  await page.locator('[data-testid="submit-login"], button:has-text("Sign In")').first().click();
    try {
      await page.waitForURL(url => !String(url).includes('/login'), { timeout: 8000 });
      loggedIn = true;
      break;
    } catch {
      // try next candidate
    }
  }

  if (!loggedIn) {
    await page.screenshot({ path: 'test-results/login-failed.png', fullPage: true }).catch(() => {});
    throw new Error('Login failed: could not navigate away from /login with provided credentials');
  }

  await expect(page).toHaveURL(/\/?$/);
  // App shell title is 'Texas TEKS Program Manager'; also ensure Students nav is present
  await expect(page.getByRole('heading', { name: 'Texas TEKS Program Manager' })).toBeVisible();
  await expect(page.getByRole('link', { name: /students/i })).toBeVisible();
}
