#!/usr/bin/env node
/**
 * The Rounds card (#224) on the playground's `rounds` sheet (real cards, simulated hass). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-rounds.mjs
 * What it proves: the reporter's Quick picks draw a round an entity, lit while on, the plug that is gone in the dashed
 * ring; a finger's tap on the washing machine's round turns it on, drawn on at once, and one on the kitchen light's
 * turns it off; the kitchen window's and the hall motion's open their details and switch nothing; a hold opens a
 * round's details, the gone plug's too, whose tap does nothing. Of two doors, the unlocked one locks at a tap and the
 * locked one asks Home Assistant first (`hass-action`, `confirmation`), nothing unlocked before its yes. A row each
 * taps as its round. With their states, each says its own whole under its glyph, as the taps left it, in a key: every
 * key of the card one width, its words 12 from its sides at least.
 */
import { calls, frame, moreInfo, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const said = (list) =>
  list.map((call) => `${call.s} ${call.t?.entity_id ?? call.d?.entity_id ?? ''}`);
/** A finger on a round: a tap, or held for 700 ms; at its centre, on whatever the browser hit-tests there. */
const press = async (page, locator, hold = false) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(hold ? 700 : 40);
  await page.mouse.up();
  await settle(page, 300);
};

const page = await suite.sheet('rounds');
await page.evaluate(() => {
  window.__asked = [];
  document.addEventListener('hass-action', (event) => window.__asked.push(event.detail.config));
});
const asked = () => page.evaluate(() => window.__asked.splice(0));

/* ---------- the reporter's Quick picks ---------- */
const quick = frame(page, 'Quick picks').locator('fluvy-rounds-card');
const rounds = quick.locator('.lt-bulb');
check(
  'a round an entity, in their order, lit while on, the gone plug in the dashed ring and taking no tap',
  (await rounds.count()) === 6 &&
    (
      await rounds.evaluateAll((all) => all.map((round) => round.classList.contains('is-on')))
    ).join() === 'true,false,true,false,false,false' &&
    (await rounds.nth(5).getAttribute('aria-disabled')) === 'true' &&
    (await rounds.nth(5).evaluate((round) => round.classList.contains('fv-ico--off'))),
);
check(
  'its head says how many are on',
  ((await quick.locator('.fv-card__sub').textContent()) ?? '').trim() === '2 of 6 on',
);

await reset(page);
await press(page, rounds.nth(1));
check(
  'a tap on the washing machine turns it on, drawn on at once',
  said(await calls(page)).join() === 'switch.turn_on switch.washer' &&
    (await rounds.nth(1).evaluate((round) => round.classList.contains('is-on'))),
  said(await calls(page)).join(),
);
await reset(page);
await press(page, rounds.nth(0));
check(
  'a tap on the kitchen light turns it off',
  said(await calls(page)).join() === 'switch.turn_off switch.kitchen_light',
  said(await calls(page)).join(),
);

await reset(page);
await press(page, rounds.nth(2));
await press(page, rounds.nth(3));
check(
  'the kitchen window and the hall motion open their details, switching nothing',
  JSON.stringify(await moreInfo(page)) ===
    '["binary_sensor.kitchen_window","binary_sensor.motion_hall"]' &&
    (await calls(page)).length === 0,
  JSON.stringify(await moreInfo(page)),
);

await reset(page);
await press(page, rounds.nth(0), true);
await press(page, rounds.nth(5), true);
await press(page, rounds.nth(5));
check(
  'a hold opens a round’s details, the gone plug’s too, whose tap does nothing',
  JSON.stringify(await moreInfo(page)) === '["switch.kitchen_light","switch.ghost"]' &&
    (await calls(page)).length === 0,
  JSON.stringify(await moreInfo(page)),
);

/* ---------- a lock locks at a tap, and asks before it unlocks ---------- */
const doors = frame(page, 'Locks').locator('fluvy-rounds-card .lt-bulb');
await reset(page);
await asked();
await press(page, doors.nth(1));
check(
  'the unlocked back door locks at a tap, asking nothing',
  said(await calls(page)).join() === 'lock.lock lock.rd_back_door' && (await asked()).length === 0,
  said(await calls(page)).join(),
);
await reset(page);
await press(page, doors.nth(0));
const question = await asked();
check(
  'the locked front door asks Home Assistant first: nothing unlocked before its yes',
  (await calls(page)).length === 0 &&
    question.length === 1 &&
    question[0].tap_action.perform_action === 'lock.unlock' &&
    question[0].tap_action.confirmation === true,
  JSON.stringify(question),
);

/* ---------- a row each ---------- */
const rows = frame(page, 'Quick picks · rows').locator('fluvy-rounds-card .fv-row');
await reset(page);
await press(page, rows.nth(3));
check(
  'a row each taps as its round: the hall motion’s opens its details',
  JSON.stringify(await moreInfo(page)) === '["binary_sensor.motion_hall"]' &&
    (await calls(page)).length === 0,
);
await reset(page);
await press(page, rows.nth(1));
check(
  'the washing machine’s row switches it',
  said(await calls(page)).join() === 'switch.turn_off switch.washer',
  said(await calls(page)).join(),
);

/* ---------- labels: the states under the glyphs ---------- */
const labels = frame(page, 'Quick picks · labels').locator('fluvy-rounds-card .lt-said');
check(
  'labels: each says its state whole under its glyph, as the taps left it, the gone plug a dash',
  (await labels.allTextContents()).join() === 'Off,Off,Open,Clear,Locked,—' &&
    (await labels.evaluateAll((all) =>
      all.every((said) => said.scrollWidth <= said.clientWidth + 0.5),
    )),
  (await labels.allTextContents()).join(),
);
// the owner's review: a key each, every one of the card one width on the 4 grid, its words 12 from its sides at least
const keys = await frame(page, 'Quick picks · labels and names')
  .locator('fluvy-rounds-card .lt-bulb')
  .evaluateAll((all) =>
    all.map((key) => {
      const box = key.getBoundingClientRect();
      const words = key.querySelector('.lt-said').getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        sides: Math.min(words.left - box.left, box.right - words.right),
      };
    }),
  );
check(
  'labels: a key each, every one as wide as the widest on the 4 grid, its words 12 from its sides at least',
  keys.length === 6 &&
    keys.every(
      ({ width, height }) => width === keys[0].width && width % 4 === 0 && height === 64,
    ) &&
    keys.every(({ sides }) => sides >= 12),
  JSON.stringify(keys),
);

await page.close();
await suite.finish();
