#!/usr/bin/env node
/**
 * A dashboard's own sidebar (1.21, #187) on the playground's dashboard mock: `?dashboard=sidebar&side=…` writes
 * `fluvy_sidebar:` into the dashboard's configuration (`apps/playground/src/side.ts`), and the bundle's own hook fetches
 * and draws it in `hui-root`'s view row, as on Home Assistant. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-dashboard-sidebar.mjs
 * What it proves: beside the views it keeps its width per device (a tablet's 280 at 768 and 1024, a desktop's 320 at
 * 1400), stands from under the header to the window's foot and the view has the rest, nothing reaching past the
 * window; it is first in the row; a phone has none (360, 412) unless the dashboard asks for it above the view or in a
 * drawer; its head and its foot stay while the window scrolls and while its middle scrolls; the menu lists the views,
 * marks the open one and follows a tab and a page chosen without the element or its cards being built again; the
 * drawer opens from a 44 round at the side's foot, holds the focus, and closes on the scrim, on Escape and on a page
 * chosen; a fold is remembered by the device; at the end, in a right-to-left page, at another size, on a wall, in the
 * floating frame, in the edit mode and in a subview it stands as it should; the header's tabs give way when asked; a
 * card of Fluvy's it holds stands in its column with no surface of its own; a dashboard without the key fetches
 * nothing.
 */
import { settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;
const HEADER = 56;
const BASE = 'dashboard=sidebar&width=328&at=2026-09-17T19:50:00Z';

const open = (query, viewport, options = {}) =>
  suite.page(`${BASE}&${query}`, { viewport, reducedMotion: 'reduce', ...options });

/** What the page shows of the sidebar: the root's mark, its box, its parts' and the view's. */
const read = (page) =>
  page.evaluate(() => {
    const root = document.querySelector('hui-root');
    const sr = root.shadowRoot;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const round = (n) => Math.round(n * 100) / 100;
      return {
        x: round(r.x),
        y: round(r.y),
        w: round(r.width),
        h: round(r.height),
        right: round(r.right),
        bottom: round(r.bottom),
      };
    };
    const view = sr.querySelector('#view');
    const side = view.querySelector('fluvy-sidebar');
    const inner = side?.shadowRoot;
    return {
      mark: root.getAttribute('fluvy-side'),
      first: view.firstElementChild === side,
      count: view.querySelectorAll('fluvy-sidebar').length,
      side: box(side),
      view: box(sr.querySelector('hui-view')),
      surface: box(inner?.querySelector('.sb-surface')),
      head: box(inner?.querySelector('.sb-head')),
      body: box(inner?.querySelector('.sb-body')),
      foot: box(inner?.querySelector('.sb-foot')),
      items: [...(inner?.querySelectorAll('.sb-item') ?? [])].map((item) => ({
        title: item.textContent.trim() || item.getAttribute('aria-label'),
        current: item.getAttribute('aria-current') === 'page',
        box: box(item),
        circle: box(item.querySelector('.fv-ico')),
      })),
      tabs: [...sr.querySelectorAll('ha-tab-group-tab[active]')].map((tab) =>
        tab.getAttribute('aria-label'),
      ),
      window: { w: window.innerWidth, h: window.innerHeight },
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      path: window.location.pathname,
    };
  });

const near = (a, b, by = 0.5) => Math.abs(a - b) <= by;

/* ---------- beside the views, by device ---------- */
for (const [width, height, expected] of [
  [768, 1024, 280],
  [1024, 768, 280],
  [1400, 900, 320],
]) {
  const page = await open('side=menu', { width, height });
  const s = await read(page);
  check(
    `${width}: beside the views at ${expected}, from under the header to the window's foot, first in the row`,
    s.mark === 'start beside' &&
      s.first &&
      s.count === 1 &&
      s.side.x === 0 &&
      s.side.w === expected &&
      s.side.y === HEADER &&
      near(s.side.bottom, height),
    JSON.stringify({ mark: s.mark, side: s.side }),
  );
  check(
    `${width}: the view has the rest of the row, and nothing reaches past the window`,
    near(s.view.x, expected) && near(s.view.right, width) && s.overflow <= 0,
    JSON.stringify({ view: s.view, overflow: s.overflow }),
  );
  check(
    `${width}: the menu lists the views in rows 44 tall, 8 apart, each a 44 circle and its name, the open one marked`,
    s.items.map((item) => item.title).join() === 'Home,Rooms,Lights,Climate,Energy,Media' &&
      s.items.every((item) => item.box.h === 44 && item.circle.w === 44 && item.circle.h === 44) &&
      s.items.slice(1).every((item, i) => item.box.y - s.items[i].box.bottom === 8) &&
      s.items.map((item) => item.current).join() === 'true,false,false,false,false,false',
    JSON.stringify(s.items.map((item) => [item.title, item.box.y, item.box.h, item.current])),
  );
  await page.close();
}

/* ---------- a phone ---------- */
for (const width of [360, 412]) {
  const page = await open('side=menu', { width, height: 800 }, { touch: true });
  const s = await read(page);
  check(
    `${width}: a phone has no sidebar unless the dashboard asks for one there: the view has the window`,
    s.mark === null && s.count === 0 && s.view.x === 0 && near(s.view.w, width),
    JSON.stringify({ mark: s.mark, count: s.count, view: s.view }),
  );
  await page.close();
}
{
  const page = await open('side=menu&sidephone=top', { width: 390, height: 844 }, { touch: true });
  const s = await read(page);
  const row = await page.evaluate(() => {
    const menu = document
      .querySelector('hui-root')
      .shadowRoot.querySelector('fluvy-sidebar')
      .shadowRoot.querySelector('.sb-menu--row');
    return {
      scrolls: menu.scrollWidth > menu.clientWidth,
      width: menu.getBoundingClientRect().width,
    };
  });
  check(
    'a phone, above the view: the head and the menu over the view, as wide as the window, the view under them',
    s.mark === 'start top' &&
      s.side.y === HEADER &&
      near(s.side.w, 390) &&
      s.view.y >= s.side.bottom - 0.5 &&
      near(s.view.w, 390) &&
      s.overflow <= 0,
    JSON.stringify({ mark: s.mark, side: s.side, view: s.view, overflow: s.overflow }),
  );
  check(
    'a phone, above the view: the menu is one row of pills that scrolls sideways, never the page',
    row.scrolls &&
      near(row.width, 390) &&
      s.items.every((item) => item.box.h === 44 && item.box.y === s.items[0].box.y),
    JSON.stringify(row),
  );
  await page.close();
}

/* ---------- the drawer ---------- */
{
  const page = await open('side=drawer', { width: 390, height: 844 }, { touch: true });
  const state = () =>
    page.evaluate(() => {
      const side = document.querySelector('hui-root').shadowRoot.querySelector('fluvy-sidebar');
      const sr = side.shadowRoot;
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
      };
      const dialog = sr.querySelector('dialog');
      const active = sr.activeElement;
      return {
        opener: rect(sr.querySelector('.sb-open')),
        expanded: sr.querySelector('.sb-open').getAttribute('aria-expanded'),
        open: dialog?.open ?? false,
        drawer: rect(sr.querySelector('.sb--drawer')),
        focus: active ? active.className || active.localName : null,
        inside: active ? Boolean(active.closest('dialog')) : false,
        cards: side.children.length,
        close: rect(sr.querySelector('.sb-fold button')),
        path: window.location.pathname,
      };
    });
  let s = await state();
  const marked = (await read(page)).mark;
  check(
    'the drawer: a 44 round floats at the side’s foot, 16 from the window’s edges, and the view has the window',
    marked === 'start drawer' &&
      s.opener.w === 44 &&
      s.opener.h === 44 &&
      s.opener.x === 16 &&
      near(s.opener.bottom, 844 - 16) &&
      !s.open &&
      s.expanded === 'false' &&
      s.cards === 0,
    JSON.stringify({ marked, ...s }),
  );
  const tapOpener = async () => {
    const { opener } = await state();
    await page.touchscreen.tap(opener.x + 22, opener.y + 22);
    await settle(page, 500);
  };
  await tapOpener();
  s = await state();
  check(
    'the drawer: a tap opens it over the view from its side, 320 wide and as tall as the window, the focus inside it',
    s.open &&
      s.expanded === 'true' &&
      s.drawer.x === 0 &&
      s.drawer.w === 320 &&
      near(s.drawer.h, 844) &&
      s.inside &&
      s.cards === 3,
    JSON.stringify(s),
  );
  check(
    'the drawer: its close round stands where the opener was, under the same finger',
    near(s.close.x, s.opener.x) && near(s.close.y, s.opener.y, 1),
    JSON.stringify({ close: s.close, opener: s.opener }),
  );
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const tabbed = await state();
  check(
    'the drawer: the keyboard’s focus stays inside it',
    tabbed.inside,
    JSON.stringify(tabbed.focus),
  );
  await page.keyboard.press('Escape');
  await settle(page, 500);
  s = await state();
  check('the drawer: Escape closes it, its cards out of the page', !s.open && s.cards === 0);
  await tapOpener();
  await page.touchscreen.tap(360, 400);
  await settle(page, 500);
  s = await state();
  check('the drawer: a tap on the scrim beside it closes it', !s.open, JSON.stringify(s.open));
  await tapOpener();
  const rooms = (await read(page)).items.find((item) => item.title === 'Rooms');
  await page.touchscreen.tap(rooms.box.x + 60, rooms.box.y + 22);
  await settle(page, 500);
  s = await state();
  const after = await read(page);
  check(
    'the drawer: a page chosen opens that view and closes the drawer',
    !s.open && s.path === '/fluvy-home/rooms' && after.tabs.join() === 'Rooms',
    JSON.stringify({ open: s.open, path: s.path, tabs: after.tabs }),
  );
  await page.close();
}

/* ---------- the head and the foot stay ---------- */
{
  const page = await open('side=long', { width: 1024, height: 768 });
  const before = await read(page);
  check(
    'more than the window holds: the head at the top, the foot at the window’s foot, the middle between them',
    near(before.head.y, HEADER) &&
      near(before.foot.bottom, 768) &&
      near(before.body.y, before.head.bottom) &&
      near(before.body.bottom, before.foot.y),
    JSON.stringify({ head: before.head, body: before.body, foot: before.foot }),
  );
  await page.evaluate(() => window.scrollTo(0, 400));
  await settle(page, 200);
  const scrolled = await read(page);
  const pageMoved = await page.evaluate(() => window.scrollY);
  check(
    'the window scrolls: the sidebar stays under the header, its head and its foot where they were',
    pageMoved > 100 &&
      near(scrolled.side.y, HEADER) &&
      near(scrolled.side.bottom, 768) &&
      near(scrolled.head.y, before.head.y) &&
      near(scrolled.foot.y, before.foot.y),
    JSON.stringify({ pageMoved, side: scrolled.side, head: scrolled.head, foot: scrolled.foot }),
  );
  const middle = await page.evaluate(async () => {
    const side = document.querySelector('hui-root').shadowRoot.querySelector('fluvy-sidebar');
    const body = side.shadowRoot.querySelector('.sb-body');
    const card = side.querySelector('[slot="cards"]');
    const top = card.getBoundingClientRect().y;
    const fits = body.scrollHeight <= body.clientHeight;
    const over = body.classList.contains('is-over');
    body.scrollTop = 200;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      fits,
      over,
      moved: top - card.getBoundingClientRect().y,
      under: body.classList.contains('is-under'),
      page: window.scrollY,
    };
  });
  const within = await read(page);
  check(
    'the middle scrolls by itself: its cards move, the head and the foot do not, nor the page, and it fades where it goes on',
    !middle.fits &&
      middle.over &&
      middle.moved === 200 &&
      middle.under &&
      middle.page === pageMoved &&
      near(within.head.y, before.head.y) &&
      near(within.foot.y, before.foot.y),
    JSON.stringify(middle),
  );
  await page.close();
}

/* ---------- the menu follows the view ---------- */
{
  const page = await open('side=long', { width: 1024, height: 768 });
  await page.evaluate(() => {
    const side = document.querySelector('hui-root').shadowRoot.querySelector('fluvy-sidebar');
    side.__same = true;
    for (const card of side.children) card.__same = true;
  });
  const lights = (await read(page)).items.find((item) => item.title === 'Lights');
  await page.mouse.click(lights.box.x + 80, lights.box.y + 22);
  await settle(page, 300);
  let s = await read(page);
  check(
    'a page chosen in the menu opens that view: the address, Home Assistant’s tab and the menu’s mark move together',
    s.path === '/fluvy-home/lights' &&
      s.tabs.join() === 'Lights' &&
      s.items
        .filter((item) => item.current)
        .map((item) => item.title)
        .join() === 'Lights',
    JSON.stringify({ path: s.path, tabs: s.tabs }),
  );
  await page.evaluate(() =>
    document
      .querySelector('hui-root')
      .shadowRoot.querySelector('ha-tab-group-tab[aria-label="Energy"]')
      .click(),
  );
  await settle(page, 300);
  s = await read(page);
  const same = await page.evaluate(() => {
    const side = document.querySelector('hui-root').shadowRoot.querySelector('fluvy-sidebar');
    return side.__same === true && [...side.children].every((card) => card.__same === true);
  });
  check(
    'a tab chosen in the header moves the menu’s mark, the sidebar and its cards the very ones they were',
    s.items
      .filter((item) => item.current)
      .map((item) => item.title)
      .join() === 'Energy' &&
      same &&
      s.first &&
      s.count === 1,
    JSON.stringify({ current: s.items.filter((item) => item.current), same }),
  );
  // the keyboard: Tab reaches a page, Enter opens it
  await page.evaluate(() =>
    document
      .querySelector('hui-root')
      .shadowRoot.querySelector('fluvy-sidebar')
      .shadowRoot.querySelector('.sb-item')
      .focus(),
  );
  await page.keyboard.press('Enter');
  await settle(page, 300);
  s = await read(page);
  check(
    'the keyboard opens a page: Enter on the menu’s first row',
    s.path === '/fluvy-home/home' && s.items[0].current,
    s.path,
  );
  await page.close();
}

/* ---------- a fold, remembered ---------- */
{
  const page = await open('side=menu&sidefold=1', { width: 1024, height: 768 });
  const fold = () =>
    page.evaluate(() =>
      document
        .querySelector('hui-root')
        .shadowRoot.querySelector('fluvy-sidebar')
        .shadowRoot.querySelector('.sb-fold button')
        .click(),
    );
  const label = () =>
    page.evaluate(() =>
      document
        .querySelector('hui-root')
        .shadowRoot.querySelector('fluvy-sidebar')
        .shadowRoot.querySelector('.sb-fold button')
        .getAttribute('aria-label'),
    );
  let s = await read(page);
  check(
    'it may fold: a round at its foot says so',
    s.side.w === 280 && (await label()) === 'Fold the sidebar',
  );
  await fold();
  await settle(page, 300);
  s = await read(page);
  check(
    'folded: a rail of the menu’s circles 60 wide, each read out by its page, the view beside it',
    s.side.w === 60 &&
      near(s.view.x, 60) &&
      s.items.length === 6 &&
      s.items.every((item) => item.box.w === 44 && item.title) &&
      (await label()) === 'Unfold the sidebar',
    JSON.stringify({
      side: s.side,
      view: s.view,
      items: s.items.map((item) => [item.title, item.box.w]),
    }),
  );
  await page.reload();
  await page.waitForSelector('html[data-ready="1"]');
  await settle(page, 900);
  s = await read(page);
  check(
    'folded is how this device finds it the next time',
    s.side.w === 60,
    JSON.stringify(s.side),
  );
  await fold();
  await settle(page, 300);
  s = await read(page);
  check('unfolded again: its width and its cards back', s.side.w === 280 && s.head !== null);
  await page.close();
}

/* ---------- the side, the styles ---------- */
{
  const page = await open('side=menu&sidepos=end&sidetabs=0', { width: 1024, height: 768 });
  let s = await read(page);
  const header = await page.evaluate(() => {
    const sr = document.querySelector('hui-root').shadowRoot;
    const actions = sr.querySelector('.action-items').getBoundingClientRect();
    return {
      tabs: getComputedStyle(sr.querySelector('ha-tab-group')).display,
      actions: actions.right,
    };
  });
  check(
    'at the end: the sidebar at the window’s far edge, the view from its near one, the element still first in the row',
    s.mark === 'end beside no-tabs' &&
      near(s.side.right, 1024) &&
      s.side.w === 280 &&
      s.view.x === 0 &&
      near(s.view.right, 1024 - 280) &&
      s.first,
    JSON.stringify({ mark: s.mark, side: s.side, view: s.view }),
  );
  check(
    'the header’s tabs give way to the menu where asked, the actions keeping the bar’s end',
    header.tabs === 'none' && header.actions > 1024 - 24,
    JSON.stringify(header),
  );
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  await settle(page, 300);
  s = await read(page);
  check(
    'read from the right, the end is the left: the sidebar there, the view after it',
    s.side.x === 0 && near(s.view.x, 280),
    JSON.stringify({ side: s.side, view: s.view }),
  );
  await page.close();
}
{
  const page = await open('side=long&sidestyle=card', { width: 1024, height: 768 });
  const s = await read(page);
  const look = await page.evaluate(() => {
    const side = document.querySelector('hui-root').shadowRoot.querySelector('fluvy-sidebar');
    const surface = getComputedStyle(side.shadowRoot.querySelector('.sb-surface'));
    return { radius: surface.borderRadius, shadow: surface.boxShadow !== 'none' };
  });
  check(
    'as a card: one surface with the card’s corners and hairline, the view’s gap above, under and before it',
    look.radius === '20px' &&
      look.shadow &&
      s.surface.x === 24 &&
      s.surface.y - HEADER === 24 &&
      near(768 - s.surface.bottom, 24) &&
      near(s.surface.right, 280),
    JSON.stringify({ look, surface: s.surface }),
  );
  await page.close();
}
{
  const page = await open('side=long', { width: 1024, height: 768 });
  const held = await page.evaluate(() => {
    const side = document.querySelector('hui-root').shadowRoot.querySelector('fluvy-sidebar');
    const column = side.shadowRoot.querySelector('.sb-item').getBoundingClientRect().x;
    const cards = [...side.children].map((wrapper) => {
      const card = wrapper.firstElementChild;
      const surface = card.shadowRoot?.querySelector('.fv-card, .card');
      const style = surface ? getComputedStyle(surface) : null;
      return {
        type: card.localName,
        slot: wrapper.slot,
        ruled: wrapper.hasAttribute('data-ruled'),
        fill: style?.backgroundColor ?? null,
        // where its content starts: its surface's box and its padding
        content: surface ? surface.getBoundingClientRect().x + parseFloat(style.paddingLeft) : null,
      };
    });
    return { column, cards };
  });
  const fluvy = held.cards.filter((card) => card.fill !== null && card.type.startsWith('fluvy-'));
  check(
    'on its surface a card of Fluvy’s draws none of its own and stands in the sidebar’s column, as the menu does',
    fluvy.length >= 3 &&
      fluvy.every((card) => card.fill === 'rgba(0, 0, 0, 0)' && near(card.content, held.column)),
    JSON.stringify(held),
  );
  const own = held.cards.find((card) => card.type === 'pg-own-card');
  check(
    'a card of Home Assistant’s own wears no surface there either',
    own?.fill === 'rgba(0, 0, 0, 0)',
    JSON.stringify(own),
  );
  check(
    'a hairline over each card with something above it in its list, none over a list’s first',
    held.cards.map((card) => `${card.slot}:${card.ruled}`).join() ===
      'header:false,cards:true,cards:true,cards:true,cards:true,footer:false',
    JSON.stringify(held.cards.map((card) => [card.slot, card.ruled])),
  );
  await page.close();
}

/* ---------- every situation ---------- */
{
  const page = await open('side=menu&zoom=125', { width: 1280, height: 800 });
  const s = await read(page);
  check(
    'at this device’s size (125 %): the sidebar grows with the view, still from under the header to the window’s foot',
    near(s.side.w, 400, 1) &&
      near(s.side.y, HEADER, 1) &&
      near(s.side.bottom, 800, 1) &&
      near(s.view.x, 400, 1) &&
      s.overflow <= 0,
    JSON.stringify({ side: s.side, view: s.view, overflow: s.overflow }),
  );
  await page.evaluate(() => window.scrollTo(0, 300));
  await settle(page, 200);
  const scrolled = await read(page);
  check(
    'at 125 %, the window scrolled: it stays where it was',
    near(scrolled.side.y, HEADER, 1) && near(scrolled.side.bottom, 800, 1),
    JSON.stringify(scrolled.side),
  );
  await page.close();
}
{
  const page = await open('side=menu&wall=1', { width: 1024, height: 768 });
  const s = await read(page);
  check(
    'on a wall (no header): from the top of the window to its foot',
    s.mark === 'start beside' && s.side.y === 0 && near(s.side.h, 768),
    JSON.stringify(s.side),
  );
  await page.close();
}
{
  const page = await open('side=menu&frame=1&floating=1', { width: 1400, height: 800 });
  const s = await read(page);
  const app = await page.evaluate(() => {
    const sidebar = document.querySelector('ha-sidebar').getBoundingClientRect();
    return { right: sidebar.right };
  });
  check(
    'in the floating frame beside Home Assistant’s sidebar: after that sidebar, inside the frame’s 16 above and below',
    near(s.side.x, app.right) &&
      near(s.side.y, HEADER + 16) &&
      near(s.side.bottom, 800 - 16) &&
      near(s.view.right, 1400 - 16) &&
      s.overflow <= 0,
    JSON.stringify({ side: s.side, view: s.view, app }),
  );
  await page.close();
}
{
  const page = await open('side=menu&frame=1&hidden=1&dock=1', { width: 1180, height: 820 });
  const before = await read(page);
  await page.evaluate(() =>
    document
      .querySelector('hui-root')
      .shadowRoot.querySelector('ha-menu-button')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true })),
  );
  await settle(page, 500);
  const docked = await read(page);
  check(
    'Home Assistant’s sidebar hidden, then beside the page (#173): the dashboard’s own moves over with the view',
    before.side.x === 0 && docked.side.x >= 256 && near(docked.view.x - docked.side.x, 280),
    JSON.stringify({ before: before.side, docked: docked.side, view: docked.view }),
  );
  await page.close();
}
{
  const page = await open('side=menu&edit=1', { width: 1024, height: 768 });
  const s = await read(page);
  check(
    'in the edit mode there is none: the view is edited at its whole width',
    s.mark === null && s.count === 0 && s.view.x === 0,
    JSON.stringify({ mark: s.mark, view: s.view }),
  );
  await page.close();
}
{
  const page = await open('side=menu&subview=1', { width: 1024, height: 768 });
  const s = await read(page);
  check('in a subview it stays', s.mark === 'start beside' && s.side.w === 280, s.mark);
  await page.close();
  const off = await open('side=menu&subview=1&sidesub=0', { width: 1024, height: 768 });
  const hidden = await read(off);
  check(
    'unless the dashboard asks for none there',
    hidden.mark === null && hidden.count === 0,
    String(hidden.mark),
  );
  await off.close();
}
{
  const page = await open('side=menu&sideviews=rooms,lights', { width: 1024, height: 768 });
  let s = await read(page);
  check('only beside the views it names: none on Home', s.count === 0, String(s.mark));
  await page.evaluate(() =>
    document
      .querySelector('hui-root')
      .shadowRoot.querySelector('ha-tab-group-tab[aria-label="Rooms"]')
      .click(),
  );
  await settle(page, 400);
  s = await read(page);
  check('… and there on Rooms', s.count === 1 && s.side.w === 280, String(s.mark));
  await page.close();
}
{
  const page = await open('side=pages', { width: 1024, height: 768 });
  const s = await read(page);
  check(
    'pages written by hand: an address, a view by its path and an action; what is neither is left out',
    s.items.map((item) => item.title).join() === 'Home,Lights,Energy,All lights off',
    s.items.map((item) => item.title).join(),
  );
  const action = s.items.find((item) => item.title === 'All lights off');
  await page.mouse.click(action.box.x + 80, action.box.y + 22);
  await settle(page, 300);
  const called = await page.evaluate(() =>
    window.fluvyMock.calls.map((call) => `${call.domain}.${call.service}`),
  );
  check('a page that runs an action runs it', called.join() === 'light.turn_off', called.join());
  await page.close();
}
{
  const page = await open('side=menu&page=image&opacity=70', { width: 1024, height: 768 });
  const glass = await page.evaluate(() => {
    const side = document.querySelector('hui-root').shadowRoot.querySelector('fluvy-sidebar');
    const surface = getComputedStyle(side.shadowRoot.querySelector('.sb-surface'));
    return {
      mark: side.getAttribute('glass'),
      fill: surface.backgroundColor,
      blur: surface.backdropFilter,
    };
  });
  check(
    'a house of see-through cards: the sidebar’s surface is see-through with them, what shows through blurred',
    glass.mark === 'blur' && /0\.7\)|\/ 0\.7\)/.test(glass.fill) && glass.blur.includes('blur'),
    JSON.stringify(glass),
  );
  await page.close();
}
{
  const page = await suite.page('dashboard=home&width=360', {
    viewport: { width: 1024, height: 768 },
  });
  const none = await page.evaluate(() => ({
    defined: window.customElements.get('fluvy-sidebar') !== undefined,
    mark: document.querySelector('hui-root').getAttribute('fluvy-side'),
  }));
  check(
    'a dashboard without the key fetches nothing of it: no element defined, no mark',
    !none.defined && none.mark === null,
    JSON.stringify(none),
  );
  await page.close();
}

await suite.finish();
