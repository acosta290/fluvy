#!/usr/bin/env node
/**
 * The Rooms card (#225) on the playground's `rooms-card` sheet (real cards, simulated hass). Exit code 1 on any
 * failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-rooms-card.mjs
 * What it proves: the house's six rooms stand in its order, each with its readings and its rounds; a finger on a room
 * opens its page on the house's Rooms dashboard, and on the head every room; a tap on a room's lights' round switches
 * them all off in one call, drawn off at once, the page staying where it is, and its thermostat's opens its details; a
 * hold on a room that names none is its tap. A tile opens its room as its row does, its round its own. Out of
 * reach, an area the house no longer has is no button, and an unplugged lamp's round takes no tap.
 */
import { calls, frame, moreInfo, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const said = (list) =>
  list.map(
    (call) => `${call.s} ${[call.t?.entity_id ?? call.d?.entity_id ?? ''].flat().join('+')}`,
  );
/** A finger on a part: a tap, or held for 700 ms; at its centre, on whatever the browser hit-tests there. */
const press = async (page, locator, hold = false) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(hold ? 700 : 40);
  await page.mouse.up();
  await settle(page, 300);
};
/** Where the page is, and back to where it was. */
const here = (page) => page.evaluate(() => window.location.pathname);
const home = (page) => page.evaluate(() => window.history.replaceState(null, '', '/'));

const page = await suite.sheet('rooms-card');

/* ---------- the house ---------- */
const house = frame(page, 'The house').locator('fluvy-rooms-card');
const rows = house.locator('.fv-row');
check(
  'the house’s six rooms, in its order, each with its temperature and humidity',
  (await rows.locator('.fv-row__title').allTextContents()).join() ===
    'Kitchen,Living room,Office,Bathroom,Bedroom,Kids room' &&
    ((await rows.first().locator('.fv-row__sub').textContent()) ?? '').trim() === '20.7° · 57 %',
  (await rows.locator('.fv-row__title').allTextContents()).join(),
);
check(
  'its head says how many rooms and their average temperature',
  ((await house.locator('.fv-card__sub').textContent()) ?? '').trim() === '6 rooms · 20.9° average',
);

const living = rows.nth(1);
await home(page);
await press(page, living.locator('.fv-row__title'));
check(
  'a finger on the living room opens its page on the Rooms dashboard',
  (await here(page)) === '/fluvy-rooms/room-rs_living',
  await here(page),
);
await home(page);
await press(page, house.locator('.fv-head__open'));
check(
  'the head’s chevron opens every room',
  (await here(page)) === '/fluvy-rooms',
  await here(page),
);

await home(page);
await reset(page);
const lights = living.locator('.lt-bulb').first();
await press(page, lights);
check(
  'a tap on the living room’s lights switches them all off in one call, drawn off at once, the page staying',
  said(await calls(page)).join() ===
    'light.turn_off light.rs_living_ceiling+light.rs_living_floor' &&
    !(await lights.evaluate((round) => round.classList.contains('is-on'))) &&
    (await here(page)) === '/',
  said(await calls(page)).join(),
);
await reset(page);
await press(page, living.locator('.lt-bulb').nth(1));
check(
  'its thermostat’s round opens its details, switching nothing',
  JSON.stringify(await moreInfo(page)) === '["climate.rs_living"]' &&
    (await calls(page)).length === 0 &&
    (await here(page)) === '/',
  JSON.stringify(await moreInfo(page)),
);
await reset(page);
await press(page, rows.nth(2).locator('.fv-row__title'), true);
check(
  'a hold on a room that names none is its tap, as Home Assistant’s: it opens, opening no details',
  (await moreInfo(page)).length === 0 &&
    (await calls(page)).length === 0 &&
    (await here(page)) === '/fluvy-rooms/room-rs_office',
  await here(page),
);
await home(page);

/* ---------- tiles ---------- */
const tiles = frame(page, 'The house · tiles').locator('fluvy-rooms-card .rs-tile');
await home(page);
await reset(page);
await press(page, tiles.first().locator('.lt-bulb').first());
check(
  'a tile’s round is its own: the kitchen’s spots go off, the page staying',
  said(await calls(page)).join() === 'light.turn_off light.rs_kitchen_spots' &&
    (await here(page)) === '/',
  said(await calls(page)).join(),
);
await press(page, tiles.first().locator('.rs-tile__name'));
check(
  'a finger on a tile opens its room',
  (await here(page)) === '/fluvy-rooms/room-rs_kitchen',
  await here(page),
);
await home(page);

/* ---------- out of reach ---------- */
const reach = frame(page, 'Out of reach').locator('fluvy-rooms-card .fv-row');
await reset(page);
await press(page, reach.nth(1).locator('.fv-row__title'));
check(
  'an area the house no longer has is no button',
  (await reach.nth(1).getAttribute('role')) === null && (await here(page)) === '/',
);
const unplugged = reach.first().locator('.lt-bulb').first();
await press(page, unplugged);
check(
  'an unplugged lamp’s round is the dashed ring and takes no tap',
  (await unplugged.getAttribute('aria-disabled')) === 'true' && (await calls(page)).length === 0,
);

await page.close();
await suite.finish();
