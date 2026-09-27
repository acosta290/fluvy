#!/usr/bin/env node
/**
 * Interaction tests of swiping between a dashboard's views, in a real Chromium with a touch screen, on the
 * playground's phone (`?swipe=1`: the shell's swipe engine on a stand-in for `hui-root`). Exit code 1 on any failure.
 *   node interactions-swipe.mjs            (expects the playground dev server on :5183)
 * What it proves: a drag to the left opens the next tab and one to the right the previous, the view following the
 * finger on the way; a short drag springs back, a flick turns the page however short; past the last tab the view
 * pulls against a rubber band and stays; a drag that begins on a ruler sets the lamp and never turns the page; a
 * scroll stays a scroll; a touch at the screen's edge, a person who turned the gesture off and a right-to-left page
 * each do as they should; with reduced motion the page still turns; nothing is left on the view once it has settled.
 */
import { between, swipe } from './lib/gestures.mjs';
import { BASE, calls, reset, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** The phone on the playground, with a touch screen; `extra` adds to the query. */
const open = async (extra = '', { reduced = false } = {}) => {
  const page = await suite.browser.newPage({
    viewport: { width: 480, height: 860 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  });
  await page.goto(`${BASE}?swipe=1&lang=en${extra}`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(600);
  return page;
};

const view = (page) => page.locator('.pg-phone').getAttribute('data-view');
const transform = (page) =>
  page.evaluate(
    () =>
      document.querySelector('.pg-phone__root').shadowRoot.querySelector('.pg-view').style
        .transform,
  );
const settled = async (page) => {
  await page.waitForTimeout(700);
  return transform(page);
};

/**
 * A drag from `from` to `to`; slow (a hold before letting go) unless `flick` (its moves go as fast as the protocol
 * carries them). Waits for what letting go starts: the leaving view's slide (160 ms) and the navigation behind it.
 */
const drag = async (page, from, to, options = {}) => {
  await swipe(page, from, to, options);
  await page.waitForTimeout(400);
};

/** A point on the view's plain ground: its side gutter, beside the cards, whatever the view holds. */
const ground = async (page) => {
  const box = await page.locator('.pg-phone__root').boundingBox();
  return { x: box.x + 8, y: box.y + box.height / 2 };
};

/** The middle of a card's body on the page. */
const middle = async (page, selector) => {
  const box = await page.locator(selector).first().boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

/* ---------- turning the pages ---------- */
{
  const page = await open();
  check('the phone opens on the first view', (await view(page)) === 'home', await view(page));
  const at = await ground(page);
  await drag(page, at, { x: at.x - 200, y: at.y });
  check('a drag to the left opens the next view', (await view(page)) === 'lights');
  check('the view settles with nothing left on it', (await settled(page)) === '');
  await drag(page, at, { x: at.x + 200, y: at.y });
  check('a drag to the right opens the previous one', (await view(page)) === 'home');
  await settled(page);

  // where a finger really lands: on a tile, whose tap must not fire on the way
  await reset(page);
  const tile = await middle(
    page,
    '.pg-phone fluvy-tile-card[data-name="Porch"], .pg-phone fluvy-tile-card',
  );
  await drag(page, tile, { x: tile.x - 200, y: tile.y });
  const fired = await calls(page);
  check('a drag that starts on a tile turns the page', (await view(page)) === 'lights');
  check(
    'and never taps the tile',
    fired.length === 0,
    fired.map((c) => c.s).join(', ') || 'no calls',
  );
  await settled(page);
  await drag(page, at, { x: at.x + 200, y: at.y });
  await settled(page);

  // a short, slow drag: the view follows the finger, then springs back
  const short = [at, ...between(at, { x: at.x - 50, y: at.y }, 5)];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [short[0]] });
  for (const point of short.slice(1)) {
    await page.waitForTimeout(24);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  }
  await page.waitForTimeout(120);
  const following = await transform(page);
  check('the view follows the finger', /translate3d\(-50px/.test(following), following);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  check('a short drag springs back', (await view(page)) === 'home' && (await settled(page)) === '');

  await drag(page, at, { x: at.x - 70, y: at.y }, { steps: 3, flick: true });
  check('a flick turns the page however short', (await view(page)) === 'lights');
  await page.close();
}

/* ---------- the last page pulls against a rubber band ---------- */
{
  const page = await open();
  const at = await ground(page);
  await drag(page, at, { x: at.x - 200, y: at.y });
  await settled(page);
  await drag(page, at, { x: at.x - 200, y: at.y });
  await settled(page);
  check('the last view is reached', (await view(page)) === 'energy');
  const pull = [at, ...between(at, { x: at.x - 200, y: at.y }, 8)];
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pull[0]] });
  for (const point of pull.slice(1)) {
    await page.waitForTimeout(20);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
  }
  await page.waitForTimeout(100);
  const shown = Math.abs(Number(/-?[\d.]+/.exec(await transform(page))?.[0] ?? 0));
  check(
    'past the last view the pull shows less than the finger moved',
    shown > 0 && shown < 120,
    `${shown}px`,
  );
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  check('and the view stays', (await view(page)) === 'energy' && (await settled(page)) === '');
  await page.close();
}

/* ---------- what is not a swipe ---------- */
{
  const page = await open();
  const at = await ground(page);
  await drag(page, at, { x: at.x - 200, y: at.y });
  await settled(page);
  check('on the lights', (await view(page)) === 'lights');
  await reset(page);
  const ruler = await page.locator('.pg-phone fluvy-light-card .fv-ruler').first().boundingBox();
  const on = { x: ruler.x + ruler.width * 0.5, y: ruler.y + ruler.height / 2 };
  await drag(page, on, { x: on.x - 120, y: on.y });
  const made = await calls(page);
  check(
    'a drag on a ruler sets the lamp',
    made.some((c) => c.s === 'light.turn_on'),
    made.map((c) => c.s).join(', ') || 'no calls',
  );
  check(
    'and never turns the page',
    (await view(page)) === 'lights' && (await settled(page)) === '',
  );

  // a scroll: the drag leans vertical
  await drag(page, at, { x: at.x - 30, y: at.y - 200 });
  check('a scroll stays a scroll', (await view(page)) === 'lights' && (await settled(page)) === '');

  // the system's back gesture: a touch at the screen's edge
  await drag(page, { x: 10, y: at.y }, { x: 260, y: at.y });
  check('a touch at the screen edge is left to the system', (await view(page)) === 'lights');
  await page.close();
}

/* ---------- the preference, the writing direction, reduced motion ---------- */
{
  const page = await open('&pref=off');
  const at = await ground(page);
  await drag(page, at, { x: at.x - 200, y: at.y });
  check(
    'a person who turned it off keeps the tabs',
    (await view(page)) === 'home' && (await settled(page)) === '',
  );
  await page.close();
}
{
  const page = await open('&dir=rtl');
  const at = await ground(page);
  await drag(page, at, { x: at.x + 200, y: at.y });
  check('right to left, a drag to the right opens the next view', (await view(page)) === 'lights');
  await page.close();
}
{
  const page = await open('', { reduced: true });
  const at = await ground(page);
  await drag(page, at, { x: at.x - 200, y: at.y });
  check(
    'with reduced motion the page still turns',
    (await view(page)) === 'lights' && (await settled(page)) === '',
  );
  await page.close();
}

await suite.finish();
