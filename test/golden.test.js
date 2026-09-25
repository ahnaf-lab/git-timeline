import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTimeline } from '../src/index.js';
import { emitFrames } from '../src/emit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'golden');

// Fixed epoch seconds (UTC), not "now", so the frame data — including the
// computed line ages and the commit hashes themselves, which are content
// hashes over these very dates — is byte-identical on every run and every
// machine.
const COMMIT_TIMES = [1_704_067_200, 1_704_153_600, 1_706_745_600]; // 2024-01-01, 2024-01-02, 2024-02-01 UTC

function git(cwd, args, env) {
  execFileSync('git', args, { cwd, encoding: 'utf8', env: env ?? process.env });
}

function commitAt(dir, message, epochSeconds) {
  const env = {
    ...process.env,
    GIT_AUTHOR_DATE: `@${epochSeconds} +0000`,
    GIT_COMMITTER_DATE: `@${epochSeconds} +0000`,
  };
  git(dir, ['commit', '-q', '-m', message], env);
}

function makeGoldenRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-timeline-golden-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'golden@example.com']);
  git(dir, ['config', 'user.name', 'Golden']);
  git(dir, ['config', 'commit.gpgsign', 'false']);

  fs.writeFileSync(path.join(dir, 'sample.txt'), 'alpha\nbeta\ngamma\n');
  git(dir, ['add', 'sample.txt']);
  commitAt(dir, 'add sample file', COMMIT_TIMES[0]);

  fs.writeFileSync(path.join(dir, 'sample.txt'), 'alpha\nBETA\ngamma\ndelta\n');
  git(dir, ['add', 'sample.txt']);
  commitAt(dir, 'rewrite beta and append delta', COMMIT_TIMES[1]);

  fs.writeFileSync(path.join(dir, 'sample.txt'), 'alpha\nBETA\ndelta\n');
  git(dir, ['add', 'sample.txt']);
  commitAt(dir, 'drop gamma', COMMIT_TIMES[2]);

  return dir;
}

function readJson(...parts) {
  return JSON.parse(fs.readFileSync(path.join(...parts), 'utf8'));
}

test('emits static per-frame JSON matching the checked-in golden fixtures', () => {
  const repoDir = makeGoldenRepo();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-timeline-emit-'));

  const timeline = buildTimeline(repoDir, 'sample.txt');
  const manifest = emitFrames(timeline, outDir);

  const expectedManifest = readJson(FIXTURE_DIR, 'manifest.json');
  assert.deepEqual(manifest, expectedManifest);

  assert.equal(manifest.frames.length, 3);
  for (const frameEntry of manifest.frames) {
    const actual = readJson(outDir, frameEntry.file);
    const expected = readJson(FIXTURE_DIR, frameEntry.file);
    assert.deepEqual(actual, expected);
  }
});

test('tags each line with its age in whole days as of that frame', () => {
  const repoDir = makeGoldenRepo();
  const timeline = buildTimeline(repoDir, 'sample.txt');

  const [first, second, third] = timeline.frames;

  // A line's age is 0 the frame it was introduced or last touched in.
  assert.ok(first.lines.every((l) => l.age === 0));

  // 'alpha' and 'gamma' survive untouched from commit 1 (2024-01-01) into
  // commit 2 (2024-01-02): exactly one day old. 'BETA' and 'delta' are new
  // in commit 2, so they are age 0.
  assert.equal(second.lines[0].age, 1); // alpha
  assert.equal(second.lines[1].age, 0); // BETA (rewritten this commit)
  assert.equal(second.lines[2].age, 1); // gamma
  assert.equal(second.lines[3].age, 0); // delta (added this commit)

  // Commit 3 is 2024-02-01, 31 days after commit 1 and 30 days after
  // commit 2. 'alpha' has been untouched since commit 1: 31 days old.
  // 'BETA' and 'delta' were last touched in commit 2: 30 days old.
  assert.equal(third.lines[0].age, 31); // alpha
  assert.equal(third.lines[1].age, 30); // BETA
  assert.equal(third.lines[2].age, 30); // delta
});

test('manifest entries omit line bodies but preserve per-frame counts', () => {
  const repoDir = makeGoldenRepo();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-timeline-emit-'));

  const timeline = buildTimeline(repoDir, 'sample.txt');
  const manifest = emitFrames(timeline, outDir);

  assert.deepEqual(
    manifest.frames.map((f) => f.lineCount),
    [3, 4, 3],
  );
  for (const frameEntry of manifest.frames) {
    assert.ok(!('lines' in frameEntry));
  }
});
