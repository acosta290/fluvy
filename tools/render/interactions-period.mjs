#!/usr/bin/env node
/**
 * The energy cards following an Energy date picker (`collection_key`, 1.11) and the Energy period card that moves it,
 * on the playground's `period` sheet: a mock collection on the connection, as Home Assistant keeps one. Exit code 1 on
 * any failure.
 *   PLAYGROUND=http://127.0.0.1:5193/ node interactions-period.mjs
 * What it proves: a follower has no Day · Week · Month chips and heads itself with the range ("Today"); the picker's
 * `setPeriod` + `refresh()` moves every follower at once ("Yesterday"); `?period=week` starts them on the week; a
 * collection that lands after the cards is found on the next `hass` (today without chips until then); each card
 * holds the collection once (its `active` count is the cards on the page that name it). The strip: ‹ and › move the
 * flow, the sankey and the score together; a stacked chip picks its grain's span; the span's words open the sheet,
 * whose presets pick and close it and whose custom grid picks whole days; a key no picker holds is made by Home
 * Assistant's date card hidden in the strip; a page that is no dashboard says so, its buttons off.
 */
import { frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const FOLLOWERS = ['fluvy-energy-flow-card', 'fluvy-energy-sankey-card', 'fluvy-energy-score-card'];

/** The cards on the page that name a key: each holds its collection once. */
const holders = (page, key) =>
  page.evaluate(
    (key) =>
      [...document.querySelectorAll('[data-frame] *')].filter(
        (element) => element.config?.collection_key === key,
      ).length,
    key,
  );

/** What a frame's strip says: its span's words. */
const spanOf = async (page, title) =>
  (
    (await frame(page, title).locator('fluvy-energy-period-card .ep-date').first().textContent()) ??
    ''
  ).trim();

/** The followers' first segments, all the same: the span they say. */
const said = async (page, title) => [...new Set((await read(page, title)).map((c) => c.sub))];

/** Each follower's subtitle (its first segment) and whether it draws chips. */
const read = (page, title) =>
  Promise.all(
    FOLLOWERS.map(async (tag) => {
      const card = frame(page, title).locator(tag).first();
      return {
        tag,
        sub: ((await card.locator('.fv-card__sub').textContent()) ?? '').trim().split(' · ')[0],
        chips: await card.locator('.en-period').count(),
      };
    }),
  );

/* ---------- the followers, today ---------- */
{
  const page = await suite.sheet('period');
  const cards = await read(page, 'Followers');
  check(
    'every follower draws without chips and heads itself with the range: "Today"',
    cards.every((c) => c.chips === 0 && c.sub === 'Today'),
    JSON.stringify(cards),
  );
  const active = await page.evaluate(() => window.fluvyMock.hass().connection._energy_pg.active);
  const named = await holders(page, 'energy_pg');
  check(
    'each card that names the key holds the collection once (the followers and the strips)',
    active === named && named > 5,
    `${active} of ${named}`,
  );

  // the picker moves to yesterday: one setPeriod and refresh, every follower follows
  await page.evaluate(async () => {
    const collection = window.fluvyMock.hass().connection._energy_pg;
    const start = new Date(2026, 8, 16);
    collection.setPeriod(start, new Date(start.getTime() + 86_400_000 - 1));
    await collection.refresh();
  });
  await settle(page, 600);
  const moved = await read(page, 'Followers');
  check(
    'after the picker’s setPeriod + refresh, three followers re-render on "Yesterday", still without chips',
    moved.every((c) => c.chips === 0 && c.sub === 'Yesterday'),
    JSON.stringify(moved),
  );
  const devices = frame(page, 'Followers').locator('fluvy-energy-devices-card').first();
  check(
    'the devices card says the range too',
    ((await devices.locator('.fv-card__sub').textContent()) ?? '').trim().startsWith('Yesterday'),
  );
  await page.close();
}

/* ---------- the strip moves them ---------- */
{
  const page = await suite.sheet('period');
  const strip = frame(page, 'Followers').locator('fluvy-energy-period-card').first();
  check('the strip says the span: "Today"', (await spanOf(page, 'Followers')) === 'Today');
  check(
    'nothing after today: › is off',
    await strip.locator('.ep-step[aria-label="Next period"]').isDisabled(),
  );
  await strip.locator('.ep-step[aria-label="Previous period"]').click();
  await settle(page, 600);
  const back = await said(page, 'Followers');
  check(
    '‹ on the strip moves the flow, the sankey and the score together to "Yesterday"',
    back.length === 1 &&
      back[0] === 'Yesterday' &&
      (await spanOf(page, 'Followers')) === 'Yesterday',
    JSON.stringify(back),
  );
  await strip.locator('.ep-step[aria-label="Next period"]').click();
  await settle(page, 600);
  const again = await said(page, 'Followers');
  check(
    '› brings them back to "Today"',
    again.length === 1 && again[0] === 'Today',
    JSON.stringify(again),
  );
  // a stacked strip's chip: its grain's current span, every follower with it
  await frame(page, 'Stacked')
    .locator('fluvy-energy-period-card .fv-chip', { hasText: 'Month' })
    .click();
  await settle(page, 600);
  const month = await said(page, 'Followers');
  check(
    'the stacked strip’s Month picks this month for every card on the key: "September"',
    month.length === 1 && month[0] === 'September',
    JSON.stringify(month),
  );
  const word = await page.evaluate(() => localStorage.getItem('energy-default-period-_energy_pg'));
  check('…and remembers Home Assistant’s word for it', word === 'this_month', String(word));
  await page.evaluate(() => localStorage.clear());
  await page.close();
}

/* ---------- the sheet ---------- */
{
  const page = await suite.sheet('period');
  const strip = frame(page, 'Row').locator('fluvy-energy-period-card').first();
  await strip.locator('.ep-date').click();
  await settle(page, 400);
  const sheet = strip.locator('dialog[open] .ep-sheet');
  const presets = (await sheet.locator('.fv-chip').allTextContents()).map((t) => t.trim());
  check(
    'the span’s words open the sheet: the presets of every period',
    JSON.stringify(presets) ===
      JSON.stringify(['Today', 'Yesterday', 'This week', 'This month', 'This year', 'Custom']),
    JSON.stringify(presets),
  );
  await sheet.locator('.fv-chip', { hasText: 'This week' }).click();
  await settle(page, 700);
  const week = await said(page, 'Followers');
  // the playground speaks English: its weeks start on Sunday
  check(
    'a preset picks and closes the sheet: the followers say the week (Sunday 13 to Saturday 19)',
    week.length === 1 && /13.*19/.test(week[0]) && (await strip.locator('dialog').count()) === 0,
    JSON.stringify(week),
  );
  // custom: the grid in whole days, two taps and Show
  await strip.locator('.ep-date').click();
  await settle(page, 400);
  await sheet.locator('.fv-chip', { hasText: 'Custom' }).click();
  await settle(page, 600);
  const grid = sheet.locator('fluvy-date-picker');
  check(
    'Custom opens the date grid, in whole days: no hours, no presets of its own',
    (await grid.count()) === 1 &&
      (await grid.locator('.ad-times').count()) === 0 &&
      (await grid.locator('.ad-presets').count()) === 0,
  );
  await grid.locator('button[aria-label*="September 14"]').click();
  await grid.locator('button[aria-label*="September 16"]').click();
  await grid.locator('.ad-apply .fv-btn').click();
  await settle(page, 700);
  const span = await page.evaluate(() => {
    const c = window.fluvyMock.hass().connection._energy_pg;
    return [c.start.getTime(), c.end.getTime()];
  });
  const custom = await said(page, 'Followers');
  check(
    'the custom span is whole days, 14 to 16 September, and the followers say it',
    span[0] === new Date(2026, 8, 14).getTime() &&
      span[1] === new Date(2026, 8, 17).getTime() - 1 &&
      custom.length === 1 &&
      /14.*16/.test(custom[0]),
    `${JSON.stringify(custom)} ${span.map((t) => new Date(t).toISOString())}`,
  );
  await page.close();
}

/* ---------- made by Home Assistant, or no dashboard ---------- */
{
  const page = await suite.sheet('period');
  const made = await page.evaluate(() => {
    const c = window.fluvyMock.hass().connection._energy_made;
    return c ? c.active : -1;
  });
  check(
    'a key no picker holds: Home Assistant’s date card, hidden in the strip, made the collection, and both cards hold it',
    made === 2,
    String(made),
  );
  const hidden = frame(page, 'Made by Home Assistant').locator(
    'fluvy-energy-period-card .ep-owner hui-energy-date-selection-card',
  );
  check('…its date card hidden from sight and from readers', (await hidden.count()) === 1);
  const away = frame(page, 'Not on a dashboard').locator('fluvy-energy-period-card').first();
  const note = ((await away.locator('.ep-date').textContent()) ?? '').trim();
  const off = await away
    .locator('.ep-row button')
    .evaluateAll((buttons) => buttons.every((b) => b.disabled));
  check(
    'a page that is no dashboard: "Only on a dashboard", every button off',
    note === 'Only on a dashboard' && off,
    note,
  );
  await page.close();
}

/* ---------- a week, from the page ---------- */
{
  const page = await suite.sheet('period', { extra: '&period=week' });
  const cards = await read(page, 'Followers');
  check(
    '?period=week: the followers head themselves with the week’s dates',
    cards.every((c) => c.chips === 0 && /14.*20/.test(c.sub)),
    JSON.stringify(cards),
  );
  await page.close();
}

/* ---------- a collection found late ---------- */
{
  const page = await suite.page('sheet=period&width=360&lang=en', { wait: 150 });
  const late = frame(page, 'Found late').locator('fluvy-energy-flow-card').first();
  const early = {
    sub: ((await late.locator('.fv-card__sub').textContent()) ?? '').trim(),
    chips: await late.locator('.en-period').count(),
  };
  check(
    'before the collection lands, a follower draws today without chips ("Since midnight")',
    early.chips === 0 && early.sub === 'Since midnight',
    JSON.stringify(early),
  );
  await settle(page, 1400);
  const found = {
    sub: ((await late.locator('.fv-card__sub').textContent()) ?? '').trim(),
    chips: await late.locator('.en-period').count(),
    active: await page.evaluate(() => window.fluvyMock.hass().connection._energy_late.active),
  };
  check(
    'once it lands, the follower finds it on the next hass and follows it ("Today"), one subscription',
    found.chips === 0 && found.sub === 'Today' && found.active === 2,
    JSON.stringify(found),
  );
  await page.close();
}

await suite.finish();
