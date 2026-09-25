# git-timeline

A `git timeline` plugin that turns a file's git history into an offline,
scrubbable view of its blame: drag a slider and every line's authorship and
age repaint frame by frame, like scrubbing a video.

Frame generation emits that history as static JSON: one file per frame plus
a manifest, each line tagged with the author and how many days old it is as
of that frame. A static HTML/CSS/JS viewer reads that JSON and lets you drag
a slider through the file's history. Running `git timeline <file>` builds
that data, serves it over Node's built-in `http` module bound to
`127.0.0.1`, and opens it in your default browser — no external server, no
network access, nothing installed beyond Node and git.

## Install

Requires Node.js 18+ and `git` on your `PATH`. No external dependencies.

```sh
npm install
```

## Usage

Run against any file tracked in a git repository:

```sh
node bin/git-timeline.js path/to/file
```

This builds the file's blame history, writes the static frame data and
viewer into a temporary directory, starts a local HTTP server on an
OS-assigned free port bound to `127.0.0.1`, prints the URL, and opens it in
your default browser. Drag the scrub bar at the bottom to step through each
commit that touched the file; every line repaints with its author and is
colored by how many days old it is (blue = just changed, orange = old), with
full attribution on hover. Press `Ctrl+C` to stop the server, which also
removes the temporary directory.

Flags:

- `--out <dir>` — write the frame data and viewer into `<dir>` instead of a
  temporary directory (kept after the server stops).
- `--port <n>` — bind to a specific port instead of an OS-assigned one.
- `--no-open` — start the server and print the URL, but don't launch a
  browser.
- `--no-serve` — write the frame data and viewer to `--out <dir>` and exit
  immediately, without starting a server. Useful for generating a directory
  to deploy or serve some other way.
- `--json` — skip the server entirely and print the full timeline as one
  JSON document to stdout, for scripting.

### Scripting output

Pass `--json` to get one combined document describing one "frame" per commit that touched the file,
oldest first. Each frame is a full snapshot of the file's lines at that
point in history, and every line is tagged with the hash and author of the
commit that most recently changed it, plus its `age`: how many whole days
old that line is as of the frame's own commit date (`0` if the line was
introduced or last changed by this very commit):

```json
{
  "file": "path/to/file",
  "frameCount": 2,
  "frames": [
    {
      "commit": { "hash": "...", "author": "...", "date": "...", "subject": "..." },
      "binary": false,
      "lines": [
        { "text": "...", "commit": "...", "author": "...", "date": "...", "age": 0 }
      ]
    }
  ]
}
```

Frame generation is deterministic: running it twice against the same history
produces byte-identical output.

### Static per-frame output

Each frame is written to its own JSON file, alongside a `manifest.json` that
lists them in playback order:

```
data/
  manifest.json        # { file, frameCount, frames: [{ file, commit, binary, lineCount }] }
  frame-000000.json    # full { commit, binary, lines } snapshot for frame 0
  frame-000001.json
  ...
```

This is the shape the scrub-bar viewer steps through frame by frame as the
slider moves, without parsing every frame's lines up front. The viewer
itself (`index.html`, `viewer.css`, `viewer.js`, `render.js`) is written into
the same directory. It can't be opened directly as a `file://` URL because
browsers block `fetch()` of local files under that scheme — that's what
`git timeline`'s built-in server (above) is for.

### Library

```js
import { buildTimeline } from './src/index.js';
import { emitFrames } from './src/emit.js';
import { emitViewer } from './src/emitViewer.js';
import { startServer } from './src/serve.js';

const timeline = buildTimeline(process.cwd(), 'path/to/file');
const manifest = emitFrames(timeline, 'data/');
emitViewer('data/');
const { server, url } = await startServer('data/');
console.log(`serving ${manifest.file} at ${url}`);
```

### Known limitations (this milestone)

- Rename tracking (`--follow`) is not yet implemented; history stops at the
  most recent rename of the given path, matching plain `git log` behavior.
- Binary files are detected and skipped (frames mark `binary: true`) rather
  than diffed line by line.
- The server only binds to `127.0.0.1` and only serves the generated frame
  data and viewer assets from the output directory; it is not a general
  static file server and makes no outbound network calls.

## Status

Built autonomously and gated on passing tests: every change here only ships
after `npm test` passes.
