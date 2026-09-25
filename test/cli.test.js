import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '..', 'bin', 'git-timeline.js');

function git(cwd, args) {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-timeline-cli-repo-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'tester@example.com']);
  git(dir, ['config', 'user.name', 'Tester']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'first\nsecond\n');
  git(dir, ['add', 'notes.txt']);
  git(dir, ['commit', '-q', '-m', 'init']);
  return dir;
}

function waitForLine(child, pattern, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      reject(new Error(`timed out waiting for ${pattern}, got: ${buffer}`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const match = buffer.match(pattern);
      if (match) {
        clearTimeout(timer);
        resolve(match);
      }
    });
    child.on('error', reject);
  });
}

test('git timeline <file> serves the viewer over http and stops on SIGINT', async () => {
  const repoDir = makeRepo();
  const child = spawn(
    process.execPath,
    [CLI, 'notes.txt', '--port', '0', '--no-open'],
    { cwd: repoDir, stdio: ['ignore', 'pipe', 'pipe'] },
  );

  let exitPromise;
  try {
    const match = await waitForLine(child, /serving .* at (http:\/\/127\.0\.0\.1:\d+\/)/);
    const url = match[1];

    const indexRes = await fetch(url);
    assert.equal(indexRes.status, 200);
    assert.match(await indexRes.text(), /<input type="range" id="scrub"/);

    const manifestRes = await fetch(`${url}manifest.json`);
    assert.equal(manifestRes.status, 200);
    const manifest = await manifestRes.json();
    assert.equal(manifest.file, 'notes.txt');
    assert.equal(manifest.frameCount, 1);

    exitPromise = new Promise((resolve) => child.on('exit', (code) => resolve(code)));
    child.kill('SIGINT');
    const code = await exitPromise;
    assert.equal(code, 0);
  } finally {
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }
});

test('git timeline <file> --out <dir> --no-serve writes static files without starting a server', () => {
  const repoDir = makeRepo();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-timeline-cli-out-'));

  const output = execFileSync(
    process.execPath,
    [CLI, 'notes.txt', '--out', outDir, '--no-serve'],
    { cwd: repoDir, encoding: 'utf8' },
  );

  const manifest = JSON.parse(output);
  assert.equal(manifest.frameCount, 1);
  assert.ok(fs.existsSync(path.join(outDir, 'index.html')));
  assert.ok(fs.existsSync(path.join(outDir, 'manifest.json')));
});

test('git timeline <file> --json prints the full timeline without touching disk', () => {
  const repoDir = makeRepo();
  const output = execFileSync(process.execPath, [CLI, 'notes.txt', '--json'], {
    cwd: repoDir,
    encoding: 'utf8',
  });

  const timeline = JSON.parse(output);
  assert.equal(timeline.file, 'notes.txt');
  assert.equal(timeline.frameCount, 1);
  assert.equal(timeline.frames[0].lines.length, 2);
});
