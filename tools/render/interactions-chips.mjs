#!/usr/bin/env node
/**
 * The chips card's tabs on the playground's `chips` sheet (#241: real cards, simulated hass). Exit code 1 on any
 * failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-chips.mjs
 * What it proves: in a row that fills its line every tab's glyph and words stand in its middle (they sat 8 left), and a
 * tab whose words render nothing draws no box for them, its glyph alone in the middle; a glyph keeps its 20. A tab of
 * its icon alone draws no words, its name the button's, read aloud and shown under the pointer. A plain tab paints
 * nothing at rest, in the page's ink (the greeting's light ink on a deep colour), the open view keeping its pill; under
 * the pointer a wash of its ink, its words in the page's primary ink; a colour at rest is its glyph's and words' ink;
 * its 44 target and the keyboard's focus ring are the pill's.
 */
import { frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const page = await suite.sheet('chips');

/** Each tab of a card as drawn: its content's offset from its pill's middle, its glyph's width, its words, its paint. */
const tabsOf = (card) =>
  card.evaluate((host) =>
    [...host.shadowRoot.querySelectorAll('.fv-chip')].map((chip) => {
      const pill = chip.querySelector('.fv-chip__pill');
      const range = document.createRange();
      range.selectNodeContents(pill);
      const content = range.getBoundingClientRect();
      const box = pill.getBoundingClientRect();
      const style = getComputedStyle(pill);
      return {
        offset: content.left + content.width / 2 - (box.left + box.width / 2),
        glyph: pill.firstElementChild?.getBoundingClientRect().width ?? 0,
        words: chip.querySelector('.fv-chip__name')?.textContent ?? null,
        label: chip.getAttribute('aria-label'),
        title: chip.getAttribute('title'),
        active: chip.classList.contains('is-active'),
        background: style.backgroundColor,
        shadow: style.boxShadow,
        color: style.color,
        target: chip.getBoundingClientRect().height,
      };
    }),
  );
const cardsOf = (title) => frame(page, title).locator('fluvy-chips-card');
const CLEAR = 'rgba(0, 0, 0, 0)';

/* ---------- centred in a row that fills ---------- */
{
  const cards = cardsOf('Chips · centred, a wall’s header (#241)');
  for (const index of [0, 1]) {
    const tabs = await tabsOf(cards.nth(index));
    check(
      `a wall’s header, row ${index + 1}: every tab’s glyph and words in its middle (within half a pixel)`,
      tabs.length === 4 && tabs.every((tab) => Math.abs(tab.offset) <= 0.5),
      tabs.map((tab) => tab.offset.toFixed(1)).join(' '),
    );
    check(
      `a wall’s header, row ${index + 1}: every glyph keeps its 20`,
      tabs.every((tab) => Math.round(tab.glyph) === 20),
    );
  }
  const [, , door] = await tabsOf(cards.nth(0));
  check(
    'the shut door’s words render nothing: no box for them, the glyph alone',
    door?.words === null,
    JSON.stringify(door),
  );
}

/* ---------- its icon alone ---------- */
{
  const tabs = await tabsOf(cardsOf('Chips · icons alone (#241)').nth(0));
  check(
    'icons alone: no words, each tab’s name its button’s, said and shown under the pointer',
    tabs.length === 5 &&
      tabs.every((tab) => tab.words === null && tab.label && tab.label === tab.title) &&
      tabs[1]?.label === 'Lights',
    JSON.stringify(tabs.map(({ words, label }) => [words, label])),
  );
  check(
    'icons alone: each glyph in its middle, the row still filling',
    tabs.every((tab) => Math.abs(tab.offset) <= 0.5 && Math.round(tab.glyph) === 20),
  );
  const mixed = await tabsOf(cardsOf('Chips · icons alone (#241)').nth(2));
  check(
    'a tab’s own show_name: the readings and the door alone, the room named',
    mixed.map((tab) => tab.words).join('|') === '|||Bedroom',
    JSON.stringify(mixed.map((tab) => tab.words)),
  );
}

/* ---------- plain ---------- */
{
  const card = cardsOf('Chips · plain (#241)').nth(0);
  const tabs = await tabsOf(card);
  const [open, ...rest] = tabs;
  check(
    'plain: a tab at rest paints nothing, neither fill nor hairline',
    rest.length === 3 && rest.every((tab) => tab.background === CLEAR && tab.shadow === 'none'),
    JSON.stringify(rest.map(({ background, shadow }) => [background, shadow])),
  );
  check(
    'plain: the open view keeps its pill',
    open?.active === true && open.background !== CLEAR,
    JSON.stringify(open),
  );
  check(
    'plain: the target stays 44 tall',
    tabs.every((tab) => tab.target === 44),
  );
  // under the pointer: a wash of its ink, the words in the page's primary ink
  const living = card.locator('.fv-chip').nth(1);
  await living.hover();
  await settle(page);
  const [, hovered] = await tabsOf(card);
  check(
    'plain: under the pointer a wash of its ink and the primary ink',
    hovered?.background !== CLEAR && hovered?.color !== rest[0]?.color,
    `${hovered?.background} ${hovered?.color} (at rest ${rest[0]?.color})`,
  );
  await page.mouse.move(0, 0);
  // the keyboard's ring is drawn round the tab, its 2 px in the accent
  await living.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const ring = await living.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      width: style.outlineWidth,
      style: style.outlineStyle,
      focused: el.matches(':focus-visible'),
    };
  });
  check(
    'plain: the keyboard’s focus ring shows round the tab',
    ring.focused && ring.style === 'solid' && ring.width === '2px',
    JSON.stringify(ring),
  );
  // a colour at rest: its ink on the glyph and the words, no wash
  const tinted = await tabsOf(cardsOf('Chips · plain (#241)').nth(1));
  check(
    'plain with a colour at rest: the glyph in its colour, no wash',
    tinted.slice(1).every((tab) => tab.background === CLEAR) &&
      new Set(tinted.slice(1).map((tab) => tab.color)).size === 4,
    JSON.stringify(tinted.map((tab) => tab.color)),
  );
}

/* ---------- the page's light ink ---------- */
{
  const view = frame(page, 'Chips · plain on a deep colour (#241)');
  const tabs = await tabsOf(view.locator('fluvy-chips-card').nth(0));
  // the greeting's date: its line in the page's secondary ink
  const date = await view
    .locator('fluvy-hello-card')
    .evaluate((host) => getComputedStyle(host.shadowRoot.querySelector('.hm-hello__date')).color);
  check(
    'on a deep colour a plain tab takes the page’s light ink, as the greeting’s date does',
    tabs.length === 4 &&
      tabs.slice(1).every((tab) => tab.color === date && tab.background === CLEAR),
    `${tabs[1]?.color} (the date ${date})`,
  );
}

await suite.finish();
