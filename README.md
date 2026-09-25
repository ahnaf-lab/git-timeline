# git-timeline

A `git timeline` plugin that turns a file's git history into an offline,
scrubbable view of its blame: drag a slider and every line's authorship and
age repaint frame by frame, like scrubbing a video.

This milestone emits that frame model as static JSON: one file per frame plus
a manifest, each line tagged with the author and how many days old it is as
of that frame. A future milestone serves this data over Node's built-in
`http` module as a local, offline web view — no external server or network
access.

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

Pass `--out <dir>` to write each frame to its own JSON file instead of
printing one combined document, alongside a `manifest.json` that lists them
in playback order:

```sh
node bin/git-timeline.js path/to/file --out data/
```

```
data/
  manifest.json        # { file, frameCount, frames: [{ file, commit, binary, lineCount }] }
  frame-000000.json    # full { commit, binary, lines } snapshot for frame 0
  frame-000001.json
  ...
```

This is the shape a static web view can step through frame by frame as a
scrub bar moves, without parsing every frame's lines up front.

### Library

```js
import { buildTimeline } from './src/index.js';
import { emitFrames } from './src/emit.js';

const timeline = buildTimeline(process.cwd(), 'path/to/file');
const manifest = emitFrames(timeline, 'data/');
```

### Known limitations (this milestone)

- Rename tracking (`--follow`) is not yet implemented; history stops at the
  most recent rename of the given path, matching plain `git log` behavior.
- Binary files are detected and skipped (frames mark `binary: true`) rather
  than diffed line by line.

## Status

Built autonomously and gated on passing tests: every change here only ships
after `npm test` passes.
