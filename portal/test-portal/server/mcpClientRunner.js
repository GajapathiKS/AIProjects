import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseEnvFile(filePath) {
  const result = {};
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }
      const idx = trimmed.indexOf('=');
      if (idx === -1) {
        return;
      }
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      result[key] = value.replace(/^"|"$/g, '');
    });
  } catch (error) {
    // ignore missing file
  }
  return result;
}

function loadSecrets() {
  const secrets = {};
  const secretsFile = process.env.MCP_SECRETS_FILE;
  if (secretsFile && fs.existsSync(secretsFile)) {
    Object.assign(secrets, parseEnvFile(secretsFile));
  }
  if (process.env.PLAYWRIGHT_MCP_USERNAME) {
    secrets.username = process.env.PLAYWRIGHT_MCP_USERNAME;
  }
  if (process.env.PLAYWRIGHT_MCP_PASSWORD) {
    secrets.password = process.env.PLAYWRIGHT_MCP_PASSWORD;
  }
  if (!secrets.username) {
    secrets.username = 'admin';
  }
  if (!secrets.password) {
    secrets.password = 'P@ssword1';
  }
  return secrets;
}

function getContextValue(pathExpression, context) {
  const parts = pathExpression.split('.').map(part => part.trim()).filter(Boolean);
  let current = context;
  for (const part of parts) {
    if (current == null) {
      return '';
    }
    current = current[part];
  }
  if (current == null) {
    return '';
  }
  return typeof current === 'object' ? current : String(current);
}

function applyTemplates(value, context) {
  if (typeof value === 'string') {
    return value.replace(/{{\s*([^}]+)\s*}}/g, (_, expr) => {
      const replacement = getContextValue(expr, context);
      return typeof replacement === 'string' ? replacement : JSON.stringify(replacement);
    });
  }
  if (Array.isArray(value)) {
    return value.map(item => applyTemplates(item, context));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = applyTemplates(entry, context);
    }
    return result;
  }
  return value;
}

function resolveScenarioPath(rawPath) {
  if (!rawPath) {
    throw new Error('MCP scenario requires a source path.');
  }
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const candidate = path.isAbsolute(rawPath) ? rawPath : path.join(repoRoot, rawPath);
  const normalized = path.normalize(candidate);
  if (!normalized.startsWith(repoRoot)) {
    throw new Error(`Scenario path ${rawPath} must be inside the repository.`);
  }
  if (!fs.existsSync(normalized)) {
    throw new Error(`Scenario file not found at ${normalized}`);
  }
  return normalized;
}

function loadScenarioFile(filePath, context) {
  const contents = fs.readFileSync(filePath, 'utf-8');
  const parsed = yaml.load(contents);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Scenario file must define a YAML object.');
  }
  const scenario = parsed;
  const metadata = applyTemplates(scenario.metadata ?? {}, context);
  const config = applyTemplates(scenario.config ?? {}, { ...context, metadata });
  const stepsInput = Array.isArray(scenario.steps) ? scenario.steps : [];
  const steps = stepsInput.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Step ${index + 1} must be an object.`);
    }
    const entries = Object.entries(item);
    if (entries.length !== 1) {
      throw new Error(`Step ${index + 1} must contain exactly one action.`);
    }
    const [action, rawPayload] = entries[0];
    const payload = applyTemplates(rawPayload, { ...context, metadata, config });
    return { action, payload };
  });
  return { metadata, config, steps };
}

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') return value;
  const truthy = ['true', '1', 'yes', 'on'];
  return truthy.includes(String(value).toLowerCase());
}

function sanitizeName(value, fallback = 'artifact') {
  return (value || fallback)
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function poll(check, { timeout = 15000, interval = 500 }) {
  const end = Date.now() + timeout;
  while (true) {
    const result = await check();
    if (result) {
      return true;
    }
    if (Date.now() > end) {
      throw new Error('Condition not met before timeout.');
    }
    await wait(interval);
  }
}

async function callTool(client, name, args) {
  return client.callTool({ name, arguments: args });
}

function collectText(result) {
  if (!result || !Array.isArray(result.content)) return '';
  return result.content
    .map(entry => {
      if (typeof entry?.text === 'string') {
        return entry.text;
      }
      if (entry?.type === 'text' && typeof entry.value === 'string') {
        return entry.value;
      }
      return '';
    })
    .filter(Boolean)
    .join('')
    .trim();
}

function isTruthyResult(result) {
  const text = collectText(result).toLowerCase();
  if (!text) return false;
  return ['true', '1', 'yes', 'on'].includes(text);
}

async function executeStep(client, step, options) {
  const { artifactDir, runId, events, screenshots, context } = options;
  const label = `${step.action}`;
  const record = { action: step.action, status: 'passed', detail: '' };
  try {
    switch (step.action) {
      case 'navigate': {
        const url = typeof step.payload === 'string' ? step.payload : step.payload?.url;
        if (!url) throw new Error('navigate step requires a url');
        await callTool(client, 'browser_navigate', { url });
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
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false;
          if (${text ? 'true' : 'false'}) {
            return (el.textContent || '').includes(${JSON.stringify(text ?? '')});
          }
          const rect = el.getBoundingClientRect();
          return !!rect.width || !!rect.height;
        }`;
        await poll(async () => {
          const result = await callTool(client, 'browser_evaluate', { function: script });
          return isTruthyResult(result);
        }, {});
        record.detail = `Validated visibility for ${selector}`;
        break;
      }
      case 'waitFor': {
        const timeout = step.payload?.milliseconds ? Number(step.payload.milliseconds) : undefined;
        const selector = step.payload?.selector;
        const text = step.payload?.text;
        if (selector || text) {
          const script = `() => {
            const el = ${selector ? `document.querySelector(${JSON.stringify(selector)})` : 'document.body'};
            if (!el) return false;
            if (${text ? 'true' : 'false'}) {
              return (el.textContent || '').includes(${JSON.stringify(text ?? '')});
            }
            return true;
          }`;
          await poll(async () => {
            const result = await callTool(client, 'browser_evaluate', { function: script });
            return isTruthyResult(result);
          }, { timeout: timeout ?? 15000 });
        } else if (timeout) {
          await wait(timeout);
        } else {
          await wait(1000);
        }
        record.detail = 'Wait completed';
        break;
      }
      case 'evaluate': {
        const script = typeof step.payload === 'string' ? step.payload : step.payload?.script;
        if (!script) throw new Error('evaluate step requires script');
        const result = await callTool(client, 'browser_evaluate', { function: script });
        const text = collectText(result);
        record.detail = text ?? 'Executed script';
        break;
      }
      case 'screenshot': {
        const info = typeof step.payload === 'string' ? { name: step.payload } : step.payload || {};
        const name = sanitizeName(info.name || `step-${events.length + 1}`);
        const screenshotsDir = path.join(artifactDir, 'screenshots');
        ensureDir(screenshotsDir);
        const filename = `${String(runId).padStart(4, '0')}-${name}.png`;
        const result = await callTool(client, 'browser_take_screenshot', {
          type: 'png',
          filename,
          fullPage: toBoolean(info.fullPage, true)
        });
        const imageEntry = result?.content?.find(entry => entry.type === 'image');
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
        throw new Error(`Unsupported MCP step: ${step.action}`);
    }
    events.push(record);
  } catch (error) {
    record.status = 'failed';
    record.detail = error?.message ?? String(error);
    events.push(record);
    throw error;
  }
}

export async function runMcpScenario({ runId, testCase, environment, artifactDir }) {
  const scenarioPath = resolveScenarioPath(testCase.mcp_source || testCase.entry_point);
  const repoRoot = path.resolve(__dirname, '..', '..');
  const frontendRoot = path.join(repoRoot, 'frontend', 'teks-mvp');
  const backendApiRoot = path.join(repoRoot, 'backend', 'src', 'SpecialPrograms.Api');
  const baseUrl = environment?.base_url ?? environment?.baseUrl ?? 'http://localhost:4200';
  const secrets = loadSecrets();
  const runtime = {
    runId,
    startedAt: new Date().toISOString(),
    artifactDir,
    projectRoot: frontendRoot,
    frontendRoot,
    repoRoot,
    backendApiRoot
  };
  const context = {
    environment: { ...environment, baseUrl },
    testCase,
    runtime,
    secrets
  };
  const { metadata, config, steps } = loadScenarioFile(scenarioPath, context);
  const mergedConfig = {
    baseUrl: config.baseUrl || baseUrl,
    browser: config.browser || 'chromium',
    headless: toBoolean(config.headless, true),
    timeout: config.timeout ? Number(config.timeout) : 15000,
    ...config
  };
  context.environment.apiBaseUrl = mergedConfig.apiBaseUrl || context.environment.apiBaseUrl || process.env.TEST_API_BASE || 'https://localhost:7140';
  context.config = mergedConfig;
  const allowInsecureApiTls = toBoolean(mergedConfig.allowInsecureApiTls ?? mergedConfig.insecureApiTls ?? mergedConfig.allowInsecureTls);
  const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  ensureDir(artifactDir);
  const outputDir = path.join(artifactDir, 'mcp-output');
  ensureDir(outputDir);

  const args = ['mcp-server-playwright', '--browser', mergedConfig.browser];
  if (mergedConfig.headless) {
    args.push('--headless');
  }
  args.push('--output-dir', outputDir);
  if (toBoolean(process.env.MCP_SAVE_TRACE)) {
    args.push('--save-trace');
  }

  if (process.env.MCP_SECRETS_FILE && fs.existsSync(process.env.MCP_SECRETS_FILE)) {
    args.push('--secrets', process.env.MCP_SECRETS_FILE);
  }

  const transport = new StdioClientTransport({
    command: 'npx',
    args,
    cwd: repoRoot,
    stderr: 'pipe'
  });

  const stderrPath = path.join(artifactDir, 'mcp.stderr.log');
  const stderrStream = transport.stderr;
  const stderrWriter = fs.createWriteStream(stderrPath);
  if (stderrStream) {
    stderrStream.on('data', chunk => stderrWriter.write(chunk));
  }

  const client = new Client({ name: 'Playwright MCP Portal', version: '1.0.0' });
  const events = [];
  const screenshots = [];
  let status = 'passed';
  let summary = 'Executed MCP scenario successfully';
  let reportFile = 'transcript.json';

  try {
    if (allowInsecureApiTls) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    await client.connect(transport);

    for (const step of steps) {
      await executeStep(client, step, { artifactDir, runId, events, screenshots, context });
    }
  } catch (error) {
    status = 'failed';
    summary = error?.message ? `Scenario failed: ${error.message}` : 'Scenario failed';
    try {
      await executeStep(client, { action: 'screenshot', payload: { name: 'failure' } }, { artifactDir, runId, events, screenshots, context });
    } catch {
      // ignore screenshot failure
    }
  } finally {
    if (allowInsecureApiTls) {
      if (originalRejectUnauthorized === undefined) {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      } else {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
      }
    }
    stderrWriter.end();
    try {
      await client.close();
    } catch {}
  }

  const transcript = {
    metadata,
    config: mergedConfig,
    steps: events,
    screenshots,
    status,
    summary,
    scenarioPath
  };
  fs.writeFileSync(path.join(artifactDir, reportFile), JSON.stringify(transcript, null, 2));

  return {
    status,
    summary,
    jsonReportPath: reportFile,
    screenshots
  };
}
