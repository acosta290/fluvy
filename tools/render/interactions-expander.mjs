#!/usr/bin/env node
/**
 * Interaction tests for the Expander card (#180) on the playground's `expander` sheet: folded it is its head, at
 * the height it declares; a tap opens it and builds its cards, which stand in the head's column on its surface —
 * a card of Fluvy's by its own padding turned out, a compact row by its 16, what stands on the page as it is, a
 * card of Home Assistant's without a surface — each under a hairline; the fold moves, and is at once under
 * reduced motion; folded again its cards leave the page; the keyboard opens and folds it; a head with a tap of its
 * own leaves the fold to a round; it opens by itself with its condition and folds with it; it hides while every
 * card it holds is hidden; it stands as it was left after a reload; its columns hold on a desktop and give way on a
 * phone; a held card draws what it declares. Real cards on the playground's simulated hass, Home Assistant's card
 * wrapper stood in for (`apps/playground/src/hui-card.ts`). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5217/ node interactions-expander.mjs
 */
import { frame, settle, startSuite, tapHead } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** The fold's motion, and a little more: what a card needs to come to rest. */
const REST = 400;

/** The `n`th expander of a frame (its own, not one it holds). */
const card = (page, title, n = 0) =>
  frame(page, title).locator(':scope > fluvy-expander-card').nth(n);

/** What an expander shows: whether it is open, how tall it stands and declares, what it holds, how its chevron points. */
const seen = (locator) =>
  locator.evaluate((el) => {
    const root = el.shadowRoot;
    const surface = root.querySelector('[data-card]');
    const button = root.querySelector('.fv-card__tap');
    const chevron = root.querySelector('.ex-turn svg');
    return {
      open: surface.classList.contains('is-open'),
      expanded: button?.getAttribute('aria-expanded') ?? null,
      inert: root.getElementById('cards').hasAttribute('inert'),
      height: Math.round(surface.getBoundingClientRect().height),
      declared: el.constructor.layoutHeight(el.config),
      held: [...el.children].map((child) => child.localName),
      shown: [...el.children].filter((child) => !child.hidden).length,
      hidden: el.hidden,
      // the chevron's turn, from its matrix's first column: 90 down, -90 up
      turn: chevron
        ? (([cos, sin]) => Math.round((Math.atan2(sin, cos) * 180) / Math.PI))(
            getComputedStyle(chevron)
              .transform.match(/-?[\d.e]+/g)
              .map(Number),
          )
        : null,
      target: button
        ? Math.round(
            parseFloat(getComputedStyle(button, '::after').height) ||
              button.getBoundingClientRect().height,
          )
        : 0,
    };
  });

/**
 * Where what an open expander holds stands against its head: the head's circle and chevron, each card's first box and
 * its content's edges, the hairlines; in px from the surface's start.
 */
const column = (locator) =>
  locator.evaluate((el) => {
    const root = el.shadowRoot;
    const surface = root.querySelector('[data-card]').getBoundingClientRect();
    const left = (node) => Math.round((node.getBoundingClientRect().left - surface.left) * 10) / 10;
    const right = (node) =>
      Math.round((surface.right - node.getBoundingClientRect().right) * 10) / 10;
    const circle = root.querySelector('.ex-head .fv-ico');
    return {
      circle: circle ? left(circle) : null,
      cards: [...el.children]
        .filter((child) => !child.hidden)
        .map((wrapper) => {
          const inner = wrapper.firstElementChild;
          // what the card draws at its root, and the first thing in it: a circle, a row's art, a tile
          const drawn =
            [...(inner?.shadowRoot?.children ?? [])].find((node) => node.tagName !== 'STYLE') ??
            inner;
          const first =
            inner?.shadowRoot?.querySelector('.fv-ico, .md-mini__row > :first-child, .fv-tile') ??
            drawn;
          const style = drawn ? getComputedStyle(drawn) : undefined;
          const rule = getComputedStyle(wrapper, '::before');
          return {
            tag: inner?.localName,
            other: wrapper.classList.contains('ex-other'),
            first: first ? left(first) : null,
            box: drawn ? [left(drawn), right(drawn)] : null,
            fill: style?.backgroundColor,
            firstFill: first ? getComputedStyle(first).backgroundColor : undefined,
            edge: style?.boxShadow,
            border: style?.borderTopWidth,
            height: drawn ? Math.round(drawn.getBoundingClientRect().height) : 0,
            rule: rule.content !== 'none' && parseFloat(rule.height) === 1,
          };
        }),
    };
  });

const transparent = (colour) => colour === 'rgba(0, 0, 0, 0)' || colour === 'transparent';

/* ---------- folded: the head, at the height it declares ---------- */
{
  const page = await suite.sheet('expander');
  for (const [title, n, declared] of [
    ['Garden · folded', 0, 84],
    ['Plain · folded', 0, 44],
    ['Seldom used · folded and open', 0, 84],
  ]) {
    const folded = await seen(card(page, title, n));
    check(
      `${title}: folded, the head alone, as tall as it declares (${declared})`,
      !folded.open &&
        folded.expanded === 'false' &&
        folded.inert &&
        folded.held.length === 0 &&
        folded.height === declared &&
        folded.declared === declared &&
        folded.turn === 90,
      JSON.stringify(folded),
    );
  }
  const head = await seen(card(page, 'Garden · folded'));
  const bare = await seen(card(page, 'Plain · folded'));
  check(
    'the head’s button is the whole folded card on its surface (84), the head’s row on the page (44)',
    head.target === 84 && bare.target === 44,
    `${head.target}, ${bare.target}`,
  );

  /* ---------- a tap opens it: its cards built, in the head's column ---------- */
  const garden = card(page, 'Garden · folded');
  await tapHead(garden);
  // the fold moves: part of the way after a third of its time
  await page.waitForTimeout(80);
  const moving = await seen(garden);
  await settle(page, REST);
  const open = await seen(garden);
  check(
    'a tap opens it: its three cards built by Home Assistant’s wrapper, the chevron turned up',
    open.open &&
      open.expanded === 'true' &&
      !open.inert &&
      open.held.join() === 'hui-card,hui-card,hui-card' &&
      open.turn === -90,
    JSON.stringify(open),
  );
  check(
    'the fold moves from the head to what it holds',
    moving.height > 84 && moving.height < open.height,
    `${moving.height} of ${open.height}`,
  );

  const laid = await column(card(page, 'Garden · open'));
  const [light, tiles, readouts] = laid.cards;
  check(
    'a card of Fluvy’s stands in the head’s column: its circle under the head’s, no surface of its own',
    laid.circle === 20 &&
      light.first === 20 &&
      light.box.join() === '0,0' &&
      transparent(light.fill) &&
      light.edge === 'none',
    JSON.stringify(light),
  );
  check(
    'what stands on the page stands in the column as it is: the tiles keep their place and their surface',
    tiles.box.join() === '20,20' &&
      tiles.first === 20 &&
      !transparent(tiles.firstFill) &&
      readouts.box.join() === '0,0',
    JSON.stringify([tiles, readouts]),
  );
  check(
    'a hairline stands over each card it holds',
    laid.cards.every((held) => held.rule),
    JSON.stringify(laid.cards.map((held) => held.rule)),
  );
  const media = await column(card(page, 'Media · Home Assistant’s cards'));
  const [player, entities, note] = media.cards;
  check(
    'a compact row turns out its own 16: the player’s art under the head’s circle',
    player.first === 20 && player.box.join() === '4,4' && transparent(player.fill),
    JSON.stringify(player),
  );
  check(
    'a card of Home Assistant’s wears no surface, and its 16 stands in the column',
    entities.other &&
      note.other &&
      transparent(entities.fill) &&
      entities.border === '0px' &&
      entities.box.join() === '4,4' &&
      note.box.join() === '4,4',
    JSON.stringify([entities, note]),
  );

  const plain = await column(card(page, 'Plain · open'));
  check(
    'a held card is as tall as on its own: the surface takes none of its size',
    plain.cards.every((own, index) => own.height === laid.cards[index].height),
    JSON.stringify([plain.cards.map((own) => own.height), laid.cards.map((held) => held.height)]),
  );
  check(
    'without a surface the cards keep theirs, and the head’s circle stands on the page’s edge',
    plain.circle === 0 &&
      plain.cards[0].box.join() === '0,0' &&
      !transparent(plain.cards[0].fill) &&
      plain.cards[0].edge !== 'none' &&
      plain.cards.every((held) => !held.rule),
    JSON.stringify(plain.cards[0]),
  );

  /* ---------- folded again: its cards leave once the fold has closed ---------- */
  await tapHead(garden);
  const folding = await seen(garden);
  await settle(page, REST);
  const folded = await seen(garden);
  check(
    'folding, its cards stay under the fold; folded, they have left the page',
    !folding.open &&
      folding.held.length === 3 &&
      folded.held.length === 0 &&
      folded.height === 84 &&
      folded.turn === 90,
    JSON.stringify({ folding: folding.held.length, folded }),
  );

  /* ---------- the keyboard ---------- */
  const button = garden.locator('.fv-card__tap');
  await button.focus();
  await page.keyboard.press('Enter');
  await settle(page, REST);
  const entered = await seen(garden);
  await page.keyboard.press('Space');
  await settle(page, REST);
  const spaced = await seen(garden);
  check(
    'Enter opens it and Space folds it, from the head’s one stop',
    entered.open && entered.held.length === 3 && !spaced.open && spaced.held.length === 0,
    JSON.stringify({ entered: entered.open, spaced: spaced.open }),
  );

  /* ---------- a tap of its own: the chevron folds ---------- */
  const own = card(page, 'A tap of its own');
  const round = own.locator('button.fv-round');
  const before = await seen(own);
  await round.click();
  await settle(page, REST);
  const after = await seen(own);
  check(
    'a head that goes somewhere leaves the fold to a round of 44, which says what it does',
    before.expanded === null &&
      (await round.getAttribute('aria-label')) === 'Close Garden' &&
      (await round.getAttribute('aria-expanded')) === 'true' &&
      after.open &&
      (await round.evaluate((el) => el.getBoundingClientRect().width)) === 44,
    JSON.stringify({ before: before.expanded, after: after.open }),
  );

  /* ---------- by itself ---------- */
  const garage = card(page, 'Opens by itself');
  const held = await seen(garage);
  await page.evaluate(() => window.fluvyMock.set('binary_sensor.ex_garage_door', 'off'));
  await settle(page, REST);
  const shut = await seen(garage);
  await page.evaluate(() => window.fluvyMock.set('binary_sensor.ex_garage_door', 'on'));
  await settle(page, REST);
  const again = await seen(garage);
  check(
    'it opens while its condition holds, folds when it no longer does, and opens with it again',
    held.open && held.held.length === 1 && !shut.open && shut.held.length === 0 && again.open,
    JSON.stringify({ held: held.open, shut: shut.open, again: again.open }),
  );

  /* ---------- hidden with its cards ---------- */
  const hiding = card(page, 'Hidden with its cards', 0);
  const beside = card(page, 'Hidden with its cards', 1);
  const gone = await seen(hiding);
  const stays = await seen(beside);
  await page.evaluate(() => window.fluvyMock.set('binary_sensor.ex_garden_door', 'on'));
  await settle(page, REST);
  const back = await seen(hiding);
  check(
    'open with every card hidden it hides itself, as a stack does, and comes back with the first that shows',
    gone.hidden && gone.shown === 0 && !stays.hidden && !back.hidden && back.shown === 1,
    JSON.stringify({ gone: gone.hidden, stays: stays.hidden, back: back.hidden }),
  );
  const mixed = await seen(card(page, 'A card it cannot build · a hidden one'));
  check(
    'a card that shows itself again takes its place among the others',
    mixed.held.length === 3 && mixed.shown === 3,
    JSON.stringify(mixed),
  );
  await page.evaluate(() => window.fluvyMock.set('binary_sensor.ex_garden_door', 'off'));

  /* ---------- as it was left ---------- */
  const left = card(page, 'Remembers');
  await tapHead(left);
  await settle(page, REST);
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await settle(page, 900);
  const kept = await seen(card(page, 'Remembers'));
  const unkept = await seen(card(page, 'A tap of its own'));
  check(
    'it stands as it was left after a reload, on this device; one that keeps nothing as its config says',
    kept.open && kept.held.length === 1 && !unkept.open,
    JSON.stringify({ kept: kept.open, unkept: unkept.open }),
  );
  await page.close();
}

/* ---------- columns ---------- */
{
  const widths = (locator) =>
    locator.evaluate((el) =>
      [...el.children].map((child) => {
        const box = child.getBoundingClientRect();
        return [Math.round(box.left), Math.round(box.top), Math.round(box.width)];
      }),
    );
  const page = await suite.sheet('expander');
  const wide = await widths(card(page, 'Columns 3 · 1400'));
  check(
    'three columns across a desktop: three cards on one line, as wide as each other',
    wide.length === 3 &&
      new Set(wide.map(([, top]) => top)).size === 1 &&
      wide[0][2] === wide[2][2],
    JSON.stringify(wide),
  );
  const phone = await widths(card(page, 'Columns 2'));
  check(
    'two columns in a phone’s section: two cards side by side',
    phone.length === 2 && phone[0][1] === phone[1][1] && phone[0][0] < phone[1][0],
    JSON.stringify(phone),
  );
  await page.close();

  // a narrow column: two asked for, one held, each card the column's whole width
  const narrow = await suite.sheet('expander', { width: 266 });
  const stacked = await widths(card(narrow, 'Columns 2'));
  check(
    'two columns asked of a column too narrow for them stand one over the other',
    stacked.length === 2 && stacked[0][0] === stacked[1][0] && stacked[0][1] < stacked[1][1],
    JSON.stringify(stacked),
  );
  await narrow.close();
}

/* ---------- narrow heads: what gives way, and when ---------- */
{
  const page = await suite.sheet('expander');
  const head = (title, n) =>
    card(page, title, n).evaluate((el) => {
      const root = el.shadowRoot;
      return {
        chevron: Boolean(root.querySelector('.ex-chevron')),
        circle: Boolean(root.querySelector('.ex-head .fv-ico')),
        name: Math.round(root.querySelector('.fv-card__title').getBoundingClientRect().width),
        line: root.querySelector('.fv-card__sub')?.textContent.trim(),
      };
    });
  const half = await head('Half pairs', 0);
  const third = await head('Thirds', 0);
  const quarter = await head('Quarters', 0);
  check(
    'half a section keeps the chevron; the circle has given its room to the name',
    half.chevron && !half.circle && half.line === '2 of 5 on',
    JSON.stringify(half),
  );
  check(
    'a third and a quarter of a section: the chevron gives way before the name is a stump, the count says its least',
    !third.chevron &&
      third.line === '2 of 5 on' &&
      !quarter.chevron &&
      quarter.name >= 36 &&
      quarter.line === '2/5',
    JSON.stringify({ third, quarter }),
  );
  await page.close();
}

/* ---------- reduced motion: at once ---------- */
{
  const page = await suite.page('sheet=expander&width=360', { reducedMotion: 'reduce' });
  const garden = card(page, 'Garden · folded');
  await tapHead(garden);
  await page.waitForTimeout(50);
  const open = await seen(garden);
  const whole = await seen(card(page, 'Garden · open'));
  await tapHead(garden);
  await page.waitForTimeout(50);
  const folded = await seen(garden);
  check(
    'under reduced motion the fold is at once, and its cards leave at once',
    open.open && open.height === whole.height && !folded.open && folded.held.length === 0,
    JSON.stringify({ open: open.height, whole: whole.height, folded: folded.held.length }),
  );
  await page.close();
}

await suite.finish();
