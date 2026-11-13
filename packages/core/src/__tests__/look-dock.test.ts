// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextDock, watchSidebar, type Main } from '../look/dock.js';
import { startLook } from '../look/start.js';
import { writeDevice } from '../settings/device.js';

/*
 * Home Assistant's own pieces, as far as its menu goes (its frontend, 2026.11): `home-assistant` keeps the sidebar's
 * state and remembers it (`hass-dock-sidebar`, sidebar-mixin.ts); `home-assistant-main` acts on `hass-toggle-menu`
 * (home-assistant-main.ts: the companion app's own sidebar, the drawer on a phone, in a kiosk or for a hidden sidebar,
 * else docked ⇄ its icons); the sidebar's menu button answers Home Assistant's action handler — a touch's end has its
 * default prevented (no click ever follows), Enter and Space end it too, a hold of 500 ms is the sidebar's edit; the
 * header's menu button, an add-on panel's and a panel in a frame (its forwarded event) send the same ask. Every event
 * is sent as Home Assistant's `fireEvent` sends it: a plain bubbling, composed event with its `detail` ({} for none).
 */

type Docked = 'docked' | 'auto' | 'always_hidden';

const fire = (node: EventTarget, type: string, detail: object = {}): void => {
  const event = new Event(type, { bubbles: true, composed: true });
  (event as Event & { detail: object }).detail = detail;
  node.dispatchEvent(event);
};

interface Home {
  /** The sidebar's state, as the browser remembers it. */
  docked(): Docked;
  /** What Home Assistant itself did with the asks it got: the drawer opened or closed, a message to the app. */
  readonly own: string[];
  /** The sidebar's edit, opened by a hold of its menu button. */
  readonly edits: number[];
  readonly main: HTMLElement & Main;
  /** The sidebar's menu button, in the sidebar's own shadow. */
  readonly sidebarMenu: HTMLElement;
  /** A dashboard's header menu button (hui-root's), an add-on panel's header button, a panel in a frame. */
  readonly headerMenu: HTMLElement;
  readonly appPanel: HTMLElement;
  readonly framePanel: HTMLElement;
}

/** Home Assistant's app as it stands on a wide screen (or a phone's, `narrow`), its sidebar `docked` as given. */
function home(docked: Docked, { narrow = false, kiosk = false, appSidebar = false } = {}): Home {
  const own: string[] = [];
  const edits: number[] = [];
  const app = document.createElement('home-assistant');
  let hass = {
    dockedSidebar: docked,
    kioskMode: kiosk,
    auth: appSidebar ? { external: { config: { hasSidebar: true } } } : {},
  };
  const main = Object.assign(document.createElement('home-assistant-main'), {
    narrow,
    hass,
  }) as HTMLElement & Main;
  app.attachShadow({ mode: 'open' }).append(main);
  document.body.append(app);
  // sidebar-mixin.ts: the state set, and remembered
  app.addEventListener('hass-dock-sidebar', (event) => {
    hass = { ...hass, dockedSidebar: (event as CustomEvent<{ dock: Docked }>).detail.dock };
    Object.assign(main, { hass });
  });
  // home-assistant-main.ts
  main.addEventListener('hass-toggle-menu', (event) => {
    const open = (event as CustomEvent<{ open?: boolean }>).detail?.open;
    if (appSidebar) return void own.push('sidebar/show');
    if (main.narrow || hass.dockedSidebar === 'always_hidden' || hass.kioskMode)
      return void own.push(open === false ? 'drawer closed' : 'drawer');
    fire(main, 'hass-dock-sidebar', {
      dock: open
        ? 'docked'
        : open === false
          ? 'auto'
          : hass.dockedSidebar === 'auto'
            ? 'docked'
            : 'auto',
    });
  });
  const inside = main.attachShadow({ mode: 'open' });

  // ha-sidebar: its menu button inside `.menu`, which carries the action handler
  const sidebar = document.createElement('ha-sidebar');
  const head = document.createElement('div');
  head.className = 'menu';
  const sidebarMenu = document.createElement('ha-icon-button');
  sidebarMenu.tabIndex = 0;
  head.append(sidebarMenu);
  sidebar.attachShadow({ mode: 'open' }).append(head);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let held = false;
  const start = (): void => {
    held = false;
    timer = setTimeout(() => (held = true), 500);
  };
  const end = (event: Event): void => {
    if (event.cancelable) event.preventDefault();
    clearTimeout(timer);
    if (held) edits.push(1);
    else fire(sidebar, 'hass-toggle-menu');
  };
  head.addEventListener('touchstart', start);
  head.addEventListener('touchend', end);
  head.addEventListener('mousedown', start);
  head.addEventListener('click', end);
  head.addEventListener('keydown', (event) => {
    if (['Enter', ' '].includes((event as KeyboardEvent).key)) end(event);
  });

  // a dashboard's header (hui-root), an add-on panel (ha-panel-app), a panel in a frame (ha-panel-custom)
  const root = document.createElement('hui-root');
  const headerMenu = document.createElement('ha-menu-button');
  headerMenu.addEventListener('click', () => fire(headerMenu, 'hass-toggle-menu'));
  root.attachShadow({ mode: 'open' }).append(headerMenu);
  const appPanel = document.createElement('ha-panel-app');
  const appButton = document.createElement('ha-icon-button');
  appButton.addEventListener('click', () => fire(appPanel, 'hass-toggle-menu'));
  appPanel.attachShadow({ mode: 'open' }).append(appButton);
  const framePanel = document.createElement('ha-panel-custom');
  inside.append(sidebar, root, appPanel, framePanel);

  return {
    docked: () => hass.dockedSidebar,
    own,
    edits,
    main,
    sidebarMenu,
    headerMenu,
    appPanel: appButton,
    framePanel,
  };
}

/** A finger's tap: its start and its end, the end's default prevented by Home Assistant (no click follows). */
const touch = (target: HTMLElement): void => {
  target.dispatchEvent(new Event('touchstart', { bubbles: true, composed: true }));
  target.dispatchEvent(new Event('touchend', { bubbles: true, composed: true, cancelable: true }));
};

describe('the sidebar beside the page', () => {
  let chosen = true;
  let stop: () => void;
  beforeEach(() => {
    chosen = true;
    stop = watchSidebar(() => chosen);
  });
  afterEach(() => {
    stop();
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('hides a docked sidebar from its own menu button on a touch, which never sends a click', () => {
    const h = home('docked');
    const clicks = vi.fn();
    window.addEventListener('click', clicks, true);
    touch(h.sidebarMenu);
    window.removeEventListener('click', clicks, true);
    expect(clicks).not.toHaveBeenCalled();
    expect(h.docked()).toBe('always_hidden');
    expect(h.own).toEqual([]);
  });

  it('docks a hidden sidebar from the header’s menu button, beside the page, never as the drawer over it', () => {
    const h = home('always_hidden');
    h.headerMenu.click();
    expect(h.docked()).toBe('docked');
    expect(h.own).toEqual([]);
    // and back: the next ask hides it again, the next docks it
    touch(h.sidebarMenu);
    expect(h.docked()).toBe('always_hidden');
    h.headerMenu.click();
    expect(h.docked()).toBe('docked');
  });

  it('hides it from its icons alone (Home Assistant’s folded sidebar), never folding it again', () => {
    const h = home('auto');
    h.sidebarMenu.click();
    expect(h.docked()).toBe('always_hidden');
  });

  it('answers the keyboard: Enter and Space on the sidebar’s menu button', () => {
    const h = home('docked');
    h.sidebarMenu.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true }),
    );
    expect(h.docked()).toBe('always_hidden');
    h.headerMenu.click();
    h.sidebarMenu.dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }),
    );
    expect(h.docked()).toBe('always_hidden');
  });

  it('answers an add-on panel’s own menu button and a panel in a frame (its forwarded ask)', () => {
    const h = home('always_hidden');
    h.appPanel.click();
    expect(h.docked()).toBe('docked');
    fire(h.framePanel, 'hass-toggle-menu', {});
    expect(h.docked()).toBe('always_hidden');
    expect(h.own).toEqual([]);
  });

  it('leaves a hold of the sidebar’s menu button to Home Assistant: its edit opens, the sidebar stays', () => {
    vi.useFakeTimers();
    const h = home('docked');
    h.sidebarMenu.dispatchEvent(new Event('touchstart', { bubbles: true, composed: true }));
    vi.advanceTimersByTime(600);
    h.sidebarMenu.dispatchEvent(
      new Event('touchend', { bubbles: true, composed: true, cancelable: true }),
    );
    expect(h.edits).toEqual([1]);
    expect(h.docked()).toBe('docked');
    // a mouse's long press the same
    h.sidebarMenu.dispatchEvent(new Event('mousedown', { bubbles: true, composed: true }));
    vi.advanceTimersByTime(600);
    h.sidebarMenu.click();
    expect(h.edits).toEqual([1, 1]);
    expect(h.docked()).toBe('docked');
  });

  it('leaves the companion app’s own sidebar to the app (Home Assistant asks it to show its sidebar)', () => {
    const h = home('docked', { appSidebar: true });
    h.headerMenu.click();
    touch(h.sidebarMenu);
    expect(h.own).toEqual(['sidebar/show', 'sidebar/show']);
    expect(h.docked()).toBe('docked');
  });

  it('leaves a phone its drawer, a kiosk its own, and an ask that says open or closed', () => {
    const phone = home('docked', { narrow: true });
    phone.headerMenu.click();
    expect(phone.own).toEqual(['drawer']);
    expect(phone.docked()).toBe('docked');
    document.body.replaceChildren();

    const kiosk = home('always_hidden', { kiosk: true });
    kiosk.headerMenu.click();
    expect(kiosk.own).toEqual(['drawer']);
    document.body.replaceChildren();

    // the companion app's "show the sidebar": Home Assistant's own answer, the drawer over a hidden one
    const asked = home('always_hidden');
    fire(asked.main, 'hass-toggle-menu', { open: true });
    expect(asked.own).toEqual(['drawer']);
    expect(asked.docked()).toBe('always_hidden');
  });

  it('is Home Assistant’s own way while the device has not chosen it (or is a wall): the drawer, the icons', () => {
    chosen = false;
    const hidden = home('always_hidden');
    hidden.headerMenu.click();
    expect(hidden.own).toEqual(['drawer']);
    expect(hidden.docked()).toBe('always_hidden');
    document.body.replaceChildren();

    const docked = home('docked');
    touch(docked.sidebarMenu);
    expect(docked.docked()).toBe('auto');
  });

  it('stops listening when asked', () => {
    stop();
    const h = home('always_hidden');
    h.headerMenu.click();
    expect(h.own).toEqual(['drawer']);
  });
});

describe('the menu’s next state', () => {
  const main = (hass: NonNullable<Main['hass']> | undefined, narrow = false): Main =>
    Object.assign(
      document.createElement('home-assistant-main'),
      hass ? { hass, narrow } : { narrow },
    );

  it('docks from hidden, hides from docked or from the icons, and leaves Home Assistant the rest', () => {
    expect(nextDock(main({ dockedSidebar: 'always_hidden' }), undefined)).toBe('docked');
    expect(nextDock(main({ dockedSidebar: 'docked' }), undefined)).toBe('always_hidden');
    expect(nextDock(main({ dockedSidebar: 'auto' }), undefined)).toBe('always_hidden');
    expect(nextDock(main({ dockedSidebar: 'docked' }, true), undefined)).toBeUndefined();
    expect(nextDock(main({ dockedSidebar: 'docked', kioskMode: true }), undefined)).toBeUndefined();
    expect(
      nextDock(
        main({ dockedSidebar: 'docked', auth: { external: { config: { hasSidebar: true } } } }),
        undefined,
      ),
    ).toBeUndefined();
    expect(nextDock(main({ dockedSidebar: 'always_hidden' }), true)).toBeUndefined();
    expect(nextDock(main({ dockedSidebar: 'docked' }), false)).toBeUndefined();
    expect(nextDock(main(undefined), undefined)).toBeUndefined();
  });
});

describe('the look', () => {
  afterEach(() => {
    localStorage.clear();
    document.body.replaceChildren();
  });

  it('answers the menus once this device chose it, as the page starts or as the choice is saved, and stops with it', async () => {
    const look = startLook()!;
    const h = home('always_hidden');
    h.headerMenu.click();
    expect(h.own).toEqual(['drawer']); // not chosen: Home Assistant's own, and nothing of ours fetched
    writeDevice({ dock: true });
    look.wearDevice(); // the panel's save
    await vi.dynamicImportSettled();
    h.headerMenu.click();
    expect(h.docked()).toBe('docked');
    look.stop();
    touch(h.sidebarMenu);
    expect(h.docked()).toBe('auto');
  });
});
