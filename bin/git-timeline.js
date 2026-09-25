#!/usr/bin/env node
import process from 'node:process';
import { buildTimeline, emitFrames } from '../src/index.js';

function parseArgs(argv) {
  const args = { file: undefined, out: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      args.out = argv[++i];
    } else if (args.file === undefined) {
      args.file = arg;
    }
  }
  return args;
}

const { file: fileArg, out: outDir } = parseArgs(process.argv.slice(2));

if (!fileArg) {
  console.error('usage: git timeline <file> [--out <dir>]');
  process.exit(1);
}

try {
  const timeline = buildTimeline(process.cwd(), fileArg);
  if (outDir) {
    const manifest = emitFrames(timeline, outDir);
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(timeline, null, 2)}\n`);
  }
} catch (err) {
  console.error(`git-timeline: ${err.message}`);
  process.exit(1);
}
