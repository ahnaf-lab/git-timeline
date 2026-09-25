import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTimeline, resolveSafePath } from '../src/index.js';

function git(cwd, args) {
  execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-timeline-test-'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'tester@example.com']);
  git(dir, ['config', 'user.name', 'Tester']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  return dir;
}

test('builds one frame per commit and attributes lines to the right author', () => {
  const dir = makeRepo();

  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\ntwo\nthree\n');
  git(dir, ['add', 'a.txt']);
  git(dir, ['commit', '-q', '-m', 'first']);

  fs.writeFileSync(path.join(dir, 'a.txt'), 'one\nTWO\nthree\nfour\n');
  git(dir, ['add', 'a.txt']);
  git(dir, ['commit', '-q', '-m', 'second']);

  const timeline = buildTimeline(dir, 'a.txt');
  assert.equal(timeline.frames.length, 2);

  const [first, second] = timeline.frames;
  assert.deepEqual(first.lines.map((l) => l.text), ['one', 'two', 'three']);
  assert.ok(first.lines.every((l) => l.commit === first.commit.hash));

  assert.deepEqual(second.lines.map((l) => l.text), [
    'one',
    'TWO',
    'three',
    'four',
  ]);
  // lines untouched by the second commit keep their original attribution
  assert.equal(second.lines[0].commit, first.commit.hash);
  assert.equal(second.lines[2].commit, first.commit.hash);
  // the changed and added lines are attributed to the second commit
  assert.equal(second.lines[1].commit, second.commit.hash);
  assert.equal(second.lines[3].commit, second.commit.hash);
});

test('produces identical output across repeated runs', () => {
  const dir = makeRepo();

  fs.writeFileSync(path.join(dir, 'b.txt'), 'alpha\nbeta\n');
  git(dir, ['add', 'b.txt']);
  git(dir, ['commit', '-q', '-m', 'init']);

  const run1 = buildTimeline(dir, 'b.txt');
  const run2 = buildTimeline(dir, 'b.txt');
  assert.deepEqual(run1, run2);
});

test('handles a line deletion by dropping it from later frames', () => {
  const dir = makeRepo();

  fs.writeFileSync(path.join(dir, 'c.txt'), 'keep\ndrop\nkeep2\n');
  git(dir, ['add', 'c.txt']);
  git(dir, ['commit', '-q', '-m', 'init']);

  fs.writeFileSync(path.join(dir, 'c.txt'), 'keep\nkeep2\n');
  git(dir, ['add', 'c.txt']);
  git(dir, ['commit', '-q', '-m', 'remove middle line']);

  const timeline = buildTimeline(dir, 'c.txt');
  const last = timeline.frames.at(-1);
  assert.deepEqual(last.lines.map((l) => l.text), ['keep', 'keep2']);
});

test('rejects a path that would escape the repository', () => {
  const dir = makeRepo();
  assert.throws(() => resolveSafePath(dir, '../outside.txt'));
});

test('returns no frames for a file with no commit history', () => {
  const dir = makeRepo();
  fs.writeFileSync(path.join(dir, 'd.txt'), 'x\n');
  git(dir, ['add', 'd.txt']);
  git(dir, ['commit', '-q', '-m', 'init']);

  const timeline = buildTimeline(dir, 'missing.txt');
  assert.equal(timeline.frameCount, 0);
  assert.deepEqual(timeline.frames, []);
});
