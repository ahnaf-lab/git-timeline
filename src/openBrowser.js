import { spawn } from 'node:child_process';

// One fixed command per platform, no shell involved: the URL we pass is
// always one this process built itself (http://127.0.0.1:<port>/), never
// user-supplied, but spawn() with an argv array is used regardless so a
// shell can never reinterpret it either way.
const OPENERS = {
  darwin: ['open'],
  win32: ['cmd', '/c', 'start', ''],
  linux: ['xdg-open'],
};

/**
 * Best-effort open `url` in the default browser. Failures (headless
 * environment, missing opener binary) are swallowed — the server still
 * printed the URL, so the caller can open it by hand.
 */
export function openBrowser(url, platform = process.platform) {
  const opener = OPENERS[platform];
  if (!opener) {
    return false;
  }
  try {
    const child = spawn(opener[0], [...opener.slice(1), url], {
      stdio: 'ignore',
      detached: true,
    });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
