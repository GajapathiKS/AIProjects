import { test, expect } from '@playwright/test';
import { login } from './auth.util';
import { createStudent, initApi } from './seed.util';

test('progress page shows heading and table/empty state', async ({ page }) => {
  await login(page);
  const api = await initApi();
  const student = await createStudent(api);
  await api.dispose();

  await page.goto(`/students/${student.id}/progress`);
  await expect(page.getByRole('heading', { name: 'Progress Updates' })).toBeVisible();
  await expect(page.getByRole('button', { name: '+ New Progress' })).toBeVisible();

  const header = page.getByRole('columnheader', { name: 'Recorded' });
  if (await header.count()) {
    await expect(header).toBeVisible();
  } else {
    await expect(page.getByText('No progress updates found.')).toBeVisible();
  }
});
