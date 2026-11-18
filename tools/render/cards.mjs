#!/usr/bin/env node
/**
 * The cards' pictures in the docs (#199): each card's example from the gallery (`tools/docs/src/gallery.ts`), its
 * base and each of its other layouts, drawn by the playground's `gallery` sheet on the demo house at the pinned
 * moment, in light and in dark, written as WebP to `docs/images/cards/<card>-<mode>.webp` (a layout's
 * `<card>.<layout>-<mode>.webp`) with the manifest `pictures.json` beside them (`pictures.ts`: what each is of, and
 * its size). A full card is drawn at the design's 360 in its section's 16 px margin, so its picture shows 392 wide,
 * saved at 2×; a half card's picture is its own column in the same margin. Quality 80. A card's base is written once
 * more as the index's thumbnail, `thumbs/<card>-<mode>.webp`: fitted in one size for every card (never enlarged), on
 * the page's colour.
 *
 * A picture is rewritten only where it differs from the one in the folder beyond a renderer's own noise (more than
 * CHANGED of its pixels moved by more than SHIFT), or where its size or its example changed: the history grows only
 * where a card's look did. Without `--only`, the pictures of no example of the gallery are removed. The pictures are
 * the same on any machine: the page and this process read one clock, ZONE's, whatever `TZ` says.
 *
 *   pnpm docs:images                         every card (the playground at $PLAYGROUND, else :5183)
 *   pnpm docs:images -- --only tile,lights   those cards, each with its layouts
 *   --url http://127.0.0.1:5183/  --out docs/images/cards
 *
 * Exit code 1 when a page throws or an example's frame is not on the sheet.
 */
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import {
  digest,
  FOLDER,
  MANIFEST,
  MODES,
  pictureName,
  pictureStem,
  THUMB,
  thumbStem,
} from '../docs/src/pictures.ts';
import { launchOptions, parseArgs, PLAYGROUND } from './lib.mjs';

/**
 * The zone the pictures are drawn in, the page's and this process's alike: the gallery's moment is 21:50 on the clock
 * of whoever reads it, so the two must read one clock for it to be one instant (a process in UTC held the page's
 * clock two hours past the cards' own, and a camera's and a timer's pictures were of another evening).
 */
const ZONE = 'Europe/Madrid';
process.env.TZ = ZONE;
// read once the clock is ZONE's: the gallery works its moment out as it loads
const { drawn, GALLERY, MOMENT, mounted, shortName } = await import('../docs/src/gallery.ts');

const run = promisify(execFile);

const args = parseArgs(process.argv.slice(2), { only: '', url: PLAYGROUND, out: FOLDER });

/** A section's width, the design's: a full card's. */
const SECTION = 360;
/** The section's margin round its cards, kept round the picture. */
const MARGIN = 16;
/** How long a card is given to draw once its frame is on screen (a camera's still). */
const SETTLE = 900;
/** A pixel moved when one of its channels moved by more than this; a picture changed when more than CHANGED did. */
const SHIFT = 40;
const CHANGED = 1 / 4000;

/** Every example of the gallery as it is drawn, a card's base then each of its other layouts: a picture each. */
const examples = Object.entries(GALLERY).flatMap(([tag, example]) => {
  const short = shortName(tag);
  return drawn(tag, example).map((one) => ({
    short,
    stem: pictureStem(short, one.layout),
    // the base is the card's thumbnail too
    ...(one.layout ? {} : { thumb: thumbStem(short) }),
    frame: `gallery/${one.name}`,
    example: digest(mounted(one)),
  }));
});
const shorts = [...new Set(examples.map(({ short }) => short))];
const wanted = args.only ? args.only.split(',') : shorts;
for (const short of wanted)
  if (!shorts.includes(short))
    throw new Error(`Unknown card "${short}". Known: ${shorts.join(', ')}`);

/** The gallery in a mode, on the house's palette and language, its clock pinned. */
const address = (mode) =>
  `${args.url}?${new URLSearchParams({ sheet: 'gallery', width: String(SECTION), at: MOMENT, palette: 'linen', mode, lang: 'en' })}`;

/** A picture's pixels (RGB) and its size, as ffmpeg decodes it; none where there is no file. */
async function decode(file) {
  try {
    const [{ stdout: size }, { stdout: rgb }] = await Promise.all([
      run('ffprobe', [
        '-v',
        'error',
        '-show_entries',
        'stream=width,height',
        '-of',
        'csv=p=0',
        file,
      ]),
      run('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {
        encoding: 'buffer',
        maxBuffer: 1 << 26,
      }),
    ]);
    const [width, height] = size.trim().split(',').map(Number);
    return { width, height, rgb };
  } catch {
    return undefined;
  }
}

/** Whether a new picture shows what the old one does, but for a renderer's noise. */
function same(before, after) {
  if (!before || before.width !== after.width || before.height !== after.height) return false;
  let moved = 0;
  for (let i = 0; i < after.rgb.length; i += 3)
    if (
      Math.abs(after.rgb[i] - before.rgb[i]) > SHIFT ||
      Math.abs(after.rgb[i + 1] - before.rgb[i + 1]) > SHIFT ||
      Math.abs(after.rgb[i + 2] - before.rgb[i + 2]) > SHIFT
    )
      moved += 1;
  return moved <= after.width * after.height * CHANGED;
}

/** A thumbnail of a picture, as ffmpeg makes it: fitted in THUMB, never enlarged, the rest in `colour`. */
const fitted = (colour) => [
  '-vf',
  `scale=w='min(iw,${THUMB.width})':h='min(ih,${THUMB.height})':force_original_aspect_ratio=decrease:flags=lanczos,pad=${THUMB.width}:${THUMB.height}:(ow-iw)/2:(oh-ih)/2:color=${colour}`,
];

const out = resolve(args.out);
await mkdir(out, { recursive: true });
const manifestFile = join(out, MANIFEST);
const manifest = JSON.parse(await readFile(manifestFile, 'utf8').catch(() => '{}'));
const dir = await mkdtemp(join(tmpdir(), 'fluvy-cards-'));
const browser = await chromium.launch(launchOptions);
const started = Date.now();
const written = [];
let failed = false;

/**
 * A screenshot written as the picture `name` of the folder, through `filter` where it is not the shot as it is: over
 * the one there only where it shows something else, or where `known` says the one there is of another example. Its
 * size is the answer.
 */
async function put(png, name, { filter = [], known = true } = {}) {
  const next = join(dir, name);
  await mkdir(dirname(next), { recursive: true });
  await run('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    png,
    ...filter,
    '-c:v',
    'libwebp',
    '-quality',
    '80',
    '-compression_level',
    '6',
    next,
  ]);
  const after = await decode(next);
  const kept = known && same(await decode(join(out, name)), after);
  if (!kept) {
    await mkdir(dirname(join(out, name)), { recursive: true });
    await copyFile(next, join(out, name));
    written.push(name);
  }
  console.log(
    `${kept ? '·' : '✓'} ${name} ${after.width}×${after.height}${kept ? ' (as it was)' : ''}`,
  );
  return { width: after.width, height: after.height };
}

for (const mode of MODES) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    deviceScaleFactor: 2,
    colorScheme: mode,
    reducedMotion: 'reduce',
    timezoneId: ZONE,
  });
  // the page's clock held at the moment, so a running timer or a camera's clock reads the same in every picture
  await context.clock.setFixedTime(new Date(MOMENT));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.goto(address(mode));
  await page.waitForSelector('html[data-ready="1"]', { timeout: 120_000 });
  // every frame as a dashboard's section shows its cards, on the page's colour and without the sheet's outline; each is
  // taken where it stands, laid out from the start at its width (a card hidden and shown again may not fit afresh)
  await page.addStyleTag({
    content: `body { background: var(--fluvy-page); }
.pg-frame { background: var(--fluvy-page); box-shadow: none; border-radius: 0; }`,
  });
  for (const { stem, thumb, frame: title, example } of examples.filter(({ short }) =>
    wanted.includes(short),
  )) {
    const frame = page.locator(`[data-frame=${JSON.stringify(title)}]`);
    if (!(await frame.count())) {
      console.error(`✗ ${stem}: no frame ${title} on the sheet`);
      failed = true;
      continue;
    }
    // on screen, what loads only there (a camera's stills) loads
    await frame.scrollIntoViewIfNeeded();
    await page.waitForTimeout(SETTLE);
    await page.evaluate(() => document.fonts.ready);
    const box = await frame.boundingBox();
    const card = await frame.locator(':scope > *').first().boundingBox();
    // a half card's picture ends a margin past its column
    const width = Math.round(card.x + card.width + MARGIN - box.x);
    const png = join(dir, `${stem}-${mode}.png`);
    await page.screenshot({ path: png, clip: { x: box.x, y: box.y, width, height: box.height } });
    const size = await put(png, pictureName(stem, mode), {
      known: manifest[stem]?.example === example,
    });
    manifest[stem] = { example, ...size };
    if (thumb) {
      // the frame's own colour as ffmpeg names one (0xRRGGBB): the page's in its mode, what the thumbnail stands on
      const colour = await frame.evaluate((element) => {
        const [red = 0, green = 0, blue = 0] = (
          getComputedStyle(element).backgroundColor.match(/\d+/g) ?? []
        ).map(Number);
        return `0x${[red, green, blue].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
      });
      await put(png, pictureName(thumb, mode), { filter: fitted(colour) });
    }
  }
  if (errors.length) {
    console.error(`✗ ${mode}: the page reported errors\n  ${[...new Set(errors)].join('\n  ')}`);
    failed = true;
  }
  await context.close();
}
await browser.close();
await rm(dir, { recursive: true, force: true });

// the manifest in the gallery's order; without --only, nothing of an example that is gone
const stems = examples.map(({ stem }) => stem);
const ordered = Object.fromEntries(
  stems.filter((stem) => manifest[stem]).map((stem) => [stem, manifest[stem]]),
);
await writeFile(manifestFile, `${JSON.stringify(ordered, null, 2)}\n`);
if (!args.only) {
  const pictures = new Set(
    examples
      .flatMap(({ stem, thumb }) => [stem, ...(thumb ? [thumb] : [])])
      .flatMap((stem) => MODES.map((mode) => pictureName(stem, mode))),
  );
  for (const file of await readdir(out, { recursive: true }))
    if (file.endsWith('.webp') && !pictures.has(file)) {
      await rm(join(out, file));
      console.log(`− ${file} (no example)`);
    }
}
console.log(
  `${written.length} written, the rest as they were, in ${((Date.now() - started) / 1000).toFixed(0)} s`,
);
process.exitCode = failed ? 1 : 0;
