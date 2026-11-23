#!/usr/bin/env node
/**
 * The Compass card (1.23, #209), on the playground's `ambient` sheet (real cards, simulated hass). Exit code 1 on any
 * failure.
 *   PLAYGROUND=http://127.0.0.1:5186/ node interactions-compass.mjs
 * What it proves: the classic face by default (#247), its band with the ticks across it, its hairline, its letters 16
 * bold outside the band, beside 1.24's ring (`face: ring`) as tall; the bearing's arrow riding the band and the second
 * bearing's dot on it; the chevron in its ringed circle; the letters upright, north turned to `north_offset`; a car's
 * heading read from its tracker's attribute lights the ticks across it; a reading that changes moves the knob and its
 * words, 359.6° reading "N · 0°"; a weather entity's wind and the sun's azimuth are read on their own; a figure past a
 * threshold takes its band's colour and words; out of reach no pointer is drawn and "—" is read; in half a section the
 * reading stands under a ring that holds in its column; a tap on the head opens the sensor; and in every language
 * the points and the line under the figure are the language's and nothing is cut, a classic face's letters inside
 * their column at every width, outside the band where a size of theirs holds there, else in its place.
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
      // an arrow by the turn it is drawn at (wound past a whole turn where it went round), the distances from the centre
      // of its inner and its outer end on its own drawing, whether its tip (its first corner) is the outer one, whether
      // it is filled or its outline alone
      arrows: [...root.querySelectorAll('.cp-dial .cp-arrow')].map((a) => {
        const ys = a
          .getAttribute('d')
          .match(/-?[\d.]+/g)
          .map(Number)
          .filter((_, i) => i % 2 === 1);
        const half = Number(a.closest('svg').getAttribute('width')) / 2;
        return {
          turned: parseFloat(a.style.rotate),
          inner: Math.round(half - Math.max(...ys)),
          outer: Math.round(half - Math.min(...ys)),
          outward: ys[0] === Math.min(...ys),
          second: a.classList.contains('is-second'),
          outline: getComputedStyle(a).fill === 'none',
          lifted: a.closest('svg').classList.contains('cp-lift'),
        };
      }),
      cleared: [...root.querySelectorAll('line.is-under')].map(
        (l) => polar(l.getBoundingClientRect()).bearing,
      ),
      covered: [...root.querySelectorAll('.cp-point.is-under')].map((t) => t.textContent.trim()),
      dots: [...root.querySelectorAll('circle.dl-current, circle.cp-dot')].map((d) => ({
        ...polar(d.getBoundingClientRect()),
        second: d.classList.contains('dl-current'),
      })),
      points: [...root.querySelectorAll('.cp-point')].map((t) => ({
        word: t.textContent.trim(),
        ...polar(t.getBoundingClientRect()),
        upright: !t.hasAttribute('transform') && getComputedStyle(t).rotate === 'none',
        size: parseFloat(getComputedStyle(t).fontSize),
        large: t.classList.contains('is-large'),
      })),
      // a classic face's band (its middle and its width; a path where letters stand in its place) and hairline
      band: (() => {
        const band = root.querySelector('.cp-band');
        if (!band) return null;
        return {
          arcs: band.tagName.toLowerCase() === 'path',
          middle: Number(band.getAttribute('r') ?? 0),
          width: parseFloat(getComputedStyle(band).strokeWidth),
        };
      })(),
      hairline: Number(root.querySelector('.cp-line')?.getAttribute('r') ?? 0),
      chevrons: [...root.querySelectorAll('.cp-dial .cp-chevron')].map((g) => ({
        turned: parseFloat(g.style.rotate),
        second: g.classList.contains('is-second'),
        lifted: g.closest('svg').classList.contains('cp-lift'),
      })),
      lit: [...root.querySelectorAll('line.tk-on')].map(
        (l) => polar(l.getBoundingClientRect()).bearing,
      ),
      label: root
        .querySelector('.fv-dial__label-in, :is(.cp-under, .cp-reading) .fv-readout__label')
        ?.textContent.trim(),
      figure: root
        .querySelector('.fv-dial__value, :is(.cp-under, .cp-reading) .fv-readout__value')
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
    'a classic face (#247, the default): the band 12 wide, its middle at 92 (R 96), the hairline at 81 round the open centre',
    d.band?.middle === 92 && d.band.width === 12 && !d.band.arcs && d.hairline === 81,
    JSON.stringify({ band: d.band, hairline: d.hairline }),
  );
  check(
    'the arrow riding the band at 248° (from 12 inside its middle to 23 outside, as long as the knob is wide), pointing out, filled, lifted, the tick under it cleared; the 10-minute average’s dot on the band at 236°, the ticks round it cleared',
    d.box === 240 &&
      d.knobs.length === 0 &&
      d.arrows.length === 1 &&
      d.arrows[0].turned === 248 &&
      d.arrows[0].inner === 80 &&
      d.arrows[0].outer === 115 &&
      d.arrows[0].outward &&
      !d.arrows[0].outline &&
      d.arrows[0].lifted &&
      d.cleared.length === 3 &&
      d.cleared.every((bearing) => near(bearing, 248, 3) || near(bearing, 236, 5)) &&
      d.dots.length === 1 &&
      d.dots[0].second &&
      near(d.dots[0].bearing, 236, 2) &&
      d.dots[0].distance === 92,
    JSON.stringify({ arrows: d.arrows, cleared: d.cleared, dots: d.dots }),
  );
  check(
    'the four points 16 bold outside the band, north at the top, upright, north and south 5 clear of the band (their capitals centred at 109)',
    d.points.map((p) => p.word).join() === 'N,E,S,W' &&
      d.points.every((p, i) => near(p.bearing, i * 90) && p.upright && p.large && p.size === 16) &&
      Math.abs(d.points[0].distance - 109) <= 1 &&
      Math.abs(d.points[2].distance - 109) <= 1 &&
      d.covered.length === 0,
    JSON.stringify(d.points),
  );

  // the wind turns: the arrow and its words follow, the short way round; 359.6° is north, 0°
  await page.evaluate(() => window.fluvyMock.set('sensor.am_wind_bearing', '359.6'));
  await page.waitForTimeout(300);
  const north = await drawn(card);
  check(
    'the wind turning to 359.6° turns the arrow to the top, 111.6° clockwise, and reads "N · 0°", never 360°; the arrow stands on north’s letter, which gives way',
    north.line === 'N · 0°' &&
      Math.abs(north.arrows[0].turned - 359.6) < 0.01 &&
      north.covered.join() === 'N',
    JSON.stringify({ line: north.line, arrows: north.arrows, covered: north.covered }),
  );
  await page.evaluate(() => window.fluvyMock.set('sensor.am_wind_bearing', 'nne'));
  await page.waitForTimeout(300);
  const nne = await drawn(card);
  check(
    'a direction in English’s letters, in any case: NNE, at 22.5°, the arrow on through north (382.5°), never back across the ring',
    nne.line === 'NNE · 23°' && nne.arrows[0].turned === 382.5,
    JSON.stringify({ line: nne.line, arrows: nne.arrows }),
  );
  // where it settles: the arrow's drawing at the bearing once its turn is over
  await page.waitForTimeout(900);
  const settled = await card.evaluate((c) => {
    const box = c.shadowRoot.querySelector('.cp-arrow').getBoundingClientRect();
    const ring = c.shadowRoot.querySelector('.cp-dial').getBoundingClientRect();
    const [x, y] = [
      box.left + box.width / 2 - ring.left - ring.width / 2,
      box.top + box.height / 2 - ring.top - ring.height / 2,
    ];
    return ((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360;
  });
  check('once turned, the arrow stands at 22.5°', near(settled, 22.5, 3), String(settled));

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
      sun.arrows[0]?.turned === 291.4,
    JSON.stringify(sun),
  );
  const car = await drawn(compass(page, 'Compass · a car’s heading'));
  check(
    'a car’s heading from its tracker’s attribute: the ticks lit across 47°, no knob, no arrow',
    car.knobs.length === 0 &&
      car.arrows.length === 0 &&
      car.lit.length === 3 &&
      car.lit.every((bearing) => near(bearing, 47, 11.25)) &&
      car.line === 'NE · 47°',
    JSON.stringify(car),
  );
  const balcony = await drawn(compass(page, 'Compass · a weather entity on a balcony facing east'));
  const at = (word) => balcony.points.find((p) => p.word === word);
  check(
    'a weather entity’s wind on a balcony facing east: north on the left, east at the top, upright; the wind at 315° drawn at 225°, the sun’s knob under it in the secondary ink',
    balcony.figure === '12km/h' &&
      balcony.line === 'NW · 315°' &&
      near(at('N').bearing, 270) &&
      near(at('E').bearing, 0) &&
      balcony.points.every((p) => p.upright) &&
      balcony.knobs.length === 1 &&
      balcony.knobs[0].tone === 'fv-knob--neutral' &&
      near(balcony.knobs[0].bearing, 201.4) &&
      balcony.arrows.length === 1 &&
      balcony.arrows[0].turned === 225,
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
      gone.arrows.length === 0 &&
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
    halves.every((h) => h.under && h.box <= h.column) &&
      // R 40: the arrow in a small dial's 28 knob's place on the band's middle (39), from 9.3 inside it to 17.9 outside
      halves[0].arrows.length === 1 &&
      halves[0].arrows[0].inner === 30 &&
      halves[0].arrows[0].outer === 57 &&
      halves[0].figure === '14.2km/h' &&
      halves[1].line === 'NE · 47°',
    JSON.stringify(
      halves.map(({ box, column, under, figure, line }) => ({ box, column, under, figure, line })),
    ),
  );
  await page.close();
}

/* ---------- its four pointers ---------- */
{
  const page = await suite.sheet('ambient', { width: 760 });
  const [garden, balcony, car, sun] = await Promise.all(
    [0, 1, 2, 3].map((n) => drawn(compass(page, 'Compass · four pointers', n))),
  );
  check(
    'four pointers: the arrow and under it the second’s, its outline alone, flat; the knob; the lit ticks; the dot',
    garden.arrows.length === 2 &&
      garden.arrows[0].second &&
      !garden.arrows[0].lifted &&
      garden.arrows[0].turned === 236 &&
      garden.arrows[0].outline &&
      !garden.arrows[1].outline &&
      garden.arrows[1].lifted &&
      garden.dots.length === 0 &&
      balcony.knobs.length === 1 &&
      balcony.arrows.length === 0 &&
      car.lit.length === 3 &&
      car.arrows.length === 0 &&
      sun.dots.length === 1 &&
      !sun.dots[0].second &&
      sun.arrows.length + sun.knobs.length === 0,
    JSON.stringify({ garden, balcony: balcony.knobs, car: car.lit, sun: sun.dots }),
  );
  check(
    'pointing out by default, the second’s with the first',
    garden.arrows.every((arrow) => arrow.outward),
    JSON.stringify(garden.arrows),
  );
  const inward = await Promise.all(
    [0, 1].map((n) => drawn(compass(page, 'Compass · arrow inward', n))),
  );
  check(
    'arrow_points: inward turns both arrows, the same head the other way round: its tip 12 inside the band’s middle',
    inward[0].arrows.length === 2 &&
      inward.every(({ arrows }) =>
        arrows.every((arrow) => !arrow.outward && arrow.inner === 80 && arrow.outer === 115),
      ) &&
      inward[0].arrows[0].outline &&
      inward[1].arrows[0].turned === 291.4,
    JSON.stringify(inward.map(({ arrows }) => arrows)),
  );
  await page.close();
}

/* ---------- its other layouts: compact and the row ---------- */
{
  const page = await suite.sheet('ambient', { width: 360 });
  const compact = compass(page, 'Compass · compact');
  await compact.scrollIntoViewIfNeeded();
  const laid = await compact.evaluate((c) => {
    const root = c.shadowRoot;
    const box = (selector) => root.querySelector(selector)?.getBoundingClientRect();
    const [ring, reading, card] = [box('.cp-dial'), box('.cp-reading'), box('.fv-card')];
    return {
      ring: Math.round(ring.width),
      gap: Math.round(reading.left - ring.right),
      ringLeft: Math.round(ring.left - card.left),
      middle: Math.abs(ring.top + ring.height / 2 - (reading.top + reading.height / 2)),
      height: Math.round(card.height),
      xs: root.querySelectorAll('.so-cols .fv-readout--xs').length,
    };
  });
  const words = await drawn(compact);
  check(
    'compact: a 104 ring at the column’s start, its figure 16 beside it, centred on it, the readouts at the extra-small size, 260 tall',
    laid.ring === 104 &&
      laid.gap === 16 &&
      laid.ringLeft === 20 &&
      laid.middle < 1 &&
      laid.xs === 3 &&
      laid.height === 260 &&
      words.figure === '14.2km/h' &&
      words.line === 'WSW · 248°' &&
      words.arrows.length === 1,
    JSON.stringify({ laid, words }),
  );
  const halves = await Promise.all(
    [0, 1].map((n) => drawn(compass(page, 'Compass · compact · half a section', n))),
  );
  check(
    'compact in half a section: the figure under its ring, which holds in its column',
    halves.every((h) => h.under && h.box <= h.column),
    JSON.stringify(halves.map(({ box, column, under }) => ({ box, column, under }))),
  );

  const rows = frame(page, 'Compass · rows');
  const strips = await rows.locator('fluvy-compass-card').evaluateAll((cards) =>
    cards.map((c) => {
      const root = c.shadowRoot;
      const card = root.querySelector('.fv-card').getBoundingClientRect();
      const ringed = root.querySelector('.cp-ringed');
      return {
        height: Math.round(card.height),
        ringed: ringed !== null,
        line: root.querySelector('.fv-row__sub').textContent.trim(),
        arc: root.querySelector('.cp-arc') !== null,
        arrow: root.querySelector('.cp-ringed .cp-arrow:not(.is-second)') !== null,
        tone: ringed ? [...ringed.classList].find((n) => n.startsWith('fv-tone--')) : '',
        cut: [...root.querySelectorAll('.fv-row__sub')].some(
          (el) => el.scrollWidth > el.clientWidth + 1,
        ),
      };
    }),
  );
  check(
    'rows in half a section: 76 each, the circle ringed by the bearing (the wind’s by its arrow), the figure kept whole, the point left to the ring where the line runs short, the pier past its warning in its colour',
    strips.length === 4 &&
      strips.every((s) => s.height === 76 && s.ringed && !s.cut) &&
      strips[0].arrow &&
      strips[0].line.startsWith('14.2 km/h') &&
      strips[2].arc &&
      strips[2].tone === 'fv-tone--warning' &&
      strips[3].line === '291° · WNW',
    JSON.stringify(strips),
  );
  await reset(page);
  const row = compass(page, 'Compass · a row in a section');
  await row.scrollIntoViewIfNeeded();
  const whole = await row.evaluate((c) =>
    c.shadowRoot.querySelector('.fv-row__sub').textContent.trim(),
  );
  await row.locator('.fv-tile__tap').click();
  check(
    'a row in a section says its figure, its point and its degrees; a tap on it opens the wind sensor',
    whole === '14.2 km/h · WSW · 248°' &&
      JSON.stringify(await moreInfo(page)) === '["sensor.am_wind_speed"]',
    `${whole} ${JSON.stringify(await moreInfo(page))}`,
  );
  await page.close();
}

/* ---------- the classic face beside 1.24's ring, the chevron ---------- */
{
  const page = await suite.sheet('ambient', { width: 760 });
  const [classic, ring] = await Promise.all(
    [0, 1].map((n) => drawn(compass(page, 'Compass · classic and ring', n))),
  );
  const heights = await frame(page, 'Compass · classic and ring')
    .locator('fluvy-compass-card')
    .evaluateAll((cards) =>
      cards.map((c) =>
        Math.round(c.shadowRoot.querySelector('.fv-card').getBoundingClientRect().height),
      ),
    );
  check(
    'face: ring keeps 1.24’s look beside the classic face, as tall: no band, its letters 11 in their ticks’ place at 102, its dot outside the ticks',
    classic.band !== null &&
      ring.band === null &&
      ring.hairline === 0 &&
      ring.points.every((p) => p.distance === 102 && !p.large && p.size === 11) &&
      ring.dots[0]?.distance === 114 &&
      ring.arrows[0]?.inner === 84 &&
      heights[0] === heights[1],
    JSON.stringify({ ring: ring.points, heights }),
  );
  const station = await drawn(compass(page, 'Compass · chevron'));
  check(
    'the chevron: a ringed circle riding the band at 248°, lifted, the 10-minute average’s under it, flat, turned to 236°; no arrow, no dot',
    station.chevrons.length === 2 &&
      station.chevrons[0].second &&
      !station.chevrons[0].lifted &&
      station.chevrons[0].turned === 236 &&
      !station.chevrons[1].second &&
      station.chevrons[1].lifted &&
      station.chevrons[1].turned === 248 &&
      station.arrows.length === 0 &&
      station.dots.length === 0,
    JSON.stringify(station.chevrons),
  );
  // the wind turns: the chevron follows the short way round, through north
  await page.evaluate(() => window.fluvyMock.set('sensor.am_wind_bearing', '10'));
  await page.waitForTimeout(300);
  const turned = await drawn(compass(page, 'Compass · chevron'));
  check(
    'the wind turning to 10° turns the chevron 122° clockwise through north (370°), never back across the ring',
    turned.chevrons[1]?.turned === 370,
    JSON.stringify(turned.chevrons),
  );
  await page.close();
}

/* ---------- every language: its points, nothing cut ---------- */
{
  const wrong = [];
  for (const lang of await everyLanguage()) {
    const page = await suite.sheet('ambient', { width: 360, lang });
    for (const title of [
      'Compass · a weather station',
      'Compass · half a section',
      'Compass · compact',
    ]) {
      const card = compass(page, title);
      const said = await card.evaluate((c) => {
        const root = c.shadowRoot;
        const cut = [
          ...root.querySelectorAll('.fv-dial__sub, .fv-dial__value, .fv-readout__value'),
        ].filter((el) => el.scrollWidth > el.clientWidth + 1).length;
        return {
          points: [...root.querySelectorAll('.cp-point')].map((t) => t.textContent.trim()),
          line: root.querySelector('.fv-dial__sub')?.textContent.trim(),
          cut,
        };
      });
      if (said.points.length !== 4 || said.points.some((p) => !p) || !said.line || said.cut)
        wrong.push(`${lang} ${title}: ${JSON.stringify(said)}`);
    }
    // a classic face's letters at every width: inside the card's column, outside the band where a size of theirs
    // holds there, else in its place (the band in arcs between them); never over the open centre's words
    for (const column of [266, 211, 172, 152]) {
      const cards = frame(page, `Compass · classic and ring at ${column}`).locator(
        'fluvy-compass-card',
      );
      const laid = await cards.first().evaluate((c) => {
        const root = c.shadowRoot;
        const card = root.querySelector('.fv-card').getBoundingClientRect();
        const dial = root.querySelector('.cp-dial').getBoundingClientRect();
        const [cx, cy] = [dial.left + dial.width / 2, dial.top + dial.height / 2];
        const band = root.querySelector('.cp-band');
        const outer =
          Number(band.getAttribute('r') ?? 0) + parseFloat(getComputedStyle(band).strokeWidth) / 2;
        const words = [...root.querySelectorAll('.fv-dial__disc p')].map((p) => {
          const range = document.createRange();
          range.selectNodeContents(p);
          return range.getBoundingClientRect();
        });
        const meets = (a, b) =>
          a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        return [...root.querySelectorAll('.cp-point')].map((t) => {
          const b = t.getBoundingClientRect();
          // the nearest the word's box comes to the ring's centre
          const near = Math.hypot(
            Math.max(b.left - cx, 0, cx - b.right),
            Math.max(b.top - cy, 0, cy - b.bottom),
          );
          return {
            word: t.textContent.trim(),
            large: t.classList.contains('is-large'),
            inside: b.left >= card.left + 20 - 0.5 && b.right <= card.right - 20 + 0.5,
            clear: !t.classList.contains('is-large') || near >= outer,
            over: words.some((w) => meets(w, b)),
            arcs: band.tagName.toLowerCase() === 'path',
          };
        });
      });
      const off = laid.filter(
        (l) =>
          !l.inside || !l.clear || l.over || (!l.large && !l.arcs) || l.large !== laid[0].large,
      );
      if (laid.length !== 4 || off.length)
        wrong.push(`${lang} classic at ${column}: ${JSON.stringify(laid)}`);
    }
    // a row's line, its figure first, is never cut: what does not hold leaves it whole
    const lines = await frame(page, 'Compass · rows')
      .locator('fluvy-compass-card')
      .evaluateAll((cards) =>
        cards.map((c) => {
          const sub = c.shadowRoot.querySelector('.fv-row__sub');
          return { line: sub.textContent.trim(), cut: sub.scrollWidth > sub.clientWidth + 1 };
        }),
      );
    if (lines.some((l) => l.cut || !l.line)) wrong.push(`${lang} rows: ${JSON.stringify(lines)}`);
    await page.close();
  }
  check(
    'in every language the four points and the line under the figure are said, a row’s line too, nothing cut; a classic face’s letters in their column at every width, outside the band together or in its place together, over no word',
    wrong.length === 0,
    wrong.join(' | '),
  );
}

await suite.finish();
