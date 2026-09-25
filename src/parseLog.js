import { RECORD_SEP, FIELD_SEP, HEADER_END } from './gitLog.js';

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parse the raw `git log -p` output produced by runGitLog into an ordered
 * list of commit records, oldest first, each carrying the diff hunks that
 * touched the requested file.
 */
export function parseCommits(rawLog) {
  if (!rawLog) return [];
  const records = rawLog.split(RECORD_SEP).slice(1);
  return records.map((record) => {
    const headerEnd = record.indexOf(HEADER_END);
    const header = record.slice(0, headerEnd);
    const diffText = record.slice(headerEnd + 1);
    const [hash, author, email, date, subject] = header.split(FIELD_SEP);
    const { hunks, binary } = parseHunks(diffText);
    return { hash, author, email, date, subject, hunks, binary };
  });
}

function parseHunks(diffText) {
  const lines = diffText.split('\n');
  const hunks = [];
  let current = null;
  let binary = false;

  for (const line of lines) {
    if (line.startsWith('Binary files ')) {
      binary = true;
      continue;
    }
    const match = line.match(HUNK_HEADER);
    if (match) {
      current = {
        oldStart: Number(match[1]),
        newStart: Number(match[3]),
        lines: [],
      };
      hunks.push(current);
      continue;
    }
    if (!current) continue; // diff --git / index / ---/+++/ mode lines
    if (line.startsWith('\\ No newline')) continue;
    const prefix = line[0];
    if (prefix === ' ' || prefix === '+' || prefix === '-') {
      current.lines.push({ type: prefix, text: line.slice(1) });
    }
  }

  return { hunks, binary };
}
