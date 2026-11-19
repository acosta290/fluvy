#!/usr/bin/env node
/**
 * The Thermostats card (#230, #219) on the playground's `thermostats` sheet (real cards, simulated hass). Exit code 1
 * on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-thermostats.mjs
 * What it proves: the house's heating draws a row each, named by its room, the bathroom's valve out of reach in the
 * dashed ring and taking no tap; a row's tap opens its details. A finger on the bedroom's + steps its own half degree,
 * drawn at once, and one call goes to that valve alone once the taps settle, as the heat pump's + a whole degree. All
 * off asks Home Assistant first, nothing turned off before its yes, then turns off each one that is on as it takes it
 * (the heat pump by its own off, the valves by their Off mode), never the office that is off nor the bathroom out of
 * reach. A preset chip sets each one that is on and offers it to its own preset, never one that has none or is off.
 */
import { calls, frame, moreInfo, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const said = (list) =>
  list.map((call) => `${call.s} ${JSON.stringify(call.d)} ${call.t?.entity_id ?? ''}`.trim());
/** A finger on a control: a tap at its centre, on whatever the browser hit-tests there. */
const press = async (page, locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
  await settle(page, 120);
};

const page = await suite.sheet('thermostats');
await page.evaluate(() => {
  window.__asked = [];
  document.addEventListener('hass-action', (event) => window.__asked.push(event.detail.config));
});
const asked = () => page.evaluate(() => window.__asked.map((config) => config.tap_action));

/* ---------- the house's heating ---------- */
const heating = frame(page, 'The house’s heating').locator('fluvy-thermostats-card');
const rows = heating.locator('.ts-list .fv-row');
check(
  'a row each, named by its room, the bathroom’s valve out of reach in the dashed ring',
  (await rows.count()) === 5 &&
    (await rows.locator('.fv-row__title').allTextContents()).join() ===
      'Living room,Bedroom,Kids room,Office,Bathroom' &&
    (await rows
      .nth(4)
      .evaluate((row) => row.querySelector(':scope > .fv-ico')?.classList.contains('fv-ico--off'))),
  (await rows.locator('.fv-row__title').allTextContents()).join(),
);
check(
  'its head says how many heat',
  ((await heating.locator('.fv-card__sub').textContent()) ?? '').trim() === '2 of 4 heating',
);
await reset(page);
await press(page, rows.nth(0).locator('.fv-row__title'));
await press(page, rows.nth(4).locator('.fv-row__title'));
check(
  'a row’s tap opens its details; the one out of reach takes none',
  JSON.stringify(await moreInfo(page)) === '["climate.ts_living_heat_pump"]' &&
    (await calls(page)).length === 0,
  JSON.stringify(await moreInfo(page)),
);

/* ---------- the stepper: one unit, its own step ---------- */
const stepped = frame(page, 'The house’s heating · − and +').locator('fluvy-thermostats-card');
const pills = stepped.locator('.fv-stepper--value');
const value = (index) => pills.nth(index).locator('.fv-stepper__value').textContent();
const plus = (index) => pills.nth(index).locator('.fv-stepper__half').nth(1);
await reset(page);
await press(page, plus(1));
await press(page, plus(1));
const shown = (await value(1))?.trim();
const before = (await calls(page)).length;
await settle(page, 800);
check(
  'the bedroom’s + steps its own half degree twice, drawn at once, one call to that valve alone after the taps',
  shown === '20.0°' &&
    before === 0 &&
    said(await calls(page)).join() ===
      'climate.set_temperature {"temperature":20} climate.ts_bedroom',
  `${shown} · ${said(await calls(page)).join()}`,
);
await reset(page);
await press(page, plus(0));
await settle(page, 800);
check(
  'the heat pump’s + a whole degree',
  said(await calls(page)).join() ===
    'climate.set_temperature {"temperature":22} climate.ts_living_heat_pump',
  said(await calls(page)).join(),
);
check(
  'the office off and the bathroom out of reach: their pills still',
  (await pills.nth(3).locator('button[disabled]').count()) === 2 &&
    (await pills.nth(4).locator('button[disabled]').count()) === 2,
);

/* ---------- All off: asked first, then each as it takes it ---------- */
const actions = frame(page, 'The house’s heating · house actions').locator(
  'fluvy-thermostats-card',
);
const chips = actions.locator('.ts-actions .fv-chip');
check(
  'All off, then the presets they offer, each saying how many offer it where some do not',
  (await chips.allTextContents()).map((text) => text.trim()).join() ===
    'All off,Eco,Comfort,Boost 3/4',
  (await chips.allTextContents()).map((text) => text.trim()).join(),
);
await reset(page);
await asked();
await page.evaluate(() => (window.__asked.length = 0));
await press(page, chips.nth(0));
const question = await asked();
check(
  'All off asks Home Assistant first: nothing turned off before its yes',
  (await calls(page)).length === 0 &&
    question.length === 1 &&
    question[0].confirmation?.text === 'Turn off the 3 thermostats that are on?',
  JSON.stringify(question),
);
await page.evaluate(() =>
  window.dispatchEvent(
    new CustomEvent('ll-custom', { detail: window.__asked[0].tap_action, bubbles: true }),
  ),
);
await settle(page, 300);
check(
  'its yes turns off each one that is on as it takes it, never the office nor the bathroom',
  said(await calls(page)).join(' | ') ===
    [
      'climate.turn_off {} climate.ts_living_heat_pump',
      'climate.set_hvac_mode {"hvac_mode":"off"} climate.ts_bedroom',
      'climate.set_hvac_mode {"hvac_mode":"off"} climate.ts_kids_room',
    ].join(' | '),
  said(await calls(page)).join(' | '),
);

/* ---------- a preset chip: each one's own ---------- */
// a fresh page: All off above turned the house off
await page.reload();
await page.waitForSelector('html[data-ready="1"]');
await settle(page, 900);
await reset(page);
await press(page, chips.nth(3));
check(
  'Boost on each one that is on and offers it: never the heat pump, which has none, nor the office, which is off',
  said(await calls(page)).join(' | ') ===
    [
      'climate.set_preset_mode {"preset_mode":"boost"} climate.ts_bedroom',
      'climate.set_preset_mode {"preset_mode":"boost"} climate.ts_kids_room',
    ].join(' | '),
  said(await calls(page)).join(' | '),
);
await reset(page);
await press(page, chips.nth(1));
check(
  'Eco on each one that is on',
  said(await calls(page)).join(' | ') ===
    [
      'climate.set_preset_mode {"preset_mode":"eco"} climate.ts_living_heat_pump',
      'climate.set_preset_mode {"preset_mode":"eco"} climate.ts_bedroom',
      'climate.set_preset_mode {"preset_mode":"eco"} climate.ts_kids_room',
    ].join(' | '),
  said(await calls(page)).join(' | '),
);

await page.close();
await suite.finish();
