#!/usr/bin/env node
/**
 * Water & gas, the devices nested, production by array (1.4), on the playground's `meters`, `nested` and `arrays`
 * sheets (real cards, simulated hass). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5187/ node interactions-meters.mjs
 * What it proves: a meter's today is its statistics since the house's midnight plus what it gained since, against a
 * typical day (given, or the mean of its last seven), and moves live; its flow is said as it reads; a leak is said
 * in words, the valve's switch calls the valve and flips at once; the Energy dashboard's meters are read (an imported
 * statistic left out); an unreadable meter says so. Devices hang under their parent on a spine from its circle, one
 * ink scale, what is not measured said per parent and for the house, "82 % measured" — from the rows, or from the
 * Energy dashboard's statistics; nothing is guessed when a device cannot be read. Production stacks each hour per
 * array (the first in the ink, the second a step down the ramp), the hours to come faint, a legend of each array's
 * day that follows the pointer, and a power sensor integrates to the same figures as a meter.
 */
import { calls, frame, moreInfo, PAGE_INTERVALS, reset, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim();
const texts = async (locator) =>
  (await locator.allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());
/** Each row as it reads: its title, its second line and its figure, a space between them. */
const rowTexts = (locator) =>
  locator.evaluateAll((rows) =>
    rows.map((row) =>
      [...row.querySelectorAll('.fv-row__title, .fv-row__sub, .fv-row__value')]
        .map((part) => part.textContent.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(' '),
    ),
  );

/* ---------------------------------------------------------------- water & gas */
{
  const page = await suite.sheet('meters');
  const card = frame(page, 'Water & gas').locator('fluvy-meters-card');
  const figures = await texts(card.locator('.ef-meter .fv-readout__value'));
  const notes = await texts(card.locator('.ef-meter__note'));
  check(
    'meters: today since midnight — 84 L of water, 2.7 m³ of gas',
    figures.join('|') === '84L|2.7m³',
    figures.join('|'),
  );
  check(
    'meters: what flows now and a typical day, in words',
    notes[0] === '6 L/min now · typical 150 L' && notes[1] === '0.4 m³/h now · typical 3.0 m³',
    notes.join(' | '),
  );
  const widths = await card
    .locator('.ef-bar__fill')
    .evaluateAll((fills) => fills.map((f) => f.style.width));
  check(
    'meters: the bar is today against the typical day (the week’s mean, and the one given)',
    widths.join() === '56%,90%',
    widths.join(),
  );
  check(
    'meters: the head says what it is',
    (await text(card.locator('.fv-card__title'))) === 'Water & gas' &&
      (await text(card.locator('.fv-card__sub'))) === 'Today · vs a typical day',
  );
  const rows = await rowTexts(card.locator('.fv-row'));
  check(
    'meters: the leak sensor says its state, where it is and when it checked in',
    rows[0] === 'Leak sensor Kitchen · checked 21:40 Dry',
    rows[0],
  );

  // the valve: the switch flips at once and the valve is called
  await reset(page);
  const valve = card.locator('.fv-row').nth(1);
  await valve.locator('[data-control]').click();
  await page.waitForTimeout(40);
  const flipped = await valve.locator('[data-control]').getAttribute('aria-checked');
  const c = await calls(page);
  check(
    'meters: the valve’s switch closes the valve (the card’s call), flipping at once',
    c.length === 1 &&
      c[0].s === 'valve.close_valve' &&
      JSON.stringify(c[0].t) === '{"entity_id":"valve.mt_main"}' &&
      flipped === 'false',
    `${JSON.stringify(c)} ${flipped}`,
  );

  // a tap on a meter opens it
  await reset(page);
  await card.locator('.ef-meter').first().click();
  check(
    'meters: a tap on a meter opens its more-info',
    (await moreInfo(page)).join() === 'sensor.mt_water',
    (await moreInfo(page)).join(),
  );

  // live: the meter moves on, the flow stops
  await page.evaluate(() => {
    window.fluvyMock.set('sensor.mt_water', '48216');
    window.fluvyMock.set('sensor.mt_water_flow', '0');
  });
  await page.waitForTimeout(200);
  check(
    'meters: a reading moves today and its bar live',
    (await text(card.locator('.ef-meter .fv-readout__value').first())) === '90L' &&
      (await card
        .locator('.ef-bar__fill')
        .first()
        .evaluate((f) => f.style.width)) === '60%' &&
      (await text(card.locator('.ef-meter__note').first())) === '0 L/min now · typical 150 L',
  );

  const dash = frame(page, 'From the Energy dashboard').locator('fluvy-meters-card');
  check(
    'meters: with none given, the Energy dashboard’s water and gas (an imported statistic left out)',
    (await texts(dash.locator('.ef-meter .fv-readout__label'))).join() === 'Water,Gas',
  );

  const gas = frame(page, 'Gas only').locator('fluvy-meters-card');
  check(
    'meters: a gas-only card wears the flame in the gas tone, and is called Gas',
    (await gas.locator('.fv-card__head .fv-ico--gas').count()) === 1 &&
      (await text(gas.locator('.fv-card__title'))) === 'Gas',
  );

  const dead = frame(page, 'Unreadable').locator('fluvy-meters-card');
  const deadNotes = await texts(dead.locator('.ef-meter__note'));
  const deadFigures = await texts(dead.locator('.ef-meter .fv-readout__value'));
  check(
    'meters: nothing guessed — unavailable, a dead flow, no statistics, a missing meter',
    deadFigures[0] === '—' &&
      deadNotes[0] === 'Unavailable' &&
      deadNotes[1] === '— now · typical 3.0 m³' &&
      deadNotes[2] === 'No statistics yet' &&
      deadNotes[3] === 'Entity not found',
    `${deadFigures.join('|')} / ${deadNotes.join(' | ')}`,
  );

  const leak = frame(page, 'A leak, the valve closed').locator('fluvy-meters-card');
  check(
    'meters: a leak is said in the warning ink',
    (await text(leak.locator('.fv-row__value--warning'))) === 'Wet' &&
      (await leak.locator('.fv-row .fv-ico--warning').count()) === 1,
  );

  const half = frame(page, 'Half a column').locator('fluvy-meters-card');
  check(
    'meters: half a column puts the bar under the figure, and the rows lose their circles',
    (await half.first().locator('.ef-meter--stack').count()) === 1 &&
      (await half.nth(1).locator('.ef-rows--bare').count()) === 1,
  );

  // a removed card leaves no timer behind
  await page.evaluate(() =>
    document.querySelectorAll('fluvy-meters-card').forEach((c) => c.remove()),
  );
  check(
    'meters: a card taken off the page leaves no interval behind',
    (await page.evaluate(() => window.__intervals())) <= PAGE_INTERVALS,
    String(await page.evaluate(() => window.__intervals())),
  );
  await page.close();
}

/* ---------------------------------------------------------------- devices, nested */
{
  const page = await suite.sheet('nested');
  const card = frame(page, 'Where it goes').locator('fluvy-energy-devices-card');
  const top = await card.evaluate((c) =>
    [...c.shadowRoot.querySelector('.ef-rows').children].map((el) =>
      el.classList.contains('en-tree__kids')
        ? `[${[...el.querySelectorAll('.fv-row')].map((r) => r.querySelector('.fv-row__title').textContent.trim()).join(',')}]`
        : el.querySelector('.fv-row__title')?.textContent.trim(),
    ),
  );
  check(
    'devices: children under their parent, biggest first, the rest of the house last',
    top.join(' ') === 'Heat pump Car Kitchen [Oven,Dishwasher,Not measured] Not measured',
    top.join(' '),
  );
  const rows = await rowTexts(card.locator('.fv-row'));
  check(
    'devices: shares of the house, of the parent, and what is not measured',
    rows[0] === 'Heat pump 38 % of the house 5.1 kWh' &&
      rows[2] === 'Kitchen 16 % · 2 devices 2.1 kWh' &&
      rows[3] === 'Oven 43 % of Kitchen 0.9 kWh' &&
      rows[5] === 'Not measured 24 % of Kitchen 0.5 kWh' &&
      rows[6] === 'Not measured 18 % · the rest of the house 2.4 kWh',
    rows.join(' | '),
  );
  check(
    'devices: the head carries the day and how much of the house is measured',
    (await text(card.locator('.fv-card__sub'))) === 'Today · 13.4 kWh' &&
      (await text(card.locator('.fv-badge'))) === '82 % measured',
  );
  const bars = await card
    .locator('.fv-bar__fill')
    .evaluateAll((fills) =>
      fills.map((f) => `${f.classList.contains('fv-bar--ink') ? 'ink' : 'tone'}:${f.style.width}`),
    );
  check(
    'devices: every bar in ink, on the house’s one scale',
    bars.join() === 'ink:38%,ink:28%,ink:16%,ink:7%,ink:5%,ink:4%,ink:18%',
    bars.join(),
  );
  const spine = await card.evaluate((c) => {
    const root = c.shadowRoot;
    const kids = root.querySelector('.en-tree__kids');
    const before = getComputedStyle(kids, '::before');
    const parent = kids.previousElementSibling.querySelector('.fv-ico').getBoundingClientRect();
    const box = kids.getBoundingClientRect();
    const x = box.left + parseFloat(before.left) + parseFloat(before.width) / 2;
    return { spine: x, circle: parent.left + parent.width / 2 };
  });
  check(
    'devices: the spine is centred on the parent’s circle',
    Math.abs(spine.spine - spine.circle) < 0.5,
    JSON.stringify(spine),
  );

  await reset(page);
  await card.locator('.fv-row').first().click();
  check(
    'devices: a tap on a device opens its more-info',
    (await moreInfo(page)).join() === 'sensor.nd_heat_pump',
    (await moreInfo(page)).join(),
  );

  // live: the oven draws more; then the dishwasher goes quiet — the kitchen's rest is no longer known
  await page.evaluate(() => window.fluvyMock.set('sensor.nd_oven', '1.2'));
  await page.waitForTimeout(200);
  const kitchenRest = (await rowTexts(card.locator('.en-tree__kids .fv-row'))).pop();
  check(
    'devices: a reading moves the kitchen’s rest live',
    kitchenRest === 'Not measured 10 % of Kitchen 0.2 kWh',
    kitchenRest,
  );
  await page.evaluate(() => window.fluvyMock.set('sensor.nd_dishwasher', 'unavailable'));
  await page.waitForTimeout(200);
  const kids = await texts(card.locator('.en-tree__kids .fv-row .fv-row__title'));
  check(
    'devices: an unreadable device hides its parent’s rest instead of guessing it',
    kids.join() === 'Oven,Dishwasher',
    kids.join(),
  );

  const dash = frame(page, 'From the Energy dashboard').locator('fluvy-energy-devices-card');
  const dashRows = await rowTexts(dash.locator('.fv-row'));
  check(
    'devices: with no rows, the Energy dashboard’s devices over today, nested as it nests them',
    dashRows[0] === 'Heat pump 38 % of the house 5.1 kWh' &&
      dashRows.includes('Oven 43 % of Kitchen 0.9 kWh') &&
      dashRows[dashRows.length - 1] === 'Not measured 18 % · the rest of the house 2.4 kWh' &&
      (await text(dash.locator('.fv-badge'))) === '82 % measured',
    dashRows.join(' | '),
  );

  const power = frame(page, 'Power, now').locator('fluvy-energy-devices-card');
  const powerRow = (await rowTexts(power.locator('.fv-row')))[0];
  check(
    'devices: power sensors read as power, now',
    powerRow === 'Heat pump 52 % of the house 1.2 kW',
    powerRow,
  );

  const orphan = frame(page, 'Two levels, a parent not listed').locator(
    'fluvy-energy-devices-card',
  );
  check(
    'devices: two levels deep, and a device whose parent is not listed stands at the top',
    (await orphan.locator('.en-tree__kids .en-tree__kids .fv-row').count()) === 2 &&
      (await text(orphan.locator('.ef-rows > .fv-row').last())).startsWith('Car'),
  );
  await page.close();
}

/* ---------------------------------------------------------------- production by array */
{
  const page = await suite.sheet('arrays');
  const card = frame(page, 'Two arrays').locator('fluvy-production-card');
  const legend = await texts(card.locator('.en-legend__item'));
  check(
    'arrays: a legend of each array’s day so far',
    legend.join(' | ') === 'East 5.2kWh | West 6.0kWh',
    legend.join(' | '),
  );
  check(
    'arrays: the day and the forecast as before (+6 % against what was expected by now)',
    (await text(card.locator('.fv-badge'))) === '+6 %' &&
      (await text(card.locator('.so-top .fv-readout__value').first())) === '11.2kWh',
  );
  const hours = await card.evaluate((c) =>
    [...c.shadowRoot.querySelectorAll('.pr-hour')].map((g) =>
      [...g.querySelectorAll('rect')].map(
        (r) => r.getAttribute('class').replace('en-bar', '').trim() || 'ink',
      ),
    ),
  );
  check(
    'arrays: each finished hour stacks the arrays — the first on top in the ink, the second a step down',
    hours[12]?.join() === 'is-second,ink' && hours[6]?.join() === 'ink',
    JSON.stringify(hours.slice(5, 17)),
  );
  check(
    'arrays: the hours to come are the forecast, hollow',
    hours[16]?.join() === 'is-forecast' && hours[21]?.length === 0,
    JSON.stringify(hours.slice(15)),
  );

  // the pointer: the readout and the legend follow the hour under it
  const chart = card.locator('.pr-chart');
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * (12.5 / 24), box.y + box.height / 2);
  await page.waitForTimeout(150);
  const scrubbed = await texts(card.locator('.en-legend__value'));
  const label = await text(card.locator('.so-top .fv-readout__label').first());
  check(
    'arrays: under the pointer, the hour — its figure and each array’s share of it',
    label === '12:00 – 13:00' && scrubbed.join() === '0.5kWh,1.0kWh',
    `${label} ${scrubbed.join()}`,
  );
  await page.mouse.move(box.x - 40, box.y - 40);
  await page.waitForTimeout(150);

  // live: the east roof's meter moves on in the hour in progress
  await page.evaluate(() => {
    const now = Number(
      document.querySelector('fluvy-production-card').hass.states['sensor.ar_east'].state,
    );
    window.fluvyMock.set('sensor.ar_east', String(Math.round((now + 0.1) * 1000) / 1000));
  });
  await page.waitForTimeout(200);
  check(
    'arrays: an energy meter’s hour in progress is read live',
    (await texts(card.locator('.en-legend__value')))[0] === '5.3kWh',
    (await texts(card.locator('.en-legend__value'))).join(),
  );

  const power = frame(page, 'Two arrays, power sensors').locator('fluvy-production-card');
  check(
    'arrays: power sensors integrate to the same day (hourly means, five-minute means since the hour)',
    (await texts(power.locator('.en-legend__value'))).join() === '5.2kWh,6.0kWh',
    (await texts(power.locator('.en-legend__value'))).join(),
  );

  const four = frame(page, 'Four arrays').locator('fluvy-production-card');
  const ramp = await four.evaluate((c) =>
    [...c.shadowRoot.querySelectorAll('.en-sq')].map((sq) => getComputedStyle(sq).backgroundColor),
  );
  check(
    'arrays: four arrays, four steps of the ramp, each its own',
    ramp.length === 4 && new Set(ramp).size === 4,
    ramp.join(' | '),
  );

  const dead = frame(page, 'An array unreadable').locator('fluvy-production-card');
  check(
    'arrays: an array that cannot be read says so in the legend',
    (await texts(dead.locator('.en-legend__value'))).slice(1).join() === '—,—',
    (await texts(dead.locator('.en-legend__value'))).join(),
  );
  await page.close();
}

await suite.finish();
