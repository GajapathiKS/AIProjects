import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function main() {
  const idArg = process.argv.find(a => a.startsWith('--id='));
  if (!idArg) {
    console.error('Usage: node scripts/mcp-trigger-run.js --id=<testCaseId> [--title=...]');
    process.exit(1);
  }
  const id = Number(idArg.split('=')[1]);
  const titleArg = process.argv.find(a => a.startsWith('--title='));
  const title = titleArg ? titleArg.split('=')[1] : undefined;

  const transport = new StdioClientTransport({
    command: 'node',
    args: ['server/mcpServer.js'],
    stderr: 'pipe'
  });

  const client = new Client({ name: 'mcp-trigger', version: '1.0.0' });
  try {
    await client.connect(transport);
    const result = await client.callTool({ name: 'run-test-case', arguments: { id, triggeredBy: title ?? 'codex' } });
    const text = (result?.content ?? []).map(c => c.text || c.value || '').join('');
    console.log(text);
  } finally {
    try { await client.close(); } catch {}
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
