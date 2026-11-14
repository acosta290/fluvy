import {
  actionRuns,
  formatNumber,
  isActive,
  isUsable,
  lightDefaults,
  numberAttr,
  relativeTime,
  resolveEntity,
  sliderStill,
  sliderStyleOf,
  stateText,
  TOGGLE_DOMAINS,
  toggleEntity,
  valueParts,
  type ActionConfig,
  type EntityName,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceGridOptions,
  type UnavailableLook,
} from '@fluvy/core';

import {
  ico,
  type IconRef,
  pressCover,
  readout,
  type RulerChangeDetail,
  sheetStyles,
  textWidth,
  toggle,
  type Tone,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { Card, MORE_INFO, type CardEditor } from '../shared/base.js';

import { doingReading } from '../climate-family.js';
import { currentTone, iconOf, toneFor } from '../shared/domain.js';
import { DIMMABLE, lightLook, litColour, withMembers } from '../shared/light.js';
import { fitLine, TextRuler, type Segment } from '../shared/fit.js';
import { FontsSettled } from '../shared/fonts.js';
import { statusToneOf, washesAtRest, type LightColours, type Tint } from '../shared/colour.js';
import { NAME_LINE, twoLines } from '../shared/heights.js';
import { shorterForms } from '../shared/secondary.js';
import { changedAt, sinceIds } from '../shared/since.js';
import {
  NUMBERS,
  numberScale,
  PERCENT,
  playerOff,
  readingOf,
  scaleText,
  setCall,
  ticksOf,
  VOLUME_SET,
  type Scale,
  type Ticks,
} from '../shared/scale.js';

export type TileSize = 'large' | 'compact' | 'mini';
export const TILE_SIZES: readonly TileSize[] = ['large', 'compact', 'mini'];
/** The lines a small tile's name may take (`name_lines`): YAML's figure, or the editor's word for it. */
export type NameLines = 1 | 2 | '1' | '2';
/**
 * What ends a large tile's head where its entity switches (`show_switch`, #160): its switch (`true`, the default);
 * nothing (`false`), its circle being the switch, as on a tile too narrow for one beside it; or its level's figure
 * (`value`: "70 %", its line the state alone), its circle the switch too.
 */
export type ShowSwitch = boolean | 'value';
/** What a tile's switch is drawn as (`switch_style`, #177): the toggle (the default), or a wall rocker. */
export type SwitchStyle = 'toggle' | 'rocker';

/** One tile's own settings — the single card's config, or one item of a tiles group. */
export interface TileItem {
  entity: string;
  name?: EntityName;
  icon?: string;
  tone?: Tone;
  /** The tile's own colour (a Home Assistant colour name or `#rrggbb`): the accent inside it. */
  color?: string;
  /** Entities shown as small readouts in the foot of a large tile (a plug's power, its energy today, its cost): two, or three when the tile is wide; the first one joins the state line of a small tile. */
  readouts?: readonly string[];
  /** Where its last change is read from (#67): a timestamp sensor, or `attribute:<name>` of its own; else Home Assistant's. */
  since?: string;
  /** How it looks out of reach (1.16, #126): `quiet`, as it rests; else the group's, else the house's (`dashed`). */
  unavailable?: UnavailableLook;
  /**
   * A large tile's switch beside its circle (#160): hidden (`false`), or its level's figure in its place (`value`),
   * its circle the switch then; else the group's, else shown.
   */
  show_switch?: ShowSwitch;
  /**
   * Its switch as a wall rocker (`rocker`, #177): a plate standing on end in the switch's place — a large tile's
   * beside its circle, a compact one's at its row's end — the tile then switching and nothing more, with no ruler and
   * no level; else the group's, else the toggle.
   */
  switch_style?: SwitchStyle;
  /**
   * A climate's or a humidifier's tile says what it is doing and what it is set to on its line ("Heating · 21.5°",
   * "Idle · 21.5°", "Window open"), and a large climate's ends its head with what it measures ("20.8 °C"), where it
   * said its mode (#185); else the group's, else the mode as before. Its fill stays its mode's.
   */
  show_action?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  /**
   * What its circle answers (#179): a button of its own then, over the tile's; unset, the circle as the tile draws it —
   * its switch where it is one, else part of the tile.
   */
  icon_tap_action?: ActionConfig;
  icon_hold_action?: ActionConfig;
  icon_double_tap_action?: ActionConfig;
}

export interface TileCardConfig extends FluvyCardConfig, LightColours, Omit<TileItem, 'entity'> {
  /** `large` (default): icon + switch, name, state and a foot. `compact`: one 76 px row. `mini`: icon over name, 108 px. */
  size?: TileSize;
  /** A compact or mini tile's name in two lines where one would cut it (`2`), the tile a line taller; one (`1`, the default). */
  name_lines?: NameLines;
  /** `always`: a tile shows its colour at rest too — a wash of it and its hairline (`on`, the default: only when on). */
  tint?: Tint;
}

/**
 * How a tile's state line is fitted (`fitState`). `dash`: the tile has no reading (unavailable, unknown): a word that
 * cannot fit at all is a dash, where it is nothing on a tile with one. `inside`: the tile sits inside a card (a room's
 * controls). `under`: the line sits under the head (a live large tile: "On · 70 %" over its ruler) and has the whole
 * width. `words`: the line is the person's own (a template card's): what is left of it once its last parts are gone
 * ends in an ellipsis, as a name does, rather than going. `figure`: the figure the line ends in and keeps
 * (`keepsFigure`): where the whole line does not hold, the words before it go and the figure stays, alone. `plated`:
 * a compact tile's rocker stands at its row's end. `forms`: what the line says instead, in order, where it holds not
 * even its first words (a thermostat's action: Fluvy's own word, then its mode).
 */
interface LineFit {
  readonly dash?: boolean;
  readonly inside?: boolean;
  readonly plated?: boolean;
  readonly under?: boolean;
  readonly words?: boolean | undefined;
  readonly figure?: string | undefined;
  readonly forms?: readonly string[] | undefined;
}

/** What a tile shows of its entity (`look`): what a card built on the tile may answer otherwise (the template card). */
export interface TileLook {
  /** The words over its line. */
  readonly name: string;
  /** What a reader hears for its button, its switch and its ruler: never a blank. */
  readonly label: string;
  readonly glyph: IconRef | string;
  /** It can be read: the live skin; else the off skin on the same anatomy, the ban circle, a dash in every reading. */
  readonly usable: boolean;
  /** It shows as on: the tone's fill. */
  readonly on: boolean;
  readonly tone: Tone;
  /** Its line is the person's own words: what fits of it ends in an ellipsis as a name does, never left out. */
  readonly words?: boolean;
}

/** What a thermostat's tile says of what it is doing: its line, and what the line gives way to (`doingLine`). */
type TileDoing = ReturnType<typeof import('../thermostat/doing.js').doingLine>;

const COVER_SET_POSITION = 4;
const FAN_SET_SPEED = 1;
const TOGGLE: ActionConfig = { action: 'toggle' };
/** A head's circle and the 8 of air before what ends it: its switch, a reading, a level's figure. */
const HEAD_LEAD = 44 + 8;
/** A large tile's head holds its icon circle, 8 of air and the switch; a narrower tile's circle is the switch. */
const HEAD_ROOM = HEAD_LEAD + 48;
/** A wall rocker's plate: narrower than the switch, so a head holds it beside its circle down to 84. */
const PLATE = 32;
/** A compact tile holds its rocker from this width (56 of words, 12 of air and the plate inside its sides). */
const PLATE_ROOM = 132;
/** A compact tile keeps its circle beside its rocker from this width (tiles.css): under it the words have its room. */
const PLATE_CIRCLE = 228;
/** Two readouts share a foot from this inner width; under it the first one has the foot to itself. */
const TWO_READOUTS = 120;
/** Three readouts (power, today, cost) share a foot from this inner width: a tile on its own row. */
const THREE_READOUTS = 292;

/**
 * The switch a large tile is asked to show (`show_switch`), by the one rule every card that draws one follows: its
 * own word, else its card's (a group's, a card's built on the tile), else shown — as is whatever a config writes that
 * is neither `false` nor `value`.
 */
const switchOf = (
  item: Pick<TileItem, 'show_switch'>,
  card?: Pick<TileItem, 'show_switch'>,
): ShowSwitch => {
  const asked = item.show_switch ?? card?.show_switch;
  return asked === false || asked === 'value' ? asked : true;
};

/**
 * The wall rocker (`tile/rocker.ts`, the `switch-styles` chunk), once the first tile asked for one has fetched it;
 * `null` where it cannot be fetched: the tile keeps its toggle.
 */
let plates: typeof import('./rocker.js') | null | undefined;
let fetchingPlates: Promise<unknown> | undefined;

/**
 * Whether a large tile's foot is its ruler, never its readouts: a light that dims, a cover set to a position, a fan to
 * a speed, a player's volume, a number or a helper with a range (#77).
 */
export const ruled = (view: EntityView): boolean =>
  view.domain === 'light'
    ? (view.attr<string[]>('supported_color_modes') ?? []).some((m) => DIMMABLE.has(m))
    : (view.domain === 'cover' && view.supports(COVER_SET_POSITION)) ||
      (view.domain === 'fan' && view.supports(FAN_SET_SPEED)) ||
      (view.domain === 'media_player' && view.supports(VOLUME_SET)) ||
      (NUMBERS.has(view.domain) && numberScale(view) !== null);

/** A tile's ruler is short: its ticks are 1/12 and 1/4, or one a step up to twelve steps (`ticksOf`). */
const TILE_TICKS = 12;

/** A figure at the end of a large tile's head, its unit small beside it: a sensor's reading, a level's (`value`). */
const headValue = (value: string, unit: string): TemplateResult =>
  html`<span class="fv-tile__value"
    >${value}${unit ? html` <span class="fv-unit">${unit}</span>` : nothing}</span
  >`;

/** What a large tile's foot ruler sets (`level`): where the entity stands on its scale, and the call that sets it. */
export interface TileLevel {
  readonly value: number;
  readonly scale: Scale;
  readonly ticks: Ticks;
  /** What a reader hears it named ("Brightness"). */
  readonly label: string;
  /** Its figure as the line says it ("70 %", "−1.0 °C"). */
  readonly text: string;
  /** Its knob shows: while the entity is on — a number always, a player's volume while the player is on. */
  readonly awake: boolean;
  /** Drawn neutral while awake: a muted player's volume. */
  readonly quiet: boolean;
  /** A drag on it asleep wakes the entity at that value (a light, a fan); a player that is off is not woken by it. */
  readonly wakes: boolean;
  readonly commit: (value: number) => void;
  /** The value under the finger as it moves, for a card that sends it then (the Slider card's `live_update`). */
  readonly input?: ((value: number) => void) | undefined;
  /** The drag taken away before its release (the page's scroll): the value under the finger goes, nothing chosen. */
  readonly cancel?: (() => void) | undefined;
}

/**
 * Whether a card of one tile shows something at rest when asked (`tint: always`, its editor's form): a colour, or a
 * tone that washes at rest — its own, else its entity's (`washesAtRest`: a status at rest never does).
 */
export const tintsAtRest = (
  data: Readonly<Record<string, unknown>>,
  hass?: HomeAssistant,
): boolean =>
  Boolean(data['color']) ||
  washesAtRest(
    (data['tone'] as Tone | undefined) ??
      toneFor(resolveEntity(hass, String(data['entity'] ?? ''))),
  );

/**
 * The tile. Large (172 × 168): icon circle + switch, name, state, and a foot that is either a compact
 * ruler (brightness, cover position, fan speed) or two small readouts. Compact (76 tall) and mini
 * (108 tall, icon over name) are the same tile without the switch: the whole surface toggles on tap
 * and opens the details on hold — the Mushroom-sized buttons people group in pairs and threes. A large tile's
 * surface taps and holds the same, through a button stretched under its switch and ruler (never around them); asked
 * not to show its switch (`show_switch`, #160), its circle is the switch, and the three sizes are one tile. Asked for
 * a wall rocker (`switch_style`, #177), its switch is a plate standing on end — a large tile's where its toggle
 * stood, a compact one's at its row's end, its own tap then opening the details — and it switches and nothing more:
 * no ruler, no level. Active = the tone's pastel fill in every size; unavailable = the off skin on the same anatomy,
 * at the same size.
 */
export class FluvyTileCard extends Card<TileCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: TileCardConfig): number {
    const lines = twoLines(config);
    return config.size === 'compact'
      ? 76 + (lines ? NAME_LINE.compact : 0)
      : config.size === 'mini'
        ? 108 + (lines ? NAME_LINE.mini : 0)
        : 168;
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.home,
    css`
      .fv-tile {
        display: block;
        height: 168px;
        text-align: left;
      }
      /* a slider's 44 band sits 4 up in the 40 foot slot: the ruler's ticks drawn through it, a bar's or a liquid's 40 on its foot; a fill's covers the tile */
      .fv-tile > fluvy-ruler:not([look='fill']) {
        margin-top: -4px;
      }
      .fv-tile__foot {
        grid-template-columns: minmax(0, 46%) minmax(0, 54%);
      }
      .fv-tile__foot--three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .fv-tile__foot--one {
        grid-template-columns: minmax(0, 1fr);
      }
      /* a foot under the state line: a name that would end in an ellipsis steps down to 14 px first (as the compact tiles' does) */
      .fv-tile--tight .fv-tile__name {
        font-size: 14px;
      }
      /* nothing under the state line: the name may take the foot's room, two balanced lines, before an ellipsis */
      .fv-tile--footless .fv-tile__name {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        white-space: normal;
        text-wrap: balance;
      }
      /* an unavailable large tile is the live one in the off skin: its name keeps its place under the head */
      .fv-tile--off > .fv-tile__name {
        margin-top: 12px;
      }
      .fv-tile--compact {
        display: flex;
        height: 76px;
      }
      /* a compact tile inside a card (a room's controls) is 84 tall: the sheet's rule, which the line above would
         otherwise override */
      .fv-tile--compact.fv-tile--inner {
        height: 84px;
      }
      .fv-tile--mini {
        display: flex;
        height: 108px;
        text-align: center;
      }
      .fv-tile__body {
        display: block;
        cursor: pointer;
      }
      /* a small tile's name in two lines where one would end it in an ellipsis (name_lines: 2, #100), balanced, an
         ellipsis only past the second; the tile is the taller one whatever its name says, so a row stays level */
      .fv-tile--lines .fv-tile__name {
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        white-space: normal;
        text-wrap: balance;
      }
      .fv-tile--compact.fv-tile--lines {
        height: 88px;
      }
      .fv-tile--compact.fv-tile--inner.fv-tile--lines {
        height: 96px;
      }
      .fv-tile--mini.fv-tile--lines {
        height: 124px;
      }
    `,
  ];

  static override editor(): Promise<CardEditor> {
    return import('./tile-editor.js');
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): TileCardConfig {
    const entity =
      entities.find((id) => /^(light|switch|cover|fan)\./.test(id)) ?? entities[0] ?? '';
    return { type: 'custom:fluvy-tile-card', entity };
  }

  protected override prepare(config: TileCardConfig): TileCardConfig {
    if (!config.entity) throw new Error('fluvy-tile-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    return this.size() === 'large' ? 3 : 1;
  }

  override getGridOptions(): LovelaceGridOptions {
    switch (this.size()) {
      case 'mini':
        return { columns: 3, rows: 'auto', min_columns: 3 };
      case 'compact':
        return { columns: 6, rows: 'auto', min_columns: 4 };
      default:
        return { columns: 6, rows: 'auto', min_columns: 6 };
    }
  }

  protected size(): TileSize {
    const size = this.config?.size;
    return size && TILE_SIZES.includes(size) ? size : 'large';
  }

  /** The entity (a light group's members too), its readouts, and what its last change is read from (`since`). */
  protected override watched(): readonly string[] {
    return withMembers(
      [
        this.config?.entity ?? '',
        ...(this.config?.readouts ?? []),
        ...sinceIds(this.config ? [this.config] : []),
      ],
      this.hass,
    );
  }

  /**
   * What the foot ruler sets for this entity, if anything (`ruled`): a light's brightness, a cover's position, a fan's
   * speed — each awake while the entity is on (`lit`) — a player's volume while the player is on, and a number's
   * value always, lit from its zero where its range is signed.
   */
  protected level(view: EntityView, lit: boolean): TileLevel | null {
    if (!ruled(view)) return null;
    const percent = (value: number, label: string, commit: (value: number) => void): TileLevel => ({
      value,
      scale: PERCENT,
      ticks: ticksOf(PERCENT, TILE_TICKS),
      label,
      text: `${scaleText(this.hass, PERCENT, value)} %`,
      awake: lit,
      quiet: false,
      wakes: true,
      commit,
    });
    const set = (value: number): void => {
      const [domain, service, data] = setCall(view, value);
      this.call(domain, service, data, view.id);
    };
    switch (view.domain) {
      case 'light': {
        const brightness = view.attr<number>('brightness');
        return percent(
          brightness ? Math.round((brightness / 255) * 100) : 0,
          this.t('light.brightness'),
          (v) => this.call('light', 'turn_on', { brightness_pct: v }, view.id),
        );
      }
      case 'cover':
        return percent(view.attr<number>('current_position') ?? 0, this.t('cover.position'), (v) =>
          this.call('cover', 'set_cover_position', { position: v }, view.id),
        );
      case 'fan':
        return percent(readingOf(view) ?? 0, this.t('fan.speed'), set);
      case 'media_player':
        return {
          ...percent(readingOf(view) ?? 0, this.t('common.volume'), set),
          awake: !playerOff(this.stateOf(view)),
          quiet: view.attr<boolean>('is_volume_muted') === true,
          wakes: false,
        };
    }
    // a number or a helper: `ruled` found its range
    const scale = numberScale(view) as Scale;
    const value = view.number ?? scale.min;
    return {
      value,
      scale,
      ticks: ticksOf(scale, TILE_TICKS),
      label: this.t('helpers.value'),
      text: [scaleText(this.hass, scale, value), scale.unit].filter(Boolean).join(' '),
      awake: true,
      quiet: false,
      wakes: false,
      commit: set,
    };
  }

  /** Whether a lit tile's line says its level ("On · 70 %"): the room lights card asks it not to (`show_level`). */
  protected showsLevel(): boolean {
    return true;
  }

  /**
   * The line under the name. State is said once: when the head already shows the reading (a sensor
   * on a large tile), this line carries context — the room, or when it last moved — never the same
   * figure again. A small tile has no head figure, so there the reading IS the line. A number's figure is its
   * ruler's ("−1.0 °C", with a minus): a large tile's line says the room and it ("Living room · −1.0 °C"; the figure
   * alone where both do not hold, `keepsFigure`), a small tile's the figure. A muted player says so before its volume
   * ("Muted · 30 %"), as the Slider card's tile does. `on`: the entity is on (what its switch says, whatever the
   * tile's fill does).
   */
  protected tileLine(
    item: TileItem,
    view: EntityView,
    on: boolean,
    level: TileLevel | null,
    valueInHead: boolean,
    small = false,
  ): string {
    // when it last changed, as the tile's `since` says where that reads (#67)
    const changed = changedAt(this.hass, view, item.since);
    if (view.status !== 'ok') {
      // a small tile has room for the word, not for "· 16 h ago" as well
      const ago = changed && !small ? ` · ${relativeTime(this.hass, changed)}` : '';
      return `${stateText(this.hass, view)}${ago}`;
    }
    if (valueInHead) {
      if (view.areaName) return view.areaName;
      return changed ? relativeTime(this.hass, changed) : '';
    }
    if (level && NUMBERS.has(view.domain))
      return small ? level.text : [view.areaName, level.text].filter(Boolean).join(' · ');
    if (on && level?.quiet) return `${this.t('common.muted')} · ${level.text}`;
    const text = stateText(this.hass, view);
    return on && level && level.value > 0 && this.showsLevel() ? `${text} · ${level.text}` : text;
  }

  /**
   * Whether a large tile's line keeps its ruler's figure where the whole line does not hold, the words before it giving
   * way ("Living room · −1.0 °C", else "−1.0 °C"): a number's, whose figure is its state. A lit light's level and a
   * playing player's volume are the ones to go, their state ("On", "Playing") being what their line says first.
   */
  protected keepsFigure(view: EntityView): boolean {
    return NUMBERS.has(view.domain);
  }

  /**
   * What a thermostat's tile says on its line where it is asked (`show_action`, #185: its own, else its card's), a
   * climate or a humidifier that can be read: what it is doing and what it is set to (`doingLine`, in the Thermostat
   * card's chunk), a window sensor on its device followed while it is read. None for any other tile, and until the
   * reading has landed: its line is its state's, as before.
   */
  protected doing(item: TileItem, view: EntityView): TileDoing | null {
    if (
      !(item.show_action ?? this.config?.show_action) ||
      view.status !== 'ok' ||
      !/^(climate|humidifier)$/.test(view.domain)
    )
      return null;
    const reading = doingReading(this);
    if (!reading) return null;
    this.follows(reading.windowSensor(this.hass, view.id));
    return reading.doingLine(this, view, this.stateOf(view));
  }

  /** Widths laid out by the browser in the tile's own classes (a mini's 12 px, a compact's 13), never guessed. */
  private readonly ruler = new TextRuler(() => this.renderRoot as ParentNode | undefined);

  constructor() {
    super();
    // a web font arriving changes every width: measure afresh and lay the small tiles out again
    new FontsSettled(this, () => {
      this.ruler.clear();
      this.requestUpdate();
    });
  }

  /**
   * A tile's state line fitted to its tile: what does not fit loses its " · " segments from the end (a large tile's
   * "· 11 days ago", a small one's reading); a reading that does not fit alone says itself in the first of its shorter
   * forms that does ("5.1M queries", "12 days ago": `shorterForms`, #93); a word that cannot fit at all is a dash or
   * nothing (`dash`) — never a cut. The room is the tile's width less its sides (16 on a large or compact tile, 12 on a
   * mini, or what a narrower mini can spare around its 44 circle) and, where the line sits beside the circle (a large
   * tile's off skin, a compact one 128 or wider, an inner one 136 or wider), the circle and its gap; a compact tile's
   * rocker takes its plate and its gap too.
   */
  private fitState(line: string, size: TileSize, view: EntityView, fit: LineFit = {}): string {
    const {
      dash = false,
      inside = false,
      under = false,
      words = false,
      figure,
      plated,
      forms,
    } = fit;
    const width = Math.floor(this.tileWidth());
    const small = size !== 'large';
    const mini = size === 'mini';
    const sides = mini ? (width < 68 ? Math.max(8, Math.floor((width - 44) / 2)) : 12) : 16;
    // a compact tile under 128 (an inner one under 136, one with its rocker under 228) hides its circle (tiles.css)
    // and gives the words its room; its rocker takes its plate and 12 of air at the row's end
    const beside =
      !mini && !under && (size === 'large' || width >= (plated ? PLATE_CIRCLE : inside ? 136 : 128))
        ? 44 + 12
        : 0;
    const room = width - 2 * sides - beside - (plated ? PLATE + 12 : 0);
    const cls = small ? `fv-tile fv-tile--${size} > fv-tile__state` : 'fv-tile > fv-tile__state';
    const measure = (text: string): number => this.ruler.width(cls, text);
    // a line that ends in the figure it keeps loses the words before it, whole, and never the figure
    const keeps = figure !== undefined && line.endsWith(` · ${figure}`);
    const segments: Segment[] = keeps
      ? [{ text: line.slice(0, -` · ${figure}`.length), optional: true }, { text: figure }]
      : line.split(' · ').map((text, index) => ({ text, optional: index > 0 }));
    const fitted = fitLine(segments, room, measure);
    if (fitted && (words || measure(fitted) <= room)) return fitted;
    // the reading the line begins with (the figure it keeps, else the state), shorter; none for a line that begins
    // with anything else (a room, a time)
    const text = figure ?? stateText(this.hass, view);
    const shorter =
      forms ?? (segments[0]?.text === text ? shorterForms(this.hass, view, text) : []);
    return shorter.find((form) => measure(form) <= room) ?? (dash ? '—' : '');
  }

  /** The reading of the first readout ("142 W"), for a small tile's state line. */
  private readoutText(item: TileItem): string {
    const id = item.readouts?.[0];
    if (!id) return '';
    const view = this.entity(id);
    if (view.status !== 'ok') return '';
    const parts = valueParts(this.hass, view);
    return parts.unit ? `${parts.value} ${parts.unit}` : parts.value;
  }

  private flip(view: EntityView, next: boolean): void {
    if (!this.hass) return;
    this.expect(
      view.id,
      next
        ? view.domain === 'cover'
          ? 'open'
          : view.domain === 'lock'
            ? 'unlocked'
            : 'on'
        : view.domain === 'cover'
          ? 'closed'
          : view.domain === 'lock'
            ? 'locked'
            : 'off',
    );
    void toggleEntity(this.hass, view.id);
  }

  /**
   * Runs a tile action; a toggle goes through the optimistic flip so the fill answers under the finger — unless it
   * is to be asked about first: then nothing moves before the answer.
   */
  private act(view: EntityView, on: boolean, action: ActionConfig): void {
    if (action.action === 'toggle' && !action.entity && !action.confirmation) this.flip(view, !on);
    else this.tap(view.id, action);
  }

  /**
   * The wall rocker in the switch's place (`switch_style: rocker`), drawn by its chunk; until that lands, its box
   * alone, so nothing moves when it does.
   */
  private plate(
    view: EntityView,
    lit: boolean,
    tone: Tone,
    label: string,
    usable: boolean,
  ): TemplateResult {
    if (plates)
      return plates.plate(
        this.renderRoot,
        this.hass,
        view,
        this.stateOf(view),
        lit,
        tone,
        label,
        usable,
        (next) => this.flip(view, next),
        (service, state) => {
          this.expect(view.id, state);
          this.call(view.domain, service, {}, view.id);
        },
      );
    void (fetchingPlates ??= import('./rocker.js').then(
      (module) => (plates = module),
      () => (plates = null),
    )).then(() => this.requestUpdate());
    return html`<span class="fv-hit fv-hit--rocker"></span>`;
  }

  protected renderCard(): TemplateResult {
    const config = this.config as TileCardConfig & { entity: string };
    return this.renderTile(config, this.size());
  }

  /** Whether the entity is on: as Home Assistant says, or as a flip just asked until it answers. */
  private lit(view: EntityView): boolean {
    const state = this.stateOf(view);
    return (
      isUsable(view) &&
      (state === view.state
        ? isActive(view)
        : !['off', 'closed', 'locked', 'idle', 'docked', 'paused'].includes(state))
    );
  }

  /** What the tile shows of its entity: its name, its icon, its skin; `lit`, whether the entity is on. */
  protected look(item: TileItem, view: EntityView, lit: boolean): TileLook {
    const name = this.nameFor(view, item.name);
    return {
      name,
      label: name,
      glyph: iconOf(view, item.icon),
      usable: isUsable(view),
      on: lit,
      tone: statusToneOf(item, toneFor(view)),
    };
  }

  /**
   * What a lit light's bulb glows on its tile (`litColour`: its whites as the card asks, a group its members'), where
   * the card shows bulbs' colours (`light_colors`, 1.9; the house's choice where the card says none).
   */
  protected glow(view: EntityView, on: boolean): string | undefined {
    const config = this.config;
    return (config?.light_colors ?? lightDefaults().colors)
      ? litColour(view, on, config?.light_whites, this.hass)
      : undefined;
  }

  /**
   * What ends a large tile's head beside its circle where a card built on the tile says so (the Slider card's control:
   * a player's mute, another entity's switch, none); without it, the tile's own — its switch, else its reading.
   */
  protected headControl?(
    view: EntityView,
    lit: boolean,
    tone: Tone,
    label: string,
    usable: boolean,
  ): TemplateResult | typeof nothing;

  /** The width one tile gets: the card's own (a tiles group divides its width). */
  protected tileWidth(): number {
    return this.width;
  }

  /** Whether the name reads whole at the large tile's 16/600 (2 px of margin for a fallback face). */
  private nameFits(name: string): boolean {
    const family = getComputedStyle(this).fontFamily;
    return textWidth(name, `600 16px ${family}`) <= this.tileWidth() - 32 - 2;
  }

  /**
   * One tile of the given size — the single card, or each item of a tiles group. `inside`: the tile sits inside a
   * card (a room's controls): an inner tile, 84 tall, the control radius, page fill, no hairline.
   */
  protected renderTile(item: TileItem, size: TileSize, inside = false): TemplateResult {
    const view = this.entity(item.entity);
    const small = size !== 'large';
    const sizeClass = small
      ? ` fv-tile--${size}${inside ? ' fv-tile--inner' : ''}${twoLines(this.config) ? ' fv-tile--lines' : ''}`
      : '';

    // a missing or unreachable entity wears the off skin on the live tile's own anatomy and size — the ban circle, the
    // name, its state line, a dash in every reading, a switch that does not move: only the colours change, so it never
    // stands shorter than its neighbours; quiet (`unavailable`), the tile at rest with its own glyph, the same words and
    // dashes. An unknown one is a live tile whose word is "Unknown". Its switch, its ruler and its flip follow the entity
    // (`lit`), its fill its look (`on`): the template card may tell them apart.
    const lit = this.lit(view);
    const quiet = this.unavailableOf(item) === 'quiet';
    const {
      name,
      label,
      glyph: icon,
      usable,
      on,
      tone: kindTone,
      words,
    } = this.look(item, view, lit);
    // a light wears what the rule every light follows says (`lightLook`: in a group, the card's colour and tone come
    // after its bulb's); anything else its own colour, else its look's tone (a warning stays one)
    const [colour, tone] =
      view.domain === 'light'
        ? lightLook(
            item,
            item === this.config ? undefined : this.config,
            usable ? this.glow(view, on) : undefined,
          )
        : ([item.color, kindTone] as const);
    // its colour sits on its article, where the card's own (written by the base) is not already it
    const accent = this.accents.item(colour === this.config?.color ? undefined : colour);
    const canToggle = TOGGLE_DOMAINS.has(view.domain);
    const shows = switchOf(item, this.config);
    // asked for a wall rocker where it shows its switch (`switch_style`, #177), a tile switches and nothing more: no
    // ruler at its foot, no level on its line (a card that ends its head otherwise, the Slider card, has no switch)
    const rocker =
      canToggle &&
      shows === true &&
      !this.headControl &&
      plates !== null &&
      (item.switch_style ?? this.config?.switch_style) === 'rocker';
    const level = rocker ? null : this.level(view, lit);
    // a number's line (the Slider's tile's) gives way from its words, never its figure: where it does not hold whole,
    // the figure alone
    const figure = level && !words && this.keepsFigure(view) ? level.text : undefined;
    const told = this.doing(item, view);
    const sensorLike = view.domain === 'sensor' || view.domain === 'binary_sensor' || !canToggle;
    const iconTone =
      currentTone(view, on ? tone : 'accent') === 'neutral' ? 'accent' : on ? tone : 'accent';
    // a tile keeps its colour at rest when the card asks (`tint: always`): one with a colour (its own, the card's)
    // that colour's rest wash and the fill's hairline, any other its tone's, as a light card's at rest — never a
    // status's: a shut door or a clear smoke alarm at rest is not a warning (`washesAtRest`)
    const rest = usable && !on && this.config?.tint === 'always';
    const coloured = Boolean(accent || this.config?.color);
    const tinted = rest && coloured ? ' is-tinted' : '';
    const surface = rest && !coloured && washesAtRest(tone) ? this.accents.lit(tone, 0) : nothing;
    const classes = usable
      ? `fv-tile fv-tile--${tone} fv-tile--tap${sizeClass}${tinted} ${on ? 'is-on' : ''}`
      : `fv-tile fv-tile--off fv-tile--tap${sizeClass}`;
    // what cannot be read cannot be switched: its tap opens the details, its toggle (if asked) goes to Home Assistant;
    // a tap, a hold and a double tap of the tile all run so, in every size
    const runs = (action: ActionConfig | undefined): (() => void) | undefined =>
      action && actionRuns(action, view.id)
        ? () => (usable ? this.act(view, lit, action) : this.tap(view.id, action))
        : undefined;
    const holdNow = runs(item.hold_action ?? MORE_INFO);
    const doubleNow = runs(item.double_tap_action);
    // its circle answers what the tile says of it (#179), a button of its own then; else, where it is the tile's switch
    // (`flips`), it flips it, as it did
    const circle = (flips: boolean): TemplateResult => {
      const isSwitch = flips && !item.icon_tap_action;
      const { onTap, onHold } = this.pressOf(
        item,
        view.id,
        flips ? () => this.flip(view, !lit) : null,
        null,
        'icon_',
      );
      return ico(usable || quiet ? icon : 'ban', usable || quiet ? iconTone : 'off', {
        onTap,
        onHold,
        label: isSwitch ? label : this.t('common.icon_of', { name: label }),
        checked: isSwitch ? lit : undefined,
      });
    };

    if (small) {
      // a compact tile's rocker stands at its row's end, where the tile holds it
      const plated = rocker && size === 'compact' && Math.floor(this.tileWidth()) >= PLATE_ROOM;
      // the whole tile is the button (laid over it) where it has something to run: tap toggles what toggles (opens
      // what does not, and a tile whose rocker is its switch, as a large tile), hold opens the details; a tap waits for
      // a second where a double tap is set (#179)
      const tapNow = this.tapper(
        item.double_tap_action,
        view.id,
        runs(item.tap_action ?? (usable && canToggle && !plated ? TOGGLE : MORE_INFO)),
        doubleNow,
      );
      let line = told?.line ?? this.tileLine(item, view, lit, level, false, true);
      const reading = usable ? this.readoutText(item) : '';
      if (reading) line = `${line} · ${reading}`;
      line = this.fitState(line, size, view, {
        dash: !usable,
        inside,
        words,
        figure,
        plated,
        forms: told?.forms,
      });
      return html`<article
        class=${classes}
        data-card
        data-accent=${(usable && accent) || nothing}
        data-surface=${surface}
        data-unavailable=${quiet ? 'quiet' : nothing}
      >
        ${circle(false)}
        <div class="fv-tile__text">
          <h3 class="fv-tile__name">${name}</h3>
          <p class="fv-tile__state" data-name=${words ? '' : nothing}>${line}</p>
        </div>
        ${plated ? this.plate(view, lit, tone, label, usable) : nothing}
        ${tapNow || holdNow ? pressCover(label, tapNow, holdNow) : nothing}
      </article>`;
    }

    // everything in a large tile is drawn to its inner width (its own less 16 px sides): a tile squeezed narrow
    // folds its switch into the icon circle, gives its value to the state line, keeps one readout
    const inner = Math.floor(this.tileWidth()) - 32;
    // what ends the head is drawn at 16/600: it holds where it fits beside the circle
    const face = `600 16px ${getComputedStyle(this).fontFamily}`;
    const holds = (text: string): boolean => HEAD_LEAD + textWidth(text, face) <= inner;
    // a tile of nothing (a template card without an entity) has no reading, and one whose foot sets it (a number) says
    // it on its line; a climate that says what it is doing on its line ends its head with what it measures
    const measured = told && !canToggle ? numberAttr(view, 'current_temperature') : null;
    const parts =
      measured !== null
        ? {
            value: formatNumber(this.hass, measured, { digits: 1 }),
            unit: this.hass?.config.unit_system.temperature ?? '°C',
          }
        : sensorLike && item.entity && !level
          ? valueParts(this.hass, view)
          : null;
    const valueInHead = parts !== null && holds(`${parts.value} ${parts.unit}`.trim());
    // a card built on the tile may end its head otherwise (the Slider card's control); else the tile's switch, apart
    // where the tile is asked to show it (`show_switch`) and holds it beside its circle (a rocker's plate down to 84)
    // — else its circle is the switch
    const control = this.headControl?.(view, lit, tone, label, usable);
    const switches = control === undefined && canToggle;
    const switchApart =
      switches && shows === true && inner >= (rocker ? HEAD_LEAD + PLATE : HEAD_ROOM);
    const lead = circle(usable && switches && !switchApart);
    const line = told?.line ?? this.tileLine(item, view, lit, level, valueInHead);
    // its level's figure in the switch's place (`show_switch: value`): the one its line ends in ("On · 70 %") goes up
    // to the head's end, as a sensor's reading stands there, and the line keeps the state alone — where the scale's
    // widest figure holds beside the circle, so a level never moves its figure from one to the other
    const said = switches && shows === 'value' && level ? ` · ${level.text}` : '';
    const raised =
      level &&
      said &&
      line.endsWith(said) &&
      holds(`${scaleText(this.hass, level.scale, level.scale.max)} ${level.scale.unit}`.trim())
        ? level
        : null;
    const trailing =
      control !== undefined
        ? control
        : switchApart
          ? rocker
            ? this.plate(view, lit, tone, label, usable)
            : toggle(lit, tone, (next) => this.flip(view, next), label, !usable)
          : raised
            ? headValue(scaleText(this.hass, raised.scale, raised.value), raised.scale.unit)
            : parts && valueInHead
              ? headValue(parts.value, parts.unit)
              : nothing;

    // the tile's button is laid over it, under its controls (the switch, a circle that is one, the ruler): a tap runs
    // the tap action, a still press the hold action, two taps the double tap — never a switch inside a button
    const tapNow = this.tapper(
      item.double_tap_action,
      view.id,
      runs(item.tap_action ?? MORE_INFO),
      doubleNow,
    );

    // the slider's style (1.18, #144): the ruler at the foot (knob 28), a bar or a liquid drawing the foot's 40 of the
    // finger's 44 band, or the fill — the tile itself, its ruler covering it and drawing the wash to the level under
    // the words, the foot free for the readouts; a still press on it is the tile's tap or hold, which the ruler says (`fluvy-tap`, `fluvy-hold`)
    const style = level ? sliderStyleOf(this.config, true) : 'ruler';
    const fill = level !== null && style === 'fill';
    const slider = (level: TileLevel, length: number): TemplateResult => {
      // a number's knob is always up, a player's while it is on; a muted player's volume stands in neutral
      const { scale, ticks, awake } = level;
      return html`<fluvy-ruler
        class=${awake ? '' : 'fv-ruler--off'}
        ?on-fill=${on}
        .value=${awake ? level.value : scale.min}
        .min=${scale.min}
        .max=${scale.max}
        .step=${scale.step}
        .origin=${scale.origin}
        .length=${length}
        .band=${fill ? 168 : 44}
        .face=${40}
        .knob=${28}
        .minor=${ticks.minor}
        .major=${ticks.major}
        .tone=${awake && !level.quiet ? tone : 'neutral'}
        .look=${style}
        ?still=${sliderStill()}
        ?inactive=${!awake}
        ?wake=${usable && level.wakes}
        ?disabled=${fill && !usable}
        ?inert=${!fill && !usable}
        unit=${scale.unit}
        .label=${`${label} · ${level.label}`}
        .format=${(v: number) => scaleText(this.hass, scale, v)}
        @fluvy-input=${(e: CustomEvent<RulerChangeDetail>) => level.input?.(e.detail.value)}
        @fluvy-change=${(e: CustomEvent<RulerChangeDetail>) => level.commit(e.detail.value)}
        @fluvy-cancel=${() => level.cancel?.()}
        @fluvy-tap=${tapNow}
        @fluvy-hold=${holdNow}
      ></fluvy-ruler>`;
    };

    let foot: TemplateResult | typeof nothing = nothing;
    if (level && !fill) {
      foot = slider(level, Math.max(24, inner));
    } else if (item.readouts?.length) {
      const stats = item.readouts.map((id) => {
        const r = this.entity(id);
        const p = valueParts(this.hass, r);
        const short =
          r.deviceClass === 'power'
            ? this.t('energy.power')
            : r.deviceClass === 'energy'
              ? this.t('energy.today')
              : r.deviceClass === 'monetary'
                ? this.t('energy.cost')
                : r.name.replace(name, '').trim() || r.name;
        return { label: short, value: p.value, unit: p.unit };
      });
      // two share the foot as 46 % and 54 % (64 and 76 in a 172 tile), three equal thirds, while every label and every
      // reading holds its cell (fr's "PUISSANCE" and "AUJOURD'HUI" do not on a phone, de's "LEISTUNG" and a "0.8 kWh"
      // not in half a section): else the first has the foot to itself
      const cells = (n: number): number[] =>
        n === 2 ? [inner * 0.46, inner * 0.54] : Array<number>(n).fill(inner / n);
      const holds = (n: number): boolean =>
        stats.slice(0, n).every(({ label, value, unit }, i) => {
          const cell = cells(n)[i] ?? 0;
          return (
            this.ruler.width('fv-readout__label', label) <= cell &&
            this.ruler.width(
              'fv-readout fv-readout--xs > fv-readout__value',
              value,
              'fv-unit',
              unit,
            ) <= cell
          );
        });
      const shown = Math.min(
        stats.length,
        inner >= THREE_READOUTS && holds(3) ? 3 : inner >= TWO_READOUTS && holds(2) ? 2 : 1,
      );
      foot = html`<div
        class="fv-tile__foot ${shown === 1 ? 'fv-tile__foot--one' : shown === 3 ? 'fv-tile__foot--three' : ''}"
      >
        ${stats.slice(0, shown).map((stat) => readout({ ...stat, size: 'xs' }))}
      </div>`;
    }

    return html`<article
      class=${`${classes}${fill ? ' fv-tile--fill' : ''}${foot === nothing ? ' fv-tile--footless' : this.nameFits(name) ? '' : ' fv-tile--tight'}`}
      data-card
      data-accent=${(usable && accent) || nothing}
      data-surface=${surface}
      data-unavailable=${quiet ? 'quiet' : nothing}
    >
      ${fill ? slider(level, Math.floor(this.tileWidth())) : nothing}
      <div class="fv-tile__head">${lead}${trailing}</div>
      <h3 class="fv-tile__name">${name}</h3>
      <p class="fv-tile__state" data-name=${words ? '' : nothing}>
        ${this.fitState(raised ? line.slice(0, -said.length) : line, size, view, {
          dash: !usable,
          inside,
          under: true,
          words,
          figure,
          forms: told?.forms,
        })}
      </p>
      ${foot} ${tapNow || holdNow ? pressCover(label, tapNow, holdNow) : nothing}
    </article>`;
  }
}
