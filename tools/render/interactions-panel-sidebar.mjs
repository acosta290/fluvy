#!/usr/bin/env node
/**
 * Interaction tests for a dashboard's sidebar in the settings panel (1.21, #187), the Dashboards tab's section that
 * writes `fluvy_sidebar:` without YAML, in a real Chromium against the playground (the demo home). Exit code 1 on any
 * failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-panel-sidebar.mjs
 * What it proves: a dashboard's card opens it with a tap on its Sidebar row, and the address names the dashboard; it
 * has none until one is chosen, and nothing waits in the bar; *Clock and pages* draws it in the section's picture and
 * is an edit for the bar; where it stands follows the chips (its side, its surface), each device's default width
 * marked; *Your own* opens what it holds, the menu off takes its pages out of the picture and the tabs' row with them,
 * and a list's cards open in Home Assistant's YAML field where its stack editor is not to be had; Save writes it
 * beside the strategy, and the dashboard's row then says it has one; the first card leads to the dashboards of the
 * person's own; a dashboard kept in a YAML file is given the YAML to copy and nothing to save; in every language the
 * three tiles and the chips say their words whole and nothing runs past its card, on a desktop and on a 360 phone;
 * the page logs no error.
 */
import { BASE, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const LANGUAGES = [
  'en',
  'de',
  'es',
  'fr',
  'hu',
  'it',
  'ja',
  'nl',
  'pl',
  'pt-BR',
  'pt-PT',
  'ru',
  'sk',
  'tr',
  'uk',
  'zh-Hans',
];
const exact = (text) => new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
const tile = (page, name) =>
  page.locator('fluvy-panel .se-kinds .fv-option', {
    has: page.locator('.fv-option__value', { hasText: exact(name) }),
  });
const chip = (page, text) => page.locator('fluvy-panel .fv-chip', { hasText: exact(text) }).first();
const row = (page, title) =>
  page
    .locator('fluvy-panel .fv-row', {
      has: page.locator('.fv-row__title', { hasText: exact(title) }),
    })
    .first();
const card = (page, title) =>
  page.locator('fluvy-panel .pn-card', {
    has: page.locator('.fv-card__title', { hasText: exact(title) }),
  });
const pressed = async (locator) => (await locator.getAttribute('aria-pressed')) === 'true';
const barText = async (page) => {
  const bar = page.locator('fluvy-panel .pn-foot:not(.is-leaving) .pn-bar__text');
  return (await bar.count()) ? (await bar.textContent()).trim() : '';
};
const saves = (page) =>
  page.evaluate(() =>
    window.fluvyMock.wsCalls
      .filter((call) => call.type === 'lovelace/config/save')
      .map((call) => call.message),
  );
const errors = (page) => {
  const seen = [];
  page.on('console', (message) => {
    if (message.type() === 'error') seen.push(message.text());
  });
  page.on('pageerror', (error) => seen.push(error.message));
  return seen;
};

/* ---------- the way in, none until chosen, the ready-made one, their own, Save ---------- */
{
  const page = await suite.page('panel=dashboard&state=dashboards', {
    viewport: { width: 1280, height: 1000 },
  });
  const seen = errors(page);
  const way = row(page, 'Sidebar');
  check('each automatic dashboard’s card has a Sidebar row', (await way.count()) === 1);
  check(
    'which says what it would give while the dashboard has none',
    (await way.locator('.fv-row__sub').textContent()).trim() ===
      'A clock, its pages and your cards beside its views',
  );
  await way.click();
  await page.waitForSelector('fluvy-panel .se-kinds');
  check(
    'a tap opens the section, and the address names the dashboard',
    new URL(page.url()).pathname === '/fluvy/dashboard/fluvy-auto/sidebar',
    page.url(),
  );
  check(
    'it has none until one is chosen',
    (await pressed(tile(page, 'None'))) &&
      (await page.locator('fluvy-panel .se-mock__side').count()) === 0 &&
      (await card(page, 'Place').count()) === 0,
  );
  check('and nothing waits in the bar', (await barText(page)) === '');
  const boxes = await page
    .locator('fluvy-panel .se-kinds .fv-option')
    .evaluateAll((tiles) => tiles.map((el) => el.getBoundingClientRect().toJSON()));
  check(
    'the three choices are tiles of one size in one row',
    boxes.length === 3 &&
      boxes.every(
        (box) =>
          Math.abs(box.width - boxes[0].width) < 0.5 &&
          Math.abs(box.height - boxes[0].height) < 0.5 &&
          Math.abs(box.top - boxes[0].top) < 0.5,
      ),
    boxes.map((box) => `${Math.round(box.width)}×${Math.round(box.height)}`).join(' '),
  );

  await tile(page, 'Clock and pages').click();
  await settle(page, 300);
  check(
    'Clock and pages draws it in the picture: a panel at the start, its pages, its head and its foot',
    (await pressed(tile(page, 'Clock and pages'))) &&
      (await page
        .locator('fluvy-panel .se-mock__row:not(.is-end) .se-mock__side--panel')
        .count()) === 1 &&
      (await page.locator('fluvy-panel .se-mock__page').count()) === 3 &&
      (await page.locator('fluvy-panel .se-mock__block').count()) === 2,
  );
  check('and is an edit for the bar', (await barText(page)) === 'Fluvy auto · Sidebar');
  check(
    'where it stands opens under it, what it holds does not',
    (await card(page, 'Place').count()) === 1 && (await card(page, 'Cards').count()) === 0,
  );
  const place = card(page, 'Place');
  const marked = await place
    .locator('.fv-chip.is-active, .fv-chip[aria-pressed="true"]')
    .evaluateAll((chips) => chips.map((el) => el.textContent.trim()));
  check(
    'each choice is marked where the sidebar stands by itself: the start, a panel, 280 and 320, none on a phone',
    marked.join('|') === 'At the start|Panel|280|320|None',
    marked.join('|'),
  );
  await chip(page, 'At the end').click();
  await chip(page, 'Card').click();
  await settle(page, 300);
  check(
    'its side and its surface follow the chips in the picture',
    (await page.locator('fluvy-panel .se-mock__row.is-end .se-mock__side--card').count()) === 1,
  );
  const sideBox = await page.locator('fluvy-panel .se-mock__side').boundingBox();
  const viewBox = await page.locator('fluvy-panel .se-mock__view').boundingBox();
  check(
    'at the end it is drawn after the view',
    sideBox.x > viewBox.x,
    `${sideBox.x} ${viewBox.x}`,
  );

  await tile(page, 'Your own').click();
  await settle(page, 1200);
  const cards = card(page, 'Cards');
  check('Your own opens what it holds', (await cards.count()) === 1);
  const lists = await cards
    .locator('.fv-chip')
    .evaluateAll((chips) => chips.map((el) => el.textContent.trim()));
  check(
    'its three lists say how many cards each has',
    lists.join('|') === 'Head · 1|Middle|Foot · 1',
    lists.join('|'),
  );
  const yamlOf = () =>
    cards
      .locator('ha-selector.se-yaml')
      .evaluate((el) => el.shadowRoot.querySelector('.code')?.textContent ?? '');
  check(
    'a list opens in Home Assistant’s YAML field where its stack editor is not to be had: the head’s clock',
    (await yamlOf()).includes('type: custom:fluvy-clock-card'),
    await yamlOf(),
  );
  await chip(page, 'Foot · 1').click();
  await settle(page, 300);
  check(
    'another list, its own cards: the foot’s alerts',
    (await yamlOf()).includes('type: custom:fluvy-alerts-card') &&
      !(await yamlOf()).includes('fluvy-clock-card'),
  );
  check(
    'the tabs may give way while the menu is the dashboard’s views',
    (await row(page, 'Hide the header’s tabs').count()) === 1,
  );
  await row(page, 'Pages menu').locator('[role="switch"]').click();
  await settle(page, 300);
  check(
    'the menu off takes its pages out of the picture, and the tabs’ row with them',
    (await page.locator('fluvy-panel .se-mock__page').count()) === 0 &&
      (await row(page, 'Hide the header’s tabs').count()) === 0,
  );

  await page.locator('fluvy-panel .pn-bar button', { hasText: 'Save' }).click();
  await settle(page, 700);
  const written = (await saves(page)).at(-1);
  check(
    'Save writes it beside the strategy: only what was chosen',
    written?.url_path === 'fluvy-auto' &&
      written.config.strategy?.type === 'custom:fluvy-home' &&
      written.config.fluvy_sidebar?.position === 'end' &&
      written.config.fluvy_sidebar?.style === 'card' &&
      !('menu' in written.config.fluvy_sidebar) &&
      !('width' in written.config.fluvy_sidebar) &&
      !('phone' in written.config.fluvy_sidebar),
    JSON.stringify(written?.config?.fluvy_sidebar ?? null).slice(0, 160),
  );
  check('and the bar goes', (await barText(page)) === '');
  await page.locator('fluvy-panel .pn-card .fv-round[aria-label="Close"]').first().click();
  await settle(page, 300);
  check(
    'the × goes back to the dashboards, whose row says it has one',
    new URL(page.url()).pathname === '/fluvy/dashboard' &&
      (await row(page, 'Sidebar').locator('.fv-row__sub').textContent()).trim() ===
        'Beside its views, on every one',
    page.url(),
  );

  const others = row(page, 'Other dashboards');
  check('the first card leads to the dashboards of the person’s own', (await others.count()) === 1);
  await others.click();
  await settle(page, 400);
  check(
    'and opens the first of them, none chosen',
    new URL(page.url()).pathname === '/fluvy/dashboard/lovelace/sidebar' &&
      (await pressed(tile(page, 'None'))),
    page.url(),
  );
  await chip(page, 'Fluvy auto').click();
  await settle(page, 400);
  check(
    'a dashboard’s chip opens its own, as it was saved',
    new URL(page.url()).pathname === '/fluvy/dashboard/fluvy-auto/sidebar' &&
      (await pressed(tile(page, 'Your own'))) &&
      (await page.locator('fluvy-panel .se-mock__row.is-end .se-mock__side--card').count()) === 1,
  );
  check('the page logged no error', seen.length === 0, seen.join(' | '));
  await page.close();
}

/* ---------- a dashboard kept in a YAML file ---------- */
{
  const page = await suite.page('panel=dashboard&state=sideyaml', {
    viewport: { width: 1280, height: 1000 },
  });
  const seen = errors(page);
  await page
    .context()
    .grantPermissions(['clipboard-read', 'clipboard-write'])
    .catch(() => undefined);
  await page.waitForSelector('fluvy-panel .se-kinds');
  check(
    'opened by its address, it has no YAML to show until a sidebar is chosen',
    (await page.locator('fluvy-panel .se-code').count()) === 0,
  );
  await tile(page, 'Clock and pages').click();
  await chip(page, 'Drawer').click();
  await settle(page, 300);
  const code = await page.locator('fluvy-panel .se-code').textContent();
  check(
    'a sidebar chosen is the YAML to write in its file',
    code.startsWith(
      'fluvy_sidebar:\n  header:\n    cards:\n      - type: custom:fluvy-clock-card',
    ) && code.includes('\n  phone: drawer'),
    code.slice(0, 80).replace(/\n/g, '⏎'),
  );
  check('and nothing for the bar: the panel cannot save it', (await barText(page)) === '');
  const copy = card(page, 'YAML').locator('.fv-btn');
  await copy.click();
  await settle(page, 300);
  const clip = await page.evaluate(() => window.navigator.clipboard.readText()).catch(() => null);
  check(
    'Copy puts it on the clipboard and says so',
    (await copy.textContent()).trim() === 'YAML copied' && (clip === null || clip === code),
    (await copy.textContent()).trim(),
  );
  check('no save was asked of Home Assistant', (await saves(page)).length === 0);
  check('the page logged no error', seen.length === 0, seen.join(' | '));
  await page.close();
}

/* ---------- every language, a desktop and a 360 phone ---------- */
{
  const faults = [];
  for (const width of [1280, 360])
    for (const lang of LANGUAGES) {
      const page = await suite.page(`panel=dashboard&state=sidebar,sideown&lang=${lang}`, {
        viewport: { width, height: 900 },
        wait: 500,
      });
      await page.waitForSelector('fluvy-panel .se-kinds');
      await settle(page, 900);
      const found = await page.evaluate(() => {
        const root = document.querySelector('fluvy-panel').shadowRoot;
        const cut = [
          ...root.querySelectorAll(
            '.se-kinds .fv-option__label, .se-kinds .fv-option__value, .pn-body .fv-chip, .pn-body .fv-label',
          ),
        ]
          .filter(
            (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
          )
          .map((el) => el.textContent.trim());
        const past = [...root.querySelectorAll('.pn-body .pn-card')].flatMap((box) => {
          const edge = box.getBoundingClientRect();
          return [...box.querySelectorAll('*')]
            .filter((el) => {
              const rect = el.getBoundingClientRect();
              return (
                rect.width > 0 && (rect.right > edge.right + 0.5 || rect.left < edge.left - 0.5)
              );
            })
            .map((el) => String(el.className));
        });
        return {
          cut,
          past,
          tiles: root.querySelectorAll('.se-kinds .fv-option').length,
          scroll: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      if (found.tiles !== 3) faults.push(`${lang}@${width}: ${found.tiles} tiles`);
      if (found.cut.length) faults.push(`${lang}@${width} cut: ${found.cut.join(' / ')}`);
      if (found.past.length) faults.push(`${lang}@${width} past its card: ${found.past.join(' ')}`);
      if (found.scroll) faults.push(`${lang}@${width}: the page scrolls sideways`);
      await page.close();
    }
  check(
    'in every language the tiles and the chips say their words whole and nothing runs past its card, at 1280 and 360',
    faults.length === 0,
    faults.slice(0, 6).join(' ‖ '),
  );
}

console.log(`(${BASE})`);
await suite.finish();
