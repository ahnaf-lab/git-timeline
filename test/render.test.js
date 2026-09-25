import test from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  ageToColor,
  formatFrameCaption,
  renderFrameHtml,
} from '../src/viewer/render.js';

test('escapeHtml neutralizes markup and quote characters', () => {
  assert.equal(
    escapeHtml('<script>alert("hi")</script>'),
    '&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt;',
  );
  assert.equal(escapeHtml("it's & <ok>"), 'it&#39;s &amp; &lt;ok&gt;');
  assert.equal(escapeHtml(''), '');
});

test('ageToColor moves from the newest color toward the oldest as age grows', () => {
  const fresh = ageToColor(0);
  const old = ageToColor(365);
  const veryOld = ageToColor(10_000); // clamps at the same value as 365

  assert.notEqual(fresh, old);
  assert.equal(old, veryOld);
  assert.match(fresh, /^rgb\(\d+, \d+, \d+\)$/);
});

test('formatFrameCaption summarizes a commit into one readable line', () => {
  const caption = formatFrameCaption({
    hash: '1bd1e74bd6f22b5efb8ba15492648f82fe56f5bc',
    author: 'Golden',
    date: '2024-01-01T00:00:00Z',
    subject: 'add sample file',
  });
  assert.match(caption, /^1bd1e74/);
  assert.match(caption, /Golden/);
  assert.match(caption, /2024-01-01/);
  assert.match(caption, /add sample file$/);
});

test('renderFrameHtml escapes line text and tags each row with an age-based color', () => {
  const html = renderFrameHtml({
    binary: false,
    lines: [
      { text: '<img src=x>', author: 'a', date: '2024-01-01T00:00:00Z', age: 0 },
      { text: 'plain line', author: 'b', date: '2023-01-01T00:00:00Z', age: 365 },
    ],
  });

  assert.ok(!html.includes('<img src=x>'), 'raw markup must not survive unescaped');
  assert.ok(html.includes('&lt;img src=x&gt;'));
  assert.equal((html.match(/class="line"/g) || []).length, 2);
  assert.match(html, /border-left-color: rgb\(/);
});

test('renderFrameHtml reports binary frames without attempting a line diff', () => {
  const html = renderFrameHtml({ binary: true, lines: [] });
  assert.match(html, /binary file/);
});

test('renderFrameHtml reports an empty file distinctly from a binary one', () => {
  const html = renderFrameHtml({ binary: false, lines: [] });
  assert.match(html, /empty file/);
});
