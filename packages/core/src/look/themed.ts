import { MODE_TOKEN, themeMode } from '@fluvy/tokens/config';
import { declarationsCss, type CssDeclaration, type PaletteMode } from '@fluvy/tokens/runtime';
import { adoptLast, walkShadow } from '../shell/dom.js';
import { guard } from '../shell/patches.js';
import { THEMED_ATTRIBUTE } from './attributes.js';

/*
 * Home Assistant applies a theme to elements of its own as it applies one to the page (`applyThemesOnElement`): a
 * view's (`hui-view-container`), a section's, a card's `theme:`, every variable of the theme file written inline on the
 * element, where it wins over what the element inherits. The theme named Fluvy is the default look (its file carries
 * Linen's colours), so under such an element the palette the person chose lost to Linen's (#72). Home Assistant keeps a
 * record on each element it themes (`__themes`: the theme's key, `Fluvy` or `Fluvy__dark`, and the variables it wrote),
 * set just before it writes them: the record is watched through an accessor on the elements' prototype, and an element
 * in a theme of fluvy's is marked, its root given the look's sheet, whose declarations win over the inline ones
 * (`!important`): the person's palette, in the mode of the page around it, or in the mode Fluvy Light and Fluvy Dark
 * hold to (the mark says which: `fluvy-themed="dark"`; Home Assistant writes such a theme in the page's mode, where the
 * other has nothing), kept in step by the look engine (one sheet for every such element). An element in another theme
 * is the person's choice and stays as Home Assistant themed it; the page itself (`<html>`) is the look's own
 * (`engine.ts`).
 */

/** Home Assistant's record on an element it themed (frontend 2026.9–2026.10): the theme's key, `__dark` in dark mode. */
interface ThemeRecord {
  readonly cacheKey?: string;
}

type Recorded = HTMLElement & { __themes?: ThemeRecord };

/**
 * The theme of fluvy's Home Assistant themed an element with, in either mode, by the mode it holds to (`themeMode`:
 * `light`, `dark`, `''` for Fluvy); undefined for another theme, or none.
 */
export const themedMode = (record: ThemeRecord | undefined): PaletteMode | '' | undefined =>
  themeMode(record?.cacheKey?.replace(/__dark$/, ''));

/** One mode of the look, as declarations. */
type ModeLook = readonly [mode: PaletteMode, declarations: readonly CssDeclaration[]];

/**
 * The look on the elements marked `mark` (a bare mark, or `="dark"`), from their own shadow root or from their tree,
 * with the mode it is in for the cards under them (`MODE_TOKEN`).
 */
const markedRule = (mark: string, [mode, declarations]: ModeLook): string =>
  `:host([${THEMED_ATTRIBUTE}${mark}]),[${THEMED_ATTRIBUTE}${mark}]{${declarationsCss([...declarations, [MODE_TOKEN, mode]], true)}}`;

/**
 * The look on a marked element, over the variables Home Assistant wrote inline on it: in the page's mode, and with
 * `held` in the other mode on an element whose theme holds to that one (Fluvy Dark in a light page).
 */
export const themedRule = (page: ModeLook, held?: ModeLook): string =>
  markedRule('', page) + (held ? markedRule(`="${held[0]}"`, held) : '');

interface Watch {
  /** The look's sheet for the marked elements. */
  readonly sheet: () => CSSStyleSheet;
  /** Marks moved: the cards look again for their theme. */
  readonly changed: () => void;
}

let watch: Watch | undefined;
/** The records, as Home Assistant reads them back (its next theme empties the variables the last one wrote). */
const records = new WeakMap<object, ThemeRecord | undefined>();
/** The prototypes that carry the accessor: a second watch reuses it. */
const watched = new WeakSet<object>();
/** Whether the cards already look again at the end of this beat. */
let queued = false;

/** A shadow root or a document: what can adopt a sheet (an element out of the page has neither above it). */
const adopts = (node: Node): node is Node & DocumentOrShadowRoot => 'adoptedStyleSheets' in node;

/**
 * Marks an element by the theme Home Assistant is about to write on it (with the mode a theme holds to), and gives its
 * root the look's sheet.
 */
function mark(element: HTMLElement, record: ThemeRecord | undefined): void {
  if (!watch) return;
  const mode = element === element.ownerDocument.documentElement ? undefined : themedMode(record);
  if (mode !== undefined) {
    // its own shadow root goes wherever it goes; a section draws in its parent's (Home Assistant themes it on each connect)
    const root = element.shadowRoot ?? element.getRootNode();
    if (adopts(root)) adoptLast(root, watch.sheet());
  }
  if (element.getAttribute(THEMED_ATTRIBUTE) === (mode ?? null)) return;
  if (mode === undefined) element.removeAttribute(THEMED_ATTRIBUTE);
  else element.setAttribute(THEMED_ATTRIBUTE, mode);
  // a view's sections and cards are themed in one go: their cards look again once, after Home Assistant wrote them all
  if (queued) return;
  queued = true;
  queueMicrotask(() => {
    queued = false;
    watch?.changed();
  });
}

/**
 * Watches Home Assistant's theme records on the page's elements: each one it sets from now on, through an accessor on
 * the elements' prototype that keeps the record as Home Assistant left it, and each one it set before the bundle
 * arrived (moved under the accessor, so marked now). `sheet` is the look's sheet for the marked elements; `changed` runs
 * once a beat when marks moved. Nothing is watched where another script owns the record's name. Returns the stop.
 */
export function watchThemes(
  doc: Document,
  sheet: () => CSSStyleSheet,
  changed: () => void,
): () => void {
  const proto = doc.defaultView?.HTMLElement.prototype;
  if (!proto) return () => undefined;
  if (!watched.has(proto)) {
    if (Object.getOwnPropertyDescriptor(proto, '__themes')) return () => undefined;
    Object.defineProperty(proto, '__themes', {
      configurable: true,
      get(this: object): ThemeRecord | undefined {
        return records.get(this);
      },
      set(this: HTMLElement, record: ThemeRecord | undefined) {
        records.set(this, record);
        guard('themedElements', () => mark(this, record));
      },
    });
    watched.add(proto);
  }
  watch = { sheet, changed };
  walkShadow(doc, (element) => {
    const recorded = element as Recorded;
    const record = recorded.__themes;
    if (record === undefined) return;
    // a record of its own (set before the accessor) is set again through it
    delete recorded.__themes;
    recorded.__themes = record;
  });
  return () => {
    watch = undefined;
  };
}
