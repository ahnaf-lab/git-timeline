import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = path.join(__dirname, 'viewer');

// Fixed, known set rather than a directory scan: the viewer is exactly these
// four files, and listing them here means emitViewer can't accidentally
// start shipping something unexpected if a stray file ever lands in
// src/viewer/.
const ASSET_FILES = ['index.html', 'viewer.css', 'viewer.js', 'render.js'];

/**
 * Copy the static scrub-bar viewer (HTML/CSS/JS) into `outDir`, alongside
 * the `manifest.json` and `frame-*.json` files written by `emitFrames`. The
 * viewer fetches those files by their well-known relative names, so it must
 * land in the same directory.
 *
 * Returns the list of absolute paths written.
 */
export function emitViewer(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  return ASSET_FILES.map((name) => {
    const dest = path.join(outDir, name);
    fs.copyFileSync(path.join(ASSET_DIR, name), dest);
    return dest;
  });
}
