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
 * - reading: a pointer moves the cursor and its dot, the value row says the price and when, and no bubble rides over it
 *   — the marked windows' pills stay where they were, seen; the keys move it (Home, →), Escape lets it go; without the
 *   head the bubble says it in its 44 above the plot; two series read in the row's lines, the time a pill on the axis;
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
    const line = svg.querySelector('.fc-line:not(.fc-run)');
    // the steps of the past: each H the start of the next slot (every one as wide as its slot)
    const steps = (line.getAttribute('d').match(/H[\d.]+/g) ?? []).map((h) => Number(h.slice(1)));
    const widths = steps.slice(1).map((x, i) => x - steps[i]);
    // a stepped price holds its slot: now stands in its slot's middle, what is to come starts with the next slot
    const slot = Math.min(...widths);
    const runs = [...svg.querySelectorAll('.fc-run')].map(
      (run) => run.parentElement.className.baseVal,
    );
    const band = (cls) =>
      [...svg.querySelectorAll(`g.fv-tone--${cls} > .fc-run`)].map((run) => ({
        line: run.classList.contains('fc-line'),
        moves: (run.getAttribute('d').match(/M/g) ?? []).length,
        same: run.getAttribute('d') === line.getAttribute('d'),
      }));
    const stretches = [...svg.querySelectorAll('.fc-stretch')].map(
      (s) => s.parentElement.className.baseVal,
    );
    const pills = [...root.querySelectorAll('.ch-side .fc-pill')].map((pill) => ({
      tone: [...pill.classList].find((c) => c.startsWith('fv-tone--')),
      text: pill.textContent.trim(),
      label: pill.getAttribute('aria-label'),
    }));
    // the plot under the row that says the reading: its top gridline 12 under the chart's room
    const top = Math.min(
      ...[...svg.querySelectorAll('.fc-grid')].map((g) => g.getBoundingClientRect().top),
    );
    const row = root.querySelector('.ch-top').getBoundingClientRect();
    const axis = [...root.querySelectorAll('.ch-axis .fv-axis > *')].map((l) =>
      l.textContent.trim(),
    );
    return {
      now,
      knobs: knobs.length,
      knob: knob ? knob.left + knob.width / 2 : null,
      slot,
      widths: [Math.min(...widths), Math.max(...widths)],
      moves: (line.getAttribute('d').match(/M/g) ?? []).length,
      futureMoves: (future.getAttribute('d').match(/M/g) ?? []).length,
      bands: { warning: band('warning'), danger: band('danger') },
      starts: box.left + Number(/^M([\d.]+)/.exec(future.getAttribute('d'))?.[1]),
      dashes: getComputedStyle(future).strokeDasharray,
      runs: [...new Set(runs)].sort(),
      stretches,
      pills,
      gap: top - row.bottom,
      axis,
    };
  });
  check(
    'Nordpool: the past is one continuous stepped path, each step at least 6 wide (no beads), the future one dashed path',
    drawn.moves === 1 &&
      drawn.futureMoves === 1 &&
      drawn.widths[0] >= 5.9 &&
      Math.abs(drawn.widths[1] - drawn.widths[0]) < 0.05,
    JSON.stringify({ moves: drawn.moves, future: drawn.futureMoves, widths: drawn.widths }),
  );
  check(
    'Nordpool: each threshold’s band is that one path again, clipped — the past’s and the future’s, never pieces',
    ['warning', 'danger'].every((tone) => {
      const runs = drawn.bands[tone];
      return (
        runs.length === 2 &&
        runs.filter((run) => run.line).length === 1 &&
        runs.every((run) => run.moves === 1) &&
        runs.find((run) => run.line)?.same === true
      );
    }),
    JSON.stringify(drawn.bands),
  );
  check(
    'Nordpool: the plot rises under the value row (its top 12 under the chart’s room), no band of nothing',
    drawn.gap >= 12 && drawn.gap <= 25,
    String(drawn.gap),
  );
  check(
    'Nordpool: the axis’s midnight between the ends says its day',
    JSON.stringify(drawn.axis) === JSON.stringify(['Thu 00:00', 'Fri 00:00', 'Sat 00:00']),
    JSON.stringify(drawn.axis),
  );
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
/** The value row's pills: each one's box, and whether it is what the page shows at its middle (nothing over it). */
const pillsOf = (card) =>
  [...card.shadowRoot.querySelectorAll('.ch-side .fc-pill')].map((pill) => {
    const r = pill.getBoundingClientRect();
    const hit = card.shadowRoot.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { box: [r.left, r.top, r.width, r.height].map(Math.round), seen: pill.contains(hit) };
  });
{
  const chart = nordpool.locator('.ch-chart');
  const box = await chart.boundingBox();
  const still = await nordpool.evaluate(pillsOf);
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await settle(page, 200);
  const read = await nordpool.evaluate((card) => ({
    bubbles: card.shadowRoot.querySelectorAll('.fv-bubble').length,
    label: card.shadowRoot.querySelector('.ch-now .fv-readout__label')?.textContent.trim(),
    value: card.shadowRoot
      .querySelector('.ch-now .fv-readout__value')
      ?.textContent.replace(/\s+/g, ' ')
      .trim(),
    cursor: card.shadowRoot.querySelector('.fc-cursor') !== null,
    dot: card.shadowRoot.querySelector('svg.fc-chart .curve-dot') !== null,
  }));
  const pills = await nordpool.evaluate(pillsOf);
  check(
    'a pointer reads the chart: the cursor and its dot, the value row says the price and when — no bubble over it',
    read.cursor &&
      read.dot &&
      read.bubbles === 0 &&
      /^\d\d:\d\d$/.test(read.label ?? '') &&
      /^0\.\d{3}\s*EUR\/kWh$/.test(read.value ?? ''),
    JSON.stringify(read),
  );
  check(
    'while it is read the marked windows’ pills stay where they were, nothing over them',
    pills.length === 2 &&
      JSON.stringify(pills.map((p) => p.box)) === JSON.stringify(still.map((p) => p.box)) &&
      pills.every((p) => p.seen),
    JSON.stringify({ still, pills }),
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
    'the keys read it too: Home its start, → the next slot (an hour at 360), Escape lets it go',
    home === '00:00' && next === '01:00' && after.label === 'Now' && !after.bubble,
    JSON.stringify({ home, next, after }),
  );
}

/* ---------- without the head the bubble reads it; the legend's lines read it, the time on the axis ---------- */
{
  /** A frame's chart read by the pointer at a fraction of its width: what `look` finds there, then let go. */
  const readFrame = async (title, at, look) => {
    const card = frame(page, title).locator('fluvy-chart-card').first();
    const chart = card.locator('.ch-chart');
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.boundingBox();
    await page.mouse.move(box.x + box.width * at, box.y + box.height / 2);
    await settle(page, 200);
    const got = await card.evaluate(look);
    await page.mouse.move(0, 0);
    await settle(page, 150);
    return got;
  };
  const bare = await readFrame('Chart · forecast band', 0.5, (card) => {
    const chart = card.shadowRoot.querySelector('.ch-chart').getBoundingClientRect();
    const bubble = card.shadowRoot.querySelector('.ch-chart > .fv-bubble');
    const grid = [...card.shadowRoot.querySelectorAll('svg.fc-chart .fc-grid')].map(
      (g) => g.getBoundingClientRect().top,
    );
    return {
      row: card.shadowRoot.querySelector('.ch-top') !== null,
      bubble: bubble?.textContent.replace(/\s+/g, ' ').trim(),
      // the plot keeps the bubble's 44 above it, and the bubble stands in it
      room: Math.min(...grid) - chart.top,
      top: bubble ? bubble.getBoundingClientRect().top - chart.top : null,
    };
  });
  check(
    'without the head (show_head: false) the bubble says the reading and when, in its 44 above the plot',
    !bare.row &&
      /^\d+(\.\d+)? kW\s*\d\d:\d\d$/.test(bare.bubble ?? '') &&
      bare.room >= 44 &&
      bare.top >= 0,
    JSON.stringify(bare),
  );
  const two = await readFrame('Chart · measured and forecast', 0.3, (card) => {
    const root = card.shadowRoot;
    const axis = root.querySelector('.ch-axis');
    const a = axis.getBoundingClientRect();
    const when = root.querySelector('.ch-axis > .ch-when')?.getBoundingClientRect();
    const svg = root.querySelector('svg.fc-chart');
    const cursor = svg.querySelector('.fc-cursor');
    const x = cursor
      ? svg.getBoundingClientRect().left + Number(cursor.getAttribute('x1'))
      : Number.NaN;
    return {
      bubbles: root.querySelectorAll('.fv-bubble').length,
      when: root.querySelector('.ch-axis > .ch-when')?.textContent.trim(),
      hours: getComputedStyle(axis.querySelector('.fv-axis')).opacity,
      inside: when ? when.left >= a.left - 0.5 && when.right <= a.right + 0.5 : false,
      off: when ? Math.abs(when.left + when.width / 2 - x) : null,
      values: [...root.querySelectorAll('.ch-lines .fc-legend__value')].map((v) =>
        v.textContent.trim(),
      ),
    };
  });
  check(
    'two series read in the row’s lines: no bubble, when a pill on the axis under the cursor, the hours giving way',
    two.bubbles === 0 &&
      /^\d\d:\d\d$/.test(two.when ?? '') &&
      two.hours === '0' &&
      two.inside &&
      two.off !== null &&
      two.off < 1 &&
      two.values.length === 2,
    JSON.stringify(two),
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
