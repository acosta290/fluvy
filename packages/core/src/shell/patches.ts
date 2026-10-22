import { THEME_SENTINEL } from '@fluvy/tokens/config';
import { PAGE_ATTRIBUTE, WALL_ATTRIBUTE } from '../look/attributes.js';

/**
 * The patches on Home Assistant's own elements (the shell's, the look's, the pages'): a method of one of its elements
 * wrapped so that Home Assistant's code always runs (but the Activity and History panels' render, which our pages stand
 * in for while the page wears Fluvy: `takeover.ts`), and ours only while Fluvy is in use on the element's page, caught
 * (`wrap`). Home Assistant's internals change between releases without notice: a part of ours that throws steps its
 * patch aside in its document for the rest of the session — said once in the console and in the shell's report — and
 * Home Assistant's code goes on alone. Nothing is ever a hard stop: a Home Assistant outside the releases this build was checked against
 * is a note in the report, no more.
 */

/**
 * The theme is on when our sentinel is among the inline variables of `<html>` (Home Assistant applied the
 * fluvy theme) or `<body>` (a panel frame), or when the look covers the whole app (`<html fluvy-look>`).
 */
export const themed = (doc: Document): boolean =>
  doc.documentElement.hasAttribute(PAGE_ATTRIBUTE) ||
  [doc.documentElement, doc.body].some(
    (element) => (element?.style.getPropertyValue(THEME_SENTINEL).trim() ?? '') !== '',
  );

type Worn = (urlPath: string | undefined) => boolean;

let worn: Worn = () => false;

/** The look says which dashboards wear it (the `dashboards` scope), by url path. */
export const setWorn = (wears: Worn): void => {
  worn = wears;
};

/**
 * Whether Fluvy is in use on `doc`: the page wears the theme or the look covers it (`themed`), the device is one of the
 * house's walls, or the dashboard on screen wears the look. Cheap, and read each time a patch is about to act: a theme
 * switched or a dashboard left is followed at once.
 */
export const inUse = (doc: Document): boolean =>
  themed(doc) ||
  doc.documentElement.hasAttribute(WALL_ATTRIBUTE) ||
  worn(doc.location?.pathname.split('/')[1]);

/**
 * The patches that stepped aside, by document (the page, a panel frame: each has its own elements and its own patches),
 * then by name, with what their part threw.
 */
const asides = new WeakMap<Document, Record<string, string>>();

/** The patches that stepped aside on `doc`, by name, with what their part threw. */
export const asidesOf = (doc: Document): Readonly<Record<string, string>> => asides.get(doc) ?? {};

/** The Home Assistant releases this build was checked against: the floor HACS installs on, to the latest checked. */
export const CHECKED = '2026.9–2026.10';

type HassElement = Element & { hass?: { config?: { version?: string } } };

/** Home Assistant's version on the page (`hass.config.version`, `?` before it connects) beside the releases checked. */
export const versionNote = (doc: Document = document): string =>
  `Home Assistant ${(doc.querySelector('home-assistant') as HassElement | null)?.hass?.config?.version ?? '?'} (checked: ${CHECKED})`;

/**
 * Runs `part`, our part of the patch `name` on the elements of `doc` (the page, unless a panel frame's), and returns
 * what it returned; undefined once the patch stepped aside there. A part that throws steps its patch aside on that
 * document for the session: one that fails inside HACS's frame stays on the page, and the other way round.
 */
export function guard<T>(name: string, part: () => T, doc: Document = document): T | undefined {
  if (name in (asides.get(doc) ?? {})) return undefined;
  try {
    return part();
  } catch (error) {
    stepAside(name, error, doc);
    return undefined;
  }
}

/** Steps the patch `name` aside on `doc` for the session, saying once why (a part that failed later, out of `guard`). */
export function stepAside(name: string, error: unknown, doc: Document = document): void {
  const aside = asides.get(doc) ?? {};
  if (name in aside) return;
  aside[name] = `stepped aside: ${error}`;
  asides.set(doc, aside);
  console.warn(`[fluvy] ${name} ${aside[name]} · ${versionNote()}`);
}

/** `when` for a part that only follows our own marks: puts them on where the look is worn, takes them off elsewhere. */
export const always = (): boolean => true;

/** The wraps this build made: a second start finds its own wrap and wraps no wrap. */
const wraps = new WeakSet<object>();

/**
 * Wraps `method` of one of Home Assistant's element classes (`proto`, its prototype) as the patch `name`: Home
 * Assistant's own runs first and always; then `ours`, given the element, what Home Assistant's returned and the
 * arguments — while `when` holds (Fluvy in use on the element's page), both guarded. What `ours` returns, unless
 * undefined, is what the method returns. False when the method is not there (Home Assistant reshaped the element):
 * nothing is wrapped.
 */
export function wrap<E extends Element, R, A extends unknown[]>(
  proto: object | undefined,
  method: string,
  name: string,
  ours: (element: E, result: R, args: A) => unknown,
  when: (element: E) => boolean = (element) => inUse(element.ownerDocument),
): boolean {
  const target = proto as Record<string, unknown> | undefined;
  const original = target?.[method];
  if (!target || typeof original !== 'function') return false;
  if (wraps.has(original)) return true;
  const wrapper = function (this: E, ...args: A): unknown {
    const result = original.apply(this, args) as R;
    return (
      guard(name, () => (when(this) ? ours(this, result, args) : undefined), this.ownerDocument) ??
      result
    );
  };
  try {
    target[method] = wrapper;
  } catch (error) {
    // a method Home Assistant made read-only: nothing is wrapped, and the report says why
    stepAside(name, error);
    return false;
  }
  wraps.add(wrapper);
  return true;
}
