import { coverClassLabel } from './class-label.js';
import {
  formatNumber,
  isUsable,
  sliderStill,
  sliderStyleOf,
  strings,
  type EntityView,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  actions,
  clamp,
  head,
  label,
  readout,
  rulerLabels,
  sheetStyles,
  stepper,
  textWidth,
  type ActionItem,
  type ChipItem,
  type RulerChangeDetail,
  type RulerWindowDetail,
  type Tone,
} from '@fluvy/ui';
import { acrossStyles } from '@fluvy/ui/styles/across';
import { coverStyles } from '@fluvy/ui/styles/cover';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import {
  acrossFit,
  acrossRow,
  endsHold,
  figureWidth,
  labelWidth,
  levelReadout,
  saidReadout,
  saidWidth,
} from '../shared/across.js';
import type { Labels } from '../shared/axis.js';
import { Card, type CardEditor } from '../shared/base.js';

import { iconOf } from '../shared/domain.js';
import {
  actionGap,
  actionsThatFit,
  Burst,
  headSub,
  Hold,
  motionStyles,
  releasePresses,
  shownStateText,
  StableTemplate,
} from './common.js';
import { ITEM_ALIASES, type AliasSpec, type RowStyle } from '../shared/config.js';
import { chipRow } from '../shared/chips.js';
import { HeadFit } from '../energy/head.js';
import {
  CLOSE,
  CLOSE_TILT,
  coverHeight,
  OPEN,
  OPEN_TILT,
  presetsOf,
  SET_POSITION,
  SET_TILT_POSITION,
  STOP,
  usualFor,
} from '../cover-family.js';
import { muted } from '../shared/head-lines.js';
import { drawnAs, listedRows } from '../shared/heights.js';
import { stateLook, tintOf, type StateTintConfig } from '../shared/state-tint.js';
import {
  fitValueRow,
  STEPPER,
  STEPPER_HALVES,
  valueRowClass,
  type Reading,
  type RowLayout,
} from '../shared/value-row.js';
import {
  endsOf,
  favoriteChips,
  favoritesFor,
  mirror,
  motionOf,
  near,
  percentAttr,
  percentText,
  tiltAngleOf,
  type Ends,
  type Percent,
} from './reads.js';
import { openness, slats } from './slats.js';
import type { RowsCardConfig } from '../lock/rows.js';

const coverStrings = strings('cover');
const cardStrings = strings('cover-card');

/** One saved place for a cover: "Morning · 60 %". `position` and `tilt` are percentages, 100 = open. */
export interface CoverFavorite {
  name?: string;
  position?: number;
  tilt?: number;
}

/**
 * `full` (default): the position ruler, tilt, the actions and the favourites. `compact`: the head and the actions.
 * `horizontal` (#244): the full card with its position on one row, its readout beside a ruler across the card.
 */
export type CoverVariant = 'full' | 'compact' | 'horizontal';

/** How the tilt is set: its readout and a stepper (`steps`, the default), or its slats and a ruler (`slats`, #203). */
export type TiltStyle = 'steps' | 'slats';

export interface CoverCardConfig extends RowsCardConfig, StateTintConfig {
  subtitle?: string;
  variant?: CoverVariant;
  favorites?: readonly CoverFavorite[];
  /** Favourites as chips filling the row (default) or content-sized. */
  favorites_style?: RowStyle;
  show_tilt?: boolean;
  show_favorites?: boolean;
  /** The slats' angle at 100 % tilt. When set, tilt reads and steps in degrees (15°) instead of percent. */
  tilt_angle?: number;
  tilt_style?: TiltStyle;
  /**
   * Where the position and the tilt go in a tap (#203): the card's own figures, as chips under their control, the ends
   * said in words. The editor writes them as words ("50").
   */
  position_presets?: readonly (number | string)[];
  tilt_presets?: readonly (number | string)[];
  /**
   * The cover reports 100 % where it is closed (#203): the card turns its figure, its knob, its presets and what it
   * sends round; the state's word and the commands stay Home Assistant's, and both commands stay live.
   */
  invert_position?: boolean;
  /** The same for the tilt: its figure, its slats, its presets and what it sends. */
  invert_tilt?: boolean;
  /** What the position counts: how far the cover is open (`up`, the default), or how far it has come down (`down`). */
  direction?: 'up' | 'down';
  /** The words at the position ruler's ends, and at its presets' (#203): "Open" and "Closed" where none is given. */
  open_label?: string;
  closed_label?: string;
  /**
   * Whether the details sheet the card opens for its cover keeps its dial (#258): off, the position is a ruler across
   * the sheet, as the horizontal card draws it, with the card's favourites; unset, as the house's sheets are.
   */
  sheet_dial?: boolean;
}

/**
 * The ruler's band, and its words' column with the 8 before the band (`wordsColumn`): what the side column beside them
 * does not get. The words' column is 56 at the least, in the words' face (`.dv-vlabels span`).
 */
const RULER_BAND = 44;
const WORDS = 56;
const WORDS_FACE = { size: 12, weight: 500 } as const;
/** The side column's room, best first: 24 from the ruler and its words, 16 from them, 16 from the band alone. */
const SIDE_ROOM = [
  { gap: 24, words: true },
  { gap: 16, words: true },
  { gap: 16, words: false },
] as const;
type SideRoom = (typeof SIDE_ROOM)[number];
/** The position ruler's length, and its length where the tilt's slats stand beside it (#203). */
const LENGTH = 160;
const LENGTH_SLATS = 176;
/** The slats' picture and the 12 before it, at the end of the tilt's readout. */
const PICTURE = 12 + 44;
/** Where the tilt's slats stand: beside the position in the side column, under the commands, or alone over them. */
type SlatsAt = 'side' | 'under' | 'alone';

/**
 * Blinds, shades, garage doors, gates — and valves, which Home Assistant models the same way.
 * The vertical ruler is the position (open at the top, closed at the bottom), the side column
 * carries the two numbers, and the open / stop / close row runs the full width under them.
 *
 * A blind takes its time: the knob and the number hold the position that was asked for while the
 * cover says it is travelling, instead of snapping back to where the motor happens to be.
 *
 * Asked (#203), the tilt is its slats: the window seen from the room, the blind down, its slats turning as the tilt
 * does, over the house's ruler; each control has its presets as chips; and the card counts as its cover does — one
 * that says 100 % where it is closed, one counted as it comes down. Nothing of it until it is asked.
 *
 * Asked (`variant: horizontal`, #244, the reporter's mockup), the position is one row: its readout at the left, the
 * ruler across the rest of the card with its ends' words over it, the commands under them as outlined pills and the
 * tilt under those; in a column too narrow for the two side by side, the readout stands over the ruler.
 */
export class FluvyCoverCard extends Card<CoverCardConfig> {
  /** The card's height at a 360 column from its config alone: the whole card (`coverHeight`). */
  static override layoutHeight(config: CoverCardConfig): number {
    return coverHeight(config);
  }
  static override takesRows = true;

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.devices,
    coverStyles,
    acrossStyles,
    motionStyles,
    css`
      /* the sheet drew 65 %: at 0 % and 100 % the 36 px knob needs 18 px past the scale's ends, clear of the head and of the action row */
      .dv-cover {
        margin-top: 24px;
        margin-bottom: 8px;
      }
      /* a side column too narrow for the tilt's stepper beside its readout: the stepper under it (its halves at 44
         under 96), the 24 from the ruler closed to 16, then the ruler's words given way (sideFit) */
      .dv-cover--tight .dv-cover__side {
        gap: 8px;
      }
      .dv-cover--tight .dv-cover__tilt {
        display: block;
        height: auto;
      }
      .dv-cover--tight .dv-cover__tilt .fv-stepper {
        margin-top: 8px;
      }
      .dv-cover--narrow {
        gap: 16px;
      }
      .dv-cover--bare .dv-vlabels {
        display: none;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    dragged: { state: true },
    fine: { state: true },
    tiltDragged: { state: true },
    tiltFine: { state: true },
  };

  /** Position under the finger while the ruler is being dragged. */
  declare dragged: Percent;
  /** The tenth of the range the ruler shows while its fine scale is up: the end labels become numbers. */
  declare fine: RulerWindowDetail | null;
  /** The tilt under the finger while the slats' ruler is dragged (#203): the slats follow it. */
  declare tiltDragged: Percent;
  /** The slats' ruler's fine scale, while it is up: its end words become numbers. */
  declare tiltFine: RulerWindowDetail | null;

  private travelling = false;
  private readonly target = new Hold<Percent>(this, () => this.travelling);
  private readonly tiltHold = new Hold<Percent>(this);
  private readonly tiltBurst = new Burst();
  private readonly tiltStepper = new StableTemplate(this);

  constructor() {
    super();
    this.dragged = null;
    this.fine = null;
    this.tiltDragged = null;
    this.tiltFine = null;
  }

  static override editor(): Promise<CardEditor> {
    return import('./cover-editor.js');
  }
  static override aliases: AliasSpec = { items: { favorites: ITEM_ALIASES } };

  static getStubConfig(_hass: unknown, entities: readonly string[]): CoverCardConfig {
    return {
      type: 'custom:fluvy-cover-card',
      entity: entities.find((id) => /^(cover|valve)\./.test(id)) ?? '',
    };
  }

  protected override prepare(config: CoverCardConfig): CoverCardConfig {
    if (!config.entity) throw new Error('fluvy-cover-card: "entity" is required');
    if (config.favorites !== undefined && !Array.isArray(config.favorites))
      throw new Error('fluvy-cover-card: "favorites" must be a list of { name, position, tilt }');
    for (const key of ['position_presets', 'tilt_presets'] as const)
      if (config[key] !== undefined && !Array.isArray(config[key]))
        throw new Error(`fluvy-cover-card: "${key}" must be a list of percentages`);
    return config;
  }

  private readonly head = new HeadFit(this);

  private get compact(): boolean {
    return this.config?.variant === 'compact';
  }

  /** The position on one row, its ruler across the card (#244). */
  private get horizontal(): boolean {
    return this.config?.variant === 'horizontal';
  }

  /** What a cover draws where the house is not there to say: its usual parts, its tilt where the config asks for it. */
  private get usual(): number {
    return this.config ? usualFor(this.config) : 0;
  }

  override getCardSize(): number {
    if (this.compact) return 3;
    const view = drawnAs(this.entity(), this.usual);
    const rows = (key: 'position_presets' | 'tilt_presets'): number =>
      presetsOf(this.config?.[key]).length ? 1 : 0;
    // the horizontal card's position is one row (#244), the tilt a row under the commands, two as its slats
    const tilts =
      view.domain === 'cover' &&
      this.config?.show_tilt !== false &&
      [SET_TILT_POSITION, OPEN_TILT, CLOSE_TILT].some((bit) => view.supports(bit));
    const slats = tilts && view.supports(SET_TILT_POSITION) && this.config?.tilt_style === 'slats';
    const position = !this.horizontal ? 4 : 2 + (slats ? 2 : tilts ? 1 : 0);
    return (
      3 +
      (view.supports(SET_POSITION) ? position + rows('position_presets') : 0) +
      (view.supports(SET_TILT_POSITION) ? rows('tilt_presets') : 0) +
      (favoritesFor(view, this.config).length ? 2 : 0) +
      listedRows(this.config)
    );
  }

  /**
   * The full card needs its ruler's width; the compact one — the head and the actions — half a section at least; the
   * horizontal one a section, half of one where its readout stands over its ruler.
   */
  override getGridOptions(): LovelaceGridOptions {
    return this.compact
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: this.horizontal ? 6 : 8 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    releasePresses(this.renderRoot);
    this.tiltBurst.flush();
    this.target.clear();
    this.tiltHold.clear();
  }

  /** The cover reports 100 % where it is closed (`invert_position`). */
  private get inverted(): boolean {
    return this.config?.invert_position === true;
  }

  /** The position is counted as the cover comes down (`direction: down`): the figure is 100 less how open it is. */
  private get down(): boolean {
    return this.config?.direction === 'down';
  }

  /** Degrees at 100 % tilt, or 0 when tilt reads in percent. */
  private get tiltAngle(): number {
    return tiltAngleOf(this.config);
  }

  /** The tilt the cover reports, held where one was just chosen: Home Assistant's number. */
  private tiltOf(view: EntityView): Percent {
    return this.tiltHold.read(percentAttr(view, 'current_tilt_position'), near);
  }

  /** The tilt as the card shows it: turned round where the cover reports it so (`invert_tilt`). */
  private cardTilt(view: EntityView): Percent {
    const tilt = this.tiltOf(view);
    return tilt === null ? null : mirror(this.config?.invert_tilt === true, tilt);
  }

  private command(view: EntityView, key: string): void {
    const valve = view.domain === 'valve';
    // a cover that reports its position turned round goes to an end the card cannot know: nothing is held for it
    const positioned =
      view.supports(SET_POSITION) &&
      percentAttr(view, 'current_position') !== null &&
      !this.inverted;
    if (key === 'stop') {
      this.target.clear();
      this.expect(view.id, view.state); // drops an "Opening" we were still expecting
      this.call(view.domain, valve ? 'stop_valve' : 'stop_cover');
      return;
    }
    const open = key === 'open';
    if (positioned) this.target.set(open ? 100 : 0);
    this.expect(view.id, open ? 'opening' : 'closing');
    this.call(
      view.domain,
      valve ? (open ? 'open_valve' : 'close_valve') : open ? 'open_cover' : 'close_cover',
    );
  }

  /** Sends the cover to `opening` (how open it is, as the ruler reads it): Home Assistant's own number for it. */
  private moveTo(view: EntityView, opening: number): void {
    const value = mirror(this.inverted, clamp(Math.round(opening), 0, 100));
    this.dragged = null;
    this.target.set(value);
    this.expect(view.id, view.state); // a new destination: drops an "Opening" still expected from the row
    this.call(view.domain, view.domain === 'valve' ? 'set_valve_position' : 'set_cover_position', {
      position: value,
    });
  }

  /** Sends the tilt to `tilt` as the card shows it: Home Assistant's own number for it, held until it answers. */
  private tiltTo(tilt: number, burst = false): void {
    const value = mirror(this.config?.invert_tilt === true, clamp(Math.round(tilt), 0, 100));
    this.tiltDragged = null;
    this.tiltHold.set(value);
    const send = (): void =>
      this.call('cover', 'set_cover_tilt_position', { tilt_position: value });
    if (burst) this.tiltBurst.push(send);
    else send();
  }

  /** One step of the tilt stepper: 10 % at a time, or 5° when the card reads in degrees. Quick steps make one call. */
  private stepTilt(direction: 1 | -1): void {
    const view = this.entity();
    if (view.status === 'unavailable' || view.status === 'missing') return;
    if (!view.supports(SET_TILT_POSITION)) {
      this.call('cover', direction > 0 ? 'open_cover_tilt' : 'close_cover_tilt');
      return;
    }
    const angle = this.tiltAngle;
    const perPercent = angle ? angle / 100 : 1;
    const grid = angle ? 5 : 10;
    const shown = Math.round((this.cardTilt(view) ?? 0) * perPercent);
    const next =
      direction > 0
        ? Math.floor(shown / grid) * grid + grid
        : Math.ceil(shown / grid) * grid - grid;
    this.tiltTo(next / perPercent, true);
  }

  private applyFavorite(view: EntityView, favorite: CoverFavorite): void {
    if (typeof favorite.position === 'number' && view.supports(SET_POSITION))
      this.moveTo(view, mirror(this.down, favorite.position));
    if (typeof favorite.tilt === 'number' && view.supports(SET_TILT_POSITION))
      this.tiltTo(favorite.tilt);
  }

  private percent(value: number): string {
    return percentText(this.hass, value);
  }

  /** The position ruler's ends, in the config's words where it has them (`endsOf`). */
  private ends(): Ends {
    return endsOf(this.hass, this.config);
  }

  /**
   * The ruler's words' column: 56, or as wide as the house's words for its ends need, on the 4 grid (German
   * "Geschlossen", Bulgarian "Затворено": a word of the house's is never cut); a person's own end in an ellipsis at
   * the column's width, as a name does.
   */
  private wordsColumn(): number {
    const { open, closed, own } = this.ends();
    const house = [own.open ? '' : open, own.closed ? '' : closed];
    return Math.max(WORDS, ...house.map((word) => Math.ceil(textWidth(word, WORDS_FACE) / 4) * 4));
  }

  /** The slats' state in words at `tilt` % of their travel (#203): shut, part way, open. */
  private slatsSaid(tilt: number): string {
    const k = openness(tilt, this.tiltAngle);
    return cardStrings(this.hass, k <= 0 ? 'closed' : k >= 1 ? 'open' : 'partly_open');
  }

  /**
   * The side column beside the ruler, measured, never a width threshold: its readouts at m (the position, fully open;
   * the tilt, fully tilted) and the tilt's stepper beside its readout, else under it (its halves at 44 under 96).
   * Where the column cannot hold them with the ruler's words and 24 between, the 24 closes to 16, then the ruler's
   * words give way: its knob and the position say where the cover is, the commands under them which way it opens.
   * Where not even the stepper's halves hold (a card under about 200), the tilt goes under the commands at the card's
   * width, where it can still be set (`under`). The tilt's slats (#203) stand in the column where it holds their
   * readout and picture, in the first of those rooms that does; else they go under the commands too.
   */
  private sideFit(
    tilt: {
      readonly label: string;
      readonly figure: Reading;
      readonly canTilt: boolean;
      readonly slats: boolean;
    } | null,
  ): {
    readonly gap: number;
    readonly words: boolean;
    readonly column: number;
    readonly tilt: RowLayout;
    readonly under: boolean;
  } {
    const width = (label: string, figure: Reading): number =>
      Math.max(labelWidth(this.head.ruler, label), figureWidth(this.head.ruler, 'm', figure));
    const position = width(this.t('cover.position'), {
      value: formatNumber(this.hass, 100, { digits: 0 }),
      unit: '%',
    });
    const words = this.wordsColumn() + 8;
    const column = (room: SideRoom): number =>
      this.contentWidth - RULER_BAND - room.gap - (room.words ? words : 0);
    const roomFor = (need: number): SideRoom | undefined =>
      SIDE_ROOM.find((room) => column(room) >= need);
    // the position's readout alone in the column, the tilt under the commands
    const under = { ...(roomFor(position) ?? SIDE_ROOM[2]), tilt: 'alone', under: true } as const;
    if (tilt?.slats) {
      const beside = roomFor(Math.max(position, width(tilt.label, tilt.figure) + PICTURE));
      return beside
        ? { ...beside, column: column(beside), tilt: 'alone', under: false }
        : { ...under, column: column(under) };
    }
    // the column holds the readouts and, under the tilt's readout at the least, its whole stepper
    const need = Math.max(
      position,
      tilt ? width(tilt.label, tilt.figure) : 0,
      tilt?.canTilt ? STEPPER : 0,
    );
    const room = roomFor(need) ?? SIDE_ROOM[2];
    const layout = tilt
      ? fitValueRow(this.head.ruler, {
          width: column(room),
          control: tilt.canTilt ? STEPPER : 0,
          narrow: STEPPER_HALVES,
          labels: [tilt.label],
          figures: [tilt.figure],
          sizes: ['m'],
        }).layout
      : 'alone';
    return tilt?.canTilt && layout === 'alone'
      ? { ...under, column: column(under) }
      : { ...room, column: column(room), tilt: layout, under: false };
  }

  /**
   * The horizontal ruler's ends, said over them (#244): the ends' words (the config's, else "Closed" and "Open") where
   * the ruler holds both 8 apart, else their figures as the card counts them ("0 %" and "100 %"); while its fine scale
   * is up, the figures it reads there.
   */
  private acrossEnds(length: number): Labels {
    const figure = (opening: number): string => this.percent(mirror(this.down, opening));
    const fine = this.fine;
    if (fine)
      return [
        [0, figure(fine.min)],
        [1, figure(fine.max)],
      ];
    const { open, closed } = this.ends();
    const spoken = endsHold(this.head.ruler, length, closed, open);
    return [
      [0, spoken ? closed : figure(0)],
      [1, spoken ? open : figure(100)],
    ];
  }

  /**
   * The position's ruler: up the card's side (`vertical`), or across it (#244); lit from the closed end to the knob,
   * or from the open end where the position is counted as the blind comes down (`origin` 100). It sends on release,
   * the knob and the figure following the finger meanwhile.
   */
  private positionRuler(
    view: EntityView,
    o: {
      readonly position: Percent;
      readonly length: number;
      readonly vertical: boolean;
      readonly name: string;
      readonly tone: Tone;
      readonly unusable: boolean;
    },
  ): TemplateResult {
    return html`<fluvy-ruler
      ?vertical=${o.vertical}
      .value=${o.position ?? 0}
      .min=${0}
      .max=${100}
      .step=${1}
      .origin=${this.down ? 100 : Number.NaN}
      .length=${o.length}
      .band=${RULER_BAND}
      .tone=${o.unusable ? 'neutral' : o.tone}
      ?inactive=${o.unusable || o.position === null}
      ?disabled=${o.unusable}
      .look=${sliderStyleOf(this.config)}
      ?still=${sliderStill()}
      unit="%"
      .label=${`${o.name} · ${this.t('cover.position')}`}
      .format=${(value: number) => formatNumber(this.hass, mirror(this.down, value), { digits: 0 })}
      @fluvy-input=${(event: CustomEvent<RulerChangeDetail>) => {
        this.dragged = event.detail.value;
      }}
      @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => this.moveTo(view, event.detail.value)}
      @fluvy-cancel=${() => {
        this.dragged = null;
      }}
      @fluvy-window=${(event: CustomEvent<RulerWindowDetail>) => {
        this.fine = event.detail.fine ? event.detail : null;
      }}
    ></fluvy-ruler>`;
  }

  /**
   * The tilt as its slats (#203): its readout — "Tilt", the figure, the slats' state in words where the column holds
   * them for every figure the tilt can show — with the picture at its end, and under them the house's ruler at the
   * column's width, the ends' words under it. Where the column is short the word gives way first, then the figure
   * steps down a size (under the commands at 152), and a label longer than the room beside the picture stands across
   * the row over it; the picture and the ruler stay. The ruler sends on release, as the details sheet's does, the slats
   * following the finger meanwhile.
   */
  private renderSlats(
    view: EntityView,
    o: {
      readonly name: string;
      readonly width: number;
      readonly tone: Tone;
      readonly unusable: boolean;
      readonly at: SlatsAt;
    },
  ): TemplateResult {
    const angle = this.tiltAngle;
    const unit = angle ? '°' : '%';
    const figure = (tilt: number): string =>
      formatNumber(this.hass, angle ? (tilt * angle) / 100 : tilt, { digits: 0 });
    const said = (tilt: number): string => this.slatsSaid(tilt);
    const title = this.t('cover.tilt');
    // every figure the tilt can show with its words: shut, level and part way (its widest figure), the row laid out for
    // the widest of them, never for the one it shows now
    const shown = angle >= 135 ? [0, 50, 99, 100] : [0, 99, 100];
    const widest = (size: 'm' | 's', withWords: boolean): number =>
      Math.max(
        ...shown.map(
          (tilt) =>
            figureWidth(this.head.ruler, size, { value: figure(tilt), unit }, unit === '°') +
            (withWords ? saidWidth(this.head.ruler, said(tilt)) : 0),
        ),
      );
    const room = o.width - PICTURE;
    const size = o.at === 'side' || widest('m', false) <= room ? 'm' : 's';
    const worded = widest(size, true) <= room;
    // a label longer than the room beside the picture (it-IT "Inclinazione" at 152) stands across the row, over it
    const across = labelWidth(this.head.ruler, title) > room;
    const tilt = this.tiltDragged ?? this.cardTilt(view);
    const unknown = o.unusable || tilt === null;
    // the ruler's ends in words ("Closed · Open · Closed" where the slats turn 135° or more), where its width holds
    // them 8 apart (measured in the axis' type, the ruler words' own); else in figures, as its fine scale's are
    const fine = this.tiltFine;
    const stops = angle >= 135 ? [0, 50, 100] : [0, 100];
    const endWords = stops.map((tilt) => said(tilt));
    const spoken =
      endWords.reduce((sum, word) => sum + this.head.ruler.width('fv-axis', word), 0) +
        8 * (stops.length - 1) <=
      o.width;
    const reading = (tilt: number): string => `${figure(tilt)}${unit === '°' ? '' : ' '}${unit}`;
    const ends = fine
      ? ([
          [0, reading(fine.min)],
          [1, reading(fine.max)],
        ] as const)
      : stops.map(
          (tilt, index) => [tilt / 100, spoken ? endWords[index]! : reading(tilt)] as const,
        );
    return html`<div class="cv-tilt cv-tilt--${o.at}">
      <div class="cv-tilt__row ${across ? 'cv-tilt__row--across' : ''}">
        ${saidReadout(
          title,
          size,
          unknown ? '—' : figure(tilt),
          unknown ? '' : unit,
          worded && !unknown ? said(tilt) : '',
        )}
        ${slats(unknown ? null : openness(tilt, angle), this.tiltDragged !== null)}
      </div>
      <fluvy-ruler
        .value=${tilt ?? 0}
        .min=${0}
        .max=${100}
        .step=${1}
        .length=${o.width}
        .band=${44}
        .tone=${o.unusable ? 'neutral' : o.tone}
        ?inactive=${unknown}
        ?disabled=${o.unusable}
        .look=${sliderStyleOf(this.config)}
        ?still=${sliderStill()}
        unit=${unit}
        .label=${`${o.name} · ${title}`}
        .format=${figure}
        @fluvy-input=${(event: CustomEvent<RulerChangeDetail>) => {
          this.tiltDragged = event.detail.value;
        }}
        @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => this.tiltTo(event.detail.value)}
        @fluvy-cancel=${() => {
          this.tiltDragged = null;
        }}
        @fluvy-window=${(event: CustomEvent<RulerWindowDetail>) => {
          this.tiltFine = event.detail.fine ? event.detail : null;
        }}
      ></fluvy-ruler>
      ${rulerLabels(ends)}
    </div>`;
  }

  /**
   * A control's presets (#203): one chip each, filling its row, the one in force lit; `word` says an end where it has
   * one ("Closed", "Open"), every other is its figure. Away from its control (the tilt's, its slats or its stepper
   * beside the position), under the control's name (`label`), as the favourites are.
   */
  private renderPresets(
    presets: readonly number[],
    o: {
      readonly value: Percent;
      readonly word: (preset: number) => string;
      readonly unusable: boolean;
      readonly pick: (preset: number) => void;
      readonly label?: string;
    },
  ): TemplateResult | typeof nothing {
    if (!presets.length) return nothing;
    const items: ChipItem[] = presets.map((preset) => ({
      key: String(preset),
      label: o.word(preset),
      active: !o.unusable && near(o.value, preset),
    }));
    return html`<div class="cv-presets ${o.label ? 'cv-presets--named' : ''}">
      ${o.label ? label(o.label) : nothing}${chipRow(
        items,
        (key) => {
          if (!o.unusable) o.pick(Number(key));
        },
        'full',
        { ruler: this.head.ruler, width: this.contentWidth },
      )}
    </div>`;
  }

  protected override get quiet(): boolean {
    return muted(this.config);
  }

  protected renderCard(): TemplateResult {
    // out of reach (unavailable, missing; never read: its usual parts) it keeps its anatomy and its size, its controls
    // disabled: only the colours change (1.9)
    const view = drawnAs(this.entity(), this.usual);
    const name = this.nameFor(view, this.config?.name);
    const valve = view.domain === 'valve';
    const unusable = !isUsable(view);
    const compact = this.compact;
    const { reported, fullyOpen, fullyClosed, shown, moving } = motionOf(view, this.stateOf(view));
    this.travelling = moving;

    // how open the cover is, as its ruler reads it: the cover's own number, turned round where it reports it so
    // (`invert_position`), the finger's while the ruler is dragged; and the figure the card says, counted as it comes
    // down where it is asked (`direction: down`)
    const position =
      reported === null
        ? null
        : (this.dragged ?? mirror(this.inverted, this.target.read(reported, near) ?? reported));
    const down = this.down;
    const figureOf = (opening: number): number => mirror(down, opening);
    const tilt = this.tiltOf(view);
    const open = view.status === 'ok' && (position !== null ? position > 0 : shown !== 'closed');
    // its state's tone: the card's own (the accent while it is open or moving, a valve's the water's), or the
    // config's for the state; beyond the circle and the badge where the card is tinted by it
    const colour = stateLook(
      this.accents,
      this.config,
      shown,
      unusable ? 'off' : open || moving ? (valve ? 'water' : 'accent') : 'neutral',
    );
    const { tone } = colour;
    const tinted = tintOf(this.accents, this.config, colour, open || moving);

    const canPosition = view.supports(SET_POSITION);
    const canSetTilt = !valve && view.supports(SET_TILT_POSITION);
    const canTilt =
      canSetTilt || (!valve && (view.supports(OPEN_TILT) || view.supports(CLOSE_TILT)));
    const showTilt =
      !valve && !compact && this.config?.show_tilt !== false && (canTilt || tilt !== null);
    // the tilt as its slats where it is asked and the cover takes an angle; one that only opens and closes its slats
    // keeps the stepper
    const asSlats = showTilt && canSetTilt && this.config?.tilt_style === 'slats';

    // a cover whose state is only assumed (one-way radio), or whose position the card turns round, keeps both
    // directions live, as Home Assistant does for the first
    const live = view.attr<boolean>('assumed_state') === true || this.inverted;
    const row: ActionItem[] = [];
    if (view.supports(OPEN))
      row.push({
        key: 'open',
        glyph: 'up',
        label: this.t('cover.open'),
        disabled: unusable || (!live && (fullyOpen || shown === 'opening')),
      });
    if (view.supports(STOP))
      row.push({ key: 'stop', glyph: 'stop', label: this.t('cover.stop'), disabled: unusable });
    if (view.supports(CLOSE))
      row.push({
        key: 'close',
        glyph: 'down',
        label: this.t('cover.close'),
        disabled: unusable || (!live && (fullyClosed || shown === 'closing')),
      });

    const favorites =
      compact || this.config?.show_favorites === false ? [] : favoritesFor(view, this.config);
    // a compact card narrower than three cells keeps open and close (stop steps aside); one too narrow for
    // those keeps its head alone — the card's real width decides, not the drawing floor
    if (compact) {
      const fit = actionsThatFit(this.contentWidth);
      if (row.length > fit && row.some((item) => item.key === 'stop'))
        row.splice(
          row.findIndex((item) => item.key === 'stop'),
          1,
        );
      if (row.length > fit) row.splice(fit);
    }
    const cardTilt = this.cardTilt(view);
    const said = position === null ? null : figureOf(position);
    const chipItems = favoriteChips(this.hass, this.config, favorites, said, cardTilt, unusable);

    const fine = this.fine;
    const angle = this.tiltAngle;
    const tiltLabel = this.t('cover.tilt');
    const tiltUnit = angle ? '°' : '%';
    const tiltValue =
      cardTilt === null
        ? '—'
        : formatNumber(this.hass, angle ? (cardTilt * angle) / 100 : cardTilt, { digits: 0 });
    // the tilt's row laid out for its widest figure (fully tilted), never for the one it shows now: beside the
    // ruler in the side column, or across the card where the cover has no position
    const tiltFigure = {
      value: formatNumber(this.hass, angle || 100, { digits: 0 }),
      unit: tiltUnit,
    };
    // the position on its own row, its ruler across the card (#244), or up its side with a column beside it
    const across = canPosition && this.horizontal;
    const side =
      canPosition && !compact && !across
        ? this.sideFit(
            showTilt ? { label: tiltLabel, figure: tiltFigure, canTilt, slats: asSlats } : null,
          )
        : null;
    // the tilt's own row across the card: on a cover with no position, under the commands where the side column
    // cannot hold its stepper and under the horizontal card's, at the position's size there
    const tiltFit =
      showTilt && !asSlats && (!canPosition || across || side?.under)
        ? fitValueRow(this.head.ruler, {
            width: this.contentWidth,
            control: canTilt ? STEPPER : 0,
            narrow: STEPPER_HALVES,
            labels: [tiltLabel],
            figures: [tiltFigure],
            ...(canPosition ? { sizes: ['m', 's'] as const } : {}),
          })
        : null;
    const tiltLayout = tiltFit?.layout ?? side?.tilt ?? 'alone';
    const tiltReadout = readout({
      label: tiltLabel,
      size: tiltFit?.size ?? 'm',
      value: tiltValue,
      unit: cardTilt === null ? '' : tiltUnit,
    });
    const tiltStepper =
      canTilt && !asSlats && tiltLayout !== 'alone'
        ? this.tiltStepper.get(`${tiltLabel}|${unusable}`, () =>
            stepper((direction) => this.stepTilt(direction), {
              disabled: unusable,
              decrease: `${tiltLabel} · ${this.t('common.decrease')}`,
              increase: `${tiltLabel} · ${this.t('common.increase')}`,
            }),
          )
        : nothing;
    // where the slats stand: beside the position where the column holds them, else under the commands, as on the
    // horizontal card; over the commands on a cover with no position
    const slatsAt: SlatsAt | null = !asSlats
      ? null
      : across || side?.under
        ? 'under'
        : side
          ? 'side'
          : 'alone';
    const tiltRow = tiltFit
      ? html`<div class="dv-value ${valueRowClass(tiltFit.layout)}">
          ${tiltReadout}${tiltStepper}${canTilt && tiltFit.layout === 'alone' ? this.readoutTap(view.id, `${name} · ${tiltLabel} ${tiltValue} ${cardTilt === null ? '' : tiltUnit}`) : nothing}
        </div>`
      : nothing;
    const slatsOf = (at: SlatsAt, width: number): TemplateResult =>
      this.renderSlats(view, { name, width, tone, unusable, at });

    const ends = this.ends();
    const positionPresets =
      side || across
        ? this.renderPresets(presetsOf(this.config?.position_presets), {
            value: said,
            unusable,
            word: (preset) => {
              const opening = figureOf(preset);
              return opening >= 100 ? ends.open : opening <= 0 ? ends.closed : this.percent(preset);
            },
            pick: (preset) => this.moveTo(view, figureOf(preset)),
          })
        : nothing;
    const tiltPresets =
      showTilt && canSetTilt
        ? this.renderPresets(presetsOf(this.config?.tilt_presets), {
            value: cardTilt,
            unusable,
            ...(side && !side.under ? { label: tiltLabel } : {}),
            // an end in words where it is the slats' only one: shut both ways round past 135°, its figures there
            word: (preset) => {
              const k = openness(preset, angle);
              return k >= 1 || (k <= 0 && angle < 135)
                ? this.slatsSaid(preset)
                : angle
                  ? `${formatNumber(this.hass, (preset * angle) / 100, { digits: 0 })}°`
                  : this.percent(preset);
            },
            pick: (preset) => this.tiltTo(preset),
          })
        : nothing;

    // the position's readout in its column at its widest (100 %): where a card under about 180 cannot hold its words,
    // its label is a glyph (read out still) and its figure a size smaller; where it counts down, "down" after the
    // figure where the column holds it
    const positionTitle = this.t('cover.position');
    const hundred = [{ value: formatNumber(this.hass, 100, { digits: 0 }), unit: '%' }];
    const counted = down ? cardStrings(this.hass, 'down') : '';
    const positionReadout = (column: number): TemplateResult =>
      levelReadout(this.head.ruler, column, {
        label: positionTitle,
        glyph: 'updown',
        value: said === null ? '—' : formatNumber(this.hass, said, { digits: 0 }),
        unit: said === null ? '' : '%',
        said: said === null ? '' : counted,
        figures: hundred,
      });
    const length = slatsAt ? LENGTH_SLATS : LENGTH;
    // the horizontal card's position (#244), the house's row across (`shared/across.ts`): its readout beside the ruler
    // in a column as wide as its widest figure (100 %, "down" after it where the cover is counted so), the ends' words
    // over the ruler's ends; where the column cannot hold the two side by side, the readout over them
    const fit = across
      ? acrossFit(this.head.ruler, this.contentWidth, positionTitle, hundred, counted)
      : null;
    const acrossLength = fit?.length ?? this.contentWidth;
    const positionRow = across
      ? acrossRow(
          fit,
          positionReadout(fit?.column ?? this.contentWidth),
          this.acrossEnds(acrossLength),
          this.positionRuler(view, {
            position,
            length: acrossLength,
            vertical: false,
            name,
            tone,
            unusable,
          }),
        )
      : nothing;

    const classLabel = coverClassLabel(this.hass, view.domain, view.deviceClass);
    const { sub, shorter } = this.subtitle(
      view.areaName
        ? [view.areaName, classLabel].filter(Boolean).join(' · ')
        : classLabel.charAt(0).toUpperCase() + classLabel.slice(1),
    );

    // the head fitted to its column: the badge steps aside before the name is cut, its word then leading the line
    // (the commands say which way it goes, never the state in words), then the rest of the line, then the icon
    const fitted = this.head.fit({
      width: this.contentWidth,
      title: name,
      sub: headSub(sub, this.contentWidth),
      shorter,
      badge: { text: shownStateText(this.hass, view, shown), tone, lead: true },
    });
    // the commands in equal cells, two rows where one would leave a cell under a finger's 44
    const cells = actionGap(this.contentWidth, row.length);
    return html`<article
      class="fv-card dv-card ${unusable ? 'is-unavailable is-off' : ''} ${this.horizontal ? 'cv-card--across' : ''} ${tinted.cls}"
      style="--dv-action-gap:${cells.gap}px"
      data-card
      aria-label=${this.headless ? name : nothing}
      data-accent=${colour.accent ?? nothing}
      data-surface=${tinted.surface}
      data-edge=${tinted.edge}
    >
      ${
        this.headless
          ? nothing
          : head({
              icon: fitted.icon ? iconOf(view, this.config?.icon) : null,
              tone,
              title: name,
              name: true,
              sub: fitted.line,
              trailing: fitted.badge,
              cut: fitted.cut,
              ...this.headActions(view.id),
            })
      }
      ${
        side
          ? html` <div
              class="dv-cover ${side.tilt === 'stack' || side.tilt === 'halves' ? 'dv-cover--tight' : ''} ${side.gap === 16 ? 'dv-cover--narrow' : ''} ${side.words ? '' : 'dv-cover--bare'} ${slatsAt ? 'cv-cover--slats' : ''}"
            >
              <div class="dv-cover__ruler">
                <div class="dv-vlabels" style="height:${length}px;width:${this.wordsColumn()}px">
                  <span class=${ends.own.open && !fine ? 'is-own' : nothing} style="top:0"
                    >${fine ? this.percent(figureOf(fine.max)) : ends.open}</span
                  ><span
                    class=${ends.own.closed && !fine ? 'is-own' : nothing}
                    style="top:${length}px"
                    >${fine ? this.percent(figureOf(fine.min)) : ends.closed}</span
                  >
                </div>
                ${this.positionRuler(view, {
                  position,
                  length,
                  vertical: true,
                  name,
                  tone,
                  unusable,
                })}
              </div>
              <div class="dv-cover__side">
                ${positionReadout(side.column)}
                ${
                  slatsAt === 'side'
                    ? slatsOf('side', side.column)
                    : showTilt && !slatsAt && !side.under
                      ? html`<div
                          class="dv-cover__tilt ${side.tilt === 'halves' ? 'fv-value-row--halves' : ''}"
                        >
                          ${tiltReadout}${tiltStepper}
                        </div>`
                      : nothing
                }
              </div>
            </div>`
          : across
            ? positionRow
            : slatsAt === 'alone'
              ? slatsOf('alone', this.contentWidth)
              : tiltRow
      }
      ${row.length ? actions(row, (key) => this.command(view, key), cells.columns) : nothing}
      ${positionPresets}
      ${slatsAt === 'under' ? slatsOf('under', this.contentWidth) : side || across ? tiltRow : nothing}
      ${tiltPresets}
      ${
        chipItems.length
          ? html`${label(coverStrings(this.hass, 'favourites'))}${chipRow(
              chipItems,
              (key) => {
                const favorite = favorites[Number(key)];
                if (favorite && !unusable) this.applyFavorite(view, favorite);
              },
              this.config?.favorites_style,
              { ruler: this.head.ruler, width: this.contentWidth },
            )}`
          : nothing
      }
      ${compact ? nothing : this.extraRows(this.head)}
    </article>`;
  }
}
