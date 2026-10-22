#!/usr/bin/env node
/**
 * Interaction tests for the Cameras card (#60): each tile's stills run only while that tile is on screen; a live tile's
 * stream is one element for its life (the same after a scroll away and back) and goes, its session with it, when the
 * card goes back to stills; `max_live` streams that many and no more; full screen is a tile's own; "Live" folds to its
 * dot on a half section's tiles and keeps its word from 211, on one line in every language; the head's round opens the
 * sheet, whose switch shows every camera live and back; a tile and a sheet's row open their camera's details.
 * Real cards on the playground's simulated hass. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-cameras.mjs
 */
import { frame, moreInfo, PAGE_INTERVALS, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** The card of a frame (the first, or the nth). */
const cardOf = (page, title, n = 0) => frame(page, title).locator('fluvy-cameras-card').nth(n);

/** Each tile's stills, by place: the two images' sources, joined. */
const stills = (card) =>
  card.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('[data-feed]')].map((feed) =>
      [...feed.querySelectorAll('.fv-plate__img')]
        .map((img) => img.getAttribute('src') ?? '')
        .join('|'),
    ),
  );

/* ---------- each tile's stills run while that tile is on screen ---------- */
{
  const page = await suite.page('sheet=cameras&width=360', {
    viewport: { width: 1400, height: 300 },
  });
  const card = cardOf(page, 'Cameras · five, one recording');
  await card.evaluate((el) => el.setConfig({ ...el.config, refresh: 1 }));
  // the first row of tiles in view, the third row below the fold
  await card.evaluate((el) => {
    const first = el.shadowRoot.querySelector('[data-cam="0"]');
    window.scrollBy(0, first.getBoundingClientRect().top - 80);
  });
  await page.waitForTimeout(800);
  const a = await stills(card);
  await page.waitForTimeout(2200);
  const b = await stills(card);
  const seen = await card.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('[data-feed]')].map((feed) => {
      const r = feed.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    }),
  );
  check(
    'cameras: a tile on screen fetches its stills, one below the fold fetches none',
    seen[0] && !seen[4] && a[0] !== b[0] && a[4] === b[4],
    JSON.stringify({ seen, last: [a[4], b[4]] }),
  );
  // brought into view, the last one starts
  await card.evaluate((el) =>
    el.shadowRoot.querySelector('[data-cam="4"]').scrollIntoView({ block: 'center' }),
  );
  await page.waitForTimeout(1600);
  const c = await stills(card);
  check('cameras: scrolled into view, the last tile fetches its stills too', c[4] !== '|', c[4]);
  const before = await page.evaluate(() => window.__intervals());
  await page.evaluate(() =>
    document.querySelectorAll('fluvy-cameras-card').forEach((el) => el.remove()),
  );
  await page.waitForTimeout(200);
  const left = await page.evaluate(() => window.__intervals());
  check(
    'cameras: removing the cards releases every tile’s loop',
    before > PAGE_INTERVALS && left === PAGE_INTERVALS,
    `${before} → ${left}`,
  );
  await page.close();
}

/* ---------- live tiles: `max_live`, one element a tile, released on stills ---------- */
{
  const page = await suite.sheet('cameras');
  const card = cardOf(page, 'Cameras · live, two at once');
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const streams = () =>
    card.evaluate((el) =>
      [...el.shadowRoot.querySelectorAll('[data-feed]')].map((feed) => {
        const stream = feed.querySelector('ha-camera-stream');
        if (stream && !stream.dataset.pg) stream.dataset.pg = String(Math.random());
        return stream?.dataset.pg ?? null;
      }),
    );
  const sessions = () => page.evaluate(() => ({ ...window.pgStreams }));
  const tagged = await streams();
  check(
    'cameras: `max_live: 2` streams the first two tiles, the other two keep to stills',
    tagged[0] !== null && tagged[1] !== null && tagged[2] === null && tagged[3] === null,
    JSON.stringify(tagged),
  );
  const opened = (await sessions()).connected;
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1200);
  const away = await card.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom < 0 || r.top > innerHeight;
  });
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const back = await streams();
  check(
    'cameras: scrolled away and back, each tile’s stream is the same element and no session was opened',
    away &&
      back[0] === tagged[0] &&
      back[1] === tagged[1] &&
      (await sessions()).connected === opened,
    JSON.stringify([tagged, back, opened, await sessions()]),
  );
  const closed = (await sessions()).disconnected;
  await card.evaluate((el) => el.setConfig({ ...el.config, camera_view: 'auto' }));
  await page.waitForTimeout(600);
  check(
    'cameras: back to stills, every stream element is gone and its session closed',
    (await card.locator('ha-camera-stream').count()) === 0 &&
      (await sessions()).disconnected === closed + 2,
    JSON.stringify(await sessions()),
  );
  const failing = cardOf(page, 'Cameras · a stream that fails');
  await failing.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  const pills = await failing.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('[data-feed]')].map((feed) => ({
      stream: Boolean(feed.querySelector('ha-camera-stream')),
      stills: feed.querySelectorAll('.fv-plate__img').length,
      failed: Boolean(feed.querySelector('.dv-cam__live.is-failed')),
    })),
  );
  check(
    'cameras: a tile whose stream cannot play gives way to its stills and says so, its neighbour streaming on',
    !pills[0].stream && pills[0].stills === 2 && pills[0].failed && pills[1].stream,
    JSON.stringify(pills),
  );
  // where "Live" folds to its dot (half a section's tiles), the line under the picture says it, short where it must
  for (const [width, lang] of [
    [360, 'en'],
    [360, 'de'],
    [360, 'fr'],
  ]) {
    const narrow = await suite.sheet('cameras', { width, lang });
    const card = cardOf(narrow, 'Cameras · a stream that fails');
    await card.scrollIntoViewIfNeeded();
    await narrow.waitForTimeout(900);
    const said = await card.evaluate((el) => {
      const status = el.shadowRoot.querySelector('[data-cam="0"] .cm-status');
      return {
        dot: el.shadowRoot
          .querySelector('[data-cam="0"] .dv-cam__live')
          .classList.contains('is-dot'),
        text: status.textContent.trim(),
        label: status.getAttribute('aria-label'),
        whole: status.scrollWidth <= status.clientWidth + 0.5,
      };
    });
    const words = {
      en: ['Stream unavailable', 'No stream'],
      de: ['Stream nicht verfügbar', 'Kein Stream'],
      fr: ['Flux indisponible', 'Pas de flux'],
    }[lang];
    check(
      `cameras: a tile whose stream cannot play says so on its line (${lang}, ${width})`,
      said.dot &&
        words.includes(said.text) &&
        said.whole &&
        (said.text === words[0] || said.label === words[0]),
      JSON.stringify(said),
    );
    await narrow.close();
  }
  await page.close();
}

/* ---------- full screen is a tile's own; a tile opens its camera's details ---------- */
{
  const page = await suite.sheet('cameras');
  const card = cardOf(page, 'Cameras · the mockup');
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
  await card.locator('[data-cam="1"] .dv-cam__actions .fv-round').click();
  await page.waitForTimeout(500);
  const full = await card.evaluate((el) => ({
    place: el.shadowRoot.fullscreenElement?.closest('[data-cam]')?.getAttribute('data-cam') ?? null,
    labels: [...el.shadowRoot.querySelectorAll('.dv-cam__actions .fv-round')].map((b) =>
      b.getAttribute('aria-label'),
    ),
  }));
  check(
    'cameras: a tile’s round fills the screen with that tile’s picture alone, and says how to leave',
    full.place === '1' &&
      full.labels[1] === 'Exit full screen' &&
      full.labels.filter((label) => label === 'Full screen').length === 3,
    JSON.stringify(full),
  );
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
  await page.waitForTimeout(400);
  check(
    'cameras: left, the round says full screen again',
    (await card.evaluate((el) => el.shadowRoot.fullscreenElement)) === null &&
      (await card
        .locator('[data-cam="1"] .dv-cam__actions .fv-round')
        .getAttribute('aria-label')) === 'Full screen',
  );
  await reset(page);
  await card.locator('[data-cam="2"] > .fv-tile__tap').click();
  check(
    'cameras: a tap on a tile opens its camera’s details',
    (await moreInfo(page)).join() === 'camera.cm_terrace',
    JSON.stringify(await moreInfo(page)),
  );
  await page.close();
}

/* ---------- `aspect_ratio: native`: a row of cameras of their own shapes is level ---------- */
{
  const page = await suite.sheet('cameras', { width: 360 });
  const card = cardOf(page, 'Cameras · the mockup');
  await card.scrollIntoViewIfNeeded();
  await card.evaluate((el) => el.setConfig({ ...el.config, refresh: 0.5 }));
  // the garage a portrait doorbell (360 × 480) beside the terrace's 16:9, in the mockup's second row: its frame is
  // shown before the card asks for the cameras' own shapes, as a doorbell's would be
  await page.evaluate(() =>
    window.fluvyMock.set('camera.cm_garage', undefined, {
      entity_picture: `data:image/svg+xml,${encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480"><rect width="360" height="480" fill="#334"/></svg>',
      )}`,
    }),
  );
  await page.waitForTimeout(1200);
  await card.evaluate((el) => el.setConfig({ ...el.config, aspect_ratio: 'native' }));
  await page.waitForTimeout(800);
  const rows = await card.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('.cm-tile')].map((tile) => ({
      plate: tile.querySelector('.dv-cam').getBoundingClientRect().height,
      under: tile.querySelector('.cm-under').getBoundingClientRect().top,
    })),
  );
  const level = (a, b) => Math.abs(a.plate - b.plate) <= 0.5 && Math.abs(a.under - b.under) <= 0.5;
  check(
    'cameras: `native` levels a row of a 3:4 and a 16:9 camera at the 3:4, plates and rows under them',
    rows.length === 4 &&
      level(rows[0], rows[1]) &&
      level(rows[2], rows[3]) &&
      rows[2].plate > rows[0].plate + 40,
    JSON.stringify(rows),
  );
  await page.close();
}

/* ---------- the sheet: every camera, the switch for all of them live ---------- */
{
  const page = await suite.sheet('cameras');
  const card = cardOf(page, 'Cameras · the mockup');
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);
  await card.locator('.fv-card__head .fv-round').click();
  const dialog = card.locator('fluvy-cameras-sheet dialog');
  await dialog.waitFor();
  await page.waitForTimeout(500);
  check(
    'cameras: the head’s round opens the sheet, a row a camera',
    (await dialog.locator('.cm-row').count()) === 4,
  );
  const toggle = dialog.locator('[role="switch"]');
  check(
    'cameras: …its switch off while every tile shows stills',
    (await toggle.getAttribute('aria-checked')) === 'false',
  );
  await toggle.click();
  await page.waitForTimeout(600);
  check(
    'cameras: on, every tile streams (up to `max_live`), and the switch says so',
    (await card.locator('[data-feed] ha-camera-stream').count()) === 4 &&
      (await toggle.getAttribute('aria-checked')) === 'true',
  );
  await toggle.click();
  await page.waitForTimeout(600);
  check(
    'cameras: off again, every tile is back to stills',
    (await card.locator('[data-feed] ha-camera-stream').count()) === 0,
  );
  check(
    'cameras: the switch is never written to the card’s config',
    (await card.evaluate((el) => JSON.stringify(el.config))).includes('live') === false,
  );
  await reset(page);
  await dialog.locator('.cm-row').nth(1).locator('.fv-tile__tap').click();
  await page.waitForTimeout(400);
  check(
    'cameras: a row opens its camera’s details, the sheet stepping aside',
    (await moreInfo(page)).join() === 'camera.cm_garden' &&
      (await card.locator('fluvy-cameras-sheet dialog').count()) === 0,
    JSON.stringify(await moreInfo(page)),
  );
  await page.close();
}

/* ---------- "Live": its dot on half a section's tiles, its word from 211 ---------- */
{
  const folded = async (width, title) => {
    const page = await suite.sheet('cameras', { width });
    const card = cardOf(page, title);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    const out = await card.evaluate((el) => ({
      width: Math.round(el.getBoundingClientRect().width),
      dots: [
        ...el.shadowRoot.querySelectorAll('.cm-grid:not(.cm-grid--compact) .dv-cam__live'),
      ].map((live) => live.classList.contains('is-dot')),
    }));
    await page.close();
    return out;
  };
  const at152 = await folded(320, 'Cameras · half a section');
  const at172 = await folded(360, 'Cameras · half a section');
  const at211 = await folded(211, 'Cameras · one');
  check(
    'cameras: "Live" folds to its dot on half a section’s tiles (152, 172) and keeps its word at 211',
    at152.width === 152 &&
      at172.width === 172 &&
      at211.width === 211 &&
      at152.dots.length > 0 &&
      [...at152.dots, ...at172.dots].every(Boolean) &&
      at211.dots.length === 1 &&
      !at211.dots[0],
    JSON.stringify({ at152, at172, at211 }),
  );
}

/* ---------- "Live" in every language: one line, inside its pill, its dot whole ---------- */
{
  const pills = [];
  for (const lang of ['en', 'es', 'de', 'nl', 'fr', 'it', 'pt-BR', 'tr', 'ja']) {
    const page = await suite.sheet('cameras', { lang });
    const card = cardOf(page, 'Cameras · one');
    await card.scrollIntoViewIfNeeded();
    await settle(page, 700);
    const read = await card.evaluate((el) =>
      [...el.shadowRoot.querySelectorAll('.dv-cam__live:not(.is-dot)')].map((live) => ({
        h: Math.round(live.getBoundingClientRect().height),
        fits: live.scrollWidth <= live.clientWidth + 0.5,
        dot: Math.round(live.querySelector('i')?.getBoundingClientRect().width ?? 0),
      })),
    );
    pills.push({
      lang,
      ok: read.length === 1 && read.every((p) => p.h === 24 && p.fits && p.dot === 8),
    });
    await page.close();
  }
  check(
    'cameras: "Live" on one line inside its pill, its dot whole, in all nine languages',
    pills.every((p) => p.ok),
    JSON.stringify(pills),
  );
}

await suite.finish();
