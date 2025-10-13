import express from 'express';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { runPlaywright } from './playwrightRunner.js';

const dataDir = path.join(process.cwd(), 'data');
const artifactDir = path.join(dataDir, 'artifacts');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(artifactDir)) {
  fs.mkdirSync(artifactDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'portal.sqlite'));

db.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS environments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    base_url TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'none',
    auth_token TEXT,
    username TEXT,
    password TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS test_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    feature TEXT,
    type TEXT NOT NULL,
    environment_id INTEGER NOT NULL,
    entry_point TEXT NOT NULL,
    steps TEXT NOT NULL,
    schedule TEXT NOT NULL DEFAULT 'manual',
    capture_artifacts INTEGER NOT NULL DEFAULT 1,
    tags TEXT,
    last_run_at TEXT,
    last_status TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(environment_id) REFERENCES environments(id)
  );

  CREATE TABLE IF NOT EXISTS test_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_case_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    triggered_by TEXT NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    log TEXT,
    artifact_path TEXT,
    FOREIGN KEY(test_case_id) REFERENCES test_cases(id)
  );
`);

const app = express();
app.use(express.json());

function mapEnvironment(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.base_url,
    authType: row.auth_type,
    authToken: row.auth_token ?? undefined,
    username: row.username ?? undefined,
    password: row.password ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTestCase(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    feature: row.feature ?? '',
    type: row.type,
    environmentId: row.environment_id,
    entryPoint: row.entry_point,
    steps: JSON.parse(row.steps),
    schedule: row.schedule,
    captureArtifacts: !!row.capture_artifacts,
    tags: row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    lastRunAt: row.last_run_at ?? undefined,
    lastStatus: row.last_status ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRun(row) {
  return {
    id: row.id,
    testCaseId: row.test_case_id,
    status: row.status,
    triggeredBy: row.triggered_by,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined,
    log: row.log ?? undefined,
    artifactPath: row.artifact_path ?? undefined
  };
}

async function enqueueRun(testCase, triggeredBy = 'manual') {
  const start = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO test_runs (test_case_id, status, triggered_by, started_at)
    VALUES (?, 'running', ?, ?)
  `);
  const info = insert.run(testCase.id, triggeredBy, start);
  const runId = info.lastInsertRowid;

  db.prepare('UPDATE test_cases SET last_run_at = ?, last_status = ? WHERE id = ?')
    .run(start, 'running', testCase.id);

  const runFolder = path.join(artifactDir, `run-${runId}`);
  fs.mkdirSync(runFolder, { recursive: true });

  const metadata = {
    runId,
    triggeredBy,
    startedAt: start,
    environmentId: testCase.environment_id ?? testCase.environmentId,
    entryPoint: testCase.entry_point ?? testCase.entryPoint,
    captureArtifacts: !!testCase.capture_artifacts || !!testCase.captureArtifacts,
    steps: Array.isArray(testCase.steps) ? testCase.steps : JSON.parse(testCase.steps)
  };

  fs.writeFileSync(path.join(runFolder, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Trigger Playwright run asynchronously
  (async () => {
    try {
      // Resolve environment row
      const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(metadata.environmentId);
      const result = await runPlaywright({
        runId,
        testCase,
        environment: env,
        artifactDir: runFolder
      });

      const finish = new Date().toISOString();
      const artifactPath = path.relative(process.cwd(), path.join('data', 'artifacts', `run-${runId}`));
      const log = `Run ${runId} ${result.status}. ${result.summary}`;
      db.prepare('UPDATE test_runs SET status = ?, finished_at = ?, log = ?, artifact_path = ? WHERE id = ?')
        .run(result.status, finish, log, artifactPath, runId);
      db.prepare('UPDATE test_cases SET last_run_at = ?, last_status = ? WHERE id = ?')
        .run(finish, result.status, testCase.id);
    } catch (e) {
      const finish = new Date().toISOString();
      const artifactPath = path.relative(process.cwd(), path.join('data', 'artifacts', `run-${runId}`));
      const log = `Run ${runId} failed to start: ${e?.message ?? e}`;
      db.prepare('UPDATE test_runs SET status = ?, finished_at = ?, log = ?, artifact_path = ? WHERE id = ?')
        .run('failed', finish, log, artifactPath, runId);
      db.prepare('UPDATE test_cases SET last_run_at = ?, last_status = ? WHERE id = ?')
        .run(finish, 'failed', testCase.id);
    }
  })();

  return mapRun({
    id: runId,
    test_case_id: testCase.id,
    status: 'running',
    triggered_by: triggeredBy,
    started_at: start,
    finished_at: null,
    log: null,
    artifact_path: null
  });
}

function scheduleEligibleRuns() {
  const now = new Date();
  const cases = db.prepare('SELECT * FROM test_cases').all();
  cases.forEach(tc => {
    if (tc.schedule === 'manual') return;
    const lastRun = tc.last_run_at ? new Date(tc.last_run_at) : undefined;
    if (tc.schedule === 'hourly') {
      if (!lastRun || now.getTime() - lastRun.getTime() > 60 * 60 * 1000) {
        enqueueRun(tc, 'scheduler');
      }
    } else if (tc.schedule === 'nightly') {
      if (!lastRun || now.toDateString() !== lastRun.toDateString()) {
        enqueueRun(tc, 'scheduler');
      }
    }
  });
}

setInterval(scheduleEligibleRuns, 60 * 1000);

app.get('/api/environments', (_req, res) => {
  const rows = db.prepare('SELECT * FROM environments ORDER BY created_at DESC').all();
  res.json(rows.map(mapEnvironment));
});

app.post('/api/environments', (req, res) => {
  const { name, type, baseUrl, authType, authToken, username, password, notes } = req.body;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO environments (name, type, base_url, auth_type, auth_token, username, password, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, type, baseUrl, authType ?? 'none', authToken ?? null, username ?? null, password ?? null, notes ?? null, now, now);
  const row = db.prepare('SELECT * FROM environments WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(mapEnvironment(row));
});

app.put('/api/environments/:id', (req, res) => {
  const { id } = req.params;
  const { name, type, baseUrl, authType, authToken, username, password, notes } = req.body;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE environments
    SET name = ?, type = ?, base_url = ?, auth_type = ?, auth_token = ?, username = ?, password = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `);
  const result = stmt.run(name, type, baseUrl, authType ?? 'none', authToken ?? null, username ?? null, password ?? null, notes ?? null, now, id);
  if (result.changes === 0) {
    return res.sendStatus(404);
  }
  const row = db.prepare('SELECT * FROM environments WHERE id = ?').get(id);
  res.json(mapEnvironment(row));
});

app.get('/api/test-cases', (_req, res) => {
  const rows = db.prepare('SELECT * FROM test_cases ORDER BY updated_at DESC').all();
  res.json(rows.map(mapTestCase));
});

app.post('/api/test-cases', (req, res) => {
  const { title, description, feature, type, environmentId, entryPoint, steps, schedule, captureArtifacts, tags } = req.body;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO test_cases (title, description, feature, type, environment_id, entry_point, steps, schedule, capture_artifacts, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(title, description ?? null, feature ?? null, type, environmentId, entryPoint, JSON.stringify(steps ?? []), schedule ?? 'manual', captureArtifacts ? 1 : 0, Array.isArray(tags) ? tags.join(',') : null, now, now);
  const row = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(mapTestCase(row));
});

app.put('/api/test-cases/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, feature, type, environmentId, entryPoint, steps, schedule, captureArtifacts, tags } = req.body;
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE test_cases
    SET title = ?, description = ?, feature = ?, type = ?, environment_id = ?, entry_point = ?, steps = ?, schedule = ?, capture_artifacts = ?, tags = ?, updated_at = ?
    WHERE id = ?
  `);
  const result = stmt.run(title, description ?? null, feature ?? null, type, environmentId, entryPoint, JSON.stringify(steps ?? []), schedule ?? 'manual', captureArtifacts ? 1 : 0, Array.isArray(tags) ? tags.join(',') : null, now, id);
  if (result.changes === 0) {
    return res.sendStatus(404);
  }
  const row = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
  res.json(mapTestCase(row));
});

app.delete('/api/test-cases/:id', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM test_cases WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.sendStatus(404);
  }
  res.sendStatus(204);
});

app.post('/api/test-cases/:id/run', (req, res) => {
  const { id } = req.params;
  const testCase = db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id);
  if (!testCase) {
    return res.sendStatus(404);
  }
  const run = enqueueRun(testCase, req.body?.triggeredBy ?? 'manual');
  res.status(202).json(run);
});

app.get('/api/test-runs', (req, res) => {
  const { testCaseId } = req.query;
  let rows;
  if (testCaseId) {
    rows = db.prepare('SELECT * FROM test_runs WHERE test_case_id = ? ORDER BY started_at DESC').all(testCaseId);
  } else {
    rows = db.prepare('SELECT * FROM test_runs ORDER BY started_at DESC LIMIT 50').all();
  }
  res.json(rows.map(mapRun));
});

app.get('/api/metrics', (_req, res) => {
  const totals = {
    environments: db.prepare('SELECT COUNT(*) as count FROM environments').get().count,
    testCases: db.prepare('SELECT COUNT(*) as count FROM test_cases').get().count,
    queuedRuns: db.prepare("SELECT COUNT(*) as count FROM test_runs WHERE status = 'running'").get().count,
    completedRuns: db.prepare("SELECT COUNT(*) as count FROM test_runs WHERE status = 'passed'").get().count
  };
  res.json(totals);
});

const port = process.env.PORT ?? 4001;
app.listen(port, () => {
  console.log(`Playwright MCP Portal API listening on ${port}`);
});
