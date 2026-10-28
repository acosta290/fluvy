#!/usr/bin/env node
/**
 * Interaction tests for the web page card (#61) on the playground's `web` sheet: a page of the playground's own
 * origin loads into the plate (the skeleton goes, the frame shows) with Home Assistant's sandbox and no referrer;
 * every frame holds its declared height; the bare variant draws no card; the plate fills the screen and leaves it;
 * the automatic look follows the page's mode; a reload asks for the page again; a scale draws the page larger under
 * the plate; a half card gives its rounds up in order; a page asked for every minute is asked for again once the
 * minute has passed; Home Assistant's own iframe card pastes in; an http page kept back and a page still loading say
 * so clear of the rounds and whole, at every card width from half a section to a band, in every language.
 * Real cards on the playground's simulated hass. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5196/ node interactions-web.mjs
 */
import { everyLanguage } from './lib.mjs';
import { frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** The `n`th web page card of a frame. */
const card = (page, title, n = 0) => frame(page, title).locator('fluvy-web-card').nth(n);
/** What a card's plate shows: its frame's address and classes, whether the skeleton is still over it. */
const plate = (locator) =>
  locator.evaluate((el) => {
    const root = el.shadowRoot;
    const iframe = root.querySelector('iframe');
    return {
      src: iframe?.getAttribute('src') ?? null,
      sandbox: iframe?.getAttribute('sandbox') ?? null,
      referrer: iframe?.getAttribute('referrerpolicy') ?? null,
      on: iframe?.classList.contains('is-on') ?? false,
      dark: iframe?.classList.contains('is-dark') ?? false,
      skeleton: Boolean(root.querySelector('.wb-skeleton')),
      surface: Boolean(root.querySelector('.fv-card')),
      height: Math.round(root.querySelector('[data-card]').getBoundingClientRect().height),
      declared: el.constructor.layoutHeight(el.config),
      rounds: [...root.querySelectorAll('.dv-cam__actions .fv-round')].map((b) =>
        b.getAttribute('aria-label'),
      ),
    };
  });

const page = await suite.sheet('web');

/* ---------- a page loads into the plate ---------- */
{
  const seen = await plate(card(page, 'Plate · 16:9'));
  check(
    'a same-origin page loads: the frame shows, the skeleton is gone',
    seen.on && !seen.skeleton && seen.src?.endsWith('/web/page.html'),
    JSON.stringify(seen),
  );
  check(
    'the frame carries Home Assistant’s own sandbox and sends no referrer',
    seen.sandbox ===
      'allow-forms allow-popups allow-pointer-lock allow-same-origin allow-scripts allow-modals allow-downloads' &&
      seen.referrer === 'no-referrer',
    JSON.stringify(seen),
  );
  const strict = await plate(card(page, 'Strict'));
  check(
    'the strict level keeps the page from its identity, pop-ups, modals and downloads',
    strict.sandbox === 'allow-forms allow-pointer-lock allow-scripts' && strict.on,
    JSON.stringify(strict),
  );
}

/* ---------- every frame holds its declared height ---------- */
{
  const held = [];
  for (const title of [
    'Plate · 16:9',
    'Frame',
    'Bare',
    '4:3 at 0.75',
    'Auto',
    'Strict',
    'Refresh 1',
    'Height 120',
    'Pasted',
  ]) {
    const seen = await plate(card(page, title));
    held.push(`${title}: ${seen.height} of ${seen.declared}`);
    check(`${title}: the card is its declared height`, seen.height === seen.declared, held.at(-1));
  }
}

/* ---------- the bare variant draws no card; the pasted iframe card is bare too ---------- */
{
  const bare = await plate(card(page, 'Bare'));
  const radius = await card(page, 'Bare').evaluate(
    (el) => getComputedStyle(el.shadowRoot.querySelector('.wb-plate')).borderRadius,
  );
  const framed = await plate(card(page, 'Frame'));
  check(
    'bare: no card surface, the plate with a card’s corners; frame and plate on a card',
    !bare.surface && radius === '20px' && framed.surface && bare.on,
    `${JSON.stringify(bare)} ${radius}`,
  );
  const pasted = await plate(card(page, 'Pasted'));
  check(
    'Home Assistant’s iframe card pastes in: hide_background is the bare plate, 50% its 2:1 shape',
    !pasted.surface && pasted.height === 180 && pasted.on,
    JSON.stringify(pasted),
  );
}

/* ---------- full screen is the plate’s own ---------- */
{
  const target = card(page, 'Plate · 16:9');
  await target.scrollIntoViewIfNeeded();
  await target.locator('.dv-cam__actions .fv-round').last().click();
  await settle(page, 500);
  const full = await target.evaluate((el) => ({
    place: el.shadowRoot.fullscreenElement?.className ?? null,
    labels: [...el.shadowRoot.querySelectorAll('.dv-cam__actions .fv-round')].map((b) =>
      b.getAttribute('aria-label'),
    ),
  }));
  check(
    'the full-screen round fills the screen with the plate, and says how to leave',
    full.place?.includes('wb-plate') && full.labels.at(-1) === 'Exit full screen',
    JSON.stringify(full),
  );
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
  await settle(page, 400);
  const left = await plate(target);
  check(
    'left, the round says full screen again',
    (await target.evaluate((el) => el.shadowRoot.fullscreenElement)) === null &&
      left.rounds.at(-1) === 'Full screen',
    JSON.stringify(left.rounds),
  );
}

/* ---------- a reload asks for the page again; the scale draws it larger under the plate ---------- */
{
  const target = card(page, '4:3 at 0.75');
  await target.scrollIntoViewIfNeeded();
  const before = await target.evaluate((el) => {
    const iframe = el.shadowRoot.querySelector('iframe');
    window.__firstFrame = iframe;
    return { generation: el.generation_, on: iframe.classList.contains('is-on') };
  });
  await target.locator('.dv-cam__actions .fv-round').first().click();
  await settle(page, 800);
  const after = await target.evaluate((el) => {
    const iframe = el.shadowRoot.querySelector('iframe');
    const box = el.shadowRoot.querySelector('.wb-plate');
    return {
      generation: el.generation_,
      fresh: iframe !== window.__firstFrame,
      on: iframe.classList.contains('is-on'),
      skeleton: Boolean(el.shadowRoot.querySelector('.wb-skeleton')),
      scale: iframe.style.transform,
      wide: Math.round(iframe.offsetWidth * 0.75) === box.clientWidth,
    };
  });
  check(
    'reload: a fresh frame, loaded again (a second load), its generation counted',
    before.on &&
      after.fresh &&
      after.on &&
      !after.skeleton &&
      after.generation === before.generation + 1,
    JSON.stringify({ before, after }),
  );
  check(
    'scale 0.75: the page is drawn a third wider under the plate and scaled to it',
    after.scale === 'scale(0.75)' && after.wide,
    JSON.stringify(after),
  );
}

/* ---------- a half card gives its rounds up in order ---------- */
{
  const narrow = await plate(card(page, 'Half pairs', 0));
  const bare = await plate(card(page, 'Half pairs · bare', 0));
  check(
    'a half card’s plate (132) holds open and full screen, its reload given up; a bare half (172) holds all three',
    narrow.rounds.join('|') === 'Open in a new tab|Full screen' &&
      bare.rounds.join('|') === 'Reload|Open in a new tab|Full screen',
    JSON.stringify({ narrow: narrow.rounds, bare: bare.rounds }),
  );
}

/* ---------- the dark look, and the automatic one with the page’s mode ---------- */
{
  const inverted = await plate(card(page, 'Dark', 0));
  const own = await plate(card(page, 'Dark', 1));
  const auto = await plate(card(page, 'Auto'));
  check(
    'light page: dark inverts, the page’s own does not, automatic follows the light card',
    inverted.dark && !own.dark && !auto.dark,
    JSON.stringify({ inverted: inverted.dark, own: own.dark, auto: auto.dark }),
  );
  const dark = await suite.sheet('web', { extra: '&mode=dark' });
  const autoDark = await plate(card(dark, 'Auto'));
  const ownDark = await plate(card(dark, 'Dark', 1));
  check(
    'dark page: automatic inverts the page, the page’s own still does not',
    autoDark.dark && !ownDark.dark,
    JSON.stringify({ auto: autoDark.dark, own: ownDark.dark }),
  );
  await dark.close();
}

/* ---------- a page asked for every minute is asked for again once the minute has passed ---------- */
{
  const timed = await suite.sheet('web', { clock: true });
  const target = card(timed, 'Refresh 1');
  await target.scrollIntoViewIfNeeded();
  await settle(timed, 600);
  const still = card(timed, 'Plate · 16:9');
  const before = await target.evaluate((el) => el.generation_);
  await timed.clock.runFor(30_000);
  const half = await target.evaluate((el) => el.generation_);
  await timed.clock.runFor(31_000);
  await settle(timed, 300);
  const after = await target.evaluate((el) => el.generation_);
  const other = await still.evaluate((el) => el.generation_);
  check(
    'refresh 1: the page is asked for again after a minute, not before; a card with no period never',
    before === 0 && half === 0 && after === 1 && other === 0,
    JSON.stringify({ before, half, after, other }),
  );
  await timed.close();
}

/* ---------- the states' words: clear of the rounds and whole, at every width, in every language ---------- */
{
  /**
   * Every insecure and slow card of a page: the words' and the glyph's boxes against the rounds' and the plate's —
   * a word under a round, past the plate's edge or past its own line is a fault — and what the plate kept of the state.
   */
  const states = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-frame*="/Insecure"], [data-frame*="/Slow"]')].flatMap(
        (frameEl) =>
          [...frameEl.querySelectorAll('fluvy-web-card')].map((el) => {
            const root = el.shadowRoot;
            const plate = root.querySelector('.wb-plate').getBoundingClientRect();
            const rounds = [...root.querySelectorAll('.dv-cam__actions .fv-round')].map((b) =>
              b.getBoundingClientRect(),
            );
            const range = document.createRange();
            const runs = [...root.querySelectorAll('.wb-state__words, .wb-state__open')].flatMap(
              (node) => {
                range.selectNodeContents(node);
                return [...range.getClientRects()].map((rect) => ({ node, rect }));
              },
            );
            const glyph = root.querySelector('.wb-state .fv-ico')?.getBoundingClientRect();
            const hit = (a, b) =>
              a.left < b.right - 0.5 &&
              b.left < a.right - 0.5 &&
              a.top < b.bottom - 0.5 &&
              b.top < a.bottom - 0.5;
            const inside = (a) =>
              a.left >= plate.left - 0.5 &&
              a.right <= plate.right + 0.5 &&
              a.top >= plate.top - 0.5 &&
              a.bottom <= plate.bottom + 0.5;
            const tops = runs.map(({ rect }) => rect.top);
            const boxes = [...runs.map(({ rect }) => rect), ...(glyph ? [glyph] : [])];
            return {
              frame: frameEl.dataset.frame.split('/').pop(),
              width: Math.round(plate.width),
              height: Math.round(plate.height),
              words: runs.map(({ node }) => node.textContent.trim()).join(' '),
              glyph: Boolean(glyph),
              under: boxes.some((box) => rounds.some((round) => hit(box, round))),
              out: boxes.some((box) => !inside(box)),
              wrapped: tops.length > 0 && Math.max(...tops) - Math.min(...tops) > 4,
            };
          }),
      ),
    );
  const faults = [];
  let seen = 0;
  let said = 0;
  // full cards at 211, 266, a 360 phone's 328, 360 and a band; half a section at 152 (a 320 section) and 172 (360)
  for (const lang of await everyLanguage())
    for (const width of [211, 266, 320, 328, 360, 1400]) {
      const page = await suite.sheet('web', { width, lang });
      for (const state of await states(page)) {
        seen += 1;
        if (state.words) said += 1;
        if (state.under || state.out || state.wrapped)
          faults.push(
            `${lang} @ ${width} ${state.frame} ${state.width}×${state.height}: ${JSON.stringify(state)}`,
          );
      }
      await page.close();
    }
  check(
    'kept back or still loading: the words and the globe never under a round, never past the plate, one line',
    faults.length === 0 && seen > 0,
    faults.slice(0, 6).join(' | ') || `${seen} plates, ${said} with words`,
  );
}

/* ---------- the states at a full card: the off plate's anatomy, the slow line with its link ---------- */
{
  const page = await suite.sheet('web');
  const seen = await frame(page, 'Insecure')
    .locator('fluvy-web-card')
    .first()
    .evaluate((el) => {
      const root = el.shadowRoot;
      return {
        words: root.querySelector('.wb-state__words')?.textContent.trim(),
        glyph: Boolean(root.querySelector('.wb-state .fv-ico--off')),
        frame: Boolean(root.querySelector('iframe')),
        rounds: [...root.querySelectorAll('.dv-cam__actions .fv-round')].map(
          (b) => `${b.getAttribute('aria-label')}${b.disabled ? ' (off)' : ''}`,
        ),
      };
    });
  check(
    'an http page on an https dashboard: no frame, the globe over why, the open round alone alive',
    !seen.frame &&
      seen.glyph &&
      seen.words === 'This page needs https' &&
      seen.rounds.join('|') === 'Reload (off)|Open in a new tab|Full screen (off)',
    JSON.stringify(seen),
  );
  const slow = await frame(page, 'Slow')
    .locator('fluvy-web-card')
    .first()
    .evaluate((el) => ({
      line: el.shadowRoot.querySelector('.wb-state__line')?.textContent.replace(/\s+/g, ' ').trim(),
      skeleton: Boolean(el.shadowRoot.querySelector('.wb-skeleton')),
    }));
  check(
    'still loading: the words over the skeleton, the tab offered on their line',
    slow.skeleton && slow.line === 'Still loading · Open in a new tab',
    JSON.stringify(slow),
  );
  await page.close();
}

await suite.finish();
