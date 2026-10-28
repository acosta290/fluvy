#!/usr/bin/env node
/**
 * The README's motion clips, recorded on the playground (the real cards, the simulated hass, the clock pinned) with
 * the gestures the interaction suites prove: the precision dimmer, the energy flow changing pace, a palette applied
 * in the settings panel, a scrub across the History charts; and the gauges that move, each a loop. Each clip becomes a
 * GIF (what GitHub and HACS show) and an mp4 beside it, in `docs/media/`.
 *
 *   node tools/render/clip.mjs                                 every clip (the playground at $PLAYGROUND, else :5183)
 *   node tools/render/clip.mjs --clip dimmer,palette --out docs/media
 *   --url http://127.0.0.1:5183/  --fps 30  --gif-fps 20  --max-gif-kb 600  --keep-frames 1
 *
 * A gesture's frames are the screencast's, at CSS pixels (Chromium delivers no more, whatever the device scale factor):
 * the GIF is shown at that size and stays crisp; the mp4 is the same picture. A loop is shot frame by frame on the
 * animations' own clock (`lib/capture.mjs` `loop`), at 2× as the README's stills are; its GIF is shown at half that.
 *
 * Exit code 1 when a page throws, a clip cannot find its target, or a GIF is over budget.
 */
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { parseArgs, launchOptions, PLAYGROUND } from './lib.mjs';
import { encode, ffmpegVersion, loop, record } from './lib/capture.mjs';
import {
  driftDrag,
  holdForFine,
  leaveChart,
  relativeDrag,
  rulerGeometry,
  scrubPlot,
} from './lib/gestures.mjs';
import { touchPointer } from './lib/pointer.mjs';

const args = parseArgs(process.argv.slice(2), {
  clip: '',
  url: PLAYGROUND,
  out: 'docs/media',
  fps: '30',
  'gif-fps': '20',
  'max-gif-kb': '600',
  'keep-frames': '0',
});

/** The moment every sheet shows (Thursday 17 September 2026, 21:47): the clips say the same time as the stills. */
const AT = '2026-09-17T21:47:12';

/** The README's box for the dimmer and the flow: a 360 card with 26 of the page's colour a side, the flow's height. */
const PLATE = { width: 412, height: 496 };
/** A screen's edge, as `readme.mjs` draws it round the README's screens: GitHub's own hairline. */
const HAIRLINE = '0xd1d9e0';
/** A row of three in the README (274 of its 822), and the page's colour `readme.mjs` keeps a side of a card. */
const THIRD = 822 / 3;
const MARGIN = (822 / 2 - 360) / 2;
/** The sun's rays: twelve, every other one shorter, the same again a sixth of a turn on. */
const TURNS = { 'fc-spin': 6 };

/** The thermo's scenes, snow, a mild sun, haze and dunes: when each begins in its loop, and its sensor of the frame. */
const THERMO = [
  [0, 'low'],
  [3.2, 'mid'],
  [7.6, 'high'],
  [11, 'extreme'],
];

/**
 * A gauge clip's card on another of its sheet's sensors (`sensor.am_<gauge>_<level>`), drawn: its reading and its
 * window's row are that sensor's.
 */
const reading = (page, clip, level) =>
  page.evaluate(
    async ([selector, level]) => {
      const card = document.querySelector(selector);
      card.setConfig({
        ...card.config,
        entity: card.config.entity.replace(/_[a-z]+$/, `_${level}`),
      });
      await card.updateComplete;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    },
    [`${clip.target} > :nth-child(${clip.nth})`, level],
  );

/**
 * A moving gauge of the `animated` sheet in a row of three: the frame's `nth` card alone on the page's colour, at the
 * row's width less the margin a side, shot at 2× as a loop of `seconds`, `fps` frames a second (a pace GIF delays keep:
 * 10, 12.5, 20 or 25).
 */
const gauge = (title, nth, seconds, fps, more = {}) => ({
  query: `sheet=animated&width=${THIRD - 2 * MARGIN}&palette=linen&lang=en&at=${AT}`,
  viewport: { width: 600, height: 900 },
  target: `[data-frame="animated/Moving · ${title}"]`,
  only: true,
  nth,
  pad: 0,
  loop: { seconds, fps },
  ...more,
});

/**
 * A tap through the pointer: the ring travels there, presses and lets go. A target that is not well clear of the
 * screen's bottom (where the panel's bar floats once a look is tried) is brought to the middle first.
 */
async function tap(pointer, locator, { travel = 12 } = {}) {
  await locator.evaluate((el) => {
    const { top, bottom } = el.getBoundingClientRect();
    if (top < 0 || bottom > innerHeight - 160) el.scrollIntoView({ block: 'center' });
  });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`nothing to tap at ${locator}`);
  await pointer.move(box.x + box.width / 2, box.y + box.height / 2, travel);
  await pointer.wait(140);
  await pointer.down();
  await pointer.wait(90);
  await pointer.up();
}

/**
 * Each clip: the playground query, the viewport, what to crop to (`target`, a selector; the frame's siblings are
 * hidden so it sits alone at the top), how much room around it, and the gesture. A `plate` is the README's box for a
 * frame: the frame alone on the page's colour, its cards centred across the plate's width, cropped to the plate from
 * its top (the dimmer and the flow share one, so they sit side by side at one height). A `screen` (a page) wears a
 * hairline round its GIF, as the README's stills of screens do.
 */
const CLIPS = {
  dimmer: {
    query: `sheet=slider&width=360&at=${AT}`,
    viewport: { width: 600, height: 640 },
    target: '[data-frame="slider/Colour · named custom"]',
    only: true,
    plate: PLATE,
    async run(page, pointer) {
      const card = page.locator(this.target).locator('fluvy-light-card').first();
      const ruler = card.locator('fluvy-ruler').first();
      const geo = await rulerGeometry(ruler.locator('.fv-ruler'), ruler.locator('.fv-knob'));
      await pointer.move(geo.at(30), geo.y + 90);
      await pointer.wait(500);
      // a relative drag: grab anywhere on the scale, the value moves with the finger
      await relativeDrag(pointer, geo, { grab: 30, to: 45, steps: [4, 18] });
      await pointer.wait(800);
      // sliding away from the ruler makes the drag finer; coming back never leaps
      await driftDrag(pointer, geo, {
        from: 85,
        to: 50,
        drift: 60,
        far: 130,
        travel: 24,
        pause: 500,
      });
      await pointer.wait(800);
      // hold before moving: the 1 % scale, anchored under the finger
      await holdForFine(pointer, geo, { hold: 700, travel: 10, steps: 18, settle: 700 });
      await pointer.hide();
      await pointer.wait(500);
    },
  },
  'energy-flow': {
    query: `sheet=flow&width=360&at=${AT}`,
    viewport: { width: 600, height: 720 },
    target: '[data-frame="flow/The #19 house"]',
    only: true,
    plate: PLATE,
    async run(page) {
      // a day on the #19 house: midday, importing on two phases while the third exports; then all sun, the battery
      // filling and the surplus going out; then the evening, the battery running the house — every lane in its
      // origin's colour, the pulses' pace following the power, the arcs sliding to the new mix
      const readings = (solar, l1, l2, l3, battery) =>
        page.evaluate(
          ([s, a, b, c, d]) => {
            window.fluvyMock.set('sensor.fl_solar', s);
            window.fluvyMock.set('sensor.fl_l1', a);
            window.fluvyMock.set('sensor.fl_l2', b);
            window.fluvyMock.set('sensor.fl_l3', c);
            window.fluvyMock.set('sensor.fl_battery', d);
          },
          [solar, l1, l2, l3, battery],
        );
      await page.waitForTimeout(3200);
      await readings('4.8', '-2.1', '100', '0.1', '-1400');
      await page.waitForTimeout(3600);
      await readings('0', '0.1', '150', '0.15', '1200');
      await page.waitForTimeout(3600);
    },
  },
  palette: {
    query: `panel=appearance&at=${AT}`,
    viewport: { width: 1200, height: 750 },
    target: null,
    pad: 0,
    gifWidth: 822,
    // taps between still screens: 15 frames a second hold the README's budget at its width
    gifFps: 15,
    screen: true,
    async run(page, pointer) {
      const swatch = (name) =>
        page.locator('.pn-swatch', { has: page.locator('.pn-swatch__name', { hasText: name }) });
      await pointer.move(640, 560);
      await pointer.wait(400);
      await tap(pointer, swatch('Volt'));
      await pointer.wait(1300);
      await tap(pointer, swatch('Blaze'));
      await pointer.wait(1300);
      await tap(pointer, page.locator('.pn-custom'));
      await pointer.wait(900);
      await tap(pointer, page.locator('.pn-dot').nth(8));
      await pointer.wait(1300);
      await tap(pointer, page.locator('.pn-bar button', { hasText: 'Apply to the house' }));
      await pointer.wait(1600);
      await pointer.hide();
      await pointer.wait(400);
    },
  },
  'history-scrub': {
    // the Activity page's size beside it in the README, the house's charts in soft
    query: `history=1&live=0&lang=en&at=${AT}&charts=${encodeURIComponent(JSON.stringify({ style: 'soft' }))}`,
    viewport: { width: 600, height: 750 },
    target: null,
    pad: 0,
    screen: true,
    async ready(page) {
      await page.waitForFunction(
        () =>
          document.querySelector('fluvy-history')?.shadowRoot?.querySelector('.hs-main') !== null,
        null,
        { timeout: 20000 },
      );
    },
    async run(page, pointer) {
      const box = await page.locator('fluvy-history .hs-plot').first().boundingBox();
      await pointer.move(box.x + box.width * 0.3, box.y + box.height + 80);
      await pointer.wait(500);
      await scrubPlot(pointer, box, { from: 0.3, to: 0.62, steps: 44 });
      await pointer.wait(1200);
      await pointer.move(box.x + box.width * 0.85, box.y + box.height / 2, 36);
      await pointer.wait(1100);
      await leaveChart(pointer, box, { above: 80, steps: 14 });
      await pointer.hide();
      await pointer.wait(900);
    },
  },
  // the gauges that move, each on the design page's value and in a loop that retimes none of its animations by more
  // than 4 %: the waves' 9 s three times and their 14 s twice
  'gauge-liquid': gauge('liquid', 2, 27.2, 12.5),
  // the sky through its four weathers, a sensor each (its window's row its own), the mild one long enough for its cloud
  // to come in: the loop cuts from the dunes to the snow as each scene cuts to the next, so none is retimed
  'gauge-thermo': gauge('thermo', 1, 14.4, 10, {
    retime: false,
    async ready(page) {
      await reading(page, this, 'extreme');
    },
    async at(page, t) {
      const scene = THERMO.find(([from]) => Math.abs(from - t) < 0.01);
      if (scene) await reading(page, this, scene[1]);
    },
  }),
  // a strong wind (46 km/h), its streaks quick enough to want 25 frames a second
  'gauge-air': gauge('air', 3, 5.92, 25),
  // charging at 62 %: the bubbles as fast as it fills, the bolt glowing
  'gauge-battery': gauge('battery', 2, 19.44, 12.5),
  // 1.8 kW: one beat of its rings
  'gauge-pulse': gauge('pulse', 2, 1.8, 20),
  // 5.4 kW: the long rays a third of a turn on, the halo breathing once
  'gauge-sun': gauge('sun', 3, 5.2, 12.5),
};

const wanted = args.clip ? args.clip.split(',') : Object.keys(CLIPS);
for (const name of wanted)
  if (!CLIPS[name])
    throw new Error(`Unknown clip "${name}". Known: ${Object.keys(CLIPS).join(', ')}`);

console.log(await ffmpegVersion());
const out = resolve(args.out);
await mkdir(out, { recursive: true });
const browser = await chromium.launch(launchOptions);
let failed = false;

for (const name of wanted) {
  const clip = CLIPS[name];
  const page = await browser.newPage({
    viewport: clip.viewport,
    deviceScaleFactor: clip.loop ? 2 : 1,
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${args.url}?${clip.query}`);
  await page.waitForSelector('html[data-ready="1"]');
  if (clip.ready) await clip.ready(page);
  await page.waitForTimeout(900);
  let box = { x: 0, y: 0, width: clip.viewport.width, height: clip.viewport.height };
  if (clip.target) {
    const target = page.locator(clip.target).first();
    if (clip.only)
      await target.evaluate((el) => {
        for (const frame of document.querySelectorAll('.pg-frame'))
          if (frame !== el) frame.style.display = 'none';
      });
    // the plate: the frame's cards on the page's colour, as wide as the plate with the same room a side
    if (clip.plate) {
      const cards = await target.evaluate((el) => parseFloat(getComputedStyle(el).width));
      await page.addStyleTag({
        content: `body { background: var(--fluvy-page); }
${clip.target} { padding: ${(clip.plate.width - cards) / 2}px; background: none; box-shadow: none; border-radius: 0; }`,
      });
    }
    // a gauge: the frame's one card on the page's colour, the README's margin a side
    if (clip.nth)
      await page.addStyleTag({
        content: `body { background: var(--fluvy-page); }
${clip.target} { padding: ${MARGIN}px; background: none; box-shadow: none; border-radius: 0; }
${clip.target} > :not(:nth-child(${clip.nth})) { display: none; }`,
      });
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(700);
    const found = await target.boundingBox();
    if (!found) throw new Error(`${name}: ${clip.target} is not on the page`);
    box = found;
  }
  // the crop: the target and its room (or its plate), kept inside the viewport, in frame pixels
  const x0 = clip.plate ? box.x : Math.max(0, box.x - clip.pad);
  const y0 = clip.plate ? box.y : Math.max(0, box.y - clip.pad);
  const x1 = clip.plate
    ? x0 + clip.plate.width
    : Math.min(clip.viewport.width, box.x + box.width + clip.pad);
  const y1 = clip.plate
    ? y0 + clip.plate.height
    : Math.min(clip.viewport.height, box.y + box.height + clip.pad);
  const dir = await mkdtemp(join(tmpdir(), `fluvy-clip-${name}-`));
  // a loop: the target shot at 2×, each frame of the loop at its moment, every frame shown as long; a gesture: the
  // screencast, cropped
  let shot;
  if (clip.loop) {
    const { frames, times, retimed } = await loop(page, {
      dir,
      ...clip.loop,
      clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
      turns: TURNS,
      retime: clip.retime ?? true,
      before: clip.at && ((t) => clip.at(page, t)),
    });
    shot = {
      frames,
      times,
      crop: { x: 0, y: 0, width: 2 * (x1 - x0), height: 2 * (y1 - y0) },
      rate: clip.loop.fps,
      gifWidth: 2 * (x1 - x0),
      said: `a loop of ${frames.length} frames, ${(frames.length / clip.loop.fps).toFixed(2)} s at ${clip.loop.fps} fps, retimed by ${(retimed * 100).toFixed(1)} % at most`,
    };
  } else {
    const pointer = await touchPointer(page);
    const {
      frames,
      times,
      scale: captured,
    } = await record(page, { dir }, () => clip.run(page, pointer));
    const seconds = times.length > 1 ? times[times.length - 1] - times[0] : 0;
    shot = {
      frames,
      times,
      crop: {
        x: x0 * captured,
        y: y0 * captured,
        width: (x1 - x0) * captured,
        height: (y1 - y0) * captured,
      },
      fps: Number(args.fps),
      gifFps: clip.gifFps ?? Number(args['gif-fps']),
      // a screen's hairline goes round its crop, not into it
      gifWidth: clip.gifWidth ?? Math.round(x1 - x0) + (clip.screen ? 2 : 0),
      said: `${frames.length} frames over ${seconds.toFixed(1)} s (${(frames.length / Math.max(seconds, 0.001)).toFixed(0)} fps)`,
    };
  }
  try {
    const outputs = await encode({
      frames: shot.frames,
      times: shot.times,
      crop: shot.crop,
      mp4: join(out, `${name}.mp4`),
      gif: join(out, `${name}.gif`),
      fps: shot.fps,
      gifFps: shot.gifFps,
      gifWidth: shot.gifWidth,
      maxGifKb: Number(args['max-gif-kb']),
      rate: shot.rate,
      hairline: clip.screen ? HAIRLINE : undefined,
    });
    const sizes = await Promise.all(
      outputs.map(
        async (file) =>
          `${file.split('/').pop()} ${((await stat(file)).size / 1024).toFixed(0)} KB`,
      ),
    );
    console.log(`✓ ${name}: ${shot.said} → ${sizes.join(' · ')}`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${name}: ${error.message}`);
  }
  if (errors.length) {
    failed = true;
    console.error(`✗ ${name}: the page reported errors\n  ${errors.join('\n  ')}`);
  }
  if (args['keep-frames'] === '1') console.log(`  frames kept in ${dir}`);
  else await rm(dir, { recursive: true, force: true });
  await page.close();
}

await browser.close();
process.exitCode = failed ? 1 : 0;
