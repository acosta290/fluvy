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
 * And 1.21's (#188): every row has a handle, a finger's 44 that takes no scroll; a row dragged by it with a real
 * mouse is lifted where it stands (the accent's ring, the 16 radius), lands where it is dropped and is written as one
 * place; a finger drags one the same way, and the page stays still under it; a list's entities and the dashboard's
 * tabs are dragged too, the tabs unfolded under the view's place among them; a card goes to the top in one press,
 * the focus kept on its button; a page that asks for less motion slides no row; a view of many cards is searched;
 * "Add a card" opens a sheet with three ways — a card of another view shown here as well, one of Fluvy's made in its
 * own form and drawn over it, YAML — and Save writes them (`also`, `add`); someone who is no administrator fetches
 * nothing of Customise; and Home Assistant's pencil gets the strategy's form, which leads to Customise and writes a
 * choice as the panel does.
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
    'a tap on a row unfolds its buttons (its four moves and its reset), a finger’s 44 each in equal cells',
    buttons.length === 5 &&
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

/* ====================== 1.21 (#188): drag and drop, Top and Bottom, adding a card, the pencil ====================== */

/** What Save writes: the dashboard's `edit`, as the last `lovelace/config/save` carries it. */
const saved = async (page) => {
  await page.evaluate(() => (window.fluvyMock.wsCalls.length = 0));
  await page.locator('fluvy-panel .pn-bar .fv-btn--accent').click();
  await settle(page, 400);
  return page.evaluate(
    () =>
      window.fluvyMock.wsCalls.filter((call) => call.type === 'lovelace/config/save').at(-1)
        ?.message?.config?.strategy?.edit ?? null,
  );
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const grip = (row) => row.locator(':scope > .fv-row > .cz-grip');
const centre = async (locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
};
/** A row held by its handle with the mouse and carried to the middle of another row, as a hand does: in steps. */
const carry = async (page, from, to, { hold } = {}) => {
  const start = await centre(grip(from));
  const end = await centre(to);
  // a handle is 44 wide from the gutter: its dots stand at its start
  await page.mouse.move(start.box.x + 10, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 16; step++) {
    await page.mouse.move(start.box.x + 10, start.y + ((end.y - start.y) * step) / 16);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(250);
  const held = hold ? await hold() : undefined;
  await page.mouse.up();
  await settle(page, 400);
  return held;
};

/* ---------- a desktop: a card, an entity and a tab dragged with the mouse; Top; less motion ---------- */
{
  const page = await suite.page(CUSTOMISE, { viewport: { width: 1400, height: 1000 }, wait: 1800 });
  const seen = errors(page);
  const order = await parts(page);
  const handle = await grip(part(page, 'home/appliances')).evaluate((node) => {
    const box = node.getBoundingClientRect();
    const row = node.parentElement.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      width: box.width,
      tall: box.height === row.height,
      before: row.left - box.left,
      touch: style.touchAction,
      cursor: style.cursor,
      hidden: node.getAttribute('aria-hidden'),
    };
  });
  check(
    'every row has a handle in the gutter before its circle: a finger’s 44, the row’s height, no scroll of its own',
    handle.width === 44 &&
      handle.tall &&
      handle.before === 20 &&
      handle.touch === 'none' &&
      handle.cursor === 'grab' &&
      handle.hidden === 'true' &&
      (await page.locator('fluvy-panel .cz-parts > .cz-part > .fv-row > .cz-grip').count()) ===
        order.length,
    JSON.stringify(handle),
  );
  check(
    'the list is Home Assistant’s own sorting, without its styles',
    await page
      .locator('fluvy-panel .cz-parts')
      .evaluate(
        (list) =>
          list.parentElement.localName === 'ha-sortable' &&
          list.parentElement.hasAttribute('no-style') &&
          list.parentElement.options === undefined,
      ),
  );

  // the third card carried up to the first one's place
  const lifted = await carry(page, part(page, 'home/appliances'), part(page, 'home/attention'), {
    hold: () =>
      part(page, 'home/appliances').evaluate((row) => {
        const style = getComputedStyle(row);
        return {
          chosen: row.classList.contains('sortable-chosen'),
          ring: style.boxShadow.includes('inset') && style.boxShadow !== 'none',
          radius: style.borderTopLeftRadius,
          first: row.parentElement.querySelector('.cz-part') === row,
        };
      }),
  });
  check(
    'a row dragged by its handle is lifted where it stands: the accent’s ring, the 16 radius, already where it will land',
    lifted.chosen && lifted.ring && lifted.radius === '16px' && lifted.first,
    JSON.stringify(lifted),
  );
  check(
    'dropped, it stands where it was dropped and wears nothing of the drag',
    (await parts(page))[0] === 'home/appliances' &&
      (await parts(page)).length === order.length &&
      !(await part(page, 'home/appliances').getAttribute('class')).includes('sortable'),
    (await parts(page)).slice(0, 4).join(' '),
  );
  check('the apply bar names the change', (await barText(page)) === 'Fluvy auto · Customise');

  // a list's entities
  const lights = part(page, 'home/lights');
  await lights.locator(':scope > .fv-row').click();
  await settle(page, 300);
  const items = () =>
    lights.locator('.cz-item').evaluateAll((rows) => rows.map((row) => row.dataset.item));
  const entities = await items();
  await carry(
    page,
    lights.locator(`.cz-item[data-item="${entities[2]}"]`),
    lights.locator(`.cz-item[data-item="${entities[0]}"]`),
  );
  check(
    'an entity dragged to the head of its list leads it',
    (await items())[0] === entities[2] && (await items()).length === entities.length,
    (await items()).join(' '),
  );
  await lights.locator(':scope > .fv-row').click();
  await settle(page, 200);

  // the tabs, unfolded under the view's place among them
  await page.locator('fluvy-panel .cz-place > .fv-row .fv-row__title').click();
  await settle(page, 300);
  const tabs = () =>
    page
      .locator('fluvy-panel .cz-place .cz-item')
      .evaluateAll((rows) => rows.map((row) => row.dataset.view));
  const before = await tabs();
  check(
    'a tap on the view’s place among the tabs unfolds them, a row a tab',
    before.length === 9 && before[0] === 'home' && before[2] === 'lights',
    before.join(' '),
  );
  await carry(
    page,
    page.locator('fluvy-panel .cz-place .cz-item[data-view="lights"]'),
    page.locator('fluvy-panel .cz-place .cz-item[data-view="home"]'),
  );
  check(
    'a tab dragged first leads the tabs, and the chips over them',
    (await tabs())[0] === 'lights' &&
      (await page.locator('fluvy-panel .cz-top .fv-chip').first().textContent()).trim() ===
        'Lights',
    (await tabs()).join(' '),
  );
  await page.locator('fluvy-panel .cz-place .cz-item[data-view="media"] .fv-hit').click();
  await settle(page, 200);

  // the scenes, last on Home, first in one press
  const scenes = part(page, 'home/scenes');
  await scenes.locator(':scope > .fv-row').click();
  await settle(page, 200);
  await action(scenes, 'Move to the top').click();
  await settle(page, 300);
  check(
    'Top puts the last card first in one press',
    (await parts(page))[0] === 'home/scenes',
    (await parts(page)).slice(0, 3).join(' '),
  );
  check(
    'and the focus stays among its buttons: at the top, on the nearest move that still has somewhere to go',
    (await focused(page)) === 'Move down',
    String(await focused(page)),
  );

  const edit = await saved(page);
  check(
    'Save writes each as the fewest places: one a card, one the entity put first, one the tab, and the view hidden',
    same(edit?.cards, { 'home/appliances': { order: 1 }, 'home/scenes': { order: 0 } }) &&
      same(edit?.entities, { 'home/lights': { order: [entities[2]] } }) &&
      same(edit?.views, { lights: { order: 0 }, media: { hidden: true } }),
    JSON.stringify(edit),
  );
  check('the page logged no error', seen.length === 0, seen.join(' | '));
  await page.close();

  const still = await suite.page(CUSTOMISE, {
    viewport: { width: 1400, height: 1000 },
    wait: 1800,
    reducedMotion: 'reduce',
  });
  check(
    'a page that asks for less motion slides no row out of the way',
    await still
      .locator('fluvy-panel .cz-parts')
      .evaluate((list) => list.parentElement.options?.animation === 0),
  );
  await still.close();
}

/* ---------- a phone: a row dragged by a finger; the search; the sheet "Add a card" ---------- */
{
  const page = await suite.page(CUSTOMISE, {
    viewport: { width: 360, height: 800 },
    wait: 1500,
    touch: true,
  });
  const seen = errors(page);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x: Math.round(x), y: Math.round(y) }],
    });
  const from = await centre(grip(part(page, 'home/covers')));
  const to = await centre(part(page, 'home/attention'));
  const scroll = () => page.evaluate(() => window.scrollY);
  const at = await scroll();
  await touch('touchStart', from.box.x + 12, from.y);
  await page.waitForTimeout(120);
  for (let step = 1; step <= 16; step++) {
    await touch('touchMove', from.box.x + 12, from.y + ((to.y - 6 - from.y) * step) / 16);
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(250);
  const mid = await part(page, 'home/covers')
    .first()
    .evaluate((row) => ({
      chosen: row.classList.contains('sortable-chosen'),
      first: row.parentElement.querySelector('.cz-part') === row,
      copy: getComputedStyle(row.parentElement.querySelector('.sortable-fallback') ?? row).display,
    }));
  const moved = await scroll();
  await touch('touchEnd', from.box.x + 12, to.y);
  await settle(page, 400);
  check(
    'a finger drags a row by its handle: lifted, it travels from place to place, and the page stays still under it',
    mid.chosen && mid.first && moved === at,
    `${JSON.stringify(mid)} · scroll ${at} → ${moved}`,
  );
  check(
    'what follows the finger is the row itself: Home Assistant’s copy of it stays unseen',
    mid.copy === 'none',
    mid.copy,
  );
  check(
    'dropped, it leads the view',
    (await parts(page))[0] === 'home/covers' && (await parts(page)).length === 16,
    (await parts(page)).slice(0, 3).join(' '),
  );

  // a view of many cards is searched
  const field = page.locator('fluvy-panel .cz-view .cz-search input');
  await field.fill('sce');
  await settle(page, 200);
  check(
    'a view of many cards has a search field: what is typed narrows its rows',
    same(await parts(page), ['home/scenes']),
    (await parts(page)).join(' '),
  );
  await field.fill('');
  await settle(page, 200);

  // the sheet: a card of another view, shown here as well
  await page.locator('fluvy-panel .cz-view .fv-row', { hasText: 'Add a card' }).click();
  await page.waitForSelector('fluvy-panel dialog.cz-dialog .cz-sheet');
  await settle(page, 400);
  const sheet = page.locator('fluvy-panel dialog.cz-dialog .cz-sheet');
  const ways = await sheet.locator('.fv-chip').allTextContents();
  check(
    '"Add a card" opens a sheet in the top layer with three ways, the dashboard’s own cards first',
    (await page.locator('fluvy-panel dialog.cz-dialog').evaluate((d) => d.matches(':modal'))) &&
      same(
        ways.map((way) => way.trim()),
        ['This dashboard', 'Fluvy’s cards', 'YAML'],
      ) &&
      (await sheet.locator('.cz-pair .fv-btn').first().isDisabled()),
    ways.join(' | '),
  );
  await sheet.locator('.cz-search input').fill('scenes');
  await settle(page, 200);
  const groups = (await sheet.locator('.cz-label').allTextContents()).map((label) => label.trim());
  check(
    'what is typed finds the rooms’ own scenes, each under its room',
    groups.includes('Kitchen') && groups.includes('Living room') && !groups.includes('Home'),
    groups.join(' | '),
  );
  await sheet
    .locator('.cz-label', { hasText: 'Kitchen' })
    .locator('xpath=following-sibling::div[1]')
    .locator('.fv-row')
    .first()
    .click();
  await settle(page, 200);
  const pair = await sheet
    .locator('.cz-pair .fv-btn')
    .evaluateAll((buttons) =>
      buttons.map((button) => [button.getBoundingClientRect().width, button.disabled]),
    );
  check(
    'one picked, the equal pair can act: Move here and Show here too',
    pair.length === 2 && pair[0][0] === pair[1][0] && !pair[0][1] && !pair[1][1],
    JSON.stringify(pair),
  );
  await sheet.locator('.cz-pair .fv-btn--accent').click();
  await settle(page, 500);
  const taken = part(page, 'home/also:room-kitchen/scenes');
  check(
    'shown here too, it is a row of the view that says where it comes from',
    (await taken.count()) === 1 &&
      (await taken.locator('.fv-row__title').textContent()).trim() === 'Scenes' &&
      (await taken.locator('.fv-row__sub').textContent()).trim() === 'From Kitchen',
    (await parts(page)).at(-1),
  );

  // one of Fluvy's cards, made in its own form
  await page.locator('fluvy-panel .cz-view .fv-row', { hasText: 'Add a card' }).click();
  await page.waitForSelector('fluvy-panel dialog.cz-dialog .cz-sheet');
  await settle(page, 400);
  await sheet.locator('.fv-chip').nth(1).click();
  await settle(page, 300);
  await sheet.locator('.cz-search input').fill('dimmer');
  await settle(page, 200);
  await sheet.locator('.fv-row__title', { hasText: /^Light$/ }).click();
  await page.waitForSelector('fluvy-panel dialog.cz-dialog fluvy-rows-editor ha-form');
  await settle(page, 600);
  const made = await sheet.evaluate((node) => {
    const card = node.querySelector('.cz-sheet__card > fluvy-light-card');
    return {
      title: node.querySelector('.fv-card__title')?.textContent?.trim(),
      drawn: (card?.getBoundingClientRect().height ?? 0) > 100,
      inert: node.querySelector('.cz-sheet__card')?.hasAttribute('inert') ?? false,
      add: [...node.querySelectorAll('.cz-pair .fv-btn')].at(-1)?.disabled,
    };
  });
  check(
    'a card of Fluvy’s opens in its own form, drawn over it as it will be and never touched',
    made.title === 'Light' && made.drawn && made.inert && made.add === false,
    JSON.stringify(made),
  );
  await sheet.locator('.cz-pair .fv-btn--accent').click();
  await settle(page, 500);
  check(
    'added, it is a row of the view, after the one taken from the kitchen',
    (await parts(page)).at(-2) === 'home/own:0' &&
      (await parts(page)).at(-1) === 'home/also:room-kitchen/scenes',
    (await parts(page)).slice(-2).join(' '),
  );
  check(
    'nothing runs past the phone’s width',
    !(await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )),
  );

  const edit = await saved(page);
  check(
    'Save writes them: the finger’s place, the card shown as well, and the new card with what its form held',
    same(edit?.cards, { 'home/covers': { order: 0 } }) &&
      same(edit?.views?.home?.also, ['room-kitchen/scenes']) &&
      edit?.views?.home?.add?.length === 1 &&
      edit.views.home.add[0].type === 'custom:fluvy-light-card' &&
      /^light\./.test(edit.views.home.add[0].entity),
    JSON.stringify(edit),
  );
  check('the page logged no error', seen.length === 0, seen.join(' | '));
  await page.close();
}

/* ---------- someone who is no administrator: nothing of Customise is fetched ---------- */
{
  /** A page opened on a link to Customise, and the files of Customise it asked the server for. */
  const opened = async (query) => {
    const page = await suite.browser.newPage({ viewport: { width: 412, height: 900 } });
    const files = [];
    page.on('request', (request) => {
      if (request.url().includes('/panel/customise/')) files.push(request.url());
    });
    await page.goto(`${BASE}?${query}`);
    await page.waitForSelector('html[data-ready="1"]');
    await page.waitForTimeout(1500);
    return { page, files };
  };
  const guest = await opened('panel=dashboard&state=dashboards,customise,guest');
  const admin = await opened(CUSTOMISE);
  check(
    'a link to Customise opened by someone who is no administrator fetches none of its files',
    guest.files.length === 0 &&
      admin.files.length > 0 &&
      (await guest.page.locator('fluvy-panel .cz-top').count()) === 0,
    `${guest.files.length} for a guest, ${admin.files.length} for an administrator`,
  );
  await guest.page.close();
  await admin.page.close();
}

/* ---------- Home Assistant's pencil: the strategy's own form in its dialog ---------- */
{
  const page = await suite.page('panel=dashboard&state=pencil', {
    viewport: { width: 412, height: 900 },
    wait: 1200,
  });
  const seen = errors(page);
  const form = page.locator('fluvy-strategy-form');
  const link = await form.locator('a').evaluate((a) => ({
    href: a.getAttribute('href'),
    target: a.target,
    height: a.getBoundingClientRect().height,
    title: a.querySelector('.title')?.textContent,
  }));
  check(
    'the strategy answers Home Assistant’s pencil with a form whose first row leads to Customise on that dashboard',
    link.href === '/fluvy/dashboard/fluvy-auto' &&
      link.target === '' &&
      link.height >= 44 &&
      link.title === 'Customise',
    JSON.stringify(link),
  );
  const fields = await form
    .locator('ha-form [data-field]')
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.field));
  check(
    'under it, the dashboard’s most used options: its views and its first three choices',
    same(fields, ['views', 'thermostat_variant', 'tile_size', 'tile_switch']),
    fields.join(' '),
  );
  const held = () => page.evaluate(() => window.fluvyPencil.config);
  await form.locator('ha-form [data-field="tile_size"]').click();
  await settle(page, 200);
  const once = await held();
  await form.locator('ha-form [data-field="tile_size"]').click();
  await settle(page, 200);
  const twice = await held();
  check(
    'a choice is written as the panel writes it: its default is no key, and the rest stays',
    once.tile_size === 'compact' &&
      !('tile_size' in twice) &&
      same(twice, { type: 'custom:fluvy-home', hide: ['agenda'] }),
    `${JSON.stringify(once)} → ${JSON.stringify(twice)}`,
  );
  await form.locator('ha-form [data-field="views"]').click();
  await settle(page, 200);
  check(
    'a view switched back on leaves `hide`, which goes with its last one',
    same(await held(), { type: 'custom:fluvy-home' }),
    JSON.stringify(await held()),
  );
  check('the page logged no error', seen.length === 0, seen.join(' | '));
  await page.close();
}

console.log(`(${BASE})`);
await suite.finish();
