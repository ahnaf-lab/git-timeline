import { execFileSync } from 'node:child_process';

// Non-printable separators that cannot appear in a `%format` field or a
// commit subject, so the raw log can be split back into records reliably
// even when commit messages contain arbitrary text.
export const RECORD_SEP = '\x01';
export const FIELD_SEP = '\x02';
export const HEADER_END = '\x03';

/**
 * Run `git log -p` for a single file and return the raw output.
 *
 * Uses execFileSync with an argv array (never a shell string), and puts
 * `--` before the pathspec so a file name that looks like a flag can never
 * be interpreted as one.
 */
export function runGitLog(repoDir, filePath) {
  const format = `${RECORD_SEP}%H${FIELD_SEP}%an${FIELD_SEP}%ae${FIELD_SEP}%ad${FIELD_SEP}%s${HEADER_END}`;
  const args = [
    'log',
    '--reverse',
    '--date=iso-strict',
    `--format=${format}`,
    '-p',
    '--',
    filePath,
  ];
  return execFileSync('git', args, {
    cwd: repoDir,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });
}
