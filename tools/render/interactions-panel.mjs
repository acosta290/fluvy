#!/usr/bin/env node
/**
 * Interaction tests for the settings panel's dropdown (`<fluvy-select>`, the language field of the Preferences
 * tab) in a real Chromium against the playground. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-panel.mjs
 * What it proves: the field opens its menu in the top layer on a click and on ↓, on the chosen row; ↓ ↓ ↓ Enter
 * chooses and the apply bar names the change; Escape closes with nothing changed, the focus still on the field and
 * the key kept from the window (Home Assistant's dialogs); a tap outside and a scroll close it; at 360 the menu is
 * as wide as the field; in a short viewport it opens over the field, as tall as the room there; letters find a
 * name; Tab chooses and moves on to the next control; a browser without the Popover API draws the same box; the
 * help row opens the translating guide in a new tab; under reduced motion the menu shows and hides without an
 * animation.
 */
import { settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const PREFERENCES = 'panel=preferences';

/** The dropdown's parts on a page of the panel. */
const dropdown = (page) => {
  const select = page.locator('fluvy-panel fluvy-select');
  return {
    select,
    field: select.locator('.fv-select'),
    menu: select.locator('.fv-menu'),
    rows: select.locator('.fv-menu__item'),
    active: select.locator('.fv-menu__item.is-active .fv-menu__name'),
    expanded: async () =>
      (await select.locator('.fv-select').getAttribute('aria-expanded')) === 'true',
    inTopLayer: () => select.locator('.fv-menu').evaluate((menu) => menu.matches(':popover-open')),
  };
};
const barText = async (page) => {
  const bar = page.locator('fluvy-panel .pn-bar__text');
  return (await bar.count()) ? (await bar.textContent()).trim() : '';
};
/** The element that has the focus, through every shadow root: its role and accessible name. */
const focused = (page) =>
  page.evaluate(() => {
    let node = document.activeElement;
    while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
    return node
      ? { role: node.getAttribute('role'), label: node.getAttribute('aria-label') }
      : null;
  });
/** Keys that reach the window (what Home Assistant's own shortcuts and dialogs would see). */
const watchKeys = (page) =>
  page.evaluate(() => {
    window.__keys = [];
    window.addEventListener('keydown', (e) => window.__keys.push(e.key));
  });
const keysSeen = (page) => page.evaluate(() => window.__keys.splice(0));

/* ---------- opening: a click, ↓, the chosen row, the top layer ---------- */
{
  const page = await suite.page(PREFERENCES);
  const d = dropdown(page);
  check(
    'the language field is closed at rest',
    !(await d.expanded()) && (await d.menu.count()) === 0,
  );
  await d.field.click();
  await settle(page, 300);
  check('a click opens the menu', (await d.expanded()) && (await d.menu.count()) === 1);
  check('the menu floats in the top layer', await d.inTopLayer());
  check('it holds Automatic and the eight languages', (await d.rows.count()) === 9);
  const chosen = d.select.locator('.fv-menu__item[aria-selected="true"]');
  check(
    'the chosen row is marked, once',
    (await chosen.count()) === 1 && (await d.rows.nth(0).getAttribute('aria-selected')) === 'true',
  );
  check(
    'the chosen row is the one the keys start from',
    (await d.active.textContent()).trim() === 'Automatic',
  );
  await d.field.click();
  await settle(page, 300);
  check(
    'a click on the field again closes it',
    !(await d.expanded()) && (await d.menu.count()) === 0,
  );
  await d.field.focus();
  await page.keyboard.press('ArrowDown');
  await settle(page, 300);
  check('↓ opens it too', (await d.expanded()) && (await d.menu.count()) === 1);
  check('nothing to apply yet', (await barText(page)) === '');
  await page.close();
}

/* ---------- choosing: ↓ ↓ ↓ Enter, the apply bar ---------- */
{
  const page = await suite.page(PREFERENCES);
  const d = dropdown(page);
  await d.field.focus();
  await page.keyboard.press('ArrowDown');
  await settle(page, 200);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  check('↓ moves the active row', (await d.active.textContent()).trim() === 'Español');
  await page.keyboard.press('Enter');
  await settle(page, 300);
  check('Enter chooses and closes', !(await d.expanded()) && (await d.menu.count()) === 0);
  check('the field shows the choice', (await d.field.textContent()).trim() === 'Español');
  // the panel speaks the chosen language at once, before it is applied: the bar and the field's name follow
  check(
    'the apply bar names the change, in the chosen language',
    (await barText(page)) === 'Idioma · Español',
    await barText(page),
  );
  check(
    'the focus stays on the field',
    (await focused(page))?.label === 'Idioma',
    JSON.stringify(await focused(page)),
  );
  await page.close();
}

/* ---------- Escape: nothing changes, the focus stays, the key stays inside ---------- */
{
  const page = await suite.page(PREFERENCES);
  const d = dropdown(page);
  await d.field.focus();
  await page.keyboard.press('ArrowDown');
  await settle(page, 200);
  await page.keyboard.press('ArrowDown');
  await watchKeys(page);
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check('Escape closes the menu', !(await d.expanded()) && (await d.menu.count()) === 0);
  check(
    'with nothing changed',
    (await d.field.textContent()).trim() === 'Automatic' && (await barText(page)) === '',
  );
  check('and the focus on the field', (await focused(page))?.label === 'Language');
  check('Escape never reaches the window', (await keysSeen(page)).length === 0);
  await page.close();
}

/* ---------- a tap outside, a scroll ---------- */
{
  const page = await suite.page(PREFERENCES, { viewport: { width: 360, height: 640 } });
  const d = dropdown(page);
  await d.field.click();
  await settle(page, 300);
  check('open at 360', await d.expanded());
  await page.locator('fluvy-panel .pn-label').first().click();
  await settle(page, 300);
  check('a tap outside closes it', !(await d.expanded()) && (await d.menu.count()) === 0);
  await d.field.click();
  await settle(page, 300);
  await page.mouse.wheel(0, 120);
  await settle(page, 300);
  check('a scroll of the page closes it', !(await d.expanded()) && (await d.menu.count()) === 0);
  await page.close();
}

/* ---------- geometry: as wide as the field at 360; above the field in a short viewport ---------- */
{
  const page = await suite.page(PREFERENCES, { viewport: { width: 360, height: 800 } });
  const d = dropdown(page);
  await d.field.click();
  await settle(page, 300);
  const field = await d.field.boundingBox();
  const menu = await d.menu.boundingBox();
  check(
    'the menu is as wide as the field, 4 under it',
    Math.abs(menu.width - field.width) < 1 &&
      Math.abs(menu.x - field.x) < 1 &&
      Math.abs(menu.y - (field.y + field.height + 4)) < 1,
    `field ${field.x},${field.width} menu ${menu.x},${menu.width} gap ${menu.y - field.y - field.height}`,
  );
  check(
    'eight rows: 8 + 8 × 44 tall',
    Math.abs(menu.height - 360) < 1 && (await d.menu.getAttribute('data-placement')) === 'below',
    `${menu.height}`,
  );
  await page.close();
}
{
  const page = await suite.page(PREFERENCES, { viewport: { width: 740, height: 400 } });
  const d = dropdown(page);
  await d.field.click();
  await settle(page, 300);
  const field = await d.field.boundingBox();
  const menu = await d.menu.boundingBox();
  const placement = await d.menu.getAttribute('data-placement');
  check(
    'in a short viewport it opens over the field, as tall as the room there',
    placement === 'above' &&
      menu.y >= 15 &&
      Math.abs(menu.y + menu.height - (field.y - 4)) < 1 &&
      menu.height < 360,
    `${placement} top ${menu.y} height ${menu.height} field ${field.y}`,
  );
  check(
    'the rows beyond scroll inside the menu',
    await d.menu.evaluate((m) => m.scrollHeight > m.clientHeight),
  );
  await page.close();
}

/* ---------- letters, Tab ---------- */
{
  const page = await suite.page(PREFERENCES);
  const d = dropdown(page);
  await d.field.focus();
  await page.keyboard.press('p');
  await settle(page, 200);
  check(
    'a letter opens on the first name starting with it',
    (await d.active.textContent()).trim() === 'Português',
  );
  await page.keyboard.type('es'); // "pes": no such name, the row stays
  await settle(page, 100);
  check(
    'letters that spell no name leave the row',
    (await d.active.textContent()).trim() === 'Português',
  );
  await settle(page, 600); // a pause starts a new word
  await page.keyboard.type('es');
  await settle(page, 100);
  check('more letters spell a word', (await d.active.textContent()).trim() === 'Español');
  await page.keyboard.press('Escape');
  await settle(page, 300);
  await page.keyboard.press('ArrowDown');
  await settle(page, 200);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Tab');
  await settle(page, 300);
  const next = await focused(page);
  check(
    'Tab chooses the row and moves on to the next control',
    (await barText(page)) === 'Language · English' &&
      next?.role === 'switch' &&
      next?.label === 'Reduce motion',
    JSON.stringify(next),
  );
  await page.close();
}

/* ---------- without the Popover API: the same box ---------- */
{
  const withTopLayer = await suite.page(`${PREFERENCES}&state=menu`, {
    viewport: { width: 360, height: 800 },
  });
  const without = await suite.page(`${PREFERENCES}&state=menu&nopopover=1`, {
    viewport: { width: 360, height: 800 },
  });
  const a = dropdown(withTopLayer);
  const b = dropdown(without);
  check(
    'the page opens the menu on its own (?state=menu)',
    (await a.expanded()) && (await b.expanded()),
  );
  check(
    'no Popover API on the second page, so no popover attribute either',
    await b.menu.evaluate(
      (m) => typeof m.showPopover === 'undefined' && !m.hasAttribute('popover'),
    ),
  );
  const boxA = await a.menu.boundingBox();
  const boxB = await b.menu.boundingBox();
  check(
    'a browser without the Popover API draws the menu in the same box',
    ['x', 'y', 'width', 'height'].every((k) => Math.abs(boxA[k] - boxB[k]) < 1),
    `${JSON.stringify(boxA)} vs ${JSON.stringify(boxB)}`,
  );
  // the last row lies over the panel's own rows: a tap there must reach the menu, not the switch under it
  const last = await b.rows.nth(7).boundingBox();
  await without.mouse.click(last.x + last.width / 2, last.y + last.height / 2);
  await settle(without, 300);
  check(
    'and over what follows: a tap on its last row chooses',
    (await b.field.textContent()).trim() === 'Português' && !(await b.expanded()),
    (await b.field.textContent()).trim(),
  );
  await withTopLayer.close();
  await without.close();
}

/* ---------- the help row ---------- */
{
  const page = await suite.page(PREFERENCES);
  await page.evaluate(() => {
    window.__opened = [];
    window.open = (url, target, features) => {
      window.__opened.push({ url, target, features });
      return null;
    };
  });
  await page
    .locator('fluvy-panel .fv-row--tap', { hasText: 'Help improve this translation' })
    .click();
  const opened = await page.evaluate(() => window.__opened);
  check(
    'the help row opens the translating guide in a new tab',
    opened.length === 1 &&
      opened[0].url.endsWith('/docs/translating.md') &&
      opened[0].target === '_blank' &&
      opened[0].features === 'noopener',
    JSON.stringify(opened),
  );
  await page.close();
}

/* ---------- reduced motion ---------- */
{
  const page = await suite.page(PREFERENCES);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const d = dropdown(page);
  await d.field.click();
  await settle(page, 100);
  check(
    'under reduced motion the menu appears without an animation',
    (await d.select.getAttribute('reduced-motion')) !== null &&
      (await d.menu.evaluate((m) => getComputedStyle(m).animationName)) === 'none',
  );
  await page.keyboard.press('Escape');
  await settle(page, 50);
  check('and goes at once', (await d.menu.count()) === 0);
  await page.close();
}

await suite.finish();
