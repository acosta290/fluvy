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
 * key of the card one width, its words 12 from its sides at least. And on the `round-gauges` sheet (#257): a round's
 * gauge in its four styles at its reading's share of its range, either side of zero, in its band's tone, said to a
 * reader; in its ring's place on a lit round, none out of reach; on its key and on a row's circle, no size changed;
 * moved by a new reading; and drawn by a room's quick actions, the Rooms card and a thermostat's rounds.
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

/* ---------- #257: a gauge on a round ---------- */
{
  const gauges = await suite.sheet('round-gauges');
  /** Each round of a frame's first card: its gauge's style and share, its box, its words and what a reader hears. */
  const read = (title, selector = '.lt-bulb') =>
    frame(gauges, title)
      .locator('fluvy-rounds-card')
      .first()
      .evaluate(
        (card, of) =>
          [...card.shadowRoot.querySelectorAll(of)].map((round) => {
            const layer = round.querySelector('.rg');
            const box = round.getBoundingClientRect();
            const over = layer?.getBoundingClientRect();
            return {
              style: layer ? layer.className.replace(/^rg rg--(\w+).*$/, '$1') : null,
              tone: layer ? layer.className.replace(/^.*fv-tone--/, '') : null,
              share: layer ? Number(getComputedStyle(layer).getPropertyValue('--fv-gauge')) : null,
              // the layer is the round's own box, wherever it is drawn
              fits: !over || (Math.abs(over.width - box.width) < 0.5 && over.left === box.left),
              width: box.width,
              height: box.height,
              first: !layer || round.firstElementChild === layer,
              off: round.classList.contains('fv-ico--off'),
              lit: round.classList.contains('is-on'),
              label: round.getAttribute('aria-label'),
            };
          }),
        selector,
      );
  const five = await read('Quick picks · the issue’s five');
  check(
    'the issue’s five: an arc, an arc from zero, a sector, a flood and a plain round, each a 44 round at rest',
    five.map((round) => round.style).join() === 'arc,zero,sector,fill,' &&
      five.every(
        ({ width, height, lit, fits, first }) =>
          width === 44 && height === 44 && !lit && fits && first,
      ),
    JSON.stringify(five),
  );
  check(
    'each stands where its reading is in its range: the battery’s share, the drift of ±2, the tank between 30 and 90',
    five
      .slice(0, 4)
      .map((round) => round.share)
      .join() === '0.72,0.21,0.267,0.35',
    five.map((round) => round.share).join(),
  );
  check(
    'a reader hears its reading in its decimals and its band’s name; the drift wears its band’s tone',
    five[1].label === 'Bedroom drift, 0.42 °C/h, Heating' &&
      five[1].tone === 'heat' &&
      five[0].label === 'Wall tablet, 72 %',
    JSON.stringify(five.map((round) => [round.label, round.tone])),
  );
  const across = await read('Arc · across its range');
  const drifts = await read('From zero · either side of it');
  check(
    'a share of its range, and a reading past an end on it; either side of zero, cooling to the left',
    across.map((round) => round.share).join() === '0,0.25,0.5,1,1' &&
      drifts.map((round) => round.share).join() === '-1,-0.12,0,0.65,1' &&
      drifts.map((round) => round.tone).join() === 'cool,cool,heat,heat,heat',
    JSON.stringify({
      across: across.map((r) => r.share),
      drifts: drifts.map((r) => [r.share, r.tone]),
    }),
  );
  const bands = await read('Thresholds · the house’s batteries');
  check(
    'a battery’s flood in its band’s colour: fine from 50 %, its own under it, low under 20 %, nearly empty under 10 %',
    bands.map((round) => round.tone).join() === 'ok,accent,warning,danger' &&
      bands[2].label === 'Remote, 16 %, Low',
    JSON.stringify(bands.map((round) => [round.tone, round.label])),
  );
  const lit = await read('On a lit round');
  check(
    'on a round that is on, the gauge stands in its ring’s place',
    lit.slice(0, 3).every((round) => round.lit && round.style) &&
      (await frame(gauges, 'On a lit round').locator('fluvy-rounds-card .lt-ring').count()) === 0,
    JSON.stringify(lit),
  );
  const none = await read('Out of reach, no number, no range');
  check(
    'out of reach, its dashed ring alone; no number or no range, its track alone',
    none[0].off && none[0].style === null && none.slice(1, 4).every((round) => round.share === 0),
    JSON.stringify(none),
  );
  // in a key and on a row's circle the layer is the round's own shape: nothing changes size
  const keyed = await read('Quick picks · labels');
  check(
    'saying their states, each key is its gauge’s ground: 64 tall, one width, the layer its box',
    keyed
      .slice(0, 4)
      .every(
        ({ style, height, width, fits }) =>
          style && height === 64 && fits && width === keyed[0].width,
      ),
    JSON.stringify(keyed),
  );
  const rowed = await read('Quick picks · rows', '.fv-row > .fv-ico');
  check(
    'a row each: its gauge on its circle, 44 round',
    rowed
      .slice(0, 4)
      .every(({ style, width, height, fits }) => style && width === 44 && height === 44 && fits),
    JSON.stringify(rowed),
  );
  const heights = await gauges.evaluate(() =>
    [...document.querySelectorAll('[data-frame] fluvy-rounds-card')]
      .filter((card) => Math.round(card.getBoundingClientRect().width) === 360)
      .map((card) => ({
        frame: card.closest('[data-frame]').dataset.frame,
        drawn: Math.round(
          card.shadowRoot.querySelector('[data-card]').getBoundingClientRect().height,
        ),
        declared: card.constructor.layoutHeight(card.config),
      }))
      .filter(({ drawn, declared }) => drawn !== declared),
  );
  check(
    'every card with gauges draws the height it declares',
    heights.length === 0,
    JSON.stringify(heights),
  );
  // its taps are a round's: a sensor's opens its details
  await reset(gauges);
  const tablet = frame(gauges, 'Quick picks · the issue’s five')
    .locator('fluvy-rounds-card .lt-bulb')
    .first();
  await press(gauges, tablet);
  check(
    'a tap on a round with a gauge opens its details',
    JSON.stringify(await moreInfo(gauges)) === '["sensor.rg_tablet_battery"]',
    JSON.stringify(await moreInfo(gauges)),
  );
  // a new reading moves the gauge, and what a reader hears with it
  await gauges.evaluate(() => window.fluvyMock.set('sensor.rg_tablet_battery', '40'));
  await settle(gauges, 600);
  const moved = (await read('Quick picks · the issue’s five'))[0];
  check(
    'a new reading moves its gauge and what a reader hears',
    moved.share === 0.4 && moved.label === 'Wall tablet, 40 %',
    JSON.stringify(moved),
  );
  await gauges.close();
}

/* ---------- #257: the gauge is the round's, on every card that draws rounds ---------- */
{
  const gauges = await suite.sheet('round-gauges');
  const layers = (title, tag) =>
    frame(gauges, title)
      .locator(tag)
      .evaluateAll((cards) =>
        cards.map((card) =>
          [...card.shadowRoot.querySelectorAll('.rg')].map((layer) => {
            const round = layer.parentElement.getBoundingClientRect();
            const own = layer.getBoundingClientRect();
            return (
              layer.className.replace(/^rg rg--(\w+).*$/, '$1') +
              (Math.abs(own.width - round.width) < 0.5 && Math.abs(own.height - round.height) < 0.5
                ? ''
                : '!')
            );
          }),
        ),
      );
  const room = await layers('A room’s quick actions', 'fluvy-room-card');
  check(
    'a room’s quick actions draw their gauges: plain, in their keys and in a pill',
    room.length === 3 && room.every((card) => card.join() === 'arc,fill'),
    JSON.stringify(room),
  );
  const rooms = await layers('The Rooms card', 'fluvy-rooms-card');
  const valves = await layers('A thermostat’s rounds', 'fluvy-thermostats-card');
  check(
    'the Rooms card and a thermostat’s own rounds draw theirs',
    rooms[0].join() === 'arc,fill,arc' && valves[0].join() === 'arc,arc',
    JSON.stringify({ rooms, valves }),
  );
  await gauges.close();
}

await suite.finish();
