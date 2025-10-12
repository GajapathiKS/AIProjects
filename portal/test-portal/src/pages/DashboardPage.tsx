import { useMemo } from 'react';
import { ApiClient } from '../api/client';
import { useAsync } from '../hooks/useAsync';

export default function DashboardPage() {
  const metrics = useAsync(ApiClient.metrics, []);
  const runs = useAsync(() => ApiClient.listRuns(), []);
  const testCases = useAsync(ApiClient.listTestCases, []);

  const testCaseLookup = useMemo(() => {
    const map = new Map<number, string>();
    (testCases.value ?? []).forEach(tc => map.set(tc.id, tc.title));
    return map;
  }, [testCases.value]);

  return (
    <div className="dashboard">
      <section className="card">
        <h2>Automation Snapshot</h2>
        {metrics.value ? (
          <div className="grid">
            <div className="tile">
              <strong>Environments</strong>
              <span>{metrics.value.environments}</span>
            </div>
            <div className="tile">
              <strong>Test Cases</strong>
              <span>{metrics.value.testCases}</span>
            </div>
            <div className="tile">
              <strong>Running</strong>
              <span>{metrics.value.queuedRuns}</span>
            </div>
            <div className="tile">
              <strong>Completed</strong>
              <span>{metrics.value.completedRuns}</span>
            </div>
          </div>
        ) : (
          <p>Loading metrics…</p>
        )}
      </section>

      <section className="card">
        <h2>Recent Playwright MCP Runs</h2>
        {runs.value ? (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Test Case</th>
                <th>Status</th>
                <th>Triggered By</th>
                <th>Started</th>
                <th>Finished</th>
                <th>Artifacts</th>
              </tr>
            </thead>
            <tbody>
              {runs.value.map(run => (
                <tr key={run.id}>
                  <td>{run.id}</td>
                  <td>{testCaseLookup.get(run.testCaseId) ?? `#${run.testCaseId}`}</td>
                  <td><span className={`status ${run.status}`}>{run.status}</span></td>
                  <td>{run.triggeredBy}</td>
                  <td>{new Date(run.startedAt).toLocaleString()}</td>
                  <td>{run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '—'}</td>
                  <td>
                    {run.artifactPath ? (
                      <code>{run.artifactPath}</code>
                    ) : (
                      'pending'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Loading run history…</p>
        )}
      </section>
    </div>
  );
}
