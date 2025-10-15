import { expect, Page } from '@playwright/test';

const DEFAULT_USERNAME = process.env.TEST_USERNAME ?? 'admin';
const DEFAULT_PASSWORD = process.env.TEST_PASSWORD ?? 'P@ssword1';

export async function login(page: Page) {
  await page.goto('/login');

  const usernameField = page.getByLabel('Username');
  const passwordField = page.getByLabel('Password');

  await expect(usernameField).toBeVisible();
  await usernameField.fill(DEFAULT_USERNAME);
  await passwordField.fill(DEFAULT_PASSWORD);

  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/?$/);
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
}
