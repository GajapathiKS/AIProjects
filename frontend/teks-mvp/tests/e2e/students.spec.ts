import { test, expect } from '@playwright/test';
import { login } from './auth.util';
import { createStudent, initApi } from './seed.util';

test.describe('Students experience', () => {
  test('list renders form, seeds student, and navigates detail sections', async ({ page }) => {
    await login(page);
    await page.goto('/students');

  // Disambiguate: page also has an <h3> "Active Students"; require exact match for the H2 heading
  await expect(page.getByRole('heading', { name: 'Students', exact: true })).toBeVisible();
  // Add Student is disabled until the form is filled; we seed via API instead
  await expect(page.getByRole('button', { name: /add student/i })).toBeDisabled();
  // eslint-disable-next-line no-console
  console.log('e2e-step: students list loaded');
  await test.info().attach('students-list', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // Seed a student record via API so the UI has content to exercise
    const api = await initApi();
    const seeded = await createStudent(api);
    await api.dispose();

    await page.reload();

    const studentRow = page.getByRole('row', { name: new RegExp(seeded.localId, 'i') });
    await expect(studentRow).toBeVisible();
    await studentRow.getByRole('link', { name: 'Open' }).click();

    await expect(page.getByRole('heading', { level: 2, name: new RegExp(seeded.displayName, 'i') })).toBeVisible();
  // eslint-disable-next-line no-console
  console.log('e2e-step: student details opened for', seeded.displayName);
  await test.info().attach('student-detail', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    const infoLink = page.getByRole('link', { name: 'Info' });
    const assignmentsLink = page.getByRole('link', { name: 'Assignments' });
    const needsLink = page.getByRole('link', { name: 'Needs' });
    const goalsLink = page.getByRole('link', { name: 'Goals' });
    const progressLink = page.getByRole('link', { name: 'Progress' });

    await expect(assignmentsLink).toBeVisible();
    await expect(needsLink).toBeVisible();
    await expect(goalsLink).toBeVisible();
    await expect(progressLink).toBeVisible();

    await assignmentsLink.click();
    await expect(page).toHaveURL(/\/students\/.+\/assignments$/);
    await expect(page.getByRole('heading', { name: 'Assignments' })).toBeVisible();
  // eslint-disable-next-line no-console
  console.log('e2e-step: assignments section');
  await test.info().attach('assignments', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    await goalsLink.click();
    await expect(page).toHaveURL(/\/students\/.+\/goals$/);
    await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();
  // eslint-disable-next-line no-console
  console.log('e2e-step: goals section');
  await test.info().attach('goals', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    await progressLink.click();
    await expect(page).toHaveURL(/\/students\/.+\/progress$/);
    await expect(page.getByRole('heading', { name: /progress updates/i })).toBeVisible();
  // eslint-disable-next-line no-console
  console.log('e2e-step: progress section');
  await test.info().attach('progress', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    await infoLink.click();
    await expect(page).toHaveURL(/\/students\/.+$/);
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(seeded.displayName, 'i') })).toBeVisible();
    // eslint-disable-next-line no-console
    console.log('e2e-step: back to info');
    await test.info().attach('info', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
});
