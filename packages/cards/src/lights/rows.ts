import { formatNumber, plural, stateText, type HomeAssistant } from '@fluvy/core';
import { listRow, type Tone } from '@fluvy/ui';
import { html, type TemplateResult } from 'lit';
import { SWITCH_SLOT, type HeadFit } from '../energy/head.js';
import { onBadge } from '../shared/counted.js';
import { levelOf, type Lamp, type LightsCardConfig } from './lights-card.js';

/*
 * What 1.26 gave the Room lights card (#261), in a chunk of its own: its lights as a list's rows, and what ends its
 * head where the card says (`control`). Fetched by the first card asked for either, which draws its first frame once
 * it is here; a card of rounds, chips or tiles that says nothing never pays for it, and draws as it always did.
 */

/** A row's circle and the 12 after it: what its words give up beside it. */
const CIRCLE = 56;

/** What the card hands over: its house and its config, its lights as it reads them, its head's ruler and its taps. */
export interface LightsMore {
  readonly hass: HomeAssistant | undefined;
  readonly config: LightsCardConfig | undefined;
  readonly lamps: readonly Lamp[];
  /** The tone the room is lit in: the card's own, else the palette's light. */
  readonly tone: Tone;
  readonly head: HeadFit;
  /** The card's content width. */
  readonly width: number;
  readonly tap: (lamp: Lamp) => void;
  readonly hold: (lamp: Lamp) => void;
}

/** What the card draws of it. */
export interface LightsDrawn {
  /**
   * The badge that ends the head, how many are on in the light's tone ("2 on"; "On" where the card counts none), "Off"
   * neutral: where asked, and by itself over the rows; none out of reach, where the head's line says so.
   */
  readonly badge: { readonly text: string; readonly tone: Tone } | null;
  /** The head's line beside a badge, which does not count again: the room's lights and their level ("3 lights · 63 %"). */
  readonly sub: string;
  /** The room the head keeps for its switch: none beside a badge, nor where the card asks for nothing there. */
  readonly end: number;
  /** The lights as rows, where the card is in rows. */
  readonly rows: TemplateResult | undefined;
}

/**
 * A light's line: its state as it is drawn (the one a tap expects until Home Assistant agrees), and its level after it
 * while it is on and dims (`show_level`); out of reach, what Home Assistant says of it.
 */
const lineOf = ({ hass, config }: LightsMore, lamp: Lamp): string => {
  if (!lamp.usable) return stateText(hass, lamp.view);
  const state = stateText(hass, lamp.view, lamp.on ? 'on' : 'off');
  return config?.show_level !== false && lamp.level !== null
    ? `${state} · ${formatNumber(hass, lamp.level, { digits: 0 })} %`
    : state;
};

/**
 * The rows, 8 under what is over them, a hairline between two: each light as the Entities card draws a row — its
 * glyph in a circle that wears its lamp's colour while it is on, its name over its line — with nothing at its end: a
 * tap on the row is its light's switch, a hold its details. Every circle gives its room to the names together where
 * one of them would end before it had begun beside it, or a state would not hold (the lists' rule, with nothing at the
 * row's end); a level gives way before its state is cut, and is read whole.
 */
function rowsOf(o: LightsMore): TemplateResult {
  const { head, width, lamps } = o;
  const lines = lamps.map((lamp) => lineOf(o, lamp));
  const keep = lamps.every(
    (lamp, i) =>
      width - CIRCLE >=
      Math.max(
        head.rowNameRoom(lamp.name),
        head.ruler.width('fv-row__sub', (lines[i] ?? '').split(' · ')[0] ?? ''),
      ),
  );
  const room = width - (keep ? CIRCLE : 0);
  return html`<div class="fv-rows" style="margin-top:8px">
    ${lamps.map((lamp, i) => {
      const line = lines[i] ?? '';
      const sub = head.fitRowSub(line, room);
      return listRow({
        icon: keep ? lamp.glyph : null,
        tone: !lamp.usable ? 'off' : lamp.on ? lamp.tone : 'neutral',
        title: lamp.name,
        name: true,
        sub,
        trailing: 'none',
        accent: lamp.on ? lamp.accent : undefined,
        unavailable: !lamp.usable,
        ...(sub === line ? {} : { label: `${lamp.name} · ${line}` }),
        // out of reach it takes no tap, as a round does not: a hold still opens it
        onTap: lamp.usable ? () => o.tap(lamp) : undefined,
        onHold: () => o.hold(lamp),
      });
    })}
  </div>`;
}

/**
 * What ends the head of the chips, the tiles and the rows (`control`), and the rows themselves: the room's switch as
 * ever, unless the card asks for a badge or for nothing; over the rows, the badge by itself.
 */
export function drawn(o: LightsMore): LightsDrawn {
  const { hass, config, lamps } = o;
  const rowed = config?.variant === 'rows';
  const asked = config?.control;
  const badged = asked === 'badge' || (rowed && asked !== 'switch' && asked !== 'none');
  const level = config?.show_level !== false ? levelOf(lamps) : null;
  return {
    badge:
      badged && lamps.some((lamp) => lamp.usable)
        ? onBadge(
            hass,
            lamps.filter((lamp) => lamp.on).length,
            o.tone,
            config?.show_count !== false,
          )
        : null,
    sub: [
      plural(hass, 'lights.count', lamps.length),
      level !== null ? `${formatNumber(hass, level, { digits: 0 })} %` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    end: badged || asked === 'none' ? 0 : SWITCH_SLOT,
    rows: rowed ? rowsOf(o) : undefined,
  };
}
