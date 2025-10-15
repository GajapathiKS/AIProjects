import { test, expect } from '@playwright/test';
import { login } from './auth.util';
import { createStudent, initApi } from './seed.util';

test('goals page renders table or empty state', async ({ page }) => {
  await login(page);
  const api = await initApi();
  const student = await createStudent(api);
  await api.dispose();

  await page.goto(`/students/${student.id}/goals`);
  await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();

  const header = page.getByRole('columnheader', { name: 'Description' });
  if (await header.count()) {
    await expect(header).toBeVisible();
  } else {
    await expect(page.getByText('No goals yet.')).toBeVisible();
  }
});
