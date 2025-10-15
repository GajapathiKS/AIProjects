import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

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
    playwright_mode TEXT NOT NULL DEFAULT 'traditional',
    environment_id INTEGER NOT NULL,
    entry_point TEXT NOT NULL,
    mcp_source TEXT,
    mcp_config TEXT,
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
    screenshots TEXT,
    FOREIGN KEY(test_case_id) REFERENCES test_cases(id)
  );
`);

function ensureColumn(table, column, definition) {
  const existing = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!existing.some(col => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('test_cases', 'playwright_mode', "TEXT NOT NULL DEFAULT 'traditional'");
ensureColumn('test_cases', 'mcp_source', 'TEXT');
ensureColumn('test_cases', 'mcp_config', 'TEXT');
ensureColumn('test_runs', 'screenshots', 'TEXT');

function mapEnvironment(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    baseUrl: row.base_url,
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
    playwrightMode: row.playwright_mode ?? 'traditional',
    environmentId: row.environment_id,
    entryPoint: row.entry_point,
    mcpSource: row.mcp_source ?? '',
    mcpConfig: row.mcp_config ? JSON.parse(row.mcp_config) : null,
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
    artifactPath: row.artifact_path ?? undefined,
    screenshots: row.screenshots ? JSON.parse(row.screenshots) : []
  };
}

function listEnvironmentRows() {
  return db.prepare('SELECT * FROM environments ORDER BY created_at DESC').all();
}

function listEnvironments() {
  return listEnvironmentRows().map(mapEnvironment);
}

function getEnvironmentRow(id) {
  return db.prepare('SELECT * FROM environments WHERE id = ?').get(id) ?? null;
}

function getEnvironment(id) {
  const row = getEnvironmentRow(id);
  return row ? mapEnvironment(row) : null;
}

function createEnvironment({ name, type, baseUrl, notes }) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO environments (name, type, base_url, auth_type, auth_token, username, password, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, type, baseUrl, 'none', null, null, null, notes ?? null, now, now);
  return mapEnvironment(getEnvironmentRow(info.lastInsertRowid));
}

function updateEnvironment(id, { name, type, baseUrl, notes }) {
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE environments
    SET name = ?, type = ?, base_url = ?, auth_type = ?, auth_token = ?, username = ?, password = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `);
  const result = stmt.run(name, type, baseUrl, 'none', null, null, null, notes ?? null, now, id);
  if (result.changes === 0) {
    return null;
  }
  return mapEnvironment(getEnvironmentRow(id));
}

function listTestCaseRows() {
  return db.prepare('SELECT * FROM test_cases ORDER BY updated_at DESC').all();
}

function listTestCases() {
  return listTestCaseRows().map(mapTestCase);
}

function getTestCaseRow(id) {
  return db.prepare('SELECT * FROM test_cases WHERE id = ?').get(id) ?? null;
}

function getTestCase(id) {
  const row = getTestCaseRow(id);
  return row ? mapTestCase(row) : null;
}

function createTestCase({ title, description, feature, type, playwrightMode = 'traditional', environmentId, entryPoint, mcpSource, mcpConfig = null, steps = [], schedule = 'manual', captureArtifacts = true, tags = [] }) {
  const now = new Date().toISOString();
  const configJson = mcpConfig ? JSON.stringify(mcpConfig) : null;
  const stmt = db.prepare(`
    INSERT INTO test_cases (title, description, feature, type, playwright_mode, environment_id, entry_point, mcp_source, mcp_config, steps, schedule, capture_artifacts, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(title, description ?? null, feature ?? null, type, playwrightMode ?? 'traditional', environmentId, entryPoint, mcpSource ?? null, configJson, JSON.stringify(steps ?? []), schedule ?? 'manual', captureArtifacts ? 1 : 0, Array.isArray(tags) ? tags.join(',') : null, now, now);
  return mapTestCase(getTestCaseRow(info.lastInsertRowid));
}

function updateTestCase(id, { title, description, feature, type, playwrightMode = 'traditional', environmentId, entryPoint, mcpSource, mcpConfig = null, steps = [], schedule = 'manual', captureArtifacts = true, tags = [] }) {
  const now = new Date().toISOString();
  const configJson = mcpConfig ? JSON.stringify(mcpConfig) : null;
  const stmt = db.prepare(`
    UPDATE test_cases
    SET title = ?, description = ?, feature = ?, type = ?, playwright_mode = ?, environment_id = ?, entry_point = ?, mcp_source = ?, mcp_config = ?, steps = ?, schedule = ?, capture_artifacts = ?, tags = ?, updated_at = ?
    WHERE id = ?
  `);
  const result = stmt.run(title, description ?? null, feature ?? null, type, playwrightMode ?? 'traditional', environmentId, entryPoint, mcpSource ?? null, configJson, JSON.stringify(steps ?? []), schedule ?? 'manual', captureArtifacts ? 1 : 0, Array.isArray(tags) ? tags.join(',') : null, now, id);
  if (result.changes === 0) {
    return null;
  }
  return mapTestCase(getTestCaseRow(id));
}

function deleteTestCase(id) {
  const result = db.prepare('DELETE FROM test_cases WHERE id = ?').run(id);
  return result.changes > 0;
}

function listRunRows(testCaseId) {
  if (typeof testCaseId === 'number') {
    return db.prepare('SELECT * FROM test_runs WHERE test_case_id = ? ORDER BY started_at DESC').all(testCaseId);
  }
  return db.prepare('SELECT * FROM test_runs ORDER BY started_at DESC LIMIT 50').all();
}

function listRuns(options = {}) {
  const rows = listRunRows(options.testCaseId ?? undefined);
  return rows.map(mapRun);
}

function updateTestCaseRunStatus(id, lastRunAt, status) {
  db.prepare('UPDATE test_cases SET last_run_at = ?, last_status = ? WHERE id = ?').run(lastRunAt, status, id);
}

function updateRunRecord(id, { status, finishedAt, log, artifactPath, screenshots }) {
  const screenshotsJson = screenshots ? JSON.stringify(screenshots) : null;
  db.prepare('UPDATE test_runs SET status = ?, finished_at = ?, log = ?, artifact_path = ?, screenshots = ? WHERE id = ?').run(status, finishedAt ?? null, log ?? null, artifactPath ?? null, screenshotsJson, id);
}

function createRunRecord(testCaseId, triggeredBy, startedAt) {
  const insert = db.prepare(`
    INSERT INTO test_runs (test_case_id, status, triggered_by, started_at)
    VALUES (?, 'running', ?, ?)
  `);
  const info = insert.run(testCaseId, triggeredBy, startedAt);
  return info.lastInsertRowid;
}

function getRunRow(id) {
  return db.prepare('SELECT * FROM test_runs WHERE id = ?').get(id) ?? null;
}

function getMetrics() {
  return {
    environments: db.prepare('SELECT COUNT(*) as count FROM environments').get().count,
    testCases: db.prepare('SELECT COUNT(*) as count FROM test_cases').get().count,
    queuedRuns: db.prepare("SELECT COUNT(*) as count FROM test_runs WHERE status = 'running'").get().count,
    completedRuns: db.prepare("SELECT COUNT(*) as count FROM test_runs WHERE status = 'passed'").get().count
  };
}

export {
  artifactDir,
  dataDir,
  db,
  mapEnvironment,
  mapRun,
  mapTestCase,
  listEnvironments,
  listEnvironmentRows,
  getEnvironment,
  getEnvironmentRow,
  createEnvironment,
  updateEnvironment,
  listTestCases,
  listTestCaseRows,
  getTestCase,
  getTestCaseRow,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  listRuns,
  listRunRows,
  createRunRecord,
  updateRunRecord,
  updateTestCaseRunStatus,
  getRunRow,
  getMetrics
};
