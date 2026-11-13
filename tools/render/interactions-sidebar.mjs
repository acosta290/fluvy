#!/usr/bin/env node
/**
 * The sidebar beside the page (#173, This device) on the playground's dashboard mock: `?dashboard=<sheet>&frame=1` is
 * Home Assistant's app with its sidebar, `&hidden=1` the sidebar hidden (its "Always hide the sidebar"), `&dock=1` the
 * device's choice, answered by the bundle's own `look/dock.ts`; the mock's menus ask as Home Assistant's do (the
 * sidebar's through its action handler, whose touch end has its default prevented). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-sidebar.mjs
 * What it proves: in the floating frame a hidden sidebar's header menu stands where the sidebar's own menu does (its
 * glyph to the pixel, off the frame's corner), a subview's way back too, and Home Assistant's own place without the
 * frame; a finger's tap docks the hidden sidebar from the header and hides it again from the sidebar (no click ever
 * reaches the page), the glyph never moving; Enter and Space do the same; a long press of the sidebar's menu is still
 * its edit; without the device's choice the menus are Home Assistant's (its drawer over the page, the sidebar folded to
 * its icons).
 */
import { BASE, ENGINE, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;
const TABLET = { width: 1180, height: 820 };
const PAGE = 'dashboard=home&frame=1&flat=1&names=Overview,Rooms,Climate,Security';

/** What the page shows of the sidebar: its state, and the centre of each menu glyph on screen. */
const state = (page) =>
  page.evaluate(() => {
    const centre = (el) => {
      const box = el?.getBoundingClientRect();
      return box && box.width ? Math.round((box.x + box.width / 2) * 2) / 2 : null;
    };
    const app = document.querySelector('home-assistant');
    const header = document.querySelector('hui-root').shadowRoot;
    const sidebar = document.querySelector('ha-sidebar');
    return {
      docked: app.docked,
      header: centre(
        header.querySelector('.toolbar > :is(ha-menu-button, ha-icon-button-arrow-prev) ha-icon'),
      ),
      sidebar: centre(sidebar.shadowRoot.querySelector('.menu ha-icon')),
      drawer: window.__drawer ?? 0,
      edits: window.__editSidebar ?? 0,
    };
  });

/** Where a menu glyph is, to tap it. */
const glyph = async (page, where) => {
  const box = await page.evaluate((side) => {
    const root =
      side === 'header'
        ? document
            .querySelector('hui-root')
            .shadowRoot.querySelector('.toolbar > ha-menu-button ha-icon')
        : document.querySelector('ha-sidebar').shadowRoot.querySelector('.menu ha-icon');
    const r = root.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, where);
  return box;
};

/* ---------- the corner: the header's menu where the sidebar's own stands ---------- */
{
  const docked = await suite.page(`${PAGE}&floating=1`, { viewport: TABLET });
  const open = await state(docked);
  await docked.close();
  const hidden = await suite.page(`${PAGE}&floating=1&hidden=1`, { viewport: TABLET });
  const shut = await state(hidden);
  await hidden.close();
  check(
    'in the floating frame, a hidden sidebar’s header menu stands where the sidebar’s own menu does (to the pixel)',
    open.header === null && shut.sidebar === null && shut.header === open.sidebar,
    JSON.stringify({ open, shut }),
  );
  const sub = await suite.page(`${PAGE}&floating=1&hidden=1&subview=1`, { viewport: TABLET });
  const back = await state(sub);
  await sub.close();
  check(
    'a subview’s way back steps off the corner the same',
    back.header === open.sidebar,
    JSON.stringify(back),
  );
  const bare = await suite.page(`${PAGE}&hidden=1`, { viewport: TABLET });
  const own = await state(bare);
  await bare.close();
  check(
    'without the frame the header keeps Home Assistant’s own place (12 in, a 48 button)',
    own.header === 36,
    JSON.stringify(own),
  );
}

/* ---------- a finger: docked from the header, hidden from the sidebar, the glyph never moving ---------- */
{
  const page = await suite.page(`${PAGE}&floating=1&hidden=1&dock=1`, {
    viewport: TABLET,
    touch: true,
  });
  await page.evaluate(() => {
    window.__clicks = 0;
    window.addEventListener('click', () => window.__clicks++, true);
  });
  const before = await state(page);
  let at = await glyph(page, 'header');
  await page.touchscreen.tap(at.x, at.y);
  await settle(page, 300);
  const docked = await state(page);
  await page.evaluate(() => (window.__clicks = 0));
  at = await glyph(page, 'sidebar');
  await page.touchscreen.tap(at.x, at.y);
  await settle(page, 300);
  const hidden = await state(page);
  const clicks = await page.evaluate(() => window.__clicks);
  check(
    'a tap of the header’s menu docks the hidden sidebar beside the page, never as Home Assistant’s drawer',
    before.docked === 'always_hidden' && docked.docked === 'docked' && docked.drawer === 0,
    JSON.stringify({ before, docked }),
  );
  check(
    'a tap of the sidebar’s own menu hides it again, though Home Assistant lets no click follow the touch',
    hidden.docked === 'always_hidden' && hidden.drawer === 0 && clicks === 0,
    JSON.stringify({ hidden, clicks }),
  );
  check(
    'the menu’s glyph stays under the finger as the sidebar comes and goes',
    before.header === docked.sidebar && docked.sidebar === hidden.header,
    `${before.header} → ${docked.sidebar} → ${hidden.header}`,
  );
  await page.close();
}

/* ---------- the keyboard, and a long press that stays the sidebar's edit ---------- */
{
  const page = await suite.page(`${PAGE}&floating=1&dock=1`, { viewport: TABLET });
  const button = () =>
    page.evaluateHandle(() =>
      document.querySelector('ha-sidebar').shadowRoot.querySelector('.menu ha-icon-button'),
    );
  await (await button()).asElement().focus();
  await page.keyboard.press('Enter');
  await settle(page, 200);
  const entered = await state(page);
  const at = await glyph(page, 'header');
  await page.mouse.click(at.x, at.y);
  await settle(page, 200);
  await (await button()).asElement().focus();
  await page.keyboard.press(' ');
  await settle(page, 200);
  const spaced = await state(page);
  check(
    'Enter and Space on the sidebar’s menu hide it as a tap does',
    entered.docked === 'always_hidden' && spaced.docked === 'always_hidden',
    JSON.stringify({ entered, spaced }),
  );
  // docked again, then a mouse's long press on its menu: the edit, the sidebar where it was
  const header = await glyph(page, 'header');
  await page.mouse.click(header.x, header.y);
  await settle(page, 200);
  const side = await glyph(page, 'sidebar');
  await page.mouse.move(side.x, side.y);
  await page.mouse.down();
  await settle(page, 650);
  await page.mouse.up();
  await settle(page, 200);
  const held = await state(page);
  check(
    'a long press of the sidebar’s menu stays Home Assistant’s: its edit opens, the sidebar stays beside the page',
    held.edits === 1 && held.docked === 'docked',
    JSON.stringify(held),
  );
  await page.close();
}
if (ENGINE === 'chromium') {
  const page = await suite.page(`${PAGE}&floating=1&dock=1`, { viewport: TABLET, touch: true });
  const at = await glyph(page, 'sidebar');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
  await settle(page, 650);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await settle(page, 200);
  const held = await state(page);
  check(
    'a finger’s long press is the edit too, never a hide',
    held.edits === 1 && held.docked === 'docked',
    JSON.stringify(held),
  );
  await page.close();
}

/* ---------- without the device's choice: Home Assistant's own menus ---------- */
{
  const page = await suite.page(`${PAGE}&floating=1&hidden=1`, { viewport: TABLET, touch: true });
  const at = await glyph(page, 'header');
  await page.touchscreen.tap(at.x, at.y);
  await settle(page, 200);
  const hidden = await state(page);
  await page.goto(`${BASE}?${PAGE}&floating=1`);
  await page.waitForSelector('html[data-ready="1"]');
  await settle(page, 600);
  const side = await glyph(page, 'sidebar');
  await page.touchscreen.tap(side.x, side.y);
  await settle(page, 300);
  const folded = await state(page);
  check(
    'a device that left it off keeps Home Assistant’s way: the drawer over the page, the docked sidebar folded to its icons',
    hidden.drawer === 1 && hidden.docked === 'always_hidden' && folded.docked === 'auto',
    JSON.stringify({ hidden, folded }),
  );
  await page.close();
}

console.log(`\n(${ENGINE})`);
await suite.finish();
