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
 * one out of reach calls nothing.
 * Real cards on the playground's simulated hass.
 * Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-details-sheets.mjs
 */
import { dialTo, mousePointer } from './lib/gestures.mjs';
import { calls, frame, moreInfo, reset, settle, startSuite } from './lib/suite.mjs';

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

await suite.finish();
