#!/usr/bin/env node
/**
 * Every Fluvy sheet on a phone (#190): a light's details, an alert's, the cameras', an item's, a schedule's, the room
 * lights' colours, the robot's drive, the keypad and the Energy period's, each opened by a finger from its card on the
 * dashboard mock at 360 × 780, at 100, 125 and 150 %, in a page the Companion app insets (`&insets=44,34`: a status
 * bar of 44 and a system bar of 34 over an edge-to-edge page), and Customise's options sheet in the settings panel.
 * What it proves of each: the dialog covers the screen and the sheet stands inside it; a tall one leaves the status
 * bar's 44 of scrim above it, never less, and its body scrolls under a real finger (the browser's own touches,
 * `Input.dispatchTouchEvent`) to its foot; the foot keeps the system bar's 34 under its last control, in the screen's
 * pixels whatever the size; the details sheet reads at its card's size; Escape closes it, and so does a tap on the
 * scrim above it. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-sheets.mjs            (ENGINE=webkit: the finger is a tap,
 *                                                                              the scroll the page's own)
 */
import { ENGINE, frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const PHONE = { width: 360, height: 780 };
/** The Companion app's insets the page is given: its status bar's and its system bar's. */
const TOP = 44;
const BOTTOM = 34;
const SIZES = [100, 125, 150];

/** A finger on a part of the page: a touch set down at its middle and lifted (the browser's own tap). */
async function touch(page, locator) {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await settle(page, 200);
  const box = await locator.boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Each sheet: the playground sheet its card stands on, and how a finger opens it from that card. The details sheet
 * opens on the page's body; every other one in its card.
 */
const SHEETS = [
  {
    name: 'details',
    sheet: 'details-sheets',
    extra: '&sheets=fluvy',
    open: (page) =>
      touch(
        page,
        frame(page, 'Tiles that open them')
          .locator('fluvy-tiles-card .fv-tile')
          .filter({ has: page.locator('.fv-tile__name', { hasText: /^\s*Floor lamp\s*$/ }) }),
      ),
  },
  {
    name: 'alerts',
    sheet: 'alerts',
    open: (page) =>
      touch(
        page,
        frame(page, 'Tiles')
          .locator('fluvy-alerts-card')
          .first()
          .locator('.al-tile', { hasText: 'Low batteries' })
          .first()
          .locator('.fv-tile__tap'),
      ),
  },
  {
    name: 'cameras',
    sheet: 'cameras',
    open: (page) =>
      touch(
        page,
        frame(page, 'Cameras · the mockup')
          .locator('fluvy-cameras-card')
          .first()
          .locator('.fv-card__head .fv-round'),
      ),
  },
  {
    name: 'items',
    sheet: 'items',
    open: (page) =>
      touch(
        page,
        frame(page, 'Items · flights')
          .locator('fluvy-items-card')
          .first()
          .locator('.fv-row--tap')
          .nth(1),
      ),
  },
  {
    name: 'schedule',
    sheet: 'automations',
    // Add a schedule: the head's round, or — in a column too narrow for it beside the title — the row under the list
    open: (page) =>
      touch(
        page,
        frame(page, 'Rows')
          .locator('fluvy-automations-card')
          .locator('.fv-card__head .fv-round, .au-add .fv-row--tap')
          .first(),
      ),
  },
  {
    name: 'light colour',
    sheet: 'lights',
    // the head's colour round, or — where it cannot stand in the head — its row under the body
    open: (page) =>
      touch(
        page,
        frame(page, 'Colour round (#137)')
          .locator('fluvy-lights-card')
          .first()
          .locator('.lt-colour, .lt-colour-row .fv-row--tap')
          .first(),
      ),
  },
  {
    name: 'drive',
    sheet: 'vacuum',
    open: (page) =>
      touch(
        page,
        frame(page, 'Drive · in its sheet')
          .locator('fluvy-vacuum-card')
          .locator('.fv-action[aria-label="Drive"]'),
      ),
  },
  {
    name: 'keypad',
    sheet: 'devices-security',
    // Disarm asks for the code: the first mode, a tile or — where a word would not hold its tile — a chip
    open: (page) =>
      touch(
        page,
        frame(page, 'Alarm').locator('fluvy-alarm-card').locator('.fv-option, .fv-chip').first(),
      ),
  },
  {
    name: 'period',
    sheet: 'period',
    open: (page) =>
      touch(
        page,
        frame(page, 'Row').locator('fluvy-energy-period-card').first().locator('.ep-date'),
      ),
  },
];

/**
 * The open sheet as the screen shows it, found through every shadow root: its dialog's box, its sheet's box, how far
 * it scrolls, the bottom of its last control, the room its foot keeps (its padding in the screen's pixels) and the
 * size it reads at; `end` scrolls it to its foot first (an engine without the browser's touches).
 */
const measure = (page, end = false) =>
  page.evaluate((end) => {
    const find = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.localName === 'dialog' && el.open && el.querySelector('.fv-sheet')) return el;
        const inner = el.shadowRoot && find(el.shadowRoot);
        if (inner) return inner;
      }
      return null;
    };
    const dialog = find(document);
    if (!dialog) return null;
    const sheet = dialog.querySelector('.fv-sheet');
    if (end) sheet.scrollTop = sheet.scrollHeight;
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const zoom = sheet.getBoundingClientRect().width / sheet.offsetWidth;
    const controls = [
      ...sheet.querySelectorAll('button, input, [role="slider"], [role="switch"], [tabindex="0"]'),
    ].filter((el) => el.getBoundingClientRect().height > 0);
    const last = controls.at(-1);
    return {
      dialog: box(dialog),
      sheet: box(sheet),
      zoom: Math.round(zoom * 100) / 100,
      scrollTop: Math.round(sheet.scrollTop),
      overflow: sheet.scrollHeight - sheet.clientHeight,
      foot: Math.round(Number.parseFloat(getComputedStyle(sheet).paddingBottom) * zoom * 10) / 10,
      last: last ? box(last).bottom : null,
    };
  }, end);

/** A finger that swipes up the sheet from its middle, `distance` px: the browser scrolls what it scrolls. */
async function swipeUp(page, cdp, at, distance = 260) {
  const send = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  await send('touchStart', [at]);
  for (let i = 1; i <= 12; i++) {
    await send('touchMove', [{ x: at.x, y: at.y - (distance * i) / 12 }]);
    await page.waitForTimeout(16);
  }
  await send('touchEnd', []);
  await settle(page, 300);
}

/** Whether the open sheet is gone from the page. */
const closed = async (page) => (await measure(page)) === null;

const near = (a, b) => Math.abs(a - b) <= 0.6;

for (const spec of SHEETS)
  for (const size of SIZES) {
    const at = `${spec.name} at ${size} %`;
    const page = await suite.page(
      `dashboard=${spec.sheet}&zoom=${size}&insets=${TOP},${BOTTOM}&lang=en${spec.extra ?? ''}`,
      { viewport: PHONE, touch: true, reducedMotion: 'reduce', wait: 1200 },
    );
    await spec.open(page);
    await settle(page, 700);
    let m = await measure(page);
    if (!m) {
      check(`${at}: a finger opens it`, false);
      await page.close();
      continue;
    }
    check(
      `${at}: the dialog covers the screen and the sheet stands inside it, at the foot`,
      near(m.dialog.top, 0) &&
        near(m.dialog.left, 0) &&
        near(m.dialog.right, PHONE.width) &&
        near(m.dialog.bottom, PHONE.height) &&
        m.sheet.left >= -0.5 &&
        m.sheet.right <= PHONE.width + 0.5 &&
        near(m.sheet.bottom, PHONE.height),
      JSON.stringify({ dialog: m.dialog, sheet: m.sheet }),
    );
    check(
      `${at}: the status bar's ${TOP} of scrim above it${m.overflow > 0 ? ', exactly: it is tall' : ''}`,
      m.overflow > 0 ? near(m.sheet.top, TOP) : m.sheet.top >= TOP - 0.5,
      `top ${m.sheet.top} · scrolls ${m.overflow}`,
    );
    if (spec.name === 'details')
      check(`${at}: it reads at its card's size`, m.zoom === size / 100, `zoom ${m.zoom}`);
    if (m.overflow > 0 && ENGINE === 'chromium') {
      // a finger takes the sheet to its foot: the browser's own scroll, as on a phone (WebKit: the sheet's own, below)
      const cdp = await page.context().newCDPSession(page);
      const before = m.scrollTop;
      const middle = { x: PHONE.width / 2, y: Math.round((m.sheet.top + PHONE.height) / 2) };
      await swipeUp(page, cdp, middle);
      m = await measure(page);
      check(
        `${at}: a finger's swipe scrolls it`,
        m.scrollTop > before,
        `${before} → ${m.scrollTop}`,
      );
      for (let i = 0; i < 6 && m.scrollTop < m.overflow - 1; i++) {
        await swipeUp(page, cdp, middle);
        m = await measure(page);
      }
      check(
        `${at}: the finger reaches its foot`,
        m.scrollTop >= m.overflow - 1,
        `${m.scrollTop} of ${m.overflow}`,
      );
    }
    // read at its very end: a zoomed sheet's last scroll pixel is a fraction a finger may stop short of
    m = await measure(page, true);
    check(
      `${at}: its foot keeps the system bar's ${BOTTOM} under its last control, in the screen's pixels`,
      near(m.foot, Math.max(16 * (size / 100), BOTTOM)) &&
        m.last !== null &&
        m.last <= PHONE.height - BOTTOM + 0.5,
      JSON.stringify({ foot: m.foot, last: m.last }),
    );
    if (size === 100) {
      await page.keyboard.press('Escape');
      await settle(page, 500);
      check(`${at}: Escape closes it`, await closed(page));
    } else {
      // above a tall sheet the scrim is the top's room: a tap there closes it
      await page.touchscreen.tap(PHONE.width / 2, TOP / 2);
      await settle(page, 500);
      check(`${at}: a tap on the scrim above it closes it`, await closed(page));
    }
    await page.close();
  }

/* ---------- the details sheet on a tablet: a dialog where the screen holds 600 × 600 of its card's size ---------- */
for (const [size, wide] of [
  [125, true],
  [150, false],
]) {
  const TABLET = { width: 1024, height: 768 };
  const at = `details on a 1024 × 768 tablet at ${size} %`;
  const page = await suite.page(
    `dashboard=details-sheets&sheets=fluvy&zoom=${size}&insets=${TOP},${BOTTOM}&lang=en`,
    { viewport: TABLET, touch: true, reducedMotion: 'reduce', wait: 1200 },
  );
  await SHEETS[0].open(page);
  await settle(page, 700);
  const m = await measure(page);
  const dialog = await page.evaluate(() =>
    [...document.body.children]
      .find((el) => el.localName.startsWith('fluvy-details-'))
      ?.hasAttribute('wide'),
  );
  check(
    wide
      ? `${at}: a dialog in the middle of what the bars leave, 24 of its own above and below at most`
      : `${at}: 600 of its own would not hold, so it rises from the foot`,
    m !== null &&
      dialog === wide &&
      m.zoom === size / 100 &&
      (wide
        ? m.sheet.top >= TOP + 24 * (size / 100) - 0.6 &&
          m.sheet.bottom <= TABLET.height - BOTTOM - 24 * (size / 100) + 0.6 &&
          near(m.sheet.top - TOP, TABLET.height - BOTTOM - m.sheet.bottom)
        : near(m.sheet.bottom, TABLET.height) && near(m.foot, BOTTOM)),
    JSON.stringify({ wide: dialog, ...m }),
  );
  await page.close();
}

/* ---------- the details sheet from a card the device does not zoom: the edit mode reads at 100 % ---------- */
{
  const page = await suite.page(
    `dashboard=details-sheets&sheets=fluvy&zoom=150&edit=1&insets=${TOP},${BOTTOM}&lang=en`,
    { viewport: PHONE, touch: true, reducedMotion: 'reduce', wait: 1200 },
  );
  await SHEETS[0].open(page);
  await settle(page, 700);
  const m = await measure(page);
  check(
    'details from the edit mode at 150 %: it reads at its card’s 100 %, as the card does',
    m !== null && m.zoom === 1 && near(m.foot, BOTTOM),
    JSON.stringify(m),
  );
  await page.close();
}

/* ---------- Customise's options sheet, in the settings panel (never zoomed) ---------- */
{
  const page = await suite.page(
    `panel=dashboard&state=dashboards,customise&insets=${TOP},${BOTTOM}&lang=en`,
    { viewport: PHONE, touch: true, reducedMotion: 'reduce', wait: 1500 },
  );
  const clock = page.locator('fluvy-panel .cz-part[data-part="home/clock"]');
  await touch(page, clock.locator(':scope > .fv-row'));
  await settle(page, 300);
  await touch(page, clock.locator('.fv-action[aria-label="Options"]').first());
  await page.waitForSelector('fluvy-panel dialog.cz-dialog fluvy-rows-editor ha-form');
  await settle(page, 600);
  const m = await measure(page);
  check(
    'Customise: its options sheet stands at the foot, the status bar’s 44 of scrim above it',
    m !== null &&
      near(m.sheet.bottom, PHONE.height) &&
      near(m.sheet.left, 0) &&
      near(m.sheet.right, PHONE.width) &&
      near(m.sheet.top, TOP),
    JSON.stringify(m),
  );
  check(
    'Customise: its foot keeps the system bar’s 34 under its buttons',
    m !== null && near(m.foot, BOTTOM) && m.last !== null && m.last <= PHONE.height - BOTTOM + 0.5,
    JSON.stringify(m),
  );
  await page.touchscreen.tap(PHONE.width / 2, TOP / 2);
  await settle(page, 500);
  check('Customise: a tap on the scrim above it closes it', await closed(page));
  await page.close();
}

await suite.finish();
