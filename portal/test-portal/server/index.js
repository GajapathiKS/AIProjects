import express from 'express';
import {
  createEnvironment,
  createTestCase,
  deleteTestCase,
  getMetrics,
  getTestCaseRow,
  listEnvironments,
  listRuns,
  listTestCases,
  updateEnvironment,
  updateTestCase
} from './storage.js';
import { enqueueRun, scheduleEligibleRuns } from './runManager.js';
import path from 'node:path';
import fs from 'node:fs';
import { artifactDir, getRunRow, mapRun } from './storage.js';
import { applyOnboardingConfig, loadOnboardingConfig } from './onboarding.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

// Helper to (re)generate an index.html for a given run folder
function ensureRunIndex(id) {
  const runFolder = path.join(artifactDir, `run-${id}`);
  if (!fs.existsSync(runFolder)) return false;
  const indexPath = path.join(runFolder, 'index.html');
  if (!fs.existsSync(indexPath)) {
    const screenshotsDir = path.join(runFolder, 'screenshots');
    const shots = [];
    if (fs.existsSync(screenshotsDir)) {
      for (const file of fs.readdirSync(screenshotsDir)) {
        if (/\.(png|jpg|jpeg|gif)$/i.test(file)) {
          shots.push({ title: file, relativePath: path.join('screenshots', file).replace(/\\/g, '/') });
        }
      }
    }
    const files = ['stdout.log', 'stderr.log', 'report.json', 'transcript.json', 'metadata.json'];
    const lines = [];
    lines.push('<!doctype html>');
    lines.push('<meta charset="utf-8"/>');
    lines.push(`<title>Run ${id} Artifacts</title>`);
    lines.push('<style>body{font-family:system-ui,Segoe UI,Arial;margin:20px} .status{padding:2px 6px;border-radius:4px;background:#eee;text-transform:uppercase;font-size:12px} ul{line-height:1.8}</style>');
    lines.push(`<h1>Run ${id} Artifacts</h1>`);
    lines.push('<h2>Logs</h2>');
    lines.push('<ul>');
    for (const file of files) {
      if (fs.existsSync(path.join(runFolder, file))) {
        lines.push(`<li><a href="./${file}">${file}</a></li>`);
      }
    }
    lines.push('</ul>');
    if (shots.length) {
      lines.push('<h2>Screenshots</h2>');
      lines.push('<ul>');
      for (const sc of shots) {
        lines.push(`<li><a href="./${sc.relativePath}">${sc.title}</a></li>`);
      }
      lines.push('</ul>');
    }
    try { fs.writeFileSync(indexPath, lines.join('\n')); } catch {}
  }
  return true;
}

// Auto-generate and serve run index for both /artifacts and legacy /data/artifacts
function registerArtifactIndexRoutes(prefix) {
  app.get(`${prefix}/run-:id`, (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next();
    if (!ensureRunIndex(id)) return res.sendStatus(404);
    res.sendFile(path.join(artifactDir, `run-${id}`, 'index.html'));
  });
  app.get(`${prefix}/run-:id/`, (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return next();
    if (!ensureRunIndex(id)) return res.sendStatus(404);
    res.sendFile(path.join(artifactDir, `run-${id}`, 'index.html'));
  });
}

registerArtifactIndexRoutes('/artifacts');
registerArtifactIndexRoutes('/data/artifacts');

// Expose run artifacts (screenshots, traces, logs)
app.use('/artifacts', express.static(artifactDir));
// Back-compat: earlier links referenced /data/artifacts
app.use('/data/artifacts', express.static(artifactDir));

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeOptionalString(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized : undefined;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const truthy = ['true', '1', 'yes', 'on'];
  return truthy.includes(String(value).toLowerCase());
}

function parseSchedule(value) {
  const normalized = normalizeString(value).toLowerCase();
  return ['manual', 'hourly', 'nightly'].includes(normalized) ? normalized : 'manual';
}

function parsePlaywrightMode(value) {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === 'mcp' ? 'mcp' : 'traditional';
}

function parseStringArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => normalizeString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map(part => part.trim())
      .filter(Boolean);
  }
  return [];
}

function parseSteps(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => normalizeString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map(step => step.trim())
      .filter(Boolean);
  }
  return [];
}

function sanitizeEnvironmentPayload(body = {}) {
  const errors = [];
  const name = normalizeString(body.name);
  const type = normalizeString(body.type) || 'web';
  const baseUrl = normalizeString(body.baseUrl ?? body.base_url ?? body.url);
  const notes = normalizeOptionalString(body.notes ?? body.description);

  if (!name) {
    errors.push('Environment name is required.');
  }
  if (!baseUrl) {
    errors.push('Environment baseUrl is required.');
  }

  return {
    valid: errors.length === 0,
    errors,
    payload: { name, type, baseUrl, notes }
  };
}

function parseMcpConfig(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') {
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error(`Unable to parse mcpConfig: ${error.message}`);
    }
  }
  return null;
}

function sanitizeTestCasePayload(body = {}) {
  const errors = [];
  const title = normalizeString(body.title);
  const description = normalizeOptionalString(body.description) ?? '';
  const feature = normalizeOptionalString(body.feature) ?? '';
  const type = normalizeString(body.type) || 'playwright';
  const playwrightMode = parsePlaywrightMode(body.playwrightMode ?? body.playwright_mode);
  const environmentId = Number(body.environmentId ?? body.environment_id);
  const entryPointRaw = normalizeString(body.entryPoint ?? body.entry_point ?? body.mcpSource ?? body.mcp_source);
  const mcpSourceRaw = normalizeOptionalString(body.mcpSource ?? body.mcp_source);
  let mcpConfig = null;

  try {
    mcpConfig = parseMcpConfig(body.mcpConfig ?? body.mcp_config ?? body.config);
  } catch (error) {
    errors.push(error.message);
  }

  if (!title) {
    errors.push('Test case title is required.');
  }
  if (!Number.isFinite(environmentId)) {
    errors.push('Valid environmentId is required.');
  }

  const entryPoint = entryPointRaw;
  const mcpSource = playwrightMode === 'mcp' ? (mcpSourceRaw || entryPointRaw) : mcpSourceRaw || undefined;

  if (!entryPoint) {
    errors.push('Test case entryPoint is required.');
  }
  if (playwrightMode === 'mcp' && !mcpSource) {
    errors.push('MCP scenarios require an mcpSource path.');
  }

  const steps = parseSteps(body.steps);
  const schedule = parseSchedule(body.schedule);
  const captureArtifacts = parseBoolean(body.captureArtifacts ?? body.capture_artifacts, true);
  const tags = parseStringArray(body.tags);

  return {
    valid: errors.length === 0,
    errors,
    payload: {
      title,
      description,
      feature,
      type,
      playwrightMode,
      environmentId,
      entryPoint,
      mcpSource,
      mcpConfig,
      steps,
      schedule,
      captureArtifacts,
      tags
    }
  };
}

app.get('/api/environments', (_req, res) => {
  res.json(listEnvironments());
});

app.post('/api/environments', (req, res) => {
  const { valid, errors, payload } = sanitizeEnvironmentPayload(req.body);
  if (!valid) {
    return res.status(400).json({ message: errors.join(' ') });
  }
  const env = createEnvironment(payload);
  res.status(201).json(env);
});

app.put('/api/environments/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid environment id' });
  }
  const { valid, errors, payload } = sanitizeEnvironmentPayload(req.body);
  if (!valid) {
    return res.status(400).json({ message: errors.join(' ') });
  }
  const env = updateEnvironment(id, payload);
  if (!env) {
    return res.sendStatus(404);
  }
  res.json(env);
});

app.get('/api/test-cases', (_req, res) => {
  res.json(listTestCases());
});

app.post('/api/test-cases', (req, res) => {
  const { valid, errors, payload } = sanitizeTestCasePayload(req.body);
  if (!valid) {
    return res.status(400).json({ message: errors.join(' ') });
  }
  try {
    const testCase = createTestCase(payload);
    res.status(201).json(testCase);
  } catch (error) {
    res.status(400).json({ message: error?.message ?? String(error) });
  }
});

app.put('/api/test-cases/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid test case id' });
  }
  const { valid, errors, payload } = sanitizeTestCasePayload(req.body);
  if (!valid) {
    return res.status(400).json({ message: errors.join(' ') });
  }
  const testCase = updateTestCase(id, payload);
  if (!testCase) {
    return res.sendStatus(404);
  }
  res.json(testCase);
});

app.delete('/api/test-cases/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid test case id' });
  }
  const deleted = deleteTestCase(id);
  if (!deleted) {
    return res.sendStatus(404);
  }
  res.sendStatus(204);
});

app.post('/api/test-cases/:id/run', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid test case id' });
  }
  const testCase = getTestCaseRow(id);
  if (!testCase) {
    return res.sendStatus(404);
  }
  const triggeredBy = req.body?.triggeredBy ?? 'manual';
  const authToken = req.body?.authToken;
  const environmentOverrides = req.body?.environmentOverrides ?? {};
  const overrides = { ...environmentOverrides };
  if (typeof authToken === 'string' && authToken.length > 0) {
    overrides.authToken = authToken;
  }
  const run = enqueueRun(testCase, triggeredBy, overrides);
  res.status(202).json(run);
});

app.get('/api/test-runs', (req, res) => {
  const testCaseId = typeof req.query.testCaseId === 'string' ? Number(req.query.testCaseId) : undefined;
  const runs = listRuns({ testCaseId: Number.isNaN(testCaseId) ? undefined : testCaseId });
  res.json(runs);
});

app.get('/api/test-runs/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: 'Invalid run id' });
  }
  const row = getRunRow(id);
  if (!row) return res.sendStatus(404);
  const run = mapRun(row);
  // Normalize artifactPath to always start with / for direct linking
  if (run.artifactPath && !run.artifactPath.startsWith('/')) {
    run.artifactPath = '/' + run.artifactPath;
  }
  // Expand screenshot URLs for convenience in the UI
  if (Array.isArray(run.screenshots)) {
    run.screenshots = run.screenshots.map(sc => ({
      ...sc,
      url: `/artifacts/run-${id}/${sc.relativePath}`
    }));
  }
  res.json(run);
});

app.get('/api/metrics', (_req, res) => {
  res.json(getMetrics());
});

app.post('/api/onboarding', (req, res) => {
  try {
    const { config: inlineConfig, path: configPath, dryRun } = req.body ?? {};
    let payloadInput = inlineConfig ?? configPath ?? null;

    if (!payloadInput) {
      const inline = {};
      if (req.body?.environments) inline.environments = req.body.environments;
      if (req.body?.testCases) inline.testCases = req.body.testCases;
      if (Object.keys(inline).length > 0) {
        payloadInput = inline;
      }
    }

    if (!payloadInput) {
      throw new Error('Provide a config object, JSON string, or path to apply onboarding.');
    }

    const config = loadOnboardingConfig(payloadInput);
    const result = applyOnboardingConfig(config, { dryRun: !!dryRun });
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error?.message ?? String(error) });
  }
});

setInterval(scheduleEligibleRuns, 60 * 1000);

const port = process.env.PORT ?? 4001;
app.listen(port, () => {
  console.log(`Playwright MCP Portal API listening on ${port}`);
});
