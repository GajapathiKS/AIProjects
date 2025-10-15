// Demo: Trigger a Playwright run via MCP tools, then fetch results via REST API.
// Usage:
//   node scripts/mcp-run-demo.js --id 4
//   node scripts/mcp-run-demo.js --title "Goals page (simple)"

import http from 'node:http';
import { spawn } from 'node:child_process';
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--id') out.id = Number(args[++i]);
    else if (a === '--title') out.title = args[++i];
  }
  return out;
}

function httpGetJson(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

async function waitForApiReady(url = 'http://localhost:4001/api/test-cases', timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await httpGetJson(url, 3000);
      return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function ensureApiServer() {
  try {
    await httpGetJson('http://localhost:4001/api/test-cases', 2000);
    return null; // already running
  } catch {}
  const child = spawn(process.execPath || 'node', ['server/index.js'], {
    cwd: process.cwd(), stdio: ['ignore', 'ignore', 'inherit'], env: process.env
  });
  const ok = await waitForApiReady();
  if (!ok) throw new Error('REST API did not become ready.');
  return child;
}

function parseMcpContent(result) {
  const text = result?.content?.[0]?.text;
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function main() {
  const { id, title } = parseArgs();
  if (!id && !title) {
    console.error('Provide --id <testCaseId> or --title "Case Title"');
    process.exit(2);
  }

  // Ensure REST API up (for fetching run info after triggering via MCP)
  const apiProc = await ensureApiServer();

  // Create MCP client transport; this spawns the MCP server under the hood
  const transport = new StdioClientTransport({
    command: process.execPath || 'node',
    args: ['server/mcpServer.js'],
    cwd: process.cwd(),
    env: process.env
  });
  const client = new McpClient(transport);
  await client.connect();

  // Resolve test case id by title if needed
  let testCaseId = id;
  if (!testCaseId) {
    const listed = await client.callTool('list-test-cases', {});
    const cases = parseMcpContent(listed) || [];
    const found = cases.find(c => String(c.title).toLowerCase() === String(title).toLowerCase());
    if (!found) throw new Error(`Test case titled "${title}" not found`);
    testCaseId = found.id;
  }

  // Trigger run via MCP
  const runRes = await client.callTool('run-test-case', { id: Number(testCaseId), triggeredBy: 'mcp-demo' });
  const runInfo = parseMcpContent(runRes);
  if (!runInfo?.id) throw new Error(`Unexpected MCP run response: ${JSON.stringify(runInfo)}`);
  console.log(`[mcp] queued run id: ${runInfo.id}`);

  // Poll REST for run completion and print summary
  const runsUrl = `http://localhost:4001/api/test-runs/${runInfo.id}`;
  const deadline = Date.now() + 5 * 60 * 1000; // up to 5 minutes
  while (Date.now() < deadline) {
    const run = await httpGetJson(runsUrl).catch(() => null);
    if (run?.status && run?.finishedAt) {
      console.log(`[rest] run ${run.id} finished: status=${run.status}`);
      if (run.summary) console.log(`[rest] summary: ${run.summary}`);
      if (Array.isArray(run.screenshots) && run.screenshots.length) {
        console.log(`[rest] screenshots (first 3):`);
        run.screenshots.slice(0, 3).forEach(s => console.log(` - ${s.url}`));
      }
      break;
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  try { await client.close?.(); } catch {}
  if (apiProc && !apiProc.killed) {
    try { apiProc.kill(); } catch {}
  }
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
