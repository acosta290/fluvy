import type { RootElement } from './tabs.js';

/*
 * The view a dashboard shows, as its root (`hui-root`) knows it: whether it is a subview, where Home Assistant goes back
 * to from it, and its title. The root is marked while it shows a subview (`fluvy-subview`), and every change is told to
 * the page (`fluvy-view`): a wall, which has no header, draws its own way back from it.
 */

/** On `hui-root`: the view it shows is a subview. */
export const SUBVIEW_ATTRIBUTE = 'fluvy-subview';
/** Told on the window (from the root, composed) when the view a dashboard shows changes. */
export const VIEW_EVENT = 'fluvy-view';

export interface ViewFacts {
  readonly subview: boolean;
  /** The view's own `back_path`, when it names one (else Home Assistant goes back by its history). */
  readonly backPath: string | undefined;
  readonly title: string;
}

export const NO_VIEW: ViewFacts = { subview: false, backPath: undefined, title: '' };

/** What the root shows now (read after it rendered: on `location-changed` its view has not moved yet). */
export function currentView(root: RootElement): ViewFacts {
  const index = root._curView;
  const view = typeof index === 'number' ? root.lovelace?.config?.views?.[index] : undefined;
  if (!view) return NO_VIEW;
  return {
    subview: view.subview === true,
    backPath: typeof view.back_path === 'string' && view.back_path ? view.back_path : undefined,
    title: typeof view.title === 'string' ? view.title.trim() : '',
  };
}

const told = new WeakMap<Element, string>();

/** Marks the root as showing a subview (or not) and tells the page when what it shows has changed. */
export function markView(root: RootElement, facts: ViewFacts = currentView(root)): void {
  root.toggleAttribute(SUBVIEW_ATTRIBUTE, facts.subview);
  const key = `${facts.subview}|${facts.backPath ?? ''}|${facts.title}`;
  if (told.get(root) === key) return;
  told.set(root, key);
  root.dispatchEvent(new CustomEvent(VIEW_EVENT, { bubbles: true, composed: true, detail: facts }));
}
