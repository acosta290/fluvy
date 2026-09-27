import { THEME_SENTINEL } from '@fluvy/tokens/config';
import { PAGE_ATTRIBUTE } from '../look/attributes.js';
import { patchChartFont, patchChartSeries } from './charts.js';
import { adoptLast, walkShadow } from './dom.js';
import { ORIGINAL_ICONS } from './css/chrome.js';
import { PanelFrames } from './frames.js';
import { refreshLegacyIcons } from './icons.js';
import { patchMarqueeOverflow } from './marquee.js';
import { patchNavigationGlyphs } from './navigation.js';
import { patchSvgIcons, redrawSvgIcons } from './svg-icons.js';
import { configGlyph } from './css/settings.js';
import { SHEETS, type ShellSheet } from './registry.js';

/**
 * The shell: what the theme cannot reach in Home Assistant's own chrome — the frame, the sidebar,
 * the notifications, the settings lists, the fields, menus and controls — brought in line with the
 * design sheet (`design/language.md`, "Shell" and "Form controls").
 *
 * One mechanism. Every sheet of the registry is a constructed stylesheet made once and attached once:
 * to the document, or to a Home Assistant element's Lit class (`elementStyles`, which every instance
 * adopts; the instances alive at that moment get it directly). Nothing is ever detached or rewritten
 * in Home Assistant's templates. The theme switch only fills or empties the sheets — a constructed
 * sheet changes in every root that adopted it — so switching to another theme leaves no trace, and a
 * selector that no longer matches after a Home Assistant update simply does nothing (`report()` says
 * which ones stopped matching). The only observer watches the inline styles of `<html>` and `<body>`,
 * where Home Assistant (and a panel frame such as HACS) writes the theme and with it our sentinel.
 *
 * The same engine runs in the page (`startShell`, once) and in every same-origin panel frame the page
 * shows (`frames.ts`): each document gets its own sheets, made by its own window.
 */

export interface ShellEnv {
  readonly document: Document;
  readonly customElements: CustomElementRegistry;
  readonly createSheet: () => CSSStyleSheet;
  readonly MutationObserver: typeof MutationObserver;
}

export interface SheetReport {
  readonly id: string;
  readonly target: string;
  /** The document adopted it, or the element's class carries it (false: the class is not defined yet, or is no longer a Lit class). */
  readonly attached: boolean;
  /** Instances on the page now that adopted the sheet. */
  readonly instances: number;
  /** Whether the probe selector was found in one of them (`null` without a probe or without instances). */
  readonly probe: boolean | null;
}

export interface ShellReport {
  readonly active: boolean;
  readonly sheets: readonly SheetReport[];
  /** Behaviour the shell wraps (not styles): whether each wrap took (`null` while its element is not defined yet). */
  readonly patches: Readonly<Record<string, boolean | null>>;
  /** The shells of the panel frames on the page now (HACS). */
  readonly frames: readonly ShellReport[];
}

export interface ShellHandle {
  stop(): void;
  report(): ShellReport;
}

type LitClass = CustomElementConstructor & { elementStyles?: unknown[] };

interface Entry {
  readonly spec: ShellSheet;
  readonly sheet: CSSStyleSheet;
  attached: boolean;
}

/** The browser's own, where constructed stylesheets and adopted sheets exist. */
export function browserEnv(): ShellEnv | undefined {
  if (
    typeof document === 'undefined' ||
    typeof CSSStyleSheet === 'undefined' ||
    !('replaceSync' in CSSStyleSheet.prototype) ||
    !('adoptedStyleSheets' in Document.prototype)
  )
    return undefined;
  return { document, customElements, createSheet: () => new CSSStyleSheet(), MutationObserver };
}

/** Adds `sheet` to a Lit element class: every instance created from now on adopts it. False when the class is not a Lit class (Home Assistant changed it): the sheet then does nothing. */
function patchClass(env: ShellEnv, tag: string, sheet: CSSStyleSheet): boolean {
  const klass = env.customElements.get(tag) as LitClass | undefined;
  if (!klass || !Array.isArray(klass.elementStyles)) return false;
  if (!klass.elementStyles.includes(sheet)) klass.elementStyles.push(sheet);
  return true;
}

/**
 * Classes become defined in bursts (at start most already are; a page brings a few more): each burst is
 * patched together and the instances already alive get their sheets in one walk of the page.
 */
function classAttacher(env: ShellEnv): (entry: Entry) => void {
  const pending: Entry[] = [];
  const flush = (): void => {
    const batch = pending.splice(0);
    const byTag = new Map<string, Entry[]>();
    for (const entry of batch) {
      entry.attached = patchClass(env, entry.spec.target, entry.sheet);
      if (!entry.attached) continue;
      const list = byTag.get(entry.spec.target);
      if (list) list.push(entry);
      else byTag.set(entry.spec.target, [entry]);
    }
    if (!byTag.size) return;
    walkShadow(env.document, (element) => {
      const list = element.shadowRoot ? byTag.get(element.localName) : undefined;
      if (list) for (const entry of list) adoptLast(element.shadowRoot as ShadowRoot, entry.sheet);
    });
  };
  return (entry) => {
    void env.customElements.whenDefined(entry.spec.target).then(() => {
      if (pending.push(entry) === 1) queueMicrotask(flush);
    });
  };
}

/**
 * The theme is on when our sentinel is among the inline variables of `<html>` (Home Assistant applied the
 * fluvy theme) or `<body>` (a panel frame), or when the look covers the whole app (`<html fluvy-look>`).
 */
export const themed = (doc: Document): boolean =>
  doc.documentElement.hasAttribute(PAGE_ATTRIBUTE) ||
  [doc.documentElement, doc.body].some(
    (element) => (element?.style.getPropertyValue(THEME_SENTINEL).trim() ?? '') !== '',
  );

/**
 * A shell for one document: its sheets, attached once, filled while the theme is on. `frames` also gives
 * every same-origin panel frame the document shows a shell of its own (the page's shell does; a frame's
 * does not look for frames inside itself).
 */
export function createShell(env: ShellEnv, options: { frames?: boolean } = {}): ShellHandle {
  const entries: Entry[] = SHEETS.map((spec) => ({
    spec,
    sheet: env.createSheet(),
    attached: false,
  }));

  let active: boolean | null = null;
  let icons: boolean | null = null;
  const sync = (): void => {
    const on = themed(env.document);
    const ours = !env.document.documentElement.hasAttribute(ORIGINAL_ICONS);
    if (on === active && ours === icons) return;
    const drawn = active === true && icons === true;
    const first = active === null;
    active = on;
    icons = ours;
    for (const { spec, sheet } of entries)
      sheet.replaceSync(on && (spec.choice !== 'icons' || ours) ? spec.css : '');
    // Home Assistant's Material icons drawn as ours (or back) on what is already on the page
    if (!first && drawn !== (on && ours)) redrawSvgIcons(env.document, on && ours);
  };
  sync();

  const attach = classAttacher(env);
  for (const entry of entries) {
    if (entry.spec.target !== 'document') {
      attach(entry);
      continue;
    }
    adoptLast(env.document, entry.sheet);
    entry.attached = true;
  }
  refreshLegacyIcons(env.document);
  const patches: Record<string, boolean | null> = {
    chartFont: null,
    chartSeries: null,
    marqueeOverflow: null,
    navigationGlyphs: null,
    svgIcons: null,
  };
  void patchChartFont(env.customElements).then((done) => {
    patches['chartFont'] = done;
  });
  void patchChartSeries(env.customElements).then((done) => {
    patches['chartSeries'] = done;
  });
  void patchMarqueeOverflow(env.customElements).then((done) => {
    patches['marqueeOverflow'] = done;
  });
  void patchNavigationGlyphs(env.customElements, env.document, configGlyph).then((done) => {
    patches['navigationGlyphs'] = done;
  });
  void patchSvgIcons(env.customElements, () => active === true && icons === true).then((done) => {
    patches['svgIcons'] = done;
    // the icons drawn before the patch (the page's first render) take ours too
    if (done && active && icons) redrawSvgIcons(env.document, true);
  });
  const frames = options.frames
    ? new PanelFrames(env, (frameEnv) => {
        const shell = createShell(frameEnv);
        for (const listener of frameListeners) listener(frameEnv);
        return shell;
      })
    : undefined;
  if (frames) {
    patches['panelFrames'] = null;
    void frames.watch().then((done) => {
      patches['panelFrames'] = done;
    });
  }

  // `<html>` and `<body>` only: the page's light tree is a handful of elements (everything else lives in shadow roots)
  const observer = new env.MutationObserver(sync);
  observer.observe(env.document.documentElement, {
    attributes: true,
    attributeFilter: ['style', PAGE_ATTRIBUTE, ORIGINAL_ICONS],
    subtree: true,
  });

  return {
    stop: () => {
      observer.disconnect();
      frames?.stop();
      for (const { sheet } of entries) sheet.replaceSync('');
    },
    report: () => {
      const found = new Map<string, Element[]>();
      walkShadow(env.document, (element) => {
        const list = found.get(element.localName);
        if (list) list.push(element);
        else found.set(element.localName, [element]);
      });
      const sheets = entries.map(({ spec, sheet, attached }): SheetReport => {
        if (spec.target === 'document')
          return {
            id: spec.id,
            target: spec.target,
            attached,
            instances: attached ? 1 : 0,
            probe: null,
          };
        const roots = (found.get(spec.target) ?? [])
          .map((element) => element.shadowRoot)
          .filter((root): root is ShadowRoot => root?.adoptedStyleSheets.includes(sheet) ?? false);
        const probe =
          spec.probe && roots.length
            ? roots.some((root) => root.querySelector(spec.probe as string) !== null) ||
              // one of our pages stands in the panel's place: Home Assistant draws nothing here to style
              (spec.instead
                ? roots.some((root) => root.querySelector(spec.instead!) !== null)
                : false)
            : null;
        return { id: spec.id, target: spec.target, attached, instances: roots.length, probe };
      });
      return {
        active: active === true,
        sheets,
        patches: { ...patches },
        frames: frames?.current().map((shell) => shell.report()) ?? [],
      };
    },
  };
}

const frameListeners = new Set<(env: ShellEnv) => void>();

/** Tells `listener` about every same-origin panel frame the page's shell starts in from now on (HACS). */
export function onPanelFrame(listener: (env: ShellEnv) => void): () => void {
  frameListeners.add(listener);
  return () => frameListeners.delete(listener);
}

/**
 * Adds a sheet to a Home Assistant element's Lit class once it is defined: every instance created from
 * then on adopts it, and the ones on the page get it now. False if the element is not a Lit class.
 */
export async function attachToElementClass(
  tag: string,
  sheet: CSSStyleSheet,
  env: ShellEnv | undefined = browserEnv(),
): Promise<boolean> {
  if (!env) return false;
  await env.customElements.whenDefined(tag);
  if (!patchClass(env, tag, sheet)) return false;
  walkShadow(env.document, (element) => {
    if (element.localName === tag && element.shadowRoot) adoptLast(element.shadowRoot, sheet);
  });
  return true;
}

let handle: ShellHandle | undefined;

/** Starts the page's shell once; a second call returns the running one. Undefined where the browser lacks constructed stylesheets. */
export function startShell(env: ShellEnv | undefined = browserEnv()): ShellHandle | undefined {
  if (handle) return handle;
  if (!env) return undefined;
  const shell = createShell(env, { frames: true });
  handle = {
    stop: () => {
      shell.stop();
      handle = undefined;
    },
    report: shell.report,
  };
  return handle;
}
