#!/usr/bin/env node
/**
 * Interaction tests for the Vacuum card's map and presets (#265) on the playground's `vacuum-map` sheet: a room
 * tapped is picked and Clean sends it as its robot's integration takes it (a Xiaomi Miio robot, a Roborock by its
 * numbers and by Home Assistant's areas, a Valetudo robot by MQTT); a zone marked with the pointer is the robot's
 * through the map's calibration, and a point picked is where it is sent; a preset's chip runs it, held it is shown on
 * the map, and one with an action of the person's own sends the selection's numbers in the place of `[[selection]]`;
 * the map is enlarged by Ctrl and the wheel, a double click and the keys, and comes back whole; the card is as tall
 * with something picked as without; out of reach nothing is tapped. On a touch screen two fingers enlarge the map
 * and the page stays where it was, and one finger across the map scrolls the page (the browser's own touches,
 * `Input.dispatchTouchEvent`: Chromium). Under `ENGINE=webkit` the fingers are events made by hand: what the map
 * makes of them is held there, what the browser does with a real finger is not. Real cards on the playground's
 * simulated hass. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-vacuum-map.mjs
 */
import { BASE, calls, ENGINE, frame, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** A frame's card, its map, and the parts of the map. */
const cardOf = (page, title) => frame(page, title).locator('fluvy-vacuum-card').first();
const mapOf = (card) => card.locator('fluvy-vacuum-map');
const plateOf = (card) => mapOf(card).locator('.vm-plate');
const tag = (card, name) => mapOf(card).locator('.vm-tag', { hasText: name }).first();
const round = (card, label) => mapOf(card).locator(`.fv-round[aria-label="${label}"]`);
const go = (card) => mapOf(card).locator('.vm-go');
const bar = (card) => mapOf(card).locator('.vm-bar__label');
const chip = (card, name) => card.locator('.vc-presets .fv-chip', { hasText: name }).first();
const height = (of) => of.evaluate((el) => el.getBoundingClientRect().height);
const said = async (page) => (await calls(page)).map((c) => [c.s, c.d, c.t?.entity_id]);
const text = (value) => JSON.stringify(value);

/**
 * The playground's flat: 480 × 360 in a 320 × 240 plate, the dock at (60, 214) of the picture, which its robot
 * counts as (25500, 25500), 20 to a pixel, its y running up. A place of the picture on the page, and as the robot's.
 */
const SCALE = 2 / 3;
async function spot(card, [x, y]) {
  // a mouse reaches only what is on screen
  await plateOf(card).scrollIntoViewIfNeeded();
  const box = await plateOf(card).boundingBox();
  return { x: box.x + x * SCALE, y: box.y + y * SCALE };
}
const robot = ([x, y]) => [25500 + (x - 60) * 20, 25500 + (214 - y) * 20];
/** Whether two lists of numbers agree within a pixel of the plate (30 of the robot's units). */
const near = (got, want) =>
  Array.isArray(got) &&
  got.length === want.length &&
  got.every((n, i) => Number.isInteger(n) && Math.abs(n - want[i]) <= 40);

async function ready(page, title) {
  const card = cardOf(page, title);
  await card.scrollIntoViewIfNeeded();
  await mapOf(card).locator('.vm-shapes').waitFor();
  await settle(page, 300);
  return card;
}

/* ---------- rooms: a Xiaomi Miio robot ---------- */
{
  const page = await suite.sheet('vacuum-map', { width: 360 });
  const card = await ready(page, 'Map');
  const before = await height(card);
  check(
    'the map draws its rooms’ names and its saved zones’',
    (await tag(card, 'Bedroom').count()) === 1 && (await tag(card, 'Cooker').count()) === 1,
  );
  check(
    'at rest the map’s rounds stand at its foot, and no bar',
    (await round(card, 'Mark a zone').count()) === 1 &&
      (await round(card, 'Pick a point').count()) === 1 &&
      (await go(card).count()) === 0,
  );
  await reset(page);
  // the bedroom by its floor, the study by its name
  const bedroom = await spot(card, [420, 250]);
  await page.mouse.click(bedroom.x, bedroom.y);
  await tag(card, 'Study').click();
  await settle(page, 300);
  check(
    'a room tapped on its floor and one tapped on its name are both picked, and said at the map’s foot',
    (await bar(card).textContent()) === 'Bedroom, Study' &&
      (await go(card).textContent()).trim() === 'Clean',
    await bar(card).textContent(),
  );
  check('the rounds give the bar their place', (await round(card, 'Mark a zone').count()) === 0);
  check(
    'with rooms picked the card is exactly as tall as it was',
    (await height(card)) === before,
    `${before} ${await height(card)}`,
  );
  check('picking calls nothing', (await calls(page)).length === 0);
  await go(card).click();
  await settle(page, 300);
  const sent = await said(page);
  check(
    'Clean sends a Xiaomi Miio robot its rooms by their numbers, in the order picked',
    text(sent) ===
      text([['xiaomi_miio.vacuum_clean_segment', { segments: [21, 19] }, ['vacuum.mp_robot']]]),
    text(sent),
  );
  check(
    '…and the map is as it was: nothing picked, its rounds back',
    (await go(card).count()) === 0 && (await round(card, 'Mark a zone').count()) === 1,
  );

  /* a room let go, and the cross */
  await tag(card, 'Hall').click();
  await tag(card, 'Study').click();
  await tag(card, 'Hall').click();
  await settle(page, 200);
  check('a picked room tapped again is let go', (await bar(card).textContent()) === 'Study');
  await mapOf(card).locator('.vm-bar .fv-round').click();
  await settle(page, 200);
  check('the cross clears the selection', (await go(card).count()) === 0);
  await tag(card, 'Hall').click();
  await plateOf(card).focus();
  await page.keyboard.press('Escape');
  await settle(page, 200);
  check('…and so does Escape', (await go(card).count()) === 0);

  /* ---------- a zone marked, a point picked ---------- */
  await reset(page);
  await round(card, 'Mark a zone').click();
  await settle(page, 200);
  check(
    'the zone’s round waits for a finger: the bar says so',
    (await bar(card).textContent()) === 'Drag across the map' && (await go(card).count()) === 0,
    await bar(card).textContent(),
  );
  // in the least column the full card is drawn in, the bar has no room to say it whole: it is its cross alone
  const narrow = await ready(page, 'Map · a 211 column · marking a zone');
  const bare = await mapOf(narrow).locator('.vm-bar').boundingBox();
  const plate = await plateOf(narrow).boundingBox();
  check(
    'in a 211 column the waiting bar is its cross alone: a 44 round at the plate’s foot end, where the rounds stood',
    bare?.width === 44 &&
      bare.height === 44 &&
      (await bar(narrow).textContent()) === '' &&
      Math.round(plate.x + plate.width - (bare.x + bare.width)) === 8 &&
      Math.round(plate.y + plate.height - (bare.y + bare.height)) === 8,
    text(bare),
  );
  await card.scrollIntoViewIfNeeded();
  const from = await spot(card, [177, 321]);
  const to = await spot(card, [330, 213]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  check(
    'while the zone is marked it is drawn under the pointer, the bar out of its way',
    (await mapOf(card).locator('.vm-shape--drawn').count()) === 1 &&
      (await mapOf(card).locator('.vm-bar').count()) === 0,
  );
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await settle(page, 300);
  check(
    'a zone marked is picked, the mode over',
    (await bar(card).textContent()) === 'Zone' &&
      (await plateOf(card).evaluate((el) => !el.classList.contains('is-drawing'))),
    await bar(card).textContent(),
  );
  await go(card).click();
  await settle(page, 300);
  const [zoned] = await said(page);
  const want = [...robot([177, 321]), ...robot([330, 213])];
  check(
    'Clean sends the zone as the robot counts it through the calibration, its lesser corner first, once',
    zoned?.[0] === 'xiaomi_miio.vacuum_clean_zone' &&
      zoned[1].repeats === 1 &&
      zoned[1].zone.length === 1 &&
      near(zoned[1].zone[0], want),
    `${text(zoned)} · wanted ${text(want)}`,
  );

  await reset(page);
  await round(card, 'Pick a point').click();
  const there = await spot(card, [408, 117]);
  await page.mouse.click(there.x, there.y);
  await settle(page, 300);
  check(
    'a tap in the point’s mode is the point: a pin, and Go here',
    (await mapOf(card).locator('.vm-pin').count()) === 1 &&
      (await go(card).textContent()).trim() === 'Go here',
  );
  await go(card).click();
  await settle(page, 300);
  const [went] = await said(page);
  check(
    'Go here sends the robot there, in its own whole numbers',
    went?.[0] === 'xiaomi_miio.vacuum_goto' &&
      near([went[1].x_coord, went[1].y_coord], robot([408, 117])),
    text(went),
  );

  /* ---------- the presets ---------- */
  await reset(page);
  await chip(card, 'Full clean').click();
  await chip(card, 'Cooker').click();
  await settle(page, 300);
  const ran = await said(page);
  check(
    'a preset that names nothing starts the robot; one with a zone cleans it, its own times over',
    text(ran) ===
      text([
        ['vacuum.start', {}, ['vacuum.mp_robot']],
        [
          'xiaomi_miio.vacuum_clean_zone',
          { zone: [[...robot([270, 140]), ...robot([420, 50])]], repeats: 2 },
          ['vacuum.mp_robot'],
        ],
      ]),
    text(ran),
  );
  await reset(page);
  const held = await chip(card, 'Table').boundingBox();
  await page.mouse.move(held.x + held.width / 2, held.y + held.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await settle(page, 300);
  check(
    'a preset held is shown on the map and runs nothing: its chip lit, its name at the map’s foot',
    (await calls(page)).length === 0 &&
      (await chip(card, 'Table').getAttribute('aria-pressed')) === 'true' &&
      (await bar(card).textContent()) === 'Table',
    `${(await calls(page)).length} · ${await bar(card).textContent()}`,
  );
  await tag(card, 'Cooker').click();
  await go(card).click();
  await settle(page, 300);
  const [both] = await said(page);
  check(
    'saved zones picked together are cleaned in one call, as many times as the most of them asks',
    both?.[0] === 'xiaomi_miio.vacuum_clean_zone' &&
      both[1].zone.length === 2 &&
      both[1].repeats === 2,
    text(both),
  );
  await page.close();
}

/* ---------- a Roborock: its numbers, Home Assistant's areas ---------- */
{
  const page = await suite.sheet('vacuum-map', { width: 360 });
  const card = await ready(page, 'Map · Roborock');
  await reset(page);
  await tag(card, 'Bedroom').click();
  await tag(card, 'Study').click();
  await go(card).click();
  await settle(page, 300);
  const numbered = await said(page);
  check(
    'Clean sends a Roborock its rooms by name: their numbers and the times in one',
    text(numbered) ===
      text([
        [
          'vacuum.send_command',
          { command: 'app_segment_clean', params: [{ segments: [21, 19], repeat: 1 }] },
          ['vacuum.mp_s8'],
        ],
      ]),
    text(numbered),
  );
  await reset(page);
  await tag(card, 'Kitchen').click();
  await tag(card, 'Hall').click();
  await go(card).click();
  await settle(page, 300);
  const byArea = await said(page);
  check(
    'rooms that name their areas go to Home Assistant’s own clean by area',
    text(byArea) ===
      text([
        ['vacuum.clean_area', { cleaning_area_id: ['mp_kitchen', 'mp_hall'] }, ['vacuum.mp_s8']],
      ]),
    text(byArea),
  );
  await reset(page);
  await chip(card, 'Bedrooms').click();
  await settle(page, 300);
  const twice = await said(page);
  check(
    'a preset of rooms sends them its own times over',
    text(twice?.[0]?.[1]) ===
      text({ command: 'app_segment_clean', params: [{ segments: [19, 21], repeat: 2 }] }),
    text(twice),
  );
  await reset(page);
  await round(card, 'Mark a zone').click();
  const from = await spot(card, [30, 30]);
  const to = await spot(card, [120, 90]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await settle(page, 300);
  await go(card).click();
  await settle(page, 300);
  const [zone] = await said(page);
  check(
    'one zone cleaned once is the integration’s own action, the times after the first',
    zone?.[0] === 'roborock.set_vacuum_zoned_cleaning' &&
      zone[1].repeats === 0 &&
      near(
        [zone[1].x1, zone[1].y1, zone[1].x2, zone[1].y2],
        [...robot([30, 90]), ...robot([120, 30])],
      ),
    text(zone),
  );

  /* the house's areas as presets */
  const areas = cardOf(page, 'Presets · the house’s areas');
  await areas.scrollIntoViewIfNeeded();
  await settle(page, 300);
  await reset(page);
  check(
    'the areas a robot has mapped are a preset each, by the area’s name',
    text(
      await areas
        .locator('.vc-presets .fv-chip')
        .allTextContents()
        .then((all) => all.map((t) => t.trim())),
    ) === text(['Kitchen', 'Hall', 'Study']),
  );
  await chip(areas, 'Study').click();
  await settle(page, 300);
  check(
    '…and a tap cleans that area',
    text(await said(page)) ===
      text([['vacuum.clean_area', { cleaning_area_id: ['mp_study'] }, ['vacuum.mp_s8']]]),
    text(await said(page)),
  );
  await page.close();
}

/* ---------- Valetudo by MQTT; a floor plan and an action of the person's own; presets alone ---------- */
{
  const page = await suite.sheet('vacuum-map', { width: 360 });
  const valetudo = await ready(page, 'Map · Valetudo');
  await reset(page);
  await tag(valetudo, 'Hall').click();
  await go(valetudo).click();
  await settle(page, 300);
  const [published] = await said(page);
  check(
    'Clean publishes a Valetudo robot’s rooms to its capability’s topic, as words, to no entity',
    published?.[0] === 'mqtt.publish' &&
      published[1].topic === 'valetudo/robot/MapSegmentationCapability/clean/set' &&
      text(JSON.parse(published[1].payload)) ===
        text({ segment_ids: ['18'], iterations: 1, customOrder: true }) &&
      published[2] === undefined,
    text(published),
  );

  const plan = await ready(page, 'Map · a floor plan');
  await reset(page);
  await chip(plan, 'Around the table').click();
  await settle(page, 300);
  check(
    'a preset’s own action is sent its zone’s numbers in the place of [[selection]], its times in [[repeats]]',
    text(await said(page)) ===
      text([['script.clean_spot', { zones: [[136, 82, 234, 154]], times: 1 }, undefined]]),
    text(await said(page)),
  );
  check(
    'a floor plan with no way to go to a point draws no round for it',
    (await round(plan, 'Mark a zone').count()) === 1 &&
      (await round(plan, 'Pick a point').count()) === 0,
  );
  await reset(page);
  await round(plan, 'Mark a zone').click();
  const from = await spot(plan, [300, 240]);
  const to = await spot(plan, [390, 300]);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await settle(page, 300);
  await go(plan).click();
  await settle(page, 300);
  const [own] = await said(page);
  check(
    'a zone marked on a floor plan is its own pixels, handed to the person’s own action as numbers',
    own?.[0] === 'script.clean_spot' &&
      own[1].times === 1 &&
      own[1].zones.length === 1 &&
      own[1].zones[0].every((n, i) => Math.abs(n - [300, 240, 390, 300][i]) <= 2),
    text(own),
  );

  const alone = cardOf(page, 'Presets');
  await alone.scrollIntoViewIfNeeded();
  await settle(page, 300);
  await reset(page);
  check('a card of presets alone draws no map', (await mapOf(alone).count()) === 0);
  await chip(alone, 'Bedroom').click();
  await settle(page, 300);
  check(
    'its presets run all the same',
    text(await said(page)) ===
      text([['xiaomi_miio.vacuum_clean_segment', { segments: [21] }, ['vacuum.mp_robot']]]),
    text(await said(page)),
  );

  /* out of reach */
  const gone = cardOf(page, 'Map · unavailable');
  await gone.scrollIntoViewIfNeeded();
  await settle(page, 300);
  await reset(page);
  await chip(gone, 'Full clean').click({ force: true });
  await settle(page, 200);
  check(
    'out of reach the map keeps its plate with nothing to tap, and the presets take no tap',
    (await mapOf(gone).locator('.vm-plate.is-off').count()) === 1 &&
      (await mapOf(gone).locator('button').count()) === 0 &&
      (await calls(page)).length === 0,
  );
  check(
    '…the card as tall as the one in reach',
    (await height(gone)) === (await height(cardOf(page, 'Map'))),
    `${await height(gone)} ${await height(cardOf(page, 'Map'))}`,
  );
  await page.close();
}

/* ---------- enlarged: the wheel, a double click, the keys ---------- */
{
  const page = await suite.sheet('vacuum-map', { width: 360 });
  const card = await ready(page, 'Map · the entity’s own rooms');
  const zoomed = () => plateOf(card).evaluate((el) => el.classList.contains('is-zoomed'));
  const layer = () =>
    mapOf(card)
      .locator('.vm-layer')
      .evaluate((el) => el.style.transform);
  const middle = await spot(card, [240, 180]);
  const scrolled = await page.evaluate(() => window.scrollY);
  await page.mouse.move(middle.x, middle.y);
  await page.mouse.wheel(0, 120);
  await settle(page, 300);
  check(
    'a plain wheel over the map is the page’s scroll',
    !(await zoomed()) && (await page.evaluate(() => window.scrollY)) !== scrolled,
  );
  await card.scrollIntoViewIfNeeded();
  await settle(page, 300);
  const at = await spot(card, [240, 180]);
  await page.mouse.move(at.x, at.y);
  const kept = await page.evaluate(() => window.scrollY);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await settle(page, 300);
  check(
    'Ctrl and the wheel enlarge the map, the page where it was',
    (await zoomed()) && (await page.evaluate(() => window.scrollY)) === kept,
    await layer(),
  );
  check(
    'enlarged, the map offers the whole of itself',
    (await round(card, 'Whole map').count()) === 1,
  );
  const box = await plateOf(card).boundingBox();
  const inside = await mapOf(card)
    .locator('.vm-layer')
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      const p = el.parentElement.getBoundingClientRect();
      return (
        r.left <= p.left + 0.5 &&
        r.top <= p.top + 0.5 &&
        r.right >= p.right - 0.5 &&
        r.bottom >= p.bottom - 0.5
      );
    });
  check('…and never leaves its plate uncovered', inside && box.height === 240);
  // a mouse carries the enlarged map, and the click that ends its drag picks nothing
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x - 40, at.y - 20, { steps: 5 });
  const carried = await layer();
  await page.mouse.up();
  await settle(page, 200);
  check(
    'a mouse drags the enlarged map, and its release picks no room',
    /translate\(-/.test(carried) && (await go(card).count()) === 0,
    carried,
  );
  await round(card, 'Whole map').click();
  await settle(page, 300);
  check(
    'the round fits the map again',
    !(await zoomed()) && (await round(card, 'Whole map').count()) === 0,
  );
  await page.mouse.dblclick(at.x, at.y);
  await settle(page, 300);
  check('a double click comes closer', await zoomed());
  await plateOf(card).focus();
  await page.keyboard.press('0');
  await settle(page, 200);
  const fitted = !(await zoomed());
  await page.keyboard.press('+');
  await settle(page, 200);
  const closer = await zoomed();
  await page.keyboard.press('-');
  await settle(page, 200);
  check(
    'the keys 0, + and − fit it, enlarge it and bring it back',
    fitted && closer && !(await zoomed()),
  );
  check(
    'the map’s plate is a stop of the keyboard, named by its robot',
    (await plateOf(card).getAttribute('aria-label')) === 'Robot vacuum · Map',
    await plateOf(card).getAttribute('aria-label'),
  );
  await page.close();
}

/* ---------- a touch screen: two fingers are the map's, one is the page's ---------- */
{
  const context = await suite.browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}?sheet=vacuum-map&width=360`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(900);
  const card = await ready(page, 'Map · the entity’s own rooms');
  await plateOf(card).evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await settle(page, 400);
  const zoomed = () => plateOf(card).evaluate((el) => el.classList.contains('is-zoomed'));
  const scrollY = () => page.evaluate(() => Math.round(window.scrollY));
  const box = await plateOf(card).boundingBox();
  const middle = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  /** Fingers as the engine has them: the browser's own under Chromium, events made by hand elsewhere. */
  const fingers =
    ENGINE === 'chromium'
      ? await (async () => {
          const cdp = await context.newCDPSession(page);
          return (type, points) =>
            cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
        })()
      : (type, points) =>
          plateOf(card).evaluate(
            (el, [name, touches]) => {
              const event = new Event(name, { bubbles: true, cancelable: true, composed: true });
              Object.defineProperty(event, 'touches', {
                value: touches.map(({ x, y }) => ({ clientX: x, clientY: y })),
              });
              el.dispatchEvent(event);
            },
            [type.toLowerCase(), points],
          );
  const before = await scrollY();
  const tall = await height(plateOf(card));
  const pair = (spread) => [
    { x: middle.x - spread, y: middle.y, id: 0 },
    { x: middle.x + spread, y: middle.y, id: 1 },
  ];
  await fingers('touchStart', pair(30));
  for (let spread = 36; spread <= 90; spread += 6) {
    await fingers('touchMove', pair(spread));
    await page.waitForTimeout(16);
  }
  await fingers('touchEnd', []);
  await settle(page, 300);
  check(
    'two fingers apart enlarge the map, and the page stays where it was',
    (await zoomed()) && (await scrollY()) === before,
    `${await scrollY()} ${before}`,
  );
  check(
    'enlarged by fingers, the map’s plate is as tall as it was',
    (await height(plateOf(card))) === tall,
    `${tall} ${await height(plateOf(card))}`,
  );
  if (ENGINE === 'chromium') {
    // one finger up the map: the browser's own scroll takes it
    const start = { x: middle.x, y: middle.y + 60, id: 0 };
    await fingers('touchStart', [start]);
    for (let i = 1; i <= 12; i++) {
      await fingers('touchMove', [{ ...start, y: start.y - i * 12 }]);
      await page.waitForTimeout(16);
    }
    await fingers('touchEnd', []);
    await settle(page, 400);
    check(
      'one finger across the map scrolls the page, and picks nothing',
      (await scrollY()) > before + 60 && (await go(card).count()) === 0,
      `${await scrollY()} ${before}`,
    );
  }
  await context.close();
}

await suite.finish();
