import { test, expect } from '@playwright/test';
import { login } from './auth.util';
import { createStudent, initApi } from './seed.util';

// Creates a new assignment for the first student and verifies the detail page

test('create new assignment shows in detail', async ({ page }) => {
  await login(page);
  const api = await initApi();
  const student = await createStudent(api);
  await api.dispose();

  await page.goto(`/students/${student.id}`);

  // Go to assignments
  await page.getByRole('link', { name: 'Assignments' }).click();
  await expect(page).toHaveURL(/\/students\/.+\/assignments/);

  // Create new
  await page.getByRole('link', { name: '+ New Assignment' }).click();
  await expect(page.getByRole('heading', { name: 'New Assignment' })).toBeVisible();

  const title = `pw_assignment_${Date.now()}`;
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill('pw_desc_auto');
  await page.getByLabel('Due Date').fill('2025-12-31');
  await page.getByLabel('Assigned To').fill('pw_teacher');
  await page.getByRole('button', { name: 'Create' }).click();

  // After create, we navigate back to the student's assignments list
  await expect(page).toHaveURL(new RegExp(`/students/${student.id}/assignments$`));

  // Verify row appears in the list
  const titleCell = page.getByRole('cell', { name: title });
  await expect(titleCell).toBeVisible({ timeout: 10000 });

  // Open the detail page from that row and verify heading
  const row = page.getByRole('row').filter({ has: titleCell });
  await row.getByRole('link', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
});
