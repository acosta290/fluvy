#!/usr/bin/env node
/**
 * The Compass card (1.23, #209), on the playground's `ambient` sheet (real cards, simulated hass). Exit code 1 on any
 * failure.
 *   PLAYGROUND=http://127.0.0.1:5186/ node interactions-compass.mjs
 * What it proves: the bearing's knob stands on the ring at its bearing and the second bearing's dot outside the ticks
 * at its own; the cardinal points stand in their ticks' place, upright, north turned to `north_offset`; a car's
 * heading read from its tracker's attribute lights the ticks across it; a reading that changes moves the knob and its
 * words, 359.6° reading "N · 0°"; a weather entity's wind and the sun's azimuth are read on their own; a figure past a
 * threshold takes its band's colour and words; out of reach no pointer is drawn and "—" is read; in half a section the
 * reading stands under a ring that holds in its column; a tap on the head opens the sensor; and in every language
 * the points and the line under the figure are the language's and nothing is cut.
 */
import { everyLanguage } from './lib.mjs';
import { frame, moreInfo, reset, startSuite, tapHead } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const compass = (page, title, n = 0) => frame(page, title).locator('fluvy-compass-card').nth(n);

/** Where the ring's parts stand, as bearings from its centre (0 at the top, clockwise) and distances. */
const drawn = (card) =>
  card.evaluate((c) => {
    const root = c.shadowRoot;
    const ring = root.querySelector('.cp-dial').getBoundingClientRect();
    const [cx, cy] = [ring.left + ring.width / 2, ring.top + ring.height / 2];
    const polar = (r) => {
      const [x, y] = [r.left + r.width / 2 - cx, r.top + r.height / 2 - cy];
      return {
        bearing: Math.round((((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360) * 10) / 10,
        distance: Math.round(Math.hypot(x, y)),
      };
    };
    return {
      box: ring.width,
      column: root.querySelector('.fv-card').getBoundingClientRect().width - 40,
      knobs: [...root.querySelectorAll('.fv-knob')].map((k) => ({
        ...polar(k.getBoundingClientRect()),
        size: Math.round(k.getBoundingClientRect().width),
        tone: [...k.classList].find((n) => n.startsWith('fv-knob--')),
      })),
      dots: [...root.querySelectorAll('circle.dl-current, circle.cp-dot')].map((d) => ({
        ...polar(d.getBoundingClientRect()),
        second: d.classList.contains('dl-current'),
      })),
      points: [...root.querySelectorAll('text.cp-point')].map((t) => ({
        word: t.textContent.trim(),
        ...polar(t.getBoundingClientRect()),
        upright: !t.hasAttribute('transform') && getComputedStyle(t).rotate === 'none',
      })),
      lit: [...root.querySelectorAll('line.tk-on')].map(
        (l) => polar(l.getBoundingClientRect()).bearing,
      ),
      label: root
        .querySelector('.fv-dial__label-in, .cp-under .fv-readout__label')
        ?.textContent.trim(),
      figure: root
        .querySelector('.fv-dial__value, .cp-under .fv-readout__value')
        ?.textContent.replace(/\s+/g, ''),
      line: root.querySelector('.fv-dial__sub')?.textContent.replace(/\s+/g, ' ').trim(),
      under: root.querySelector('.cp-under') !== null,
      badge: root.querySelector('.fv-badge')?.textContent.trim() ?? '',
    };
  });

const near = (a, b, within = 1.5) => Math.abs(((a - b + 540) % 360) - 180) <= within;

/* ---------- a weather station ---------- */
{
  const page = await suite.sheet('ambient', { width: 360 });
  const card = compass(page, 'Compass · a weather station');
  await card.scrollIntoViewIfNeeded();
  const d = await drawn(card);
  check(
    'its wind in the ring, the point and the degrees under it, no badge saying the direction again',
    d.label === 'Wind speed' &&
      d.figure === '14.2km/h' &&
      d.line === 'WSW · 248°' &&
      d.badge === '',
    JSON.stringify(d),
  );
  check(
    'the knob on the ring at 248° (R 96, the thermostat’s 36), the 10-minute average’s dot outside the ticks at 236°',
    d.box === 240 &&
      d.knobs.length === 1 &&
      near(d.knobs[0].bearing, 248) &&
      d.knobs[0].distance === 96 &&
      d.knobs[0].size === 36 &&
      d.dots.length === 1 &&
      d.dots[0].second &&
      near(d.dots[0].bearing, 236, 2) &&
      d.dots[0].distance === 114,
    JSON.stringify({ knobs: d.knobs, dots: d.dots }),
  );
  check(
    'the four points in their ticks’ place, north at the top, upright',
    d.points.map((p) => p.word).join() === 'N,E,S,W' &&
      d.points.every((p, i) => near(p.bearing, i * 90) && p.distance === 102 && p.upright),
    JSON.stringify(d.points),
  );

  // the wind turns: the knob and its words follow; 359.6° is north, 0°
  await page.evaluate(() => window.fluvyMock.set('sensor.am_wind_bearing', '359.6'));
  await page.waitForTimeout(300);
  const north = await drawn(card);
  check(
    'the wind turning to 359.6° moves the knob to the top and reads "N · 0°", never 360°',
    north.line === 'N · 0°' && near(north.knobs[0].bearing, 359.6),
    JSON.stringify({ line: north.line, knobs: north.knobs }),
  );
  await page.evaluate(() => window.fluvyMock.set('sensor.am_wind_bearing', 'nne'));
  await page.waitForTimeout(300);
  check(
    'a direction in English’s letters, in any case: NNE, at 22.5°',
    (await drawn(card)).line === 'NNE · 23°',
    (await drawn(card)).line,
  );

  await reset(page);
  await tapHead(card);
  check(
    'a tap on the head opens the wind sensor',
    JSON.stringify(await moreInfo(page)) === '["sensor.am_wind_speed"]',
    JSON.stringify(await moreInfo(page)),
  );
  await page.close();
}

/* ---------- the sun, a car, a balcony facing east, a pier past its warning ---------- */
{
  const page = await suite.sheet('ambient', { width: 360 });
  const sun = await drawn(compass(page, 'Compass · the sun'));
  check(
    'the sun: its azimuth is the figure, its point under it',
    sun.label === 'Azimuth' &&
      sun.figure === '291°' &&
      sun.line === 'WNW' &&
      near(sun.knobs[0].bearing, 291.4),
    JSON.stringify(sun),
  );
  const car = await drawn(compass(page, 'Compass · a car’s heading'));
  check(
    'a car’s heading from its tracker’s attribute: the ticks lit across 47°, no knob',
    car.knobs.length === 0 &&
      car.lit.length === 4 &&
      car.lit.every((bearing) => near(bearing, 47, 11.25)) &&
      car.line === 'NE · 47°',
    JSON.stringify(car),
  );
  const balcony = await drawn(compass(page, 'Compass · a weather entity on a balcony facing east'));
  const at = (word) => balcony.points.find((p) => p.word === word);
  check(
    'a weather entity’s wind on a balcony facing east: north on the left, east at the top, upright; the wind at 315° drawn at 225°, the sun’s knob in the secondary ink',
    balcony.figure === '12km/h' &&
      balcony.line === 'NW · 315°' &&
      near(at('N').bearing, 270) &&
      near(at('E').bearing, 0) &&
      balcony.points.every((p) => p.upright) &&
      balcony.knobs.length === 2 &&
      balcony.knobs[0].tone === 'fv-knob--neutral' &&
      near(balcony.knobs[1].bearing, 225),
    JSON.stringify(balcony),
  );
  const pier = compass(page, 'Compass · past its warning');
  const warned = await drawn(pier);
  const tone = await pier.evaluate((c) => ({
    dial: [...c.shadowRoot.querySelector('.cp-dial').classList].find((n) =>
      n.startsWith('fv-dial--w'),
    ),
    ink: c.shadowRoot.querySelector('.fv-dial__value').getAttribute('data-ink'),
  }));
  check(
    'a pier past its warning: its words in the badge, its figure and its lit ticks in the warning’s colour; its letters “wsw” read',
    warned.badge === 'Strong wind' &&
      tone.dial === 'fv-dial--warning' &&
      tone.ink === 'warning' &&
      warned.line === 'WSW · 248°',
    JSON.stringify({ warned, tone }),
  );
  await page.close();
}

/* ---------- out of reach, half a section ---------- */
{
  const page = await suite.sheet('ambient', { width: 360 });
  const gone = await drawn(compass(page, 'Compass · out of reach'));
  check(
    'out of reach: the ring and its points kept, no pointer, "—" for the figure and the point',
    gone.knobs.length === 0 &&
      gone.dots.length === 0 &&
      gone.points.length === 4 &&
      gone.figure === '—' &&
      gone.line === '—' &&
      gone.badge === 'Unavailable',
    JSON.stringify(gone),
  );
  const halves = await Promise.all(
    [0, 1].map((n) => drawn(compass(page, 'Compass · half a section', n))),
  );
  check(
    'half a section: the ring holds in its column, the reading stands under it',
    halves.every((h) => h.under && h.box <= h.column && h.knobs.every((k) => k.size === 28)) &&
      halves[0].figure === '14.2km/h' &&
      halves[1].line === 'NE · 47°',
    JSON.stringify(
      halves.map(({ box, column, under, figure, line }) => ({ box, column, under, figure, line })),
    ),
  );
  await page.close();
}

/* ---------- every language: its points, nothing cut ---------- */
{
  const wrong = [];
  for (const lang of await everyLanguage()) {
    const page = await suite.sheet('ambient', { width: 360, lang });
    for (const title of ['Compass · a weather station', 'Compass · half a section']) {
      const card = compass(page, title);
      const said = await card.evaluate((c) => {
        const root = c.shadowRoot;
        const cut = [
          ...root.querySelectorAll('.fv-dial__sub, .fv-dial__value, .fv-readout__value'),
        ].filter((el) => el.scrollWidth > el.clientWidth + 1).length;
        return {
          points: [...root.querySelectorAll('text.cp-point')].map((t) => t.textContent.trim()),
          line: root.querySelector('.fv-dial__sub')?.textContent.trim(),
          cut,
        };
      });
      if (said.points.length !== 4 || said.points.some((p) => !p) || !said.line || said.cut)
        wrong.push(`${lang} ${title}: ${JSON.stringify(said)}`);
    }
    await page.close();
  }
  check(
    'in every language the four points and the line under the figure are said, nothing cut',
    wrong.length === 0,
    wrong.join(' | '),
  );
}

await suite.finish();
