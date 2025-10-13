import { APIRequestContext, request, Page, expect } from '@playwright/test';

export async function login(page: Page, baseApi = 'https://localhost:7140') {
  // Try logging in via API to get a token and set localStorage
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
