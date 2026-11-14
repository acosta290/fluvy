// @vitest-environment happy-dom
import {
  writeDevice,
  type HomeAssistant,
  type LovelaceCardConfig,
  type RootElement,
} from '@fluvy/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sync } from './index.js';
import type { FluvySidebar } from './sidebar.js';
import { SIDE_ATTRIBUTE } from './styles.js';

/** Home Assistant's card wrapper, as the sidebar's holder speaks to it: what it was handed. */
class Wrapper extends HTMLElement {
  static built: Wrapper[] = [];
  config: LovelaceCardConfig | undefined;
  hass: HomeAssistant | undefined;
  preview = false;

  load(): void {
    Wrapper.built.push(this);
  }

  /** The wrapper hides or shows itself, as Home Assistant's does for a card's conditions, and says so. */
  show(visible: boolean): void {
    this.hidden = !visible;
    this.dispatchEvent(
      new CustomEvent('card-visibility-changed', { bubbles: true, composed: true }),
    );
  }
}
customElements.define('hui-card', Wrapper);

const CLOCK = { type: 'custom:fluvy-clock-card' };
const ALERTS = { type: 'custom:fluvy-alerts-card' };
const TILE = { type: 'tile', entity: 'light.ceiling' };

const VIEWS = [
  { title: 'Home', path: 'home', icon: 'fluvy:home' },
  { title: 'Lights', path: 'lights', icon: 'mdi:lightbulb' },
  { title: 'Guests', path: 'guests', visible: [{ user: 'someone-else' }] },
  { title: 'Kitchen', path: 'kitchen', subview: true, back_path: '/tablet/lights' },
  { title: 'Staff', path: 'staff', visible: false },
  { title: 'Energy' },
];

const house = (user = 'marta'): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en' },
    themes: { darkMode: false },
    states: {},
    entities: {},
    devices: {},
    areas: {},
    user: { id: user, name: 'Marta', is_admin: true },
    panelUrl: 'tablet',
    panels: {},
    localize: (key: string) => key,
  }) as unknown as HomeAssistant;

/** A dashboard's root as Home Assistant draws it, as far as the sidebar reads it: its view row, its config, its view. */
function mount(sidebar: unknown, extra: Record<string, unknown> = {}) {
  const root = document.createElement('div') as RootElement & { _curView?: number };
  const shadow = root.attachShadow({ mode: 'open' });
  const view = document.createElement('div');
  view.id = 'view';
  const background = document.createElement('span');
  const shown = document.createElement('section');
  view.append(background, shown);
  shadow.append(view);
  Object.assign(root, {
    hass: house(),
    lovelace: {
      editMode: false,
      config: { views: VIEWS, ...(sidebar === undefined ? {} : { fluvy_sidebar: sidebar }) },
    },
    _curView: 0,
    ...extra,
  });
  document.body.append(root);
  const side = (): FluvySidebar | null => view.querySelector('fluvy-sidebar');
  const settle = async (): Promise<void> => {
    await side()?.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await side()?.updateComplete;
  };
  const menu = (): { title: string; current: string | null; href: string | null }[] =>
    [...(side()?.shadowRoot?.querySelectorAll('.sb-item') ?? [])].map((item) => ({
      title: item.textContent?.trim() ?? '',
      current: item.getAttribute('aria-current'),
      href: item.getAttribute('href'),
    }));
  return { root, view, shown, side, settle, menu };
}

const width = (px: number): void => {
  Object.defineProperty(window, 'innerWidth', { value: px, configurable: true });
};

beforeEach(() => {
  Wrapper.built = [];
  localStorage.clear();
  width(1400);
});
afterEach(() => document.body.replaceChildren());

describe('a dashboard’s own sidebar in Home Assistant’s page', () => {
  it('stands first in the view row, marked on the root, and stays there as Home Assistant swaps the view', async () => {
    const { root, view, shown, side, settle } = mount({ menu: 'views' });
    sync(root);
    await settle();
    expect(view.firstElementChild).toBe(side());
    expect(root.getAttribute(SIDE_ATTRIBUTE)).toBe('start beside');
    expect(side()?.style.getPropertyValue('--fluvy-side-width')).toBe('320px');
    // Home Assistant takes the last child of the row and appends the next view's
    shown.remove();
    view.append(document.createElement('section'));
    sync(root);
    expect(view.firstElementChild).toBe(side());
    expect(view.querySelectorAll('fluvy-sidebar')).toHaveLength(1);
    // a row it emptied gets the same element back
    const before = side();
    view.replaceChildren();
    sync(root);
    expect(view.firstElementChild).toBe(before);
  });

  it('draws nothing for a dashboard without the key, and leaves when the key goes', async () => {
    const { root, view, side } = mount(undefined);
    sync(root);
    expect(side()).toBeNull();
    expect(root.hasAttribute(SIDE_ATTRIBUTE)).toBe(false);
    root.lovelace = { editMode: false, config: { views: VIEWS, fluvy_sidebar: {} } };
    sync(root);
    expect(side()).not.toBeNull();
    // Home Assistant keeps the root for the next dashboard, which asks for none
    root.lovelace = { editMode: false, config: { views: VIEWS } };
    sync(root);
    expect(view.querySelector('fluvy-sidebar')).toBeNull();
    expect(root.hasAttribute(SIDE_ATTRIBUTE)).toBe(false);
  });

  it('lists the views this person may open, the open one marked, and follows the view without building anything again', async () => {
    const { root, side, settle, menu } = mount({ header: { cards: [CLOCK] }, menu: 'views' });
    sync(root);
    await settle();
    // no subview, no view hidden from this person; a view with no path goes by its place
    expect(menu()).toEqual([
      { title: 'Home', current: 'page', href: '/tablet/home' },
      { title: 'Lights', current: null, href: '/tablet/lights' },
      { title: 'Energy', current: null, href: '/tablet/5' },
    ]);
    expect(side()?.shadowRoot?.querySelector('nav')?.getAttribute('aria-label')).toBe('Pages');
    const built = Wrapper.built.length;
    const element = side();
    root._curView = 1;
    sync(root);
    await settle();
    expect(menu().map((item) => item.current)).toEqual([null, 'page', null]);
    // inside a subview, the view it goes back to
    root._curView = 3;
    sync(root);
    await settle();
    expect(menu().map((item) => item.current)).toEqual([null, 'page', null]);
    expect(side()).toBe(element);
    expect(Wrapper.built).toHaveLength(built);
  });

  it('keeps its cards when a strategy hands Home Assistant the same configuration again, and builds a list anew only when it changes', async () => {
    const config = { header: { cards: [CLOCK] }, cards: [TILE], footer: { cards: [ALERTS] } };
    const { root, side, settle } = mount(config);
    sync(root);
    await settle();
    const cards = (): Element[] => [...(side()?.children ?? [])];
    expect(cards().map((card) => [card.localName, card.slot])).toEqual([
      ['hui-card', 'header'],
      ['hui-card', 'cards'],
      ['hui-card', 'footer'],
    ]);
    expect((cards()[0] as Wrapper).config).toEqual(CLOCK);
    const first = cards();
    // another object that reads the same
    root.lovelace = {
      editMode: false,
      config: { views: VIEWS, fluvy_sidebar: JSON.parse(JSON.stringify(config)) as unknown },
    };
    sync(root);
    await settle();
    expect(cards()).toEqual(first);
    // the middle changes: its cards are built, the head's and the foot's stay
    root.lovelace = {
      editMode: false,
      config: { views: VIEWS, fluvy_sidebar: { ...config, cards: [TILE, CLOCK] } },
    };
    sync(root);
    await settle();
    expect(cards()).toHaveLength(4);
    expect(cards()[0]).toBe(first[0]);
    expect(cards()[3]).toBe(first[2]);
    expect(cards()[1]).not.toBe(first[1]);
  });

  it('hands every card the house, each change of it', async () => {
    const { root, side, settle } = mount({ cards: [TILE] });
    sync(root);
    await settle();
    const card = side()?.firstElementChild as Wrapper;
    expect(card.hass).toBe(root.hass);
    const next = house();
    Object.assign(root, { hass: next });
    sync(root);
    expect(card.hass).toBe(next);
  });

  it('is gone in the edit mode, in a subview or on a view it is not for, for a person it is not for and on a device that hides sidebars', async () => {
    const { root, side } = mount({ menu: 'views', subviews: false, views: ['home', 'lights'] });
    const config = root.lovelace?.config ?? {};
    const shows = (): boolean => {
      sync(root);
      return side() !== null && root.hasAttribute(SIDE_ATTRIBUTE);
    };
    expect(shows()).toBe(true);
    root.lovelace = { editMode: true, config };
    expect(shows()).toBe(false);
    root.lovelace = { editMode: false, config };
    expect(shows()).toBe(true);
    // a subview, where the dashboard asks for none there; a view it does not name
    root._curView = 3;
    expect(shows()).toBe(false);
    root._curView = 5;
    expect(shows()).toBe(false);
    root._curView = 1;
    expect(shows()).toBe(true);
    // this device hides every dashboard's sidebar
    writeDevice({ hideSidebars: true });
    expect(shows()).toBe(false);
    writeDevice({ hideSidebars: false });
    expect(shows()).toBe(true);
    // only for the people it names
    root.lovelace = {
      editMode: false,
      config: { views: VIEWS, fluvy_sidebar: { users: ['pau'] } },
    };
    expect(shows()).toBe(false);
    Object.assign(root, { hass: house('pau') });
    expect(shows()).toBe(true);
  });

  it('stands by the device: beside the views on a tablet and a desktop, and on a phone as the dashboard asks', async () => {
    const { root, side, settle } = mount({
      menu: 'views',
      width: { tablet: 260, desktop: '24%' },
      phone: 'top',
      hide_tabs: true,
      position: 'end',
    });
    const marks = (): string | null => {
      sync(root);
      return root.getAttribute(SIDE_ATTRIBUTE);
    };
    expect(marks()).toBe('end beside no-tabs');
    await settle();
    expect(side()?.style.getPropertyValue('--fluvy-side-width')).toBe('clamp(160px, 24%, 560px)');
    width(1024);
    expect(marks()).toBe('end beside no-tabs');
    await settle();
    expect(side()?.style.getPropertyValue('--fluvy-side-width')).toBe('260px');
    width(390);
    expect(marks()).toBe('end top no-tabs');
    await settle();
    expect(side()?.shadowRoot?.querySelector('.sb-menu--row')).not.toBeNull();
    // none on a phone unless asked; in a drawer the header keeps its tabs: the menu is behind a tap
    root.lovelace = { editMode: false, config: { views: VIEWS, fluvy_sidebar: { menu: 'views' } } };
    expect(marks()).toBeNull();
    root.lovelace = {
      editMode: false,
      config: { views: VIEWS, fluvy_sidebar: { menu: 'views', phone: 'drawer', hide_tabs: true } },
    };
    expect(marks()).toBe('start drawer');
  });

  it('folds to its icons where the dashboard lets it, and stands that way the next time on this device', async () => {
    const config = { header: { cards: [CLOCK] }, menu: 'views', collapsible: true };
    const { root, side, settle } = mount(config);
    sync(root);
    await settle();
    const fold = (): HTMLElement =>
      side()!.shadowRoot!.querySelector<HTMLElement>('.sb-fold button')!;
    expect(fold().getAttribute('aria-label')).toBe('Fold the sidebar');
    expect(fold().getAttribute('aria-expanded')).toBe('true');
    expect(side()?.children).toHaveLength(1);
    fold().click();
    await settle();
    // the menu's circles alone, each read out by its page; its cards out of the page
    expect(side()?.shadowRoot?.querySelector('.sb')?.classList.contains('is-rail')).toBe(true);
    expect(side()?.style.getPropertyValue('--fluvy-side-width')).toBe('60px');
    expect(side()?.children).toHaveLength(0);
    expect(
      [...side()!.shadowRoot!.querySelectorAll('.sb-item')].map((item) =>
        item.getAttribute('aria-label'),
      ),
    ).toEqual(['Home', 'Lights', 'Energy']);
    expect(fold().getAttribute('aria-label')).toBe('Unfold the sidebar');
    expect(JSON.parse(localStorage.getItem('fluvy:sidebars') ?? '{}')).toEqual({ tablet: true });
    // another page of the same dashboard, later: folded from its first frame
    document.body.replaceChildren();
    const again = mount(config);
    sync(again.root);
    await again.settle();
    expect(again.side()?.shadowRoot?.querySelector('.is-rail')).not.toBeNull();
    again.side()!.shadowRoot!.querySelector<HTMLElement>('.sb-fold button')!.click();
    await again.settle();
    expect(localStorage.getItem('fluvy:sidebars')).toBeNull();
    expect(again.side()?.children).toHaveLength(1);
  });

  it('rules a card that has something above it in its list, and moves the line when a card hides itself', async () => {
    const { root, side, settle } = mount({
      header: { cards: [CLOCK] },
      menu: 'views',
      cards: [TILE, CLOCK],
    });
    sync(root);
    await settle();
    const ruled = (): boolean[] =>
      [...side()!.children].map((card) => card.hasAttribute('data-ruled'));
    // the head's only card has nothing above it; the middle's first stands under the menu
    expect(ruled()).toEqual([false, true, true]);
    root.lovelace = {
      editMode: false,
      config: { views: VIEWS, fluvy_sidebar: { cards: [TILE, CLOCK, ALERTS] } },
    };
    sync(root);
    await settle();
    expect(ruled()).toEqual([false, true, true]);
    (side()!.children[0] as Wrapper).show(false);
    expect(ruled()).toEqual([false, false, true]);
  });

  it('gives a list’s part of the column up while every card of it is hidden, and has it back with the first that shows', async () => {
    const { root, side, settle } = mount({
      header: { cards: [CLOCK] },
      footer: { cards: [ALERTS] },
    });
    sync(root);
    await settle();
    const foot = (): Element | null => side()!.shadowRoot!.querySelector('.sb-foot');
    const alerts = [...side()!.children].find((card) => card.slot === 'footer') as Wrapper;
    expect(foot()).not.toBeNull();
    // the alerts while all is clear: the foot goes with them, the card still in the page to say when it has something
    alerts.show(false);
    await settle();
    expect(foot()).toBeNull();
    expect(alerts.isConnected).toBe(true);
    alerts.show(true);
    await settle();
    expect(foot()?.querySelector('slot[name="footer"]')).not.toBeNull();
  });

  it('opens its pages by their addresses, marks the one the address names, and runs an action in a page’s place', async () => {
    (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(
      'http://localhost:3000/tablet/lights',
    );
    const calls: unknown[] = [];
    const { root, side, settle, menu } = mount({
      menu: {
        items: [
          { title: 'Home', path: '/tablet/home' },
          { title: 'Lights', path: 'lights' },
          {
            title: 'All off',
            tap_action: { action: 'perform-action', perform_action: 'light.turn_off' },
          },
        ],
      },
    });
    Object.assign(root, {
      hass: {
        ...house(),
        callService: async (...call: unknown[]) => void calls.push(call),
      },
    });
    sync(root);
    await settle();
    expect(menu()).toEqual([
      { title: 'Home', current: null, href: '/tablet/home' },
      // a view by its path alone is this dashboard's
      { title: 'Lights', current: 'page', href: '/tablet/lights' },
      { title: 'All off', current: null, href: null },
    ]);
    const items = [...side()!.shadowRoot!.querySelectorAll<HTMLElement>('.sb-item')];
    let moved = 0;
    window.addEventListener('location-changed', () => (moved += 1));
    items[0]!.click();
    expect(location.pathname).toBe('/tablet/home');
    expect(moved).toBe(1);
    items[2]!.click();
    await settle();
    expect(calls).toEqual([['light', 'turn_off', {}, undefined]]);
  });

  it('takes every sidebar off the page when it throws, and hands the throw on', async () => {
    const { root, view } = mount({ menu: 'views' });
    sync(root);
    expect(view.querySelector('fluvy-sidebar')).not.toBeNull();
    // a root Home Assistant reshaped: its view cannot be read
    Object.defineProperty(root, '_curView', {
      get: () => {
        throw new TypeError('reshaped');
      },
    });
    expect(() => sync(root)).toThrow('reshaped');
    expect(view.querySelector('fluvy-sidebar')).toBeNull();
    expect(root.hasAttribute(SIDE_ATTRIBUTE)).toBe(false);
  });
});
