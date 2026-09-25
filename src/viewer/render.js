// Pure rendering helpers for the scrub-bar viewer. No DOM or Node APIs are
// used here, so this module can be imported unmodified by the browser
// viewer (viewer.js, via a plain <script type="module">) and by Node tests,
// keeping the exact same logic under test that ships to the browser.

const NEWEST_COLOR = [88, 166, 255]; // age 0: blue
const OLDEST_COLOR = [255, 138, 88]; // age >= MAX_AGE_DAYS: orange
const MAX_AGE_DAYS = 365; // ages beyond this clamp to the oldest color

// Escape text before inserting it into innerHTML. Line content and commit
// metadata both come from the repository's history, which is not trusted
// input (any contributor could have committed `<script>`), so every value
// rendered into the DOM must go through this first.
export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Map a line's age in days to a color on a fixed blue (new) -> orange (old)
// scale, clamped so very old lines don't all look identical past one year.
export function ageToColor(age) {
  const clamped = Math.max(0, Math.min(Number(age) || 0, MAX_AGE_DAYS));
  const t = clamped / MAX_AGE_DAYS;
  const [r0, g0, b0] = NEWEST_COLOR;
  const [r1, g1, b1] = OLDEST_COLOR;
  const r = Math.round(r0 + (r1 - r0) * t);
  const g = Math.round(g0 + (g1 - g0) * t);
  const b = Math.round(b0 + (b1 - b0) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// One-line caption describing which commit a frame represents.
export function formatFrameCaption(commit) {
  const hash = commit?.hash ? commit.hash.slice(0, 7) : '???????';
  const date = commit?.date ? commit.date.slice(0, 10) : 'unknown date';
  const author = commit?.author ?? 'unknown';
  const subject = commit?.subject ?? '';
  return `${hash} \u00b7 ${author} \u00b7 ${date} \u2014 ${subject}`;
}

// Render one frame's lines as an HTML fragment: each line is a row tinted
// by its age, with full attribution available on hover via `title`.
export function renderFrameHtml(frame) {
  if (!frame || frame.binary) {
    return '<div class="binary-frame">binary file \u2014 no line view</div>';
  }
  if (!frame.lines.length) {
    return '<div class="empty-frame">(empty file)</div>';
  }
  return frame.lines
    .map((line) => {
      const color = ageToColor(line.age);
      const title = escapeHtml(`${line.author} \u2014 ${line.date} (age ${line.age}d)`);
      const text = escapeHtml(line.text);
      return (
        `<div class="line" style="border-left-color: ${color}" title="${title}">` +
        `<span class="line-text">${text.length ? text : '&nbsp;'}</span>` +
        '</div>'
      );
    })
    .join('\n');
}
