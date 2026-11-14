#!/usr/bin/env node
/**
 * A card's actions, in a real Chromium against the playground's `actions` sheet. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-actions.mjs
 * What it proves: the head is the card's button (#42) — a tap on its circle or its name runs the tap action, a still
 * press anywhere on it the hold action, both more-info by default and anything Home Assistant's actions are when
 * chosen; a hold never also taps (the click that follows is swallowed, on the title and on the icon alike); a hold
 * on a ruler is still its fine scale; a tile's whole surface taps and holds the same way, and a tap set to none does
 * nothing; a large tile taps and holds through its surface while its switch keeps its own tap, and from the keyboard;
 * four large tiles, one unavailable, stand at one height; a card of rows holds on its head and a row runs its own
 * tap; the greeting's avatar taps and holds as an icon; a scene tile runs on a tap and holds without running; a
 * sensor tile's whole surface taps and holds; a tap to be asked about first goes to Home Assistant and moves nothing,
 * and a `fire-dom-event` reaches the page's listeners; a finger's long press on a head (a touch screen, Chromium)
 * holds, selects nothing and never taps; quiet out of reach, a person out of reach loses the dashed ring and one nobody
 * can place keeps it. Double tap and the circle's own actions (#179), on the `taps` sheet: one tap on a tile, a row or
 * a tab with a double tap set waits its 250 ms and runs the tap, two inside them run the double and never the tap, a
 * hold is a hold; a tile's and a head's circle with actions of their own answer them beside the card's surface (a
 * circle that is the tile's switch still flips it), named and reached by the keyboard; Enter twice is a double tap; a
 * finger's two taps are one double tap, never a zoom. `ENGINE=webkit` runs it in WebKit (the long press is Chromium's
 * alone; the finger's double tap is WebKit's own there).
 */
import { holdForFine, mousePointer, rulerGeometry } from './lib/gestures.mjs';
import {
  BASE,
  ENGINE,
  calls,
  frame,
  moreInfo,
  reset,
  settle,
  startSuite,
  tapHead,
} from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** Every navigation the cards ask for (`location-changed`), as the path they went to. */
const watchNavigation = (page) =>
  page.evaluate(() => {
    window.__navigations = [];
    window.addEventListener('location-changed', () =>
      window.__navigations.push(window.location.pathname),
    );
  });
const navigations = (page) => page.evaluate(() => window.__navigations.splice(0));

/** A still press: down, wait, up, without travel. */
async function hold(page, locator, ms = 650) {
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/* ---------- the defaults: more-info on the icon, more-info on a held head ---------- */
{
  const page = await suite.sheet('actions');
  await watchNavigation(page);
  const card = frame(page, 'Defaults').locator('fluvy-light-card');
  await tapHead(card, 'icon');
  await settle(page, 200);
  check('the icon opens the details by default', (await moreInfo(page)).length === 1);
  await reset(page);
  await hold(page, card.locator('.fv-card__title'));
  await settle(page, 300);
  check(
    'a hold on the head opens the details by default',
    (await moreInfo(page)).length === 1 && (await calls(page)).length === 0,
  );
  await reset(page);
  await tapHead(card, 'title');
  await settle(page, 200);
  check(
    'a tap on the title runs the tap action too: the head is the card’s button (#42)',
    (await moreInfo(page)).length === 1 && (await calls(page)).length === 0,
  );
  await reset(page);
  // the ruler's own hold is still its fine scale: the head's hold does not reach it
  const rulerHost = card.locator('fluvy-ruler').first();
  const geo = await rulerGeometry(rulerHost.locator('.fv-ruler'), rulerHost.locator('.fv-knob'));
  const pointer = mousePointer(page);
  let fine = false;
  await holdForFine(pointer, geo, {
    phase: async (name) => {
      if (name !== 'held') return;
      const labels = await card
        .locator('.fv-ruler-labels')
        .first()
        .locator('span')
        .allTextContents();
      fine = labels.length >= 3 && labels.every((t) => /^\d+$/.test(t));
    },
  });
  check(
    'a hold on the ruler is still its fine scale',
    fine && (await navigations(page)).length === 0,
  );
  await page.close();
}

/* ---------- chosen: the icon toggles, a hold goes somewhere ---------- */
{
  const page = await suite.sheet('actions');
  await watchNavigation(page);
  const card = frame(page, 'Toggle and go').locator('fluvy-light-card');
  await tapHead(card, 'icon');
  await settle(page, 300);
  const c = await calls(page);
  check(
    'the icon runs the tap action (toggle → light.turn_off)',
    c.length === 1 && c[0].s === 'light.turn_off',
    JSON.stringify(c.map((x) => x.s)),
  );
  await reset(page);
  await hold(page, card.locator('.fv-card__title'));
  await settle(page, 300);
  const went = await navigations(page);
  check(
    'a hold on the head runs the hold action (navigate)',
    went.length === 1 && went[0] === '/fluvy-auto/rooms',
    went.join(' '),
  );
  check(
    'and never also taps',
    (await calls(page)).length === 0 && (await moreInfo(page)).length === 0,
  );
  await reset(page);
  await hold(page, card.locator('.fv-ico').first());
  await settle(page, 300);
  check(
    'a hold on the icon is the hold, not the tap',
    (await navigations(page)).length === 1 && (await calls(page)).length === 0,
  );
  await page.close();
}

/* ---------- a tile's whole surface ---------- */
{
  const page = await suite.sheet('actions');
  await watchNavigation(page);
  const group = frame(page, 'Tiles').locator('fluvy-tiles-card');
  const heater = group.locator('.fv-tile').nth(0);
  const desk = group.locator('.fv-tile').nth(1);
  await heater.click();
  await settle(page, 300);
  const c = await calls(page);
  check(
    'a tap on a tile toggles',
    c.length === 1 && c[0].s === 'switch.turn_on',
    JSON.stringify(c.map((x) => x.s)),
  );
  await reset(page);
  await hold(page, heater);
  await settle(page, 300);
  check(
    'a hold on a tile navigates and never also toggles',
    (await navigations(page)).length === 1 && (await calls(page)).length === 0,
  );
  await desk.click();
  await settle(page, 200);
  check(
    'a tile whose tap is none does nothing on tap',
    (await calls(page)).length === 0 && (await moreInfo(page)).length === 0,
  );
  await page.close();
}

/* ---------- what Home Assistant answers: a tap asked about first, a frontend integration's event ---------- */
{
  const page = await suite.sheet('actions');
  await page.evaluate(() => {
    window.__handed = [];
    window.__custom = [];
    // where Home Assistant's root and a frontend integration listen
    document.body.addEventListener('hass-action', (event) => window.__handed.push(event.detail));
    document.body.addEventListener('ll-custom', (event) => window.__custom.push(event.detail));
  });
  const group = frame(page, 'Asked first').locator('fluvy-tiles-card');
  const heater = group.locator('.fv-tile').nth(0);
  await heater.click();
  await settle(page, 300);
  const handed = await page.evaluate(() => window.__handed);
  const asked = handed[0]?.config?.tap_action;
  check(
    'a tap to be asked about goes to Home Assistant as the service it is, and nothing moves before the answer',
    handed.length === 1 &&
      handed[0].action === 'tap' &&
      handed[0].config.entity === 'switch.ac_heater' &&
      asked.action === 'perform-action' &&
      asked.perform_action === 'switch.turn_on' &&
      asked.confirmation === true &&
      (await calls(page)).length === 0 &&
      !(await heater.evaluate((el) => el.classList.contains('is-on'))),
    JSON.stringify(handed),
  );
  await group.locator('.fv-tile').nth(1).click();
  await settle(page, 200);
  const custom = await page.evaluate(() => window.__custom);
  check(
    "a tap set to fire-dom-event reaches the page's listeners with the whole action",
    custom.length === 1 &&
      custom[0].action === 'fire-dom-event' &&
      custom[0].browser_mod?.service === 'browser_mod.popup' &&
      (await calls(page)).length === 0,
    JSON.stringify(custom),
  );
  await page.close();
}

/* ---------- a card of rows: the head holds, a row taps on its own ---------- */
{
  const page = await suite.sheet('actions');
  await watchNavigation(page);
  const card = frame(page, 'Lock').locator('fluvy-lock-card');
  await hold(page, card.locator('.fv-card__title'));
  await settle(page, 300);
  check(
    'a hold on a lock head opens the details by default',
    (await moreInfo(page)).length === 1 && (await calls(page)).length === 0,
  );
  await reset(page);
  await card.locator('.fv-row').first().click();
  await settle(page, 300);
  const went = await navigations(page);
  check(
    'a row runs its own tap action (navigate)',
    went.length === 1 && went[0] === '/fluvy-auto/rooms' && (await moreInfo(page)).length === 0,
    went.join(' '),
  );
  await page.close();
}

/* ---------- a scene tile: a tap runs it, a hold never does ---------- */
{
  const page = await suite.sheet('actions');
  await watchNavigation(page);
  const tile = frame(page, 'Scene').locator('fluvy-scene-card .fv-scene');
  await tile.click();
  await settle(page, 300);
  const ran = await calls(page);
  check(
    'a tap on a scene tile runs the scene',
    ran.length === 1 && ran[0].s === 'scene.turn_on',
    JSON.stringify(ran.map((x) => x.s)),
  );
  await reset(page);
  await page.waitForTimeout(1300); // past the "Done" beat, so a run would count again
  await hold(page, tile);
  await settle(page, 300);
  const went = await navigations(page);
  check(
    'a hold on a scene tile runs the hold action and never also runs the scene',
    went.length === 1 && went[0] === '/fluvy-auto/rooms' && (await calls(page)).length === 0,
    `${went.join(' ')} · ${(await calls(page)).length} calls`,
  );
  await page.close();
}

/* ---------- a sensor tile's whole surface ---------- */
{
  const page = await suite.sheet('actions');
  await watchNavigation(page);
  const tile = frame(page, 'Sensor tile').locator('fluvy-sensor-card .fv-tile');
  await tile.click();
  await settle(page, 300);
  let went = await navigations(page);
  check('a tap on a sensor tile runs the tap action', went.length === 1 && went[0] === '/energy');
  await hold(page, tile);
  await settle(page, 300);
  went = await navigations(page);
  check(
    'a hold on a sensor tile runs the hold action, and never also taps',
    went.length === 1 && went[0] === '/fluvy-auto/rooms',
    went.join(' '),
  );
  await page.close();
}

/* ---------- the greeting's avatar ---------- */
{
  const page = await suite.sheet('actions');
  await watchNavigation(page);
  const avatar = frame(page, 'Greeting').locator('fluvy-hello-card .hm-avatar');
  await avatar.click();
  await settle(page, 300);
  let went = await navigations(page);
  check('a tap on the avatar runs the tap action', went.length === 1 && went[0] === '/profile');
  await hold(page, avatar);
  await settle(page, 300);
  went = await navigations(page);
  check(
    'a hold on the avatar runs the hold action, and never also taps',
    went.length === 1 && went[0] === '/fluvy-auto/rooms',
    went.join(' '),
  );
  await page.close();
}

/* ---------- the greeting greets whoever is signed in (issue #26) ---------- */
{
  const page = await suite.sheet('home-extras');
  const cards = frame(page, 'B Greeting · whoever is signed in').locator('fluvy-hello-card');
  const read = (card) =>
    card.evaluate((el) => ({
      text: el.shadowRoot.querySelector('.hm-hello__greeting, h2, .hm-hello')?.textContent ?? '',
      picture: el.shadowRoot.querySelector('.hm-avatar__img')?.getAttribute('src') ?? '',
      label: el.shadowRoot.querySelector('.hm-avatar')?.getAttribute('aria-label') ?? '',
    }));
  const viewer = await read(cards.nth(0));
  const fixed = await read(cards.nth(1));
  check(
    'a greeting that names no one greets the signed-in user: their person’s name and picture',
    viewer.text.includes('Marta') && viewer.picture !== '' && viewer.label === 'Marta',
    JSON.stringify(viewer),
  );
  check(
    'a greeting that names a person keeps that person, whoever looks',
    fixed.text.includes('Ana') && fixed.label === 'Ana Ruiz',
    JSON.stringify(fixed),
  );
  await reset(page);
  await cards.nth(0).locator('.hm-avatar').click();
  await settle(page, 300);
  check(
    'its avatar opens the signed-in person’s details',
    (await moreInfo(page)).join() === 'person.marta',
    (await moreInfo(page)).join(),
  );
  await page.close();
}

/* ---------- the people: an action each (issue #25) and their phones' batteries (issue #26) ---------- */
{
  const page = await suite.sheet('ambient');
  await watchNavigation(page);
  const grid = frame(page, 'Who is home · batteries').locator('fluvy-people-card');
  const batteries = await grid.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('.am-person')].map((p) => ({
      text: (p.querySelector('.fv-battery')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      low: p.querySelector('.fv-battery')?.classList.contains('is-low') ?? false,
    })),
  );
  check(
    'people: each phone’s battery found from the tracker the person is seen by (78 %, 18 % low, unreadable “—”)',
    JSON.stringify(batteries) ===
      JSON.stringify([
        { text: '78 %', low: false },
        { text: '18 %', low: true },
        { text: '—', low: false },
      ]),
    JSON.stringify(batteries),
  );
  const rows = frame(page, 'Who is home · each their own').locator('fluvy-people-card .fv-row');
  await rows.nth(0).click();
  await settle(page, 300);
  check(
    'people: a person with a tap action of their own goes to their page',
    (await navigations(page)).join() === '/fluvy-home/marta',
  );
  await reset(page);
  await rows.nth(1).click();
  await settle(page, 300);
  check(
    'people: a person without one opens their details, never the card’s action',
    (await moreInfo(page)).join() === 'person.am_pau',
  );
  await reset(page);
  await hold(page, rows.nth(0));
  await settle(page, 300);
  check(
    'people: a hold opens the details and never also taps',
    (await moreInfo(page)).join() === 'person.am_marta' && (await navigations(page)).length === 0,
  );
  const jan = await rows.nth(2).evaluate((el) => ({
    name: el.querySelector('.fv-row__title')?.textContent.trim(),
    battery: (el.querySelector('.fv-battery')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
  check(
    'people: an entry’s own name and battery sensor',
    jan.name === 'Jan' && jan.battery === '64 %',
    JSON.stringify(jan),
  );
  await page.close();
}

/* ---------- the people quiet out of reach (#126): the ring goes for one out of reach, never for one unplaced ---------- */
{
  const page = await suite.sheet('unavailable');
  const rings = (n) =>
    frame(page, 'Dashed and quiet · people')
      .locator('fluvy-people-card')
      .nth(n)
      .evaluate((el) =>
        [...el.shadowRoot.querySelectorAll('.am-avatar')].map((face) => {
          const style = getComputedStyle(face);
          return style.outlineStyle === 'dashed' && parseFloat(style.outlineWidth) > 0;
        }),
      );
  // Jan away, Noa unknown, Guest unavailable: dashed, then quiet
  const [dashed, quiet] = [await rings(0), await rings(1)];
  check(
    'people: quiet takes the dashed ring off a person out of reach, and a person nobody can place keeps hers',
    dashed.join() === 'false,true,true' && quiet.join() === 'false,true,false',
    `dashed ${dashed.join()} · quiet ${quiet.join()}`,
  );
  await page.close();
}

/* ---------- a large tile: its surface taps and holds, its switch keeps its own tap ---------- */
{
  const page = await suite.sheet('actions');
  await watchNavigation(page);
  const tiles = frame(page, 'Tile · large').locator('fluvy-tile-card');
  const washer = tiles.nth(0);
  const name = washer.locator('.fv-tile__name');
  await tapHead(washer, '.fv-tile__name');
  await settle(page, 300);
  check(
    'a tap on a large tile runs its tap action',
    (await navigations(page)).join() === '/t/tile' && (await calls(page)).length === 0,
  );
  await hold(page, name);
  await settle(page, 300);
  const held = await navigations(page);
  check(
    'a hold on a large tile runs its hold action and never also taps (a long press used to tap)',
    held.join() === '/h/tile' && (await calls(page)).length === 0,
    held.join(' '),
  );
  await tapHead(washer, '.fv-hit');
  await settle(page, 300);
  const flipped = await calls(page);
  check(
    'its switch flips the plug alone: beside the tile’s button, never inside it',
    flipped.length === 1 &&
      flipped[0].s === 'switch.turn_off' &&
      (await navigations(page)).length === 0,
    JSON.stringify(flipped.map((x) => x.s)),
  );
  await reset(page);
  const button = washer.locator('.fv-tile__tap');
  await button.focus();
  await page.keyboard.press('Enter');
  await settle(page, 200);
  const keyed = await navigations(page);
  await page.keyboard.press('Shift+F10');
  await settle(page, 200);
  const keyHeld = await navigations(page);
  check(
    'from the keyboard: one stop, Enter taps, Shift+F10 holds',
    keyed.join() === '/t/tile' && keyHeld.join() === '/h/tile',
    `${keyed.join()} · ${keyHeld.join()}`,
  );
  const gone = tiles.nth(1);
  await tapHead(gone, '.fv-tile__name');
  await settle(page, 200);
  const goneTap = await navigations(page);
  await hold(page, gone.locator('.fv-tile__name'));
  await settle(page, 300);
  check(
    'an unavailable large tile still taps and holds, its switch there and still',
    goneTap.join() === '/t/gone' &&
      (await navigations(page)).join() === '/h/gone' &&
      (await gone.locator('.fv-hit.is-fixed').count()) === 1,
    goneTap.join(),
  );
  await page.close();
}

/* ---------- four large tiles, one unavailable: one height (the owner's rule, A7) ---------- */
for (const width of [360, 211, 266]) {
  const page = await suite.sheet('actions', { width });
  const heights = await frame(page, 'Tiles · large · one unavailable')
    .locator('fluvy-tiles-card .fv-tile')
    .evaluateAll((tiles) => tiles.map((tile) => tile.getBoundingClientRect().height));
  check(
    `four large tiles at ${width}, the 3D printer unavailable: one height (within 0.5 px)`,
    heights.length === 4 && Math.max(...heights) - Math.min(...heights) <= 0.5,
    heights.map((h) => h.toFixed(2)).join(' · '),
  );
  await page.close();
}

/* ---------- the printer's switch out of reach is drawn disabled, never as a live Off (A7), in both modes ---------- */
for (const mode of ['light', 'dark']) {
  const page = await suite.sheet('actions', { extra: `&mode=${mode}` });
  const skins = await frame(page, 'Tiles · large · one unavailable')
    .locator('fluvy-tiles-card .fv-switch:not(.is-on)')
    .evaluateAll((switches) =>
      switches.map((knob) => ({
        fixed: knob.getAttribute('aria-disabled') === 'true',
        opacity: Number(getComputedStyle(knob).opacity),
      })),
    );
  const gone = skins.filter((skin) => skin.fixed);
  const live = skins.filter((skin) => !skin.fixed);
  check(
    `${mode}: the out-of-reach switch is drawn disabled (as a disabled round), the live Off one at full strength`,
    gone.length === 1 &&
      live.length >= 1 &&
      gone[0].opacity <= 0.4 &&
      live.every((skin) => skin.opacity === 1),
    skins.map((skin) => `${skin.fixed ? 'out of reach' : 'live'} ${skin.opacity}`).join(' · '),
  );
  await page.close();
}

/* ---------- a finger's long press on a head: the hold, no selection, no tap (Chromium's touch) ---------- */
if (ENGINE === 'chromium') {
  const context = await suite.browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}?sheet=actions&width=360`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(900);
  await watchNavigation(page);
  const card = frame(page, 'Toggle and go').locator('fluvy-light-card');
  const box = await card.locator('.fv-card__title').boundingBox();
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.waitForTimeout(650);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(page, 400);
  const went = await navigations(page);
  const selected = await page.evaluate(() => String(window.getSelection()));
  check(
    'a finger held on a head: the hold action, nothing selected, never the tap',
    went.join() === '/fluvy-auto/rooms' && selected === '' && (await calls(page)).length === 0,
    `${went.join(' ')} · "${selected}"`,
  );
  await context.close();
}

/* ---------- double tap and the circle's own actions (#179) ---------- */

/** The centre of a part, where a pointer lands on whatever the browser hit-tests there. */
async function centre(locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** What the cards asked for since the last look: the services, the details, the paths. */
async function heard(page) {
  const said = [
    ...(await calls(page)).map((c) => c.s),
    ...(await moreInfo(page)).map((id) => `details ${id}`),
    ...(await navigations(page)),
  ];
  await reset(page);
  return said.join(' ');
}

{
  const page = await suite.sheet('taps');
  await watchNavigation(page);
  const tiles = frame(page, 'Double tap · tiles').locator('fluvy-tiles-card .fv-tile');
  const lamp = await centre(tiles.nth(0).locator('.fv-tile__name'));
  // one tap waits its 250 ms, then runs the tap
  await page.mouse.click(lamp.x, lamp.y);
  const early = await heard(page);
  await settle(page, 350);
  check(
    'a tile with a double tap: one tap waits 250 ms, then opens its details',
    early === '' && (await heard(page)) === 'details light.tp_desk',
    early,
  );
  await page.mouse.dblclick(lamp.x, lamp.y);
  await settle(page, 400);
  const twice = await heard(page);
  check(
    'two taps inside them switch it, and never also open it',
    twice === 'light.turn_off',
    twice,
  );
  const kettle = tiles.nth(1);
  await hold(page, kettle);
  await settle(page, 400);
  const held = await heard(page);
  check('a hold on it is its hold, whatever its double tap', held === '/h/kettle', held);

  // a row's own hold and double tap
  const rows = frame(page, 'Rows').locator('fluvy-entities-card .fv-row--tap');
  await hold(page, rows.nth(0));
  await settle(page, 400);
  const row = await heard(page);
  check('a row holds on its own', row === '/h/office', row);
  const humidity = await centre(rows.nth(1).locator('.fv-row__title'));
  await page.mouse.dblclick(humidity.x, humidity.y);
  await settle(page, 400);
  const rowTwice = await heard(page);
  check('a row’s two taps are its double tap', rowTwice === '/d/humidity', rowTwice);

  // a tab: its path on a tap, its hold, its double tap
  const chips = frame(page, 'Tabs').locator('fluvy-chips-card .fv-chip');
  await chips.nth(0).click();
  await settle(page, 200);
  const home = await heard(page);
  check('a tab without a double tap goes at once', home === '/t/home', home);
  await hold(page, chips.nth(1));
  await settle(page, 400);
  const office = await heard(page);
  // the lamp's toggle: whichever way the double tap above left it
  check(
    'a tab holds on its own, and never also goes',
    /^light\.turn_(on|off)$/.test(office),
    office,
  );
  const tab = await centre(chips.nth(2));
  await page.mouse.dblclick(tab.x, tab.y);
  await settle(page, 400);
  const tabTwice = await heard(page);
  check('a tab’s two taps are its double tap', tabTwice === 'switch.turn_on', tabTwice);

  // a large tile's circle of its own, beside the tile's surface; a circle that is the switch still flips it
  const large = frame(page, 'Circle · large').locator('fluvy-tiles-card .fv-tile');
  const circle = large.nth(0).locator('.fv-tile__head .fv-ico--tap');
  check(
    'a tile’s circle with an action of its own is a button, named after the tile',
    (await circle.count()) === 1 &&
      (await circle.getAttribute('aria-label')) === 'Reading lamp icon',
  );
  await circle.click();
  await settle(page, 200);
  const own = await heard(page);
  check('its tap is its own: the details', own === 'details light.tp_reading', own);
  const reading = await centre(large.nth(0).locator('.fv-tile__name'));
  await page.mouse.click(reading.x, reading.y);
  await settle(page, 200);
  const surface = await heard(page);
  check('the tile’s surface keeps the tile’s tap', surface === '/t/reading', surface);
  const flips = large.nth(1).locator('.fv-tile__head .fv-ico');
  await flips.click();
  await settle(page, 200);
  const flipped = await heard(page);
  check(
    'a circle that is the tile’s switch still flips it, a switch to a reader',
    flipped === 'switch.turn_off' && (await flips.getAttribute('role')) === 'switch',
    flipped,
  );
  await hold(page, flips);
  await settle(page, 400);
  const flipsHeld = await heard(page);
  check('and holds on its own', flipsHeld === '/h/heater', flipsHeld);

  // a mini tile's circle: its own tap, its own double tap, above the tile's button
  const mini = frame(page, 'Circle · compact and mini').locator('fluvy-tile-card').nth(1);
  const miniCircle = await centre(mini.locator('.fv-ico--tap'));
  await page.mouse.dblclick(miniCircle.x, miniCircle.y);
  await settle(page, 400);
  const miniTwice = await heard(page);
  check('a mini tile’s circle double-taps on its own', miniTwice === '/d/kettle', miniTwice);
  const miniName = await centre(mini.locator('.fv-tile__name'));
  await page.mouse.click(miniName.x, miniName.y);
  await settle(page, 200);
  const miniTap = await heard(page);
  // the kettle's toggle: whichever way its tab's double tap above left it
  check('and the tile around it still toggles', /^switch\.turn_(on|off)$/.test(miniTap), miniTap);

  // a head's circle: its own button over the head's, the head still the card's
  const card = frame(page, 'Circle · head').locator('fluvy-light-card');
  const headCircle = card.locator('.fv-card__head > .fv-ico--tap');
  await tapHead(card, '.fv-card__head > .fv-ico--tap');
  await settle(page, 200);
  const headOwn = await heard(page);
  check(
    'a head’s circle with an action of its own answers it, named after the card',
    headOwn === 'details light.tp_ceiling' &&
      (await headCircle.getAttribute('aria-label')) === 'Living room ceiling icon',
    headOwn,
  );
  await tapHead(card, 'title');
  await settle(page, 200);
  const headTap = await heard(page);
  check('the head beside it is still the card’s button', headTap === 'light.turn_on', headTap);
  await hold(page, headCircle);
  await settle(page, 400);
  const headHeld = await heard(page);
  check(
    'a hold on the circle is the circle’s, never the head’s',
    headHeld === '/h/ceiling',
    headHeld,
  );

  // the keyboard: the circle is in the tab order; Enter twice on a surface with a double tap is its double tap
  await headCircle.focus();
  await page.keyboard.press('Enter');
  await settle(page, 200);
  const keyed = await heard(page);
  check(
    'the circle takes the keyboard: Enter is its tap',
    keyed === 'details light.tp_ceiling',
    keyed,
  );
  await tiles.nth(0).locator('.fv-tile__tap').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await settle(page, 400);
  const keyedTwice = await heard(page);
  check(
    'Enter twice inside 250 ms is the double tap',
    /^light\.turn_(on|off)$/.test(keyedTwice),
    keyedTwice,
  );
  await page.keyboard.press('Shift+F10');
  await settle(page, 200);
  const keyHeld = await heard(page);
  check('Shift+F10 holds', keyHeld === 'details light.tp_desk', keyHeld);

  // one lamp in two rows: a tap on each is two taps, each its own; two on the second are its double
  const lampRows = frame(page, 'Double tap · one lamp in two rows').locator(
    'fluvy-entities-card .fv-row--tap',
  );
  const first = await centre(lampRows.nth(0).locator('.fv-row__title'));
  const second = await centre(lampRows.nth(1).locator('.fv-row__title'));
  await page.mouse.click(first.x, first.y);
  await page.mouse.click(second.x, second.y);
  await settle(page, 400);
  const across = await heard(page);
  check(
    'a tap on each of two rows of one lamp is two taps, never the second’s double',
    across === 'details light.tp_reading details light.tp_reading',
    across,
  );
  await page.mouse.dblclick(second.x, second.y);
  await settle(page, 400);
  const secondTwice = await heard(page);
  check('two taps on the second are its own double', secondTwice === '/d/night', secondTwice);
  await page.close();
}

/* ---------- a finger's double tap: the double tap, never the page's zoom (WebKit's own under ENGINE=webkit) ---------- */
{
  const context = await suite.browser.newContext({
    hasTouch: true,
    isMobile: ENGINE !== 'firefox',
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}?sheet=taps&width=360`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(900);
  await watchNavigation(page);
  const lamp = await centre(
    frame(page, 'Double tap · tiles')
      .locator('fluvy-tiles-card .fv-tile')
      .nth(0)
      .locator('.fv-tile__name'),
  );
  const zoom = () => page.evaluate(() => window.visualViewport?.scale ?? 1);
  await page.touchscreen.tap(lamp.x, lamp.y);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(lamp.x, lamp.y);
  await settle(page, 500);
  const said = (await calls(page)).map((c) => c.s).join(' ');
  check(
    `${ENGINE}: a finger’s two taps on a tile are its double tap, and the page never zooms`,
    said === 'light.turn_off' && (await zoom()) === 1,
    `${said} · zoom ${await zoom()}`,
  );
  await context.close();
}

await suite.finish();
