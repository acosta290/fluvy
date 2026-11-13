#!/usr/bin/env node
/**
 * Interaction tests for Customise (1.20, #170), the Dashboards tab's section that edits an automatic dashboard's views
 * and cards, in a real Chromium against the playground (the demo home). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-customise.mjs
 * What it proves: a dashboard's card opens it with a tap on its Customise row, and the address names the dashboard;
 * the open view's cards are rows in the order they are read; a switch hides a card without unfolding its row, and the
 * apply bar counts the change; a row unfolds its buttons, a finger's 44 each in equal cells, and a card moved keeps the
 * focus on the button that moved it; a list unfolds its entities, one switched off is left out and the row says how
 * much of the list shows; Options opens the card's own form in a sheet in the top layer, at the window's foot, a
 * change in it kept as the card's option alone; Escape closes the sheet, kept from the window, and the focus goes back
 * to the button that opened it; on a wide screen the view is drawn beside its rows as it will be, never touched, and a
 * card hidden leaves it; Save writes the strategy with the edit; the page logs no error; at a 360 phone no row runs
 * past its card.
 */
import { BASE, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const CUSTOMISE = 'panel=dashboard&state=dashboards,customise';
const part = (page, id) => page.locator(`fluvy-panel .cz-part[data-part="${id}"]`);
const parts = (page) =>
  page
    .locator('fluvy-panel .cz-part')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-part')));
const barText = async (page) => {
  const bar = page.locator('fluvy-panel .pn-foot:not(.is-leaving) .pn-bar__text');
  return (await bar.count()) ? (await bar.textContent()).trim() : '';
};
const action = (row, label) => row.locator(`.fv-action[aria-label="${label}"]`).first();
/** The element that has the focus, through every shadow root: what it says to a reader. */
const focused = (page) =>
  page.evaluate(() => {
    let node = document.activeElement;
    while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
    return node?.getAttribute('aria-label') ?? null;
  });
const errors = (page) => {
  const seen = [];
  page.on('console', (message) => {
    if (message.type() === 'error') seen.push(message.text());
  });
  page.on('pageerror', (error) => seen.push(error.message));
  return seen;
};

/* ---------- the way in: a dashboard's card, its Customise row ---------- */
{
  const page = await suite.page('panel=dashboard&state=dashboards', {
    viewport: { width: 412, height: 900 },
  });
  const row = page.locator('fluvy-panel .fv-row', { hasText: 'Customise' }).first();
  check('each dashboard’s card opens with a Customise row', (await row.count()) === 1);
  await row.click();
  await page.waitForSelector('fluvy-panel .cz-top');
  check(
    'a tap opens the section in the tab’s place',
    (await page.locator('.cz-top').count()) === 1,
  );
  check(
    'the address names the dashboard',
    new URL(page.url()).pathname === '/fluvy/dashboard/fluvy-auto',
    page.url(),
  );
  await page.locator('fluvy-panel .cz-top .fv-round').click();
  await settle(page, 200);
  check(
    'the × goes back to the dashboards',
    (await page.locator('fluvy-panel .cz-top').count()) === 0 &&
      new URL(page.url()).pathname === '/fluvy/dashboard',
  );
  await page.close();
}

/* ---------- a phone: rows, a switch, a row unfolded, a list, the sheet ---------- */
{
  const page = await suite.page(CUSTOMISE, { viewport: { width: 360, height: 800 }, wait: 1500 });
  const seen = errors(page);
  const order = await parts(page);
  check(
    'the Home view’s cards are rows in the order they are read',
    order[0] === 'home/attention' && order.includes('home/lights') && order.includes('home/clock'),
    order.slice(0, 4).join(' '),
  );
  const clock = part(page, 'home/clock');
  await clock.locator('.fv-hit').click();
  await settle(page, 200);
  check(
    'a switch hides the card without unfolding its row',
    (await clock.getAttribute('class')).includes('is-off') &&
      (await clock.locator('.cz-detail').count()) === 0,
  );
  check(
    'the apply bar names the change',
    (await barText(page)) === 'Fluvy auto · Customise',
    await barText(page),
  );
  await clock.locator('.fv-hit').click();
  await settle(page, 400);
  check('shown again, nothing waits', (await barText(page)) === '');

  const lights = part(page, 'home/lights');
  await lights.locator(':scope > .fv-row').click();
  await settle(page, 200);
  const buttons = await lights
    .locator(':scope > .cz-detail > .cz-actions .fv-action')
    .evaluateAll((all) =>
      all.map((b) => b.getBoundingClientRect()).map((r) => [r.width, r.height]),
    );
  check(
    'a tap on a row unfolds its buttons, a finger’s 44 each in equal cells',
    buttons.length === 3 &&
      buttons.every(([w, h]) => h === 44 && w >= 44 && w === buttons[0][0] && Number.isInteger(w)),
    JSON.stringify(buttons),
  );
  const at = (await parts(page)).indexOf('home/lights');
  await action(lights, 'Move down').click();
  await settle(page, 200);
  const moved = (await parts(page)).indexOf('home/lights');
  check('a card moved down stands a row lower', moved === at + 1, `${at} → ${moved}`);
  check(
    'and keeps the focus on the button that moved it',
    (await focused(page)) === 'Move down',
    String(await focused(page)),
  );
  await action(lights, 'Move up').click();
  await settle(page, 400);
  check('moved back, nothing waits', (await barText(page)) === '');

  const items = lights.locator('.cz-item');
  const count = await items.count();
  await items.first().locator('.fv-hit').click();
  await settle(page, 200);
  check(
    'an entity switched off is left out, and the row says how much of its list shows',
    (await lights.locator(':scope > .fv-row .fv-row__sub').textContent()).trim() ===
      `Edited · ${count - 1} of ${count} shown`,
    await lights.locator(':scope > .fv-row .fv-row__sub').textContent(),
  );
  const wide = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  check('nothing runs past the phone’s width', !wide);

  await clock.locator(':scope > .fv-row').click();
  await settle(page, 200);
  await page.evaluate(() => {
    window.__keys = [];
    window.addEventListener('keydown', (event) => window.__keys.push(event.key));
  });
  await action(clock, 'Options').click();
  await page.waitForSelector('fluvy-panel dialog.cz-dialog fluvy-rows-editor ha-form');
  await settle(page, 500);
  const sheet = await page.locator('fluvy-panel dialog.cz-dialog').evaluate((dialog) => {
    const box = dialog.querySelector('.cz-sheet').getBoundingClientRect();
    return {
      modal: dialog.matches(':modal'),
      left: box.left,
      width: box.width,
      foot: Math.round(window.innerHeight - box.bottom),
      top: box.top,
    };
  });
  check(
    'Options opens the card’s form in a sheet in the top layer, at the window’s foot',
    sheet.modal && sheet.left === 0 && sheet.width === 360 && sheet.foot === 0 && sheet.top >= 24,
    JSON.stringify(sheet),
  );
  await page.locator('fluvy-panel dialog.cz-dialog ha-form [data-field="face"]').click();
  await settle(page, 300);
  check(
    'a change in the form is the card’s option, counted beside the list’s',
    (await barText(page)) === '2 changes' &&
      (await clock.getAttribute('class')).includes('is-edited'),
    await barText(page),
  );
  await page.keyboard.press('Escape');
  await settle(page, 400);
  check(
    'Escape closes the sheet, kept from the window',
    (await page.locator('fluvy-panel dialog.cz-dialog').count()) === 0 &&
      !(await page.evaluate(() => window.__keys.includes('Escape'))),
  );
  check(
    'the focus goes back to the button that opened it',
    (await focused(page)) === 'Options',
    String(await focused(page)),
  );

  await page.evaluate(() => (window.fluvyMock.wsCalls.length = 0));
  await page.locator('fluvy-panel .pn-bar .fv-btn--accent').click();
  await settle(page, 400);
  const saved = await page.evaluate(
    () =>
      window.fluvyMock.wsCalls.filter((call) => call.type === 'lovelace/config/save').at(-1)
        ?.message ?? null,
  );
  check(
    'Save writes the strategy with the edit: the option and the entity left out, nothing else',
    saved?.url_path === 'fluvy-auto' &&
      saved.config.strategy.type === 'custom:fluvy-home' &&
      JSON.stringify(saved.config.strategy.edit.cards) ===
        JSON.stringify({ 'home/clock': { options: { face: 'analog' } } }) &&
      saved.config.strategy.edit.entities['home/lights'].drop.length === 1 &&
      Object.keys(saved.config.strategy.edit).length === 2,
    JSON.stringify(saved?.config),
  );
  check('the page logged no error', seen.length === 0, seen.join(' | '));
  await page.close();
}

/* ---------- a wide screen: the view drawn beside its rows ---------- */
{
  const page = await suite.page(CUSTOMISE, { viewport: { width: 1400, height: 1000 }, wait: 1800 });
  const seen = errors(page);
  const preview = page.locator('fluvy-panel .pn-aside .cz-preview');
  const drawn = () => preview.evaluate((box) => [...box.children].map((card) => card.localName));
  const before = await drawn();
  check(
    'the open view is drawn beside its rows, its real cards, never to be touched',
    before.length > 8 &&
      before.includes('fluvy-clock-card') &&
      (await preview.getAttribute('inert')) !== null,
    before.join(' '),
  );
  const kept = await preview.evaluate((box) => {
    window.__first = box.querySelector('fluvy-hello-card');
    return window.__first !== null;
  });
  await part(page, 'home/clock').locator('.fv-hit').click();
  await settle(page, 700);
  const after = await drawn();
  check(
    'a card hidden leaves the view as it will be drawn',
    !after.includes('fluvy-clock-card') && after.length === before.length - 1,
    `${before.length} → ${after.length}`,
  );
  check(
    'and the cards that stay are the ones that were there',
    kept &&
      (await preview.evaluate((box) => box.querySelector('fluvy-hello-card') === window.__first)),
  );
  const tabs = page.locator('fluvy-panel .cz-top .fv-chip');
  await tabs.nth(2).click();
  await settle(page, 700);
  const lightsView = await drawn();
  check(
    'another view picked, its cards are drawn in the first one’s place',
    lightsView.includes('fluvy-lights-card') && !lightsView.includes('fluvy-energy-flow-card'),
    lightsView.join(' '),
  );
  check('the page logged no error', seen.length === 0, seen.join(' | '));
  await page.close();
}

console.log(`(${BASE})`);
await suite.finish();
