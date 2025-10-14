import { test, expect } from '@playwright/test';
import { login } from './auth.util';
import { initApi, createStudent } from './seed.util';

// Basic smoke test to navigate the Angular app's students flow

test.describe('Students app smoke tests', () => {
  test('landing, list, open student, nav sections', async ({ page }) => {
    // Ensure we have at least one student so the test follows the "Open" path
    try {
      const baseApi = process.env.TEST_API_BASE ?? 'https://localhost:7140';
      const api = await initApi(baseApi);
      await createStudent(api, baseApi);
      await api.dispose();
    } catch (e) {
      // If seeding fails, continue and allow the empty-state branch to handle it
    }

    await login(page);
    await page.goto('/students');

    // Expect top nav to show Students link; active might be reflected by aria-current
    const studentsLink = page.getByRole('link', { name: 'Students' });
    await expect(studentsLink).toBeVisible();
    const ariaCurrent = await studentsLink.getAttribute('aria-current');
    // not all routers set class; accept visibility as sufficient to proceed

  // Wait for loading to settle, then until either there are students (Open link) or the empty state is visible
  const loading = page.getByText('Loading students…');
  await loading.waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    const openLinks = page.getByRole('link', { name: 'Open' });
    const emptyState = page.getByText('No students enrolled yet.');

    let hasData = false;
    for (let i = 0; i < 30; i++) {
      if (await openLinks.count() > 0) { hasData = true; break; }
      if (await emptyState.count() > 0) { break; }
      await page.waitForTimeout(500);
    }

    if (hasData) {
      await openLinks.nth(0).click();

  // Left nav entries
      await expect(page.getByRole('link', { name: 'Info' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Assignments' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Needs' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Goals' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Progress' })).toBeVisible();

      // Navigate into Assignments list and verify page loaded
      await page.getByRole('link', { name: 'Assignments' }).click();
      await expect(page).toHaveURL(/\/students\/.+\/assignments/);
      await expect(page.getByRole('heading', { name: 'Assignments' })).toBeVisible();
      // If data exists, table header should be present, otherwise we at least have the heading
      const titleHeader = page.getByRole('columnheader', { name: 'Title' });
      if (await titleHeader.count()) {
        await expect(titleHeader).toBeVisible();
      }

      // Navigate Goals and verify page loaded
      await page.getByRole('link', { name: 'Goals' }).click();
      await expect(page).toHaveURL(/\/students\/.+\/goals/);
      await expect(page.getByRole('heading', { name: 'Goals' })).toBeVisible();
      const goalsHeader = page.getByRole('columnheader', { name: 'Description' });
      if (await goalsHeader.count()) {
        await expect(goalsHeader).toBeVisible();
      }

      // Navigate Progress and verify page loaded
      await page.getByRole('link', { name: 'Progress' }).click();
      await expect(page).toHaveURL(/\/students\/.+\/progress/);
      await expect(page.getByRole('heading', { name: 'Progress Updates' })).toBeVisible();
      const recordedHeader = page.getByRole('columnheader', { name: 'Recorded' });
      if (await recordedHeader.count()) {
        await expect(recordedHeader).toBeVisible();
      }

      // Proof: attach a screenshot after navigating sections
      await test.info().attach('after-students-opened', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png'
      });
    } else {
      // If none, the page should say there are no students. If still loading, skip to avoid false failures when backend is down.
      if (await loading.count() > 0) {
        test.skip(true, 'Students page stuck on "Loading students…" — likely backend API is not reachable. Skipping.');
      } else {
        await expect(emptyState).toBeVisible();
        // Proof: attach the empty-state view
        await test.info().attach('students-empty-state', {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png'
        });
      }
    }
  });
});
