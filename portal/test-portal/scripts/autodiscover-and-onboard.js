import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';

const apiBase = process.env.PORTAL_API_BASE || 'http://localhost:4001/api';

function walk(dir, filterFn) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, filterFn));
    } else if (!filterFn || filterFn(full)) {
      results.push(full);
    }
  }
  return results;
}

function relToRepo(p) {
  return p.split(path.sep).join('/').replace(/^.*?frontend\//, 'frontend/');
}

function titleFromFile(file, suffixes = []) {
  const base = path.basename(file);
  let name = base;
  for (const s of suffixes) {
    if (name.endsWith(s)) name = name.slice(0, -s.length);
  }
  return name.replace(/[-_.]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function request(url, init = {}) {
  if (typeof fetch === 'function') {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json();
  }
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(url);
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request({
        method: init.method || 'GET',
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + (u.search || ''),
        headers: { 'Content-Type': 'application/json', ...(init.headers || {}) }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`${res.statusCode} ${res.statusMessage}: ${data}`));
          }
          try {
            resolve(data ? JSON.parse(data) : null);
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${e.message}`));
          }
        });
      });
      req.on('error', reject);
      if (init.body) {
        req.write(typeof init.body === 'string' ? init.body : JSON.stringify(init.body));
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

async function main() {
  const repoRoot = path.resolve(process.cwd(), '..', '..');
  const e2eDir = path.join(repoRoot, 'frontend', 'teks-mvp', 'tests', 'e2e');
  const mcpDir = path.join(repoRoot, 'frontend', 'teks-mvp', 'tests', 'mcp');

  const e2eSpecs = walk(e2eDir, f => /\.spec\.ts$/i.test(f));
  const mcpSpecs = walk(mcpDir, f => /\.mcp\.(ya?ml)$/i.test(f));

  const onboarding = {
    environments: [
      { name: 'Local', type: 'web', baseUrl: 'http://localhost:4200', notes: 'Auto-discovered' }
    ],
    testCases: []
  };

  for (const file of e2eSpecs) {
    onboarding.testCases.push({
      title: titleFromFile(file, ['.spec.ts']),
      feature: 'E2E',
      type: 'playwright',
      playwrightMode: 'traditional',
      environment: 'Local',
      entryPoint: relToRepo(file),
      schedule: 'manual',
      captureArtifacts: true,
      tags: ['auto', 'e2e']
    });
  }

  for (const file of mcpSpecs) {
    onboarding.testCases.push({
      title: titleFromFile(file, ['.mcp.yaml', '.mcp.yml']),
      feature: 'MCP',
      type: 'playwright',
      playwrightMode: 'mcp',
      environment: 'Local',
      entryPoint: relToRepo(file),
      mcpSource: relToRepo(file),
      schedule: 'manual',
      captureArtifacts: true,
      tags: ['auto', 'mcp']
    });
  }

  const portalDir = path.join(repoRoot, 'portal', 'test-portal');
  const onboardingPath = path.join(portalDir, 'onboarding.generated.json');
  fs.writeFileSync(onboardingPath, JSON.stringify(onboarding, null, 2));
  console.log('Wrote', onboardingPath);

  // Apply onboarding
  const result = await request(`${apiBase}/onboarding`, {
    method: 'POST',
    body: JSON.stringify({ path: 'onboarding.generated.json' })
  });
  console.log('Onboarding:', JSON.stringify(result, null, 2));

  // Fetch cases
  const cases = await request(`${apiBase}/test-cases`);
  const runArg = process.argv.find(a => a.startsWith('--run='));
  const mode = runArg ? runArg.split('=')[1] : 'e2e'; // e2e | mcp | all
  const filter = (tc) => mode === 'all' || (mode === 'e2e' ? tc.playwrightMode === 'traditional' : tc.playwrightMode === 'mcp');
  const selection = cases.filter(tc => tc.environmentId && filter(tc));
  console.log(`Triggering ${selection.length} ${mode.toUpperCase()} cases...`);

  const runs = [];
  for (const tc of selection) {
    const run = await request(`${apiBase}/test-cases/${tc.id}/run`, {
      method: 'POST',
      body: JSON.stringify({ triggeredBy: 'auto' })
    });
    runs.push(run);
  }
  console.log('Queued runs:', runs.map(r => r.id));
}

main().catch(err => {
  console.error('Failed:', err.message || err);
  process.exit(1);
});
