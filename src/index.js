import path from 'node:path';
import { runGitLog } from './gitLog.js';
import { parseCommits } from './parseLog.js';
import { buildFrames } from './frames.js';

/**
 * Resolve `filePath` relative to `repoDir` and refuse anything that would
 * escape the repository (e.g. `../../etc/passwd`), since filePath usually
 * comes straight from a CLI argument.
 */
export function resolveSafePath(repoDir, filePath) {
  const repoRoot = path.resolve(repoDir);
  const target = path.resolve(repoRoot, filePath);
  if (target !== repoRoot && !target.startsWith(repoRoot + path.sep)) {
    throw new Error(`refusing to read path outside repository: ${filePath}`);
  }
  return path.relative(repoRoot, target) || '.';
}

/**
 * Build the deterministic per-commit blame timeline for one file: an
 * ordered list of frames, oldest commit first, each a full snapshot of the
 * file's lines tagged with authorship.
 */
export function buildTimeline(repoDir, filePath) {
  const safePath = resolveSafePath(repoDir, filePath);
  const raw = runGitLog(repoDir, safePath);
  const commits = parseCommits(raw);
  const frames = buildFrames(commits);
  return { file: safePath, frameCount: frames.length, frames };
}

export { buildFrames } from './frames.js';
export { parseCommits } from './parseLog.js';
export { emitFrames } from './emit.js';
