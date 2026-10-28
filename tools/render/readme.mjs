#!/usr/bin/env node
/**
 * The README's pictures, every one drawn by the playground (the real cards on the simulated house, the clock pinned;
 * never a real home), written as WebP to `docs/images/readme/`. The README lays them in rows of one, two or three on
 * one edge, GitHub's README column of 822: a picture is that edge over its row's count wide, saved at twice that,
 * and padded at the bottom in its page's colour to the row's tallest, so a row has one height.
 *
 *   node tools/render/readme.mjs                     every picture (the playground at $PLAYGROUND, else :5183)
 *   node tools/render/readme.mjs --only hero,app-desktop
 *   --url http://127.0.0.1:5183/  --out docs/images/readme
 *
 * Three kinds of picture:
 *   frame  one of a sheet's frames alone on the page's colour, drawn at the picture's width less a margin a side and
 *          captured at 2×: a CSS pixel is a pixel as shown, nothing is resampled
 *   stage  a sheet's frames in one row (the hero), scaled to the picture's width with the same margin as shown
 *   page   a screen of the app (a dashboard, the settings panel, a page) at its viewport, scaled to the picture's
 *          width; `whole` names the cards the screen's bottom edge must not cut: they are left out, and the picture
 *          is held to the cards kept
 * The motion pictures are `clip.mjs`'s GIFs; a still that sits beside one is drawn at the clip's aspect.
 *
 * A screen wears a hairline round its edge. WebP through the system's ffmpeg (libwebp, quality 90). Exit code 1 when
 * a page throws, a frame is not on its sheet, or a picture is over its budget.
 */
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import { parseArgs, launchOptions, PLAYGROUND } from './lib.mjs';

const run = promisify(execFile);

const args = parseArgs(process.argv.slice(2), {
  only: '',
  url: PLAYGROUND,
  out: 'docs/images/readme',
});

/** The moment every sheet shows (Thursday 17 September 2026, 21:47): the README says the same time as the clips. */
const AT = '2026-09-17T21:47:12';
/** GitHub's README column on a desktop: every row of pictures is this wide. */
const EDGE = 822;
/** The page's colour around a picture's cards, as shown: a pair's cards are drawn at the design's 360. */
const MARGIN = (EDGE / 2 - 360) / 2;
/** Each picture's weight at most, by its row's count. */
const BUDGET_KB = { 1: 150, 2: 70, 3: 50 };
/**
 * A screen's edge (a page, a dashboard): GitHub's own hairline, one pixel as shown, so a white header still ends where
 * the page around it begins. `clip.mjs` draws the same around the screens it records.
 */
const HAIRLINE = '0xd1d9e0';
const HAIRLINE_PX = 2;
/** The house's charts in the README: soft, the style the hero shows. */
const SOFT = { style: 'soft' };

/**
 * Every still, by file name: `frame` is `sheet/title` (as `[data-frame]` names it; `nth` one of its cards), `stage` a
 * sheet, `page` the playground's query. `mode` (light), `lang` (en), `charts` (the house's chart settings, the
 * factory's when absent).
 */
const SHOTS = {
  hero: { stage: 'hero', width: 420, gap: 32, charts: SOFT },
  'app-desktop': {
    page: 'dashboard=showcase&frame=1&width=341',
    viewport: [1440, 756],
    charts: SOFT,
  },
  'app-tablet-light': { page: 'dashboard=showcase&width=456', viewport: [1024, 756], charts: SOFT },
  'app-tablet-dark': {
    page: 'dashboard=showcase&width=456',
    viewport: [1024, 756],
    mode: 'dark',
    charts: SOFT,
  },
  'control-cover': { frame: 'devices-motion/Blinds' },
  'control-vacuum': { frame: 'devices-motion/Vacuum' },
  'control-printer': { frame: 'printer/Bambu Lab · printing' },
  'control-whites': { frame: 'lights/Whites from a candle to a cool one' },
  'energy-period': { frame: 'usage/Following', charts: SOFT },
  'energy-flow': { frame: 'flow/Two roofs, two batteries' },
  'energy-sankey': { frame: 'sankey/Where it went · as approved' },
  'cameras-light': { frame: 'cameras/Cameras · live, two at once' },
  'cameras-dark': { frame: 'cameras/Cameras · live, two at once', mode: 'dark' },
  'chart-light': { frame: 'chart/Chart · Nordpool', charts: SOFT },
  'chart-dark': { frame: 'chart/Chart · Nordpool', mode: 'dark', charts: SOFT },
  'chart-soft': { frame: 'chart-styles/Style · soft' },
  'chart-columns': { frame: 'chart-styles/Style · columns' },
  'gauge-liquid': { frame: 'animated/Moving · liquid', nth: 2 },
  'gauge-tank': { frame: 'animated/Moving · tank', nth: 2 },
  'gauge-battery': { frame: 'animated/Moving · battery', nth: 2 },
  web: { frame: 'web/Plate · a map' },
  items: { frame: 'items/Items · tiles' },
  appliance: { frame: 'appliances/Miele · washer rinsing, named' },
  alerts: { frame: 'alerts/Rows · compact' },
  activity: { page: 'activity=1&live=0', viewport: [600, 750] },
  'panel-charts': { page: 'panel=charts', viewport: [1200, 900], whole: '.pn-card', charts: SOFT },
  'lang-en': { page: 'dashboard=showcase&width=348&views=4', viewport: [412, 756], charts: SOFT },
  'lang-pt-PT': {
    page: 'dashboard=showcase&width=348&views=4',
    viewport: [412, 756],
    mode: 'dark',
    lang: 'pt-PT',
    charts: SOFT,
  },
  'lang-ja': {
    page: 'dashboard=showcase&width=348&views=4',
    viewport: [412, 756],
    lang: 'ja',
    charts: SOFT,
  },
};

/** The README's rows, in its order; a still beside a clip is a row of its own here (`activity`: history-scrub.gif). */
const ROWS = [
  ['hero'],
  ['app-desktop'],
  ['app-tablet-light', 'app-tablet-dark'],
  ['control-cover', 'control-vacuum'],
  ['control-printer', 'control-whites'],
  ['energy-period'],
  ['energy-flow', 'energy-sankey'],
  ['cameras-light', 'cameras-dark'],
  ['chart-light', 'chart-dark'],
  ['chart-soft', 'chart-columns'],
  ['gauge-liquid', 'gauge-tank', 'gauge-battery'],
  ['web', 'items'],
  ['appliance', 'alerts'],
  ['activity', 'history-scrub.gif'],
  ['panel-charts'],
  ['lang-en', 'lang-pt-PT', 'lang-ja'],
];

for (const name of Object.keys(SHOTS))
  if (!ROWS.some((row) => row.includes(name))) throw new Error(`${name} is in no row`);
const wanted = args.only ? args.only.split(',') : Object.keys(SHOTS);
for (const name of wanted)
  if (!SHOTS[name])
    throw new Error(`Unknown picture "${name}". Known: ${Object.keys(SHOTS).join(', ')}`);

/** The playground's address for a shot: its own query on the house's moment, palette, mode and language. */
function address(shot, query) {
  const params = new URLSearchParams(query);
  params.set('at', AT);
  params.set('palette', 'linen');
  params.set('mode', shot.mode ?? 'light');
  params.set('lang', shot.lang ?? 'en');
  if (shot.charts) params.set('charts', JSON.stringify(shot.charts));
  return `${args.url}?${params}`;
}

/** The palette's page colour in this mode, as ffmpeg writes a colour (`0xRRGGBB`). */
const pageColour = (page) =>
  page.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.color = 'var(--fluvy-page)';
    document.body.append(probe);
    const [r, g, b] = getComputedStyle(probe).color.match(/\d+/g).map(Number);
    probe.remove();
    return `0x${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  });

/**
 * The screen of a page whose cards the line at `bottom` must not cut: every element matching `selector` (through the
 * shadow roots) that the line cuts is left out, and the screen is held to the cards kept, their left margin on every
 * side but the top.
 */
const wholeCards = (page, selector, bottom) =>
  page.evaluate(
    ([selector, bottom]) => {
      const kept = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.matches(selector)) {
            const box = el.getBoundingClientRect();
            if (box.bottom > bottom) el.style.opacity = '0';
            else kept.push(box);
          }
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      const margin = Math.min(...kept.map((box) => box.left));
      return {
        x: 0,
        y: 0,
        width: Math.ceil(Math.max(...kept.map((box) => box.right)) + margin),
        height: Math.ceil(Math.max(...kept.map((box) => box.bottom)) + margin),
      };
    },
    [selector, bottom],
  );

/** A shot as a PNG at 2× of `width` (frames) or larger (stages, pages), with its page's colour. */
async function capture(browser, name, shot, width, dir) {
  const [vw, vh] = shot.viewport ?? [Math.max(1280, width + 64), 1000];
  const page = await browser.newPage({
    viewport: { width: vw, height: vh },
    deviceScaleFactor: 2,
    colorScheme: shot.mode === 'dark' ? 'dark' : 'light',
    reducedMotion: 'reduce',
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  const png = join(dir, `${name}.png`);
  if (shot.frame) {
    const [sheet] = shot.frame.split('/');
    const inner = width - 2 * MARGIN;
    await page.goto(address(shot, { sheet, width: String(inner) }));
    await page.waitForSelector('html[data-ready="1"]');
    const frame = `[data-frame=${JSON.stringify(shot.frame)}]`;
    if (!(await page.locator(frame).count())) throw new Error(`${name}: no frame ${shot.frame}`);
    // the frame alone, at the picture's width, its cards on the page's colour with the margin around them
    await page.addStyleTag({
      content: `body { background: var(--fluvy-page); }
.pg-stage { display: block; padding: 0; }
.pg-stage > :not(${frame}) { display: none; }
${frame} { width: ${inner}px !important; padding: ${MARGIN}px; background: none; box-shadow: none; border-radius: 0; }
${shot.nth ? `${frame} > :not(:nth-child(${shot.nth})) { display: none; }` : ''}`,
    });
    await page.waitForTimeout(shot.wait ?? 1500);
    await page.locator(frame).screenshot({ path: png });
  } else if (shot.stage) {
    await page.goto(address(shot, { sheet: shot.stage, width: String(shot.width) }));
    await page.waitForSelector('html[data-ready="1"]');
    const style = (pad) =>
      page.addStyleTag({
        content: `body { background: var(--fluvy-page); }
.pg-stage { gap: ${shot.gap}px; padding: ${pad}px; width: max-content; flex-wrap: nowrap; justify-content: flex-start; align-items: flex-start; }
.pg-frame { padding: 0; background: transparent; box-shadow: none; border-radius: 0; }
[data-stress] { display: none; }`,
      });
    await style(0);
    const stage = page.locator('.pg-stage');
    const inner = (await stage.boundingBox()).width;
    // the margin that shows as MARGIN once the stage is scaled to the picture's width
    await style(Math.round((MARGIN * inner) / (width - 2 * MARGIN)));
    const box = await stage.boundingBox();
    await page.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
    await page.waitForTimeout(shot.wait ?? 1500);
    await stage.screenshot({ path: png });
  } else {
    await page.goto(address(shot, shot.page));
    await page.waitForSelector('html[data-ready="1"]');
    await page.waitForTimeout(shot.wait ?? 1800);
    const clip = shot.whole
      ? await wholeCards(page, shot.whole, vh)
      : { x: 0, y: 0, width: vw, height: vh };
    await page.screenshot({ path: png, clip });
  }
  const colour = await pageColour(page);
  await page.close();
  if (errors.length) throw new Error(`${name}: the page reported errors\n  ${errors.join('\n  ')}`);
  return { png, colour };
}

/** A PNG's size, from its header. */
async function size(png) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0',
    png,
  ]);
  const [width, height] = stdout.trim().split(',').map(Number);
  return { width, height };
}

const out = resolve(args.out);
await mkdir(out, { recursive: true });
const dir = await mkdtemp(join(tmpdir(), 'fluvy-readme-'));
const browser = await chromium.launch(launchOptions);
let failed = false;

for (const row of ROWS) {
  const stills = row.filter((name) => SHOTS[name] && wanted.includes(name));
  if (!stills.length) continue;
  const width = EDGE / row.length;
  const pixels = 2 * width;
  try {
    // every still of the row at the row's width (a screen inside its hairline), then padded to its tallest
    const shots = [];
    for (const name of stills) {
      const { png, colour } = await capture(browser, name, SHOTS[name], width, dir);
      const { width: w, height: h } = await size(png);
      const screen = Boolean(SHOTS[name].page);
      const inner = screen ? pixels - 2 * HAIRLINE_PX : pixels;
      const drawn = Math.round((h * inner) / w);
      shots.push({ name, png, colour, screen, inner, drawn, height: drawn + pixels - inner });
    }
    const height = Math.max(...shots.map((shot) => shot.height));
    for (const shot of shots) {
      const file = join(out, `${shot.name}.webp`);
      const hairline = shot.screen
        ? `,pad=${pixels}:${shot.height}:${HAIRLINE_PX}:${HAIRLINE_PX}:color=${HAIRLINE}`
        : '';
      await run('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-i',
        shot.png,
        '-vf',
        `scale=${shot.inner}:${shot.drawn}:flags=lanczos${hairline},pad=${pixels}:${height}:0:0:color=${shot.colour}`,
        '-c:v',
        'libwebp',
        '-quality',
        '90',
        '-compression_level',
        '6',
        file,
      ]);
      const kb = (await stat(file)).size / 1024;
      const budget = BUDGET_KB[row.length];
      const over = kb > budget;
      if (over) failed = true;
      console.log(
        `${over ? '✗' : '✓'} ${shot.name}.webp ${pixels}×${height} ${kb.toFixed(0)} KB${over ? ` (over ${budget} KB)` : ''}`,
      );
    }
  } catch (error) {
    failed = true;
    console.error(`✗ ${stills.join(', ')}: ${error.message}`);
  }
}

await browser.close();
await rm(dir, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
