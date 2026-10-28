/**
 * Frame capture and encoding for the clips. Chromium's screencast (CDP) hands over one lossless PNG per paint with
 * its timestamp; the frames are written as they come and encoded afterwards by the system's ffmpeg, each shown for
 * exactly as long as it was on screen. A hairline stays a hairline: nothing is compressed twice. A loop is shot frame
 * by frame instead, on the animations' own clock, so it ends where it began.
 *
 *   const { frames, times } = await record(page, { dir }, async () => { …the gesture… });
 *   const { frames, times } = await loop(page, { dir, seconds: 1.8, fps: 25, clip });
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
 * Records a loop on the page's own clock rather than the screen's: every animation on the page (through the shadow
 * roots) is held, and for each of the loop's frames, `fps` a second over `seconds`, set to that moment of its life and
 * the page shot within `clip` (CSS pixels, at the page's device scale: a 2× page gives 2× frames). An animation that
 * runs for ever is retimed by the least that makes it run a whole number of times in the loop, so the last frame leads
 * into the first with no jump; `turns` says, by animation name, how many times its picture comes back in one run of it
 * (twelve rays, every other one shorter, are the same again a sixth of a turn on: `{ 'fc-spin': 6 }`). `retime: false`
 * leaves each at its own pace (a loop of scenes that cut from one to the next). `before(t)` runs ahead of the frame at
 * `t` seconds (a reading changed); what it starts begins there. What had finished before the loop (a card's entrance)
 * is left as it is. Returns the frames, their times in seconds and the most any animation was retimed, as a fraction
 * of its pace.
 */
export async function loop(page, { dir, seconds, fps, clip, turns = {}, retime = true, before }) {
  await mkdir(dir, { recursive: true });
  const count = Math.round(seconds * fps);
  const length = (count / fps) * 1000;
  const frames = [];
  const times = [];
  let retimed = 0;
  for (let i = 0; i < count; i++) {
    const t = i / fps;
    if (before) await before(t);
    retimed = Math.max(
      retimed,
      await page.evaluate(
        ([now, length, turns, retime]) => {
          const clock = (window.fluvyLoopClock ??= new Map());
          const all = [];
          const walk = (root) => {
            all.push(...root.getAnimations());
            for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot);
          };
          walk(document);
          let most = 0;
          for (const animation of all) {
            let held = clock.get(animation);
            if (!held) {
              if (animation.playState === 'finished') continue;
              const { duration, iterations } = animation.effect.getComputedTiming();
              const period = duration / (turns[animation.animationName] ?? 1);
              const runs = Math.max(1, Math.round(length / period));
              const pace = retime && iterations === Infinity ? (runs * period) / length : 1;
              animation.pause();
              held = { born: now, pace };
              clock.set(animation, held);
            }
            animation.currentTime = (now - held.born) * held.pace;
            most = Math.max(most, Math.abs(held.pace - 1));
          }
          return most;
        },
        [t * 1000, length, turns, retime],
      ),
    );
    const file = join(dir, `f${String(i).padStart(5, '0')}.png`);
    await page.screenshot({ path: file, clip });
    frames.push(file);
    times.push(t);
  }
  return { frames, times, retimed };
}

/**
 * Encodes the frames: an H.264 mp4 (every frame, at the captured size) and a GIF (`gifFps`, `gifWidth` pixels wide,
 * a palette computed from what changes). `crop` is `{ x, y, width, height }` in frame pixels; the last frame is
 * held `tailMs`. `hairline` (a colour, `0xRRGGBB`) draws a screen's one-pixel edge round the GIF, inside its width.
 * A loop's frames (`rate`, frames a second) are read as the sequence they are, every one as long: the GIF has exactly
 * its frames, at that pace, and comes round with no frame held. Throws when the GIF is over `maxGifKb`.
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
  maxGifKb = 600,
  tailMs = 600,
  hairline,
  rate,
}) {
  if (frames.length < 2) throw new Error(`only ${frames.length} frame(s) were captured`);
  const dir = join(frames[0], '..');
  let input;
  if (rate) input = ['-framerate', String(rate), '-i', join(dir, 'f%05d.png')];
  else {
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
    input = ['-f', 'concat', '-safe', '0', '-i', concat];
  }
  // a loop keeps its own pace, frame for frame
  const pace = (wanted) => `fps=${rate ?? wanted}`;
  const even = (v) => Math.floor(v / 2) * 2;
  const box = `crop=${even(crop.width)}:${even(crop.height)}:${Math.round(crop.x)}:${Math.round(crop.y)}`;
  const outputs = [];
  if (mp4) {
    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      ...input,
      '-vf',
      `${pace(fps)},${box},format=yuv420p`,
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
    const edge = hairline ? 1 : 0;
    const width = even(gifWidth ?? crop.width) - 2 * edge;
    const frame = hairline ? `,pad=iw+2:ih+2:1:1:color=${hairline}` : '';
    await run('ffmpeg', [
      '-y',
      '-loglevel',
      'error',
      ...input,
      '-filter_complex',
      `${pace(gifFps)},${box},scale=${width}:-2:flags=lanczos${frame},split[a][b];[a]palettegen=max_colors=256:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
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
