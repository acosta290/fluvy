#!/usr/bin/env node
/**
 * The cards' variants, in a real Chromium against the playground. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-variants.mjs
 * What it proves: a compact cover, fan and robot are the head and one row — 144 tall, a quarter of a section
 * (`getGridOptions`), with nothing of the full card's below —; the thermostat's three variants ask the grid for
 * what they need; a player without its sources and volume draws neither; a compact lock is the head and the slide
 * and a compact alarm the head and its modes as chips, both 144; an alarm offers the modes it was asked for, in that
 * order; compact entity rows are 48 tall with the name alone, and a row wears its own colour; four readouts stand
 * on one row when asked; a plain heading is its title alone, 24 tall; a greeting can go without its avatar, date
 * and weather.
 */
import { frame, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const gridOf = (card) => card.evaluate((el) => el.getGridOptions());
const heightOf = async (card) =>
  (await card.locator('article, .fv-card').first().boundingBox())?.height;

/* ---------- compact devices: the head and one row ---------- */
{
  const page = await suite.sheet('devices-motion');
  for (const [title, tag, row, gone] of [
    [
      'Cover · compact',
      'fluvy-cover-card',
      '.fv-actions',
      ['fluvy-ruler', '.fv-chips', '.dv-cover'],
    ],
    [
      'Fan · compact',
      'fluvy-fan-card',
      'fluvy-ruler',
      ['.dv-value', '.dv-rows', '.fv-chips', '.fv-ruler-labels'],
    ],
    [
      'Vacuum · compact',
      'fluvy-vacuum-card',
      '.fv-actions',
      ['fluvy-ruler', '.fv-chips', '.dv-cols'],
    ],
  ]) {
    const card = frame(page, title).locator(tag).first();
    const height = await heightOf(card);
    check(`${title}: 144 tall (the head and one row)`, Math.abs(height - 144) < 1, `${height}`);
    check(`${title}: the row is there`, (await card.locator(row).count()) === 1);
    for (const selector of gone)
      check(
        `${title}: nothing of the full card (${selector})`,
        (await card.locator(selector).count()) === 0,
      );
    const grid = await gridOf(card);
    const least = tag === 'fluvy-fan-card' ? 4 : 6; // a command row needs half a section, a ruler a third
    check(
      `${title}: half a section, ${least} columns at the least`,
      grid.columns === 6 && grid.min_columns === least,
      JSON.stringify(grid),
    );
  }
  // the full cards still ask for their width
  const full = frame(page, 'Blinds').locator('fluvy-cover-card').first();
  const grid = await gridOf(full);
  check(
    'the full cover asks for two thirds of a section',
    grid.columns === 12 && grid.min_columns === 8,
    JSON.stringify(grid),
  );
  await page.close();
}

/* ---------- the thermostat's variants ---------- */
{
  const page = await suite.sheet('climate');
  const grids = {};
  for (const [title, key] of [
    ['Heat', 'dial'],
    ['Ruler · modes as chips', 'ruler'],
    ['Compact · off', 'compact'],
  ])
    grids[key] = await gridOf(frame(page, title).locator('fluvy-thermostat-card').first());
  check(
    'the dial asks for two thirds, the ruler half, the compact a quarter',
    grids.dial.min_columns === 8 &&
      grids.ruler.min_columns === 6 &&
      grids.compact.columns === 6 &&
      grids.compact.min_columns === 4,
    JSON.stringify(grids),
  );
  await page.close();
}

/* ---------- a player without its sources and volume ---------- */
{
  const page = await suite.sheet('media');
  const bare = frame(page, 'TV · bare').locator('fluvy-media-card').first();
  const full = frame(page, 'TV · sources').locator('fluvy-media-card').first();
  check(
    'the full player has its sources and its volume',
    (await full.locator('.fv-chips').count()) === 1 &&
      (await full.locator('.md-volume').count()) === 1,
  );
  check(
    'a player told to show neither draws neither',
    (await bare.locator('.fv-chips').count()) === 0 &&
      (await bare.locator('.md-volume').count()) === 0,
  );
  await page.close();
}

/* ---------- security: the compact lock and alarm, the alarm's modes ---------- */
{
  const page = await suite.sheet('devices-security');
  const lock = frame(page, 'Lock · compact').locator('fluvy-lock-card').first();
  const lockHeight = await heightOf(lock);
  check(
    'Lock · compact: 144 tall (the head and the slide)',
    Math.abs(lockHeight - 144) < 1,
    `${lockHeight}`,
  );
  check(
    'Lock · compact: the slide, none of the rows',
    (await lock.locator('.dv-slide').count()) === 1 &&
      (await lock.locator('.fv-row').count()) === 0,
  );
  const lockGrid = await gridOf(lock);
  check(
    'Lock · compact: half a section, a third at the least',
    lockGrid.columns === 6 && lockGrid.min_columns === 4,
    JSON.stringify(lockGrid),
  );
  const alarm = frame(page, 'Alarm · compact').locator('fluvy-alarm-card').first();
  const alarmHeight = await heightOf(alarm);
  check(
    'Alarm · compact: 144 tall (the head and the chips)',
    Math.abs(alarmHeight - 144) < 1,
    `${alarmHeight}`,
  );
  const full = frame(page, 'Alarm').locator('fluvy-alarm-card').first();
  const tiles = await full.locator('.fv-option').count();
  check(
    'Alarm · compact: one chip per mode, no tiles, no rows',
    (await alarm.locator('.fv-chip').count()) === tiles &&
      tiles === 3 &&
      (await alarm.locator('.fv-option').count()) === 0 &&
      (await alarm.locator('.fv-row').count()) === 0,
    `${await alarm.locator('.fv-chip').count()} chips for ${tiles} modes`,
  );
  const alarmGrid = await gridOf(alarm);
  check(
    'Alarm · compact: half a section, no less',
    alarmGrid.columns === 6 && alarmGrid.min_columns === 6,
    JSON.stringify(alarmGrid),
  );
  // at a phone's width the compact card is 264 wide: its words would wrap, so it keeps one row of named glyphs
  const phone = await suite.page('sheet=devices-security', {
    viewport: { width: 360, height: 1200 },
  });
  const narrow = frame(phone, 'Alarm · compact').locator('fluvy-alarm-card').first();
  const narrowHeight = await heightOf(narrow);
  const named = await narrow
    .locator('.fv-chip')
    .evaluateAll((els) => els.map((el) => [el.getAttribute('aria-label'), el.textContent.trim()]));
  check(
    'Alarm · compact at 360: still 144, its modes as glyphs each named for a reader',
    Math.abs(narrowHeight - 144) < 1 &&
      named.length === 3 &&
      named.every(([name, text]) => name && text === ''),
    `${narrowHeight} · ${JSON.stringify(named)}`,
  );
  await phone.close();
  const labelsOf = async (card) =>
    (await card.locator('.fv-option__label').allTextContents()).map((t) => t.trim());
  const all = await labelsOf(full);
  const asked = await labelsOf(
    frame(page, 'Alarm · two modes').locator('fluvy-alarm-card').first(),
  );
  check(
    'an alarm offers the modes it was asked for, in that order (away, then disarm)',
    asked.length === 2 && asked[0] === all[2] && asked[1] === all[0],
    `${asked.join(' · ')} of ${all.join(' · ')}`,
  );
  await page.close();
}

/* ---------- compact entity rows ---------- */
{
  const page = await suite.sheet('lists');
  const card = frame(page, 'Entities · compact').locator('fluvy-entities-card').first();
  const rows = card.locator('.fv-row');
  const heights = await rows.evaluateAll((els) =>
    els.map((el) => el.getBoundingClientRect().height),
  );
  check(
    'compact rows are 48 tall, every one of them',
    heights.length === 5 && heights.every((h) => Math.abs(h - 48) < 1),
    heights.join(' '),
  );
  check('a compact row is the name alone', (await card.locator('.fv-row__sub').count()) === 0);
  const teal = card.locator('.fv-row[data-accent]');
  const accentOf = (locator) =>
    locator.evaluate((el) => getComputedStyle(el).getPropertyValue('--fluvy-accent').trim());
  check(
    "the coloured row wears its own colour, the others the card's",
    (await teal.count()) === 1 && (await accentOf(teal)) !== (await accentOf(rows.nth(1))),
  );
  await page.close();
}

/* ---------- readouts on one row, a plain heading, a bare greeting ---------- */
{
  const page = await suite.sheet('home-extras');
  const tops = async (card) =>
    new Set(
      await card
        .locator('.hm-stat')
        .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top))),
    );
  const row = frame(page, 'E Readouts · row');
  const asRow = await tops(row.locator('fluvy-readouts-card').nth(0));
  const asGrid = await tops(row.locator('fluvy-readouts-card').nth(1));
  check(
    'four readouts stand on one row when asked, two by two when not',
    asRow.size === 1 && asGrid.size === 2,
    `${asRow.size} / ${asGrid.size} rows`,
  );
  const plain = frame(page, 'C Sections · plain').locator('fluvy-heading-card');
  const sectionHeights = await plain
    .locator('.hm-section')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  check(
    'a plain heading is 24 tall, its title alone',
    sectionHeights.length === 3 &&
      sectionHeights.every((h) => Math.abs(h - 24) < 1) &&
      (await plain.locator('.hm-section__meta').count()) === 0,
    sectionHeights.join(' '),
  );
  const bare = frame(page, 'B Greeting · bare').locator('fluvy-hello-card');
  const first = bare.nth(0);
  check(
    'a greeting told to show nothing but its words draws no avatar, date or weather',
    (await first.locator('.hm-avatar').count()) === 0 &&
      (await first.locator('.hm-hello__date').count()) === 0 &&
      (await first.locator('.hm-hello__weather').count()) === 0,
  );
  const second = bare.nth(1);
  check(
    'and one without its avatar keeps its date and weather',
    (await second.locator('.hm-avatar').count()) === 0 &&
      (await second.locator('.hm-hello__date').count()) === 2 &&
      (await second.locator('.hm-hello__weather').count()) === 1,
  );
  await page.close();
}

await suite.finish();
