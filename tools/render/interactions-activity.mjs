#!/usr/bin/env node
/**
 * Interaction tests of the Activity page on the playground, in a real Chromium (what a test DOM cannot show: focus
 * moving between a time field's segments, sticky headers, layout-measured pills). Exit code 1 on any failure.
 *   node interactions-activity.mjs            (expects the playground dev server on :5183)
 * What it proves: typed times move on to the minutes; the date grid's first tap picks one whole day; the knob agrees
 * with the list while the page scrolls or the knob is dragged back up; Spanish state words are never cut; a phone
 * measures its own column.
 */
import { startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** The Activity page on the playground's made-up house, its clock fixed at 21:47, nothing live. */
const open = (query = '', width = 1440, height = 900) =>
  suite.page(`activity=1&live=0&at=2026-09-17T21:47:12&${query}`, {
    viewport: { width, height },
    wait: 1200,
  });

/** The knob's moment, and the rows around the top of the screen (the one under the pinned header, the one above). */
const reading = (page) =>
  page.evaluate(() => {
    const root = document.querySelector('fluvy-activity').shadowRoot;
    const scroller = root.querySelector('.av-scroll');
    const top = scroller.getBoundingClientRect().top;
    const rows = [...root.querySelectorAll('.av-row[data-t]')];
    const under = rows.findIndex((row) => row.getBoundingClientRect().top >= top + 39);
    return {
      knob: root.querySelector('fluvy-time-rail').value,
      under: rows[under] ? Number(rows[under].dataset.t) : null,
      above: under > 0 ? Number(rows[under - 1].dataset.t) : null,
      scroll: scroller.scrollTop,
      max: scroller.scrollHeight - scroller.clientHeight,
    };
  });

/* ---------- the time field: typed digits move on ---------- */
{
  const page = await open('lang=en');
  await page.locator('fluvy-activity .av-day__pick').click();
  await page.waitForTimeout(500);
  const from = page.locator('fluvy-activity fluvy-date-picker fluvy-time-field').first();
  await from.locator('input[data-seg="h"]').click();
  await page.keyboard.type('0730');
  const to = page.locator('fluvy-activity fluvy-date-picker fluvy-time-field').nth(1);
  await to.locator('input[data-seg="h"]').click();
  await page.keyboard.type('2215');
  const values = await page.evaluate(() =>
    [
      ...document
        .querySelector('fluvy-activity')
        .shadowRoot.querySelector('fluvy-date-picker')
        .shadowRoot.querySelectorAll('fluvy-time-field'),
    ].map((field) => field.value),
  );
  check(
    'typing 0730 and 2215 fills both fields',
    values[0] === 7 * 60 + 30 && values[1] === 22 * 60 + 15,
    JSON.stringify(values),
  );
  await page.close();
}

/* ---------- the date grid: the first tap picks one whole day ---------- */
{
  const page = await open('lang=en');
  await page.locator('fluvy-activity .av-day__pick').click();
  await page.waitForTimeout(500);
  await page.locator('fluvy-activity fluvy-date-picker .fv-day[aria-label$=" 10"]').click();
  const state = await page.evaluate(() => {
    const dates = document
      .querySelector('fluvy-activity')
      .shadowRoot.querySelector('fluvy-date-picker');
    return {
      from: dates.from.getDate(),
      to: dates.to.getDate(),
      fromTime: dates.fromTime,
      toTime: dates.toTime,
    };
  });
  check(
    'opened on Today, one tap on the 10th is the 10th, whole',
    state.from === 10 && state.to === 10 && state.fromTime === 0 && state.toTime === 1440,
    JSON.stringify(state),
  );
  await page.close();
}

/* ---------- the rail agrees with the list on the way up ---------- */
for (const filter of ['highlights', 'all']) {
  const page = await open(filter === 'all' ? 'moment=burst&lang=en' : 'lang=en');
  await page.evaluate(() => {
    const rail = document
      .querySelector('fluvy-activity')
      .shadowRoot.querySelector('fluvy-time-rail');
    rail.focus();
    rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  });
  await page.waitForTimeout(900);
  await page.mouse.move(700, 500);
  let off = 0;
  let worst = 0;
  let steps = 0;
  for (let i = 0; i < 40; i += 1) {
    await page.mouse.wheel(0, -120);
    await page.waitForTimeout(90);
    const r = await reading(page);
    if (r.scroll <= 0) break;
    if (r.scroll >= r.max - 1 || r.under === null || r.above === null) continue;
    steps += 1;
    const ahead = Math.max(0, r.knob - r.above);
    const behind = Math.max(0, r.under - r.knob);
    const miss = Math.max(ahead, behind) / 60_000;
    if (miss > 1) off += 1;
    worst = Math.max(worst, miss);
  }
  check(
    `wheel back up (${filter}): the knob stays between the rows at the top`,
    off === 0,
    `${off} of ${steps} off, worst ${worst.toFixed(0)} min`,
  );
  await page.close();
}

{
  const page = await open('lang=en');
  const box = await page.evaluate(() => {
    const rail = document
      .querySelector('fluvy-activity')
      .shadowRoot.querySelector('fluvy-time-rail');
    const r = rail.getBoundingClientRect();
    return { x: r.x + r.width - 30, y: r.y, h: r.height };
  });
  await page.mouse.move(box.x, box.y + box.h * 0.9);
  await page.mouse.down();
  let worst = 0;
  for (let i = 1; i <= 8; i += 1) {
    await page.mouse.move(box.x, box.y + box.h * (0.9 - i * 0.09), { steps: 4 });
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => {
      const root = document.querySelector('fluvy-activity').shadowRoot;
      const knob = root.querySelector('fluvy-time-rail').value;
      const top = root.querySelector('.av-scroll').getBoundingClientRect().top;
      const row = [...root.querySelectorAll('.av-row[data-t]')].find(
        (node) => Number(node.dataset.t) <= knob,
      );
      return row ? row.getBoundingClientRect().top - top : null;
    });
    if (r !== null) worst = Math.max(worst, Math.abs(r - 40));
  }
  await page.mouse.up();
  check(
    'dragging the knob back up keeps its row under the header',
    worst <= 2,
    `worst ${worst.toFixed(0)} px`,
  );
  await page.close();
}

/* ---------- the lit axis never blinks out while the page scrolls ---------- */
for (const width of [1440, 412]) {
  const page = await open('lang=en&moment=burst', width);
  await page.evaluate(() => {
    const rail = document
      .querySelector('fluvy-activity')
      .shadowRoot.querySelector('fluvy-time-rail');
    window.__spans = [];
    // what each frame painted: read in the task right after it (every animation callback has run by then)
    const sample = () => {
      const span = rail.shadowRoot.querySelector('.span');
      if (span)
        window.__spans.push(Number(span.getAttribute('y2')) - Number(span.getAttribute('y1')));
      if (window.__spans.length < 400) requestAnimationFrame(() => setTimeout(sample, 0));
    };
    requestAnimationFrame(() => setTimeout(sample, 0));
  });
  await page.mouse.move(width / 3, 500);
  for (let i = 0; i < 25; i += 1) {
    await page.mouse.wheel(0, 80);
    await page.waitForTimeout(40);
  }
  const spans = await page.evaluate(() => window.__spans);
  const short = spans.filter((length) => length < 31).length;
  check(
    `${width}: the lit axis shows in every frame of a wheel scroll`,
    short === 0,
    `${short} of ${spans.length} frames short`,
  );
  await page.close();
}

/* ---------- the way to the day before stays in its column ---------- */
for (const [width, lang, card] of [
  [320, 'es', true],
  [320, 'en', false],
  [360, 'es', false],
  [360, 'es', true],
  [412, 'es', false],
]) {
  const page = await open(`lang=${lang}${card ? '&card=1' : ''}`, width, 800);
  await page.evaluate(() => {
    const rail = document
      .querySelector('fluvy-activity')
      .shadowRoot.querySelector('fluvy-time-rail');
    rail.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  });
  await page.waitForTimeout(900);
  const fit = await page.evaluate(() => {
    const root = document.querySelector('fluvy-activity').shadowRoot;
    const button = root.querySelector('.av-earlier .fv-btn').getBoundingClientRect();
    const main = root.querySelector('.av-main');
    const style = getComputedStyle(main);
    const edge = main.getBoundingClientRect().right - parseFloat(style.paddingRight);
    return {
      right: button.right,
      edge,
      page: document.documentElement.scrollWidth,
      width: window.innerWidth,
    };
  });
  check(
    `${width}${card ? ' card' : ''} ${lang}: the day before's button stays in its column, no sideways scroll`,
    fit.right <= fit.edge + 0.5 && fit.page <= fit.width,
    `right ${fit.right.toFixed(1)} of ${fit.edge.toFixed(1)}, page ${fit.page} of ${fit.width}`,
  );
  await page.close();
}

/* ---------- a burst's entries at every phone width: names whole or stacked, the time and the change 12 apart ---------- */
for (const [lang, card] of [
  ['en', false],
  ['en', true],
  ['es', false],
  ['es', true],
]) {
  const page = await open(`lang=${lang}&moment=burst${card ? '&card=1' : ''}`, 320, 800);
  const bad = [];
  for (let width = 320; width <= 420; width += 1) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(120);
    const found = await page.evaluate(() => {
      const root = document.querySelector('fluvy-activity').shadowRoot;
      const out = [];
      for (const entry of root.querySelectorAll('.av-mini:not(.is-repeat)')) {
        const name = entry.querySelector('.av-mini__name');
        if (!name) continue;
        if (name.scrollHeight > name.clientHeight + 1 && !entry.classList.contains('is-stacked'))
          out.push(`clamped beside its change: "${name.textContent.trim()}"`);
        const time = entry.querySelector('.av-time').getBoundingClientRect();
        const change = entry.querySelector('.av-change, .av-msg')?.getBoundingClientRect();
        if (
          change &&
          change.top < time.bottom &&
          change.bottom > time.top &&
          change.left - time.right < 11.5
        )
          out.push(`time and change ${(change.left - time.right).toFixed(1)} apart`);
      }
      return out;
    });
    if (found.length) bad.push(`${width}: ${found[0]}`);
  }
  check(
    `${lang}${card ? ' card' : ''}: burst entries read whole from 320 to 420`,
    bad.length === 0,
    bad.slice(0, 3).join(' · '),
  );
  await page.close();
}

/* ---------- the shared measurer matches the page's layout ---------- */
{
  const page = await open('lang=es');
  const off = await page.evaluate(() => {
    const family = getComputedStyle(document.querySelector('fluvy-activity')).fontFamily;
    const out = [];
    for (const [size, weight] of [
      [12, 600],
      [15, 600],
      [13, 500],
    ])
      for (const text of [
        'Apagado',
        'Desarmada',
        'Armada noche',
        'Más información',
        'Encendido de la bombilla 18',
      ]) {
        const span = document.createElement('span');
        span.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${weight} ${size}px ${family};font-feature-settings:'cv11','ss01';font-optical-sizing:auto`;
        span.textContent = text;
        document.body.append(span);
        const laid = span.getBoundingClientRect().width;
        span.remove();
        const measured = window.fluvyTextWidth(text, { size, weight, family });
        if (Math.abs(laid - measured) > 0.01)
          out.push(`${text} ${size}/${weight}: ${measured.toFixed(2)} vs ${laid.toFixed(2)}`);
      }
    return out;
  });
  check(
    'textWidth() equals the page layout, font features included',
    off.length === 0,
    off.slice(0, 3).join(' · '),
  );
  await page.close();
}

/* ---------- the rail's focus is the knob's ring alone ---------- */
{
  const page = await open('lang=en');
  await page.keyboard.press('Shift');
  const focus = await page.evaluate(() => {
    const rail = document
      .querySelector('fluvy-activity')
      .shadowRoot.querySelector('fluvy-time-rail');
    rail.focus();
    return {
      visible: rail.matches(':focus-visible'),
      outline: getComputedStyle(rail).outlineStyle,
    };
  });
  check(
    'a keyboard-focused rail draws no outline of its own (the knob shows focus)',
    focus.visible && focus.outline === 'none',
    JSON.stringify(focus),
  );
  await page.close();
}

/* ---------- text: Spanish state words, a phone's own column ---------- */
for (const [width, card] of [
  [320, true],
  [360, false],
  [360, true],
  [412, false],
  [736, false],
  [1440, true],
]) {
  const page = await open(`lang=es&moment=burst${card ? '&card=1' : ''}`, width);
  // unfold every repeat and a detail or two, so their values are laid out too
  await page.evaluate(async () => {
    const root = document.querySelector('fluvy-activity').shadowRoot;
    const rows = [...root.querySelectorAll('.av-row')].slice(0, 12);
    for (const row of rows)
      if (row.querySelector('.av-chevron') || rows.indexOf(row) < 2) row.click();
  });
  await page.waitForTimeout(700);
  const cut = await page.evaluate(() => {
    const root = document.querySelector('fluvy-activity').shadowRoot;
    const out = [];
    // a state pill holds its text with its 8 px sides (its text box is a flex item that never overflows itself)
    for (const pill of root.querySelectorAll('.av-state')) {
      const range = document.createRange();
      range.selectNodeContents(pill.lastElementChild);
      const text = range.getBoundingClientRect().width;
      if (text && pill.getBoundingClientRect().width - text < 16 - 0.5)
        out.push(
          `pill "${pill.textContent.trim()}" ${pill.getBoundingClientRect().width} for ${text.toFixed(1)}`,
        );
    }
    // a burst's entry name is clamped only when even the entry's whole width cannot hold it on two lines
    for (const name of root.querySelectorAll('.av-mini__name')) {
      if (
        name.scrollHeight > name.clientHeight + 1 &&
        !name.parentElement.classList.contains('is-stacked')
      )
        out.push(`burst name clamped beside its change: "${name.textContent.trim()}"`);
    }
    for (const node of root.querySelectorAll(
      '.av-day__date span, .av-day__eyebrow:not([data-name]), .fv-btn, .av-change',
    )) {
      const box = node.getBoundingClientRect();
      if (!box.width) continue;
      if (node.scrollWidth > node.clientWidth + 1)
        out.push(`${node.className}: "${node.textContent.trim()}"`);
      const parent = node.closest('.av-detail__inner, .av-body, .av-inner');
      if (parent && box.right > parent.getBoundingClientRect().right + 0.5)
        out.push(`${node.className} past its box: "${node.textContent.trim()}"`);
    }
    const main = root.querySelector('.av-main');
    return {
      out: [...new Set(out)],
      main: main.clientWidth,
      measured: document.querySelector('fluvy-activity').mainWidth,
    };
  });
  check(
    `${width}${card ? ' card' : ''} es: no value, button or title cut`,
    cut.out.length === 0,
    cut.out.slice(0, 4).join(' · '),
  );
  check(
    `${width}${card ? ' card' : ''}: measured with its own column`,
    cut.main === cut.measured,
    `${cut.measured} of ${cut.main}`,
  );
  await page.close();
}

await suite.finish();
