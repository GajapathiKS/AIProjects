import { useMemo } from 'react';
import { ApiClient } from '../api/client';
import { useAsync } from '../hooks/useAsync';

export default function DashboardPage() {
  const metrics = useAsync(ApiClient.metrics, []);
  const testCases = useAsync(ApiClient.listTestCases, []);

  const modeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (testCases.value ?? []).forEach(tc => {
      const key = tc.playwrightMode || 'traditional';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
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
        <h2>Playwright Coverage</h2>
        {testCases.value ? (
          <div className="mode-grid">
            {Array.from(modeCounts.entries()).map(([mode, count]) => (
              <div className="tile" key={mode}>
                <strong>{mode}</strong>
                <span>{count}</span>
              </div>
            ))}
            {!modeCounts.size && <p>No test cases registered yet.</p>}
          </div>
        ) : (
          <p>Loading scenario catalog…</p>
        )}
        <p className="hint">Manage scenarios and executions from the Scenarios and Runs sections.</p>
      </section>
    </div>
  );
}
