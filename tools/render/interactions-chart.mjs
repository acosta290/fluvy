#!/usr/bin/env node
/**
 * The chart engine (1.11) on the playground's `chart-styles` sheet, in a real Chromium, and once on the built bundle.
 * Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5199/ node interactions-chart.mjs     (the bundle's check needs `pnpm build` first)
 * What it proves:
 * - classic unchanged: the sensor's curve and area, and two sensors' curves, are 1.10's paths byte for byte (the
 *   strings recorded before the engine, `chart/engine/__fixtures__/classic-1.10.json`, on the same day);
 * - nothing leaves the plot, in every style and both modes: every line, area, copy and bar inside the chart's clip box,
 *   the dot, the knob and the bubble whole inside the chart's room and the card;
 * - text placement, in every style and both modes: the axis's first label flush with the plot's start and its last
 *   with its end, the scale's ticks right-aligned on one column 8 before the plot, a style's bubble inside the plot;
 * - the forecast: Fluvy's knob on now's hairline, the forecast dashed from it;
 * - reading: a pointer moves the cursor and the bubble says when; the keys move it (← Home), Escape lets it go;
 * - no flash, on the built bundle with the engine's chunk 1.5 s late: one skeleton, then the curve, drawn once.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { frame, settle, startSuite } from './lib/suite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixtures = JSON.parse(
  await readFile(
    join(ROOT, 'packages/cards/src/chart/engine/__fixtures__/classic-1.10.json'),
    'utf8',
  ),
);

const suite = await startSuite();
const { check } = suite;

/** The paths of a card's chart by class, through its shadow root. */
const paths = (locator, selector) =>
  locator.evaluate(
    (card, sel) => [...card.shadowRoot.querySelectorAll(sel)].map((el) => el.getAttribute('d')),
    selector,
  );

/* ---------- classic unchanged ---------- */
{
  const page = await suite.sheet('chart-styles');
  const one = frame(page, 'Style · classic').locator('fluvy-sensor-card').first();
  check(
    'classic, one sensor: its curve is 1.10’s, byte for byte',
    JSON.stringify(await paths(one, '.am-chart .curve-line')) ===
      JSON.stringify([fixtures.curveGeometry.sensor.line]),
  );
  check(
    'classic, one sensor: its area is 1.10’s, byte for byte',
    JSON.stringify(await paths(one, '.am-chart .curve-area')) ===
      JSON.stringify([fixtures.curveGeometry.sensor.area]),
  );
  const two = frame(page, 'Several · classic').locator('fluvy-sensor-card').first();
  check(
    'classic, two sensors: each curve is 1.10’s, byte for byte',
    JSON.stringify(await paths(two, '.am-chart .curve-line')) ===
      JSON.stringify([fixtures.seriesPath.sensorSmooth, fixtures.seriesPath.humSmooth]),
  );
  check(
    'classic, two sensors: the first one’s area is 1.10’s, byte for byte',
    (await paths(two, '.am-chart .curve-area'))[0] === fixtures.areaUnder.sensor,
  );
  await page.close();
}

/**
 * Every chart of the page, read where it is drawn: what leaves its clip box, a mark outside its room, the axis's
 * ends, the ticks' column and the bubble — one line per chart that breaks a rule.
 */
const audit = (page) =>
  page.evaluate(() => {
    const cards = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) {
          if (el.shadowRoot.querySelector('svg.fc-chart')) cards.push(el);
          walk(el.shadowRoot);
        }
      }
    };
    walk(document);
    const wrong = [];
    let charts = 0;
    for (const card of cards) {
      const name = `${card.closest('[data-frame]')?.getAttribute('data-frame') ?? '?'} ${card.localName}`;
      const shell = card.shadowRoot.querySelector('[data-card]')?.getBoundingClientRect();
      for (const svg of card.shadowRoot.querySelectorAll('svg.fc-chart')) {
        charts++;
        const box = svg.getBoundingClientRect();
        const clip = svg.querySelector('clipPath rect');
        const cx = box.left + Number(clip.getAttribute('x'));
        const cw = Number(clip.getAttribute('width'));
        const cy = box.top + Number(clip.getAttribute('y'));
        const ch = Number(clip.getAttribute('height'));
        const layers = svg.querySelector('g[clip-path]');
        for (const path of svg.querySelectorAll('path')) {
          if (!layers.contains(path)) wrong.push(`${name}: a path outside the clipped layers`);
          const r = path.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (
            r.left < cx - 0.5 ||
            r.right > cx + cw + 0.5 ||
            r.top < cy - 0.5 ||
            r.bottom > cy + ch + 0.5
          )
            wrong.push(
              `${name}: ${path.getAttribute('class')} at ${r.left.toFixed(1)}…${r.right.toFixed(1)} × ${r.top.toFixed(1)}…${r.bottom.toFixed(1)} leaves ${cx.toFixed(1)}…${(cx + cw).toFixed(1)} × ${cy.toFixed(1)}…${(cy + ch).toFixed(1)}`,
            );
        }
        // the marks stand proud by their radius at most: whole inside the drawing's height, and the card
        const wrapper = svg.parentElement;
        const marks = [
          ...svg.querySelectorAll('.curve-dot'),
          ...wrapper.querySelectorAll(':scope > .fv-knob'),
          ...wrapper.querySelectorAll(':scope > .fv-bubble'),
        ];
        for (const mark of marks) {
          const r = mark.getBoundingClientRect();
          if (r.top < box.top - 0.5 || r.bottom > box.bottom + 8.5)
            wrong.push(
              `${name}: ${mark.getAttribute('class')} leaves the chart's room (${r.top.toFixed(1)}…${r.bottom.toFixed(1)} of ${box.top.toFixed(1)}…${box.bottom.toFixed(1)})`,
            );
          if (shell && (r.left < shell.left - 0.5 || r.right > shell.right + 0.5))
            wrong.push(`${name}: ${mark.getAttribute('class')} leaves the card`);
        }
        // the scale: its labels right-aligned on one column, 8 before the plot
        const ticks = [...svg.querySelectorAll('.fc-tick')].map(
          (t) => t.getBoundingClientRect().right,
        );
        if (ticks.length && Math.max(...ticks) - Math.min(...ticks) > 0.75)
          wrong.push(
            `${name}: the ticks are not on one column (${ticks.map((t) => t.toFixed(1)).join(' ')})`,
          );
        const left = ticks.length ? Number(svg.querySelector('.fc-tick').getAttribute('x')) + 8 : 0;
        // a style's bubble stays inside the plot; the classic one leans into the card's padding, inside the card
        const classic =
          !svg.classList.contains('fc-chart') ||
          ![...svg.classList].some((c) => c.startsWith('fc-chart--'));
        for (const bubble of wrapper.querySelectorAll(':scope > .fv-bubble')) {
          const r = bubble.getBoundingClientRect();
          const from = classic ? (shell?.left ?? box.left) : box.left + left;
          const to = classic ? (shell?.right ?? box.right) : box.right;
          if (r.left < from - 0.5 || r.right > to + 0.5)
            wrong.push(
              `${name}: the bubble ${r.left.toFixed(1)}…${r.right.toFixed(1)} leaves ${from.toFixed(1)}…${to.toFixed(1)}`,
            );
        }
        // the axis under it: the first label on the plot's start, the last ending on its end
        const axis = wrapper.parentElement?.querySelector(':scope .fv-axis');
        if (axis && axis.children.length) {
          const a = axis.getBoundingClientRect();
          const first = axis.firstElementChild.getBoundingClientRect();
          const last = axis.lastElementChild.getBoundingClientRect();
          if (Math.abs(a.left - (box.left + left)) > 0.75)
            wrong.push(
              `${name}: the axis starts at ${a.left.toFixed(1)}, the plot at ${(box.left + left).toFixed(1)}`,
            );
          if (Math.abs(first.left - a.left) > 0.75 || Math.abs(last.right - a.right) > 0.75)
            wrong.push(`${name}: the axis's ends are not flush`);
        }
      }
    }
    return { charts, wrong };
  });

/* ---------- every style, both modes: nothing leaves the plot, text placed by rule ---------- */
for (const mode of ['light', 'dark']) {
  const page = await suite.sheet('chart-styles', { extra: mode === 'dark' ? '&mode=dark' : '' });
  const { charts, wrong } = await audit(page);
  check(
    `${mode}: ${charts} charts — nothing leaves its plot, every mark whole, every word placed by rule`,
    charts >= 30 && wrong.length === 0,
    wrong.slice(0, 6).join(' | '),
  );
  // the house's soft style over every card that says none: the same rules hold
  await page.close();
  const soft = await suite.sheet('chart-styles', {
    extra: `${mode === 'dark' ? '&mode=dark' : ''}&charts=${encodeURIComponent('{"style":"soft","grid":"dashed","endpoint":"dot","bubble":"tone"}')}`,
  });
  const house = await audit(soft);
  const tiles = await frame(soft, 'Tiles · classic and minimal')
    .locator('fluvy-sensor-card')
    .first()
    .evaluate((card) => card.shadowRoot.querySelectorAll('.am-spark .curve-line').length);
  check(
    `${mode}, the house in soft: every rule holds, and a card that says classic keeps it`,
    house.wrong.length === 0 && tiles === 1,
    house.wrong.slice(0, 4).join(' | '),
  );
  await soft.close();
}

/* ---------- the forecast: the knob at now, the forecast dashed ---------- */
{
  const page = await suite.sheet('chart-styles');
  const sample = frame(page, 'Forecast · soft').locator('pg-chart-sample').first();
  const now = await sample.evaluate((card) => {
    const svg = card.shadowRoot.querySelector('svg.fc-chart');
    const box = svg.getBoundingClientRect();
    const line = svg.querySelector('.fc-now');
    const knob = card.shadowRoot.querySelector('.fv-knob').getBoundingClientRect();
    const future = svg.querySelector('.fc-future');
    return {
      line: box.left + Number(line.getAttribute('x1')),
      knob: knob.left + knob.width / 2,
      knobs: card.shadowRoot.querySelectorAll('.fv-knob').length,
      starts: Number(/^M([\d.]+)/.exec(future.getAttribute('d'))?.[1]) + box.left,
      dashes: getComputedStyle(future).strokeDasharray,
    };
  });
  check(
    'soft: one knob, Fluvy’s, centred on now’s hairline',
    now.knobs === 1 && Math.abs(now.knob - now.line) < 0.6,
    JSON.stringify(now),
  );
  check(
    'soft: the forecast starts at now, dashed 4 · 5',
    Math.abs(now.starts - now.line) < 0.6 && /^4(px)?,?\s*5(px)?$/.test(now.dashes),
    JSON.stringify(now),
  );
  const hollow = await frame(page, 'Forecast · bars')
    .locator('pg-chart-sample')
    .first()
    .evaluate((card) => card.shadowRoot.querySelectorAll('.fc-bar--hollow').length);
  check(
    'bars: the forecast’s bars are hollow (the last third of the day)',
    hollow === 16,
    String(hollow),
  );

  /* ---------- reading by pointing, then by keys ---------- */
  const chart = sample.locator('.pg-chart');
  // a pointer reaches what is on screen: the frame is brought into view first
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + 80);
  await settle(page, 150);
  const read = await sample.evaluate((card) => {
    const bubble = card.shadowRoot.querySelector('.fv-bubble');
    const cursor = card.shadowRoot.querySelector('.fc-cursor');
    const svg = card.shadowRoot.querySelector('svg.fc-chart').getBoundingClientRect();
    const b = bubble.getBoundingClientRect();
    return {
      time: bubble.querySelector('.fv-bubble__time')?.textContent ?? '',
      cursor: cursor ? svg.left + Number(cursor.getAttribute('x1')) : null,
      centre: b.left + b.width / 2,
    };
  });
  check(
    'pointing at a quarter of the day: the cursor is there, the bubble centred on it says when',
    read.time === '06:00' &&
      read.cursor !== null &&
      Math.abs(read.cursor - (box.x + box.width * 0.25)) < 1 &&
      Math.abs(read.centre - read.cursor) < 1,
    JSON.stringify(read),
  );
  await page.mouse.move(0, 0);
  await chart.focus();
  const cursorAt = () =>
    sample.evaluate((card) => {
      const cursor = card.shadowRoot.querySelector('.fc-cursor');
      return cursor ? Number(cursor.getAttribute('x1')) : null;
    });
  await page.keyboard.press('ArrowLeft');
  await settle(page, 100);
  const left = await cursorAt();
  await page.keyboard.press('Home');
  await settle(page, 100);
  const home = await cursorAt();
  await page.keyboard.press('Escape');
  await settle(page, 100);
  const gone = await cursorAt();
  check(
    'the keys read it: ← a step back from now’s end, Home its start, Escape lets it go',
    left !== null && Math.abs(left - box.width * 0.98) < 1 && home === 0 && gone === null,
    JSON.stringify({ left, home, gone, width: box.width }),
  );

  /* the sensor reads the same way: its knob and its bubble follow the pointer */
  const soft = frame(page, 'Style · soft').locator('fluvy-sensor-card').first();
  await soft.locator('.am-chart').scrollIntoViewIfNeeded();
  const plot = await soft.locator('.am-chart').boundingBox();
  await page.mouse.move(plot.x + plot.width / 2, plot.y + 80);
  await settle(page, 150);
  const sensor = await soft.evaluate((card) => {
    const knob = card.shadowRoot.querySelector('.am-chart .fv-knob').getBoundingClientRect();
    return {
      knob: knob.left + knob.width / 2,
      time: card.shadowRoot.querySelector('.am-chart .fv-bubble__time')?.textContent ?? '',
    };
  });
  check(
    'the sensor in soft: read at its middle, the knob moves there and the bubble says when',
    Math.abs(sensor.knob - (plot.x + plot.width / 2)) < 1 && /\d{2}:\d{2}/.test(sensor.time),
    JSON.stringify(sensor),
  );
  await page.close();
}

/* ---------- no flash: the built bundle, the engine's chunk 1.5 s late ---------- */
{
  const FRONTEND = join(ROOT, 'custom_components', 'fluvy', 'frontend');
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end(
        '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body><div id="stage" style="width:360px"></div><script type="module" src="/fluvy.js"></script></body></html>',
      );
      return;
    }
    try {
      const body = await readFile(
        join(FRONTEND, normalize(url.pathname).replace(/^(\.\.[/\\])+/, '')),
      );
      response.writeHead(200, {
        'content-type':
          extname(url.pathname) === '.js' ? 'text/javascript' : 'application/octet-stream',
      });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const page = await suite.browser.newPage({ viewport: { width: 600, height: 600 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await page.route(/\/chunks\/chart-[\w-]{8}\.js$/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => customElements.get('fluvy-sensor-card') !== undefined);
  const seen = await page.evaluate(
    (values) =>
      new Promise((resolve) => {
        const card = document.createElement('fluvy-sensor-card');
        card.setConfig({ type: 'custom:fluvy-sensor-card', entity: 'sensor.room' });
        card.hass = {
          language: 'en',
          locale: { language: 'en', number_format: 'language', time_format: '24' },
          config: {},
          themes: { darkMode: false },
          entities: {},
          devices: {},
          areas: {},
          localize: (key) => key,
          states: {
            'sensor.room': {
              entity_id: 'sensor.room',
              state: String(values[values.length - 1]),
              attributes: {
                friendly_name: 'Room',
                unit_of_measurement: '°C',
                device_class: 'temperature',
              },
              last_changed: '',
              last_updated: '',
            },
          },
          callWS: async (message) => {
            const start = Date.parse(message.start_time);
            const end = Date.parse(message.end_time);
            return {
              'sensor.room': values.map((v, i) => ({
                s: String(v),
                lu: (start + ((i + 0.5) / 48) * (end - start)) / 1000,
              })),
            };
          },
          callService: async () => undefined,
        };
        document.querySelector('#stage').append(card);
        // every state the chart's room passes through, and every curve drawn into it
        const states = [];
        let curves = 0;
        const look = () => {
          const room = card.shadowRoot?.querySelector('.am-chart');
          const state = !room
            ? 'none'
            : room.querySelector('.curve-line')
              ? 'curve'
              : room.querySelector('.fv-skeleton')
                ? 'skeleton'
                : 'empty';
          if (states[states.length - 1] !== state) states.push(state);
        };
        const watch = new MutationObserver((records) => {
          for (const record of records)
            for (const node of record.addedNodes)
              if (
                node.nodeType === 1 &&
                (node.matches?.('.curve-line') || node.querySelector?.('.curve-line'))
              )
                curves++;
          look();
        });
        const begin = () => {
          if (!card.shadowRoot) return requestAnimationFrame(begin);
          look();
          watch.observe(card.shadowRoot, { childList: true, subtree: true });
        };
        begin();
        setTimeout(() => {
          watch.disconnect();
          resolve({ states, curves });
        }, 2600);
      }),
    fixtures.inputs.TEMP,
  );
  check(
    'no flash: the skeleton stands until the engine lands 1.5 s late, then the curve, drawn once',
    JSON.stringify(seen.states.filter((s) => s !== 'none')) === '["skeleton","curve"]' &&
      seen.curves === 1 &&
      errors.length === 0,
    JSON.stringify({ ...seen, errors }),
  );
  await page.close();
  server.close();
}

await suite.finish();
