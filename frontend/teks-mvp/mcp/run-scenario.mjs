#!/usr/bin/env node
/*
 MCP client runner for teks-mvp (ESM): reads a YAML scenario, launches the @playwright/mcp stdio server,
 optionally starts the Angular dev server, executes steps, and writes artifacts (screenshots + transcript).
*/
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function parseArgs(argv) {
  const args = { file: '', artifacts: 'test-results/mcp', startServer: false, baseUrl: 'http://localhost:4200' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' || a === '-f') args.file = argv[++i];
    else if (a === '--artifacts' || a === '-o') args.artifacts = argv[++i];
    else if (a === '--start-server') args.startServer = true;
    else if (a === '--baseUrl') args.baseUrl = argv[++i];
  }
  if (!args.file) throw new Error('Usage: run-scenario --file <path-to-yaml> [--artifacts <dir>] [--start-server] [--baseUrl <url>]');
  return args;
}

function parseEnvFile(filePath) {
  const result = {};
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const idx = t.indexOf('=');
      if (idx === -1) return;
      const key = t.slice(0, idx).trim();
      const value = t.slice(idx + 1).trim();
      result[key] = value.replace(/^"|"$/g, '');
    });
  } catch {}
  return result;
}

function loadSecrets() {
  const secrets = {};
  if (process.env.MCP_SECRETS_FILE && fs.existsSync(process.env.MCP_SECRETS_FILE)) {
    Object.assign(secrets, parseEnvFile(process.env.MCP_SECRETS_FILE));
  }
  secrets.username = process.env.PLAYWRIGHT_MCP_USERNAME || secrets.username || 'admin';
  secrets.password = process.env.PLAYWRIGHT_MCP_PASSWORD || secrets.password || 'ChangeMe123!';
  return secrets;
}

function get(obj, pathExpr, fallback = '') {
  const parts = pathExpr.split('.').map(p => p.trim()).filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return fallback;
    cur = cur[p];
  }
  return cur ?? fallback;
}

function applyTemplates(value, context) {
  if (typeof value === 'string') {
    return value.replace(/{{\s*([^}]+)\s*}}/g, (_, expr) => {
      const v = get(context, expr, '');
      return typeof v === 'string' ? v : JSON.stringify(v);
    });
  }
  if (Array.isArray(value)) return value.map(v => applyTemplates(v, context));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = applyTemplates(v, context);
    return out;
  }
  return value;
}

function loadScenario(filePath, context) {
  const contents = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(contents);
  if (!parsed || typeof parsed !== 'object') throw new Error('Scenario YAML must be an object');
  const metadata = applyTemplates(parsed.metadata ?? {}, context);
  const config = applyTemplates(parsed.config ?? {}, { ...context, metadata });
  const steps = (Array.isArray(parsed.steps) ? parsed.steps : []).map((step, i) => {
    const entries = Object.entries(step || {});
    if (entries.length !== 1) throw new Error(`Step ${i + 1} must contain exactly one action`);
    const [action, rawPayload] = entries[0];
    const payload = applyTemplates(rawPayload, { ...context, metadata, config });
    return { action, payload };
  });
  return { metadata, config, steps };
}

function toBool(v, fallback = false) {
  if (v === undefined || v === null || v === '') return fallback;
  if (typeof v === 'boolean') return v;
  return ['true', '1', 'yes', 'on'].includes(String(v).toLowerCase());
}

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

async function poll(check, { timeout = 15000, interval = 500 }) {
  const end = Date.now() + timeout;
  while (true) {
    const ok = await check();
    if (ok) return true;
    if (Date.now() > end) throw new Error('Condition not met before timeout');
    await wait(interval);
  }
}

function collectText(result) {
  const content = result?.content || [];
  return content.map((e) => {
    if (typeof e?.text === 'string') return e.text;
    if (e?.type === 'text' && typeof e.value === 'string') return e.value;
    return '';
  }).join('').trim();
}

function isTruthyResult(result) {
  // Accept booleans coming back as text or JSON
  const content = result?.content || [];
  for (const entry of content) {
    if (entry?.type === 'json') {
      const v = entry.json;
      if (v === true || String(v).toLowerCase() === 'true' || v === 1 || String(v).toLowerCase() === 'yes') return true;
    }
    if (typeof entry?.text === 'string') {
      const text = entry.text.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(text)) return true;
    }
    if (entry?.type === 'text' && typeof entry.value === 'string') {
      const text = entry.value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on'].includes(text)) return true;
    }
  }
  return false;
}

async function callTool(client, name, args) {
  return client.callTool({ name, arguments: args });
}

async function executeStep(client, step, ctx) {
  const { artifactDir, runId, events, screenshots, config } = ctx;
  const record = { action: step.action, status: 'passed', detail: '' };
  try {
    switch (step.action) {
      case 'navigate': {
        const url = typeof step.payload === 'string' ? step.payload : step.payload?.url;
        if (!url) throw new Error('navigate step requires a url');
        await callTool(client, 'browser_navigate', { url });
        // Wait for Angular app root or any meaningful body content
        const readyScript = `() => {
          const hasRoot = !!(document.querySelector('app-root') || document.querySelector('app-login-page'));
          const hasContent = (document.body && document.body.innerText && document.body.innerText.trim().length > 0);
          return (hasRoot || hasContent) ? 'true' : 'false';
        }`;
        await poll(async () => {
          const result = await callTool(client, 'browser_evaluate', { function: readyScript });
          return isTruthyResult(result);
        }, { timeout: (ctx.config?.timeout ?? 45000) });
        record.detail = `Navigated to ${url}`;
        break;
      }
      case 'fill': {
        const selector = step.payload?.selector;
        const value = step.payload?.value ?? '';
        if (!selector) throw new Error('fill step requires selector');
        const script = `() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('Selector ${selector} not found');
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.focus();
            el.value = ${JSON.stringify(value)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            el.textContent = ${JSON.stringify(value)};
          }
          return true;
        }`;
        await callTool(client, 'browser_evaluate', { function: script });
        record.detail = `Filled ${selector}`;
        break;
      }
      case 'click': {
        const selector = step.payload?.selector;
        if (!selector) throw new Error('click step requires selector');
        const script = `() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) throw new Error('Selector ${selector} not found');
          el.click();
          return true;
        }`;
        await callTool(client, 'browser_evaluate', { function: script });
        record.detail = `Clicked ${selector}`;
        break;
      }
      case 'clickText': {
        const selector = step.payload?.selector || 'body *';
        const text = step.payload?.text;
        if (!text) throw new Error('clickText step requires text');
        const script = `() => {
          const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
          const target = nodes.find(el => (el.textContent || '').trim().includes(${JSON.stringify(text)}));
          if (!target) throw new Error('No element matching ${text}');
          target.click();
          return true;
        }`;
        await callTool(client, 'browser_evaluate', { function: script });
        record.detail = `Clicked element containing ${text}`;
        break;
      }
      case 'expectVisible': {
        const selector = step.payload?.selector;
        const text = step.payload?.text;
        if (!selector) throw new Error('expectVisible step requires selector');
        const script = `() => {
          const nodes = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
          if (!nodes.length) return 'false';
          if (${text ? 'true' : 'false'}) {
            const t = ${JSON.stringify(text ?? '')};
            return nodes.some(el => (el.textContent || '').includes(t)) ? 'true' : 'false';
          }
          return nodes.some(el => {
            const rect = el.getBoundingClientRect();
            return !!rect.width || !!rect.height;
          }) ? 'true' : 'false';
        }`;
        await poll(async () => {
          const result = await callTool(client, 'browser_evaluate', { function: script });
          return isTruthyResult(result);
        }, { timeout: config?.timeout || 45000 });
        record.detail = `Validated visibility for ${selector}`;
        break;
      }
      case 'waitFor': {
        const timeout = step.payload?.milliseconds ? Number(step.payload.milliseconds) : undefined;
        const selector = step.payload?.selector;
        const text = step.payload?.text;
        if (selector || text) {
          const script = `() => {
            const root = document.body;
            const nodes = ${selector ? `Array.from(document.querySelectorAll(${JSON.stringify(selector)}))` : '[root]'};
            if (!nodes.length) return 'false';
            if (${text ? 'true' : 'false'}) {
              const t = ${JSON.stringify(text ?? '')};
              return (nodes.some(el => (el.textContent || '').includes(t)) || (root.textContent || '').includes(t)) ? 'true' : 'false';
            }
            return 'true';
          }`;
          await poll(async () => {
            const result = await callTool(client, 'browser_evaluate', { function: script });
            return isTruthyResult(result);
          }, { timeout: timeout ?? (config?.timeout || 45000) });
        } else if (timeout) {
          await wait(timeout);
        } else {
          await wait(Math.min(config?.timeout || 45000, 2000));
        }
        record.detail = 'Wait completed';
        break;
      }
      case 'evaluate': {
        const script = typeof step.payload === 'string' ? step.payload : step.payload?.script;
        if (!script) throw new Error('evaluate step requires script');
        const result = await callTool(client, 'browser_evaluate', { function: script });
        const text = collectText(result);
        record.detail = text || 'Executed script';
        break;
      }
      case 'screenshot': {
        const info = typeof step.payload === 'string' ? { name: step.payload } : step.payload || {};
        const name = (info.name || `step-${ctx.events.length + 1}`).toString().replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
        const screenshotsDir = path.join(artifactDir, 'screenshots');
        ensureDir(screenshotsDir);
        const filename = `${String(runId).padStart(4, '0')}-${name}.png`;
        const result = await callTool(client, 'browser_take_screenshot', {
          type: 'png',
          filename,
          fullPage: toBool(info.fullPage, true)
        });
        const imageEntry = result?.content?.find(e => e.type === 'image');
        if (imageEntry?.data) {
          const buffer = Buffer.from(imageEntry.data, 'base64');
          fs.writeFileSync(path.join(screenshotsDir, filename), buffer);
          screenshots.push({
            title: name,
            project: 'mcp',
            status: 'captured',
            fileName: filename,
            relativePath: path.join('screenshots', filename)
          });
        }
        record.detail = `Captured screenshot ${filename}`;
        break;
      }
      default:
        throw new Error(`Unsupported step action: ${step.action}`);
    }
    ctx.events.push(record);
  } catch (err) {
    record.status = 'failed';
    record.detail = err?.message || String(err);
    ctx.events.push(record);
    throw err;
  }
}

async function waitForServer(url, timeoutMs = 60000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: 2000 }, res => {
          res.resume();
          resolve();
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(new Error('timeout')); });
      });
      return true;
    } catch {
      await wait(1500);
    }
  }
  throw new Error(`Dev server at ${url} not reachable within ${timeoutMs}ms`);
}

function httpGet(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode || 0, body: data }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
  });
}

async function resolveBaseUrl(candidates) {
  for (const url of candidates) {
    try {
      const { status, body } = await httpGet(url);
      if (status >= 200 && status < 500) {
        const text = (body || '').toLowerCase();
        // Fingerprint for our Angular shell
        if (text.includes('texas teks program manager') || text.includes('router-outlet') || text.includes('app-root')) {
          return url;
        }
      }
    } catch {}
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const repoRoot = path.resolve(process.cwd());
  const scenarioPath = path.isAbsolute(args.file) ? args.file : path.join(repoRoot, args.file);
  if (!fs.existsSync(scenarioPath)) throw new Error(`Scenario file not found: ${scenarioPath}`);

  const runId = Date.now();
  const artifactDir = path.isAbsolute(args.artifacts) ? args.artifacts : path.join(repoRoot, args.artifacts, `run-${runId}`);
  ensureDir(artifactDir);

  let devServerProc = null;
  if (args.startServer) {
    // If the app is already running on any common port, skip starting another dev server
    const initialCandidates = [
      args.baseUrl,
      'http://localhost:4200',
      'http://127.0.0.1:4200',
      'http://localhost:4201',
      'http://127.0.0.1:4201',
      'http://localhost:4202'
    ].filter(Boolean);
    const existing = await resolveBaseUrl(initialCandidates);

    if (!existing) {
      // Start Angular dev server in background using npm start
      const startCmd = process.platform === 'win32' ? 'npm run start' : 'npm run start';
      devServerProc = spawn(startCmd, {
        cwd: repoRoot,
        env: { ...process.env, CI: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });
      const logPath = path.join(artifactDir, 'ng-serve.log');
      const log = fs.createWriteStream(logPath);
      devServerProc.stdout.on('data', chunk => log.write(chunk));
      devServerProc.stderr.on('data', chunk => log.write(chunk));
      try {
        await waitForServer('http://localhost:4200', 180000);
      } catch (e) {
        if (devServerProc) devServerProc.kill();
        throw e;
      }
    }
  }

  // Resolve the actual baseUrl to the running app
  const candidates = [
    args.baseUrl,
    'http://localhost:4200',
    'http://127.0.0.1:4200',
    'http://localhost:4201',
    'http://127.0.0.1:4201',
    'http://localhost:4202'
  ].filter(Boolean);
  const detected = await resolveBaseUrl(candidates);
  const environment = { baseUrl: detected || args.baseUrl || 'http://localhost:4200' };
  const secrets = loadSecrets();
  const context = { environment, secrets };
  const { metadata, config, steps } = loadScenario(scenarioPath, context);
  const mergedConfig = {
    baseUrl: config.baseUrl || environment.baseUrl,
    browser: config.browser || 'chromium',
    headless: toBool(config.headless, true),
    timeout: Number(config.timeout || 45000)
  };

  const outputDir = path.join(artifactDir, 'mcp-output');
  ensureDir(outputDir);

  const mcpBin = process.platform === 'win32'
    ? path.join(repoRoot, 'node_modules', '.bin', 'mcp-server-playwright.cmd')
    : path.join(repoRoot, 'node_modules', '.bin', 'mcp-server-playwright');
  const mcpArgs = ['--browser', mergedConfig.browser];
  if (mergedConfig.headless) mcpArgs.push('--headless');
  mcpArgs.push('--output-dir', outputDir);

  const transport = new StdioClientTransport({
    command: mcpBin,
    args: mcpArgs,
    cwd: repoRoot,
    stderr: 'pipe'
  });

  const stderrPath = path.join(artifactDir, 'mcp.stderr.log');
  const stderrStream = transport.stderr;
  const stderrWriter = fs.createWriteStream(stderrPath);
  if (stderrStream) {
    stderrStream.on('data', chunk => stderrWriter.write(chunk));
  }

  const client = new Client({ name: 'TEKS MVP MCP Runner', version: '1.0.0' });

  const events = [];
  const screenshots = [];
  let status = 'passed';
  let summary = 'MCP scenario executed successfully';
  let reportFile = 'transcript.json';

  try {
    await client.connect(transport);

    for (const step of steps) {
      await executeStep(client, step, { artifactDir, runId, events, screenshots, config: mergedConfig });
    }
  } catch (error) {
    status = 'failed';
    summary = error?.message ? `Scenario failed: ${error.message}` : 'Scenario failed';
    try {
      await executeStep(client, { action: 'screenshot', payload: { name: 'failure' } }, { artifactDir, runId, events, screenshots });
    } catch {}
  } finally {
    try { await client.close(); } catch {}
    stderrWriter.end();
    if (devServerProc) {
      devServerProc.kill();
    }
  }

  const transcript = { metadata, config: mergedConfig, steps: events, screenshots, status, summary, scenarioPath };
  fs.writeFileSync(path.join(artifactDir, reportFile), JSON.stringify(transcript, null, 2));

  console.log(JSON.stringify({ status, summary, artifactDir, report: path.join(artifactDir, reportFile) }, null, 2));
  if (status !== 'passed') process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
