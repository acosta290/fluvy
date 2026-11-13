#!/usr/bin/env node
/**
 * Production's forecast, 1.20 (#183), on the playground's `forecast` sheet (real cards, simulated hass). Exit code 1
 * on any failure.
 *   PLAYGROUND=http://127.0.0.1:5220/ node interactions-forecast.mjs
 * What it proves: today's card draws Home Assistant's own forecast behind its bars and, while an hour is read, says
 * that hour's forecast beside what it made; tomorrow is the forecast alone, read hour by hour beside today's; the
 * days ahead are a bar a day — the last day a forecast only begins left out — each read by its name, their names
 * centred under their bars, inside the column and thinned from the first in half a section; two planes add up; a
 * house with no forecast says so in a panel as tall as the card, and is never asked for one; every card of a house
 * shares one answer.
 */
import { frame, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const card = (page, title, n = 0) => frame(page, title).locator('fluvy-production-card').nth(n);
const texts = async (locator) =>
  (await locator.allTextContents()).map((text) => text.replace(/\s+/g, ' ').trim());
/** The value row's readouts, label then figure (its unit a span of its own, 4 px after it): `[['Tomorrow', '21.5kWh']]`. */
const row = async (production) => {
  const labels = await texts(production.locator('.so-top .fv-readout__label'));
  const values = await texts(production.locator('.so-top .fv-readout__value'));
  return labels.map((label, i) => [label, values[i]]);
};
/** Reads the chart at a fraction of its width, as a mouse over it does; `null` takes the pointer away. */
const readAt = async (page, production, fraction) => {
  const chart = production.locator('.so-bars, .pr-chart').first();
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  if (fraction === null) await page.mouse.move(box.x - 40, box.y - 40);
  else await page.mouse.move(box.x + box.width * fraction, box.y + box.height * 0.6);
  await page.waitForTimeout(150);
};

{
  const page = await suite.sheet('forecast');

  /* ---------- today: Home Assistant's forecast, and its figure under the pointer ---------- */
  const today = card(page, 'Today · Home Assistant’s forecast');
  check(
    'today: the house’s forecast stands behind the bars, the head compares the day with it',
    (await today.locator('.so-bar__forecast').count()) === 13 &&
      (await texts(today.locator('.fv-card__sub')))[0] === 'Today · vs forecast' &&
      (await texts(today.locator('.fv-badge')))[0] === '+6 %',
    JSON.stringify(await row(today)),
  );
  await readAt(page, today, 12.5 / 24);
  const read = await row(today);
  check(
    'today: an hour read says what it made and what was forecast for it',
    read[0]?.[0] === '12:00 – 13:00' && read[0]?.[1] === '2.7kWh' && read[1]?.[1] === '2.6kWh',
    JSON.stringify(read),
  );
  await readAt(page, today, null);
  check(
    'today: the pointer gone, the day’s figures are back',
    JSON.stringify(await row(today)) ===
      JSON.stringify([
        ['So far today', '13.6kWh'],
        ['Forecast', '18.4kWh'],
      ]),
    JSON.stringify(await row(today)),
  );

  /* ---------- tomorrow: the forecast alone ---------- */
  const tomorrow = card(page, 'Tomorrow');
  check(
    'tomorrow: every bar is the forecast’s, none made; its total beside today’s forecast',
    (await tomorrow.locator('.so-bar').count()) === 24 &&
      (await tomorrow.locator('.so-bar__fill').count()) === 0 &&
      (await tomorrow.locator('.pr-ahead .so-bar__forecast').count()) === 13 &&
      JSON.stringify(await row(tomorrow)) ===
        JSON.stringify([
          ['Tomorrow', '21.5kWh'],
          ['Today', '18.4kWh'],
        ]),
    JSON.stringify(await row(tomorrow)),
  );
  await readAt(page, tomorrow, 12.5 / 24);
  const hour = await row(tomorrow);
  check(
    'tomorrow: an hour read says its forecast, and today’s for the same hour',
    hour[0]?.[0] === '12:00 – 13:00' && hour[0]?.[1] === '3.0kWh' && hour[1]?.[1] === '2.6kWh',
    JSON.stringify(hour),
  );
  await readAt(page, tomorrow, null);
  check(
    'tomorrow: the best hour, when, and the hours of sun under the bars',
    JSON.stringify(await texts(tomorrow.locator('.so-cols .fv-readout__value'))) ===
      JSON.stringify(['3.0kWh', '12:00', '13h']),
  );

  /* ---------- the days ahead ---------- */
  const ahead = card(page, 'Days ahead');
  const names = await texts(ahead.locator('.fv-axis span'));
  check(
    'days ahead: a bar a day for the week the forecast holds, the day it only begins left out',
    (await ahead.locator('.pr-days .so-bar').count()) === 7 &&
      names.join(' ') === 'Fri Sat Sun Mon Tue Wed Thu' &&
      (await texts(ahead.locator('.fv-card__sub')))[0] === 'Next 7 days · forecast',
    names.join(' '),
  );
  const centred = await ahead.evaluate((el) => {
    const root = el.shadowRoot;
    const bars = [...root.querySelectorAll('.pr-days .so-bar')].map((bar) => {
      const r = bar.getBoundingClientRect();
      return r.left + r.width / 2;
    });
    const range = document.createRange();
    return [...root.querySelectorAll('.fv-axis span')].map((span, i) => {
      range.selectNodeContents(span);
      const r = range.getBoundingClientRect();
      return Math.abs(r.left + r.width / 2 - bars[i]);
    });
  });
  check(
    'days ahead: each name centred under its bar',
    centred.length === 7 && centred.every((off) => off <= 1),
    centred.map((off) => off.toFixed(1)).join(' '),
  );
  await readAt(page, ahead, 2.5 / 7);
  const day = await row(ahead);
  check(
    'days ahead: a day read by its name and its figure',
    /^Sunday/.test(day[0]?.[0] ?? '') && day[0]?.[1] === '24.1kWh',
    JSON.stringify(day),
  );
  await readAt(page, ahead, null);
  check(
    'days ahead: the total at rest, the average and the best and lowest day under the bars',
    JSON.stringify(await row(ahead)) === JSON.stringify([['Total', '126kWh']]) &&
      JSON.stringify(await texts(ahead.locator('.so-cols .fv-readout__value'))) ===
        JSON.stringify(['18.0kWh', 'Sun', 'Tue']),
    JSON.stringify(await texts(ahead.locator('.so-cols .fv-readout__value'))),
  );

  /* ---------- a style: every bar to come ---------- */
  const soft = card(page, 'Tomorrow and the days ahead · soft', 1);
  check(
    'a style draws a forecast day hollow, with no now and no quarters across a row of days',
    (await soft.locator('.fc-bar').count()) === 7 &&
      (await soft.locator('.fc-bar--hollow').count()) === 7 &&
      (await soft.locator('.fc-now').count()) === 0 &&
      (await soft.locator('line.fc-grid:not(.fc-grid--zero)').count()) === 0,
  );

  /* ---------- two planes, no forecast, one answer a house ---------- */
  const planes = frame(page, 'Two planes · each its own forecast, added');
  check(
    'two planes: their forecasts add up for today and for tomorrow, and tomorrow is all the days ahead there are',
    (
      await texts(
        planes.locator('fluvy-production-card').nth(1).locator('.so-top .fv-readout__value'),
      )
    )[0] === '21.5kWh' &&
      (await planes.locator('fluvy-production-card').nth(2).locator('.pr-days .so-bar').count()) ===
        1 &&
      (await texts(planes.locator('fluvy-production-card').nth(2).locator('.fv-card__sub')))[0] ===
        'Tomorrow · forecast',
  );
  const none = frame(page, 'No forecast').locator('fluvy-production-card');
  const panels = await none.evaluateAll((cards) =>
    cards.map((el) => ({
      drawn: Math.round(el.getBoundingClientRect().height),
      declared: el.constructor.layoutHeight(el.config),
      text: el.shadowRoot.querySelector('.fv-empty-state__text')?.textContent?.trim() ?? null,
      off: Boolean(el.shadowRoot.querySelector('.is-unavailable')),
    })),
  );
  check(
    'no forecast: a quiet panel at the card’s height, never the off skin; today’s card draws its day as before',
    panels[0]?.text === 'No forecast' &&
      panels[1]?.text === 'No forecast' &&
      panels[2]?.text === null &&
      panels.every((panel) => panel.drawn === panel.declared && !panel.off),
    JSON.stringify(panels),
  );
  const asked = await page.evaluate(
    () => (window.fluvyAsked ?? []).filter((m) => m.type === 'energy/solar_forecast').length,
  );
  check(
    'every card of a house shares one answer, and a house with no forecast is not asked for one',
    asked === 3,
    `${asked} asked by the sheet’s three forecasting houses`,
  );
  await page.close();
}

/* ---------- half a section: the names thinned from the first, the bars apart ---------- */
for (const width of [320, 360]) {
  const page = await suite.sheet('forecast', { width });
  const half = card(page, 'Half a column', 1);
  const fit = await half.evaluate((el) => {
    const root = el.shadowRoot;
    const column = root.querySelector('.so-bars').getBoundingClientRect();
    const range = document.createRange();
    const names = [...root.querySelectorAll('.fv-axis span')].map((span) => {
      range.selectNodeContents(span);
      const r = range.getBoundingClientRect();
      return {
        text: span.textContent.trim(),
        left: r.left - column.left,
        right: r.right - column.left,
      };
    });
    return { width: column.width, names };
  });
  const apart = fit.names.every((name, i) => i === 0 || name.left - fit.names[i - 1].right >= 11.5);
  check(
    `days ahead at a ${(width - 16) / 2} card: tomorrow’s name first, every name inside the column and 12 apart`,
    fit.names[0]?.text === 'Fri' &&
      fit.names.length < 7 &&
      fit.names.every((name) => name.left >= -0.5 && name.right <= fit.width + 0.5) &&
      apart,
    fit.names
      .map((name) => `${name.text} ${name.left.toFixed(0)}–${name.right.toFixed(0)}`)
      .join(' · '),
  );
  const hours = await card(page, 'Half a column').evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('.so-bar')].map((bar) => bar.getBoundingClientRect()),
  );
  check(
    `tomorrow at a ${(width - 16) / 2} card: 24 bars that never touch`,
    hours.length === 24 && hours.every((bar, i) => i === 0 || bar.left - hours[i - 1].right >= 1.9),
    `${hours[0]?.width.toFixed(0)} wide`,
  );
  await page.close();
}

await suite.finish();
