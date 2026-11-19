#!/usr/bin/env node
/**
 * The Chart card's series of states (#228) on the playground's `chart-states` sheet, in a real Chromium. Exit code 1
 * on any failure.
 *   PLAYGROUND=http://127.0.0.1:5315/ node interactions-chart-states.mjs
 * What it proves:
 * - in both modes every strip lies under its plot on its time: from the plot's start (after a scale's column) to its
 *   end, 12 tall and 4 under what is over it, its stretches inside it, the axis starting where it does; strips alone
 *   take the plot's room, 8 over the chart's floor;
 * - a pointer on a strip reads the chart as one on the plot does: the cursor down the strip at the chart's x, the
 *   legend's lines saying the battery and the charger's state then in Home Assistant's words ("On"), "—" over the
 *   stretch the plug was off the network, the time on the axis; a pointer on the plot brings the strip's cursor too;
 * - the keys read it: Home its start, Escape lets it go and the legend says now again;
 * - a state's own colour: the heat pump's heating in the heat tone, its swatch in the legend the same;
 * - strips alone read in the value row: the washer's phase and the porch light, the front door "Open" at its opening;
 * - a sensor that went away: its line breaks over the four hours, the value row reads "—" there, its columns stand
 *   empty where none of their slot was known.
 */
import { frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** Every strip of the page, measured against its card's plot, svg and axis: one line per strip that breaks a rule. */
const audit = (page) =>
  page.evaluate(() => {
    const cards = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.localName === 'fluvy-chart-card') cards.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    const wrong = [];
    let strips = 0;
    const near = (a, b) => Math.abs(a - b) <= 0.75;
    for (const card of cards) {
      const root = card.shadowRoot;
      const name = card.closest('[data-frame]')?.getAttribute('data-frame') ?? '?';
      const shell = root.querySelector('[data-card]')?.getBoundingClientRect();
      const row = root.querySelector('.ch-strips');
      if (!row) continue;
      const chart = root.querySelector('.ch-chart').getBoundingClientRect();
      const svg = root.querySelector('.ch-chart > svg.fc-chart');
      const tall = row.classList.contains('is-tall');
      const box = row.getBoundingClientRect();
      if (tall) {
        // strips alone: the plot's room, to 8 over the chart's floor
        if (!near(box.left, chart.left) || !near(box.right, chart.right))
          wrong.push(`${name}: the strips do not span the plot`);
        if (!near(box.bottom, chart.bottom - 8))
          wrong.push(`${name}: the strips do not end 8 over the floor`);
      } else {
        const tick = svg?.querySelector('.fc-tick');
        const plot =
          svg.getBoundingClientRect().left + (tick ? Number(tick.getAttribute('x')) + 8 : 0);
        if (!near(box.left, plot)) wrong.push(`${name}: the strips start off the plot`);
        if (!near(box.right, svg.getBoundingClientRect().right))
          wrong.push(`${name}: the strips end off the plot`);
        const axis = root.querySelector('.ch-axis .fv-axis')?.getBoundingClientRect();
        if (axis && !near(axis.left, box.left))
          wrong.push(`${name}: the axis starts off the strips`);
      }
      let over = tall ? null : chart.bottom;
      for (const strip of row.querySelectorAll(':scope > .ch-strip')) {
        strips++;
        const r = strip.getBoundingClientRect();
        if (!tall && !near(r.height, 12)) wrong.push(`${name}: a strip ${r.height} tall`);
        if (over !== null && !near(r.top - over, 4))
          wrong.push(`${name}: a strip ${r.top - over} under what is over it`);
        over = r.bottom;
        if (shell && (r.left < shell.left || r.right > shell.right))
          wrong.push(`${name}: a strip leaves the card`);
        for (const stretch of strip.querySelectorAll('.fv-stretch')) {
          const s = stretch.getBoundingClientRect();
          if (
            s.left < r.left - 0.5 ||
            s.right > r.right + 0.5 ||
            !near(s.top, r.top) ||
            !near(s.bottom, r.bottom)
          )
            wrong.push(`${name}: a stretch leaves its strip`);
        }
      }
    }
    return { strips, wrong };
  });

for (const mode of ['light', 'dark']) {
  const page = await suite.sheet('chart-states', { extra: mode === 'dark' ? '&mode=dark' : '' });
  const { strips, wrong } = await audit(page);
  check(
    `${mode}: ${strips} strips — each under its plot on its time, 12 tall and 4 under what is over it`,
    strips >= 12 && wrong.length === 0,
    wrong.slice(0, 6).join(' | '),
  );
  await page.close();
}

const page = await suite.sheet('chart-states');

/** What a card says now: its legend's lines, its value row, its axis's pill, its cursors' x. */
const said = (card) =>
  card.evaluate((el) => {
    const root = el.shadowRoot;
    const svgCursor = root.querySelector('.ch-chart svg :is(.fc-cursor, .curve-cursor)');
    const svg = root.querySelector('.ch-chart svg.fc-chart')?.getBoundingClientRect();
    return {
      legend: Object.fromEntries(
        [...root.querySelectorAll('.fc-legend__item')].map((item) => [
          item.querySelector('.fc-legend__name')?.textContent.trim(),
          item.querySelector('.fc-legend__value')?.textContent.trim(),
        ]),
      ),
      value: root
        .querySelector('.ch-now .fv-readout__value')
        ?.textContent.replace(/\s+/g, ' ')
        .trim(),
      when: root.querySelector('.ch-when')?.textContent.trim(),
      strip: root.querySelector('.ch-strips__cursor')?.getBoundingClientRect().left ?? null,
      chart: svgCursor && svg ? svg.left + Number(svgCursor.getAttribute('x1')) : null,
    };
  });

/** The middle of a card's first stretch that matches `selector`, on the page. */
const middleOf = (card, selector) =>
  card.evaluate((el, query) => {
    const r = el.shadowRoot.querySelector(query)?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  }, selector);

/* ---------- the tablet and its charger: a pointer on the strip reads the chart ---------- */
{
  const tablet = frame(page, 'Chart states · tablet and charger')
    .locator('fluvy-chart-card')
    .first();
  await tablet.scrollIntoViewIfNeeded();
  const on = await middleOf(tablet, '.ch-strip .fv-stretch.is-on');
  await page.mouse.move(on.x, on.y);
  await settle(page, 200);
  const charging = await said(tablet);
  check(
    'a pointer on the strip reads the chart: the charger "On", the battery its figure, the time on the axis',
    charging.legend.Charger === 'On' &&
      /^\d+ %$/.test(charging.legend.Battery ?? '') &&
      /^\d\d:\d\d$/.test(charging.when ?? ''),
    JSON.stringify(charging),
  );
  check(
    'the cursor runs down the strip at the chart’s own x',
    charging.strip !== null &&
      charging.chart !== null &&
      Math.abs(charging.strip - charging.chart) <= 1,
    JSON.stringify(charging),
  );
  const away = await middleOf(tablet, '.ch-strip .fv-stretch.is-away');
  await page.mouse.move(away.x, away.y);
  await settle(page, 200);
  const lost = await said(tablet);
  check(
    'over the stretch the plug was off the network the charger says "—", never "Off"',
    lost.legend.Charger === '—' && /^\d+ %$/.test(lost.legend.Battery ?? ''),
    JSON.stringify(lost),
  );
  const plot = await tablet.locator('.ch-chart').boundingBox();
  await page.mouse.move(plot.x + plot.width * 0.6, plot.y + plot.height / 2);
  await settle(page, 200);
  const onPlot = await said(tablet);
  check(
    'a pointer on the plot brings the strip’s cursor too, at the chart’s x',
    onPlot.strip !== null && onPlot.chart !== null && Math.abs(onPlot.strip - onPlot.chart) <= 1,
    JSON.stringify(onPlot),
  );
  await page.mouse.move(0, 0);
  await settle(page, 200);
  await tablet.locator('.ch-chart').focus();
  await page.keyboard.press('Home');
  await settle(page, 100);
  const home = await said(tablet);
  await page.keyboard.press('Escape');
  await settle(page, 100);
  const now = await said(tablet);
  check(
    'the keys read it: Home its start (the plug off), Escape lets it go and the legend says now',
    home.legend.Charger === 'Off' &&
      /^Wed 21:\d\d$/.test(home.when ?? '') &&
      now.legend.Charger === 'On' &&
      !now.when,
    JSON.stringify({ home, now }),
  );
}

/* ---------- a state's own colour, its swatch the same ---------- */
{
  const pump = frame(page, 'Chart states · heat pump and its mode')
    .locator('fluvy-chart-card')
    .first();
  const worn = await pump.evaluate((card) => {
    const root = card.shadowRoot;
    const heating = root.querySelector('.ch-strip .fv-stretch.fv-tone--heat');
    const mode = [...root.querySelectorAll('.fc-legend__item')].find((item) =>
      item.textContent.trim().startsWith('Mode'),
    );
    return {
      heating: heating && getComputedStyle(heating).backgroundColor,
      swatch: mode && getComputedStyle(mode.querySelector('.fc-legend__swatch')).backgroundColor,
      standby: root.querySelectorAll('.ch-strip .fv-stretch:not(.is-own)').length,
    };
  });
  check(
    'the heat pump’s heating wears the heat tone, its legend’s swatch the same; its standby the strip’s own fill',
    worn.heating !== null && worn.heating === worn.swatch && worn.standby === 0,
    JSON.stringify(worn),
  );
}

/* ---------- strips alone read in the value row ---------- */
{
  const utility = frame(page, 'Chart states · strips alone').locator('fluvy-chart-card').first();
  await utility.scrollIntoViewIfNeeded();
  const washing = await middleOf(utility, '.ch-strip .fv-stretch.fv-tone--water');
  await page.mouse.move(washing.x, washing.y);
  await settle(page, 200);
  const phase = await said(utility);
  check(
    'strips alone: a pointer on the washer’s first phase says "Washing", the porch light its state then',
    phase.legend.Washer === 'Washing' && ['On', 'Off'].includes(phase.legend['Porch light']),
    JSON.stringify(phase),
  );
  const door = frame(page, 'Chart states · strips alone').locator('fluvy-chart-card').nth(1);
  await door.scrollIntoViewIfNeeded();
  const open = await middleOf(door, '.ch-strip .fv-stretch.is-on');
  await page.mouse.move(open.x, open.y);
  await settle(page, 200);
  const opened = await said(door);
  await page.mouse.move(0, 0);
  await settle(page, 200);
  const closed = await said(door);
  check(
    'the front door alone reads "Open" at its opening in the value row, "Closed" now',
    opened.value === 'Open' && closed.value === 'Closed',
    JSON.stringify({ opened, closed }),
  );
}

/* ---------- a sensor that went away: a gap ---------- */
{
  const cards = frame(page, 'Chart · a sensor that went away').locator('fluvy-chart-card');
  const bedroom = cards.first();
  await bedroom.scrollIntoViewIfNeeded();
  const runs = await bedroom.evaluate(
    (card) =>
      (card.shadowRoot.querySelector('svg.fc-chart .fc-line')?.getAttribute('d') ?? '').match(/M/g)
        ?.length ?? 0,
  );
  // 01:40 to 05:50 of a day to 21:47: a little under a fifth of the way along
  const plot = await bedroom.locator('.ch-chart').boundingBox();
  await page.mouse.move(plot.x + plot.width * ((3.5 + 2.2167) / 24), plot.y + plot.height / 2);
  await settle(page, 200);
  const there = await said(bedroom);
  check(
    'a sensor unavailable for four hours: its line breaks there and the value row reads "—"',
    runs === 2 && there.value === '—',
    JSON.stringify({ runs, there }),
  );
  await page.mouse.move(0, 0);
  const columns = await cards.nth(1).evaluate((card) => {
    const bars = [...card.shadowRoot.querySelectorAll('svg.fc-chart .fc-bar')];
    return bars.length;
  });
  check(
    'its columns stand empty where none of their slot was known',
    columns > 0 && columns < 24,
    String(columns),
  );
}

await suite.finish();
