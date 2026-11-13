/**
 * Putting one of our pages in place of Home Assistant's: the panel's own `render` hands its `hass` and `narrow` to our
 * view, and gives its page back whenever the look leaves (another theme) or the house keeps Home Assistant's. The
 * panel's state, routes and subscriptions are untouched; nothing it renders is subscribed while ours shows. A block of
 * one of its pages is taken the same way (the details dialog's history: the element's `hass` and `entityId`).
 */
import { guard, PAGE_ATTRIBUTE, stepAside, themed, type HomeAssistant } from '@fluvy/core';
import { html, nothing, type TemplateResult } from 'lit';

export interface HaPanel extends HTMLElement {
  hass?: HomeAssistant;
  narrow?: boolean;
  requestUpdate?: () => void;
}

interface PanelPrototype {
  render?: (this: HaPanel) => unknown;
  /** The pages already wrapped, by our tag: a second start must not wrap a wrap. */
  __fluvyPages?: Record<string, true>;
}

/** Home Assistant's element class, as Lit keeps what it declares. */
type Declared = CustomElementConstructor & {
  readonly elementProperties?: ReadonlyMap<PropertyKey, unknown>;
};

export interface Takeover<E extends HaPanel = HaPanel> {
  /** Home Assistant's panel element ("ha-panel-logbook"), or the block's ("ha-more-info-history"). */
  readonly tag: string;
  /** Ours ("fluvy-activity"): what tells one wrap from another. */
  readonly ours: string;
  /** The attribute set on `<html>` while the house keeps Home Assistant's page. */
  readonly kept: string;
  /** The view's own file, fetched the first time the page renders it (no other page pays for it). */
  readonly load: () => Promise<unknown>;
  /** Our view, with the element's properties on it; nothing where ours does not draw this one (Home Assistant's does). */
  readonly view: (panel: E) => TemplateResult | undefined;
  /**
   * The properties our view reads, as the element's class declares them: one gone (Home Assistant reshaped it), its
   * own stays and the shell's report says why.
   */
  readonly reads?: readonly string[];
}

/** Ours while the page wears Fluvy and the house has not kept Home Assistant's. */
export const pageIsOurs = (kept: string, doc: Document = document): boolean =>
  themed(doc) && !doc.documentElement.hasAttribute(kept);

/**
 * Wraps one of Home Assistant's panels with ours. If Home Assistant reshapes the panel (no `render`, or a property our
 * view reads no longer declared), its page simply stays; if ours throws, the wrap steps aside and the shell's report
 * says so (by our tag). Resolves whether the wrap took.
 */
export async function takeOverPage<E extends HaPanel>(
  page: Takeover<E>,
  registry: CustomElementRegistry = customElements,
  doc: Document = document,
): Promise<boolean> {
  const panels = new Set<HaPanel>();
  let ours = pageIsOurs(page.kept, doc);
  // the theme, the look's reach or the house's choice changed: the pages on screen swap at once
  new MutationObserver(() => {
    const now = pageIsOurs(page.kept, doc);
    if (now === ours) return;
    ours = now;
    for (const panel of panels)
      if (panel.isConnected) panel.requestUpdate?.();
      else panels.delete(panel);
  }).observe(doc.documentElement, {
    attributes: true,
    attributeFilter: ['style', PAGE_ATTRIBUTE, page.kept],
  });
  await registry.whenDefined(page.tag);
  const element = registry.get(page.tag) as Declared | undefined;
  const proto = element?.prototype as PanelPrototype | undefined;
  const original = proto?.render;
  if (!proto || typeof original !== 'function') return false;
  const gone = page.reads?.filter((name) => !element?.elementProperties?.has(name)) ?? [];
  if (gone.length) {
    stepAside(page.ours, `${page.tag} has no ${gone.join(', ')}`, doc);
    return false;
  }
  const wrapped = (proto.__fluvyPages ??= {});
  if (!wrapped[page.ours]) {
    proto.render = function (this: HaPanel): unknown {
      panels.add(this);
      // ours caught: if it throws, Home Assistant's page draws, for the rest of the session
      return (
        (ours &&
          guard(page.ours, () => {
            const view = page.view(this as E);
            // a view whose file cannot come (offline, a server that lost it) gives Home Assistant's page back
            if (view)
              page.load().catch((error: unknown) => {
                stepAside(page.ours, error);
                this.requestUpdate?.();
              });
            return view;
          })) ||
        original.call(this)
      );
    };
    wrapped[page.ours] = true;
  }
  return true;
}

/**
 * While the view's file is on its way (a slow link, a small server), the page is not blank: our bar holds its place,
 * with Home Assistant's menu on a phone and the page's name. The view hides it once it is defined (it has no slot).
 */
export const waitingBar = (panel: HaPanel, title: string): TemplateResult =>
  html`<div
    style="display:flex;align-items:center;gap:4px;box-sizing:border-box;height:calc(var(--header-height, 56px) + var(--safe-area-inset-top, 0px));padding:var(--safe-area-inset-top, 0px) 12px 0 ${panel.narrow ? 4 : 24}px;background:var(--app-header-background-color, var(--fluvy-card));color:var(--app-header-text-color, var(--fluvy-text));box-shadow:inset 0 -1px 0 var(--fluvy-border)"
  >
    ${panel.narrow ? html`<ha-menu-button .hass=${panel.hass} .narrow=${true}></ha-menu-button>` : nothing}
    <span style="margin-left:4px;font:600 20px/24px var(--fluvy-font-sans, inherit)">${title}</span>
  </div>`;
