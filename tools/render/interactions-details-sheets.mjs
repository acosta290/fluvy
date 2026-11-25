#!/usr/bin/env node
/**
 * Interaction tests for Fluvy's own details sheets (#162): in a house that asks for them (`&sheets=fluvy`), a tap on
 * a tile of each kind — a light, a thermostat, a cover, a player, a fan — opens that kind's sheet on the page's body,
 * a modal dialog named by its entity, at the foot of a phone and in the middle of a wide screen, with nothing inside
 * it that scrolls; a tile whose action keeps Home Assistant's dialog (`details: home-assistant`) and a sensor, which
 * has no sheet, ask Home Assistant, and so does every tile in a house that keeps its dialog. In the light's sheet the
 * dial's knob dragged to the top sets half brightness, the keys switch and step (a burst of steps one call), an arrow
 * key on the knob steps too; the focus starts on Close, never leaves the dialog and goes back to the tile as Escape
 * closes it; the sheet follows the house while it is open; its round opens Home Assistant's own details and its day
 * goes to the History page, each closing it. Every docked sheet stands as tall as it draws, without a scroller, and
 * one out of reach calls nothing. A sheet shows its last 24 hours where the house does for its kind (#243: the lights
 * alone, `&sheetsday=light`) and an action says nothing else (`history: false`), and one without them asks the
 * recorder nothing. A sheet keeps its dial where the house does for its kind (#258: `&sheetsdial=light,climate`), its
 * own card says so (`sheet_dial`) or an action does (`dial`), the nearest first; without it its control is a ruler
 * across the sheet, a phone's cover sheet a third shorter: dragged, its figure follows the finger and its release
 * sends once, an arrow key steps it, its figure reads on the knob's centre line and its keys are pills. And a cover's
 * sheet reads its cover as the Cover card that opened it does: a position turned round, one counted as it comes down.
 * Real cards on the playground's simulated hass.
 * Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-details-sheets.mjs
 */
import { dialTo, mousePointer, rulerGeometry } from './lib/gestures.mjs';
import { calls, frame, moreInfo, reset, settle, startSuite, tapHead } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const PHONE = { width: 360, height: 800 };
const DESKTOP = { width: 1400, height: 900 };
const TILES = 'Tiles that open them';
/** Each kind's tile by its name, its entity and the sheet it opens. */
const KINDS = [
  ['Floor lamp', 'light.dt_floor', 'fluvy-details-light'],
  ['Thermostat', 'climate.dt_living', 'fluvy-details-climate'],
  ['Blind', 'cover.dt_blind', 'fluvy-details-cover'],
  ['Kitchen speaker', 'media_player.dt_kitchen', 'fluvy-details-media'],
  ['Ceiling fan', 'fan.dt_ceiling', 'fluvy-details-fan'],
];

/** The page of the sheet, in a house that asks for Fluvy's sheets (or keeps Home Assistant's dialog). */
const open = (viewport, { fluvy = true, mode = 'light' } = {}) =>
  suite.page(`sheet=details-sheets&width=328&lang=en&mode=${mode}${fluvy ? '&sheets=fluvy' : ''}`, {
    viewport,
    reducedMotion: 'reduce',
  });

/** A finger on a tile of the frame, by its whole name: a real click at its middle. */
async function tap(page, name) {
  const tile = frame(page, TILES)
    .locator('fluvy-tiles-card .fv-tile')
    .filter({ has: page.locator('.fv-tile__name', { hasText: new RegExp(`^\\s*${name}\\s*$`) }) });
  await tile.scrollIntoViewIfNeeded();
  const box = await tile.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await settle(page, 350);
}

/** The sheet open on the page's body, as the page sees it; null when none is. */
const sheetOf = (page) =>
  page.evaluate(() => {
    const sheet = [...document.body.children].find((el) =>
      el.localName.startsWith('fluvy-details-'),
    );
    if (!sheet) return null;
    const root = sheet.shadowRoot;
    const dialog = root.querySelector('dialog');
    const inner = root.querySelector('.fv-sheet');
    const box = inner.getBoundingClientRect();
    const style = getComputedStyle(inner);
    // what scrolls inside the sheet: nothing may
    const scrollers = [...inner.querySelectorAll('*')].filter((el) => {
      const overflow = getComputedStyle(el).overflowY;
      return (
        (overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight + 1
      );
    });
    const active = root.activeElement;
    return {
      tag: sheet.localName,
      open: dialog?.open === true,
      modal: dialog?.matches(':modal') === true,
      labelled: root
        .getElementById(dialog?.getAttribute('aria-labelledby') ?? '')
        ?.textContent.trim(),
      line: root.querySelector('.fv-sheet__head .fv-card__sub')?.textContent.trim(),
      wide: sheet.hasAttribute('wide'),
      dark: sheet.hasAttribute('dark'),
      box: { left: box.left, right: box.right, top: box.top, bottom: box.bottom },
      radius: [style.borderTopLeftRadius, style.borderBottomRightRadius],
      scrolls: inner.scrollHeight > inner.clientHeight + 1,
      scrollers: scrollers.length,
      focus: active?.getAttribute('aria-label') ?? active?.className ?? null,
    };
  });

/** Where the page's focus is, down through every shadow root: the element's class, and whether it is in a sheet. */
const focusOf = (page) =>
  page.evaluate(() => {
    let active = document.activeElement;
    let inSheet = false;
    while (active?.shadowRoot?.activeElement) {
      inSheet ||= active.localName.startsWith('fluvy-details-');
      active = active.shadowRoot.activeElement;
    }
    return { cls: active?.className ?? '', tag: active?.localName ?? '', inSheet };
  });

const knobOf = (page) => page.locator('body > fluvy-details-light fluvy-dial [data-knob="0"]');

/* ---------- a tile of each kind opens its sheet, at the foot of a phone ---------- */
{
  const page = await open(PHONE);
  for (const [name, entity, tag] of KINDS) {
    await reset(page);
    await tap(page, name);
    const sheet = await sheetOf(page);
    check(
      `${name}: a tap opens its sheet (${tag}), a modal dialog named by the entity, and asks Home Assistant nothing`,
      sheet?.tag === tag &&
        sheet.open &&
        sheet.modal &&
        sheet.labelled === name &&
        (await moreInfo(page)).length === 0,
      JSON.stringify([sheet, await moreInfo(page), entity]),
    );
    check(
      `${name}: on a phone the sheet stands at the foot of the screen, as wide as it, and nothing in it scrolls`,
      sheet !== null &&
        !sheet.wide &&
        Math.abs(sheet.box.bottom - PHONE.height) < 1 &&
        sheet.box.left === 0 &&
        Math.abs(sheet.box.right - PHONE.width) < 1 &&
        sheet.box.top >= 0 &&
        !sheet.scrolls &&
        sheet.scrollers === 0,
      JSON.stringify(sheet),
    );
    check(`${name}: the focus starts on Close`, sheet?.focus === 'Close', String(sheet?.focus));
    await page.keyboard.press('Escape');
    await settle(page, 350);
    const focus = await focusOf(page);
    check(
      `${name}: Escape closes it, and the focus goes back to the tile`,
      (await sheetOf(page)) === null && focus.cls.includes('fv-tile__tap') && !focus.inSheet,
      JSON.stringify(focus),
    );
  }

  // an action that keeps Home Assistant's dialog, and a kind with no sheet
  await reset(page);
  await tap(page, 'Ceiling');
  check(
    'a tile whose action says `details: home-assistant` opens Home Assistant’s dialog',
    (await sheetOf(page)) === null && (await moreInfo(page)).join() === 'light.dt_ceiling',
    JSON.stringify(await moreInfo(page)),
  );
  await reset(page);
  await tap(page, 'Outside');
  check(
    'a sensor has no sheet: its details are Home Assistant’s',
    (await sheetOf(page)) === null && (await moreInfo(page)).join() === 'sensor.dt_outside',
    JSON.stringify(await moreInfo(page)),
  );
  await page.close();
}

/* ---------- a house that keeps Home Assistant's dialog ---------- */
{
  const page = await open(PHONE, { fluvy: false });
  await tap(page, 'Floor lamp');
  check(
    'in a house that keeps Home Assistant’s dialog, a light’s tile opens it',
    (await sheetOf(page)) === null && (await moreInfo(page)).join() === 'light.dt_floor',
    JSON.stringify(await moreInfo(page)),
  );
  await page.close();
}

/* ---------- the light's sheet: its dial, its keys, the keyboard ---------- */
{
  const page = await open(PHONE);
  await tap(page, 'Floor lamp');
  await reset(page);

  // straight up is the middle of the sweep: half brightness
  await dialTo(
    mousePointer(page),
    { knob: knobOf(page), dial: page.locator('body > fluvy-details-light fluvy-dial .fv-dial') },
    { up: 96 },
  );
  await settle(page, 150);
  let c = await calls(page);
  check(
    'the dial’s knob dragged to the top sets half brightness, one call on its release',
    c.length === 1 &&
      c[0].s === 'light.turn_on' &&
      c[0].d.brightness_pct === 50 &&
      c[0].t.entity_id === 'light.dt_floor',
    JSON.stringify(c),
  );
  await settle(page, 400);
  check(
    'the head’s line follows: On · 50 %',
    (await sheetOf(page))?.line === 'Living room · On · 50 %',
    String((await sheetOf(page))?.line),
  );

  // three quick steps up: one call
  await reset(page);
  const plus = page.locator('body > fluvy-details-light .dt-keys [data-key="up"]');
  for (let i = 0; i < 3; i += 1) {
    await plus.click();
    await page.waitForTimeout(60);
  }
  await settle(page, 800);
  c = await calls(page);
  check(
    'three steps up from the keys are one call: 53 %',
    c.length === 1 && c[0].d.brightness_pct === 53,
    JSON.stringify(c),
  );

  // the keyboard: an arrow on the knob steps the level; Tab never leaves the dialog
  await reset(page);
  await knobOf(page).focus();
  await page.keyboard.press('ArrowRight');
  await settle(page, 800);
  c = await calls(page);
  check(
    'an arrow key on the knob steps the level: 54 %',
    c.length === 1 && c[0].d.brightness_pct === 54,
    JSON.stringify(c),
  );
  const outside = [];
  for (let i = 0; i < 24; i += 1) {
    await page.keyboard.press('Tab');
    const focus = await focusOf(page);
    // the browser's own chrome between the dialog's last stop and its first reads as the body
    if (!focus.inSheet && focus.tag !== 'body' && focus.tag !== '') outside.push(focus);
  }
  check(
    'Tab walks the sheet’s controls and never a card behind it',
    outside.length === 0,
    JSON.stringify(outside),
  );

  // the switch
  await reset(page);
  await page.locator('body > fluvy-details-light .dt-keys [data-key="power"]').click();
  await settle(page, 300);
  c = await calls(page);
  const sheet = await sheetOf(page);
  check(
    'the power key switches the light off, and the sheet says so at once',
    c.length === 1 && c[0].s === 'light.turn_off' && sheet?.line === 'Living room · Off',
    JSON.stringify([c, sheet?.line]),
  );

  // the house moves under the sheet: it follows
  await page.evaluate(() =>
    window.fluvyMock.set('light.dt_floor', 'on', {
      ...window.fluvyMock.hass().states['light.dt_floor'].attributes,
      brightness: 26,
    }),
  );
  await settle(page, 300);
  check(
    'the sheet follows the house while it is open: On · 10 %',
    (await sheetOf(page))?.line === 'Living room · On · 10 %',
    String((await sheetOf(page))?.line),
  );

  // Home Assistant's own details: the sheet steps aside
  await reset(page);
  await page.locator('body > fluvy-details-light .dt-more').click();
  await settle(page, 300);
  check(
    'the round opens Home Assistant’s own details of the light, and the sheet closes',
    (await sheetOf(page)) === null && (await moreInfo(page)).join() === 'light.dt_floor',
    JSON.stringify(await moreInfo(page)),
  );

  // the day: to the History page
  await tap(page, 'Floor lamp');
  await page.locator('body > fluvy-details-light .dt-day .fv-tile__tap').click();
  await settle(page, 300);
  const address = await page.evaluate(() => window.location.pathname + window.location.search);
  check(
    'the day goes to the History page for the light, with the way back, and the sheet closes',
    (await sheetOf(page)) === null &&
      /^\/history\?entity_id=light\.dt_floor&start_date=[^&]+&back=1$/.test(address),
    address,
  );
  await page.close();
}

/* ---------- a wide screen: a dialog in the middle, in the page's mode ---------- */
{
  const page = await open(DESKTOP, { mode: 'dark' });
  await tap(page, 'Thermostat');
  const sheet = await sheetOf(page);
  const centre = sheet ? (sheet.box.left + sheet.box.right) / 2 : 0;
  const middle = sheet ? (sheet.box.top + sheet.box.bottom) / 2 : 0;
  check(
    'on a wide screen the sheet is a dialog in the middle of it, every corner round, in the page’s dark mode',
    sheet !== null &&
      sheet.wide &&
      sheet.dark &&
      Math.abs(centre - DESKTOP.width / 2) < 1 &&
      Math.abs(middle - DESKTOP.height / 2) < 1 &&
      sheet.radius.join() === '24px,24px' &&
      !sheet.scrolls,
    JSON.stringify(sheet),
  );
  // the scrim closes it, once the opening tap is past
  await settle(page, 400);
  await page.mouse.click(40, 40);
  await settle(page, 350);
  check('a tap on the scrim closes it', (await sheetOf(page)) === null);
  await page.close();
}

/* ---------- the docked sheets: no scroller, and one out of reach calls nothing ---------- */
{
  const page = await open(PHONE);
  const inner = await page.evaluate(() =>
    [...document.querySelectorAll('[data-frame] > *')]
      .filter((el) => el.localName.startsWith('fluvy-details-'))
      .map((el) => {
        const sheet = el.shadowRoot.querySelector('.fv-sheet');
        return [...sheet.querySelectorAll('*')].filter((part) => {
          const overflow = getComputedStyle(part).overflowY;
          return (
            (overflow === 'auto' || overflow === 'scroll') &&
            part.scrollHeight > part.clientHeight + 1
          );
        }).length;
      }),
  );
  check(
    `every docked sheet (${inner.length}) draws without a scroller inside it`,
    inner.length >= 27 && inner.every((count) => count === 0),
    JSON.stringify(inner),
  );
  await reset(page);
  const gone = frame(page, 'Fan · out of reach').locator('fluvy-details-fan');
  await gone.scrollIntoViewIfNeeded();
  const disabled = await gone.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('.dt-keys .fv-action')].map((button) => button.disabled),
  );
  for (const id of ['minus', 'power', 'plus'])
    await gone
      .locator(`.dt-keys [data-key="${id}"]`)
      .click({ force: true })
      .catch(() => undefined);
  await settle(page, 800);
  check(
    'a fan out of reach keeps its three keys, each still, and calls nothing',
    disabled.join() === 'true,true,true' && (await calls(page)).length === 0,
    JSON.stringify([disabled, await calls(page)]),
  );
  await page.close();
}

/* ---------- the last 24 hours, where the house and an action show them (#243) ---------- */
{
  /** The sheet open now: whether it draws its day, and the recorder's days asked since the last reset. */
  const day = async (page) => ({
    drawn: await page.evaluate(() => {
      const sheet = [...document.body.children].find((el) =>
        el.localName.startsWith('fluvy-details-'),
      );
      return sheet ? Boolean(sheet.shadowRoot.querySelector('.dt-day')) : null;
    }),
    asked: await page.evaluate(
      () =>
        window.fluvyMock.wsCalls.filter((call) => call.type === 'history/history_during_period')
          .length,
    ),
  });
  const close = async (page) => {
    await page.keyboard.press('Escape');
    await settle(page, 350);
  };
  // the house shows them for its lights alone: a lamp's day, a speaker's none, and nothing asked for it
  const page = await suite.page(
    'sheet=details-sheets&width=328&lang=en&sheets=fluvy&sheetsday=light',
    { viewport: PHONE, reducedMotion: 'reduce' },
  );
  await reset(page);
  await tap(page, 'Floor lamp');
  const lamp = await day(page);
  await close(page);
  await reset(page);
  await tap(page, 'Kitchen speaker');
  const speaker = await day(page);
  await close(page);
  check(
    'the house shows the lights’ last 24 hours alone: the lamp’s sheet draws its day, the speaker’s none and asks the recorder nothing',
    lamp.drawn === true && lamp.asked === 1 && speaker.drawn === false && speaker.asked === 0,
    JSON.stringify({ lamp, speaker }),
  );
  await page.close();
  // an action's own `history: false`, in a house that shows every kind
  const own = await open(PHONE);
  const tile = own
    .locator('[data-frame$="/Tiles · the speakers without their last 24 hours (#243)"] .fv-tile')
    .first();
  await tile.scrollIntoViewIfNeeded();
  await reset(own);
  const box = await tile.boundingBox();
  await own.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await settle(own, 350);
  const quiet = await day(own);
  check(
    'a tile’s action with history: false opens the speaker’s sheet without its day, and asks the recorder nothing',
    quiet.drawn === false && quiet.asked === 0,
    JSON.stringify(quiet),
  );
  await close(own);
  await reset(own);
  await tap(own, 'Kitchen speaker');
  const shown = await day(own);
  check(
    'the same speaker from a tile that says nothing shows its day, as before',
    shown.drawn === true && shown.asked === 1,
    JSON.stringify(shown),
  );
  await own.close();
}

/* ---------- a sheet without its dial: who says so, and its ruler (#258) ---------- */
{
  /** The sheet open now: its control (a dial, a ruler across, or neither), what it says and how tall it stands. */
  const controlOf = (page) =>
    page.evaluate(() => {
      const sheet = [...document.body.children].find((el) =>
        el.localName.startsWith('fluvy-details-'),
      );
      if (!sheet) return null;
      const root = sheet.shadowRoot;
      const box = root.querySelector('.fv-sheet').getBoundingClientRect();
      const text = (el) => el?.textContent.replace(/\s+/g, ' ').trim() ?? '';
      return {
        tag: sheet.localName,
        dial: Boolean(root.querySelector('fluvy-dial')),
        ruler: Boolean(root.querySelector('.cv-across fluvy-ruler')),
        says: [...root.querySelectorAll('.cv-across .fv-readout__value > span')].map(text),
        ends: [...root.querySelectorAll('.cv-across .fv-ruler-labels span')].map(text),
        dialled: root.querySelector('fluvy-dial')?.value ?? null,
        line: text(root.querySelector('.fv-sheet__head .fv-card__sub')),
        height: Math.round(box.height),
        scrolls:
          root.querySelector('.fv-sheet').scrollHeight >
          root.querySelector('.fv-sheet').clientHeight + 1,
      };
    });
  const close = async (page) => {
    await page.keyboard.press('Escape');
    await settle(page, 350);
  };
  const rect = (locator) =>
    locator.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x, y: box.y, w: box.width, h: box.height, bottom: box.bottom };
    });
  const middle = (box) => box.y + box.h / 2;

  // the house keeps the dial for its lights and its thermostats: a blind opens on a ruler, a lamp round its dial
  const house = await suite.page(
    'sheet=details-sheets&width=328&lang=en&sheets=fluvy&sheetsdial=light,climate',
    { viewport: PHONE, reducedMotion: 'reduce' },
  );
  await tap(house, 'Floor lamp');
  const lamp = await controlOf(house);
  await close(house);
  await tap(house, 'Blind');
  const blind = await controlOf(house);
  check(
    'the house keeps the dial for its lights alone of the two: the lamp’s sheet round its dial, the blind’s on a ruler',
    lamp?.dial === true && !lamp.ruler && blind?.dial === false && blind.ruler === true,
    JSON.stringify({ lamp, blind }),
  );
  check(
    'the blind’s sheet says its position beside the ruler, the ends in words: 65 %, Closed and Open',
    blind?.says.join(' ') === '65 %' && blind.ends.join() === 'Closed,Open' && !blind.scrolls,
    JSON.stringify(blind),
  );

  // its geometry: the figure on the knob's centre line, the ends' words on the label's line, the keys pills of 44
  const sheet = house.locator('body > fluvy-details-cover');
  const across = sheet.locator('.cv-across');
  const [label, value, words, knob, key] = await Promise.all([
    rect(across.locator('.fv-readout__label')),
    rect(across.locator('.fv-readout__value')),
    rect(across.locator('.fv-ruler-labels')),
    rect(across.locator('fluvy-ruler .fv-knob')),
    rect(sheet.locator('.dt-keys .fv-action').first()),
  ]);
  const pill = await sheet
    .locator('.dt-keys .fv-action')
    .first()
    .evaluate((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius));
  check(
    'the figure reads on the knob’s centre line, the ends’ words on the label’s line, the keys outlined pills 44 tall',
    Math.abs(middle(value) - middle(knob)) <= 0.5 &&
      Math.abs(label.y - words.y) <= 0.5 &&
      key.h === 44 &&
      pill >= 22,
    JSON.stringify({
      value: middle(value),
      knob: middle(knob),
      label: label.y,
      words: words.y,
      key,
      pill,
    }),
  );

  // dragged, the figure follows the finger and nothing is sent; let go, the position once
  const ruler = across.locator('fluvy-ruler');
  const geo = await rulerGeometry(ruler.locator('.fv-ruler'), ruler.locator('.fv-knob'));
  const pointer = mousePointer(house);
  await reset(house);
  await pointer.move(geo.at(65), geo.y);
  await pointer.down();
  await pointer.move(geo.at(50), geo.y, 6);
  await pointer.move(geo.at(30), geo.y, 12);
  await settle(house, 60);
  const during = await controlOf(house);
  const early = await calls(house);
  await pointer.up();
  await settle(house, 400);
  let c = await calls(house);
  check(
    'the ruler dragged to 30: the figure follows the finger and nothing is sent until it lets go',
    during?.says[0] === '30' && early.length === 0,
    JSON.stringify({ during: during?.says, early }),
  );
  check(
    'let go, the position is sent once, and the head’s line follows: Open · 30 %',
    c.length === 1 &&
      c[0].s === 'cover.set_cover_position' &&
      c[0].d.position === 30 &&
      c[0].t.entity_id === 'cover.dt_blind' &&
      (await controlOf(house))?.line === 'Bedroom · Open · 30 %',
    JSON.stringify([c, (await controlOf(house))?.line]),
  );

  // the keyboard: an arrow on the ruler steps the position
  await reset(house);
  await ruler.locator('.fv-ruler').focus();
  await house.keyboard.press('ArrowRight');
  await settle(house, 300);
  c = await calls(house);
  check(
    'an arrow key on the ruler steps the position: 31 %',
    c.length === 1 && c[0].d.position === 31,
    JSON.stringify(c),
  );
  await close(house);
  await house.close();

  // a phone's cover sheet without its dial: a third shorter than with it
  const plain = await open(PHONE);
  await tap(plain, 'Blind');
  const tall = await controlOf(plain);
  check(
    'on a phone the blind’s sheet on a ruler stands at least 140 shorter than round its dial, and scrolls nothing',
    tall?.dial === true && blind !== null && tall.height - blind.height >= 140 && !blind.scrolls,
    JSON.stringify({ dial: tall?.height, ruler: blind?.height }),
  );
  await close(plain);

  // a card's own say, and an action's, in a house that keeps every dial
  const said = frame(plain, 'Cards and tiles that open a sheet with no dial (#258)');
  await tapHead(said.locator('fluvy-cover-card'));
  await settle(plain, 350);
  const fromCover = await controlOf(plain);
  await close(plain);
  await tapHead(said.locator('fluvy-thermostat-card'));
  await settle(plain, 350);
  const fromThermostat = await controlOf(plain);
  await close(plain);
  check(
    'a Cover card and a Thermostat card that say sheet_dial: false open their own sheets on a ruler',
    fromCover?.tag === 'fluvy-details-cover' &&
      fromCover.ruler &&
      !fromCover.dial &&
      fromThermostat?.tag === 'fluvy-details-climate' &&
      fromThermostat.ruler &&
      !fromThermostat.dial &&
      fromThermostat.ends.join() === '15°,Now 20.8°,30°',
    JSON.stringify({ fromCover, fromThermostat }),
  );
  /** A finger on a tile of the frame, by its whole name. */
  const tapTile = async (page, name) => {
    const tile = frame(page, 'Cards and tiles that open a sheet with no dial (#258)')
      .locator('fluvy-tiles-card .fv-tile')
      .filter({ has: page.locator('.fv-tile__name', { hasText: new RegExp(`^\\s*${name}`) }) });
    await tile.scrollIntoViewIfNeeded();
    const box = await tile.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await settle(page, 350);
  };
  await tapTile(plain, 'Floor lamp');
  const fromTile = await controlOf(plain);
  await close(plain);
  check(
    'a tile whose action says dial: false opens the lamp’s sheet on a ruler',
    fromTile?.tag === 'fluvy-details-light' && fromTile.ruler && !fromTile.dial,
    JSON.stringify(fromTile),
  );

  // the fix: a sheet reads its cover as the Cover card that opened it does
  const turned = frame(plain, 'Cover · its card turns the position round, its sheet agrees (#258)');
  const figureOf = (card) =>
    card.evaluate((el) =>
      [...el.shadowRoot.querySelectorAll('.fv-readout__value > span')].map((part) =>
        part.textContent.trim(),
      ),
    );
  const cardSays = await figureOf(turned.locator('fluvy-cover-card'));
  await tapHead(turned.locator('fluvy-cover-card'));
  await settle(plain, 350);
  const agreed = await controlOf(plain);
  check(
    'a cover that reports 20 where its card says 80 %: the sheet the card opens says 80 % too, on its dial and its head',
    cardSays.join(' ') === '80 %' &&
      agreed?.dialled === 80 &&
      agreed.line === 'Living room · Open · 80 %',
    JSON.stringify({ cardSays, agreed }),
  );
  await close(plain);
  const downward = frame(plain, 'Cover · the horizontal card and its sheet across (#258)');
  const downSays = await downward
    .locator('fluvy-cover-card')
    .evaluate((el) =>
      [...el.shadowRoot.querySelectorAll('.cv-across .fv-readout__value > span')].map((part) =>
        part.textContent.trim(),
      ),
    );
  await tapHead(downward.locator('fluvy-cover-card'));
  await settle(plain, 350);
  const across2 = await controlOf(plain);
  check(
    'a horizontal card that counts down opens its sheet across: 35 % on both, "down" where it holds, the ends in the card’s words',
    downSays.slice(0, 2).join(' ') === '35 %' &&
      across2?.ruler === true &&
      across2.says.join(' ') === '35 % down' &&
      across2.ends.join() === 'Lowered,Raised',
    JSON.stringify({ downSays, across2 }),
  );
  await close(plain);
  await plain.close();

  // an action's dial: true in a house that keeps none
  const none = await suite.page('sheet=details-sheets&width=328&lang=en&sheets=fluvy&sheetsdial=', {
    viewport: PHONE,
    reducedMotion: 'reduce',
  });
  await tapTile(none, 'Kitchen s');
  const kept = await controlOf(none);
  await close(none);
  await tap(none, 'Kitchen speaker');
  const left = await controlOf(none);
  check(
    'in a house that keeps no dial a tile whose action says dial: true opens the speaker’s dial, any other its ruler',
    kept?.dial === true && !kept.ruler && left?.dial === false && left.ruler === true,
    JSON.stringify({ kept, left }),
  );
  await close(none);
  await none.close();

  // a wide screen: the dialog in the middle, on its ruler
  const desk = await suite.page(
    'sheet=details-sheets&width=328&lang=en&sheets=fluvy&sheetsdial=light',
    { viewport: DESKTOP, reducedMotion: 'reduce' },
  );
  await tap(desk, 'Thermostat');
  const wide = await sheetOf(desk);
  const control = await controlOf(desk);
  check(
    'on a wide screen the thermostat’s sheet is the dialog in the middle, its target on a ruler',
    wide?.wide === true &&
      Math.abs((wide.box.left + wide.box.right) / 2 - DESKTOP.width / 2) < 1 &&
      control?.ruler === true &&
      !control.dial &&
      !wide.scrolls,
    JSON.stringify({ wide, control }),
  );
  await desk.close();
}

await suite.finish();
