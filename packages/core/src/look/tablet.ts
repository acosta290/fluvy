/**
 * The menu as on a tablet held sideways (Appearance → Sidebar and header → Tablet, horizontal): the sidebar hidden away
 * until it is asked for, then open beside the page — the page moves over for it — never over it. Home Assistant has
 * the two states already (its "Always hide the sidebar", this browser's own, and the sidebar docked); what it lacks is
 * a way between them: its header's menu icon opens the hidden sidebar as a drawer over the page, and the sidebar's own
 * icon folds a docked one to a row of icons. Here the header's icon docks it and the sidebar's hides it again, through
 * the event Home Assistant's own setting sends (`hass-dock-sidebar`), so the browser remembers the last one as it would.
 *
 * Home Assistant calls a screen narrow up to 870 px and draws a phone's drawer there whatever is docked: a phone keeps
 * it.
 */

/** Home Assistant's own word for the sidebar's state, as its `hass.dockedSidebar` holds it. */
export type Docked = 'docked' | 'always_hidden' | 'auto';

/** Where Home Assistant stops drawing a phone's drawer (its `narrow` is `max-width: 870px`). */
export const WIDE = '(min-width: 871px)';

type App = HTMLElement & { hass?: { dockedSidebar?: Docked } };

/** The tap's target: the header's menu icon, the sidebar's own, or neither. */
export function menuTapped(path: readonly EventTarget[]): 'header' | 'sidebar' | null {
  for (const target of path) {
    if (!(target instanceof Element)) continue;
    if (target.localName === 'ha-menu-button') return 'header';
    // the sidebar's icon is the one button in its head (`.menu`), in the sidebar's own shadow
    if (
      target.localName === 'ha-icon-button' &&
      target.parentElement?.classList.contains('menu') &&
      (target.getRootNode() as ShadowRoot).host?.localName === 'ha-sidebar'
    )
      return 'sidebar';
  }
  return null;
}

/** What the sidebar becomes on a tap (null: Home Assistant's own way, as it is). */
export function nextDock(
  tapped: 'header' | 'sidebar' | null,
  docked: Docked | undefined,
): Docked | null {
  if (tapped === 'header' && docked === 'always_hidden') return 'docked';
  if (tapped === 'sidebar' && docked !== undefined && docked !== 'always_hidden')
    return 'always_hidden';
  return null;
}

/**
 * Listens for the taps on the menu icons while `on` says the house chose it; gives back the way to stop. The tap is
 * caught on its way down, before Home Assistant's own handler opens the drawer or folds the sidebar.
 */
export function watchTablet(doc: Document, on: () => boolean): () => void {
  const view = doc.defaultView;
  if (!view) return () => undefined;
  const onClick = (event: Event): void => {
    if (!on() || !view.matchMedia(WIDE).matches) return;
    const app = doc.querySelector<App>('home-assistant');
    const dock = nextDock(menuTapped(event.composedPath()), app?.hass?.dockedSidebar);
    if (!app || !dock) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    app.dispatchEvent(
      new CustomEvent('hass-dock-sidebar', { detail: { dock }, bubbles: true, composed: true }),
    );
  };
  view.addEventListener('click', onClick, true);
  return () => view.removeEventListener('click', onClick, true);
}
