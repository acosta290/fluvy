import {
  areaContents,
  areaIndex,
  climateAttribute,
  formatNumber,
  holdsSomething,
  idsOf,
  isActive,
  isUsable,
  listOf,
  navigate,
  numberAttr,
  plural,
  textName,
  withTextName,
  type ActionConfig,
  type AreaContents,
  type AreaRegistryEntry,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { addGlyphs, head, ico, icon, pressCover, sheetStyles, type Tone } from '@fluvy/ui';
import { ROOM_GLYPHS, ROOM_ICONS } from '@fluvy/ui/glyph-sets/rooms';
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import { HeadFit } from '../energy/head.js';
import { roomReading } from '../room/room-card.js';
import { houseRooms, roomCount, roomEntries, roomsHeight } from '../rooms-family.js';
import { Card, type CardEditor } from '../shared/base.js';
import { toneOf, type LightColours } from '../shared/colour.js';
import { counted } from '../shared/counted.js';
import { fitLine } from '../shared/fit.js';
import { withMembers } from '../shared/light.js';
import { roundsRows, type RoundsRowSpec } from '../shared/rounds-row.js';
import {
  answered,
  roundsIn,
  roundsOf,
  type RoundGroup,
  type RoundSpec,
  type RoundsHost,
} from '../shared/rounds.js';
import { roomsDashboard } from './pages.js';

// a room is drawn by what it is for: the set's rooms join the glyphs as the card's chunk lands
addGlyphs(ROOM_GLYPHS);

/** `rows` (default): a 60 row a room. `compact`: a 48 one, its temperature at its end. `tiles`: two a row. */
export type RoomsVariant = 'rows' | 'compact' | 'tiles';
export const ROOMS_VARIANTS: readonly RoomsVariant[] = ['rows', 'compact', 'tiles'];

/** What a room's rounds stand for where it names none of its own: one of its sets, or its thermostat. */
export type RoomsAction = RoundGroup | 'climate';
export const ROOMS_ACTIONS: readonly RoomsAction[] = [
  'lights',
  'climate',
  'covers',
  'fans',
  'media',
];

/** One room: its area, and its own name, icon, colour, readings, rounds, page and actions. */
export interface RoomEntry {
  area: string;
  name?: string;
  icon?: string;
  tone?: Tone;
  color?: string;
  /** Its temperature, a sensor or a thermostat; default: the area's (`areaClimate`). */
  temperature_entity?: string;
  /** Its humidity, a sensor, a thermostat or a humidifier; default: the area's. */
  humidity_entity?: string;
  /** Its rounds, in order: its `lights`, `covers`, `fans`, `media`, its `climate`, or an entity (default: the card's). */
  quick_actions?: readonly (string | RoundSpec)[];
  /** Where it opens, before its page on the automatic dashboard. */
  path?: string;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

export interface RoomsCardConfig extends FluvyCardConfig, LightColours {
  /** The rooms, in order: areas' ids, or entries of their own; none, every area with something to show. */
  rooms?: readonly (string | RoomEntry)[];
  /** The rounds of every room that names none of its own (default: none). */
  default_actions?: readonly RoomsAction[];
  variant?: RoomsVariant;
  /** The head: its title, its icon and its line, "5 rooms · 21.2° average" (default). */
  show_head?: boolean;
  title?: string;
  /** The rooms' average temperature in the head's line (default). */
  show_average?: boolean;
  /** Each room's temperature and humidity (default). */
  show_climate?: boolean;
  /** Each room's "3 of 5 on" (default: none). */
  show_count?: boolean;
  /** The chevrons that say a room opens, and the head's where it opens every room (default). */
  show_arrow?: boolean;
  /** The rooms drawn at most, in their order. */
  max_rooms?: number;
}

/**
 * A room as the card draws it: its entry, its area (its name as text; none where the house has no such area), what
 * it holds, its readings and the rounds it can draw.
 */
interface Room {
  readonly own: RoomEntry;
  readonly area: AreaRegistryEntry | undefined;
  readonly name: string;
  readonly glyph: string;
  readonly contents: AreaContents | undefined;
  readonly lights: readonly string[];
  readonly temperature: string | undefined;
  readonly humidity: string | undefined;
  readonly rounds: readonly RoundSpec[];
}

/** The head's circle and the 12 after it, and its chevron's room: its 44 and the 12 before it, less the 8 past the edge. */
const CIRCLE = 56;
const ARROW = 48;
/** A room's circle in its tile, and the 16 a tile has at each side. */
const HERO = 64;
const TILE_SIDES = 32;
/** The tiles stand two a row in a column this wide and wider, one a row under it. */
const TILES_TWO = 320;

/** A room's glyph: its own icon, else its area's as Fluvy draws that kind of room (`mdi:sofa`, a sofa), else home. */
const glyphOf = (own: RoomEntry, area: AreaRegistryEntry | undefined): string =>
  own.icon ?? (area?.icon ? (ROOM_ICONS[area.icon] ?? area.icon) : 'home');

/** A reading as a compact surface writes it: degrees with their sign alone ("21.4°"), a percent with its space. */
const short = ({ value, unit }: { value: string; unit: string }): string =>
  unit.startsWith('°') ? `${value}°` : `${value} ${unit}`.trim();

/**
 * Every room in one card (#225, requested by @xoatrash): a row each — the room's glyph, its name, its temperature and
 * humidity, and its rounds at its end — or a tile each; a tap opens the room's page on the automatic dashboard, its
 * own path, or the area's settings for an administrator. Its rooms are the house's, in its order, or its own list.
 */
export class FluvyRoomsCard extends Card<RoomsCardConfig> {
  /** The card's height at a 360 column from its config alone (`roomsHeight`): four rooms where it lists none. */
  static override layoutHeight(config: RoomsCardConfig): number {
    return roomsHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.rooms,
    css`
      /* a row each: 8 under the head as every list, else 8 into the card's padding at each end */
      .rs-rows {
        margin-top: 8px;
      }
      .rs-rows--bare {
        margin: -8px 0;
      }
      .fv-card__head + .rs-tiles,
      .fv-card__head + .fv-empty-state {
        margin-top: 16px;
      }
      /* the tiles on whole pixels, two a row (the card computes them: 156 + 8 + 156 in 320), the odd pixels between
         them; an odd last one takes the row */
      .rs-tiles {
        display: grid;
        grid-template-columns: repeat(var(--rs-cols, 1), var(--rs-col, minmax(0, 1fr)));
        gap: 8px var(--rs-gap, 8px);
      }
      .rs-span {
        grid-column: 1 / -1;
      }
      /* a room's tile: an inner tile's surface (the page's fill, the control radius, no hairline), its circle and
         its rounds on one line, its name and its line under them */
      .rs-tile {
        position: relative;
        display: flex;
        flex-direction: column;
        min-width: 0;
        height: 144px;
        padding: 16px;
        box-sizing: border-box;
        border-radius: var(--fluvy-radius-control);
        background: var(--fluvy-inset, var(--fluvy-page));
        box-shadow: none;
      }
      .rs-tile__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 64px;
      }
      /* its rounds over its button, a press on one the round's: the tile does not give under it */
      .rs-tile__top > .rm-quick {
        position: relative;
        z-index: 1;
      }
      .rs-tile:has(.lt-bulb:active) {
        scale: none;
      }
      /* at rest on the page's fill, its circle and its rounds are the card's fill (a pastel circle there reads lit) */
      .rs-tile:not(.is-on) > .rs-tile__top > .fv-ico,
      .rs-tile .lt-bulb:not(.is-on) {
        background: var(--fluvy-card);
        color: var(--fluvy-text);
        box-shadow: none;
      }
      .rs-tile__name {
        margin: 12px 0 0;
        overflow: hidden;
        font-size: 15px;
        font-weight: 600;
        line-height: 20px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rs-tile__line {
        margin: 0;
        overflow: hidden;
        font-size: 13px;
        font-weight: 500;
        line-height: 16px;
        color: var(--fluvy-text-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
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
    return import('./rooms-editor.js');
  }

  static getStubConfig(): RoomsCardConfig {
    // the house's rooms, each with its lights' and its thermostat's rounds
    return { type: 'custom:fluvy-rooms-card', default_actions: ['lights', 'climate'] };
  }

  protected override prepare(config: RoomsCardConfig): RoomsCardConfig {
    listOf(config, 'rooms');
    listOf(config, 'default_actions');
    return config;
  }

  private get variant(): RoomsVariant {
    const asked = this.config?.variant;
    return asked && ROOMS_VARIANTS.includes(asked) ? asked : 'rows';
  }

  private held?: {
    readonly hass: HomeAssistant;
    readonly config: RoomsCardConfig;
    readonly rooms: readonly Room[];
    readonly listed: number;
  };

  /**
   * The rooms as drawn, worked out once a house and config: those the config lists, else every area with something to
   * show in the house's order (`houseRooms`), `max_rooms` at most; and how many it lists in all.
   */
  private rooms(): { readonly rooms: readonly Room[]; readonly listed: number } {
    const { hass, config } = this;
    if (!hass || !config) return { rooms: [], listed: 0 };
    if (this.held?.hass === hass && this.held.config === config) return this.held;
    const entries: RoomEntry[] = Array.isArray(config.rooms)
      ? roomEntries(config.rooms).map((entry) =>
          typeof entry === 'string' ? { area: entry } : (entry as RoomEntry),
        )
      : houseRooms(hass).map((area) => ({ area: area.area_id }));
    const most = roomCount(config, entries.length);
    const rooms = entries.slice(0, most).map((own) => this.roomOf(hass, own));
    this.held = { hass, config, rooms, listed: entries.length };
    return this.held;
  }

  /** A room of the house: its area, what it holds, its readings (its own, else the area's) and its rounds. */
  private roomOf(hass: HomeAssistant, own: RoomEntry): Room {
    const found = hass.areas?.[own.area];
    const area = found && withTextName(found);
    const contents = area ? areaContents(hass, own.area) : undefined;
    const devices = contents?.devices ?? [];
    const lights = devices.filter((id) => id.startsWith('light.'));
    // its rounds: its own, else the card's; its `climate` its first thermostat, by its word or with its own say
    const asked: unknown[] =
      own.quick_actions === undefined
        ? [...(this.config?.default_actions ?? [])]
        : [own.quick_actions].flat();
    const thermostat = devices.find((id) => id.startsWith('climate.'));
    const entries = asked.flatMap((entry) => {
      const said = typeof entry === 'object' && entry !== null ? (entry as RoundSpec) : undefined;
      if (entry !== 'climate' && (said?.group as string | undefined) !== 'climate') return [entry];
      if (!thermostat) return [];
      return [said ? { ...said, group: 'entity', entity: thermostat } : thermostat];
    });
    return {
      own,
      area,
      name: textName(own.name) ?? area?.name ?? own.area,
      glyph: glyphOf(own, area),
      contents,
      lights,
      temperature: own.temperature_entity ?? contents?.climate.temperature,
      humidity: own.humidity_entity ?? contents?.climate.humidity,
      rounds: roundsOf({ hass, devices, lights }, entries),
    };
  }

  protected override watched(): readonly string[] {
    const { hass } = this;
    if (!hass) return [];
    // every entity a room holds, shown or not (one whose state comes late fills it), its readings and its rounds
    const index = areaIndex(hass);
    return withMembers(
      this.rooms().rooms.flatMap((room) => [
        ...(index.get(room.own.area) ?? []),
        ...idsOf([room.temperature, room.humidity, ...room.rounds]),
      ]),
      hass,
    );
  }

  override getCardSize(): number {
    // its height in Home Assistant's rows of 50, its rooms the house's where it lists none
    return Math.max(
      1,
      Math.ceil(roomsHeight(this.config ?? { type: '' }, this.rooms().listed) / 50),
    );
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /**
   * Where a room opens: its own path, else its page on the automatic dashboard (`roomsDashboard`, where the room has
   * one: something to show), else the area's settings for an administrator; nowhere for anyone else.
   */
  private destination(room: Room): string | undefined {
    if (room.own.path) return room.own.path;
    if (!room.area) return undefined;
    const pages = roomsDashboard(this.hass, () => this.requestUpdate());
    if (pages && room.contents && holdsSomething(room.contents))
      return `${pages.base}/room-${room.own.area}`;
    return this.hass?.user?.is_admin ? `/config/areas/area/${room.own.area}` : undefined;
  }

  /**
   * What a room's rounds reach of the card: the room's devices and lights, where it opens, and the card's look with
   * the room's own tone and colour over it (its lights' round wears them where the house shows no bulb's colour). A
   * round's tap flips what is safe to flip where it names none, a lock asking before it unlocks (`ROUND_TOGGLE`); the
   * rest open their details.
   */
  private host(room?: Room): RoundsHost {
    const config = this.config;
    return {
      hass: this.hass,
      look: config && {
        ...config,
        ...(room?.own.tone ? { tone: room.own.tone } : {}),
        ...(room?.own.color ? { color: room.own.color } : {}),
      },
      devices: room?.contents?.devices,
      lights: room?.lights,
      state: (view) => this.stateOf(view),
      expect: (id, state) => this.expect(id, state),
      call: (domain, service, data) => this.call(domain, service, data, ''),
      run: (action, entity) => this.tap(entity, action),
      tapper: (of, at, tap, double) => this.tapper(of, at, tap, double),
      accent: (colour) => this.accents.item(colour),
      destination: room && this.destination(room),
      ruler: this.head.ruler,
      root: this.renderRoot,
    };
  }

  /** A reading as a compact surface writes it ("21.4°", "48 %"), "—" where it cannot be read. */
  private said(id: string, kind: 'temperature' | 'humidity'): string {
    const reading = roomReading(this.hass, this.entity(id), kind);
    return reading ? short(reading) : '—';
  }

  /** A room's temperature and humidity where it has them and the card shows them (`show_climate`), "—" out of reach. */
  private readings(room: Room): string[] {
    if (this.config?.show_climate === false) return [];
    return [
      ...(room.temperature ? [this.said(room.temperature, 'temperature')] : []),
      ...(room.humidity ? [this.said(room.humidity, 'humidity')] : []),
    ];
  }

  /**
   * A room's line: its readings, then how many of its devices are on where asked (`show_count`); "Not found" (the
   * short word a figure's slot says) for an area the house no longer has.
   */
  private segments(room: Room): string[] {
    if (!room.area) return [this.t('state.not_found')];
    const devices = room.contents?.devices ?? [];
    return [
      ...this.readings(room),
      ...(this.config?.show_count && devices.length
        ? [counted(this.hass, devices, (id) => this.entity(id))]
        : []),
    ];
  }

  /** Whether anything of a room's is on: its circle is lit. */
  private lit(room: Room): boolean {
    return (room.contents?.devices ?? []).some((id) => isActive(this.entity(id)));
  }

  /**
   * A room's circle: lit in its own tone or colour while anything of it is on, else the card's, else the accent; the
   * neutral circle at rest; the dashed ring where the house has no such area.
   */
  private look(room: Room): {
    readonly lit: boolean;
    readonly tone: Tone;
    readonly accent: string | undefined;
  } {
    if (!room.area) return { lit: false, tone: 'off', accent: undefined };
    if (!this.lit(room)) return { lit: false, tone: 'neutral', accent: undefined };
    return {
      lit: true,
      tone: toneOf(room.own, toneOf(this.config)),
      accent: this.accents.item(room.own.color),
    };
  }

  /** A room's tap (its own, else where it opens) and hold (its own: nothing by default), each where it can run. */
  private press(room: Room) {
    const to = this.destination(room);
    return {
      ...this.pressOf(room.own, undefined, to ? () => navigate(to) : null, null, '', room.own.area),
      // a chevron says where it opens: where it is the room's own tap
      opens: Boolean(to) && !room.own.tap_action,
    };
  }

  /** The rooms' average temperature as the head writes it ("21.2°"), of those that read one; none without. */
  private average(rooms: readonly Room[]): string | undefined {
    const degrees = rooms.flatMap((room) => {
      if (!room.temperature) return [];
      const view: EntityView = this.entity(room.temperature);
      if (!isUsable(view)) return [];
      const value = climateAttribute(view.id, 'temperature')
        ? numberAttr(view, 'current_temperature')
        : view.number;
      return value === null || value === undefined ? [] : [value];
    });
    if (!degrees.length) return undefined;
    const mean = degrees.reduce((sum, value) => sum + value, 0) / degrees.length;
    return `${formatNumber(this.hass, mean, { digits: 1 })}°`;
  }

  protected override renderCard(): TemplateResult {
    const { rooms, listed } = this.rooms();
    const w = this.contentWidth;
    const config = this.config;
    const headed = config?.show_head !== false;
    const arrows = config?.show_arrow !== false;
    return html`<article class="fv-card rs-card" data-card>
      ${headed ? this.renderHead(rooms, listed, w, arrows) : nothing}
      ${
        !rooms.length
          ? this.head.empty('rooms', this.t('rooms-card.empty'), this.t('rooms-card.empty_hint'), w)
          : this.variant === 'tiles'
            ? this.renderTiles(rooms, w)
            : this.renderRows(rooms, w, headed, arrows)
      }
    </article>`;
  }

  /**
   * The head: its icon lit while anything in its rooms is on, its title ("Rooms" by default) and its line, "5 rooms ·
   * 21.2° average" (`show_average`), the average giving way first; a tap and a chevron that open every room where the
   * house's rooms open on a dashboard, its own tap and hold where it names them.
   */
  private renderHead(
    rooms: readonly Room[],
    listed: number,
    w: number,
    arrows: boolean,
  ): TemplateResult {
    const config = this.config;
    const average = config?.show_average === false ? undefined : this.average(rooms);
    const sub = [
      plural(this.hass, 'rooms-card.count', listed, { count: listed }),
      ...(average ? [this.t('rooms-card.average', { value: average })] : []),
    ].join(' · ');
    const all = roomsDashboard(this.hass, () => this.requestUpdate())?.all;
    const { onTap, onHold } = this.pressOf(
      config,
      undefined,
      all ? () => navigate(all) : null,
      null,
    );
    // the chevron's 44 and the 12 before it, less the 8 its ink stands past the column edge; it gives way where the
    // title or the line's first words would not be whole beside it (half a section): the head is still the button
    const first = sub.split(' · ')[0] ?? '';
    const fitWith = (title: string, chevron: boolean) =>
      ({
        chevron,
        ...this.head.fit({ width: w, title, sub, trailing: chevron ? 36 : 0 }),
      }) as const;
    const fit = (title: string) => {
      const asked = fitWith(title, Boolean(all) && arrows && !config?.tap_action);
      return asked.chevron &&
        (asked.cut ||
          this.head.ruler.width('fv-card__sub', first) > w - (asked.icon ? CIRCLE : 0) - ARROW)
        ? fitWith(title, false)
        : asked;
    };
    // the card's own word where it holds whole, else its short one (Polish "Pomieszczenia" at 152); a written title is
    // the person's
    let title = config?.title || this.t('cards.rooms');
    let fitted = fit(title);
    if (!config?.title && fitted.cut) {
      title = this.t('rooms-card.title_short');
      fitted = fit(title);
    }
    return head({
      icon: fitted.icon ? (config?.icon ?? 'rooms') : null,
      small: fitted.small,
      tone: rooms.some((room) => this.lit(room)) ? toneOf(config) : 'neutral',
      title,
      // the person's own title is a name, which may end in its ellipsis; the card's word is whole
      name: Boolean(config?.title),
      sub: fitted.sub,
      cut: fitted.cut,
      ...this.iconActions(undefined),
      trailing:
        fitted.chevron && all
          ? html`<button
              class="fv-hit fv-head__open"
              aria-label=${title}
              @click=${() => navigate(all)}
            >
              ${icon('chevron')}
            </button>`
          : nothing,
      onTap,
      onHold,
    });
  }

  /**
   * A row a room (`rows`, `compact`): its glyph, its name over its line, its rounds at its end, a chevron where it
   * opens a page (`roundsRows`: what does not hold gives way, the chevrons first, then the rounds from the end); the
   * compact row its temperature at its end, before its rounds, where it has one (else its humidity), "—" out of reach.
   */
  private renderRows(
    rooms: readonly Room[],
    w: number,
    headed: boolean,
    arrows: boolean,
  ): TemplateResult {
    const compact = this.variant === 'compact';
    const rows = rooms.map((room): RoundsRowSpec => {
      const segments = this.segments(room);
      const { tone, accent } = this.look(room);
      const { onTap, onHold, opens } = this.press(room);
      return {
        icon: room.area ? room.glyph : 'ban',
        tone,
        accent,
        title: room.name,
        ...(compact
          ? { value: room.area ? this.readings(room)[0] : undefined }
          : { sub: segments.join(' · ') || undefined }),
        rounds: room.rounds,
        host: this.host(room),
        onTap,
        onHold,
        opens,
        label: [room.name, ...segments].join(', '),
      };
    });
    return html`<div class="rs-rows ${headed ? '' : 'rs-rows--bare'}">
      ${roundsRows(this.host(), w, rows, compact, { arrows })}
    </div>`;
  }

  /**
   * A tile a room (`tiles`): two a row from a column of 320 (an odd last one takes the row), one a row in a narrower
   * one, each its columns' share on whole pixels.
   */
  private renderTiles(rooms: readonly Room[], w: number): TemplateResult {
    const two = w >= TILES_TWO && rooms.length > 1;
    const column = two ? Math.floor((w - 8) / 2 / 4) * 4 : w;
    const odd = two && rooms.length % 2 === 1;
    return html`<div
      class="rs-tiles"
      style="--rs-cols:${two ? 2 : 1};--rs-col:${column}px;--rs-gap:${two ? w - 2 * column : 0}px"
    >
      ${rooms.map((room, index) =>
        odd && index === rooms.length - 1
          ? this.renderTile(room, w, true)
          : this.renderTile(room, column),
      )}
    </div>`;
  }

  /**
   * A room's tile, `width` wide: its glyph big in its circle and its rounds on one line, as many as hold beside it
   * (from the end), its name and its line under them; the tile its tap and hold, its rounds their own.
   */
  private renderTile(room: Room, width: number, span = false): TemplateResult {
    const { lit, tone, accent } = this.look(room);
    const { onTap, onHold } = this.press(room);
    const inner = width - TILE_SIDES;
    const block = roundsIn(this.host(room), room.rounds, inner - HERO);
    const segments = this.segments(room);
    const line = fitLine(
      segments.map((text, index) => ({ text, optional: index > 0 })),
      inner,
      (text) => this.head.ruler.width('rs-tile__line', text),
    );
    return html`<div
      class="rs-tile ${onTap || onHold ? 'fv-tile--tap' : ''} ${lit ? 'is-on' : ''} ${span ? 'rs-span' : ''}"
      data-accent=${accent ?? nothing}
    >
      <div class="rs-tile__top">
        ${ico(room.area ? room.glyph : 'ban', tone, { hero: true })} ${block.template}
      </div>
      <p class="rs-tile__name" data-name>${room.name}</p>
      <p class="rs-tile__line">${line}</p>
      ${onTap || onHold ? pressCover([room.name, ...segments].join(', '), onTap, onHold) : nothing}
    </div>`;
  }
}
