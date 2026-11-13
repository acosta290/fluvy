#!/usr/bin/env node
/**
 * Our history in Home Assistant's details dialog (1.20, #162) on the playground's `details` sheet: a stand-in of Home
 * Assistant's dialog and of its `ha-more-info-history`, which the real takeover wraps (real block, simulated hass).
 * Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-details.mjs
 * What it proves: ours stands in Home Assistant's element, its words on the column the dialog's state row starts on;
 * a meter's bars are read by pointing (the bubble says the hour and what it gained) and by the keys, Escape letting go;
 * a chip draws another window; Total draws the running total broken at midnight, its
 * reset marked; a door's band is read stretch by stretch; Open in History carries the entity and the window.
 */
import { frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const text = async (locator) => ((await locator.textContent()) ?? '').replace(/\s+/g, ' ').trim();
const near = (a, b, tolerance = 0.5) => Math.abs(a - b) <= tolerance;
const blockOf = (page, title) => frame(page, title).locator('fluvy-details-history');
/** Points at a fraction of a block's plot, as a mouse does. */
const pointAt = async (page, block, fraction) => {
  const plot = block.locator('.dh-plot');
  await plot.scrollIntoViewIfNeeded();
  const box = await plot.boundingBox();
  await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
  await settle(page, 200);
};

const page = await suite.sheet('details', { width: 580 });

/* ---------- ours in Home Assistant's element, on its column ---------- */
{
  const dialog = frame(page, 'Daily yield · what each hour gave, a phone');
  check(
    'ours stands in Home Assistant’s history block, its own draws nothing',
    (await dialog.locator('ha-more-info-history fluvy-details-history').count()) === 1 &&
      (await dialog.locator('ha-more-info-history h2').count()) === 0,
  );
  const row = await dialog.locator('.state').boundingBox();
  const title = await dialog.locator('fluvy-details-history .fv-card__head').boundingBox();
  check(
    'its head starts on the column of the dialog’s state row (Home Assistant’s 24 sides)',
    near(row.x, title.x),
    `${row.x} vs ${title.x}`,
  );
}

/* ---------- a meter's bars, read by pointing and by the keys ---------- */
{
  const block = blockOf(page, 'Daily yield · what each hour gave, a phone');
  check('twelve hours of bars', (await block.locator('.fc-bar').count()) >= 9);
  await pointAt(page, block, 0.62);
  const bubble = block.locator('.fv-bubble');
  const said = await text(bubble);
  check(
    'pointing reads an hour: what it gained and when',
    /^\d+\.\d\d kWh ?1[4-6]:00$/.test(said),
    said,
  );
  await page.mouse.move(0, 0);
  await settle(page, 200);
  const plot = block.locator('.dh-plot');
  await plot.focus();
  await page.keyboard.press('End');
  await settle(page, 200);
  const end = await text(bubble);
  check('End reads the hour still running, so far', /so far$/.test(end), end);
  await page.keyboard.press('Escape');
  await settle(page, 200);
  check('Escape lets the chart go', (await bubble.count()) === 0);
}

/* ---------- the window, and the meter's running total ---------- */
{
  const block = blockOf(page, 'Daily yield · what each hour gave, a phone');
  await block.locator('.fv-chip', { hasText: '24 h' }).click();
  await settle(page, 600);
  check(
    'a chip draws its window: 24 h chosen, its hours read',
    (await text(block.locator('.fv-chip.is-active').first())) === '24 h' &&
      (await block.locator('.fc-bar').count()) >= 9,
  );
  await block.locator('.fv-chip', { hasText: 'Total' }).click();
  await settle(page, 600);
  const d = (await block.locator('.curve-line, .fc-line').first().getAttribute('d')) ?? '';
  check(
    'Total draws the running total, broken where the meter was reset at midnight',
    (d.match(/M/g) ?? []).length === 2 && (await block.locator('.dh-reset').count()) === 1,
    d.slice(0, 60),
  );
  check(
    'its head says it is the running total',
    (await text(block.locator('.fv-card__sub'))) === 'Running total',
  );
}

/* ---------- a door's stretches ---------- */
{
  const block = blockOf(page, 'Front door · open and shut over a day');
  check(
    'the door was open seven times in the day',
    (await block.locator('.fv-stretch.is-on').count()) === 7,
  );
  await pointAt(page, block, 0.5);
  const said = await text(block.locator('.fv-bubble'));
  check(
    'pointing reads the stretch under it, from when to when',
    /^Closed ?\d\d:\d\d → \d\d:\d\d$/.test(said),
    said,
  );
}

/* ---------- the way on, and the next dialog ---------- */
{
  const block = blockOf(page, 'Living room · a measure over the house’s twelve hours');
  const href = (await block.locator('a.dh-open').getAttribute('href')) ?? '';
  const params = new URLSearchParams(href.split('?')[1]);
  check(
    'Open in History opens the History page on the entity and its window',
    href.startsWith('/history?') &&
      params.get('entity_id') === 'sensor.living_room_temperature' &&
      params.get('back') === '1' &&
      Number.isFinite(Date.parse(params.get('start_date') ?? '')),
    href,
  );
}
await page.close();

await suite.finish();
