#!/usr/bin/env node
/**
 * A card's actions, in a real Chromium against the playground's `actions` sheet. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-actions.mjs
 * What it proves: the icon circle runs the tap action and a still press on the head the hold action, both
 * more-info by default and anything Home Assistant's actions are when chosen; a hold never also taps (the click
 * that follows is swallowed, on the title and on the icon alike); a tap on the title is nothing; a hold on a ruler
 * is still its fine scale; a tile's whole surface taps and holds the same way, and a tap set to none does nothing;
 * a card of rows holds on its head and a row runs its own tap; the greeting's avatar taps and holds as an icon;
 * a scene tile runs on a tap and holds without running; a sensor tile's whole surface taps and holds.
 */
import { holdForFine, mousePointer, rulerGeometry } from './lib/gestures.mjs';
import { calls, frame, moreInfo, reset, settle, startSuite } from './lib/suite.mjs';

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
  await card.locator('.fv-ico').first().click();
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
  await card.locator('.fv-card__title').click();
  await settle(page, 200);
  check(
    'a tap on the title is nothing',
    (await moreInfo(page)).length === 0 && (await calls(page)).length === 0,
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
  await card.locator('.fv-ico').first().click();
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

await suite.finish();
