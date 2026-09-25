#!/usr/bin/env node
import process from 'node:process';
import { buildTimeline } from '../src/index.js';

const [, , fileArg] = process.argv;

if (!fileArg) {
  console.error('usage: git timeline <file>');
  process.exit(1);
}

try {
  const timeline = buildTimeline(process.cwd(), fileArg);
  process.stdout.write(`${JSON.stringify(timeline, null, 2)}\n`);
} catch (err) {
  console.error(`git-timeline: ${err.message}`);
  process.exit(1);
}
