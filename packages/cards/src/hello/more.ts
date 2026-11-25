import { TOGGLE_DOMAINS, type HomeAssistant } from '@fluvy/core';
import { activateKey, clickPress, preventMenu, sheetStyles, startPress } from '@fluvy/ui';
import { css, html, nothing, type LitElement, type TemplateResult } from 'lit';
import { HeadFit } from '../energy/head.js';
import type { ControlHost, Press } from '../shared/base.js';
import {
  answered,
  roundsAcross,
  roundsOf,
  type GaugeCard,
  type RoundsHost,
} from '../shared/rounds.js';
import type { HelloCardConfig } from './hello-card.js';

/*
 * What the greeting draws beyond its words (#260), in a chunk of its own, fetched by the first greeting whose config
 * asks for any of it: its date and its weather as buttons of their own, and a line of quick actions under it. A
 * greeting that asks for none of it never pays for it, and draws as it always did.
 */

/**
 * The parts' and the rounds' sheet. The greeting has no surface: what it holds stands on the page itself, so a round at
 * rest is a disc of the card's fill inside the surfaces' edge, as the tabs under the greeting are: it reads on the
 * page's grey in either mode and over a background's picture, where the page's own fill would be lost.
 */
const SHEET = css`
  /* a part that answers stays its line of words, raised over the greeting's own button: the keyboard's ring closes
     round the words alone (clear of the greeting over them), and a finger has the 44 target laid over them (.hm-hit:
     12 over and under the line, at least 44 wide from the edge the part stands on). Its words are fitted whole, never
     cut: nothing of its target is clipped */
  .hm-hello__meta > [role='button'] {
    position: relative;
    z-index: 1;
    overflow: visible;
    border-radius: 8px;
    cursor: pointer;
    -webkit-user-select: none;
    user-select: none;
  }
  .hm-hello__meta > [role='button']:active {
    opacity: 0.7;
  }
  .hm-hit {
    position: absolute;
    top: -12px;
    bottom: -12px;
    left: 0;
    width: 100%;
    min-width: 44px;
  }
  .hm-hello__weather > .hm-hit {
    right: 0;
    left: auto;
  }
  /* the quick actions: one line of rounds across the column (\`roundsAcross\`), in the room the card keeps for it */
  .hm-quick {
    display: flex;
  }
  .hm-quick > .lt-bulbs {
    animation: fv-enter 420ms var(--fv-ease-out) both;
  }
  /* a round is a small surface on the page: in the look's own inks, whatever ink the page's background asks of the
     greeting's words, and inside an edge — lit, its tone's fill and the hairline a lit tile closes with; at rest, the
     card's fill and the surfaces' edge; out of reach it stays the dashed ring on the page, as a tab out of reach does */
  .hm-quick .lt-bulb {
    --fluvy-text: var(--fv-page-text);
    --fluvy-text-secondary: var(--fv-page-text-secondary);
  }
  .hm-quick .lt-bulb.is-on {
    box-shadow: inset 0 0 0 1px var(--fluvy-edge, var(--tone-border));
  }
  .hm-quick .lt-bulb:not(.is-on, .fv-ico--off) {
    background: var(--fluvy-card);
    box-shadow: inset 0 0 0 1px var(--fluvy-edge, var(--fluvy-border));
  }
`;

/** The rounds' sheet (the rooms') and this one on a greeting's root, after its own, once. */
function wear(root: ShadowRoot): void {
  const sheets = [sheetStyles.rooms.styleSheet, SHEET.styleSheet].filter(
    (sheet): sheet is CSSStyleSheet => Boolean(sheet) && !root.adoptedStyleSheets.includes(sheet!),
  );
  if (sheets.length) root.adoptedStyleSheets = [...root.adoptedStyleSheets, ...sheets];
}

/**
 * A part of the greeting's line (its date, its weather) in its class: a button of its own where it answers a tap or a
 * hold (`weather_tap_action`, `date_hold_action` …), which reads what the part says; else the words alone, as ever.
 */
export function part(
  root: ShadowRoot,
  cls: string,
  { onTap, onHold }: Press,
  body: unknown,
): TemplateResult {
  if (!onTap && !onHold) return html`<span class=${cls}>${body}</span>`;
  wear(root);
  return html`<span
    class=${cls}
    role="button"
    tabindex="0"
    .fvTap=${onTap}
    .fvHold=${onHold}
    @pointerdown=${startPress}
    @click=${clickPress}
    @contextmenu=${onHold ? preventMenu : nothing}
    @keydown=${activateKey(onTap, onHold)}
    >${body}<span class="hm-hit" data-target></span
  ></span>`;
}

/**
 * What the rounds reach of the greeting, which is core's and keeps it short: its states as drawn and its calls (a
 * card's `ControlHost`), its colours, its actions and its taps; the rest of what rounds ask of a card is found here.
 */
export interface QuickReach extends ControlHost, Pick<RoundsHost, 'run' | 'tapper'> {
  readonly accents: { item(colour: unknown): string | undefined };
}

/** A greeting's ruler, measured again when a font lands: made with its first line of rounds. */
const rulers = new WeakMap<LitElement, HeadFit>();

/**
 * The quick actions under the greeting (`quick_actions`, a line of their own as a car's: `roundsAcross`): across the
 * column, as many as it holds, each round in the middle of its share of the line; where their states are asked for
 * (`show_quick_states`: under their glyphs, or beside them) each a key as wide as its share, the first and the last
 * flush with the column's edges, never a group at one end (the owner's review of 1.26). Each is lit in its tone while
 * on, its tap and its hold its own; a tap turns on and off what a person lists on purpose, a lock asking first, as a
 * room's quick actions do.
 */
export function quickRow(
  card: LitElement & GaugeCard & { hass?: HomeAssistant | undefined },
  config: HelloCardConfig | undefined,
  width: number,
  reach: QuickReach,
): TemplateResult | typeof nothing {
  const root = card.renderRoot as ShadowRoot;
  wear(root);
  let fit = rulers.get(card);
  if (!fit) {
    fit = new HeadFit(card);
    rulers.set(card, fit);
    // a round that asks first hears Home Assistant's yes on its card
    card.addEventListener('ll-custom', answered);
  }
  const { hass } = card;
  return roundsAcross(
    {
      ...reach,
      hass,
      call: (domain, service, data) => reach.call(domain, service, data, ''),
      accent: (colour) => reach.accents.item(colour),
      // the card's own colour is its avatar's: the rounds keep their kinds' tones and the house's lights' colours
      look: {
        states: config?.show_quick_states,
        beside: config?.quick_state_position === 'beside',
      },
      toggles: TOGGLE_DOMAINS,
      ruler: fit.ruler,
      root,
      // a round's gauge reads its range and its thresholds through the card (#257)
      card,
    },
    roundsOf({ hass }, config?.quick_actions ?? []),
    width,
  );
}
