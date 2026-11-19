#!/usr/bin/env node
/**
 * The Cover card's tilt as its slats, its presets and its numbers turned round (1.22, #203) on the playground's
 * `cover-tilt` sheet (real cards, simulated hass). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-cover.mjs
 * What it proves: at a phone's column the slats stand in the side column under Position — the readout, its words and
 * the 44 picture on one bottom, the ruler the column's width, its words level with the position ruler's "Closed" —
 * and the card measures the 344 it declares (presets 56 a row more, a cover with no position 280, the steps 328 as
 * before). Dragging the slats' ruler moves the slats and the light with the finger and sends nothing; letting go sends
 * the tilt once, turned round where the cover reports it so; the keys step it. The presets send their place, the one
 * in force lit. A position counted as it comes down says so and sends Home Assistant's own number; a cover that
 * reports its position turned round shows it the right way and keeps both commands. At 211 and 152 the slats stand
 * under the commands, the picture and the ruler whole; under about 200 the steps' stepper stands there too and sets
 * the tilt; a cover with no position declares its favourites, and one whose words hold no row says its angle's
 * figure without the tilt's word; out of reach nothing takes a tap.
 */
import { rulerGeometry, dragTo, mousePointer } from './lib/gestures.mjs';
import { calls, frame, HOUSE_HEIGHTS, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
const rect = (locator) =>
  locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  });
const cardOf = (page, title) => frame(page, title).locator('fluvy-cover-card').first();
/** A readout's parts as they read: the figure, its unit, the words after it. */
const figure = (readout) =>
  readout
    .locator('.fv-readout__value > *')
    .evaluateAll((parts) => parts.map((part) => part.textContent.trim()));
/** The slats' thickness (a share of the thickest), the light's opacity, and whether they follow a finger. */
const slatsOf = (card) =>
  card.locator('.cv-slats').evaluate((el) => ({
    slat: Number(/scaleY\(([\d.]+)\)/.exec(el.querySelector('i').getAttribute('style'))[1]),
    light: Number(getComputedStyle(el.querySelector('.cv-slats__light')).opacity),
    held: el.classList.contains('is-held'),
  }));
const chips = async (row) => (await row.locator('.fv-chip').allTextContents()).map((t) => t.trim());
const lit = async (row) =>
  (await row.locator('.fv-chip.is-active').allTextContents()).map((t) => t.trim());
const sent = async (page) =>
  (await calls(page)).map(
    (call) => `${call.s} ${JSON.stringify(call.d)} ${call.t?.entity_id ?? ''}`,
  );
/** The ruler's track and its knob in a part of a card, for a mouse to drag. */
const geometryOf = (ruler) =>
  rulerGeometry(ruler.locator('.fv-ruler').first(), ruler.locator('.fv-knob').first());

const page = await suite.sheet('cover-tilt');
const pointer = mousePointer(page);

/* ---------- at a phone's column: the slats beside the position ---------- */
{
  const card = cardOf(page, 'Slats · half open');
  const side = card.locator('.dv-cover__side');
  const [column, row, readout, picture, ruler, words, closed] = await Promise.all([
    rect(side),
    rect(card.locator('.cv-tilt__row')),
    rect(card.locator('.cv-tilt .fv-readout')),
    rect(card.locator('.cv-slats')),
    rect(card.locator('.cv-tilt fluvy-ruler')),
    rect(card.locator('.cv-tilt .fv-ruler-labels span').first()),
    rect(card.locator('.dv-vlabels span').nth(1)),
  ]);
  check(
    'the slats stand under Position in the side column: the picture 44 by 44 at the row’s end, on the readout’s bottom',
    near(picture.w, 44) &&
      near(picture.h, 44) &&
      near(picture.right, column.right) &&
      near(picture.bottom, readout.bottom) &&
      near(row.h, 48),
    JSON.stringify({ column, picture, readout }),
  );
  check(
    'the ruler is the column’s width, 8 under the row; its words level with the position ruler’s “Closed”',
    near(ruler.w, column.w) && near(ruler.y, row.bottom + 8) && near(words.y, closed.y),
    JSON.stringify({ ruler, words: words.y, closed: closed.y }),
  );
  check(
    'it says 50 % and its state in words',
    JSON.stringify(await figure(card.locator('.cv-tilt .fv-readout'))) ===
      JSON.stringify(['50', '%', 'Partly open']),
  );
}

/* ---------- the heights it declares ---------- */
{
  const titles = [
    ['Slats · half open', 344],
    ['Slats · presets, its badge hidden', 488],
    ['Slats · no position', 336],
    ['Steps · as before', 328],
    ['No position · favourites', 356],
    ['Slats · no position, favourites', 412],
  ];
  const heights = [];
  for (const [title] of titles)
    heights.push(
      await cardOf(page, title).evaluate(async (el, module) => {
        const { houseHeightOf } = await import(module);
        return {
          declared: houseHeightOf({ ...el.config, type: `custom:${el.localName}` }, -1, el.hass),
          drawn: el.shadowRoot.querySelector('article').getBoundingClientRect().height,
        };
      }, HOUSE_HEIGHTS),
    );
  check(
    'each card measures what it declares: 344 with the slats, 56 a row of presets more (88 for the tilt’s under its name), 280 with no position (and its presets), 328 as before, and the favourites a cover with no position draws under their name, in the rows their words take',
    heights.every(
      ({ declared, drawn }, index) => declared === titles[index][1] && near(drawn, declared),
    ),
    JSON.stringify(heights),
  );
}

/* ---------- presets ---------- */
{
  const card = cardOf(page, 'Slats · presets, its badge hidden');
  const rows = card.locator('.cv-presets');
  const [position, tilt] = [rows.nth(0), rows.nth(1)];
  check(
    'a row for each control, the ends in words, the middle a figure, none lit where the cover stands elsewhere',
    (await chips(position)).join(',') === 'Closed,50 %,Open' &&
      (await lit(position)).length === 0 &&
      (await lit(tilt)).join(',') === '50 %',
    JSON.stringify([await chips(position), await lit(tilt)]),
  );
  await reset(page);
  await tilt.locator('.fv-chip').first().click();
  await position.locator('.fv-chip').last().click();
  await settle(page, 200);
  const picked = await sent(page);
  check(
    'a tap sends its place: the slats shut, the blind open',
    picked.join(' | ') ===
      'cover.set_cover_tilt_position {"tilt_position":0} cover.ct_office_presets | cover.set_cover_position {"position":100} cover.ct_office_presets',
    JSON.stringify(picked),
  );
  check(
    'the slats’ chip is lit at once, as the cover is on its way',
    (await lit(tilt)).join(',') === 'Closed',
  );
}

/* ---------- the slats’ ruler: they follow the finger, one call on release ---------- */
{
  const card = cardOf(page, 'Slats · half open');
  const ruler = card.locator('.cv-tilt fluvy-ruler');
  await ruler.scrollIntoViewIfNeeded();
  const geo = await geometryOf(ruler);
  await reset(page);
  const before = await slatsOf(card);
  await pointer.move(geo.at(50), geo.y);
  await pointer.down();
  await pointer.move(geo.at(70), geo.y, 6);
  await pointer.move(geo.at(90), geo.y, 12);
  await settle(page, 60);
  const during = await slatsOf(card);
  const early = await sent(page);
  await pointer.up();
  await settle(page, 400);
  const after = await sent(page);
  check(
    'under the finger the slats thin and the light brightens, at once, and nothing is sent',
    during.held && during.slat < before.slat && during.light > before.light && early.length === 0,
    JSON.stringify({ before, during, early }),
  );
  check(
    'let go, the tilt is sent once: cover.set_cover_tilt_position 90 %',
    after.length === 1 &&
      after[0] === 'cover.set_cover_tilt_position {"tilt_position":90} cover.ct_office',
    JSON.stringify(after),
  );
  check(
    'and the slats stop following the finger: they ease from then on',
    !(await slatsOf(card)).held,
  );
  // the keys walk a step
  await reset(page);
  await ruler.locator('.fv-ruler').first().focus();
  await page.keyboard.press('ArrowLeft');
  await settle(page, 200);
  const keyed = await sent(page);
  check(
    'a key takes the tilt one step: 89 %',
    keyed.length === 1 && keyed[0].startsWith('cover.set_cover_tilt_position {"tilt_position":89}'),
    JSON.stringify(keyed),
  );
}

/* ---------- a cover that reports itself turned round ---------- */
{
  const card = cardOf(page, 'Slats · a cover that reports it turned round');
  check(
    'reported 30 % and 60 %, it says 70 % open and its slats 40 %',
    JSON.stringify(await figure(card.locator('.dv-cover__side > .fv-readout'))) ===
      JSON.stringify(['70', '%']) &&
      JSON.stringify(await figure(card.locator('.cv-tilt .fv-readout'))) ===
        JSON.stringify(['40', '%', 'Partly open']),
  );
  const ruler = card.locator('.cv-tilt fluvy-ruler');
  await ruler.scrollIntoViewIfNeeded();
  await reset(page);
  await dragTo(pointer, await geometryOf(ruler), { from: 40, via: 30, to: 20 });
  await settle(page, 400);
  const tilt = await sent(page);
  check(
    'its slats dragged to 20 % send Home Assistant’s 80',
    tilt.length === 1 && tilt[0].startsWith('cover.set_cover_tilt_position {"tilt_position":80}'),
    JSON.stringify(tilt),
  );
  await reset(page);
  await card.locator('fluvy-ruler[vertical] .fv-ruler').first().focus();
  await page.keyboard.press('ArrowUp');
  await settle(page, 200);
  const position = await sent(page);
  check(
    'a step up its position sends 29, the cover’s own number for 71 % open',
    position.length === 1 && position[0].startsWith('cover.set_cover_position {"position":29}'),
    JSON.stringify(position),
  );
  check(
    'both commands stay live, and its ends say its own words',
    (await card.locator('.fv-action[disabled]').count()) === 0 &&
      (await card.locator('.dv-vlabels span').allTextContents()).join(',') === 'Up,Down',
  );
}

/* ---------- counted as it comes down ---------- */
{
  const card = cardOf(page, 'Slats · counted as it comes down');
  const lit = await card.locator('fluvy-ruler[vertical]').evaluate((el) => el.origin);
  check(
    '65 % open says “35 % down”, the ruler lit from the top',
    JSON.stringify(await figure(card.locator('.dv-cover__side > .fv-readout'))) ===
      JSON.stringify(['35', '%', 'down']) && lit === 100,
  );
  await reset(page);
  await card.locator('fluvy-ruler[vertical] .fv-ruler').first().focus();
  await page.keyboard.press('ArrowDown');
  await settle(page, 200);
  const down = await sent(page);
  check(
    'a step down sends 64: Home Assistant’s number, how far it is open',
    down.length === 1 && down[0].startsWith('cover.set_cover_position {"position":64}'),
    JSON.stringify(down),
  );
}

/* ---------- narrower: under the commands ---------- */
for (const width of [211, 152]) {
  const card = cardOf(page, `Slats · ${width}`);
  const [actions, block, picture, ruler] = await Promise.all([
    rect(card.locator('.fv-actions')),
    rect(card.locator('.cv-tilt')),
    rect(card.locator('.cv-slats')),
    rect(card.locator('.cv-tilt fluvy-ruler')),
  ]);
  const content = (await rect(card.locator('article'))).w - 40;
  check(
    `at ${width} the slats stand 16 under the commands, the picture whole and the ruler the card’s width`,
    near(block.y, actions.bottom + 16) && near(picture.w, 44) && near(ruler.w, content),
    JSON.stringify({ block: block.y, actions: actions.bottom, picture: picture.w, ruler: ruler.w }),
  );
}
{
  const card = cardOf(page, 'Steps · 152, the tilt under the commands');
  const row = card.locator('.fv-actions ~ .dv-value');
  const [now] = await figure(row);
  await reset(page);
  await row.locator('.fv-stepper__half').last().click();
  await settle(page, 900);
  const stepped = await sent(page);
  const next = Math.floor(Number(now) / 10) * 10 + 10;
  check(
    'under about 200 the steps’ stepper stands under the commands and sets the tilt again',
    stepped.length === 1 &&
      stepped[0].startsWith(`cover.set_cover_tilt_position {"tilt_position":${next}}`),
    JSON.stringify({ now, stepped }),
  );
}

/* ---------- favourites whose words hold no row ---------- */
{
  // the frame's 360 squeezed to 211, as the measurer draws a card: a viewport with room for the page's chrome alone
  const narrow = await suite.page('sheet=cover-tilt&width=211&lang=pt-PT', {
    viewport: { width: 211 + 96, height: 1000 },
  });
  /** Each favourite's chip as it reads, and whether its words stand whole in it. */
  const chipsOf = (card) =>
    card
      .locator('.fv-chip__pill')
      .evaluateAll((pills) =>
        pills.map((pill) => [pill.textContent.trim(), pill.scrollWidth <= pill.clientWidth]),
      );
  const said = await chipsOf(cardOf(narrow, 'No position · favourites'));
  const wide = await chipsOf(cardOf(page, 'No position · favourites'));
  check(
    'an angle’s favourite whose words hold no row says its figure without the tilt’s word, whole (211, Portuguese); where they hold, all of them (360)',
    JSON.stringify(said) ===
      JSON.stringify([
        ['Shade · 30 %', true],
        ['Breeze · 70 %', true],
        ['Open · 100 %', true],
      ]) &&
      JSON.stringify(wide.map(([text]) => text)) ===
        JSON.stringify(['Shade · tilt 30 %', 'Breeze · tilt 70 %', 'Open · tilt 100 %']),
    JSON.stringify({ said, wide }),
  );
  await narrow.close();
}

/* ---------- out of reach ---------- */
{
  const card = cardOf(page, 'Slats · out of reach');
  await reset(page);
  const ruler = card.locator('.cv-tilt fluvy-ruler');
  await ruler.scrollIntoViewIfNeeded();
  await dragTo(pointer, await geometryOf(ruler), { from: 50, via: 60, to: 80 });
  await settle(page, 300);
  check(
    'out of reach: “—”, no light, and the ruler takes no drag',
    JSON.stringify(await figure(card.locator('.cv-tilt .fv-readout'))) === JSON.stringify(['—']) &&
      (await slatsOf(card)).light === 0 &&
      (await sent(page)).length === 0,
  );
}

await page.close();
await suite.finish();
