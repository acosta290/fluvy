#!/usr/bin/env node
/**
 * A tile's switch as a wall rocker (`switch_style: rocker`, #177) on the playground's `tile-rocker` sheet (real cards,
 * simulated hass). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-tile-rocker.mjs
 * What it proves: asked for a rocker, a large tile keeps its 168 and draws a 32 by 44 plate where its toggle stood —
 * on its circle's line, 8 or more from it, its end on the tile's edge, in a 44 by 44 target — with no ruler at its
 * foot and no level on its line; the plate is a switch a reader hears by the tile's name, which a finger, Space and
 * Enter flip at once, its raised half and its bar following, and the rest of the tile is its own button still (a tap
 * opens the details, a hold runs the hold action). It holds beside the circle at 152 and gives way to the circle under
 * 116; out of reach it is the off skin, faded and still (at full strength where the tile is quiet); a cover's breathes
 * on its way and a tap stops it there. A compact tile's stands at its row's end, centred on it, its words clear of it
 * and its circle given to them under 228; a mini tile keeps its circle. A group says it for its tiles and a tile
 * answers otherwise; the room card's tiles, the room lights card's and the template card's follow; read by its edges the raised half is drawn
 * by its edge; without motion it flips at once; and the automatic dashboard plans the height each tile measures.
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
const circleOf = (tile) => tile.locator('.fv-ico').first();
const hitOf = (tile) => tile.locator('.fv-hit--rocker');
const rockerOf = (tile) => tile.locator('.fv-rocker');
const lineOf = (tile) => text(tile.locator('.fv-tile__state'));
const said = (list) => list.map((call) => `${call.s} ${call.t?.entity_id ?? ''}`).join(', ');
/** What a rocker paints: its raised half (`upper` or `lower`), its bar's colour, its own opacity. */
const paintOf = (rocker) =>
  rocker.evaluate((el) => {
    const half = (pseudo) => {
      const cs = getComputedStyle(el, pseudo);
      return { fill: cs.backgroundColor, shadow: cs.boxShadow, flip: cs.transitionDuration };
    };
    const [upper, lower] = [half('::before'), half('::after')];
    const bar = getComputedStyle(el.querySelector('.fv-rocker__bar'));
    return {
      // the pressed half is the key let through (a colour with an alpha); the raised one the key itself, opaque
      raised: /[/,] ?0?\.\d+\)$/.test(upper.fill) ? 'lower' : 'upper',
      upper,
      lower,
      bar: bar.backgroundColor,
      breathes: bar.animationName,
      opacity: getComputedStyle(el).opacity,
    };
  });

const page = await suite.sheet('tile-rocker');

/* ---------- the wall: six tiles, each its plate where the toggle stood ---------- */
{
  const tiles = tilesOf(page, 'A wall of six');
  const boxes = await tiles.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }),
  );
  check(
    'the wall: six tiles of 172 by 168, as with their toggles',
    boxes.length === 6 && boxes.every((box) => near(box.w, 172) && near(box.h, 168)),
    JSON.stringify(boxes),
  );
  const geometry = [];
  for (let i = 0; i < 6; i += 1) {
    const tile = tiles.nth(i);
    const [card, ring, plate, hit] = [
      await rect(tile),
      await rect(circleOf(tile)),
      await rect(rockerOf(tile)),
      await rect(hitOf(tile)),
    ];
    geometry.push(
      near(plate.w, 32) &&
        near(plate.h, 44) &&
        near(plate.right, card.right - 16) &&
        near(plate.y, ring.y) &&
        plate.x >= ring.right + 8 &&
        near(hit.w, 44) &&
        near(hit.h, 44) &&
        near(hit.x + hit.w / 2, plate.x + plate.w / 2),
    );
  }
  check(
    'each plate is 32 by 44 on its circle’s line, clear of it, its end on the tile’s edge, in a 44 target centred on it',
    geometry.every(Boolean),
    JSON.stringify(geometry),
  );
  check(
    'no tile has a ruler, and each line says its state alone: a light that dims and a fan too',
    (await tiles.locator('fluvy-ruler').count()) === 0 &&
      (await lineOf(tiles.nth(1))) === 'On' &&
      (await lineOf(tiles.nth(4))) === 'On' &&
      (await lineOf(tiles.nth(5))) === 'Open',
    `${await lineOf(tiles.nth(1))} · ${await lineOf(tiles.nth(4))} · ${await lineOf(tiles.nth(5))}`,
  );
  check(
    'no tile draws a toggle, and no circle is a switch',
    (await tiles.locator('.fv-switch').count()) === 0 &&
      (await tiles.locator('.fv-ico[role="switch"]').count()) === 0,
  );
}

/* ---------- the plate: a switch that flips at once ---------- */
const wall = tilesOf(page, 'A wall of six');
const porch = wall.nth(0);
const rocker = rockerOf(porch);
{
  const [on, off] = [await paintOf(rocker), await paintOf(rockerOf(wall.nth(2)))];
  check(
    'the plate is a switch a reader hears by the tile’s name',
    (await rocker.getAttribute('role')) === 'switch' &&
      (await rocker.getAttribute('aria-checked')) === 'true' &&
      (await rocker.getAttribute('aria-label')) === 'Porch' &&
      (await rocker.getAttribute('tabindex')) === '0',
  );
  check(
    'on, its lower half is the raised one and its bar is lit; off, the upper one and the bar rests',
    on.raised === 'lower' && off.raised === 'upper' && on.bar !== off.bar,
    JSON.stringify({ on: [on.raised, on.bar], off: [off.raised, off.bar] }),
  );
  check(
    'its halves flip in 120 ms',
    on.upper.flip.split(', ').every((d) => d === '0.12s'),
    on.upper.flip,
  );
}

await reset(page);
await tapAt(page, rocker);
await settle(page, 300);
{
  const sent = await calls(page);
  check(
    'a finger on the plate turns the light off, and opens nothing',
    sent.length === 1 &&
      sent[0].s === 'light.turn_off' &&
      sent[0].t?.entity_id === 'light.tr_porch' &&
      (await moreInfo(page)).length === 0,
    said(sent),
  );
  const paint = await paintOf(rocker);
  check(
    '…the plate says so, its upper half comes up, its bar goes out and the tile loses its fill',
    (await rocker.getAttribute('aria-checked')) === 'false' &&
      paint.raised === 'upper' &&
      !(await porch.evaluate((el) => el.classList.contains('is-on'))) &&
      (await lineOf(porch)) === 'Off',
    JSON.stringify([paint.raised, await lineOf(porch)]),
  );
}
await reset(page);
await rocker.focus();
await page.keyboard.press('Space');
await settle(page, 300);
{
  const sent = await calls(page);
  check(
    'Space on the plate turns it on again',
    sent.length === 1 &&
      sent[0].s === 'light.turn_on' &&
      (await rocker.getAttribute('aria-checked')) === 'true',
    said(sent),
  );
}
await reset(page);
await page.keyboard.press('Enter');
await settle(page, 300);
check(
  '…and Enter off',
  said(await calls(page)) === 'light.turn_off light.tr_porch' &&
    (await rocker.getAttribute('aria-checked')) === 'false',
  said(await calls(page)),
);
await tapAt(page, rocker);
await settle(page, 300);
await reset(page);

// the rest of the tile is its own button: the name, and the foot the ruler left
await tapAt(page, porch.locator('.fv-tile__name'));
check(
  'a tap on the name opens the details and switches nothing',
  (await moreInfo(page)).join() === 'light.tr_porch' && (await calls(page)).length === 0,
);
await reset(page);
{
  const card = await rect(porch);
  await page.mouse.click(card.x + card.w / 2, card.bottom - 24);
  check(
    'a tap on the foot, where the ruler stood, opens the details too',
    (await moreInfo(page)).join() === 'light.tr_porch' && (await calls(page)).length === 0,
  );
  await reset(page);
  await page.mouse.move(card.x + 24, card.bottom - 24);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await settle(page, 200);
  check(
    'a still press on the tile runs its hold action once: the details',
    (await moreInfo(page)).join() === 'light.tr_porch' && (await calls(page)).length === 0,
    (await moreInfo(page)).join(),
  );
}
await reset(page);
await porch.locator('.fv-tile__tap').focus();
await page.keyboard.press('Enter');
check(
  'Enter on the tile opens the details: two stops, the plate and the tile',
  (await moreInfo(page)).join() === 'light.tr_porch' && (await calls(page)).length === 0,
);
await reset(page);

/* ---------- 152: beside the toggle it stands in for; three a row: the circle ---------- */
{
  const tiles = tilesOf(page, '152 · rocker and toggle');
  const [card, ring, plate] = [
    await rect(tiles.nth(0)),
    await rect(circleOf(tiles.nth(0))),
    await rect(rockerOf(tiles.nth(0))),
  ];
  const toggle = await rect(tiles.nth(1).locator('.fv-switch'));
  check(
    '152: the tile keeps its 168, its plate on the edge the toggle ends on',
    near(card.w, 152) &&
      near(card.h, 168) &&
      near(plate.right, card.right - 16) &&
      plate.x >= ring.right + 8 &&
      near(toggle.right - (await rect(tiles.nth(1))).right, plate.right - card.right),
    JSON.stringify({ card, plate, toggle }),
  );
  const three = tilesOf(page, 'Three a row');
  check(
    'three a row: no plate under 116, the circle the switch, and still no ruler nor level',
    (await three.locator('.fv-hit').count()) === 0 &&
      (await circleOf(three.nth(0)).getAttribute('role')) === 'switch' &&
      (await three.locator('fluvy-ruler').count()) === 0 &&
      (await lineOf(three.nth(0))) === 'On',
    await lineOf(three.nth(0)),
  );
}

/* ---------- out of reach, and a cover on its way ---------- */
{
  const tiles = tilesOf(page, 'On, off, on its way, out of reach');
  const shed = tiles.nth(3);
  const dead = await paintOf(rockerOf(shed));
  check(
    'out of reach: the off skin, faded as a switch is, and no stop for the keys',
    (await rockerOf(shed).getAttribute('aria-disabled')) === 'true' &&
      (await rockerOf(shed).getAttribute('aria-checked')) === 'false' &&
      (await rockerOf(shed).getAttribute('tabindex')) === '-1' &&
      dead.raised === 'upper' &&
      dead.opacity === '0.4' &&
      near((await rect(shed)).h, 168),
    JSON.stringify([dead.raised, dead.opacity]),
  );
  await tapAt(page, rockerOf(shed));
  check(
    '…a tap on it is the tile’s: its details, nothing switched',
    (await moreInfo(page)).join() === 'light.tr_shed' && (await calls(page)).length === 0,
  );
  await reset(page);
  const quiet = tilesOf(page, 'Quiet out of reach · a helper').nth(0);
  check(
    'quiet out of reach: the plate at full strength, still disabled',
    (await paintOf(rockerOf(quiet))).opacity === '1' &&
      (await rockerOf(quiet).getAttribute('aria-disabled')) === 'true',
  );

  const shutters = tiles.nth(2);
  const moving = await paintOf(rockerOf(shutters));
  check(
    'a cover on its way up: its lower half raised, its bar lit and breathing, a reader told a tap stops it',
    moving.raised === 'lower' &&
      moving.breathes === 'rk-breathe' &&
      (await rockerOf(shutters).getAttribute('aria-label')) === 'Shutters · Stop' &&
      (await lineOf(shutters)) === 'Opening',
    JSON.stringify([moving.raised, moving.breathes, await lineOf(shutters)]),
  );
  await tapAt(page, rockerOf(shutters));
  await settle(page, 300);
  const sent = await calls(page);
  check(
    '…and a tap stops it there: its bar rests lit, and its next tap closes it',
    sent.length === 1 &&
      sent[0].s === 'cover.stop_cover' &&
      sent[0].t?.entity_id === 'cover.tr_shutters' &&
      (await paintOf(rockerOf(shutters))).breathes === 'none' &&
      (await rockerOf(shutters).getAttribute('aria-label')) === 'Shutters',
    said(sent),
  );
  await reset(page);
  await tapAt(page, rockerOf(shutters));
  await settle(page, 300);
  check(
    '…back the way it came',
    said(await calls(page)) === 'cover.close_cover cover.tr_shutters',
    said(await calls(page)),
  );
  await reset(page);
}

/* ---------- compact: the plate at the row's end; mini: the circle ---------- */
{
  const two = tilesOf(page, 'Compact · two a row');
  const tile = two.nth(0);
  const [card, plate, words] = [
    await rect(tile),
    await rect(rockerOf(tile)),
    await rect(tile.locator('.fv-tile__text')),
  ];
  check(
    'compact, two a row: 76 tall, the plate at the row’s end and centred on it, the words 12 clear of it',
    near(card.h, 76) &&
      near(plate.right, card.right - 16) &&
      near(plate.y + plate.h / 2, card.y + card.h / 2) &&
      near(words.right, plate.x - 12) &&
      near(words.x, card.x + 16),
    JSON.stringify({ card, plate, words }),
  );
  check(
    '…its circle given to its words, as a tile under 228 gives it',
    (await circleOf(tile).evaluate((el) => getComputedStyle(el).display)) === 'none' &&
      (await text(tile.locator('.fv-tile__name'))) === 'Porch' &&
      (await lineOf(tile)) === 'On',
  );
  await tapAt(page, tile.locator('.fv-tile__name'));
  check(
    'a tap on a compact tile opens its details: the plate is its switch',
    (await moreInfo(page)).join() === 'light.tr_porch' && (await calls(page)).length === 0,
    said(await calls(page)),
  );
  await reset(page);
  await tapAt(page, rockerOf(tile));
  await settle(page, 300);
  check(
    '…and a tap on the plate switches it',
    said(await calls(page)) === 'light.turn_off light.tr_porch' &&
      (await moreInfo(page)).length === 0,
    said(await calls(page)),
  );
  await tapAt(page, rockerOf(tile));
  await settle(page, 300);
  await reset(page);

  const one = tilesOf(page, 'Compact · one a row').nth(0);
  const [wide, ring, end] = [await rect(one), await rect(circleOf(one)), await rect(rockerOf(one))];
  check(
    'compact, one a row: the circle kept, the plate at the far end',
    near(ring.w, 44) && near(ring.x, wide.x + 16) && near(end.right, wide.right - 16),
    JSON.stringify({ ring, end }),
  );

  const minis = tilesOf(page, 'Mini keeps its circle');
  await tapAt(page, minis.nth(1).locator('.fv-tile__name'));
  await settle(page, 300);
  check(
    'a mini tile has no plate: its circle stays, and a tap on the tile switches it as it did',
    (await minis.locator('.fv-hit').count()) === 0 &&
      near((await rect(minis.nth(0))).h, 108) &&
      said(await calls(page)) === 'light.turn_on light.tr_driveway',
    said(await calls(page)),
  );
  await tapAt(page, minis.nth(1).locator('.fv-tile__name'));
  await settle(page, 300);
  await reset(page);
}

/* ---------- the group's word and a tile's own; no switch, no rocker ---------- */
{
  const styles = (tiles) =>
    tiles.evaluateAll((els) =>
      els.map((el) =>
        el.querySelector('.fv-rocker') ? 'rocker' : el.querySelector('.fv-switch') ? 'toggle' : '',
      ),
    );
  check(
    'a group in rockers, a tile that keeps its toggle and its ruler',
    (await styles(tilesOf(page, 'A group in rockers, one tile a toggle'))).join() ===
      'rocker,toggle' &&
      (await tilesOf(page, 'A group in rockers, one tile a toggle')
        .nth(1)
        .locator('fluvy-ruler')
        .count()) === 1,
  );
  check(
    'a group in toggles, a tile that asks for its rocker',
    (await styles(tilesOf(page, 'A group in toggles, one tile a rocker'))).join() ===
      'rocker,toggle',
  );
  const none = tilesOf(page, 'No switch, no rocker');
  check(
    'asked to hide its switch, or to say its value there, a tile draws no plate and keeps its ruler',
    (await none.locator('.fv-hit').count()) === 0 &&
      (await none.locator('fluvy-ruler').count()) === 2 &&
      (await text(none.nth(1).locator('.fv-tile__value'))) === '70 %',
  );
}

/* ---------- the room card's tiles, the room lights card's, the template card's ---------- */
{
  const room = tilesOf(page, 'Room card');
  const boxes = [];
  for (let i = 0; i < 4; i += 1) {
    const [card, plate] = [await rect(room.nth(i)), await rect(rockerOf(room.nth(i)))];
    boxes.push(near(card.h, 84) && near(plate.right, card.right - 16) && near(plate.h, 44));
  }
  check('the room card: four inner tiles of 84, each its plate at its end', boxes.every(Boolean));
  await tapAt(page, rockerOf(room.nth(0)));
  await settle(page, 300);
  check(
    '…a plate switches its tile’s light',
    said(await calls(page)) === 'light.turn_on light.tr_steps',
    said(await calls(page)),
  );
  await tapAt(page, rockerOf(room.nth(0)));
  await settle(page, 300);
  await reset(page);

  const lights = tilesOf(page, 'Room lights card');
  check(
    'the room lights card: each light’s tile its plate at its end, its line the state alone',
    (await lights.count()) === 4 &&
      (await lights.locator('.fv-rocker').count()) === 4 &&
      (await lineOf(lights.nth(0))) === 'On' &&
      (await lineOf(lights.nth(1))) === 'Off',
    `${await lineOf(lights.nth(0))} · ${await lineOf(lights.nth(1))}`,
  );

  const template = tilesOf(page, 'Template card');
  check(
    'the template card: its large tiles and its compact one each draw the plate, its words its own',
    (await template.locator('.fv-rocker').count()) === 3 &&
      (await lineOf(template.nth(0))) === 'Until sunrise' &&
      near((await rect(template.nth(2))).h, 76),
    await lineOf(template.nth(0)),
  );
}

/* ---------- read by its edges; on a solid fill ---------- */
{
  const line = tilesOf(page, 'E-ink · a wall of six');
  const [on, off] = [await paintOf(rockerOf(line.nth(0))), await paintOf(rockerOf(line.nth(2)))];
  const edged = (shadow) =>
    /inset/.test(shadow) && !/rgba\(0, 0, 0, 0\) 0px 0px 0px 1px inset/.test(shadow);
  check(
    'E-ink: nothing casts a shadow, so the raised half is drawn by its edge',
    edged(on.lower.shadow) && edged(off.upper.shadow) && on.lower.shadow !== on.upper.shadow,
    JSON.stringify([on.lower.shadow, off.upper.shadow]),
  );
  const volt = await paintOf(rockerOf(tilesOf(page, 'Volt · a solid fill').nth(0)));
  check(
    'a solid fill: the raised half is the card’s colour, the bar the fill’s ink',
    volt.raised === 'lower' && volt.lower.fill !== volt.bar,
    JSON.stringify([volt.lower.fill, volt.bar]),
  );
}

/* ---------- the heights the automatic dashboard plans ---------- */
for (const title of ['On, off, on its way, out of reach', 'Readings · a long name']) {
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
    heights.length >= 2 &&
      heights.every(({ declared, drawn }) => declared === 168 && near(drawn, 168)),
    JSON.stringify(heights),
  );
}
await page.close();

/* ---------- dark; without motion ---------- */
{
  const dark = await suite.sheet('tile-rocker', { extra: '&mode=dark' });
  const tiles = tilesOf(dark, 'A wall of six');
  const [on, off] = [await paintOf(rockerOf(tiles.nth(0))), await paintOf(rockerOf(tiles.nth(2)))];
  check(
    'dark: each state keeps its raised half and its bar, in the mode’s own colours',
    on.raised === 'lower' && off.raised === 'upper' && on.bar !== off.bar,
    JSON.stringify({ on: [on.lower.fill, on.bar], off: [off.upper.fill, off.bar] }),
  );
  await dark.close();

  const still = await suite.page('sheet=tile-rocker&width=360&lang=en', {
    reducedMotion: 'reduce',
  });
  const moving = rockerOf(tilesOf(still, 'On, off, on its way, out of reach').nth(2));
  const paint = await paintOf(moving);
  const breath = await moving.evaluate((el) => {
    const bar = getComputedStyle(el.querySelector('.fv-rocker__bar'));
    return [bar.animationDuration, bar.animationIterationCount];
  });
  check(
    'without motion the halves flip at once and the bar does not breathe',
    paint.upper.flip.split(', ').every((d) => d === '0s') && breath.join() === '0.001s,1',
    JSON.stringify([paint.upper.flip, breath]),
  );
  await still.close();
}

await suite.finish();
