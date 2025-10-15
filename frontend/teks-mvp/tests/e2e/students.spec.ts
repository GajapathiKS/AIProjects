import { test, expect } from '@playwright/test';
import { login } from './auth.util';
import { createStudent, initApi } from './seed.util';

test.describe('Students experience', () => {
  test('list renders form, seeds student, and navigates detail sections', async ({ page }) => {
    await login(page);
    await page.goto('/students');

    await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();
    await expect(page.getByRole('button', { name: /add student/i })).toBeEnabled();

    // Seed a student record via API so the UI has content to exercise
    const api = await initApi();
    const seeded = await createStudent(api);
    await api.dispose();

    await page.reload();

    const studentRow = page.getByRole('row', { name: new RegExp(seeded.localId, 'i') });
    await expect(studentRow).toBeVisible();
    await studentRow.getByRole('link', { name: 'Open' }).click();

    await expect(page.getByRole('heading', { level: 2, name: new RegExp(seeded.displayName, 'i') })).toBeVisible();

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

    await goalsLink.click();
    await expect(page).toHaveURL(/\/students\/.+\/goals$/);
    await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();

    await progressLink.click();
    await expect(page).toHaveURL(/\/students\/.+\/progress$/);
    await expect(page.getByRole('heading', { name: /progress updates/i })).toBeVisible();

    await infoLink.click();
    await expect(page).toHaveURL(/\/students\/.+$/);
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(seeded.displayName, 'i') })).toBeVisible();
  });
});
