import { html, nothing, type TemplateResult } from 'lit';
import { switchStylesCss } from '../styles/switch-styles.js';
import type { Tone } from '../tones.js';

/*
 * The styles a tile's switch is drawn in besides the toggle (1.20, #177): the wall rocker — a plate standing on end
 * in the switch's place, its raised half the one a finger presses next, a bar that lights with what it switches. A
 * module of its own, fetched by the first tile asked for one (`cards/tile/rocker.ts`), so a house of toggles never
 * pays for it.
 */

/** The sheet every card that draws a rocker adopts beside its own. */
export const switchStylesSheet = new CSSStyleSheet();
switchStylesSheet.replaceSync(switchStylesCss);

/** The root that draws a rocker wears the sheet after its own, once. */
export function wearSwitchStyles(root: Node): void {
  if (root instanceof ShadowRoot && !root.adoptedStyleSheets.includes(switchStylesSheet))
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, switchStylesSheet];
}

/** What a rocker is drawn from: the state of what it switches, and what a tap on it does. */
export interface RockerDrawing {
  /** What it switches is on: the bar is lit, and a reader hears it checked. */
  readonly on: boolean;
  /** Its lower half is the raised one: a switch's while on; a cover's says where its next tap takes it. */
  readonly down: boolean;
  /** What it switches is on its way (a cover opening or closing): the bar breathes. */
  readonly moving?: boolean;
  readonly tone: Tone;
  /** What a reader hears it named. */
  readonly label: string;
  /** It cannot be moved here: out of reach, drawn disabled as a switch is. */
  readonly disabled: boolean;
  readonly onTap: () => void;
}

/**
 * The rocker: a 32 × 44 plate in a 44 × 44 target (the tile's box for it, fluvy/tiles.css), a switch to a reader and
 * to the keys (Space and Enter). Its halves flip in 120 ms, at once without motion (switch-styles.css).
 */
export function drawRocker(o: RockerDrawing): TemplateResult {
  const tap = (event: Event): void => {
    event.stopPropagation();
    if (!o.disabled) o.onTap();
  };
  const key = (event: KeyboardEvent): void => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      tap(event);
    }
  };
  return html`<span
    class="fv-hit fv-hit--rocker ${o.disabled ? 'is-fixed' : ''}"
    data-target
    @click=${tap}
    ><span
      data-control
      class="fv-rocker fv-tone--${o.tone}${o.on ? ' is-on' : ''}${o.down ? ' is-down' : ''}${o.moving ? ' is-moving' : ''}"
      role="switch"
      tabindex=${o.disabled ? -1 : 0}
      aria-checked=${o.on ? 'true' : 'false'}
      aria-disabled=${o.disabled ? 'true' : 'false'}
      aria-label=${o.label || nothing}
      @keydown=${key}
      ><span class="fv-rocker__bar"></span></span
  ></span>`;
}
