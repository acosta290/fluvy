#!/usr/bin/env node
/**
 * Hold to slide (#166), on Chromium's touch screen with the person's setting on (`&hold=1`): on the playground's
 * `slider-styles` sheet a quick tap on a ruler's scale moves nothing, a swipe up still scrolls the page and calls
 * nothing, and a finger that slides at once along a ruler moves nothing; a finger held still first, then slid, sets
 * the value and sends it once on a light card's ruler, a large tile's, a bar, a liquid, a fill tile, the Slider card's
 * and the cover's vertical ruler — and, held, it keeps the page still when it wanders up and across. The ruler's fine
 * scale comes 450 ms after the slider is armed, a fill tile's quick tap is still the tile's tap, and a mouse drags at
 * once as it always did. On the climate sheet a swipe up that starts on the thermostat's knob scrolls the page (it lets
 * the page pan while the setting is on) and a held knob turns. The touches are the browser's own
 * (`Input.dispatchTouchEvent`): its scroll takes the gesture as it would on a phone. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-hold.mjs
 */
import { BASE, calls, frame, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const context = await suite.browser.newContext({
  hasTouch: true,
  isMobile: true,
  viewport: { width: 390, height: 844 },
});

const said = (called) => JSON.stringify(called.map((c) => [c.s, c.d]));

/** A sheet on the touch screen with hold to slide on, and the finger on it. */
async function sheet(name) {
  const page = await context.newPage();
  await page.goto(`${BASE}?sheet=${name}&width=360&hold=1`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(900);
  const cdp = await context.newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  /** A finger set down at `from`, held still `hold` ms, moved to `to` in `steps` moves a frame apart, lifted. */
  const slide = async (from, to, hold = 0, steps = 12) => {
    await touch('touchStart', [from]);
    if (hold) await page.waitForTimeout(hold);
    for (let i = 1; i <= steps; i++) {
      await touch('touchMove', [
        { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps },
      ]);
      await page.waitForTimeout(16);
    }
    await touch('touchEnd', []);
  };
  return {
    page,
    touch,
    slide,
    scrollY: () => page.evaluate(() => Math.round(window.scrollY)),
    /**
     * `part` of a frame's card (its `n`th; its slider band by default), brought to the middle of the screen: a point
     * `f` along it, and the value its slider stands at.
     */
    async surface({ title, tag, n = 0, part = 'fluvy-ruler .fv-ruler', vertical = false }) {
      const card = frame(page, title).locator(tag).nth(n);
      const target = card.locator(part).first();
      await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await settle(page, 300);
      const box = await target.boundingBox();
      const ruler = card.locator('fluvy-ruler .fv-ruler').first();
      return {
        card,
        at: (f) =>
          vertical
            ? { x: box.x + box.width / 2, y: box.y + box.height * (1 - f) }
            : { x: box.x + box.width * f, y: box.y + box.height / 2 },
        value: async () =>
          (await ruler.count()) ? Number(await ruler.getAttribute('aria-valuenow')) : null,
      };
    },
  };
}

const LIGHT = { title: 'Light card · full · Ruler', tag: 'fluvy-light-card' };
const LARGE = { title: 'Tiles · Ruler and Bar', tag: 'fluvy-tile-card' };
const BAR = { title: 'Light card · full · Bar', tag: 'fluvy-light-card' };
const LIQUID = { title: 'Light card · full · Liquid', tag: 'fluvy-light-card' };
const FILL = { title: 'Tiles · Liquid and Fill', tag: 'fluvy-tile-card', n: 1 };
const SLIDER = { title: 'Slider card · Ruler', tag: 'fluvy-slider-card' };
const COVER = { title: 'Cover · vertical · Ruler', tag: 'fluvy-cover-card', vertical: true };
const brightness = (call) => call.s === 'light.turn_on' && call.d.brightness_pct;
const volume = (call) =>
  call.s === 'media_player.volume_set' && Math.round(call.d.volume_level * 100);
const position = (call) => call.s === 'cover.set_cover_position' && call.d.position;

/* ---------- the sliders ---------- */
{
  const on = await sheet('slider-styles');

  // a quick tap on the scale moves nothing: with the protection on, a tap never jumps a slider
  {
    const it = await on.surface(LIGHT);
    await reset(on.page);
    const value = await it.value();
    await on.slide(it.at(0.25), it.at(0.25), 0, 1);
    await settle(on.page, 500);
    const called = await calls(on.page);
    check(
      'a quick tap on a ruler’s scale moves nothing',
      called.length === 0 && (await it.value()) === value,
      `${value} → ${await it.value()} · ${said(called)}`,
    );
  }

  // a swipe up that starts on a slider is still the page's, and a finger that slides along at once moves nothing
  for (const [name, from, to, scrolls] of [
    ['a swipe up from a light card’s ruler scrolls the page and calls nothing', 0.3, null, true],
    ['a finger sliding along a ruler at once (no hold) moves nothing', 0.3, 0.6, false],
  ]) {
    const it = await on.surface(LIGHT);
    await reset(on.page);
    const before = await on.scrollY();
    const value = await it.value();
    const start = it.at(from);
    await on.slide(start, to === null ? { x: start.x, y: start.y - 220 } : it.at(to));
    await settle(on.page, 600);
    const scrolled = (await on.scrollY()) - before;
    const called = await calls(on.page);
    check(
      name,
      called.length === 0 && (await it.value()) === value && (scrolls ? scrolled > 60 : true),
      `scrolled ${scrolled} · ${said(called)} · ${value} → ${await it.value()}`,
    );
  }

  // held still first, then slid: the value it lands on, sent once, the page still
  for (const [name, where, from, to, sent] of [
    ['a light card’s ruler', LIGHT, 0.3, 0.6, brightness],
    ['a large tile’s ruler', LARGE, 0.6, 0.3, brightness],
    ['a bar', BAR, 0.3, 0.5, brightness],
    ['a liquid', LIQUID, 0.5, 0.3, brightness],
    ['a fill tile', FILL, 0.3, 0.5, brightness],
    ['the Slider card’s ruler', SLIDER, 0.4, 0.5, volume],
    ['the cover’s vertical ruler', COVER, 0.5, 0.3, position],
  ]) {
    const it = await on.surface(where);
    await reset(on.page);
    const before = await on.scrollY();
    const value = await it.value();
    const expected = Math.min(100, Math.max(0, value + Math.round((to - from) * 100)));
    await on.slide(it.at(from), it.at(to), 300, 14);
    await settle(on.page, 500);
    const called = await calls(on.page);
    check(
      `a finger held still, then sliding along ${name}, sets ${expected} and sends it once, the page still`,
      called.length === 1 && sent(called[0]) === expected && (await on.scrollY()) === before,
      `${value} → ${said(called)}`,
    );
  }

  // held, the finger is the slider's whichever way it wanders: up and across, the page stays where it was
  {
    const it = await on.surface(LIGHT);
    await reset(on.page);
    const before = await on.scrollY();
    const value = await it.value();
    const from = it.at(0.3);
    await on.slide(from, { x: from.x + 60, y: from.y - 120 }, 300, 14);
    await settle(on.page, 500);
    const called = await calls(on.page);
    const scrolled = (await on.scrollY()) - before;
    check(
      'a held finger that wanders up and across keeps the page still and moves the ruler (slower off its axis)',
      scrolled === 0 && called.length === 1 && brightness(called[0]) > value,
      `scrolled ${scrolled} · ${value} → ${said(called)}`,
    );
  }

  // the fine scale: 450 ms after the slider is armed (650 of one still press), not before
  {
    const it = await on.surface(LIGHT);
    const fine = () =>
      it.card.evaluate((el) => el.shadowRoot.querySelector('fluvy-ruler').fine !== null);
    await on.touch('touchStart', [it.at(0.5)]);
    await on.page.waitForTimeout(450);
    const early = await fine();
    await on.page.waitForTimeout(350);
    const late = await fine();
    await on.touch('touchEnd', []);
    await settle(on.page, 500);
    check(
      'the ruler’s fine scale comes 450 ms after it is armed, not at 450 ms',
      !early && late,
      `450 ms ${early} · 800 ms ${late}`,
    );
  }

  // taps stay taps: a fill tile's quick tap is the tile's (its toggle)
  {
    const fill = await on.surface(FILL);
    await reset(on.page);
    await on.slide(fill.at(0.5), fill.at(0.5), 0, 1);
    await settle(on.page, 500);
    const called = await calls(on.page);
    check(
      'a quick tap on a fill tile is still the tile’s tap (its toggle)',
      called.length === 1 && called[0].s === 'light.turn_off',
      said(called),
    );
  }

  // a mouse never waits
  {
    const it = await on.surface(LIGHT);
    await reset(on.page);
    const value = await it.value();
    const from = it.at(0.5);
    const to = it.at(0.3);
    await on.page.mouse.move(from.x, from.y);
    await on.page.mouse.down();
    await on.page.mouse.move(to.x, to.y, { steps: 8 });
    await on.page.mouse.up();
    await settle(on.page, 500);
    const called = await calls(on.page);
    check(
      'a mouse drags at once, as it always did',
      called.length === 1 && brightness(called[0]) === Math.max(0, value - 20),
      `${value} → ${said(called)}`,
    );
  }
  await on.page.close();
}

/* ---------- the thermostat's knob: it lets the page pan, and turns once held ---------- */
{
  const on = await sheet('climate');
  const card = frame(on.page, 'Heat').locator('fluvy-thermostat-card').first();
  const knob = card.locator('fluvy-dial [data-knob="0"]');
  await knob.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await settle(on.page, 300);
  const centre = async () => {
    const box = await knob.boundingBox();
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  };
  await reset(on.page);
  const before = await on.scrollY();
  const from = await centre();
  await on.slide(from, { x: from.x, y: from.y - 220 });
  await settle(on.page, 1000);
  let called = await calls(on.page);
  const scrolled = (await on.scrollY()) - before;
  check(
    'a swipe up that starts on the thermostat’s knob scrolls the page and turns nothing',
    scrolled > 60 && called.length === 0,
    `scrolled ${scrolled} · ${said(called)}`,
  );
  // held still, then carried round the ring a fifth of its way
  await knob.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await settle(on.page, 300);
  await reset(on.page);
  const dial = await card.locator('fluvy-dial .fv-dial').first().boundingBox();
  const at = await centre();
  const c = { x: dial.x + dial.width / 2, y: dial.y + dial.width / 2 };
  const r = Math.hypot(at.x - c.x, at.y - c.y);
  const a = Math.atan2(at.y - c.y, at.x - c.x) + 0.6;
  await on.slide(at, { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }, 300, 14);
  await settle(on.page, 1000);
  called = await calls(on.page);
  check(
    'a finger held on the thermostat’s knob, then turned, sets the temperature once',
    called.length === 1 && called[0].s === 'climate.set_temperature',
    said(called),
  );
  await on.page.close();
}

await context.close();
await suite.finish();
