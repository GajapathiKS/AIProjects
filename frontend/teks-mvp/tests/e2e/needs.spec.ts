import { test, expect } from '@playwright/test';
import { login } from './auth.util';
import { createStudent, initApi } from './seed.util';

// Adds a new needs assessment and verifies it appears in the table

test('add needs assessment appears in list', async ({ page }) => {
  await login(page);
  const api = await initApi();
  const student = await createStudent(api);
  await api.dispose();

  await page.goto(`/students/${student.id}/needs`);
  await expect(page).toHaveURL(new RegExp(`/students/${student.id}/needs$`));

  // Open New Needs Assessment page
  await page.getByRole('link', { name: '+ New Needs Assessment' }).click();
  await expect(page.getByRole('heading', { name: 'New Needs Assessment' })).toBeVisible();

  // Fill the new needs form on dedicated page
  const stamp = Date.now();
  await page.getByLabel('Academic Needs').fill('pw_reading_support_' + stamp);
  await page.getByLabel('Support Services').fill('pw_tutoring_' + stamp);
  await page.getByLabel('Instructional Strategies').fill('pw_small_group_' + stamp);
  await page.getByLabel('Assessment Tools').fill('pw_map_' + stamp);
  await page.getByRole('button', { name: 'Create' }).click();

  // Verify appears in table by unique stamp in any of the cells
  const cell = page.getByRole('cell', { name: new RegExp(String(stamp)) });
  await expect(cell.first()).toBeVisible({ timeout: 10000 });
});
