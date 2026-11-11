#!/usr/bin/env node
/**
 * A large tile without its switch (`show_switch`, #160) on the playground's `tile-switch` sheet (real cards, simulated
 * hass). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-tile-switch.mjs
 * What it proves: asked not to show its switch, a large tile draws none and keeps its 168, two a row on a phone (172)
 * and in half a desktop section (152); its circle is the switch — a button of 44 by 44 a reader hears as a switch by
 * the tile's name, which a finger, Space and Enter flip — and the rest of the tile is its own button still, the head's
 * free end with it: a tap there opens the details and switches nothing, a hold runs the hold action, Enter opens. Out
 * of reach the circle is no button and a tap on it is the tile's. With `value` the level's figure ends the head on the
 * circle's line, 8 or more from it and on the tile's right edge, the line under the name saying the state alone, and
 * goes when the light does; three a row the circle is the switch whatever is asked and the figure stays on its line.
 * A group says it for its tiles and a tile answers otherwise; a tile asked to toggle on its tap does; a tile that is
 * its own slider keeps its circle; the template card's large tile follows; and the automatic dashboard plans the
 * height each of them measures.
 */
import { calls, frame, HOUSE_HEIGHTS, moreInfo, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim();
const rect = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  });
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
/** A real click at a point of a part, on whatever the browser hit-tests there. */
const tapAt = async (page, locator, fx = 0.5, fy = 0.5) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
};
const tilesOf = (page, title) => frame(page, title).locator('article.fv-tile');
const circleOf = (tile) => tile.locator('.fv-tile__head > .fv-ico');
const lineOf = (tile) => text(tile.locator('.fv-tile__state'));
const said = (list) => list.map((call) => `${call.s} ${call.t?.entity_id ?? ''}`).join(', ');

const page = await suite.sheet('tile-switch');

/* ---------- hidden: no switch, the same tile, the circle a switch ---------- */
for (const [title, width] of [
  ['172 · no switch', 172],
  ['152 · no switch', 152],
]) {
  const tiles = tilesOf(page, title);
  const boxes = await tiles.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }),
  );
  check(
    `${title}: every tile is ${width} by 168, as with its switch`,
    boxes.length >= 2 && boxes.every((box) => near(box.w, width) && near(box.h, 168)),
    JSON.stringify(boxes),
  );
  check(`${title}: no tile draws a switch`, (await tiles.locator('.fv-hit').count()) === 0);
}
{
  const today = tilesOf(page, '172 · switch');
  check(
    'today: the live tiles and the one out of reach draw their switch',
    (await today.locator('.fv-hit').count()) === 4,
  );
}

const hidden = tilesOf(page, '172 · no switch');
const ceiling = hidden.nth(0);
const circle = circleOf(ceiling);
{
  const box = await rect(circle);
  check(
    'the circle is a switch of 44 by 44 a reader hears by the tile’s name',
    (await circle.evaluate((el) => el.tagName)) === 'BUTTON' &&
      (await circle.getAttribute('role')) === 'switch' &&
      (await circle.getAttribute('aria-checked')) === 'true' &&
      (await circle.getAttribute('aria-label')) === 'Ceiling' &&
      near(box.w, 44) &&
      near(box.h, 44),
    JSON.stringify(box),
  );
  check(
    'its line says the state and the level, as it did',
    (await lineOf(ceiling)) === 'On · 70 %',
  );
}

await reset(page);
await tapAt(page, circle);
await settle(page, 300);
{
  const sent = await calls(page);
  check(
    'a finger on the circle turns the light off, and opens nothing',
    sent.length === 1 &&
      sent[0].s === 'light.turn_off' &&
      sent[0].t?.entity_id === 'light.ts_ceiling' &&
      (await moreInfo(page)).length === 0,
    said(sent),
  );
  check(
    '…the circle says so, and the tile loses its fill',
    (await circle.getAttribute('aria-checked')) === 'false' &&
      !(await ceiling.evaluate((el) => el.classList.contains('is-on'))),
  );
}
await reset(page);
await circle.focus();
await page.keyboard.press('Space');
await settle(page, 300);
{
  const sent = await calls(page);
  check(
    'Space on the circle turns it on again',
    sent.length === 1 &&
      sent[0].s === 'light.turn_on' &&
      (await circle.getAttribute('aria-checked')) === 'true',
    said(sent),
  );
}
await reset(page);

// the rest of the tile is its own button: the name, and the head's end where the switch stood
await tapAt(page, ceiling.locator('.fv-tile__name'));
check(
  'a tap on the name opens the details and switches nothing',
  (await moreInfo(page)).join() === 'light.ts_ceiling' && (await calls(page)).length === 0,
);
await reset(page);
{
  const head = await rect(ceiling.locator('.fv-tile__head'));
  await page.mouse.click(head.right - 24, head.y + head.h / 2);
  check(
    'a tap on the head’s free end, where the switch stood, opens the details too',
    (await moreInfo(page)).join() === 'light.ts_ceiling' && (await calls(page)).length === 0,
  );
}
await reset(page);
{
  const name = await rect(ceiling.locator('.fv-tile__name'));
  await page.mouse.move(name.x + 20, name.y + name.h / 2);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await settle(page, 200);
  check(
    'a still press on the tile runs its hold action once: the details',
    (await moreInfo(page)).join() === 'light.ts_ceiling' && (await calls(page)).length === 0,
    (await moreInfo(page)).join(),
  );
}
await reset(page);
await ceiling.locator('.fv-tile__tap').focus();
await page.keyboard.press('Enter');
check(
  'Enter on the tile opens the details: two stops, the circle and the tile',
  (await moreInfo(page)).join() === 'light.ts_ceiling' && (await calls(page)).length === 0,
);
await reset(page);

// out of reach: the dashed circle is not pressed, the ruler rests, the tile keeps its size
{
  const porch = hidden.nth(3);
  const ring = circleOf(porch);
  check(
    'out of reach the circle is no button, and the ruler rests',
    (await ring.evaluate((el) => el.tagName)) === 'SPAN' &&
      (await porch.locator('fluvy-ruler').getAttribute('inert')) !== null &&
      (await lineOf(porch)).startsWith('Unavailable'),
  );
  await tapAt(page, ring);
  check(
    '…a tap on it is the tile’s: its details, nothing switched',
    (await moreInfo(page)).join() === 'light.ts_porch' && (await calls(page)).length === 0,
  );
  await reset(page);
}

/* ---------- value: the level's figure where the switch stood ---------- */
for (const title of ['172 · value', '152 · value', '152 · value at 100 %']) {
  const tile = tilesOf(page, title).nth(0);
  const figure = tile.locator('.fv-tile__value');
  const [ring, value, card] = [await rect(circleOf(tile)), await rect(figure), await rect(tile)];
  check(
    `${title}: the figure ends the head on the circle’s line, clear of it, on the tile’s edge`,
    near(value.right, card.right - 16, 1) &&
      value.x >= ring.right + 8 &&
      near(value.y + value.h / 2, ring.y + ring.h / 2, 1) &&
      (await tile.locator('.fv-hit').count()) === 0,
    `${await text(figure)} · ${JSON.stringify({ ring, value })}`,
  );
}
{
  const tiles = tilesOf(page, '172 · value');
  const lamp = tiles.nth(0);
  check(
    'value: "70 %" in the head, the line the state alone; off, on with readings and out of reach say none',
    (await text(lamp.locator('.fv-tile__value'))) === '70 %' &&
      (await lineOf(lamp)) === 'On' &&
      (await tiles.locator('.fv-tile__value').count()) === 1 &&
      (await lineOf(tiles.nth(1))) === 'Off' &&
      (await lineOf(tiles.nth(2))) === 'On',
  );
  await tapAt(page, circleOf(lamp));
  await settle(page, 300);
  check(
    '…its circle switches it, and the figure goes with the light',
    (await calls(page)).length === 1 &&
      (await lamp.locator('.fv-tile__value').count()) === 0 &&
      (await lineOf(lamp)) === 'Off',
    said(await calls(page)),
  );
  await reset(page);
  await tapAt(page, circleOf(lamp));
  await settle(page, 300);
  check(
    '…and comes back with it',
    (await text(lamp.locator('.fv-tile__value'))) === '70 %' && (await lineOf(lamp)) === 'On',
    await lineOf(lamp),
  );
  await reset(page);
  const full = tilesOf(page, '152 · value at 100 %');
  check(
    'value: the widest figure holds at 152, and a cover says its position',
    (await text(full.nth(0).locator('.fv-tile__value'))) === '100 %' &&
      (await text(full.nth(1).locator('.fv-tile__value'))) === '65 %' &&
      (await lineOf(full.nth(1))) === 'Open',
  );
  const levels = tilesOf(page, 'Levels · value');
  check(
    'value: a fan’s speed, a muted player’s volume with its word; a plug has none',
    (await text(levels.nth(1).locator('.fv-tile__value'))) === '33 %' &&
      (await text(levels.nth(2).locator('.fv-tile__value'))) === '30 %' &&
      (await lineOf(levels.nth(2))) === 'Muted' &&
      (await levels.nth(3).locator('.fv-tile__value').count()) === 0,
  );
}

/* ---------- three a row: the circle is the switch whatever is asked ---------- */
for (const word of ['switch', 'no switch', 'value']) {
  const tiles = tilesOf(page, `Three a row · ${word}`);
  const lamp = tiles.nth(0);
  check(
    `three a row · ${word}: no switch apart, the circle the switch, the level on its line`,
    (await tiles.locator('.fv-hit').count()) === 0 &&
      (await circleOf(lamp).getAttribute('role')) === 'switch' &&
      (await tiles.locator('.fv-tile__value').count()) === 0 &&
      (await lineOf(lamp)) === 'On · 70 %',
    await lineOf(lamp),
  );
}

/* ---------- the group's word and a tile's own ---------- */
{
  const without = tilesOf(page, 'A group without, one tile with');
  check(
    'a group without its switches, a tile that asks for its own',
    (await without.nth(0).locator('.fv-hit').count()) === 0 &&
      (await without.nth(1).locator('.fv-hit').count()) === 1,
  );
  const withIt = tilesOf(page, 'A group with, one tile without');
  check(
    'a group with its switches, a tile that says its value instead',
    (await withIt.nth(0).locator('.fv-hit').count()) === 0 &&
      (await withIt.nth(0).locator('.fv-tile__value').count()) === 1 &&
      (await withIt.nth(1).locator('.fv-hit').count()) === 1,
  );
}

/* ---------- a tile asked to toggle on its tap; a tile that is its own slider; the template card ---------- */
{
  const patio = tilesOf(page, 'Quiet out of reach · tap toggles').nth(1);
  await tapAt(page, patio.locator('.fv-tile__name'));
  await settle(page, 300);
  const sent = await calls(page);
  check(
    'tap_action: toggle — a tap on the tile switches it, and opens nothing',
    sent.length === 1 && sent[0].s === 'switch.turn_off' && (await moreInfo(page)).length === 0,
    said(sent),
  );
  await reset(page);
  const quiet = tilesOf(page, 'Quiet out of reach · tap toggles').nth(0);
  check(
    'quiet out of reach: its own glyph at rest, no button',
    (await circleOf(quiet).evaluate((el) => el.tagName)) === 'SPAN' &&
      (await quiet.getAttribute('data-unavailable')) === 'quiet',
  );

  // a tile that is its own slider: its circle is raised over the ruler that covers it
  const fill = tilesOf(page, 'Fill').nth(0);
  await tapAt(page, circleOf(fill));
  await settle(page, 300);
  await tapAt(page, circleOf(fill));
  await settle(page, 300);
  const flipped = await calls(page);
  check(
    'fill: the circle switches the tile that is its own slider, off and on again, and slides nothing',
    said(flipped) === 'light.turn_off light.ts_ceiling, light.turn_on light.ts_ceiling' &&
      flipped.every((call) => !('brightness_pct' in (call.d ?? {}))),
    said(flipped),
  );
  await reset(page);

  const template = tilesOf(page, 'Template card');
  check(
    'the template card’s large tile: no switch, its circle the switch; its value where asked',
    (await template.locator('.fv-hit').count()) === 0 &&
      (await circleOf(template.nth(0)).getAttribute('role')) === 'switch' &&
      (await template.nth(1).locator('.fv-tile__value').count()) === 1,
  );
}

/* ---------- the heights the automatic dashboard plans ---------- */
for (const title of [
  '152 · no switch',
  '152 · value',
  'Tile cards · no switch',
  'Tile cards · value',
]) {
  const cards = frame(page, title).locator('fluvy-tile-card');
  const heights = await cards.evaluateAll(async (els, module) => {
    const { houseHeightOf } = await import(module);
    return els.map((el) => ({
      declared: houseHeightOf({ ...el.config, type: `custom:${el.localName}` }, -1, el.hass),
      drawn: el.shadowRoot.querySelector('article').getBoundingClientRect().height,
    }));
  }, HOUSE_HEIGHTS);
  check(
    `${title}: each card measures the 168 it declares`,
    heights.length === 2 &&
      heights.every(({ declared, drawn }) => declared === 168 && near(drawn, 168)),
    JSON.stringify(heights),
  );
}

await page.close();
await suite.finish();
