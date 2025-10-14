import { FormEvent, useMemo, useState } from 'react';
import { ApiClient, EnvironmentConfig, TestCase } from '../api/client';
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

export default function ScenarioPage() {
  const envs = useAsync(ApiClient.listEnvironments, []);
  const testCases = useAsync(ApiClient.listTestCases, []);
  const runs = useAsync(() => ApiClient.listRuns(), []);

  const [form, setForm] = useState({
    title: '',
    description: '',
    feature: '',
    type: 'ui',
    environmentId: 0,
    entryPoint: 'tests/',
    stepsText: 'Login\nNavigate to dashboard\nCapture screenshot',
    schedule: 'manual',
    captureArtifacts: true,
    tags: 'smoke, onboarding'
  });
  const [saving, setSaving] = useState(false);
  const [selectedCase, setSelectedCase] = useState<number | null>(null);

  const environmentLookup = useMemo(() => {
    const map = new Map<number, EnvironmentConfig>();
    (envs.value ?? []).forEach(env => map.set(env.id, env));
    return map;
  }, [envs.value]);

  const caseRuns = useMemo(() => {
    return (runs.value ?? []).filter(run => run.testCaseId === selectedCase);
  }, [runs.value, selectedCase]);

  const [details, setDetails] = useState<Record<number, { screenshots?: { url: string; title?: string; status?: string; fileName?: string; }[] }>>({});

  const loadDetails = async (runId: number) => {
    try {
      const data = await ApiClient.getRun(runId);
      setDetails(prev => ({ ...prev, [runId]: { screenshots: data.screenshots } }));
    } catch {}
  };

  const handleSubmit = (evt: FormEvent) => {
    evt.preventDefault();
    if (!form.title || !form.environmentId) return;
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description,
      feature: form.feature,
      type: form.type,
      environmentId: form.environmentId,
      entryPoint: form.entryPoint,
      steps: form.stepsText.split('\n').map(step => step.trim()).filter(Boolean),
      schedule: form.schedule as TestCase['schedule'],
      captureArtifacts: form.captureArtifacts,
      tags: form.tags.split(',').map(tag => tag.trim()).filter(Boolean)
    } satisfies Omit<TestCase, 'id' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'lastStatus'>;

    ApiClient.createTestCase(payload)
      .then(() => {
        setForm({
          title: '',
          description: '',
          feature: '',
          type: 'ui',
          environmentId: 0,
          entryPoint: 'tests/',
          stepsText: '',
          schedule: 'manual',
          captureArtifacts: true,
          tags: ''
        });
        testCases.refresh();
      })
      .finally(() => setSaving(false));
  };

  const trigger = (testCase: TestCase) => {
    setSelectedCase(testCase.id);
    ApiClient.triggerTestCase(testCase.id, 'portal')
      .then(() => {
        runs.refresh();
        testCases.refresh();
      });
  };

  const deleteCase = (testCase: TestCase) => {
    if (!confirm(`Delete ${testCase.title}?`)) return;
    ApiClient.deleteTestCase(testCase.id)
      .then(() => {
        if (selectedCase === testCase.id) {
          setSelectedCase(null);
        }
        testCases.refresh();
        runs.refresh();
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
            Case Type
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
            Entry Point
            <input value={form.entryPoint} onChange={e => setForm({ ...form, entryPoint: e.target.value })} />
          </label>
          <label>
            Steps (one per line)
            <textarea
              value={form.stepsText}
              onChange={e => setForm({ ...form, stepsText: e.target.value })}
              rows={5}
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
                <th>Environment</th>
                <th>Schedule</th>
                <th>Last Run</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(testCases.value ?? []).map(tc => (
                <tr key={tc.id} className={selectedCase === tc.id ? 'selected' : ''}>
                  <td>{tc.title}</td>
                  <td>{tc.feature}</td>
                  <td>{environmentLookup.get(tc.environmentId)?.name ?? '—'}</td>
                  <td>{tc.schedule}</td>
                  <td>{tc.lastRunAt ? new Date(tc.lastRunAt).toLocaleString() : 'Never'}</td>
                  <td><span className={`status ${tc.lastStatus ?? 'pending'}`}>{tc.lastStatus ?? 'pending'}</span></td>
                  <td>
                    <button type="button" onClick={() => trigger(tc)}>Run</button>
                    <button type="button" onClick={() => { setSelectedCase(tc.id); runs.refresh(); }}>View Runs</button>
                    <button type="button" className="danger" onClick={() => deleteCase(tc)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedCase && (
          <div className="panel">
            <h3>Run History for #{selectedCase}</h3>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Triggered</th>
                  <th>Started</th>
                  <th>Finished</th>
                  <th>Artifacts</th>
                  <th>Log</th>
                  <th>Screenshots</th>
                </tr>
              </thead>
              <tbody>
                {caseRuns.length ? caseRuns.map(run => (
                  <tr key={run.id}>
                    <td>{run.id}</td>
                    <td><span className={`status ${run.status}`}>{run.status}</span></td>
                    <td>{run.triggeredBy}</td>
                    <td>{new Date(run.startedAt).toLocaleString()}</td>
                    <td>{run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '—'}</td>
                    <td>{run.artifactPath ? <a href={`/${run.artifactPath.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer"><code>{run.artifactPath}</code></a> : 'pending'}</td>
                    <td>{run.artifactPath ? <a href={`/${run.artifactPath.replace(/\\/g, '/')}/stdout.log`} target="_blank" rel="noreferrer">stdout</a> : '—'}</td>
                    <td>
                      <button type="button" onClick={() => loadDetails(run.id)}>Load</button>
                      {details[run.id]?.screenshots?.length ? (
                        <div className="thumbs">
                          {details[run.id].screenshots!.map((s, i) => (
                            <a key={i} href={s.url} target="_blank" rel="noreferrer" title={s.title ?? s.fileName ?? ''}>
                              <img src={s.url} alt={s.title ?? s.fileName ?? `shot-${i+1}`} style={{ width: 64, height: 40, objectFit: 'cover', marginRight: 4 }} />
                            </a>
                          ))}
                        </div>
                      ) : '—'}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8}>No runs yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
