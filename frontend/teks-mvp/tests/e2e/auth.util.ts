import { request, Page, expect } from '@playwright/test';

/**
 * Login helper for E2E tests.
 * Prefers a pre-provided token via env E2E_AUTH_TOKEN (set by the portal),
 * otherwise falls back to API login against TEST_API_BASE (or default).
 */
export async function login(page: Page, baseApi = process.env.TEST_API_BASE ?? 'https://localhost:7140') {
  // If a token is supplied via env, use it directly
  const provided = process.env.E2E_AUTH_TOKEN;
  if (provided && provided.length > 0) {
    await page.addInitScript(([t]) => {
      localStorage.setItem('teks-auth', JSON.stringify({ token: t }));
    }, [provided]);
    return;
  }

  // Otherwise, obtain a token via API login
  const api = await request.newContext({ baseURL: baseApi, ignoreHTTPSErrors: true });
  const resp = await api.post('/api/auth/login', {
    data: { username: 'admin', password: 'ChangeMe123!' }
  });
  expect(resp.ok()).toBeTruthy();
  const data = await resp.json();
  const token = data?.token ?? data?.accessToken ?? data;
  await api.dispose();
  await page.addInitScript(([t]) => {
    localStorage.setItem('teks-auth', JSON.stringify({ token: t }));
  }, [token]);
}
