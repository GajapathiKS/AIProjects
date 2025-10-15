import { FormEvent, useMemo, useState } from 'react';
import { ApiClient, EnvironmentConfig, PlaywrightMode, TestCase } from '../api/client';
import { useAsync } from '../hooks/useAsync';

const schedules = [
  { label: 'Manual trigger', value: 'manual' },
  { label: 'Hourly (smoke)', value: 'hourly' },
  { label: 'Nightly regression', value: 'nightly' }
];

const caseTypes = [
  { label: 'UI', value: 'ui' },
  { label: 'API', value: 'api' },
  { label: 'End-to-end', value: 'e2e' }
];

const modeOptions: { label: string; value: PlaywrightMode; description: string }[] = [
  {
    label: 'Traditional (.spec.ts)',
    value: 'traditional',
    description: 'Execute compiled Playwright projects with TypeScript test suites.'
  },
  {
    label: 'MCP Scenario (YAML)',
    value: 'mcp',
    description: 'Drive the Playwright MCP client with human-readable scenario files.'
  }
];

export default function ScenarioPage() {
  const envs = useAsync(ApiClient.listEnvironments, []);
  const testCases = useAsync(ApiClient.listTestCases, []);

  const [form, setForm] = useState({
    title: '',
    description: '',
    feature: '',
    type: 'ui',
    playwrightMode: 'traditional' as PlaywrightMode,
    environmentId: 0,
    entryPoint: 'frontend/teks-mvp/tests/e2e/students.spec.ts',
    mcpSource: 'frontend/teks-mvp/tests/mcp/students-overview.mcp.yaml',
    stepsText: 'Login\nOpen students\nCapture screenshot',
    schedule: 'manual',
    captureArtifacts: true,
    tags: 'smoke, onboarding'
  });
  const [saving, setSaving] = useState(false);

  const environmentLookup = useMemo(() => {
    const map = new Map<number, EnvironmentConfig>();
    (envs.value ?? []).forEach(env => map.set(env.id, env));
    return map;
  }, [envs.value]);

  const handleSubmit = (evt: FormEvent) => {
    evt.preventDefault();
    if (!form.title || !form.environmentId) return;
    if (form.playwrightMode === 'mcp' && !form.mcpSource.trim()) {
      alert('Provide a scenario file path for MCP test cases.');
      return;
    }
    setSaving(true);
    const steps = form.stepsText.split('\n').map(step => step.trim()).filter(Boolean);
    const payload = {
      title: form.title,
      description: form.description,
      feature: form.feature,
      type: form.type,
      playwrightMode: form.playwrightMode,
      environmentId: form.environmentId,
      entryPoint: form.playwrightMode === 'mcp' && form.mcpSource ? form.mcpSource : form.entryPoint,
      mcpSource: form.playwrightMode === 'mcp' ? form.mcpSource : undefined,
      steps,
      schedule: form.schedule as TestCase['schedule'],
      captureArtifacts: form.captureArtifacts,
      tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    } satisfies Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'lastStatus' | 'mcpConfig'>;

    ApiClient.createTestCase(payload)
      .then(() => {
        setForm(prev => ({
          title: '',
          description: '',
          feature: '',
          type: prev.type,
          playwrightMode: prev.playwrightMode,
          environmentId: 0,
          entryPoint: 'frontend/teks-mvp/tests/e2e/students.spec.ts',
          mcpSource: 'frontend/teks-mvp/tests/mcp/students-overview.mcp.yaml',
          stepsText: '',
          schedule: 'manual',
          captureArtifacts: true,
          tags: ''
        }));
        testCases.refresh();
      })
      .finally(() => setSaving(false));
  };

  const trigger = (testCase: TestCase) => {
    ApiClient.triggerTestCase(testCase.id, 'portal').then(() => {
      testCases.refresh();
    });
  };

  const deleteCase = (testCase: TestCase) => {
    if (!confirm(`Delete ${testCase.title}?`)) return;
    ApiClient.deleteTestCase(testCase.id).then(() => {
      testCases.refresh();
    });
  };

  return (
    <div className="scenario-grid">
      <section>
        <h2>Author Test Case</h2>
        <form onSubmit={handleSubmit} className="panel">
          <label>
            Title
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Student onboarding smoke"
            />
          </label>
          <label>
            Feature
            <input
              value={form.feature}
              onChange={e => setForm({ ...form, feature: e.target.value })}
              placeholder="Onboarding"
            />
          </label>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            Environment
            <select
              value={form.environmentId}
              onChange={e => setForm({ ...form, environmentId: Number(e.target.value) })}
            >
              <option value={0}>Select…</option>
              {(envs.value ?? []).map(env => (
                <option key={env.id} value={env.id}>{env.name} ({env.type})</option>
              ))}
            </select>
          </label>
          <label>
            Classification
            <select
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            >
              {caseTypes.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Playwright Mode
            <select
              value={form.playwrightMode}
              onChange={e => {
                const next = e.target.value as PlaywrightMode;
                setForm(prev => ({
                  ...prev,
                  playwrightMode: next
                }));
              }}
            >
              {modeOptions.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <small>{modeOptions.find(option => option.value === form.playwrightMode)?.description}</small>
          </label>
          {form.playwrightMode === 'traditional' ? (
            <label>
              Entry Point (.spec.ts)
              <input value={form.entryPoint} onChange={e => setForm({ ...form, entryPoint: e.target.value })} />
            </label>
          ) : (
            <label>
              MCP Scenario File
              <input value={form.mcpSource} onChange={e => setForm({ ...form, mcpSource: e.target.value })} />
            </label>
          )}
          <label>
            Notes / Steps (one per line)
            <textarea
              value={form.stepsText}
              onChange={e => setForm({ ...form, stepsText: e.target.value })}
              rows={5}
              placeholder={form.playwrightMode === 'mcp' ? 'Document the expectations for the scenario…' : 'Login\nNavigate to dashboard\nCapture screenshot'}
            />
          </label>
          <label>
            Tags
            <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
          </label>
          <label>
            Schedule
            <select value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })}>
              {schedules.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.captureArtifacts}
              onChange={e => setForm({ ...form, captureArtifacts: e.target.checked })}
            />
            Capture screenshots & traces
          </label>
          <button type="submit" disabled={saving}>Save</button>
        </form>
      </section>

      <section>
        <h2>Catalogued Scenarios</h2>
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Feature</th>
                <th>Mode</th>
                <th>Entry</th>
                <th>Environment</th>
                <th>Schedule</th>
                <th>Last Run</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(testCases.value ?? []).map(tc => (
                <tr key={tc.id}>
                  <td>{tc.title}</td>
                  <td>{tc.feature}</td>
                  <td><span className="chip">{tc.playwrightMode}</span></td>
                  <td>
                    <code className="path">{tc.playwrightMode === 'mcp' ? tc.mcpSource ?? tc.entryPoint : tc.entryPoint}</code>
                  </td>
                  <td>{environmentLookup.get(tc.environmentId)?.name ?? '—'}</td>
                  <td>{tc.schedule}</td>
                  <td>{tc.lastRunAt ? new Date(tc.lastRunAt).toLocaleString() : 'Never'}</td>
                  <td><span className={`status ${tc.lastStatus ?? 'pending'}`}>{tc.lastStatus ?? 'pending'}</span></td>
                  <td>
                    <button type="button" onClick={() => trigger(tc)}>Run</button>
                    <button type="button" className="danger" onClick={() => deleteCase(tc)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
