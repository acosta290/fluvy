#!/usr/bin/env node
/**
 * The energy flow, 1.4, on the playground's `flow` sheet (real cards, simulated hass). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5184/ node interactions-energy-flow.mjs
 * What it proves: a grid read per phase shows its import and its export at once, each lane in its origin's colour;
 * every arrowhead ends its lane (the lane stops 7 px before the tip); pulses are Web Animations, at most eight a
 * card, faster for a bigger flow in px/s, retuned in place when a reading changes, paused off screen and in a hidden
 * tab, absent under reduced motion and `motion: off`; a flow below its threshold rests, a stale card says so, an
 * unreadable source is a hairline; the cross bridges its crossing; narrow columns list; the Energy dashboard's own
 * sources and a day's totals are read; 1.3's YAML still draws.
 */
import { BASE, frame, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { browser, check } = suite;

async function open(sheet = 'flow', width = 360, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, ...options });
  await page.goto(`${BASE}?sheet=${sheet}&width=${width}`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(1200);
  return page;
}

const card = (page, title, n = 0) => frame(page, title).locator('fluvy-energy-flow-card').nth(n);

/** Every lane group: its ink, its way, rest / hidden, and its pulses. */
const lanes = (flow) =>
  flow.evaluate((c) => {
    const root = c.shadowRoot;
    return [...root.querySelectorAll('.en-flow')].map((g) => ({
      ink: [...g.classList].find((k) => k.startsWith('en-ink--')),
      out: g.classList.contains('is-out'),
      rest: g.classList.contains('is-rest'),
      hidden: g.classList.contains('is-hidden'),
    }));
  });

const pulses = (flow) =>
  flow.evaluate((c) =>
    [...c.shadowRoot.querySelectorAll('.en-pulses')].map((g) => {
      const anims = [...g.querySelectorAll('.en-comet')].flatMap((comet) => comet.getAnimations());
      return {
        lane: g.dataset.lane,
        ink: [...g.classList].find((k) => k.startsWith('en-ink--')),
        run: Number(g.dataset.run),
        comets: g.querySelectorAll('.en-comet').length,
        waapi: anims.every((a) => !(a instanceof CSSAnimation)),
        states: [...new Set(anims.map((a) => a.playState))],
        // px per second: the lane's run over one lap at the current rate
        speed: anims[0]
          ? Number(g.dataset.run) /
            (anims[0].effect.getTiming().duration / 1000 / anims[0].playbackRate)
          : 0,
        rate: anims[0]?.playbackRate ?? 0,
      };
    }),
  );

/* ---------- the #19 house: import and export at once, coloured by origin ---------- */
{
  const page = await open();
  const flow = card(page, 'The #19 house');
  const l = await lanes(flow);
  check(
    '#19: four lanes — the sun, the grid’s pair, the battery',
    l.length === 4,
    JSON.stringify(l),
  );
  check(
    '#19: the grid imports in its own colour and exports in the sun’s, both shown',
    l[1]?.ink === 'en-ink--grid' &&
      !l[1]?.out &&
      !l[1]?.hidden &&
      l[2]?.ink === 'en-ink--solar' &&
      l[2]?.out &&
      !l[2]?.hidden,
    JSON.stringify(l.slice(1, 3)),
  );
  check(
    '#19: the battery charges from the sun (its lane runs out of the house, gold)',
    l[3]?.ink === 'en-ink--solar' && l[3]?.out && !l[3]?.rest,
    JSON.stringify(l[3]),
  );
  const words = (await flow.locator('.en-words').allTextContents()).map((t) =>
    t.replace(/\s+/g, ' ').trim(),
  );
  check(
    '#19: the grid says both figures, the house what it uses, the badge what the sun covers',
    words.some((w) => w === 'Grid1.9kW in0.4kW out') &&
      words.some((w) => w === 'House4.1kW') &&
      (await flow.locator('.fv-badge').textContent()).trim() === '54 % solar',
    words.join(' | '),
  );

  // the arrowhead ends the lane: the body stops 7 px of curve before the tip
  const gaps = await flow.evaluate((c) =>
    [...c.shadowRoot.querySelectorAll('.en-flow')].flatMap((g) =>
      ['in', 'out']
        .map((way) => {
          const body = g.querySelector(`.en-body--${way}`);
          const head = g.querySelector(`.en-head--${way}`);
          if (!body || !head) return null;
          const end = body.getPointAtLength(body.getTotalLength());
          const [x, y] = head
            .getAttribute('transform')
            .match(/translate\(([-\d.]+),([-\d.]+)\)/)
            .slice(1)
            .map(Number);
          return Math.hypot(end.x - x, end.y - y);
        })
        .filter((d) => d !== null),
    ),
  );
  check(
    'every arrowhead ends its lane: the lane stops 7 px before the tip',
    gaps.length === 7 && gaps.every((d) => d > 6.4 && d < 7.1),
    gaps.map((d) => d.toFixed(2)).join(', '),
  );

  const p = await pulses(flow);
  check(
    'pulses are Web Animations, running, one colour per origin',
    p.length === 4 &&
      p.every((g) => g.waapi && g.states.join() === 'running' && g.comets >= 1) &&
      p.find((g) => g.lane.startsWith('source-1-1'))?.ink === 'en-ink--solar',
    JSON.stringify(p),
  );
  check(
    'never more than eight pulses on a card',
    p.reduce((sum, g) => sum + g.comets, 0) <= 8,
    String(p.reduce((sum, g) => sum + g.comets, 0)),
  );
  const solar = p.find((g) => g.lane.startsWith('source-0'));
  const out = p.find((g) => g.lane.startsWith('source-1-1'));
  check(
    'a bigger flow travels faster in px/s (3.2 kW beside 0.4 kW), inside 24 → 72',
    solar && out && solar.speed > out.speed && out.speed >= 23.5 && solar.speed <= 72.5,
    `${solar?.speed.toFixed(1)} vs ${out?.speed.toFixed(1)} px/s`,
  );

  // a reading that changes only the power retunes the pace, each pulse where it is
  const before = await flow.evaluate((c) => {
    const comet = c.shadowRoot.querySelector('.en-pulses[data-lane^="source-0"] .en-comet');
    window.__comet = comet;
    return comet.getAnimations()[0].playbackRate;
  });
  await page.evaluate(() => window.fluvyMock.set('sensor.fl_solar', '4.8'));
  await page.waitForTimeout(300);
  const after = await flow.evaluate((c) => {
    const comet = c.shadowRoot.querySelector('.en-pulses[data-lane^="source-0"] .en-comet');
    return { same: comet === window.__comet, rate: comet.getAnimations()[0].playbackRate };
  });
  check(
    'a new reading retunes the pace without restarting a pulse',
    after.same && after.rate > before,
    `${before.toFixed(2)} → ${after.rate.toFixed(2)}, same element ${after.same}`,
  );

  // off screen, and in a hidden tab, everything pauses
  const offScreen = await flow.evaluate(async (c) => {
    c.style.transform = 'translateY(-5000px)';
    await new Promise((r) => setTimeout(r, 300));
    const states = [...c.shadowRoot.querySelectorAll('.en-comet')].flatMap((k) =>
      k.getAnimations().map((a) => a.playState),
    );
    c.style.transform = '';
    await new Promise((r) => setTimeout(r, 300));
    const back = [...c.shadowRoot.querySelectorAll('.en-comet')].flatMap((k) =>
      k.getAnimations().map((a) => a.playState),
    );
    return { away: [...new Set(states)], back: [...new Set(back)] };
  });
  check(
    'off screen the pulses pause, and run again on return',
    offScreen.away.join() === 'paused' && offScreen.back.join() === 'running',
    JSON.stringify(offScreen),
  );
  const hiddenTab = await flow.evaluate(async (c) => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    const states = [...c.shadowRoot.querySelectorAll('.en-comet')].flatMap((k) =>
      k.getAnimations().map((a) => a.playState),
    );
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    return [...new Set(states)];
  });
  check('in a hidden tab the pulses pause', hiddenTab.join() === 'paused', hiddenTab.join());
  await page.close();
}

/* ---------- import + export by two sensors; the grid badge ---------- */
{
  const page = await open();
  const flow = card(page, 'Import and export, two sensors');
  const l = await lanes(flow);
  check(
    'two sensors: the grid’s two lanes, the export in the sun’s colour',
    l.length === 3 &&
      l[1]?.ink === 'en-ink--grid' &&
      l[2]?.ink === 'en-ink--solar' &&
      !l[2]?.hidden,
    JSON.stringify(l),
  );
  check(
    'badge: grid says import + export',
    (await flow.locator('.fv-badge').textContent()).trim() === 'Import + export',
  );
  // the export stops: its lane fades out, the import stays
  await page.evaluate(() => window.fluvyMock.set('sensor.fl_grid_out', '0'));
  await page.waitForTimeout(300);
  const after = await lanes(flow);
  check(
    'when the export stops, its lane hides and the import stays',
    after[2]?.hidden && !after[1]?.hidden,
    JSON.stringify(after),
  );
  await page.close();
}

/* ---------- rest, stale, unreadable ---------- */
{
  const page = await open();
  const night = await lanes(card(page, 'Cheap hours'));
  check(
    'cross, cheap hours: the grid charges the battery in its own colour; the sun rests',
    night.some((l) => l.ink === 'en-ink--grid' && !l.rest && !l.hidden) &&
      night.filter((l) => l.ink === 'en-ink--solar').every((l) => l.rest || l.hidden),
    JSON.stringify(night),
  );
  const stale = card(page, 'Stale');
  const staleLanes = await lanes(stale);
  check(
    'stale: every lane rests, no pulse, and the head says how old the readings are',
    staleLanes.every((l) => l.rest) &&
      (await stale.locator('.en-comet').count()) === 0 &&
      (await stale.locator('.fv-card__sub').textContent()).trim() === 'Updated 12 min ago' &&
      (await stale.locator('.en-arcs.is-dim').count()) === 1,
  );
  const down = card(page, 'The grid unreadable');
  check(
    'an unreadable grid: a dashed hairline, a dashed ring, and the house unknown rather than guessed',
    (await down.locator('.en-hairline').count()) === 1 &&
      (await down.locator('.en-node.is-outage').count()) === 1 &&
      (await down.locator('.en-words').last().textContent()).replace(/\s+/g, '') === 'House—',
  );
  await page.close();
}

/* ---------- the cross bridges its crossing ---------- */
{
  const page = await open();
  const cross = card(page, 'Cross');
  const bridge = await cross.evaluate((c) => {
    const root = c.shadowRoot;
    const svgs = root.querySelectorAll('.en-stage > svg');
    const knock = root.querySelector('.en-knockout');
    return {
      svgs: svgs.length,
      knock: !!knock && !knock.classList.contains('is-hidden'),
      over: [...root.querySelectorAll('.en-pulses-layer--over .en-pulses')].map(
        (g) => g.dataset.lane,
      ),
    };
  });
  check(
    'cross: the grid → house lane is drawn over the sun → battery lane, its pulses too',
    bridge.svgs === 2 && bridge.knock && bridge.over.join() === 'gridHouse-in',
    JSON.stringify(bridge),
  );
  await page.close();
}

/* ---------- styles, motion off, reduced motion ---------- */
{
  const page = await open();
  check(
    'legs: thin lanes with their small heads',
    (await card(page, 'Legs').locator('.en-flow--thin').count()) === 4,
  );
  const rail = card(page, 'Rail');
  check(
    'rail: connectors join one track into the house; nothing travels',
    (await rail.locator('.en-rail').count()) >= 4 &&
      (await rail.locator('.en-comet').count()) === 0,
  );
  check(
    'motion: off keeps the drawing and no pulse',
    (await card(page, 'Still').locator('.en-comet').count()) === 0 &&
      (await card(page, 'Still').locator('.en-flow').count()) === 4,
  );
  await page.close();
}
{
  const page = await open('flow', 360, { reducedMotion: 'reduce' });
  const flow = card(page, 'The #19 house');
  check(
    'reduced motion: the lanes and heads stay, no pulse is started',
    (await flow.locator('.en-comet').count()) === 0 &&
      (await flow.locator('.en-head').count()) >= 4,
  );
  await page.close();
}

/* ---------- narrow columns list; the list keeps the first word of a name ---------- */
{
  const page = await open();
  const narrow = card(page, 'The narrowest column');
  check(
    'a lane under 56 px is no lane: the card lists its nodes',
    (await narrow.locator('.en-list__row').count()) === 4 &&
      (await narrow.locator('.en-stage').count()) === 0,
  );
  const half = card(page, 'Half a column');
  const labels = (await half.locator('.en-words__label').allTextContents()).map((t) => t.trim());
  check(
    'half a column: "Battery · 62 %" keeps "Battery", and the direction takes its own line',
    labels.includes('Battery') && (await half.locator('.en-words__dir').count()) >= 1,
    labels.join(' | '),
  );
  await page.close();
}

/* ---------- the Energy dashboard's own sources, and a day's totals ---------- */
{
  const page = await open();
  const auto = card(page, 'From the Energy dashboard');
  const l = await lanes(auto);
  check(
    'no sources: the Energy dashboard’s are read, the sun first (its grid by two sensors is a pair)',
    l.length === 4 &&
      (await auto.locator('.en-words__label').first().textContent()).trim() === 'Solar',
    JSON.stringify(l),
  );
  const today = card(page, 'Today');
  const words = (await today.locator('.en-words').allTextContents()).map((t) =>
    t.replace(/\s+/g, ' ').trim(),
  );
  check(
    'a day: every meter’s change summed hour by hour, the house what it used',
    words.includes('House13.4kWh') &&
      words.some((w) => w === 'Battery2.4kWh discharged3.0kWh charged'),
    words.join(' | '),
  );
  await today.locator('.fv-chip').nth(1).click();
  await page.waitForTimeout(400);
  check(
    'the period chips switch the span',
    (await today.locator('.fv-card__sub').textContent()).trim() === 'Last 7 days' &&
      (await today.locator('.fv-chip.is-active').textContent()).trim() === 'Week',
  );
  await page.close();
}

/* ---------- the house's power by source ---------- */
{
  const page = await open();
  const card = frame(page, 'House power by source').locator('fluvy-energy-card').first();
  const read = (c) =>
    c.evaluate((el) => {
      const root = el.shadowRoot;
      return {
        reading: (root.querySelector('.ef-top .fv-readout')?.textContent ?? '')
          .replace(/\s+/g, ' ')
          .trim(),
        areas: [...root.querySelectorAll('.en-area:not(.is-out)')].map((a) =>
          [...a.classList].find((k) => k.startsWith('en-ink--')),
        ),
        below: [...root.querySelectorAll('.en-area.is-out')].map((a) => a.dataset.below),
        lines: [...root.querySelectorAll('path.en-area-line')].map((l) => l.getAttribute('d')),
        legend: [...root.querySelectorAll('.en-legend__item')].map((i) =>
          i.textContent.replace(/\s+/g, ''),
        ),
      };
    });
  const chart = await read(card);
  const asked = await page.evaluate(() =>
    (window.fluvyAsked ?? []).filter(
      (m) => m.type === 'recorder/statistics_during_period' && (m.types ?? []).includes('mean'),
    ),
  );
  check(
    'by source, with the Energy dashboard’s power sensors: their five-minute means in kW, as Home Assistant’s own graph',
    asked.some(
      (m) =>
        m.period === '5minute' &&
        m.units?.power === 'kW' &&
        ['sensor.fl_solar', 'sensor.fl_grid_in', 'sensor.fl_grid_out', 'sensor.fl_battery'].every(
          (id) => m.statistic_ids.includes(id),
        ),
    ),
    JSON.stringify(asked.map((m) => [m.period, m.types, m.units, m.statistic_ids])),
  );
  check(
    'by source: right now is the house’s own use (1.9 + 3.2 − 0.4 − 0.6 = 4.1 kW), not a sensor of the card',
    /^Right now 4\.1 ?kW$/.test(chart.reading),
    chart.reading,
  );
  check(
    'by source: the sun, the battery and the grid stacked; under the line what went into the battery and out to the grid; the day’s totals',
    chart.areas.sort().join() === 'en-ink--battery,en-ink--grid,en-ink--solar' &&
      chart.below.join() === 'charged,exported' &&
      chart.legend.join(' | ') ===
        'Solar6.9kWh | Battery2.4kWh | Grid4.1kWh | Charged3.0kWh | Exported1.3kWh',
    JSON.stringify(chart),
  );

  // issue #23's house: a hybrid inverter's meters are wrong, its power sensors right
  const hybrid = frame(page, 'By source · a hybrid inverter, with power')
    .locator('fluvy-energy-card')
    .first();
  const h = await read(hybrid);
  const plot = hybrid.locator('.en-chart');
  await plot.scrollIntoViewIfNeeded();
  const box = await plot.boundingBox();
  const at = async (hour) => {
    await page.mouse.move(box.x + (box.width * hour) / 24, box.y + box.height / 2);
    await page.waitForTimeout(150);
    return (await read(hybrid)).reading;
  };
  const noon = await at(12.5);
  const gap = await at(3.25);
  await page.mouse.move(0, 0);
  check(
    'issue #23: drawn from power, the sun covers the house at midday, the evening is the battery’s, now is the house’s use (0.3 + 1.3 kW)',
    /^Right now 1\.6 ?kW$/.test(h.reading) &&
      h.areas.includes('en-ink--solar') &&
      h.below.join() === 'charged,exported' &&
      /^12:\d\d \d+(\.\d)? ?kW$/.test(noon) &&
      Number.parseFloat(noon.split(' ')[1] ?? '') > 0.5,
    JSON.stringify([h.reading, noon, h.legend]),
  );
  check(
    'issue #23: the recorder’s gap at 03:00 is a gap — the curve stops and the cursor reads "—", never a zero',
    h.lines.every((d) => (d.match(/M/g) ?? []).length >= 2) && /^03:\d\d —$/.test(gap),
    JSON.stringify([gap, h.lines.map((d) => (d.match(/M/g) ?? []).length)]),
  );

  // the same house without power: its meters, which count in 0.1 kWh, in half-hour blocks (a quarter would show the
  // step as a saw-tooth at the evening's 1.6 kW)
  const meters = frame(page, 'By source · a hybrid inverter, meters only')
    .locator('fluvy-energy-card')
    .first();
  const m = await read(meters);
  const xs = (m.lines[0] ?? '')
    .split(/[ML]/)
    .map((p) => Number(p.trim().split(',')[0]))
    .filter((x) => Number.isFinite(x) && x > 0);
  const steps = xs
    .slice(1)
    .map((x, i) => x - (xs[i] ?? 0))
    .filter((d) => d > 0);
  const width = (await meters.locator('.en-chart svg').boundingBox()).width;
  const block = (width * 30) / 1440;
  check(
    'without power sensors: the meters, half an hour a point for a 0.1 kWh step (no zigzag), no reading it cannot know',
    m.reading === '' &&
      steps.length > 10 &&
      steps.every((d) => Math.abs(d - block) < 0.2 || d > block * 1.4),
    JSON.stringify({ reading: m.reading, block, steps: steps.slice(0, 8) }),
  );
  await page.close();
}

/* ---------- 1.3's YAML still draws ---------- */
{
  const page = await open('energy');
  const legacy = frame(page, 'Flow').locator('fluvy-energy-flow-card').first();
  check(
    '1.3 keys (solar_power, grid_power, battery_*) draw the same diagram',
    (await legacy.locator('.en-node').count()) === 4 &&
      (await legacy.locator('.en-flow').count()) === 3,
  );
  await page.close();
}

await suite.finish();
