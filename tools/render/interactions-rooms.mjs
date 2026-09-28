#!/usr/bin/env node
/**
 * The room and the map, in a real Chromium against the playground. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-rooms.mjs
 * What it proves: a room's photo cross-fades in once decoded; its rows and its hero go to the room's path; a
 * compact tile inside it toggles before the mock answers; a room without a path shows no chevron; a missing
 * area says so; the map's zones hold the right faces, a person nobody can place stands in Unknown, the rows say
 * the distance only for someone away with a fix, and Home Assistant's map, which the playground cannot make,
 * gives way to the zones silently.
 */
import { calls, frame, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const watchNavigation = (page) =>
  page.evaluate(() => {
    window.__navigations = [];
    window.addEventListener('location-changed', () =>
      window.__navigations.push(window.location.pathname),
    );
  });
const navigations = (page) => page.evaluate(() => window.__navigations.splice(0));

/* ---------- the room ---------- */
{
  const page = await suite.sheet('rooms');
  await watchNavigation(page);
  const photo = frame(page, 'Room · photo').locator('fluvy-room-card').first();
  await settle(page, 600);
  check(
    'the photo is on the hero, shown once decoded',
    (await photo.locator('.rm-hero .fv-plate__img.is-on').count()) === 1 &&
      (await photo.locator('.am-area__badge').textContent()).includes('Living room'),
  );
  check(
    'the readouts say the climate and what is on',
    (await photo.locator('.am-area__stats .fv-readout').count()) === 3,
  );
  const rows = photo.locator('.am-rows .fv-row');
  check('the category rows: lights, climate, media, every device', (await rows.count()) === 4);
  await rows.first().click();
  await settle(page, 200);
  let went = await navigations(page);
  check(
    'a row goes to the room',
    went.length === 1 && went[0] === '/fluvy-auto/room-rm_living',
    went.join(' '),
  );
  await photo.locator('.rm-hero').click();
  await settle(page, 200);
  went = await navigations(page);
  check('so does the hero', went.length === 1 && went[0] === '/fluvy-auto/room-rm_living');

  const tiles = frame(page, 'Room · tiles').locator('fluvy-room-card').first();
  check(
    'the controls as tiles: the lights first, four at most',
    (await tiles.locator('.rm-controls .fv-tile').count()) === 4,
  );
  await reset(page);
  await tiles.locator('.rm-controls .fv-tile').nth(1).click(); // the reading lamp, off
  await settle(page, 200);
  const sent = await calls(page);
  check(
    'a tile inside the room toggles at once and sends one call',
    sent.length === 1 &&
      sent[0].s === 'light.turn_on' &&
      (await tiles.locator('.rm-controls .fv-tile').nth(1).getAttribute('class')).includes('is-on'),
    JSON.stringify(sent.map((x) => x.s)),
  );

  const bare = frame(page, 'Room · no photo').locator('fluvy-room-card').first();
  check(
    'without a picture the hero is the gradient',
    (await bare.locator('.fv-plate__img').count()) === 0,
  );
  await bare.locator('.am-rows .fv-row').first().click();
  await settle(page, 200);
  went = await navigations(page);
  check(
    "without a path an admin's rows go to the area's settings",
    went.length === 1 && went[0] === '/config/areas/area/rm_kitchen',
    went.join(' '),
  );
  const empty = frame(page, 'Room · empty, missing').locator('fluvy-room-card');
  check(
    'an empty area says so; an area that is not there says that',
    (await empty.nth(0).locator('.fv-empty-state__text').textContent()).trim() ===
      'Nothing in this room yet' &&
      (await empty.nth(1).locator('.fv-empty').textContent()).trim() === 'Area not found',
  );
  await page.close();
}

/* ---------- the map ---------- */
{
  const page = await suite.sheet('ambient');
  const zones = frame(page, 'Map · zones').locator('fluvy-map-card').first();
  const labels = await zones.locator('.mp-zone__label').allTextContents();
  const counts = await zones.locator('.mp-zone__count').allTextContents();
  check(
    'the zones as columns: home, the zone Ona is in, away, and unknown for Noa',
    labels.map((l) => l.trim().toLowerCase()).join(',') === 'home,school,away,unknown' &&
      counts.map((c) => c.trim()).join(',') === '2,1,1,1',
    `${labels.join(',')} · ${counts.join(',')}`,
  );
  const rows = frame(page, 'Map · rows').locator('fluvy-map-card').first();
  const words = await rows.locator('.fv-row__value').allTextContents();
  check(
    'the rows say where each person is, and how far only for someone away with a fix',
    words.length === 5 &&
      words[0].trim() === 'Home' &&
      words[1].trim() === 'School' &&
      /^Away · \d+(\.\d)? km$/.test(words[2].trim()) &&
      words[3].trim() === 'Unknown' &&
      words[4].trim() === 'Unknown',
    words.join(' | '),
  );
  const map = frame(page, 'Map · map').locator('fluvy-map-card').first();
  await settle(page, 400);
  check(
    "Home Assistant's map cannot be made here: the zones stand in, silently",
    (await map.locator('.mp-zones').count()) === 1 &&
      (await map.locator('.mp-plate').count()) === 0,
  );
  const chosen = frame(page, 'Map · chosen zones, empty ones kept')
    .locator('fluvy-map-card')
    .first();
  const chosenLabels = await chosen.locator('.mp-zone__label').allTextContents();
  check(
    'the zones asked for, in that order and by the names given, the empty one kept',
    chosenLabels.map((l) => l.trim().toLowerCase()).join(',') === 'home,office,school',
    chosenLabels.join(','),
  );
  await page.close();
}

await suite.finish();
