#!/usr/bin/env node
/**
 * The cards' variants, in a real Chromium against the playground. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-variants.mjs
 * What it proves: a compact cover, fan and robot are the head and one row — 144 tall, a quarter of a section
 * (`getGridOptions`), with nothing of the full card's below —; the thermostat's three variants ask the grid for
 * what they need; a player without its sources and volume draws neither.
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

await suite.finish();
