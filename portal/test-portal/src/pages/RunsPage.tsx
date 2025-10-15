import { useMemo, useState } from 'react';
import { ApiClient, TestCase, TestRun } from '../api/client';
import { useAsync } from '../hooks/useAsync';

function buildLookup(cases: TestCase[] | null | undefined) {
  const map = new Map<number, TestCase>();
  (cases ?? []).forEach(tc => map.set(tc.id, tc));
  return map;
}

function buildUrl(artifactPath: string | undefined, relative: string) {
  if (!artifactPath) return null;
  const base = artifactPath.replace(/^\//, '');
  return `/${base}/${relative}`;
}

export default function RunsPage() {
  const runs = useAsync(() => ApiClient.listRuns(), []);
  const testCases = useAsync(ApiClient.listTestCases, []);
  const [filter, setFilter] = useState<number | 'all'>('all');

  const lookup = useMemo(() => buildLookup(testCases.value), [testCases.value]);

  const filteredRuns = useMemo(() => {
    if (!runs.value) return [] as TestRun[];
    if (filter === 'all') return runs.value;
    return runs.value.filter(run => run.testCaseId === filter);
  }, [runs.value, filter]);

  return (
    <div className="runs-page">
      <section className="card">
        <div className="runs-header">
          <h2>Execution History</h2>
          <div className="controls">
            <label>
              Scenario
              <select
                value={filter === 'all' ? 'all' : String(filter)}
                onChange={event => {
                  const value = event.target.value;
                  setFilter(value === 'all' ? 'all' : Number(value));
                }}
              >
                <option value="all">All scenarios</option>
                {(testCases.value ?? []).map(tc => (
                  <option key={tc.id} value={tc.id}>{tc.title}</option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => { runs.refresh(); testCases.refresh(); }}>Refresh</button>
          </div>
        </div>

        {runs.value ? (
          <table className="runs-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Scenario</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Triggered</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Screenshots</th>
                <th>Artifacts</th>
              </tr>
            </thead>
            <tbody>
              {filteredRuns.length ? filteredRuns.map(run => {
                const tc = lookup.get(run.testCaseId);
                return (
                  <tr key={run.id}>
                    <td>{run.id}</td>
                    <td>{tc?.title ?? `#${run.testCaseId}`}</td>
                    <td>{tc?.playwrightMode ?? 'traditional'}</td>
                    <td><span className={`status ${run.status}`}>{run.status}</span></td>
                    <td>{run.triggeredBy}</td>
                    <td>{new Date(run.startedAt).toLocaleString()}</td>
                    <td>{run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '—'}</td>
                    <td>
                      {run.screenshots?.length ? (
                        <ul className="screenshot-list">
                          {run.screenshots.map(shot => {
                            const url = buildUrl(run.artifactPath, shot.relativePath);
                            return (
                              <li key={shot.fileName}>
                                {url ? <a href={url} target="_blank" rel="noreferrer">{shot.title || shot.fileName}</a> : shot.title || shot.fileName}
                              </li>
                            );
                          })}
                        </ul>
                      ) : '—'}
                    </td>
                    <td>{run.artifactPath ? <a href={`/${run.artifactPath}`} target="_blank" rel="noreferrer">open</a> : '—'}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={9}>No runs recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <p>Loading run history…</p>
        )}
      </section>
    </div>
  );
}
