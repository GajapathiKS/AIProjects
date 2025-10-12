export interface EnvironmentConfig {
  id: number;
  name: string;
  type: 'Dev' | 'QA' | 'Prod' | string;
  baseUrl: string;
  authType: 'none' | 'token' | 'basic' | string;
  authToken?: string;
  username?: string;
  password?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestCase {
  id: number;
  title: string;
  description: string;
  feature: string;
  type: 'ui' | 'api' | 'e2e' | string;
  environmentId: number;
  entryPoint: string;
  steps: string[];
  schedule: 'manual' | 'hourly' | 'nightly';
  captureArtifacts: boolean;
  tags: string[];
  lastRunAt?: string;
  lastStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TestRun {
  id: number;
  testCaseId: number;
  status: 'running' | 'passed' | 'failed';
  triggeredBy: string;
  startedAt: string;
  finishedAt?: string;
  log?: string;
  artifactPath?: string;
}

const apiBase = '/api';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const ApiClient = {
  listEnvironments(): Promise<EnvironmentConfig[]> {
    return request<EnvironmentConfig[]>('/environments');
  },
  createEnvironment(input: Omit<EnvironmentConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnvironmentConfig> {
    return request<EnvironmentConfig>('/environments', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  updateEnvironment(id: number, input: Omit<EnvironmentConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnvironmentConfig> {
    return request<EnvironmentConfig>(`/environments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
  },
  listTestCases(): Promise<TestCase[]> {
    return request<TestCase[]>('/test-cases');
  },
  createTestCase(input: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'lastStatus'>): Promise<TestCase> {
    return request<TestCase>('/test-cases', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },
  updateTestCase(id: number, input: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'lastStatus'>): Promise<TestCase> {
    return request<TestCase>(`/test-cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    });
  },
  deleteTestCase(id: number): Promise<void> {
    return request<void>(`/test-cases/${id}`, { method: 'DELETE' });
  },
  triggerTestCase(id: number, triggeredBy?: string): Promise<TestRun> {
    return request<TestRun>(`/test-cases/${id}/run`, {
      method: 'POST',
      body: JSON.stringify({ triggeredBy })
    });
  },
  listRuns(testCaseId?: number): Promise<TestRun[]> {
    const query = testCaseId ? `?testCaseId=${testCaseId}` : '';
    return request<TestRun[]>(`/test-runs${query}`);
  },
  metrics(): Promise<{ environments: number; testCases: number; queuedRuns: number; completedRuns: number; }> {
    return request('/metrics');
  }
};
