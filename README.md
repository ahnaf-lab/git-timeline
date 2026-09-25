# git-timeline

A `git timeline` plugin that turns a file's git history into an offline,
scrubbable view of its blame: drag a slider and every line's authorship and
age repaint frame by frame, like scrubbing a video.

This milestone builds the core frame model: walking `git log -p` for one file
into a deterministic, per-commit blame snapshot. A future milestone serves
this data over Node's built-in `http` module as a local, offline web view —
no external server or network access.

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

This prints JSON describing one "frame" per commit that touched the file,
oldest first. Each frame is a full snapshot of the file's lines at that
point in history, and every line is tagged with the hash, author, and date
of the commit that most recently changed it:

```json
{
  "file": "path/to/file",
  "frameCount": 2,
  "frames": [
    {
      "commit": { "hash": "...", "author": "...", "date": "...", "subject": "..." },
      "binary": false,
      "lines": [
        { "text": "...", "commit": "...", "author": "...", "date": "..." }
      ]
    }
  ]
}
```

Frame generation is deterministic: running it twice against the same history
produces byte-identical output.

### Library

```js
import { buildTimeline } from './src/index.js';

const timeline = buildTimeline(process.cwd(), 'path/to/file');
```

### Known limitations (this milestone)

- Rename tracking (`--follow`) is not yet implemented; history stops at the
  most recent rename of the given path, matching plain `git log` behavior.
- Binary files are detected and skipped (frames mark `binary: true`) rather
  than diffed line by line.

## Status

Built autonomously and gated on passing tests: every change here only ships
after `npm test` passes.
