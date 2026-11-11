#!/usr/bin/env node
/**
 * A finger on the sliders (#166), on Chromium's touch screen: on the playground's `slider-styles` sheet a swipe up that
 * starts on a light card's ruler, on a large tile's, on a fill tile or on the Slider card's scrolls the page and calls
 * nothing — nor does one that sets off more up than across, nor one on an off light (it is not woken); a finger that
 * slides along each of them still sets its value and sends it once, a tap on the scale still goes there and a tap on
 * a fill is still the tile's tap. On a stepper's half (the Slider card's, the thermostat's dial), a swipe up steps
 * nothing and a tap steps once. The touches are the browser's own (`Input.dispatchTouchEvent`): its scroll takes the
 * gesture as it would on a phone. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-touch.mjs
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

/** A sheet on the touch screen, and the finger on it. */
async function sheet(name) {
  const page = await context.newPage();
  await page.goto(`${BASE}?sheet=${name}&width=360`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(900);
  const cdp = await context.newCDPSession(page);
  const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  return {
    page,
    scrollY: () => page.evaluate(() => Math.round(window.scrollY)),
    /** A finger from `from` to `to` in `steps` moves, a frame apart, then lifted. */
    async swipe(from, to, steps = 12) {
      await touch('touchStart', [from]);
      for (let i = 1; i <= steps; i++) {
        await touch('touchMove', [
          { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps },
        ]);
        await page.waitForTimeout(16);
      }
      await touch('touchEnd', []);
    },
    /** A finger set down and lifted where it was. */
    async tap(at) {
      await touch('touchStart', [at]);
      await page.waitForTimeout(60);
      await touch('touchEnd', []);
    },
    /**
     * `part` of a frame's card (its `n`th; its slider band by default), brought to the middle of the screen: a point
     * `f` along it, and the value its slider stands at.
     */
    async surface({ title, tag, n = 0, part = 'fluvy-ruler .fv-ruler' }) {
      const card = frame(page, title).locator(tag).nth(n);
      const target = card.locator(part).first();
      await target.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await settle(page, 300);
      const box = await target.boundingBox();
      const ruler = card.locator('fluvy-ruler .fv-ruler').first();
      return {
        at: (f) => ({ x: box.x + box.width * f, y: box.y + box.height / 2 }),
        value: async () =>
          (await ruler.count()) ? Number(await ruler.getAttribute('aria-valuenow')) : null,
      };
    },
  };
}

/** A swipe up from `where` (`start` along it, `across` px sideways as it goes): the page scrolls, nothing is called. */
async function scrolls(on, name, where, start, across = 0) {
  const it = await on.surface(where);
  await reset(on.page);
  const before = await on.scrollY();
  const value = await it.value();
  const from = it.at(start);
  await on.swipe(from, { x: from.x + across, y: from.y - 220 });
  await settle(on.page, 1000); // past a stepper's burst
  const scrolled = (await on.scrollY()) - before;
  const called = await calls(on.page);
  const now = await it.value();
  check(
    `a swipe up from ${name} scrolls the page and calls nothing`,
    scrolled > 60 && called.length === 0 && now === value,
    `scrolled ${scrolled} · ${said(called)} · ${value} → ${now}`,
  );
}

const LIGHT = { title: 'Light card · full · Ruler', tag: 'fluvy-light-card' };
const LARGE = { title: 'Tiles · Ruler and Bar', tag: 'fluvy-tile-card' };
const FILL = { title: 'Tiles · Liquid and Fill', tag: 'fluvy-tile-card', n: 1 };
const SLIDER = { title: 'Slider card · Ruler', tag: 'fluvy-slider-card' };
const brightness = (call) => call.s === 'light.turn_on' && call.d.brightness_pct;
const volume = (call) =>
  call.s === 'media_player.volume_set' && Math.round(call.d.volume_level * 100);

/* ---------- the sliders ---------- */
{
  const on = await sheet('slider-styles');

  // a swipe up that starts on a slider scrolls the page, and calls nothing
  for (const [name, where, start, across] of [
    ['a light card’s ruler', LIGHT, 0.3],
    [
      'an off light’s ruler, which it does not wake',
      { ...LIGHT, title: 'Off and unavailable · Ruler' },
      0.5,
    ],
    ['a large tile’s ruler', LARGE, 0.4],
    ['a fill tile, which it neither taps nor sets', FILL, 0.5],
    ['the Slider card’s ruler', SLIDER, 0.6],
    ['a light card’s ruler, more up than across', LIGHT, 0.3, 120],
  ])
    await scrolls(on, name, where, start, across);

  // along the slider, a finger still slides: the value it lands on, sent once
  for (const [name, where, from, to, sent] of [
    ['a light card’s ruler', LIGHT, 0.3, 0.6, brightness],
    ['a large tile’s ruler', LARGE, 0.6, 0.3, brightness],
    ['a fill tile', FILL, 0.3, 0.5, brightness],
    ['the Slider card’s ruler', SLIDER, 0.4, 0.5, volume],
  ]) {
    const it = await on.surface(where);
    await reset(on.page);
    const before = await on.scrollY();
    const value = await it.value();
    const expected = Math.min(100, Math.max(0, value + Math.round((to - from) * 100)));
    await on.swipe(it.at(from), it.at(to), 14);
    await settle(on.page, 500);
    const called = await calls(on.page);
    check(
      `a finger sliding along ${name} sets ${expected} and sends it once, the page still`,
      called.length === 1 && sent(called[0]) === expected && (await on.scrollY()) === before,
      `${value} → ${said(called)}`,
    );
  }

  // a finger's taps: the scale goes there, a fill is the tile's tap
  const light = await on.surface(LIGHT);
  await reset(on.page);
  await on.tap(light.at(0.25));
  await settle(on.page, 500);
  let called = await calls(on.page);
  check(
    'a tap on a ruler’s scale goes there',
    called.length === 1 && brightness(called[0]) === 25,
    said(called),
  );
  const fill = await on.surface(FILL);
  await reset(on.page);
  await on.tap(fill.at(0.5));
  await settle(on.page, 500);
  called = await calls(on.page);
  check(
    'a tap on a fill tile is the tile’s tap (its toggle)',
    called.length === 1 && called[0].s === 'light.turn_off',
    said(called),
  );
  await on.page.close();
}

/* ---------- the steppers: the template's (the Slider card's) and the dial's (the thermostat's) ---------- */
for (const [name, sheetName, where, service] of [
  [
    'the Slider card',
    'slider-card',
    { title: 'Volume · full', tag: 'fluvy-slider-card' },
    'media_player.volume_set',
  ],
  [
    'the thermostat',
    'climate',
    { title: 'Heat', tag: 'fluvy-thermostat-card' },
    'climate.set_temperature',
  ],
]) {
  const on = await sheet(sheetName);
  const plus = { ...where, part: '.fv-stepper__half >> nth=1' };
  await scrolls(on, `${name}’s +, which steps nothing`, plus, 0.5);
  const half = await on.surface(plus);
  await reset(on.page);
  await on.tap(half.at(0.5));
  await settle(on.page, 1000);
  const called = await calls(on.page);
  check(
    `a tap on ${name}’s + steps once`,
    called.length === 1 && called[0].s === service,
    said(called),
  );
  await on.page.close();
}

await context.close();
await suite.finish();
