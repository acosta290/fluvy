/**
 * Frame capture and encoding for the clips. Chromium's screencast (CDP) hands over one lossless PNG per paint with
 * its timestamp; the frames are written as they come and encoded afterwards by the system's ffmpeg, each shown for
 * exactly as long as it was on screen. A hairline stays a hairline: nothing is compressed twice.
 *
 *   const { frames, times } = await record(page, { dir }, async () => { …the gesture… });
 *   await encode({ frames, times, crop, mp4: 'out.mp4', gif: 'out.gif', gifWidth: 360 });
 */
import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** ffmpeg must be on the PATH (with libx264): says so plainly when it is not. */
export async function ffmpegVersion() {
  try {
    const { stdout } = await run('ffmpeg', ['-version']);
    const line = stdout.split('\n')[0] ?? '';
    if (!stdout.includes('--enable-libx264')) throw new Error('ffmpeg is built without libx264');
    return line;
  } catch (error) {
    throw new Error(`ffmpeg is needed to encode the clips (${error.message})`, { cause: error });
  }
}

/**
 * Records every paint of `page` while `action` runs. Frames land in `dir` as PNG; `times` are the compositor's
 * timestamps in seconds; `scale` is frame pixels per CSS pixel (the device scale factor, as the screencast delivers it).
 */
export async function record(page, { dir }, action) {
  await mkdir(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const times = [];
  const writes = [];
  let scale = 1;
  let n = 0;
  cdp.on('Page.screencastFrame', ({ data, sessionId, metadata }) => {
    // acknowledge first: Chromium sends the next frame only once this one is taken
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
    const file = join(dir, `f${String(n++).padStart(5, '0')}.png`);
    const png = Buffer.from(data, 'base64');
    if (n === 1) scale = pngWidth(png) / metadata.deviceWidth;
    writes.push(writeFile(file, png));
    frames.push(file);
    times.push(metadata.timestamp);
  });
  await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
  try {
    await action();
  } finally {
    await cdp.send('Page.stopScreencast').catch(() => undefined);
    await Promise.all(writes);
    await cdp.detach().catch(() => undefined);
  }
  return { frames, times, scale };
}

/** A PNG's width, from its IHDR chunk. */
const pngWidth = (png) => png.readUInt32BE(16);

/**
 * Encodes the frames: an H.264 mp4 (every frame, at the captured size) and a GIF (`gifFps`, `gifWidth` pixels wide,
 * a palette computed from what changes). `crop` is `{ x, y, width, height }` in frame pixels; the last frame is
 * held `tailMs`. Throws when the GIF is over `maxGifKb`.
 */
export async function encode({
  frames,
  times,
  crop,
  mp4,
  gif,
  fps = 30,
  gifFps = 20,
  gifWidth,
  maxGifKb = 4096,
  tailMs = 600,
}) {
  if (frames.length < 2) throw new Error(`only ${frames.length} frame(s) were captured`);
  const dir = join(frames[0], '..');
  const list = [`ffconcat version 1.0`];
  for (let i = 0; i < frames.length; i++) {
    const next = i + 1 < frames.length ? times[i + 1] : times[i] + tailMs / 1000;
    const duration = Math.max(0.001, next - times[i]);
    list.push(`file '${frames[i]}'`, `duration ${duration.toFixed(4)}`);
  }
  // the concat demuxer drops the last duration unless the last file is named once more
  list.push(`file '${frames[frames.length - 1]}'`);
  const concat = join(dir, 'frames.txt');
  await writeFile(concat, list.join('\n') + '\n');
  const even = (v) => Math.floor(v / 2) * 2;
  const box = `crop=${even(crop.width)}:${even(crop.height)}:${Math.round(crop.x)}:${Math.round(crop.y)}`;
  const outputs = [];
  if (mp4) {
    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concat,
      '-vf',
      `fps=${fps},${box},format=yuv420p`,
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '18',
      '-movflags',
      '+faststart',
      '-an',
      mp4,
    ]);
    outputs.push(mp4);
  }
  if (gif) {
    const width = even(gifWidth ?? crop.width);
    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concat,
      '-filter_complex',
      `fps=${gifFps},${box},scale=${width}:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
      '-loop',
      '0',
      gif,
    ]);
    const { stdout } = await run('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=size',
      '-of',
      'csv=p=0',
      gif,
    ]);
    const kb = Number(stdout.trim()) / 1024;
    if (kb > maxGifKb)
      throw new Error(`${gif} is ${kb.toFixed(0)} KB, over the ${maxGifKb} KB budget`);
    outputs.push(gif);
  }
  return outputs;
}
