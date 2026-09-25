#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {
  buildTimeline,
  emitFrames,
  emitViewer,
  startServer,
  openBrowser,
} from '../src/index.js';

function parseArgs(argv) {
  const args = {
    file: undefined,
    out: undefined,
    port: 0,
    open: true,
    serve: true,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      args.out = argv[++i];
    } else if (arg === '--port') {
      args.port = Number(argv[++i]);
    } else if (arg === '--no-open') {
      args.open = false;
    } else if (arg === '--no-serve') {
      args.serve = false;
    } else if (arg === '--json') {
      args.json = true;
    } else if (args.file === undefined) {
      args.file = arg;
    }
  }
  return args;
}

const { file: fileArg, out: outArg, port, open, serve, json } = parseArgs(
  process.argv.slice(2),
);

if (!fileArg) {
  console.error(
    'usage: git timeline <file> [--out <dir>] [--port <n>] [--no-open] [--no-serve] [--json]',
  );
  process.exit(1);
}

try {
  const timeline = buildTimeline(process.cwd(), fileArg);

  if (json) {
    process.stdout.write(`${JSON.stringify(timeline, null, 2)}\n`);
    process.exit(0);
  }

  const usingTempDir = !outArg;
  const outDir = outArg ?? fs.mkdtempSync(path.join(os.tmpdir(), 'git-timeline-'));

  const manifest = emitFrames(timeline, outDir);
  emitViewer(outDir);

  if (!serve) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
    process.exit(0);
  }

  const { server, url } = await startServer(outDir, { port });
  process.stdout.write(`git timeline: serving ${manifest.file} at ${url}\n`);
  process.stdout.write('press Ctrl+C to stop\n');

  if (open) {
    openBrowser(url);
  }

  const shutdown = () => {
    server.close(() => {
      if (usingTempDir) {
        fs.rmSync(outDir, { recursive: true, force: true });
      }
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
} catch (err) {
  console.error(`git-timeline: ${err.message}`);
  process.exit(1);
}
