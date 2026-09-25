import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createStaticServer,
  startServer,
  resolveRequestPath,
} from '../src/serve.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'git-timeline-serve-'));
}

test('resolveRequestPath maps "/" to index.html inside the root', () => {
  const root = tempDir();
  const target = resolveRequestPath(root, '/');
  assert.equal(target, path.join(root, 'index.html'));
});

test('resolveRequestPath resolves a relative asset path under the root', () => {
  const root = tempDir();
  const target = resolveRequestPath(root, '/manifest.json');
  assert.equal(target, path.join(root, 'manifest.json'));
});

test('resolveRequestPath never resolves outside the root, encoded or not', () => {
  const root = tempDir();
  const attempts = [
    '/../secret.txt',
    '/%2e%2e/secret.txt',
    '/foo/../../secret.txt',
    '/foo/%2e%2e/%2e%2e/secret.txt',
    '/..%2f..%2fsecret.txt',
  ];
  for (const requestUrl of attempts) {
    const target = resolveRequestPath(root, requestUrl);
    // Either refused outright, or resolved to somewhere still under root —
    // never a path that escapes it.
    assert.ok(
      target === null || target === root || target.startsWith(root + path.sep),
      `${requestUrl} escaped root: ${target}`,
    );
  }
});

test('server serves a written file with the right content and content-type', async () => {
  const root = tempDir();
  fs.writeFileSync(path.join(root, 'manifest.json'), '{"ok":true}');

  const { server, url } = await startServer(root);
  try {
    const res = await fetch(`${url}manifest.json`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await res.json(), { ok: true });
  } finally {
    server.close();
  }
});

test('server returns 404 for a missing file and refuses path traversal', async () => {
  const root = tempDir();
  fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');

  const { server, url } = await startServer(root);
  try {
    const missing = await fetch(`${url}nope.json`);
    assert.equal(missing.status, 404);

    const traversal = await fetch(`${url}..%2f..%2fetc%2fpasswd`);
    assert.ok(traversal.status === 400 || traversal.status === 404);
  } finally {
    server.close();
  }
});

test('server rejects non-GET/HEAD methods', async () => {
  const root = tempDir();
  fs.writeFileSync(path.join(root, 'index.html'), '<html></html>');

  const { server, url } = await startServer(root);
  try {
    const res = await fetch(url, { method: 'POST' });
    assert.equal(res.status, 405);
  } finally {
    server.close();
  }
});

test('createStaticServer instances are plain http.Server objects not yet listening', () => {
  const root = tempDir();
  const server = createStaticServer(root);
  assert.equal(server.listening, false);
  server.close();
});
