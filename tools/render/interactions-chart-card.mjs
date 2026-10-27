#!/usr/bin/env node
/**
 * The Chart card (#68) on the playground's `chart` sheet, in a real Chromium. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5207/ node interactions-chart-card.mjs
 * What it proves:
 * - nothing leaves the plot, in both modes: every line, area, run and bar inside its chart's clip box, the dot, the
 *   knob and the bubble whole inside the chart's room and the card; every word placed by rule — the scale's ticks on
 *   one column, a style's bubble inside the plot, the axis starting where the plot does, its ends flush;
 * - Nordpool's prices today and tomorrow: now's hairline with one knob on it, the future dashed from it, the line
 *   drawn again in the warning's and the danger's ink where it crosses their thresholds, the cheapest and the dearest
 *   two hours marked behind it in the ok and the danger tones and named in their pills; before tomorrow is published,
 *   today alone;
 * - reading: a pointer moves the cursor, the bubble says the price and when, the value row reads it too; the keys move
 *   it (Home, →), Escape lets it go;
 * - a weather's forecast is subscribed by the hour, and two series share the value row as the legend's lines.
 */
import { frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/**
 * Every Chart card of the page, read where it is drawn: what leaves its clip box, a mark outside its room, the ticks'
 * column, the bubble and the axis — one line per chart that breaks a rule.
 */
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
    let charts = 0;
    for (const card of cards) {
      const name = card.closest('[data-frame]')?.getAttribute('data-frame') ?? '?';
      const shell = card.shadowRoot.querySelector('[data-card]')?.getBoundingClientRect();
      for (const svg of card.shadowRoot.querySelectorAll('svg.fc-chart')) {
        charts++;
        const box = svg.getBoundingClientRect();
        const clip = svg.querySelector('clipPath rect');
        const cx = box.left + Number(clip.getAttribute('x'));
        const cw = Number(clip.getAttribute('width'));
        const cy = box.top + Number(clip.getAttribute('y'));
        const ch = Number(clip.getAttribute('height'));
        for (const path of svg.querySelectorAll('path, rect.fc-stretch')) {
          if (!path.closest('g[clip-path]'))
            wrong.push(`${name}: a ${path.getAttribute('class')} outside the clipped layers`);
          const r = path.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (
            r.left < cx - 0.5 ||
            r.right > cx + cw + 0.5 ||
            r.top < cy - 0.5 ||
            r.bottom > cy + ch + 0.5
          )
            wrong.push(`${name}: ${path.getAttribute('class')} leaves its plot`);
        }
        const wrapper = svg.parentElement;
        const marks = [
          ...svg.querySelectorAll('.curve-dot'),
          ...wrapper.querySelectorAll(':scope > .fv-knob'),
          ...wrapper.querySelectorAll(':scope > .fv-bubble'),
        ];
        for (const mark of marks) {
          const r = mark.getBoundingClientRect();
          if (r.top < box.top - 0.5 || r.bottom > box.bottom + 8.5)
            wrong.push(`${name}: ${mark.getAttribute('class')} leaves the chart's room`);
          if (shell && (r.left < shell.left - 0.5 || r.right > shell.right + 0.5))
            wrong.push(`${name}: ${mark.getAttribute('class')} leaves the card`);
        }
        const ticks = [...svg.querySelectorAll('.fc-tick')].map(
          (t) => t.getBoundingClientRect().right,
        );
        if (ticks.length && Math.max(...ticks) - Math.min(...ticks) > 0.75)
          wrong.push(`${name}: the ticks are not on one column`);
        const left = ticks.length ? Number(svg.querySelector('.fc-tick').getAttribute('x')) + 8 : 0;
        const classic = ![...svg.classList].some((c) => c.startsWith('fc-chart--'));
        for (const bubble of wrapper.querySelectorAll(':scope > .fv-bubble')) {
          const r = bubble.getBoundingClientRect();
          const from = classic ? (shell?.left ?? box.left) : box.left + left;
          const to = classic ? (shell?.right ?? box.right) : box.right;
          if (r.left < from - 0.5 || r.right > to + 0.5)
            wrong.push(`${name}: the bubble leaves ${classic ? 'the card' : 'its plot'}`);
        }
      }
      // the axis under the chart: it starts where the plot does, its ends flush with it
      const chart = card.shadowRoot.querySelector('.ch-chart');
      const axis = card.shadowRoot.querySelector('.ch-axis .fv-axis');
      const svg = chart?.querySelector('svg.fc-chart');
      if (svg && axis?.children.length) {
        const tick = svg.querySelector('.fc-tick');
        const plot =
          svg.getBoundingClientRect().left + (tick ? Number(tick.getAttribute('x')) + 8 : 0);
        const a = axis.getBoundingClientRect();
        const first = axis.firstElementChild.getBoundingClientRect();
        const last = axis.lastElementChild.getBoundingClientRect();
        if (Math.abs(a.left - plot) > 0.75) wrong.push(`${name}: the axis starts off the plot`);
        if (Math.abs(first.left - a.left) > 0.75 || Math.abs(last.right - a.right) > 0.75)
          wrong.push(`${name}: the axis's ends are not flush`);
      }
    }
    return { charts, wrong };
  });

/* ---------- both modes: nothing leaves the plot, every word placed by rule ---------- */
for (const mode of ['light', 'dark']) {
  const page = await suite.sheet('chart', { extra: mode === 'dark' ? '&mode=dark' : '' });
  const { charts, wrong } = await audit(page);
  check(
    `${mode}: ${charts} charts — nothing leaves its plot, every mark whole, every word placed by rule`,
    charts >= 12 && wrong.length === 0,
    wrong.slice(0, 6).join(' | '),
  );
  await page.close();
}

/* ---------- Nordpool: now, the future, the thresholds, the marked windows ---------- */
const page = await suite.sheet('chart');
const nordpool = frame(page, 'Chart · Nordpool').locator('fluvy-chart-card').first();
{
  const drawn = await nordpool.evaluate((card) => {
    const root = card.shadowRoot;
    const svg = root.querySelector('svg.fc-chart');
    const box = svg.getBoundingClientRect();
    const now = box.left + Number(svg.querySelector('.fc-now').getAttribute('x1'));
    const knobs = [...root.querySelectorAll('.ch-chart > .fv-knob')];
    const knob = knobs[0]?.getBoundingClientRect();
    const future = svg.querySelector('.fc-future:not(.fc-run)');
    // a stepped price holds its quarter: now stands in its slot's middle, what is to come starts with the next slot
    const plot = svg.querySelector('clipPath rect');
    const slot = Number(plot.getAttribute('width')) / 192;
    const runs = [...svg.querySelectorAll('.fc-run')].map(
      (run) => run.parentElement.className.baseVal,
    );
    const stretches = [...svg.querySelectorAll('.fc-stretch')].map(
      (s) => s.parentElement.className.baseVal,
    );
    const pills = [...root.querySelectorAll('.ch-side .fc-pill')].map((pill) => ({
      tone: [...pill.classList].find((c) => c.startsWith('fv-tone--')),
      text: pill.textContent.trim(),
      label: pill.getAttribute('aria-label'),
    }));
    return {
      now,
      knobs: knobs.length,
      knob: knob ? knob.left + knob.width / 2 : null,
      slot,
      starts: box.left + Number(/^M([\d.]+)/.exec(future.getAttribute('d'))?.[1]),
      dashes: getComputedStyle(future).strokeDasharray,
      runs: [...new Set(runs)].sort(),
      stretches,
      pills,
    };
  });
  check(
    'Nordpool: one knob, Fluvy’s, centred on now’s hairline',
    drawn.knobs === 1 && Math.abs(drawn.knob - drawn.now) < 0.6,
    JSON.stringify(drawn),
  );
  check(
    'Nordpool: what is to come dashed from the end of now’s quarter',
    drawn.starts > drawn.now &&
      drawn.starts - drawn.now <= drawn.slot / 2 + 0.25 &&
      /^4(px)?,?\s*5(px)?$/.test(drawn.dashes),
    JSON.stringify(drawn),
  );
  check(
    'Nordpool: the line drawn again in the warning’s and the danger’s ink where it crosses them',
    JSON.stringify(drawn.runs) === JSON.stringify(['fv-tone--danger', 'fv-tone--warning']),
    JSON.stringify(drawn.runs),
  );
  check(
    'Nordpool: the cheapest and dearest two hours marked behind it, in the ok and the danger tones',
    JSON.stringify(drawn.stretches) === JSON.stringify(['fv-tone--ok', 'fv-tone--danger']),
    JSON.stringify(drawn.stretches),
  );
  check(
    'Nordpool: their pills say which, when and how much — in one form, as long as the row holds',
    drawn.pills.length === 2 &&
      drawn.pills[0].tone === 'fv-tone--ok' &&
      drawn.pills[1].tone === 'fv-tone--danger' &&
      /^Cheapest Fri \d\d:\d\d–\d\d:\d\d · −?0\.\d{3} EUR\/kWh$/.test(drawn.pills[0].label) &&
      /^Priciest Fri \d\d:\d\d–\d\d:\d\d · 0\.\d{3} EUR\/kWh$/.test(drawn.pills[1].label) &&
      drawn.pills.every((pill) =>
        pill.label.includes(pill.text.replace(/^(Cheapest|Priciest) /, '')),
      ),
    JSON.stringify(drawn.pills),
  );
  const morning = await frame(page, 'Chart · Nordpool before tomorrow')
    .locator('fluvy-chart-card')
    .first()
    .evaluate((card) => ({
      sub: card.shadowRoot.querySelector('.fv-card__sub')?.textContent.trim(),
      last: card.shadowRoot
        .querySelector('.ch-axis .fv-axis')
        ?.lastElementChild?.textContent.trim(),
    }));
  check(
    'before tomorrow is published: today alone, to its midnight',
    morning.sub === 'Today' && /^Fri 00:00$/.test(morning.last ?? ''),
    JSON.stringify(morning),
  );
}

/* ---------- reading by pointer and keys ---------- */
{
  const chart = nordpool.locator('.ch-chart');
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await settle(page, 200);
  const read = await nordpool.evaluate((card) => ({
    bubble: card.shadowRoot
      .querySelector('.ch-chart > .fv-bubble')
      ?.textContent.replace(/\s+/g, ' ')
      .trim(),
    label: card.shadowRoot.querySelector('.ch-now .fv-readout__label')?.textContent.trim(),
    cursor: card.shadowRoot.querySelector('.fc-cursor') !== null,
  }));
  check(
    'a pointer reads the chart: the cursor, the bubble’s price and when, the value row with it',
    read.cursor &&
      /^0\.\d{3} EUR\/kWh\s*\d\d:\d\d$/.test(read.bubble ?? '') &&
      /^\d\d:\d\d$/.test(read.label ?? '') &&
      (read.bubble ?? '').endsWith(read.label),
    JSON.stringify(read),
  );
  await page.mouse.move(0, 0);
  await settle(page, 150);
  await chart.focus();
  await page.keyboard.press('Home');
  await settle(page, 100);
  const home = await nordpool.evaluate((card) =>
    card.shadowRoot.querySelector('.ch-now .fv-readout__label')?.textContent.trim(),
  );
  await page.keyboard.press('ArrowRight');
  await settle(page, 100);
  const next = await nordpool.evaluate((card) =>
    card.shadowRoot.querySelector('.ch-now .fv-readout__label')?.textContent.trim(),
  );
  await page.keyboard.press('Escape');
  await settle(page, 100);
  const after = await nordpool.evaluate((card) => ({
    label: card.shadowRoot.querySelector('.ch-now .fv-readout__label')?.textContent.trim(),
    bubble: card.shadowRoot.querySelector('.ch-chart > .fv-bubble') !== null,
  }));
  check(
    'the keys read it too: Home its start, → the next slot, Escape lets it go',
    home === '00:00' && next === '00:15' && after.label === 'Now' && !after.bubble,
    JSON.stringify({ home, next, after }),
  );
}

/* ---------- a forecast after the measured, the legend in the value row ---------- */
{
  const subscribed = await page.evaluate(() =>
    window.fluvyMock.wsCalls.some(
      (c) =>
        c.type === 'weather/subscribe_forecast' &&
        c.message.entity_id === 'weather.ch_home' &&
        c.message.forecast_type === 'hourly',
    ),
  );
  const both = await frame(page, 'Chart · measured and forecast')
    .locator('fluvy-chart-card')
    .first()
    .evaluate((card) => ({
      names: [...card.shadowRoot.querySelectorAll('.ch-lines .fc-legend__name')].map((n) =>
        n.textContent.trim(),
      ),
      lines: card.shadowRoot.querySelectorAll('svg.fc-chart .fc-line').length,
      future: card.shadowRoot.querySelectorAll('svg.fc-chart .fc-future').length,
    }));
  check(
    'a weather’s forecast is subscribed by the hour and drawn after the measured, the legend in the row',
    subscribed &&
      JSON.stringify(both.names) === JSON.stringify(['Living room', 'Outside']) &&
      both.future >= 1,
    JSON.stringify({ subscribed, ...both }),
  );
}
await page.close();

await suite.finish();
