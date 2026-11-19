import {
  isActive,
  itemsOf,
  localize,
  type EntityName,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { head, sheetStyles } from '@fluvy/ui';
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import { HeadFit } from '../energy/head.js';
import { roundsGrid, roundsHeight } from '../rounds-family.js';
import { Card, type CardEditor } from '../shared/base.js';
import { toneOf, type LightColours } from '../shared/colour.js';
import type { AliasSpec } from '../shared/config.js';
import { counted, onOfShort } from '../shared/counted.js';
import { withMembers } from '../shared/light.js';
import { roundsRows, type RoundsRowSpec } from '../shared/rounds-row.js';
import {
  answered,
  drawRound,
  pillWidth,
  roundOf,
  wear,
  type Round,
  type RoundSpec,
  type RoundsHost,
} from '../shared/rounds.js';

/** `rounds` (default): the rounds in lines. `row`: a list row each. `labels`: each round says its state under it. */
export type RoundsVariant = 'rounds' | 'row' | 'labels';
export const ROUNDS_VARIANTS: readonly RoundsVariant[] = ['rounds', 'row', 'labels'];
/** Where the rounds stand on their line: from its start (default), in its middle, or from edge to edge. */
export type RoundsAlign = 'start' | 'center' | 'spread';
export const ROUNDS_ALIGNS: readonly RoundsAlign[] = ['start', 'center', 'spread'];

/** One round: an entity, its own name, icon, tone and colour, its actions, and whether it says its state. */
export type RoundItem = Omit<RoundSpec, 'group' | 'entity'> & { entity: string };

export interface RoundsCardConfig extends FluvyCardConfig, LightColours {
  /** The rounds, in their order: entity ids, or items with their own name, icon, colour, actions and say. */
  items?: readonly (string | RoundItem)[];
  /** A head over the rounds; none, the rounds stand alone. */
  title?: string;
  /** "2 of 6 on" under the title (default, where there is one). */
  show_count?: boolean;
  variant?: RoundsVariant;
  /** Each round's name under it (`rounds`, `labels`). */
  show_names?: boolean;
  /** Rounds a line, as many as hold at most; unset, as many as hold, the lines balanced. */
  columns?: number;
  align?: RoundsAlign;
}

/** A round's line: 8 between its cells. */
const GAP = 8;
/** A cell with words under its round is the line's share, at most this: a wide card lines them up as it does rounds. */
const WIDEST = 96;

/**
 * The states that hold their cells (`cell` wide, under their glyphs): every one in the longest of its forms they all
 * hold in; where no form holds them all, each in its longest that holds, else none — that round a round again.
 */
function cellStates(
  host: RoundsHost,
  rounds: readonly Round[],
  cell: number,
): (string | undefined)[] {
  const holds = (text: string): boolean => pillWidth(host, text, true) <= cell;
  const forms = Math.max(0, ...rounds.map((round) => round.said?.length ?? 0));
  for (let form = 0; form < forms; form++) {
    const states = rounds.map(({ said }) => said?.[Math.min(form, said.length - 1)]);
    if (states.every((state) => state === undefined || holds(state))) return states;
  }
  return rounds.map(({ said }) => said?.find(holds));
}

/**
 * Any entities as rounds (#224, after @twodrops's proposal): each its glyph, lit in its tone with a ring of its level
 * while on, the dashed ring out of reach; a tap turns on and off what is safe to flip (a lock locks, and asks before
 * it unlocks) and opens the rest, a hold opens its details. In lines, as rows, or each with its state under it; a head
 * where the card has a title, saying how many are on.
 */
export class FluvyRoundsCard extends Card<RoundsCardConfig> {
  /** The card's height at a 360 column from its config alone (`roundsHeight`). */
  static override layoutHeight(config: RoundsCardConfig): number {
    return roundsHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.rooms,
    css`
      /* the rounds in their lines, each in its cell, placed by the card on whole pixels (\`roundsGrid\`) */
      .rd-rounds {
        position: relative;
      }
      .fv-card__head + .rd-rounds,
      .fv-card__head + .fv-empty-state {
        margin-top: 16px;
      }
      .rd-cell {
        position: absolute;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      /* its name under it: 4 under its round or its pill, 12/500 on its 16 line, to its ellipsis in its cell */
      .rd-name {
        max-width: 100%;
        margin-top: auto;
        overflow: hidden;
        font-size: 12px;
        font-weight: 500;
        line-height: 16px;
        color: var(--fluvy-text-secondary);
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* a row each: 8 under the head as every list, else 8 into the card's padding at each end */
      .rd-rows {
        margin-top: 8px;
      }
      .rd-rows--bare {
        margin: -8px 0;
      }
    `,
  ];

  private readonly head = new HeadFit(this);

  constructor() {
    super();
    // Home Assistant's yes to a round asked about comes back to the card that asked, in the page or not
    this.addEventListener('ll-custom', answered);
  }

  static override editor(): Promise<CardEditor> {
    return import('./rounds-editor.js');
  }
  /** Home Assistant's own name for a card's list: a card pasted from another reads as its items. */
  static override aliases: AliasSpec = { keys: [{ from: 'entities', to: 'items' }] };

  static getStubConfig(hass: unknown, entities: readonly string[]): RoundsCardConfig {
    // the reporter's own: a head that says how many are on, over the first few that switch or say a state
    return {
      type: 'custom:fluvy-rounds-card',
      title: localize(hass as HomeAssistant | undefined, 'rounds.quick_picks'),
      items: entities
        .filter((id) => /^(light|switch|fan|cover|lock|binary_sensor)\./.test(id))
        .slice(0, 4),
    };
  }

  /** Its rounds, in their order: each entry that names an entity. */
  private items(): RoundSpec[] {
    return itemsOf<RoundItem>(this.config?.items).map((item) => ({ ...item, group: 'entity' }));
  }

  private get variant(): RoundsVariant {
    const asked = this.config?.variant;
    return asked && ROUNDS_VARIANTS.includes(asked) ? asked : 'rounds';
  }

  protected override watched(): readonly string[] {
    return withMembers(
      this.items().map((item) => item.entity ?? ''),
      this.hass,
    );
  }

  override getCardSize(): number {
    // its height in Home Assistant's rows of 50
    return Math.max(1, Math.ceil(roundsHeight(this.config ?? { type: '' }) / 50));
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: this.variant === 'row' ? 6 : 3 };
  }

  /** What the rounds reach of the card: its house and look, its names, its states as drawn, its calls and colours. */
  private host(): RoundsHost {
    const config = this.config;
    return {
      hass: this.hass,
      look: config && { ...config, states: this.variant === 'labels' },
      name: (view, own: EntityName | undefined) => this.nameFor(view, own),
      state: (view) => this.stateOf(view),
      expect: (id, state) => this.expect(id, state),
      call: (domain, service, data) => this.call(domain, service, data, ''),
      run: (action, entity) => this.tap(entity, action),
      tapper: (of, at, tap, double) => this.tapper(of, at, tap, double),
      accent: (colour) => this.accents.item(colour),
      ruler: this.head.ruler,
      root: this.renderRoot,
    };
  }

  protected override renderCard(): TemplateResult {
    const items = this.items();
    const w = this.contentWidth;
    const host = this.host();
    const title = this.config?.title;
    const ids = items.map((item) => item.entity ?? '');
    const on = ids.filter((id) => isActive(this.entity(id))).length;
    const count = this.config?.show_count !== false;
    // "2 of 6 on", and where its words would be cut its figures ("2/6 on", "2/6")
    const fitted = title
      ? this.head.fit({
          width: w,
          title,
          sub: count ? counted(this.hass, ids, (id) => this.entity(id)) : '',
          shorter: count && on ? onOfShort(this.hass, on, ids.length) : [],
        })
      : undefined;
    return html`<article class="fv-card rd-card" data-card>
      ${
        title && fitted
          ? head({
              icon: fitted.icon ? (this.config?.icon ?? 'grid') : null,
              small: fitted.small,
              tone: on ? toneOf(this.config) : 'neutral',
              title,
              sub: fitted.sub,
              cut: fitted.cut,
              // a card of many: its head answers only what its config says
              ...this.headActions(undefined),
            })
          : nothing
      }
      ${
        !items.length
          ? this.head.empty('grid', this.t('rounds.empty'), this.t('rounds.empty_hint'), w)
          : this.variant === 'row'
            ? this.renderRows(host, items, w, Boolean(title))
            : this.renderRounds(host, items, w)
      }
    </article>`;
  }

  /**
   * The rounds in their lines (`roundsGrid`): each in its cell — a round's 44, or the line's share (96 at most) where a
   * name or a state stands under it — from the line's start, in its middle, or from edge to edge on one set of columns; a state
   * in its pill under its glyph where it holds its cell, a name under the round to its ellipsis.
   */
  private renderRounds(host: RoundsHost, items: readonly RoundSpec[], w: number): TemplateResult {
    const grid = roundsGrid(this.config ?? { type: '' }, w);
    const rounds = items.map((item) => roundOf(host, item));
    const per = grid.perLine;
    const cell =
      grid.cell > 44 ? Math.min(WIDEST, Math.floor((w - (per - 1) * GAP) / per)) : grid.cell;
    const align = this.config?.align;
    const pitch = align === 'spread' && per > 1 ? (w - cell) / (per - 1) : cell + GAP;
    if (rounds.some((round) => round.said)) wear(host.root);
    const states = cellStates(host, rounds, cell);
    const names = this.config?.show_names === true;
    return html`<div
      class="rd-rounds"
      style="height:${grid.lines * grid.line + (grid.lines - 1) * grid.gap}px"
    >
      ${rounds.map((round, index) => {
        const line = Math.floor(index / per);
        const shown = Math.min(per, rounds.length - line * per);
        const start =
          align === 'center' ? Math.round((w - shown * cell - (shown - 1) * GAP) / 2) : 0;
        return html`<div
          class="rd-cell"
          data-align="center"
          style="left:${Math.round(start + (index % per) * pitch)}px;top:${
            line * (grid.line + grid.gap)
          }px;width:${cell}px;height:${grid.line}px"
        >
          ${drawRound(host, round, states[index], true)}
          ${names ? html`<span class="rd-name" data-name aria-hidden="true">${round.name}</span>` : nothing}
        </div>`;
      })}
    </div>`;
  }

  /**
   * A row each (`row`): its circle lit in its tone while on, the dashed ring out of reach, its name over its state,
   * the whole row its round's tap and hold (`roundsRows`).
   */
  private renderRows(
    host: RoundsHost,
    items: readonly RoundSpec[],
    w: number,
    titled: boolean,
  ): TemplateResult {
    const rows = items.map((item): RoundsRowSpec => {
      const round = roundOf(host, { ...item, show_state: true });
      return {
        icon: round.glyph,
        tone: !round.usable ? 'off' : round.on ? round.tone : 'neutral',
        accent: round.on ? round.accent : undefined,
        title: round.name,
        sub: round.said?.[0],
        rounds: [],
        onTap: round.usable ? round.onTap : undefined,
        onHold: round.onHold,
      };
    });
    return html`<div class="rd-rows ${titled ? '' : 'rd-rows--bare'}">
      ${roundsRows(host, w, rows)}
    </div>`;
  }
}
