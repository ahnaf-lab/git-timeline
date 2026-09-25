import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emitViewer } from '../src/emitViewer.js';
import { emitFrames } from '../src/emit.js';
import { buildTimeline } from '../src/index.js';
import { renderFrameHtml } from '../src/viewer/render.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'git-timeline-viewer-'));
}

function git(cwd, args) {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-timeline-viewer-repo-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'tester@example.com']);
  git(dir, ['config', 'user.name', 'Tester']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  return dir;
}

test('emitViewer writes the static viewer files into the output directory', () => {
  const outDir = tempDir();
  const written = emitViewer(outDir);

  const names = written.map((p) => path.basename(p)).sort();
  assert.deepEqual(names, ['index.html', 'render.js', 'viewer.css', 'viewer.js']);

  for (const file of names) {
    assert.ok(fs.existsSync(path.join(outDir, file)), `${file} was not written`);
  }
});

test('index.html wires up the scrub range input and loads viewer.js as a module', () => {
  const outDir = tempDir();
  emitViewer(outDir);
  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');

  assert.match(html, /<input type="range" id="scrub"/);
  assert.match(html, /<script type="module" src="viewer\.js">/);
  assert.match(html, /id="lines"/);
});

test('viewer.js fetches the static manifest and per-frame JSON by relative name', () => {
  const outDir = tempDir();
  emitViewer(outDir);
  const js = fs.readFileSync(path.join(outDir, 'viewer.js'), 'utf8');

  assert.match(js, /fetch\(['"]manifest\.json['"]\)|fetchJson\(['"]manifest\.json['"]\)/);
  assert.match(js, /from '\.\/render\.js'/);
});

test('running emitViewer twice into the same directory is idempotent', () => {
  const outDir = tempDir();
  emitViewer(outDir);
  const firstRun = fs.readFileSync(path.join(outDir, 'render.js'), 'utf8');
  emitViewer(outDir);
  const secondRun = fs.readFileSync(path.join(outDir, 'render.js'), 'utf8');

  assert.equal(firstRun, secondRun);
});

test('frame data and viewer assets coexist in one output directory without collisions', () => {
  const repoDir = makeRepo();
  fs.writeFileSync(path.join(repoDir, 'notes.txt'), 'first\nsecond\n');
  git(repoDir, ['add', 'notes.txt']);
  git(repoDir, ['commit', '-q', '-m', 'init']);

  const outDir = tempDir();
  const timeline = buildTimeline(repoDir, 'notes.txt');
  const manifest = emitFrames(timeline, outDir);
  emitViewer(outDir);

  const entries = fs.readdirSync(outDir).sort();
  assert.deepEqual(entries, [
    'frame-000000.json',
    'index.html',
    'manifest.json',
    'render.js',
    'viewer.css',
    'viewer.js',
  ]);

  // What the viewer would fetch and render is exactly what emitFrames wrote.
  const frame = JSON.parse(
    fs.readFileSync(path.join(outDir, manifest.frames[0].file), 'utf8'),
  );
  const html = renderFrameHtml(frame);
  assert.ok(html.includes('first'));
  assert.ok(html.includes('second'));
});
