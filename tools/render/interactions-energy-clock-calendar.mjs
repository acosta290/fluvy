#!/usr/bin/env node
/**
 * Interaction and lifecycle tests for the energy, solar, clock and calendar cards on the playground
 * (real cards, simulated hass). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5184/ node interactions-energy-clock-calendar.mjs
 * What it proves: the flow's dots run on CSS, pause at 0 W and vanish under reduced motion; an
 * unavailable curve claims no reading at "now"; the analog face runs without a single DOM write
 * while the digital seconds tick once a second; a removed clock schedules nothing more; a calendar
 * never re-reads because `hass` was replaced, reads a new month once and the old one from cache,
 * and its days work from the keyboard; a humidifier switch flips before Home Assistant answers;
 * rows open more-info from the keyboard, once.
 */
import { BASE, calls, frame, reset, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { browser, check } = suite;

async function open(sheet, width = 360, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, ...options });
  await page.goto(`${BASE}?sheet=${sheet}&width=${width}`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(900);
  return page;
}

/** Counts `hass-more-info` events reaching the document while `run` happens. */
async function moreInfos(page, run) {
  // one listener per page, not per call: a second registration would count every event twice
  await page.evaluate(() => {
    window.__moreInfo = [];
    if (!window.__moreInfoBound) {
      window.__moreInfoBound = true;
      document.addEventListener(
        'hass-more-info',
        (e) => window.__moreInfo.push(e.detail?.entityId),
        true,
      );
    }
  });
  await run();
  await page.waitForTimeout(80);
  return page.evaluate(() => window.__moreInfo);
}

/* ---------- energy flow: motion on the compositor, paused at zero, gone under reduced motion ---------- */
{
  const page = await open('energy');
  const flow = frame(page, 'Flow').locator('fluvy-energy-flow-card').first();
  const motion = await flow.evaluate((card) => {
    const groups = [...card.shadowRoot.querySelectorAll('.ef-dots')];
    return groups.map((g) => {
      const dots = [...g.querySelectorAll('.ef-flow')];
      const anims = dots.flatMap((d) => d.getAnimations());
      return {
        idle: g.classList.contains('is-idle'),
        rate: Number(g.dataset.rate),
        on: dots.filter((d) => d.classList.contains('is-on')).length,
        states: [...new Set(anims.map((a) => a.playState))],
        rates: [...new Set(anims.map((a) => a.playbackRate.toFixed(2)))],
        css: anims.every((a) => a instanceof CSSAnimation),
      };
    });
  });
  check(
    'flow: every link carries CSS animations (no script per frame)',
    motion.length === 3 && motion.every((m) => m.css),
    JSON.stringify(motion),
  );
  check(
    'flow: live links run at the pace of their power',
    motion.every(
      (m) =>
        !m.idle &&
        m.on >= 1 &&
        m.states.join() === 'running' &&
        m.rates.length === 1 &&
        Number(m.rates[0]) === m.rate,
    ),
    JSON.stringify(motion),
  );

  const night = frame(page, 'On the battery').locator('fluvy-energy-flow-card').first();
  const idle = await night.evaluate((card) => {
    const solar = card.shadowRoot.querySelector('.ef-dots--solar');
    const anims = [...solar.querySelectorAll('.ef-flow')].flatMap((d) => d.getAnimations());
    return {
      idle: solar.classList.contains('is-idle'),
      on: solar.querySelectorAll('.is-on').length,
      states: [...new Set(anims.map((a) => a.playState))],
      link:
        (
          card.shadowRoot.querySelector('.ef-link--solar') ??
          card.shadowRoot.querySelector('.ef-band--solar')
        ).classList.contains('ef-link--idle') ||
        (card.shadowRoot.querySelector('.ef-band--solar')?.classList.contains('ef-band--idle') ??
          false),
    };
  });
  check(
    'flow: a link at 0 W is idle — dots paused and hidden, dashes dimmed',
    idle.idle && idle.on === 0 && idle.states.join() === 'paused' && idle.link,
    JSON.stringify(idle),
  );

  const dead = frame(page, 'Nothing to show').locator('fluvy-energy-flow-card').first();
  check(
    'flow: an unavailable diagram shows the state once and no badge',
    (await dead.locator('.fv-card__sub').textContent()).trim() === 'Unavailable' &&
      (await dead.locator('.fv-badge').count()) === 0,
  );

  // the unavailable energy card keeps its history but claims no reading at "now"
  const deadCurve = frame(page, 'Nothing to show').locator('fluvy-energy-card').nth(1);
  const dot = await deadCurve.evaluate((card) => {
    const d = card.shadowRoot.querySelector('.curve-dot');
    return d ? getComputedStyle(d).display : 'absent';
  });
  check(
    'energy: an unavailable sensor draws no dot at "now"',
    dot === 'none' || dot === 'absent',
    dot,
  );
  check(
    'energy: …and its value reads —',
    (
      await deadCurve.locator('.fv-readout--l .fv-readout__value span').first().textContent()
    ).trim() === '—',
  );
  await page.close();
}
{
  const page = await open('energy', 360, { reducedMotion: 'reduce' });
  const flow = frame(page, 'Flow').locator('fluvy-energy-flow-card').first();
  const hidden = await flow.evaluate((card) =>
    [...card.shadowRoot.querySelectorAll('.ef-dots')].every(
      (g) => getComputedStyle(g).display === 'none',
    ),
  );
  check(
    'flow: reduced motion removes the travelling dots (the drawing stays)',
    hidden && (await flow.locator('.ef-band').count()) === 3,
  );
  await page.close();
}

/* ---------- flow styles: ribbons (default) are as thick as their power, legs and rail draw on request ---------- */
{
  const page = await open('energy');
  const flow = page.locator('fluvy-energy-flow-card').first(); // three sources, ribbons by default
  const bands = flow.locator('.ef-band');
  check(
    'the flow draws one ribbon per source by default',
    (await bands.count()) === 3 && (await flow.locator('.ef-link').count()) === 0,
  );
  const solar = await bands.nth(0).boundingBox();
  const grid = await bands.nth(1).boundingBox();
  check(
    '…and the ribbon of the biggest flow is the thickest',
    solar.height > grid.height + 8,
    `${solar.height} vs ${grid.height}`,
  );
  check('…with a chevron per flowing source', (await flow.locator('.ef-chev').count()) === 3);
  const legs = page.locator('fluvy-energy-flow-card').filter({ hasText: 'Legs' }).first();
  check(
    'flow_style: legs draws the dashed legs with arrowheads',
    (await legs.locator('.ef-link').count()) === 2 &&
      (await legs.locator('marker').count()) === 2 &&
      (await legs.locator('.ef-band').count()) === 0,
  );
  const rail = page.locator('fluvy-energy-flow-card').filter({ hasText: 'Rail' }).first();
  check(
    'flow_style: rail draws one track, a connector per source and the arrow into the house',
    (await rail.locator('.ef-rail').count()) === 1 &&
      (await rail.locator('.ef-join').count()) === 2 &&
      (await rail.locator('.ef-chev--house').count()) === 1,
  );
  check(
    'every style animates its dots',
    (await rail.locator('.ef-flow.is-on').count()) > 0 &&
      (await flow.locator('.ef-flow.is-on').count()) > 0,
  );
  await page.close();
}

/* ---------- narrow flow cards list their sources: no diagram, no dots ---------- */
{
  const page = await open('energy');
  const narrow = page.locator('fluvy-energy-flow-card').filter({ hasText: 'Narrow' }).first();
  check(
    'a 6-column flow card lists its sources and the house instead of drawing',
    (await narrow.locator('.ef-list__row').count()) === 3 &&
      (await narrow.locator('svg.ef-stage, .ef-stage').count()) === 0 &&
      (await narrow.locator('.ef-flow').count()) === 0,
  );
  const wide = page.locator('fluvy-energy-flow-card').first();
  check(
    '…while a full-width one keeps the diagram',
    (await wide.locator('.ef-stage').count()) === 1,
  );
  const rail = page.locator('fluvy-energy-flow-card').filter({ hasText: 'Rail' }).first();
  const tip = await rail
    .locator('.ef-chev--house')
    .first()
    .evaluate((c) => c.getAttribute('d'));
  const track = await rail
    .locator('.ef-rail')
    .first()
    .evaluate((t) => t.getAttribute('d'));
  const tipX = Number(
    tip.split(' ')[1].split('L')[1]?.split(',')[0] ?? tip.match(/L([\d.]+),/)?.[1],
  );
  const trackEnd = Number(track.match(/H([\d.]+)/)?.[1]);
  check(
    'rail: the arrow tip ends the track',
    Number.isFinite(tipX) && Number.isFinite(trackEnd) && tipX - trackEnd === 1,
    `${tipX} vs ${trackEnd}`,
  );
  await page.close();
}

/* ---------- scrubbing: a pointer over a chart reads the value under it, everything returns to now ---------- */
{
  const page = await open('energy');
  const card = page.locator('fluvy-energy-card').first();
  const chart = card.locator('.ef-chart');
  const label = card.locator('.ef-top .fv-readout__label').first();
  const bubble = card.locator('.fv-bubble');
  const before = {
    label: (await label.textContent()).trim(),
    bubble: (await bubble.textContent()).replace(/\s+/g, ' ').trim(),
    left: (await bubble.boundingBox()).x,
  };
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(120);
  const during = {
    label: (await label.textContent()).trim(),
    bubble: (await bubble.textContent()).replace(/\s+/g, ' ').trim(),
    left: (await bubble.boundingBox()).x,
  };
  check(
    'energy: hovering the chart moves the bubble to the pointer',
    during.left < before.left - 40,
    `${before.left} → ${during.left}`,
  );
  check(
    'energy: …the bubble says when',
    /\d{1,2}:\d{2}/.test(during.bubble) && !/\d:\d{2}/.test(before.bubble),
    during.bubble,
  );
  check(
    'energy: …and the readout label becomes that time',
    during.label !== before.label && /\d{1,2}:\d{2}/.test(during.label),
    during.label,
  );
  await page.mouse.move(box.x - 40, box.y - 40);
  await page.waitForTimeout(120);
  const after = { label: (await label.textContent()).trim(), left: (await bubble.boundingBox()).x };
  check(
    'energy: leaving the chart returns to now',
    after.label === before.label && Math.abs(after.left - before.left) < 1,
    `${after.label} ${after.left}`,
  );
  await page.close();
}
{
  const sensorPage = await open('ambient');
  const sensor = sensorPage
    .locator('fluvy-sensor-card')
    .filter({ has: sensorPage.locator('.fv-bubble') })
    .first(); // a chart card with history
  const chart = sensor.locator('.am-chart');
  const bubble = sensor.locator('.fv-bubble');
  const restLeft = (await bubble.boundingBox()).x;
  const box = await chart.boundingBox();
  await sensorPage.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await sensorPage.waitForTimeout(120);
  const text = (await bubble.textContent()).replace(/\s+/g, ' ').trim();
  check(
    'sensor: hovering the curve reads the value under the pointer with its time',
    (await bubble.boundingBox()).x < restLeft - 80 && /\d{1,2}:\d{2}/.test(text),
    text,
  );
  await sensorPage.close();
  const page = await open('solar');
  const production = page.locator('fluvy-production-card').first();
  const bars = production.locator('.so-bars');
  const readoutLabel = production.locator('.so-top .fv-readout__label').first();
  const rest = (await readoutLabel.textContent()).trim();
  const bb = await bars.boundingBox();
  await page.mouse.move(bb.x + bb.width * (10.5 / 24), bb.y + bb.height * 0.6);
  await page.waitForTimeout(120);
  const hover = (await readoutLabel.textContent()).trim();
  check(
    'production: hovering a bar names its hour',
    hover !== rest && /10/.test(hover) && (await bars.locator('.so-bar.is-hover').count()) === 1,
    hover,
  );
  await page.mouse.move(bb.x - 40, bb.y - 40);
  await page.waitForTimeout(120);
  check(
    'production: leaving returns to the day total',
    (await readoutLabel.textContent()).trim() === rest,
  );
  await page.close();
}

/* ---------- clock: CSS hands, one aligned timer, nothing left behind ---------- */
{
  const page = await open('clocks');
  const live = frame(page, 'Live (the real clock)');
  const analog = live.locator('fluvy-clock-card').nth(0);
  const digital = live.locator('fluvy-clock-card').nth(1);

  const faceWrites = await analog.evaluate(async (card) => {
    const face = card.shadowRoot.querySelector('.ck-face');
    let writes = 0;
    const observer = new MutationObserver((records) => {
      writes += records.length;
    });
    observer.observe(face, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    const startAngle = getComputedStyle(face.querySelector('.ck-second')?.parentElement).transform;
    await new Promise((r) => setTimeout(r, 2200));
    const endAngle = getComputedStyle(face.querySelector('.ck-second')?.parentElement).transform;
    observer.disconnect();
    return { writes, moved: startAngle !== endAngle };
  });
  check(
    'clock: the analog second hand sweeps for 2 s without one DOM write',
    faceWrites.writes === 0 && faceWrites.moved,
    JSON.stringify(faceWrites),
  );

  const ticks = await digital.evaluate(async (card) => {
    const unit = () => card.shadowRoot.querySelector('.ck-big__unit')?.textContent ?? '';
    const seen = new Set([unit()]);
    const until = Date.now() + 2300;
    while (Date.now() < until) {
      await new Promise((r) => setTimeout(r, 50));
      seen.add(unit());
    }
    return [...seen];
  });
  check(
    'clock: digital seconds advance once a second (aligned timer)',
    ticks.length >= 3 && ticks.length <= 4 && ticks.every((t) => /^:\d\d$/.test(t)),
    ticks.join(' '),
  );

  const after = await page.evaluate(async () => {
    const cards = [...document.querySelectorAll('fluvy-clock-card')].filter((c) => !c.config?._now);
    for (const card of cards) card.remove();
    let scheduled = 0;
    const native = window.setTimeout;
    window.setTimeout = (fn, delay, ...rest) => {
      if (delay >= 200 && delay <= 61_000) scheduled += 1;
      return native(fn, delay, ...rest);
    };
    await new Promise((r) => native(r, 2400));
    window.setTimeout = native;
    return scheduled;
  });
  check(
    'clock: removed clocks schedule no more timers',
    after === 0,
    `${after} scheduled in 2.4 s`,
  );
  await page.close();
}

/* ---------- calendar: reads once, keyboard days, day switching ---------- */
{
  const page = await open('calendar');
  const month = frame(page, 'Month + day').locator('fluvy-calendar-card').first();

  const reads = await month.evaluate(async (card) => {
    let count = 0;
    // count on the ORIGINAL reader: re-wrapping a wrapper would count one read once per layer
    const read = card.hass.callApi.bind(card.hass);
    const counted = (...args) => {
      count += 1;
      return read(...args);
    };
    const wrap = (hass) => ({ ...hass, callApi: counted });
    for (let i = 0; i < 20; i++) {
      card.hass = wrap(card.hass);
      await new Promise((r) => setTimeout(r, 10));
    }
    await new Promise((r) => setTimeout(r, 200));
    const replaced = count;
    card.shadowRoot.querySelector('[aria-label="Next month"]').click();
    await new Promise((r) => setTimeout(r, 400));
    const next = {
      count: count - replaced,
      title: card.shadowRoot.querySelector('.fv-card__title').textContent.trim(),
      label: card.shadowRoot.querySelector('.fv-label')?.textContent.trim(),
    };
    const before = count;
    card.shadowRoot.querySelector('[aria-label="Previous month"]').click();
    await new Promise((r) => setTimeout(r, 400));
    const back = {
      count: count - before,
      title: card.shadowRoot.querySelector('.fv-card__title').textContent.trim(),
      label: card.shadowRoot.querySelector('.fv-label')?.textContent.trim(),
    };
    return { replaced, next, back };
  });
  check(
    'calendar: 20 replaced hass objects → no read',
    reads.replaced === 0,
    `${reads.replaced} reads`,
  );
  check(
    'calendar: next month → one read per calendar, October, its first day selected',
    reads.next.count === 5 &&
      reads.next.title === 'October' &&
      /^Thursday 1 /.test(reads.next.label),
    JSON.stringify(reads.next),
  );
  check(
    'calendar: back to this month → served from cache, today selected',
    reads.back.count === 0 &&
      reads.back.title === 'September' &&
      /^Thursday 17 /.test(reads.back.label),
    JSON.stringify(reads.back),
  );

  await month.locator('.fv-day.is-selected').focus();
  await page.keyboard.press('ArrowRight');
  const focused = await month.evaluate((card) => card.shadowRoot.activeElement?.textContent.trim());
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const label = (await month.locator('.fv-label').textContent()).trim();
  check(
    'calendar: ArrowRight moves to the 18th, Enter selects it',
    focused === '18' && /^Friday 18 · 2 events$/.test(label),
    `${focused} · ${label}`,
  );
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(400);
  check(
    'calendar: PageDown turns the month',
    (await month.locator('.fv-card__title').textContent()).trim() === 'October',
  );
  check('calendar: none of it called a service', (await calls(page)).length === 0);

  const agenda = frame(page, 'Agenda').locator('fluvy-calendar-card').first();
  await agenda.locator('.cd-rows .fv-row').last().click();
  await page.waitForTimeout(300);
  const tomorrow = {
    title: (await agenda.locator('.fv-card__title').textContent()).trim(),
    rows: await agenda.locator('.cd-event').count(),
    back: (await agenda.locator('.cd-rows .fv-row__title').last().textContent()).trim(),
  };
  await agenda.locator('.cd-rows .fv-row').last().click();
  await page.waitForTimeout(300);
  check(
    'calendar: the Tomorrow row turns the agenda and offers Today back',
    tomorrow.title === 'Tomorrow' &&
      tomorrow.rows === 2 &&
      tomorrow.back === 'Today' &&
      (await agenda.locator('.fv-card__title').textContent()).trim() === 'Today',
    JSON.stringify(tomorrow),
  );

  const opened = await moreInfos(page, async () => {
    await agenda.locator('.cd-event').first().focus();
    await page.keyboard.press('Enter');
  });
  check(
    'calendar: Enter on an event row opens its calendar, once',
    opened.length === 1 && opened[0] === 'calendar.ona',
    JSON.stringify(opened),
  );
  await page.close();
}

/* ---------- humidity switch, rows from the keyboard ---------- */
{
  const page = await open('solar');
  const humidity = frame(page, 'Humidity').locator('fluvy-humidity-card').first();
  await humidity.locator('.fv-hit').click();
  const immediately = await humidity.locator('.fv-switch').getAttribute('aria-checked');
  await page.waitForTimeout(400);
  const c = await calls(page);
  check(
    'humidity: the humidifier switch flips before Home Assistant answers',
    immediately === 'false',
  );
  check(
    'humidity: …with one service call',
    c.length === 1 && c[0].s === 'humidifier.turn_off',
    JSON.stringify(c.map((x) => x.s)),
  );
  await reset(page);

  const bars = frame(page, 'Strings & inverter').locator('fluvy-bars-card').first();
  const fromBars = await moreInfos(page, async () => {
    await bars.locator('.fv-row').first().focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press(' ');
  });
  check(
    'bars: Enter and Space on a row open it (one event each, no service)',
    fromBars.length === 2 &&
      fromBars.every((id) => id === 'sensor.so_string_east') &&
      (await calls(page)).length === 0,
    JSON.stringify(fromBars),
  );

  const gauge = frame(page, 'Solar power').locator('fluvy-gauge-card').first();
  const fromGauge = await moreInfos(page, async () => {
    await gauge.locator('.fv-card__head button').first().click();
  });
  check(
    'gauge: the icon opens more-info',
    fromGauge.length === 1 && fromGauge[0] === 'sensor.so_solar_power',
    JSON.stringify(fromGauge),
  );

  const production = frame(page, 'Production').locator('fluvy-production-card').first();
  const readouts = await production.locator('.so-cols .fv-readout__value').allTextContents();
  check(
    'production: sun hours count the hour in progress by its minutes',
    readouts.map((t) => t.replace(/\s+/g, ' ').trim()).join(' | ') === '4.1kW | 12:00 | 8.2h',
    readouts.join(' | '),
  );

  const twelve = frame(page, 'Production · 12-hour clock').locator('.fv-axis span');
  const labels = await twelve.allTextContents();
  const oneLine = await twelve.evaluateAll((spans) =>
    spans.every((s) => s.getBoundingClientRect().height <= 17),
  );
  check(
    'production: a 12-hour axis reads 12 AM … 12 AM on one line',
    labels.join(' ') === '12 AM 6 AM 12 PM 6 PM 12 AM' && oneLine,
    labels.join(' '),
  );
  await page.close();
}

{
  const page = await open('energy');
  const devices = frame(page, 'Appliances today').locator('fluvy-energy-devices-card').first();
  const rows = await devices.locator('.fv-row').allTextContents();
  check(
    'appliances: seven rows, the water meter plain, the dryer unavailable',
    rows.length === 7 &&
      /Kitchen tap\s*84 L$/.test(rows[6].replace(/\s+/g, ' ').trim()) &&
      /Dryer\s*Unavailable\s*—/.test(rows[5].replace(/\s+/g, ' ')),
    rows.map((r) => r.replace(/\s+/g, ' ').trim()).join(' / '),
  );
  check(
    'appliances: no bar under the water meter',
    (await devices.locator('.fv-row').nth(6).locator('.fv-bar').count()) === 0,
  );
  const opened = await moreInfos(page, async () => {
    await devices.locator('.fv-row').first().focus();
    await page.keyboard.press('Enter');
  });
  check(
    'appliances: Enter on a row opens it, once',
    opened.length === 1 && opened[0] === 'sensor.ef_heat_pump_energy',
    JSON.stringify(opened),
  );
  const legend = await frame(page, '12-hour clock · mixed units')
    .locator('fluvy-energy-flow-card .fv-readout__value')
    .allTextContents();
  check(
    'flow: totals share one unit (420 Wh beside 4.1 kWh reads 0.4 kWh)',
    legend.map((t) => t.replace(/\s+/g, ' ').trim()).join(' | ') === '0.4kWh | 1.3kWh | 4.1kWh',
    legend.join(' | '),
  );
  await page.close();
}

await suite.finish();
