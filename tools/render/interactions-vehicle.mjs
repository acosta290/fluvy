#!/usr/bin/env node
/**
 * Interaction tests for the Vehicle card (#84) on the playground's `vehicle` sheet: each integration's car found by its
 * own words; the rounds act on the car — unlocking, opening the boot and stopping a charge ask first in Home Assistant's
 * dialog, locking and the climate act at once, a hold opens what a round reads — and the charge cannot start unplugged;
 * the head, the battery and a row answer their taps; every frame at a card's width holds its declared height; the
 * strip's round gives way in half a section before a word would be cut; a car out of reach keeps its rounds where they
 * stand when they read; a car that burns fuel draws its tank and a plug-in hybrid both, each opening its own details
 * (#207); an engine named by hand asks before it starts, the person's own controls and small icons act as a room's
 * rounds do, a tyre under its threshold is said, a badge of the person's own is drawn, and the picture alone is the
 * card's button (#248, #251, #254); the battery and the tank as a liquid in the ruler's room, its bubbles while it
 * charges and its limit's hairline (#256); and in every language no round's word runs past its cell, nor the line or
 * the head's line past their column.
 * Real cards on the playground's simulated hass. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5196/ node interactions-vehicle.mjs
 */
import { everyLanguage } from './lib.mjs';
import { calls, frame, moreInfo, reset, settle, startSuite, tapHead } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** The `n`th vehicle card of a frame. */
const card = (page, title, n = 0) => frame(page, title).locator('fluvy-vehicle-card').nth(n);
/** What a card says: its badge, its line, its rounds (label and word), its rows, its height and what it declares. */
const read = (locator) =>
  locator.evaluate((el) => {
    const root = el.shadowRoot;
    const t = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {
      badge: t(root.querySelector('.fv-badge')),
      sub: t(root.querySelector('.fv-card__sub')),
      line: t(root.querySelector('.vh-line')),
      rounds: [...root.querySelectorAll('.vh-control')].map((b) => ({
        label: b.getAttribute('aria-label'),
        word: t(b.querySelector('.vh-control__word')),
        still: b.disabled || b.getAttribute('aria-disabled') === 'true',
      })),
      rows: [...root.querySelectorAll('.vh-rows .fv-row')].map(t),
      height: Math.round(root.querySelector('[data-card]').getBoundingClientRect().height),
      declared: el.constructor.layoutHeight(el.config),
    };
  });
/** Whether any word of a card runs past its box: a round's word past its cell, the line or a head's line past theirs. */
const overflows = (locator) =>
  locator.evaluate((el) => {
    const root = el.shadowRoot;
    const out = [];
    for (const word of root.querySelectorAll('.vh-control__word')) {
      const cell = word.closest('.vh-control').getBoundingClientRect();
      const box = word.getBoundingClientRect();
      if (box.left < cell.left - 0.5 || box.right > cell.right + 0.5) out.push(word.textContent);
    }
    for (const line of root.querySelectorAll('.vh-line, .fv-card__sub, .fv-row__sub'))
      if (line.scrollWidth > line.clientWidth + 1) out.push(line.textContent);
    return out;
  });

/**
 * A card's small icons at its foot, each by its place on their line: its box from the line's start and to its end, its
 * centre as a share of the line, its words, what they keep clear of its sides and whether they are cut.
 */
const foot = (locator) =>
  locator.evaluate((el) => {
    const line = el.shadowRoot.querySelector('.vh-quick').getBoundingClientRect();
    return [...el.shadowRoot.querySelectorAll('.vh-quick .lt-bulb')].map((round) => {
      const box = round.getBoundingClientRect();
      const said = round.querySelector('.lt-said');
      const words = said?.textContent ? said.getBoundingClientRect() : undefined;
      return {
        left: box.left - line.left,
        right: line.right - box.right,
        width: box.width,
        height: box.height,
        centre: (box.left + box.width / 2 - line.left) / line.width,
        said: said?.textContent ?? null,
        sides: words ? Math.min(words.left - box.left, box.right - words.right) : Infinity,
        cut: said ? said.scrollWidth > said.clientWidth + 0.5 : false,
      };
    });
  });

const page = await suite.sheet('vehicle');
await page.evaluate(() => {
  window.__handed = [];
  document.body.addEventListener('hass-action', (event) => window.__handed.push(event.detail));
});
const handed = () => page.evaluate(() => window.__handed.splice(0));

/* ---------- each integration's car, by its own words ---------- */
{
  const tesla = await read(card(page, 'Teslemetry · charging at home'));
  check(
    'Teslemetry: charging at 7.2 kW to its limit, when it will be there and how long from now; its own lock, never its cable’s latch',
    tesla.badge === 'Charging · 7.2 kW' &&
      /^80 % at \d{1,2}:\d{2} · 1 h 12 min left · \+46 km\/h$/.test(tesla.line) &&
      tesla.rounds[0]?.label === 'Lock · Locked',
    JSON.stringify(tesla),
  );
  check(
    'a 360 card holds four rounds with their words: the lock, the climate, the charge, the boot',
    tesla.rounds.map((r) => r.word).join('|') === 'Locked|Off|Charging|Boot',
    JSON.stringify(tesla.rounds),
  );
  const tessie = await read(card(page, 'Tessie · driving'));
  check(
    'Tessie: driving at 64 km/h, the climate cooling to 20 °C',
    tessie.badge === 'Driving · 64 km/h' && tessie.rounds[1]?.word === '20 °C',
    JSON.stringify(tessie),
  );
  const asleep = await read(card(page, 'Tesla Fleet · asleep on a cold night'));
  check(
    'Tesla Fleet: asleep, its cabin cold while the climate is off — said on the line and under the climate',
    asleep.badge === 'Asleep' &&
      asleep.line === 'Cold inside · 2 °C' &&
      asleep.rounds[1]?.word === '2 °C',
    JSON.stringify(asleep),
  );
  const kia = await read(card(page, 'Kia · plugged in, not charging, unlocked'));
  check(
    'Kia: plugged in, its own battery (never its 12 V one), a window left open on the line, an hour and a half since it said anything',
    kia.badge === 'Plugged in' &&
      kia.line === 'Window open' &&
      kia.sub === 'Updated 2 h ago' &&
      kia.rounds[0]?.word === 'Unlocked',
    JSON.stringify(kia),
  );
  const hyundai = await read(card(page, 'Hyundai · charging away from home'));
  check(
    'Hyundai: its time to full a duration — full at its end, 1 h 35 min left — and its badge over its address at 360',
    /^Full at \d{1,2}:\d{2} · 1 h 35 min left$/.test(hyundai.line) &&
      hyundai.badge === 'Charging · 10.5 kW' &&
      hyundai.sub === '',
    JSON.stringify(hyundai),
  );
  const bmw = await read(card(page, 'BMW CarData · a few entities'));
  check(
    'BMW CarData: read by its names — its lock a sensor’s word, its charge idle, its limit on the line',
    bmw.rounds[0]?.word === 'Locked' && bmw.line === 'Limit 80 %' && bmw.badge === 'Parked',
    JSON.stringify(bmw),
  );
  const custom = await read(card(page, 'tesla_custom · its charge port’s latch, never its lock'));
  check(
    'tesla_custom: its doors’ lock, never its charge port’s latch first in its registry',
    custom.rounds.length === 1 && custom.rounds[0]?.label === 'Lock · Unlocked',
    JSON.stringify(custom.rounds),
  );
  const gone = await read(card(page, 'Out of reach'));
  check(
    'out of reach: the badge says so, every round still, the rows dashes',
    gone.badge === 'Unavailable' &&
      gone.rounds.length > 0 &&
      gone.rounds.every((r) => r.still && r.word === '—') &&
      gone.rows.every((row) => row.endsWith('—')),
    JSON.stringify(gone),
  );
}

/* ---------- the rounds act on the car, asking first where it matters ---------- */
{
  const tesla = card(page, 'Teslemetry · charging at home');
  await reset(page);
  await tesla.locator('.vh-control').nth(0).click();
  await settle(page, 200);
  let asked = await handed();
  let done = await calls(page);
  check(
    'unlocking asks first: Home Assistant’s dialog, nothing called yet',
    done.length === 0 &&
      asked.length === 1 &&
      asked[0].config.tap_action.perform_action === 'lock.unlock' &&
      asked[0].config.tap_action.confirmation?.text === 'Unlock the car?',
    JSON.stringify({ asked, done }),
  );
  await tesla.locator('.vh-control').nth(2).click();
  await settle(page, 200);
  asked = await handed();
  check(
    'stopping a charge asks first',
    asked.length === 1 &&
      asked[0].config.tap_action.perform_action === 'switch.turn_off' &&
      asked[0].config.tap_action.confirmation?.text === 'Stop charging?',
    JSON.stringify(asked),
  );
  await tesla.locator('.vh-control').nth(3).click();
  await settle(page, 200);
  asked = await handed();
  check(
    'opening the boot asks first',
    asked.length === 1 &&
      asked[0].config.tap_action.perform_action === 'cover.open_cover' &&
      asked[0].config.tap_action.confirmation?.text === 'Open the boot?',
    JSON.stringify(asked),
  );
  await reset(page);
  await tesla.locator('.vh-control').nth(1).click();
  await settle(page, 200);
  done = await calls(page);
  check(
    'the climate turns on at once',
    done.length === 1 &&
      done[0].s === 'climate.turn_on' &&
      done[0].t?.entity_id === 'climate.model_y_climate',
    JSON.stringify(done),
  );
  await reset(page);
  const lock = tesla.locator('.vh-control').nth(0);
  const box = await lock.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(650);
  await page.mouse.up();
  await settle(page, 200);
  check(
    'a hold on a round opens what it reads',
    (await moreInfo(page)).at(-1) === 'lock.model_y_lock' && (await calls(page)).length === 0,
    JSON.stringify(await moreInfo(page)),
  );
  const kia = card(page, 'Kia · plugged in, not charging, unlocked');
  await reset(page);
  await kia.locator('.vh-control').nth(0).click();
  await settle(page, 200);
  done = await calls(page);
  check(
    'locking acts at once',
    done.length === 1 && done[0].s === 'lock.lock' && done[0].t?.entity_id === 'lock.ev6_door_lock',
    JSON.stringify(done),
  );
  await reset(page);
  await kia.locator('.vh-control').nth(2).click();
  await settle(page, 200);
  done = await calls(page);
  check(
    'a charge that stopped plugged in starts at once',
    done.length === 1 &&
      done[0].s === 'switch.turn_on' &&
      done[0].t?.entity_id === 'switch.ev6_ev_charging',
    JSON.stringify(done),
  );
  const parked = await read(card(page, 'Tesla Fleet · parked at work, sentry on'));
  check(
    'the charge cannot start unplugged: its round is still, and says why',
    parked.rounds[2]?.still === true && parked.rounds[2]?.label?.endsWith('Not plugged in'),
    JSON.stringify(parked.rounds[2]),
  );
}

/* ---------- the head, the battery and a row answer their taps ---------- */
{
  const tesla = card(page, 'Teslemetry · charging at home');
  await reset(page);
  await tapHead(tesla);
  await settle(page, 200);
  check(
    'the head opens the battery’s details',
    (await moreInfo(page)).at(-1) === 'sensor.model_y_battery_level',
    JSON.stringify(await moreInfo(page)),
  );
  await reset(page);
  await tesla.locator('.vh-hero .fv-tile__tap').click();
  await settle(page, 200);
  check(
    'the battery opens its details',
    (await moreInfo(page)).at(-1) === 'sensor.model_y_battery_level',
    JSON.stringify(await moreInfo(page)),
  );
  await reset(page);
  await tesla.locator('.vh-rows .fv-row').first().click();
  await settle(page, 200);
  check(
    'the location row opens the car’s tracker',
    (await moreInfo(page)).at(-1) === 'device_tracker.model_y_location',
    JSON.stringify(await moreInfo(page)),
  );
}

/* ---------- #207: a car that burns fuel, a plug-in hybrid ---------- */
{
  const tank = (locator) =>
    locator.evaluate((el) =>
      [...el.shadowRoot.querySelectorAll('.vh-hero')].map((hero) => ({
        label: (hero.querySelector('.fv-readout__label')?.textContent ?? '').trim(),
        tone: hero.querySelector('fluvy-ruler')?.tone,
      })),
    );
  const octavia = card(page, 'MySkoda · diesel, its AdBlue running low');
  const diesel = await read(octavia);
  check(
    'a diesel: its tank in the battery’s place, in the gas tone; its AdBlue low on the line; its bonnet a round',
    JSON.stringify(await tank(octavia)) === JSON.stringify([{ label: 'Fuel', tone: 'gas' }]) &&
      diesel.line === 'AdBlue low · 850 km' &&
      diesel.rounds.some((r) => r.word === 'Bonnet'),
    JSON.stringify({ diesel, tank: await tank(octavia) }),
  );
  const low = await read(card(page, 'Stellantis · petrol, running low'));
  check(
    'a petrol car at 9 %: low fuel on the line, its 12 V battery never its own',
    low.line === 'Low fuel' &&
      JSON.stringify(await tank(card(page, 'Stellantis · petrol, running low'))) ===
        JSON.stringify([{ label: 'Fuel', tone: 'warning' }]),
    JSON.stringify(low),
  );
  const niro = card(page, 'Kia · plug-in hybrid, charging at home');
  check(
    'a plug-in hybrid: its battery and its tank, each its own ruler, the charge on the line',
    JSON.stringify(await tank(niro)) ===
      JSON.stringify([
        { label: 'Battery', tone: 'accent' },
        { label: 'Fuel', tone: 'gas' },
      ]) && /^Full at \d{1,2}:\d{2} · 42 min left$/.test((await read(niro)).line),
    JSON.stringify({ heroes: await tank(niro), line: (await read(niro)).line }),
  );
  await reset(page);
  await tapHead(octavia);
  await settle(page, 200);
  check(
    'a car that burns fuel: its head opens its tank’s details',
    (await moreInfo(page)).at(-1) === 'sensor.octavia_fuel_level',
    JSON.stringify(await moreInfo(page)),
  );
  await reset(page);
  await niro.locator('.vh-hero .fv-tile__tap').nth(1).click();
  await settle(page, 200);
  check(
    'a hybrid’s tank opens its own details',
    (await moreInfo(page)).at(-1) === 'sensor.niro_fuel_level',
    JSON.stringify(await moreInfo(page)),
  );
  const strip = await frame(page, 'Strips · petrol, diesel, plug-in hybrid, out of reach')
    .locator('fluvy-vehicle-card')
    .nth(3)
    .evaluate((el) => ({
      halves: el.shadowRoot.querySelectorAll('.vh-ring--halves .vh-ring__fill').length,
      sub: (el.shadowRoot.querySelector('.fv-row__sub')?.textContent ?? '').trim(),
    }));
  check(
    'a hybrid’s strip: its ring in two halves, its charge and its tank on its line',
    strip.halves === 2 && strip.sub.startsWith('64 % · Fuel 54 %'),
    JSON.stringify(strip),
  );
}

/* ---------- #248, #251, #254: an engine, controls and small icons of the person's own, its tyres, its picture ---------- */
{
  const haval = card(page, 'GWM · the whole card');
  const whole = await read(haval);
  check(
    'GWM: its badge a template of its own, a tyre under its threshold on the line, its engine after the lock, its own controls by their names',
    whole.badge === 'GPS ok · GSM 4/5' &&
      whole.line === 'Low tyre pressure' &&
      whole.rounds.map((r) => r.word).join('|') === 'Locked|Off|Seats|Find' &&
      whole.rounds[1]?.label === 'Engine · Off',
    JSON.stringify(whole),
  );
  const tyres = await haval.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('.vh-tyre')].map((tyre) => ({
      text: tyre.textContent.replace(/\s+/g, ''),
      low: tyre.classList.contains('is-low'),
    })),
  );
  check(
    'its tyres in one decimal, the rear right under its threshold in the warning’s ink',
    JSON.stringify(tyres) ===
      JSON.stringify([
        { text: '2.4bar', low: false },
        { text: '2.4bar', low: false },
        { text: '2.3bar', low: false },
        { text: '1.9bar', low: true },
      ]),
    JSON.stringify(tyres),
  );
  await reset(page);
  await haval.locator('.vh-control').nth(1).click();
  await settle(page, 200);
  const asked = await handed();
  check(
    'starting the engine asks first, nothing called yet',
    asked.length === 1 &&
      asked[0].config.tap_action.perform_action === 'switch.turn_on' &&
      asked[0].config.tap_action.confirmation?.text === 'Start the engine?' &&
      (await calls(page)).length === 0,
    JSON.stringify(asked),
  );
  await reset(page);
  await haval.locator('.vh-control').nth(2).click();
  await haval.locator('.vh-control').nth(3).click();
  await settle(page, 200);
  const own = await calls(page);
  check(
    'its own controls act at once: the heated seat turns off, the script runs',
    own.map((c) => c.s).join('|') === 'switch.turn_off|script.turn_on',
    JSON.stringify(own),
  );
  const quick = await haval.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('.vh-quick .lt-bulb')].map((b) =>
      b.getAttribute('aria-label'),
    ),
  );
  check(
    'its small icons at the foot, in their order',
    quick.join('|') === 'GPS|GSM|Service|Tailgate',
    JSON.stringify(quick),
  );
  await reset(page);
  await haval.locator('.vh-quick .lt-bulb').nth(1).click();
  await settle(page, 200);
  check(
    'a small icon of a sensor opens its details',
    (await moreInfo(page)).at(-1) === 'sensor.haval_h6_gsm_signal',
    JSON.stringify(await moreInfo(page)),
  );
  // the owner's review of 1.25: the small icons across the column — each in the middle of its share of it, as the
  // controls over them; saying their states, a key each, equal, 8 apart, flush with the column's edges
  const icons = await foot(card(page, 'GWM · small icons at its foot', 0));
  check(
    'its small icons stand each in the middle of its share of the column',
    icons.length === 4 &&
      icons.every(
        ({ width, centre }, n) => width === 44 && Math.abs(centre - (n + 0.5) / 4) < 0.002,
      ),
    JSON.stringify(icons),
  );
  const keys = await foot(card(page, 'GWM · small icons at its foot', 1));
  check(
    'saying their states they are keys that fill the column: equal, 8 apart, flush with its edges, 64 tall',
    keys.map((key) => key.said).join('|') === 'On|4|3,200 km|Closed' &&
      keys.every(({ width, height }) => width === keys[0].width && height === 64) &&
      keys[0].left === 0 &&
      keys.at(-1).right < keys.length &&
      keys.slice(1).every((key, n) => key.left - keys[n].left - keys[n].width === 8),
    JSON.stringify(keys),
  );
  check(
    'no word of a key against its edge: 8 from its sides at the least, none cut',
    keys.every(({ sides, cut }) => sides >= 8 && !cut),
    JSON.stringify(keys),
  );
  const alone = card(page, 'The picture alone');
  const picture = await alone.evaluate((el) => ({
    parts: [...el.shadowRoot.querySelector('[data-card]').children].map((c) => c.className.trim()),
    height: Math.round(el.shadowRoot.querySelector('[data-card]').getBoundingClientRect().height),
  }));
  check(
    'the picture alone: no other part, the card as tall as its padding and the picture',
    picture.parts.length === 1 &&
      picture.parts[0].startsWith('vh-picture') &&
      picture.height === 200,
    JSON.stringify(picture),
  );
  await reset(page);
  await alone.locator('.vh-picture > .fv-tile__tap').click();
  await settle(page, 200);
  check(
    'the picture alone is the card’s button: it opens the battery',
    (await moreInfo(page)).at(-1) === 'sensor.model_y_battery_level',
    JSON.stringify(await moreInfo(page)),
  );
}

/* ---------- #256: the battery and the tank as a liquid ---------- */
{
  const liquid = (title, n = 0) =>
    card(page, title, n).evaluate((el) => {
      const root = el.shadowRoot;
      const heroes = [...root.querySelectorAll('.vh-hero')];
      return heroes.map((hero) => {
        const row = hero.querySelector('.fv-value-row').getBoundingClientRect();
        const band = hero.querySelector('.vh-liquid');
        const water = band?.querySelector('.fc-water');
        const box = band?.getBoundingClientRect();
        const mark = band?.querySelector('.vh-liquid__limit')?.getBoundingClientRect();
        return {
          tone: [...(water?.classList ?? [])].find((name) => name.startsWith('fv-tone--')),
          gap: box && Math.round(box.top - row.bottom),
          width: box && Math.round(box.width),
          height: box && Math.round(box.height),
          tank: water?.classList.contains('fc-water--tank') ?? false,
          bubbles: water?.querySelectorAll('.fc-bubble').length ?? 0,
          moving: [...(water?.querySelectorAll('.fc-wave') ?? [])].every(
            (wave) => getComputedStyle(wave).animationName !== 'none',
          ),
          mark: mark && box ? Math.round(mark.top - box.top) : null,
          ruler: Boolean(hero.querySelector('fluvy-ruler')),
        };
      });
    });
  const [tank] = await liquid('Its tank as a liquid');
  check(
    'a tank as a liquid: the water across the column in the gas tone, 64 tall, 12 under its value row, no ruler, at rest but for its waves',
    tank.tone === 'fv-tone--gas' &&
      tank.gap === 12 &&
      tank.width === 320 &&
      tank.height === 64 &&
      !tank.ruler &&
      !tank.tank &&
      tank.bubbles === 0 &&
      tank.moving &&
      tank.mark === null,
    JSON.stringify(tank),
  );
  const [battery] = await liquid('Its battery as a liquid · charging to its limit');
  check(
    'a battery charging: the card’s colour, bubbles rising, its limit of 80 % a hairline 13 from the band’s top',
    battery.tone === 'fv-tone--accent' &&
      battery.tank &&
      battery.bubbles === 6 &&
      battery.mark === 13,
    JSON.stringify(battery),
  );
  const hybrid = await liquid('A plug-in hybrid · both as liquids');
  check(
    'a hybrid: its battery and its tank both liquids, each in its tone, only the battery’s bubbling',
    hybrid.length === 2 &&
      hybrid[0].tone === 'fv-tone--accent' &&
      hybrid[1].tone === 'fv-tone--gas' &&
      hybrid[0].bubbles > 0 &&
      hybrid[1].bubbles === 0,
    JSON.stringify(hybrid),
  );
  const [low] = await liquid('A liquid · running low');
  const lowCard = await read(card(page, 'A liquid · running low'));
  check(
    'a tank running low: the water in the warning’s tone, the line saying so',
    low.tone === 'fv-tone--warning' && lowCard.line === 'Low fuel',
    JSON.stringify({ low, line: lowCard.line }),
  );
  const [gone] = await liquid('A liquid · out of reach');
  check(
    'out of reach: the band keeps its room, empty',
    gone.tone === 'fv-tone--neutral' && gone.height === 64 && gone.bubbles === 0,
    JSON.stringify(gone),
  );
  await reset(page);
  await card(page, 'Its tank as a liquid').locator('.vh-hero > .fv-tile__tap').click();
  await settle(page, 200);
  check(
    'the liquid is the tank’s button, as its ruler is',
    (await moreInfo(page)).at(-1) === 'sensor.haval_h6_fuel_level',
    JSON.stringify(await moreInfo(page)),
  );
}

/* ---------- every card holds its declared height ---------- */
{
  const heights = await page.evaluate(() =>
    [...document.querySelectorAll('[data-frame]')].flatMap((frame) =>
      [...frame.querySelectorAll('fluvy-vehicle-card')]
        .filter((el) => !el.dataset.cols && Math.round(el.getBoundingClientRect().width) === 360)
        .map((el) => ({
          frame: frame.dataset.frame,
          drawn: Math.round(
            el.shadowRoot.querySelector('[data-card]').getBoundingClientRect().height,
          ),
          declared: el.constructor.layoutHeight(el.config),
        })),
    ),
  );
  const off = heights.filter((h) => Math.abs(h.drawn - h.declared) > 0.5);
  check(
    'every card at a 360 column draws the height it declares',
    heights.length > 10 && off.length === 0,
    JSON.stringify(off),
  );
}
await page.close();

/* ---------- in half a section, the strip’s round gives way before a word is cut ---------- */
{
  const half = await suite.sheet('vehicle');
  const strips = frame(half, 'Strips · half a section').locator('fluvy-vehicle-card');
  const seen = await strips.evaluateAll((els) =>
    els.map((el) => ({
      width: Math.round(el.getBoundingClientRect().width),
      round: Boolean(el.shadowRoot.querySelector('.vh-card--mini > .vh-control')),
    })),
  );
  check(
    'a 152 strip has no round: its name and its charge have the row',
    seen.length === 3 && seen.every((s) => s.width === 152 && !s.round),
    JSON.stringify(seen),
  );
  await half.close();
}

/* ---------- the rounds lie by every word they can say, out of reach as when they read ---------- */
{
  const narrow = await suite.sheet('vehicle', { width: 266 });
  const gone = await read(card(narrow, 'Out of reach'));
  const parked = await read(card(narrow, 'Tesla Fleet · parked at work, sentry on'));
  check(
    'out of reach, a 266 card’s rounds give way where a parked car’s do: their dashes laid out as their words',
    gone.rounds.length === 3 && parked.rounds.length === 3,
    JSON.stringify({ gone: gone.rounds.length, parked: parked.rounds.length }),
  );
  await narrow.close();
}

/* ---------- no word runs past its box, in any language ---------- */
for (const lang of await everyLanguage()) {
  const at = await suite.sheet('vehicle', { lang });
  const bad = [];
  for (const el of await at.locator('fluvy-vehicle-card').all()) bad.push(...(await overflows(el)));
  check(
    `${lang}: every round’s word in its cell, every line in its column`,
    bad.length === 0,
    bad.join(' | '),
  );
  // a key's words 8 from its sides at the least; a word it cannot hold ends in its ellipsis, a figure is never cut
  const keys = await foot(card(at, 'GWM · small icons at its foot', 1));
  const edged = keys.filter(({ sides, cut, said }) => sides < 8 || (cut && /\d/.test(said)));
  check(
    `${lang}: its keys fill the column, no word against an edge, no figure cut`,
    keys.length === 4 && edged.length === 0,
    JSON.stringify(edged),
  );
  await at.close();
}

await suite.finish();
