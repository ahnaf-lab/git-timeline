import fs from 'node:fs';
import path from 'node:path';

// Zero-padded so filenames sort lexicographically in the same order the
// scrub bar plays them back, without the consumer needing to parse JSON
// first just to find out how many frames there are.
function frameFileName(index) {
  return `frame-${String(index).padStart(6, '0')}.json`;
}

/**
 * Write one static JSON file per frame plus a manifest that lists them in
 * order, so a static web view can fetch `manifest.json` and then step
 * through `frames[i].file` as the scrub bar moves — no single combined
 * payload to parse up front.
 *
 * Returns the manifest object that was written.
 */
export function emitFrames(timeline, outDir) {
  fs.mkdirSync(outDir, { recursive: true });

  const manifest = {
    file: timeline.file,
    frameCount: timeline.frameCount,
    frames: timeline.frames.map((frame, index) => {
      const fileName = frameFileName(index);
      fs.writeFileSync(
        path.join(outDir, fileName),
        `${JSON.stringify(frame, null, 2)}\n`,
      );
      return {
        file: fileName,
        commit: frame.commit,
        binary: frame.binary,
        lineCount: frame.lines.length,
      };
    }),
  };

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  return manifest;
}
