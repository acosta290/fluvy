// the sidebar's words first: they are here before it speaks
import './english.js';
import {
  guard,
  readDevice,
  SIDEBAR_PATCH,
  type HomeAssistant,
  type RootElement,
} from '@fluvy/core';
import {
  DESKTOP_FROM,
  deviceOf,
  isAddress,
  isIcon,
  isViewPath,
  parseSidebar,
  presentationOf,
  TABLET_FROM,
  type Presentation,
  type SidebarSpec,
} from './config.js';
import { TAG, type FluvySidebar, type MenuEntry } from './sidebar.js';
import { rootCss, SIDE_ATTRIBUTE } from './styles.js';

/*
 * A dashboard's own sidebar in Home Assistant's page (1.21, #187). This file is its own chunk, fetched by the first
 * dashboard whose configuration holds `fluvy_sidebar:` (`core/look/tabs.ts`), and `sync` is then told of every
 * `hui-root` as it updates — no clock asks. Home Assistant swaps only the last child of its view row (`#view`) when the
 * view changes, so one element put first there stays through every view: it is put there, kept there (put back should
 * Home Assistant empty the row), told the house and the open view, and taken away where the dashboard asks for none,
 * in the edit mode (the view is edited at its whole width), on a view or for a person it is not for, and on a device
 * that hides dashboard sidebars. The root carries a mark and one sheet whose every rule hangs on it. What throws
 * takes every sidebar off the page and steps the patch aside for the session (the wrap's guard says so once).
 */

type View = NonNullable<
  NonNullable<NonNullable<RootElement['lovelace']>['config']>['views']
>[number];

/** A root whose dashboard asks for a sidebar: the element (in the page or not), and the row it is watched in. */
interface Kept {
  readonly side: FluvySidebar;
  view: Element | undefined;
  watch: ResizeObserver | undefined;
  /** What the view row's paddings were last read for: the view shown, the edit mode. */
  laid: string;
  /** The configuration as last read, and what it asks for. */
  raw: unknown;
  json: string;
  spec: SidebarSpec | undefined;
}

const kept = new Map<RootElement, Kept>();

/** The sheet every root with a sidebar adopts: one for the page. */
let sheet: CSSStyleSheet | undefined;

function wear(root: RootElement): void {
  const shadow = root.shadowRoot;
  if (!shadow) return;
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(rootCss);
  }
  if (!shadow.adoptedStyleSheets.includes(sheet))
    shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
}

function mark(root: RootElement, words: string | null): void {
  if (root.getAttribute(SIDE_ATTRIBUTE) === words) return;
  if (words === null) root.removeAttribute(SIDE_ATTRIBUTE);
  else root.setAttribute(SIDE_ATTRIBUTE, words);
}

/** The sidebar out of the page, its root unmarked: the view has its whole width. */
function leave(root: RootElement, state: Kept): void {
  state.watch?.disconnect();
  state.watch = undefined;
  state.view = undefined;
  state.laid = '';
  state.side.remove();
  mark(root, null);
}

/**
 * What the configuration asks for. A strategy hands Home Assistant a new configuration whenever the house changes: one
 * that reads the same keeps the sidebar it had, so nothing is built again.
 */
function specOf(root: RootElement, state: Kept | undefined): Partial<Kept> {
  const raw = root.lovelace?.config?.fluvy_sidebar;
  if (state && state.raw === raw) return state;
  const json = JSON.stringify(raw) ?? '';
  return { raw, json, spec: state && state.json === json ? state.spec : parseSidebar(raw) };
}

const viewsOf = (root: RootElement): readonly View[] => root.lovelace?.config?.views ?? [];

const userOf = (root: RootElement): string | undefined =>
  (root.hass as Pick<HomeAssistant, 'user'> | undefined)?.user?.id;

/** How it stands on this root now; undefined where it does not. */
function presentation(root: RootElement, spec: SidebarSpec): Presentation | undefined {
  if (root.lovelace?.editMode || readDevice().hideSidebars) return undefined;
  const user = userOf(root);
  if (spec.users && !(user && spec.users.includes(user))) return undefined;
  const index = root._curView;
  const view = typeof index === 'number' ? viewsOf(root)[index] : undefined;
  if (view?.subview && !spec.subviews) return undefined;
  if (spec.views && !(view && spec.views.includes(view.path ?? String(index)))) return undefined;
  return presentationOf(spec, deviceOf(window.innerWidth));
}

/** "/tablet/living/" and "/tablet/living?edit=1" are the page "/tablet/living". */
function page(path: string): string {
  const clean = path.split(/[?#]/)[0] ?? '';
  return clean.length > 1 && clean.endsWith('/') ? clean.slice(0, -1) : clean;
}

/** A view Home Assistant hides from this person: `visible: false`, or a list of people they are not among. */
const hiddenFrom = (view: View, user: string | undefined): boolean => {
  const visible = view?.visible;
  return (
    visible === false ||
    (Array.isArray(visible) && !visible.some((entry: { user?: unknown }) => entry?.user === user))
  );
};

/** The icons a view's name says (core's table, a file of its own): fetched by the first page that has none. */
let names: typeof import('@fluvy/core/view-icons') | undefined;
let asked = false;

/** A page's icon where it names none: the one its name says, else the grid. */
function iconFor(title: string, path: string): string {
  if (!names && !asked) {
    asked = true;
    void import('@fluvy/core/view-icons').then(
      (table) => {
        names = table;
        again();
      },
      () => undefined,
    );
  }
  const name = names?.viewIconName(title, path);
  return name ? `fluvy:${name}` : 'grid';
}

/** The menu's pages as they are drawn: the dashboard's views this person may open, or the pages written. */
function entriesOf(root: RootElement, spec: SidebarSpec): MenuEntry[] {
  const menu = spec.menu;
  if (!menu) return [];
  const base = `/${root.hass?.panelUrl ?? ''}`;
  if (menu.items !== 'views') {
    const here = page(location.pathname);
    return menu.items.map((item): MenuEntry => {
      const path =
        item.path === undefined || item.path.startsWith('/') ? item.path : `${base}/${item.path}`;
      return {
        title: item.title,
        icon: item.icon ?? iconFor(item.title, item.path ?? ''),
        ...(path === undefined ? { action: item.tap_action } : { path }),
        current: path !== undefined && page(path) === here,
      };
    });
  }
  const views = viewsOf(root);
  const user = userOf(root);
  const index = root._curView;
  const open = typeof index === 'number' ? views[index] : undefined;
  // inside a subview, the view it goes back to is the one open
  const back = open?.subview && isAddress(open.back_path) ? page(open.back_path) : undefined;
  return views.flatMap((view, i): MenuEntry[] => {
    if (!view || view.subview || hiddenFrom(view, user)) return [];
    const own = isViewPath(view.path) ? view.path : '';
    const path = `${base}/${own || i}`;
    const title = view.title?.trim() || own || String(i + 1);
    return [
      {
        title,
        icon: isIcon(view.icon) ? view.icon : iconFor(title, own),
        path,
        current: back === undefined ? i === index : back === path,
      },
    ];
  });
}

/**
 * The view row's own paddings, told to the sidebar: it stands from under the header (none on a wall, the tab bar's
 * with it elsewhere) to the row's foot, whatever Home Assistant, a wall or a kiosk make of them.
 */
function measure({ side, view }: Kept): void {
  if (!view) return;
  const style = getComputedStyle(view);
  for (const [name, value] of [
    ['top', style.paddingTop],
    ['bottom', style.paddingBottom],
  ] as const) {
    const px = `${parseFloat(value) || 0}px`;
    if (side.style.getPropertyValue(`--fluvy-side-${name}`) !== px)
      side.style.setProperty(`--fluvy-side-${name}`, px);
  }
}

/** Every root again, under the patch's guard: the window crossed a width, a page's icons landed. */
function again(): void {
  for (const root of [...kept.keys()]) guard(SIDEBAR_PATCH, () => sync(root), root.ownerDocument);
}

let listening = false;

/** The window crossing a phone's or a tablet's width draws every sidebar again; listened to once a page. */
function listen(): void {
  if (listening || typeof matchMedia !== 'function') return;
  listening = true;
  for (const from of [TABLET_FROM, DESKTOP_FROM])
    matchMedia(`(min-width: ${from}px)`).addEventListener('change', again);
}

function draw(root: RootElement): void {
  // a root that left the page is forgotten
  for (const [other, state] of kept)
    if (other !== root && !other.isConnected) {
      leave(other, state);
      kept.delete(other);
    }
  let state = kept.get(root);
  const read = specOf(root, state);
  const spec = read.spec;
  if (!spec) {
    if (state) {
      leave(root, state);
      kept.delete(root);
    }
    return;
  }
  if (!state) {
    state = {
      side: document.createElement(TAG) as FluvySidebar,
      view: undefined,
      watch: undefined,
      laid: '',
      raw: undefined,
      json: '',
      spec: undefined,
    };
    kept.set(root, state);
    listen();
  }
  Object.assign(state, read);
  const view = root.shadowRoot?.querySelector('#view') ?? undefined;
  const shown = view ? presentation(root, spec) : undefined;
  if (!view || !shown) return leave(root, state);
  const { side } = state;
  wear(root);
  side.spec = spec;
  side.device = deviceOf(window.innerWidth);
  side.presentation = shown;
  side.side = spec.position;
  side.memory = root.hass?.panelUrl ?? '';
  side.hass = root.hass as unknown as HomeAssistant | undefined;
  const entries = entriesOf(root, spec);
  if (JSON.stringify(entries) !== JSON.stringify(side.entries)) side.entries = entries;
  // first in the row: Home Assistant swaps the last child alone, and one it emptied gets it back
  if (view.firstElementChild !== side) view.prepend(side);
  if (state.view !== view) {
    state.watch?.disconnect();
    state.view = view;
    state.watch =
      typeof ResizeObserver === 'function' ? new ResizeObserver(() => measure(state)) : undefined;
    state.watch?.observe(view);
    measure(state);
  }
  // the row's paddings move with the view shown (a wall's subview takes a header): read again before the next frame
  const laid = `${root._curView}|${shown}`;
  if (state.laid !== laid) {
    if (state.laid) requestAnimationFrame(() => measure(state));
    state.laid = laid;
  }
  const tabs = spec.hideTabs && spec.menu?.items === 'views' && shown !== 'drawer';
  mark(root, `${spec.position} ${shown}${tabs ? ' no-tabs' : ''}`);
}

/**
 * Draws, moves or takes away a root's sidebar, as its dashboard and its view stand now. What throws takes every
 * sidebar off the page before it goes on to the wrap's guard, which steps the patch aside.
 */
export function sync(root: RootElement): void {
  try {
    draw(root);
  } catch (error) {
    for (const [other, state] of kept) leave(other, state);
    kept.clear();
    throw error;
  }
}
