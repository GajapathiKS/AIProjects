import { test, expect } from '@playwright/test';
import { login } from './auth.util';
import { createStudent, initApi } from './seed.util';

// Creates a new goal for a fresh student and verifies it appears

test('create goal and list shows it', async ({ page }) => {
  await login(page);
  const api = await initApi();
  const student = await createStudent(api);
  await api.dispose();

  await page.goto(`/students/${student.id}/goals`);
  await page.getByRole('link', { name: '+ New Goal' }).click();
  await expect(page.getByRole('heading', { name: 'New Goal' })).toBeVisible();

  const stamp = Date.now();
  await page.getByLabel('Description').fill('pw_goal_desc_' + stamp);
  await page.getByLabel('Category').fill('pw_category');
  await page.getByLabel('Measurement').fill('pw_measure');
  await page.getByLabel('Owner').fill('pw_owner');
  await page.getByLabel('Target Date').fill('2025-12-31');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page).toHaveURL(new RegExp(`/students/${student.id}/goals$`));
  const row = page.getByText('pw_goal_desc_' + stamp);
  await expect(row).toBeVisible({ timeout: 10000 });
});
