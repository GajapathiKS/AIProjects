import fs from 'node:fs';
import path from 'node:path';

const artifactDir = path.join(process.cwd(), 'data', 'artifacts');

function writeIndex(runId) {
  const runFolder = path.join(artifactDir, `run-${runId}`);
  if (!fs.existsSync(runFolder)) {
    throw new Error(`Run folder not found: ${runFolder}`);
  }
  const screenshotsDir = path.join(runFolder, 'screenshots');
  const screenshots = [];
  if (fs.existsSync(screenshotsDir)) {
    for (const file of fs.readdirSync(screenshotsDir)) {
      if (/\.(png|jpg|jpeg|gif)$/i.test(file)) {
        screenshots.push({ title: file, relativePath: path.join('screenshots', file).replace(/\\/g, '/') });
      }
    }
  }
  const files = ['stdout.log', 'stderr.log', 'report.json', 'transcript.json', 'metadata.json'];
  const lines = [];
  lines.push('<!doctype html>');
  lines.push('<meta charset="utf-8"/>');
  lines.push(`<title>Run ${runId} Artifacts</title>`);
  lines.push('<style>body{font-family:system-ui,Segoe UI,Arial;margin:20px} .status{padding:2px 6px;border-radius:4px;background:#eee;text-transform:uppercase;font-size:12px} ul{line-height:1.8}</style>');
  lines.push(`<h1>Run ${runId} Artifacts</h1>`);
  lines.push('<h2>Logs</h2>');
  lines.push('<ul>');
  for (const file of files) {
    if (fs.existsSync(path.join(runFolder, file))) {
      lines.push(`<li><a href="./${file}">${file}</a></li>`);
    }
  }
  lines.push('</ul>');
  if (screenshots.length) {
    lines.push('<h2>Screenshots</h2>');
    lines.push('<ul>');
    for (const sc of screenshots) {
      lines.push(`<li><a href="./${sc.relativePath}">${sc.title}</a></li>`);
    }
    lines.push('</ul>');
  }
  fs.writeFileSync(path.join(runFolder, 'index.html'), lines.join('\n'));
}

function main() {
  const arg = process.argv.find(a => a.startsWith('--run='));
  if (!arg) {
    console.error('Usage: node scripts/generate-run-index.js --run=<id>');
    process.exit(1);
  }
  const id = Number(arg.split('=')[1]);
  if (!Number.isFinite(id)) {
    console.error('Invalid run id');
    process.exit(1);
  }
  writeIndex(id);
  console.log(`Generated index.html for run ${id}`);
}

main();
