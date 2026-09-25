/**
 * Apply one commit's diff hunks to the previous line state, producing the
 * next line state. Each line carries the metadata of the commit that most
 * recently touched it; lines outside any hunk keep their existing tag.
 */
function applyHunks(prevLines, hunks, meta) {
  let cursor = 0; // 0-based index into prevLines
  const next = [];

  for (const hunk of hunks) {
    const startIdx = hunk.oldStart === 0 ? 0 : hunk.oldStart - 1;
    while (cursor < startIdx && cursor < prevLines.length) {
      next.push(prevLines[cursor]);
      cursor++;
    }
    for (const hunkLine of hunk.lines) {
      if (hunkLine.type === ' ') {
        next.push(prevLines[cursor] ?? makeLine(hunkLine.text, meta));
        cursor++;
      } else if (hunkLine.type === '-') {
        cursor++;
      } else if (hunkLine.type === '+') {
        next.push(makeLine(hunkLine.text, meta));
      }
    }
  }

  while (cursor < prevLines.length) {
    next.push(prevLines[cursor]);
    cursor++;
  }

  return next;
}

function makeLine(text, meta) {
  return { text, commit: meta.hash, author: meta.author, date: meta.date };
}

/**
 * Walk an ordered (oldest-first) list of parsed commits and produce one
 * blame frame per commit: a full snapshot of the file's lines, each tagged
 * with the commit that last authored it.
 */
export function buildFrames(commits) {
  let lines = [];
  const frames = [];

  for (const commit of commits) {
    if (!commit.binary) {
      lines = applyHunks(lines, commit.hunks, commit);
    }
    frames.push({
      commit: {
        hash: commit.hash,
        author: commit.author,
        email: commit.email,
        date: commit.date,
        subject: commit.subject,
      },
      binary: commit.binary,
      lines: lines.map((line) => ({ ...line })),
    });
  }

  return frames;
}
