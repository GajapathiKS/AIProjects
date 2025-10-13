import { test, expect } from '@playwright/test';
import { login } from './auth.util';

test('progress page shows heading and table/empty state', async ({ page }) => {
  await login(page);
  await page.goto('/students');
  const openLinks = page.getByRole('link', { name: 'Open' });
  if (await openLinks.count() === 0) test.skip(true, 'No students');
  await openLinks.nth(0).click();

  await page.getByRole('link', { name: 'Progress' }).click();
  await expect(page).toHaveURL(/\/students\/.+\/progress/);
  await expect(page.getByRole('heading', { name: 'Progress Updates' })).toBeVisible();

  // Accept both empty and data cases
  const header = page.getByRole('columnheader', { name: 'Recorded' });
  if (await header.count()) {
    await expect(header).toBeVisible();
  } else {
    await expect(page.getByText('Loading progress…')).not.toBeVisible({ timeout: 10000 });
  }
});
