// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHROME_DEFAULTS, parseChrome, sameChrome } from '../look/tabs.js';
import { menuTapped, nextDock, watchTablet, type Docked } from '../look/tablet.js';

describe('the tablet choice', () => {
  it('is off by default, read only from a boolean, and part of what tells two corners apart', () => {
    expect(CHROME_DEFAULTS.tablet).toBe(false);
    expect(parseChrome({ tablet: true })?.tablet).toBe(true);
    expect(parseChrome({ tablet: 'yes' })?.tablet).toBe(false);
    expect(parseChrome({})?.tablet).toBe(false);
    expect(sameChrome(CHROME_DEFAULTS, { ...CHROME_DEFAULTS, tablet: true })).toBe(false);
  });
});

describe('the menu icons on a tablet', () => {
  it('dock a hidden sidebar from the header, hide an open one from the sidebar, and leave the rest to Home Assistant', () => {
    expect(nextDock('header', 'always_hidden')).toBe('docked');
    expect(nextDock('header', 'docked')).toBeNull();
    expect(nextDock('sidebar', 'docked')).toBe('always_hidden');
    expect(nextDock('sidebar', 'auto')).toBe('always_hidden');
    expect(nextDock('sidebar', 'always_hidden')).toBeNull();
    expect(nextDock(null, 'docked')).toBeNull();
    expect(nextDock('sidebar', undefined)).toBeNull();
  });

  it('tell the header’s icon from the sidebar’s, and any other button from both', () => {
    const header = document.createElement('ha-menu-button');
    expect(menuTapped([document.createElement('ha-svg-icon'), header, document.body])).toBe(
      'header',
    );

    const sidebar = document.createElement('ha-sidebar');
    const shadow = sidebar.attachShadow({ mode: 'open' });
    const head = document.createElement('div');
    head.className = 'menu';
    const icon = document.createElement('ha-icon-button');
    head.append(icon);
    shadow.append(head);
    expect(menuTapped([icon, head, shadow, sidebar])).toBe('sidebar');

    const other = document.createElement('ha-icon-button');
    document.body.append(other);
    expect(menuTapped([other, document.body])).toBeNull();
    other.remove();
  });
});

describe('watching the taps', () => {
  let off: (() => void) | undefined;
  afterEach(() => {
    off?.();
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  const setup = (docked: Docked, wide = true) => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: wide } as MediaQueryList);
    const app = Object.assign(document.createElement('home-assistant'), {
      hass: { dockedSidebar: docked },
    });
    const button = document.createElement('ha-menu-button');
    document.body.append(app, button);
    const asked: string[] = [];
    app.addEventListener('hass-dock-sidebar', (event) =>
      asked.push((event as CustomEvent<{ dock: string }>).detail.dock),
    );
    const own = vi.fn();
    button.addEventListener('click', own);
    return { button, asked, own };
  };

  it('docks the sidebar in place of Home Assistant’s drawer while the house chose it', () => {
    const { button, asked, own } = setup('always_hidden');
    off = watchTablet(document, () => true);
    button.click();
    expect(asked).toEqual(['docked']);
    expect(own).not.toHaveBeenCalled();
  });

  it('leaves the tap to Home Assistant when the choice is off or the screen is a phone’s', () => {
    let { button, asked, own } = setup('always_hidden');
    off = watchTablet(document, () => false);
    button.click();
    expect(asked).toEqual([]);
    expect(own).toHaveBeenCalledOnce();
    off();
    document.body.replaceChildren();

    ({ button, asked, own } = setup('always_hidden', false));
    off = watchTablet(document, () => true);
    button.click();
    expect(asked).toEqual([]);
    expect(own).toHaveBeenCalledOnce();
  });

  it('stops listening when asked', () => {
    const { button, asked } = setup('always_hidden');
    watchTablet(document, () => true)();
    button.click();
    expect(asked).toEqual([]);
  });
});
