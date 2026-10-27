#!/usr/bin/env node
/**
 * The Energy usage card (#62) on the playground's `usage` sheet: a house whose meters the recorder keeps hour by hour,
 * answered for any range at the sheets' moment. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5209/ node interactions-usage.mjs
 * What it proves: a pointer over the chart reads a slot's whole stack in the bubble — its parts above the line add up
 * to the slot's use, what went out is listed under them — and the bubble stays inside the card; the keys walk the
 * slots (Home, → a slot, End, Escape); the period before is drawn as ghosts only where it is compared, and the bubble
 * says its figure; the chips change the span and its axis; the card follows an Energy period strip on its collection
 * — ‹ moves it to yesterday, Compare draws the ghosts — without chips of its own; in dark mode the same.
 */
import { frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** A frame's nth usage card. */
const usage = (page, title, n = 0) => frame(page, title).locator('fluvy-energy-usage-card').nth(n);

/** What a card's bubble says: its lines, each its words and its figure. */
const bubble = (card) =>
  card
    .locator('.eu-bubble__line')
    .evaluateAll((lines) =>
      lines.map((line) => [...line.children].map((part) => part.textContent.trim())),
    );

/** A figure as a number ("1.4 kWh" → 1.4, "450 Wh" → 0.45). */
const kWh = (text) => {
  const [value, unit] = text.replace(/,/g, '').split(' ');
  return Number(value) / (unit === 'Wh' ? 1000 : unit === 'MWh' ? 0.001 : 1);
};

const sub = async (card) => ((await card.locator('.fv-card__sub').textContent()) ?? '').trim();

/** The pointer over a card's chart, at a fraction of its width. */
async function point(page, card, fraction) {
  const chart = card.locator('.eu-chart');
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
  await settle(page, 300);
}

/* ---------- reading the chart ---------- */
for (const mode of ['light', 'dark']) {
  const page = await suite.sheet('usage', { extra: mode === 'dark' ? '&mode=dark' : '' });
  const day = usage(page, 'A day');
  check(`${mode}: at rest no bubble`, (await day.locator('.eu-bubble').count()) === 0);
  // half past one in the afternoon: the sun's hour
  await point(page, day, 0.6);
  const lines = await bubble(day);
  const [head, ...rows] = lines;
  const out = rows.filter(([name]) => name === 'Charged' || name === 'Exported');
  const above = rows.filter(([name]) => !out.some(([o]) => o === name));
  const sum = above.reduce((total, [, figure]) => total + kWh(figure), 0);
  check(
    `${mode}: a pointer reads the slot’s whole stack — its hour, its use, each part above the line adding up to it, what went out under them`,
    /^\d\d:00 – \d\d:00$/.test(head?.[0] ?? '') &&
      above.length > 0 &&
      Math.abs(sum - kWh(head?.[1] ?? '0')) <= 0.051 * above.length &&
      lines.indexOf(out[0] ?? []) > lines.indexOf(above[above.length - 1] ?? []),
    JSON.stringify(lines),
  );
  const inside = await day.evaluate((card) => {
    const root = card.shadowRoot;
    const outer = root.querySelector('article').getBoundingClientRect();
    const box = root.querySelector('.eu-bubble').getBoundingClientRect();
    return (
      box.left >= outer.left - 0.5 &&
      box.right <= outer.right + 0.5 &&
      box.top >= outer.top - 0.5 &&
      box.bottom <= outer.bottom + 0.5
    );
  });
  check(`${mode}: the bubble stays inside the card`, inside);
  const label = await day.locator('.eu-chart').getAttribute('aria-label');
  check(
    `${mode}: the chart says the slot read to a reader`,
    label?.startsWith(head?.[0] ?? '?') === true,
    label ?? '',
  );
  // the pointer leaves: the chart rests
  await page.mouse.move(2, 2);
  await settle(page, 300);
  check(
    `${mode}: the pointer gone, the bubble goes`,
    (await day.locator('.eu-bubble').count()) === 0,
  );

  // the mini strip reads the same, its bubble rising into the card above it
  const mini = usage(page, 'Compact and mini', 1);
  await point(page, mini, 0.3);
  const miniInside = await mini.evaluate((card) => {
    const root = card.shadowRoot;
    const outer = root.querySelector('article').getBoundingClientRect();
    const box = root.querySelector('.eu-bubble')?.getBoundingClientRect();
    return Boolean(box) && box.top >= outer.top - 0.5 && box.bottom <= outer.bottom + 0.5;
  });
  check(`${mode}: the mini strip’s bubble stays inside its card`, miniInside);
  await page.close();
}

/* ---------- the keys ---------- */
{
  const page = await suite.sheet('usage');
  const week = usage(page, 'A week');
  const chart = week.locator('.eu-chart');
  await chart.focus();
  await page.keyboard.press('Home');
  await settle(page, 200);
  const first = (await bubble(week))[0]?.[0];
  await page.keyboard.press('ArrowRight');
  await settle(page, 200);
  const second = (await bubble(week))[0]?.[0];
  await page.keyboard.press('End');
  await settle(page, 200);
  const last = (await bubble(week))[0]?.[0];
  check(
    'the keys walk the slots: Home the week’s first day, → the next, End its last',
    first === 'Sun, Sep 13' && second === 'Mon, Sep 14' && last === 'Sat, Sep 19',
    JSON.stringify([first, second, last]),
  );
  await page.keyboard.press('Escape');
  await settle(page, 200);
  check('Escape lets the reading go', (await week.locator('.eu-bubble').count()) === 0);
  await page.close();
}

/* ---------- the period before ---------- */
{
  const page = await suite.sheet('usage');
  check(
    'a card that does not compare draws no ghosts',
    (await usage(page, 'A day').locator('.eu-ghost').count()) === 0,
  );
  const compared = usage(page, 'Compare');
  const ghosts = await compared.locator('.eu-ghost').count();
  // the evening still to come: yesterday's columns stand alone there
  await point(page, compared, 0.97);
  const lines = await bubble(compared);
  const [hour, ...rest] = lines;
  check(
    'compare draws yesterday’s ghost columns behind today’s, and the bubble says yesterday’s figure where today has none yet',
    ghosts >= 24 &&
      hour?.[1] === '0 kWh' &&
      rest.length === 1 &&
      rest[0]?.[0] === 'Yesterday' &&
      kWh(rest[0]?.[1] ?? '0') > 0,
    `${ghosts} ${JSON.stringify(lines)}`,
  );
  await page.close();
}

/* ---------- the chips ---------- */
{
  const page = await suite.sheet('usage');
  const card = usage(page, 'A day');
  await card.locator('.fv-chip', { hasText: 'Week' }).click();
  await settle(page, 600);
  const axis = await card.locator('.eu-axis span').allTextContents();
  check(
    'a chip changes the span: Week says its dates and lays the days of the week under the columns',
    (await sub(card)) === 'Sep 13 – 19' && axis.join(' ') === 'Sun Mon Tue Wed Thu Fri Sat',
    `${await sub(card)} ${JSON.stringify(axis)}`,
  );
  await card.locator('.fv-chip', { hasText: 'Year' }).click();
  await settle(page, 600);
  check('Year says the year, its months under the columns', (await sub(card)) === '2026');
  await page.close();
}

/* ---------- following an Energy period strip ---------- */
{
  const page = await suite.sheet('usage');
  const strip = frame(page, 'Following').locator('fluvy-energy-period-card').first();
  const card = usage(page, 'Following');
  const today = {
    sub: await sub(card),
    chips: await card.locator('.en-period').count(),
    total: ((await card.locator('.fv-badge').textContent()) ?? '').trim(),
  };
  check(
    'a follower heads itself with the picker’s range ("Today"), without chips of its own',
    today.sub === 'Today' && today.chips === 0 && /kWh$/.test(today.total),
    JSON.stringify(today),
  );
  await strip.locator('.ep-step[aria-label="Previous period"]').click();
  await settle(page, 900);
  const yesterday = {
    sub: await sub(card),
    total: ((await card.locator('.fv-badge').textContent()) ?? '').trim(),
  };
  check(
    '‹ on the strip moves the card to yesterday, with yesterday’s figures',
    yesterday.sub === 'Yesterday' && yesterday.total !== today.total,
    JSON.stringify(yesterday),
  );
  check('…a whole day, no ghosts yet', (await card.locator('.eu-ghost').count()) === 0);
  await strip.locator('button[aria-pressed]').click();
  await settle(page, 900);
  check(
    'the strip’s Compare draws the day before as ghosts behind the card’s columns',
    (await card.locator('.eu-ghost').count()) > 0,
  );
  await page.close();
}

await suite.finish();
