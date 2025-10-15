import { APIRequestContext, request, Page, expect } from '@playwright/test';

const DEFAULT_API = process.env.TEST_API_BASE || 'https://localhost:7140';

async function getAuthToken(baseApi = DEFAULT_API) {
  const api = await request.newContext({ baseURL: baseApi, ignoreHTTPSErrors: true });
  // Try primary password, then fallback to default seed password
  const creds = [
    { username: 'admin', password: 'ChangeMe123!' },
    { username: 'admin', password: 'P@ssword1' }
  ];
  let token: string | null = null;
  for (const c of creds) {
    const resp = await api.post('/api/auth/login', { data: c });
    if (resp.ok()) {
      const data = await resp.json();
      token = data?.token ?? data?.accessToken ?? null;
      break;
    }
  }
  await api.dispose();
  if (!token) throw new Error('Failed to obtain auth token for tests');
  return token;
}

export interface SeededStudent {
  id: string;
  localId: string;
  displayName: string;
  firstName: string;
  lastName: string;
}

export async function createStudent(api: APIRequestContext, baseApi = DEFAULT_API): Promise<SeededStudent> {
  const stamp = Date.now();
  const payload = {
    firstName: `pw_${stamp}_First`,
    lastName: `pw_${stamp}_Last`,
    dateOfBirth: '2012-01-15',
    gradeLevel: '5',
    campus: `pw_${stamp}_Campus`,
    guardianContact: `pw_${stamp}_Guardian`,
    programFocus: `pw_${stamp}_Focus`,
    localId: `pw_${stamp}`,
    enrollmentDate: '2024-09-01',
    nextReviewDate: null
  };
  const resp = await api.post(`${baseApi}/api/students`, { data: payload });
  expect(resp.ok()).toBeTruthy();
  const data = await resp.json();
  const id = String(data.id ?? data);
  return {
    id,
    localId: payload.localId,
    displayName: `${payload.firstName} ${payload.lastName}`,
    firstName: payload.firstName,
    lastName: payload.lastName
  };
}

export async function initApi(baseApi = DEFAULT_API) {
  const token = await getAuthToken(baseApi);
  return await request.newContext({
    baseURL: baseApi,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: {
      Authorization: `Bearer ${token}`
    }
  });
}
