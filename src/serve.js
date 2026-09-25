import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

// Small, fixed content-type map: the viewer only ever ships these
// extensions, so there is no need for a general-purpose mime library.
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
}

/**
 * Resolve a request path against `rootDir`, refusing anything that would
 * escape it (`..`, absolute paths, encoded traversal) the same way
 * `resolveSafePath` guards CLI file arguments. The request path is
 * untrusted network input even though this server only ever binds to
 * loopback.
 */
export function resolveRequestPath(rootDir, requestUrl) {
  const root = path.resolve(rootDir);
  const { pathname } = new URL(requestUrl, 'http://localhost');
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) {
    return null;
  }
  return target;
}

/**
 * Create (but do not start) an http.Server that serves the static files in
 * `rootDir` — the manifest, per-frame JSON and viewer assets written by
 * `emitFrames`/`emitViewer`. Only GET/HEAD are handled; anything else, any
 * path outside `rootDir`, or a missing file gets a plain-text error status.
 */
export function createStaticServer(rootDir) {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('method not allowed');
      return;
    }

    const target = resolveRequestPath(rootDir, req.url ?? '/');
    if (!target) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('bad request');
      return;
    }

    fs.readFile(target, (err, data) => {
      if (err) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': contentTypeFor(target) });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
}

/**
 * Start the static server on an OS-assigned free port (unless `port` is
 * given) bound to loopback only, and resolve once it is listening with the
 * server instance and the URL it is reachable at.
 */
export function startServer(rootDir, { port = 0, host = '127.0.0.1' } = {}) {
  const server = createStaticServer(rootDir);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      const address = server.address();
      const url = `http://${host}:${address.port}/`;
      resolve({ server, url });
    });
  });
}
