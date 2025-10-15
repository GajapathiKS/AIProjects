import { spawn } from 'node:child_process';
import http from 'node:http';

function log(name, msg) {
  const ts = new Date().toISOString().split('T')[1].replace('Z','');
  // simple prefixes; let terminals colorize via process
  // eslint-disable-next-line no-console
  console.log(`[${ts}] [${name}] ${msg}`);
}

function start(name, entry) {
  const child = spawn(process.execPath || 'node', [entry], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (b) => log(name, String(b).trimEnd()));
  child.stderr.on('data', (b) => log(name, String(b).trimEnd()));
  child.on('exit', (code, signal) => {
    log(name, `exited (code=${code}, signal=${signal ?? 'none'})`);
  });
  return child;
}

function waitForApiReady({ url = 'http://localhost:4001/api/test-cases', timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode && res.statusCode < 500) {
          res.resume();
          return resolve(true);
        }
        res.resume();
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(tick, 500);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(tick, 500);
      });
    };
    tick();
  });
}

async function main() {
  log('dev', 'Starting REST API and MCP server...');
  const api = start('api', 'server/index.js');
  const mcp = start('mcp', 'server/mcpServer.js');

  const ready = await waitForApiReady();
  if (ready) {
    log('dev', 'REST API ready at http://localhost:4001');
    log('dev', 'Tip: Open a new terminal and run npm run dev for the web UI on http://localhost:4201');
  } else {
    log('dev', 'REST API did not become ready in time (check logs above).');
  }

  const onExit = () => {
    log('dev', 'Shutting down...');
    try { api.kill(); } catch {}
    try { mcp.kill(); } catch {}
    setTimeout(() => process.exit(0), 250);
  };
  process.on('SIGINT', onExit);
  process.on('SIGTERM', onExit);
}

main().catch((e) => {
  log('dev', `Fatal error: ${e?.stack || e}`);
  process.exit(1);
});
