#!/usr/bin/env node
/**
 * The demo, checked as a visitor would find it (a built site served by `vite preview`, or the dev server):
 * the landing shows cards, a palette recolours the page, a device changes the columns, the settings panel mounts,
 * a card asking for more-info is answered with a notice and no navigation, and the page reports no error.
 *   DEMO=http://127.0.0.1:4173/fluvy/ node tools/render/demo-smoke.mjs
 * Exit code 1 on any failure.
 */
import { chromium } from 'playwright';
import { launchOptions } from './lib.mjs';

const DEMO = process.env.DEMO ?? 'http://127.0.0.1:5185/fluvy/';
const browser = await chromium.launch(launchOptions);
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const errors = [];
const open = async (query, viewport = { width: 1400, height: 1000 }) => {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (error) => errors.push(`${query}: ${error}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${query}: ${message.text()}`);
  });
  await page.goto(`${DEMO}${query ? `?${query}` : ''}`);
  await page.waitForSelector('html[data-ready="1"]', { timeout: 30000 });
  await page.waitForTimeout(600);
  return page;
};
const accent = (page) =>
  page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--fluvy-accent').trim(),
  );
const frames = (page) => page.locator('#stage [data-frame]').count();
const frameWidth = (page) =>
  page
    .locator('#stage [data-frame]')
    .first()
    .evaluate((el) => el.getBoundingClientRect().width);

{
  const page = await open('');
  check(
    'the landing shows the home family',
    (await frames(page)) >= 3,
    `${await frames(page)} frames`,
  );
  check('the look is on the page', (await accent(page)) !== '', await accent(page));
  const before = await accent(page);
  await page.locator('fluvy-demo-shell .demo-dot[aria-label="Volt"]').click();
  await page.waitForTimeout(300);
  const after = await accent(page);
  check(
    'a palette recolours the page without a reload',
    after !== '' && after !== before,
    `${before} → ${after}`,
  );
  check('…and the URL says so', page.url().includes('palette=volt'), page.url());
  // the landing opens on the visitor's own device (a desktop here): a chip changes the columns
  const desktop = await frameWidth(page);
  await page.locator('fluvy-demo-shell .fv-chip', { hasText: 'Tablet' }).click();
  await page.waitForTimeout(300);
  const tablet = await frameWidth(page);
  check(
    'a device changes the columns',
    desktop === 448 && tablet === 472,
    `${desktop} → ${tablet}`,
  );
  await page.locator('fluvy-demo-shell .fv-chip', { hasText: 'Dark' }).click();
  await page.waitForTimeout(300);
  check(
    'dark mode reaches the cards',
    await page
      .locator('#stage [data-frame] > *')
      .first()
      .evaluate((el) => el.hasAttribute('dark')),
  );
  await page.locator('fluvy-demo-shell .fv-chip', { hasText: /^ES$/ }).click();
  await page.waitForTimeout(400);
  check(
    'the language changes in place',
    (await page.locator('html').getAttribute('lang')) === 'es',
  );
  // a card asking for more-info: a notice, and the page stays where it is
  const url = page.url();
  await page.evaluate(() => {
    const card = document.querySelector('#stage [data-frame] > *');
    card?.dispatchEvent(
      new CustomEvent('hass-more-info', {
        detail: { entityId: 'light.kitchen' },
        bubbles: true,
        composed: true,
      }),
    );
  });
  await page.waitForTimeout(200);
  check(
    'more-info becomes a notice, not a dialog',
    (await page.locator('fluvy-demo-shell .demo-toast').count()) === 1 && page.url() === url,
  );
  await page.close();
}
{
  const page = await open('sheet=energy');
  check(
    'a sheet deep link mounts its frames',
    (await frames(page)) >= 1,
    `${await frames(page)} frames`,
  );
  await page.close();
}
{
  const page = await open('panel=appearance');
  check('the settings panel mounts', (await page.locator('fluvy-panel').count()) === 1);
  await page.close();
}
{
  const page = await open('history=1');
  await page.waitForFunction(
    () => document.querySelector('fluvy-history')?.shadowRoot?.querySelector('.hs-main') !== null,
    null,
    { timeout: 20000 },
  );
  check('the History page mounts', true);
  await page.close();
}
check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exitCode = failed ? 1 : 0;
