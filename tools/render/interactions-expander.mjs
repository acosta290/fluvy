#!/usr/bin/env node
/**
 * Interaction tests for the Expander card (#180) on the playground's `expander` sheet: folded it is its head, at
 * the height it declares; a tap opens it and builds its cards, which stand in the head's column on its surface —
 * a card of Fluvy's by its own padding turned out, a compact row by its 16, what stands on the page as it is, a
 * card of Home Assistant's without a surface, by the padding its type has (a tile on its own) — each under a
 * hairline; the fold moves, and is at once under
 * reduced motion; folded again its cards leave the page; the keyboard opens and folds it; a head with a tap of its
 * own leaves the fold to a round; it opens by itself with its condition and folds with it; it hides while every
 * card it holds is hidden; it stands as it was left after a reload; its columns hold on a desktop and give way on a
 * phone; a held card draws what it declares. Since #186: cards for a head (a clock, there while it is folded, the
 * chevron a round beside it), the chevron at the foot ("Show more", "Show less", the head brought back into view as
 * it folds) and larger, a tile and a head's card that open it by asking, the round giving way in half a section;
 * and, see-through, its surface blurs what shows through and what it holds does not blur again. Real cards on the
 * playground's simulated hass, Home Assistant's card wrapper stood in for (`apps/playground/src/hui-card.ts`). Exit
 * code 1 on any failure.
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
  const theirs = await column(card(page, 'Home Assistant’s heading, tile and picture'));
  const [heading, tile, picture] = theirs.cards;
  check(
    'a heading’s words (its 4) and a picture stand in the column, a tile of Home Assistant’s in it on its own surface',
    heading.box.join() === '16,16' &&
      transparent(heading.fill) &&
      tile.box.join() === '20,20' &&
      !transparent(tile.fill) &&
      tile.border === '1px' &&
      picture.box.join() === '20,20' &&
      picture.border === '0px' &&
      theirs.cards.every((held) => held.other && held.rule),
    JSON.stringify(theirs.cards),
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

/* ---------- cards for a head (#186) ---------- */
{
  /** What an expander with cards for a head shows: its head's cards, what folds it, and where they stand. */
  const headed = (locator) =>
    locator.evaluate((el) => {
      const root = el.shadowRoot;
      const surface = root.querySelector('[data-card]');
      const box = surface.getBoundingClientRect();
      const group = root.querySelector('.ex-heads');
      const round = root.querySelector('button.fv-round');
      const foot = root.querySelector('button.ex-foot');
      const place = (node) => {
        const own = node.getBoundingClientRect();
        return [
          Math.round(own.left - box.left),
          Math.round(own.top - box.top),
          Math.round(own.width),
          Math.round(own.height),
        ];
      };
      return {
        open: surface.classList.contains('is-open'),
        height: Math.round(box.height),
        declared: el.constructor.layoutHeight(el.config),
        group: group ? [group.getAttribute('role'), group.getAttribute('aria-label')] : null,
        words: Boolean(root.querySelector('.ex-head')),
        heads: [...el.children]
          .filter((child) => child.slot === 'head')
          .map((child) => [
            child.firstElementChild?.localName,
            ...place(child.firstElementChild ?? child),
          ]),
        under: [...el.children].filter((child) => child.slot !== 'head').length,
        round: round
          ? {
              says: round.getAttribute('aria-label'),
              expanded: round.getAttribute('aria-expanded'),
              controls: round.getAttribute('aria-controls'),
              at: place(round),
            }
          : null,
        foot: foot
          ? {
              says: foot.textContent.trim(),
              expanded: foot.getAttribute('aria-expanded'),
              at: place(foot),
              rule: getComputedStyle(foot, '::before').content !== 'none',
            }
          : null,
        buttons: root.querySelectorAll('button').length,
      };
    });

  const page = await suite.sheet('expander');
  const clock = card(page, 'Clock head · folded');
  const folded = await headed(clock);
  check(
    'a clock for a head: there while it is folded, in the head’s column, the card as tall as it declares (136)',
    !folded.open &&
      !folded.words &&
      folded.group.join() === 'group,Today' &&
      folded.heads.length === 1 &&
      folded.heads[0][0] === 'fluvy-clock-card' &&
      // turned out by its padding: its box the surface's from its top to the round's column
      folded.heads[0].slice(1).join() === '0,0,304,136' &&
      folded.under === 0 &&
      folded.height === 136 &&
      folded.declared === 136,
    JSON.stringify(folded),
  );
  check(
    'what folds it is a round of 44 after the clock, on the line a card’s head stands on, which says what it does',
    folded.buttons === 1 &&
      folded.round.says === 'Open Today' &&
      folded.round.expanded === 'false' &&
      folded.round.controls === 'cards' &&
      folded.round.at.join() === '296,20,44,44',
    JSON.stringify(folded.round),
  );
  await clock.locator('button.fv-round').click();
  await settle(page, REST);
  const opened = await headed(clock);
  check(
    'the round opens it: the forecast and the days ahead built under the clock, which stays',
    opened.open &&
      opened.heads.length === 1 &&
      opened.under === 2 &&
      opened.round.says === 'Close Today' &&
      opened.round.expanded === 'true' &&
      opened.height > 136,
    JSON.stringify(opened),
  );
  const laid = await column(card(page, 'Clock head · open'));
  check(
    'a hairline stands over each card it holds, and none over its head’s',
    laid.cards.length === 3 && laid.cards.map((held) => held.rule).join() === 'false,true,true',
    JSON.stringify(laid.cards.map((held) => held.rule)),
  );

  /* ---------- the foot ---------- */
  const more = card(page, 'Clock head · Show more');
  const below = await headed(more);
  check(
    'the chevron at the foot: the clock has the head’s whole width, and a row of 44 under a hairline says Show more',
    below.round === null &&
      below.heads[0].slice(1).join() === '0,0,360,136' &&
      below.foot.says === 'Show more' &&
      below.foot.expanded === 'false' &&
      below.foot.at.join() === '20,136,320,44' &&
      below.foot.rule &&
      below.height === 180 &&
      below.declared === 180,
    JSON.stringify(below),
  );
  await more.locator('button.ex-foot').click();
  await settle(page, REST);
  const less = await headed(more);
  check(
    'the foot opens it and says Show less, under what it holds',
    less.open && less.under === 2 && less.foot.says === 'Show less' && less.foot.at[1] > 400,
    JSON.stringify(less.foot),
  );
  await more.locator('button.ex-foot').focus();
  await page.keyboard.press('Enter');
  await settle(page, REST);
  check(
    'and the keyboard folds it from there',
    !(await headed(more)).open && (await headed(more)).foot.says === 'Show more',
  );
  const feet = await Promise.all([0, 1, 2].map((n) => headed(card(page, 'A foot', n))));
  check(
    'under a head of words the foot stands at the surface’s end (128), 8 under a head on the page (96), and after what an open one holds',
    feet[0].height === 128 &&
      feet[0].declared === 128 &&
      feet[0].foot.at.join() === '20,84,320,44' &&
      feet[1].height === 96 &&
      feet[1].declared === 96 &&
      feet[1].foot.at.join() === '0,52,360,44' &&
      !feet[1].foot.rule &&
      feet[2].open &&
      feet[2].foot.says === 'Show less',
    JSON.stringify(feet.map((own) => [own.height, own.declared, own.foot])),
  );

  /* ---------- larger ---------- */
  const large = (n) =>
    card(page, 'Large chevron', n).evaluate((el) => {
      const root = el.shadowRoot;
      const size = (selector) => {
        const node = root.querySelector(selector);
        return node ? Math.round(node.getBoundingClientRect().width) : null;
      };
      const tall = (selector) => {
        const node = root.querySelector(selector);
        return node ? Math.round(node.getBoundingClientRect().height) : null;
      };
      return {
        mark: size('.ex-chevron svg'),
        box: size('.ex-chevron'),
        round: size('button.fv-round'),
        glyph: size('button.fv-round svg'),
        foot: tall('button.ex-foot'),
        words: root.querySelector('.ex-foot__words')
          ? parseFloat(getComputedStyle(root.querySelector('.ex-foot__words')).fontSize)
          : null,
        height: Math.round(root.querySelector('[data-card]').getBoundingClientRect().height),
        declared: el.constructor.layoutHeight(el.config),
      };
    });
  const [mark, start, own, row] = await Promise.all([0, 1, 2, 3].map(large));
  check(
    'a larger chevron: the mark’s glyph 28 in its box of 44, the round 56 with a glyph of 24, the foot’s row 56 at 15; the head as tall as before',
    mark.mark === 28 &&
      mark.box === 44 &&
      start.mark === 28 &&
      own.round === 56 &&
      own.glyph === 24 &&
      row.foot === 56 &&
      row.words === 15 &&
      [mark, start, own].every((card) => card.height === 84 && card.declared === 84) &&
      row.height === 140 &&
      row.declared === 140,
    JSON.stringify({ mark, start, own, row }),
  );

  /* ---------- opened from another card ---------- */
  const tile = frame(page, 'Opened from another card').locator(':scope > fluvy-template-card');
  const named = card(page, 'Opened from another card');
  const quiet = await headed(named);
  await tile.click();
  await settle(page, REST);
  const asked = await headed(named);
  await tile.click();
  await settle(page, REST);
  const again = await headed(named);
  check(
    'a tile elsewhere opens the expander it names, and folds it again; the expander shows no button of its own',
    quiet.buttons === 0 && !quiet.open && asked.open && asked.under === 1 && !again.open,
    JSON.stringify({ quiet: quiet.open, asked: asked.open, again: again.open }),
  );
  // the clock is its head, and asks the expander that holds it
  await named.locator(':scope > [slot="head"]').click();
  await settle(page, REST);
  const byClock = await headed(named);
  check('a tap on the clock that is its head opens it', byClock.open, JSON.stringify(byClock));
  // what the expander-card's buttons say, from anywhere in the page
  await page.evaluate(() =>
    document.body.dispatchEvent(
      new CustomEvent('ll-custom', {
        detail: {
          action: 'fire-dom-event',
          'expander-card': { data: { 'expander-card-id': 'forecast', action: 'close' } },
        },
        bubbles: true,
        composed: true,
      }),
    ),
  );
  await settle(page, REST);
  check(
    'and the expander-card’s own action folds it',
    !(await headed(named)).open,
    JSON.stringify(await headed(named)),
  );
  await page.close();

  /* ---------- half a section: the round gives way to the foot ---------- */
  const narrow = await suite.sheet('expander', { width: 172 });
  const half = await headed(card(narrow, 'Clock head · folded'));
  check(
    'in half a section the clock keeps its width: the round gives way to the foot',
    half.round === null &&
      half.foot !== null &&
      // the surface's whole width: its column, where the foot stands, and the padding the clock turns out
      half.heads[0][3] === half.foot.at[2] + 40,
    JSON.stringify(half),
  );
  await narrow.close();

  /* ---------- folding from the foot brings the head back ---------- */
  const small = await suite.page('sheet=expander&width=360', {
    viewport: { width: 1400, height: 560 },
    reducedMotion: 'reduce',
  });
  const tall = card(small, 'Clock head · Show less');
  const button = tall.locator('button.ex-foot');
  await button.evaluate((el) => el.scrollIntoView({ block: 'end' }));
  const top = () =>
    tall.evaluate((el) =>
      Math.round(el.shadowRoot.querySelector('.ex-heads').getBoundingClientRect().top),
    );
  const before = await top();
  await button.click();
  await settle(small, REST);
  const after = await top();
  check(
    'folded from the foot, its head is brought back into view, under where Home Assistant’s header stands',
    before < 0 && after >= 56 && after < 200,
    `${before} → ${after}`,
  );
  await small.close();
}

/* ---------- see-through: the surface blurs once (#186) ---------- */
{
  /** What blurs what shows through: the expander's surface, and each surface the cards it holds draw. */
  const blurs = (locator) =>
    locator.evaluate((el) => {
      const blur = (node) => getComputedStyle(node).backdropFilter;
      return {
        surface: blur(el.shadowRoot.querySelector('[data-card]')),
        glass: [...el.children].map((wrapper) => wrapper.firstElementChild?.getAttribute('glass')),
        held: [...el.children].flatMap((wrapper) =>
          [
            ...(wrapper.firstElementChild?.shadowRoot?.querySelectorAll('.fv-card, .fv-tile') ??
              []),
          ].map(blur),
        ),
        rule: getComputedStyle(el.children[0], '::before').backgroundColor,
      };
    });
  const clear = ({ surface, glass, held, rule }) =>
    surface === 'blur(16px)' &&
    glass.every((mark) => mark === 'blur') &&
    held.length >= 6 &&
    held.every((filter) => filter === 'none') &&
    !transparent(rule);
  // each card see-through by its own config, over a view's background
  const page = await suite.sheet('expander');
  const own = await blurs(card(page, 'See-through'));
  check(
    'see-through, its surface blurs what shows through and no card it holds blurs again: no box in the card',
    clear(own),
    JSON.stringify(own),
  );
  await page.close();
  // every card see-through by the house's setting
  const house = await suite.sheet('expander', { extra: '&opacity=70' });
  const all = await blurs(card(house, 'Garden · open'));
  check('…nor where the house makes every card see-through', clear(all), JSON.stringify(all));
  const bare = await blurs(card(house, 'Plain · open'));
  // the lit tile lets nothing through, held or not
  check(
    'without a surface the cards it holds are the outermost, and blur as on the page',
    bare.held.filter((filter) => filter === 'blur(16px)').length === bare.held.length - 1,
    JSON.stringify(bare.held),
  );
  await house.close();
}

await suite.finish();
