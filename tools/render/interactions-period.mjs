#!/usr/bin/env node
/**
 * The energy cards following an Energy date picker (`collection_key`, 1.11) on the playground's `period` sheet: a
 * mock collection on the connection, as Home Assistant keeps one. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5193/ node interactions-period.mjs
 * What it proves: a follower has no Day · Week · Month chips and heads itself with the range ("Today"); the picker's
 * `setPeriod` + `refresh()` moves every follower at once ("Yesterday"); `?period=week` starts them on the week; a
 * collection that lands after the cards is found on the next `hass` (today without chips until then); each follower
 * holds the collection once (its `active` count is the cards on the page).
 */
import { frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const FOLLOWERS = ['fluvy-energy-flow-card', 'fluvy-energy-sankey-card', 'fluvy-energy-score-card'];

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
  check('each of the five followers holds the collection once', active === 5, String(active));

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
