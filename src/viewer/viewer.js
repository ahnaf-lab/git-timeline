// Browser glue for the scrub-bar viewer: wires the scrub <input type="range">
// up to the pure rendering helpers in render.js and fetches the static
// manifest/frame JSON emitted alongside this file by `git timeline --out`.
//
// Deliberately has no build step and no bundler: this file and render.js are
// copied verbatim into the output directory and loaded as native ES modules,
// so the whole viewer works offline with nothing but a static file server.
import { renderFrameHtml, formatFrameCaption } from './render.js';

const frameCache = new Map();
let manifest = null;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`failed to load ${url}: HTTP ${res.status}`);
  }
  return res.json();
}

async function loadFrame(entry) {
  const cached = frameCache.get(entry.file);
  if (cached) return cached;
  const frame = await fetchJson(entry.file);
  frameCache.set(entry.file, frame);
  return frame;
}

async function showFrame(index) {
  const entry = manifest.frames[index];
  if (!entry) return;
  const frame = await loadFrame(entry);
  document.getElementById('caption').textContent = formatFrameCaption(frame.commit);
  document.getElementById('lines').innerHTML = renderFrameHtml(frame);
  document.getElementById('frame-position').textContent =
    `${index + 1} / ${manifest.frameCount}`;
}

function wireScrubBar() {
  const slider = document.getElementById('scrub');
  const lastIndex = Math.max(manifest.frameCount - 1, 0);
  slider.min = '0';
  slider.max = String(lastIndex);
  slider.value = String(lastIndex);
  slider.disabled = manifest.frameCount <= 1;
  slider.addEventListener('input', () => {
    showFrame(Number(slider.value));
  });
  return lastIndex;
}

async function init() {
  manifest = await fetchJson('manifest.json');
  document.getElementById('file-name').textContent = manifest.file;
  const startIndex = wireScrubBar();
  await showFrame(startIndex);
}

init().catch((err) => {
  const caption = document.getElementById('caption');
  if (caption) caption.textContent = `error: ${err.message}`;
});
