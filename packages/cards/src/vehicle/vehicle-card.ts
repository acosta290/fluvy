import {
  deviceNameOf,
  formatNumber,
  isEntityId,
  isUsable,
  relativeTime,
  stateText,
  strings,
  textName,
  TOGGLE_DOMAINS,
  type ActionConfig,
  type EntityName,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type MessageKey,
  type LovelaceGridOptions,
} from '@fluvy/core';
import {
  addGlyphs,
  clickPress,
  glyph,
  head,
  holdKey,
  icon,
  listRow,
  pressCover,
  preventMenu,
  sheetStyles,
  startPress,
  type PressTarget,
  type Tone,
} from '@fluvy/ui';
import { energyStyles } from '@fluvy/ui/styles/energy';
import { css, html, nothing, svg, type CSSResultGroup, type TemplateResult } from 'lit';

import { HeadFit, ROW_NAME_MIN } from '../energy/head.js';
import { statesUnder, type QuickStatePosition } from '../room/room-card.js';
import { MARK_LABEL, markedRuler } from '../energy/marked-ruler.js';
import { Card, MORE_INFO, type CardEditor, type HeadConfig, type Press } from '../shared/base.js';
import { toneOf } from '../shared/colour.js';
import type { AliasSpec } from '../shared/config.js';
import { spanText, unitWord, withUnit } from '../shared/duration.js';
import { fitLine, type Segment } from '../shared/fit.js';
import { durationSeconds, when } from '../shared/job-time.js';
import { BrokenPictures, imageEntity, imageOf } from '../shared/picture.js';
import { Ticker, MINUTE } from '../shared/ticker.js';
import {
  roundOf,
  roundsIn,
  roundsOf,
  roundTap,
  type RoundSpec,
  type RoundsHost,
} from '../shared/rounds.js';
import { PENDING_LINE } from '../shared/templates.js';
import { valueRow } from '../shared/value-row.js';
import {
  pictureAt,
  picturePlate,
  vehicleHeight,
  vehicleVariant,
  type VehicleVariant,
} from '../vehicle-family.js';
import { VEHICLE_GLYPHS } from './glyphs.js';
import {
  vehicleDevice,
  vehicleDevices,
  vehicleEntities,
  rolesOfMap,
  type NamedRole,
  type VehicleEntities,
  type VehicleRole,
  type Wheel,
} from './roles.js';
import {
  activityOf,
  cabinOf,
  chargeOf,
  convertDistance,
  convertPressure,
  energyOf,
  isDistance,
  lineOf,
  lowAdBlue,
  lowRange,
  lowTank,
  oilToCheck,
  plugged,
  pluggedWord,
  serviceDue,
  serviceWord,
  type Activity,
  type Cabin,
  type Charge,
  type Energy,
  type Opening,
  type Upkeep,
} from './state.js';

addGlyphs(VEHICLE_GLYPHS);

const s = strings('vehicle');

/* ---------- the config ---------- */

/** The round controls, each where the car has what it takes. */
export type VehicleControl =
  | 'lock'
  | 'engine'
  | 'climate'
  | 'charging'
  | 'charge_port'
  | 'trunk'
  | 'frunk'
  | 'windows'
  | 'doors'
  | 'sentry';
export const VEHICLE_CONTROLS: readonly VehicleControl[] = [
  'lock',
  'engine',
  'climate',
  'charging',
  'charge_port',
  'trunk',
  'frunk',
  'windows',
  'doors',
  'sentry',
];
/**
 * The controls a card shows where it names none: the ones the car has, in this order (its doors and port on request;
 * its engine where a person names what starts it).
 */
const DEFAULT_CONTROLS: readonly VehicleControl[] = [
  'lock',
  'engine',
  'climate',
  'charging',
  'trunk',
  'windows',
  'frunk',
  'sentry',
];

/** The rows under the controls, each a reading of the car's. */
export type VehicleRow =
  | 'location'
  | 'odometer'
  | 'inside'
  | 'outside'
  | 'charge_power'
  | 'charge_rate'
  | 'charge_limit'
  | 'time_to_full'
  | 'software'
  | 'speed'
  | 'fuel'
  | 'fuel_range'
  | 'fuel_volume'
  | 'adblue'
  | 'oil'
  | 'service';
export const VEHICLE_ROWS: readonly VehicleRow[] = [
  'location',
  'odometer',
  'inside',
  'outside',
  'charge_power',
  'charge_rate',
  'charge_limit',
  'time_to_full',
  'software',
  'speed',
  'fuel',
  'fuel_range',
  'fuel_volume',
  'adblue',
  'oil',
  'service',
];
const DEFAULT_ROWS: readonly VehicleRow[] = ['location', 'odometer'];

/** A control as a list names it: one of the car's, or an entity of the person's own, and what the card may change of it. */
export interface ControlEntry {
  /** One of the car's: what it reads and how it acts, the card knows. */
  readonly control?: VehicleControl;
  /**
   * An entity of the person's own where it names no control (#248: a switch, a button, a script, a scene): its round
   * lit while it is on, a tap on and off where its kind takes one, else its details; its name under it.
   */
  readonly entity?: string;
  readonly name?: string;
  readonly icon?: string;
  readonly color?: string;
  /**
   * Whether a tap that acts asks first: by default the car's own unlocking, opening, venting and stopping a charge do;
   * an entity's own tap asks where this says so.
   */
  readonly confirm?: boolean;
  readonly tap_action?: ActionConfig;
  readonly hold_action?: ActionConfig;
  readonly double_tap_action?: ActionConfig;
}

/** A row as a list names it: a reading of the car's, or any entity. */
export interface RowEntry {
  readonly row?: VehicleRow;
  readonly entity?: string;
  readonly name?: EntityName;
  readonly icon?: string;
  readonly color?: string;
  readonly tap_action?: ActionConfig;
  readonly hold_action?: ActionConfig;
  readonly double_tap_action?: ActionConfig;
}

export interface VehicleCardConfig extends FluvyCardConfig, HeadConfig {
  /** The car's device: everything it has is found on it. */
  device?: string;
  variant?: VehicleVariant;
  /** Whether its entities are found on its device (the default); off, only `roles` play. */
  scan?: boolean;
  /**
   * Entities named by hand for a part the card does not find, or plays otherwise: `{ role, entity }` (a map of each role
   * to its entity reads as that list).
   */
  roles?: readonly NamedRole[];
  /**
   * What it runs on: its battery, its tank, or both (a plug-in hybrid); `auto` (the default), its tank where it has
   * one and no battery, else its battery.
   */
  energy?: 'auto' | 'electric' | 'fuel' | 'hybrid';
  /** Its tank's size, in the unit of what is in it (L, gal): the level, where the car says only what is in it. */
  tank_size?: number;
  /** The battery (or the tank) on its ruler (the default) or as a ring; a hybrid's two are rulers. */
  hero?: 'ruler' | 'ring';
  /**
   * The head's badge of the person's own (#251): words, an entity's state or a template, in place of what the car does
   * (which says it again where the answer is empty); "Unavailable" while the car is out of reach.
   */
  badge?: string;
  /** A picture of the car: an address, an entity whose picture it is, or `auto` (the integration's own). */
  image?: string;
  image_position?: 'hero' | 'head';
  /**
   * The picture's size over the battery (#254): a share of the card's width (`50%`) or a height (`120px`, or a
   * figure), the card's height following it; none, 2:1 across the column.
   */
  image_size?: string | number;
  /** Whether the head shows (its circle or picture, its name, where it is and what it does): unless `false` (#254). */
  show_head?: boolean;
  /** Whether the battery (or the tank, or a hybrid's both) shows: unless `false` (#254). */
  show_hero?: boolean;
  show_range?: boolean;
  show_limit?: boolean;
  /** The line under the battery: when it is full, why it is not charging, a low range, a cold cabin. */
  show_status?: boolean;
  show_controls?: boolean;
  controls?: ReadonlyArray<VehicleControl | ControlEntry>;
  show_rows?: boolean;
  rows?: ReadonlyArray<VehicleRow | RowEntry>;
  show_tyres?: boolean;
  /**
   * Small rounds at the card's foot (#251), each an entity's (a sensor, a door left ajar, a script) with its own name,
   * icon, colour, actions and state: as many as one line holds, those that do not giving way from the end.
   */
  quick_actions?: ReadonlyArray<string | RoundSpec>;
  /** Every quick action's state in the pill its round grows into; a quick action may say its own (`show_state`). */
  show_quick_states?: boolean;
  /** Where their states stand: `under` their glyphs (the default: the line 20 taller), or `beside` them. */
  quick_state_position?: QuickStatePosition;
  /** The tyres' decimals (0–2), or `auto`: their sensors' precision, else one under 10; the editor writes them as words. */
  tyre_decimals?: number | string;
  /**
   * Under this pressure a tyre is low (#251): a figure in the tyres' unit, an entity (its reading, in its own unit), or
   * a template; its figure in the warning's ink, its wheel in the drawing, and "Low tyre pressure" on the line.
   */
  tyre_low?: number | string;
  /** Under this range (in the range's unit) it is low; without it, a charge of 20 % or less is. */
  low_range?: number;
  /** Minutes after which a car that has said nothing says when it last did ("Updated 2 h ago"). */
  stale_after?: number;
  range_unit?: 'auto' | 'km' | 'mi';
  /** The range's decimals (0–3), or `auto`; the editor writes them as words ("1"). */
  range_decimals?: number | string;
  power_unit?: 'auto' | 'W' | 'kW';
  power_decimals?: number | string;
  /** What a tap and a still press on the battery do (its details by default), and two taps (none, #179). */
  hero_tap_action?: ActionConfig;
  hero_hold_action?: ActionConfig;
  hero_double_tap_action?: ActionConfig;
  /** Test hook: an ISO instant the card takes for "now". */
  _now?: string;
}

/* ---------- what the card draws with ---------- */

/** A control's cell: its round, its word under it, what a tap does. */
interface ControlView {
  readonly name: string;
  readonly glyph: string;
  readonly word: string;
  /** Every word it can say in any state, whether it reads or not (its widest decides the row, which never moves). */
  readonly words: readonly string[];
  readonly tone: Tone;
  /** The word in a tone's ink: an open boot's warning, a cold cabin's cool. */
  readonly ink: '' | 'warning' | 'cool' | 'heat';
  readonly entity: string | undefined;
  /** What a tap does on the car, where it acts; undefined opens its details. */
  readonly act: ActionConfig | undefined;
  readonly disabled: boolean;
  /** Why it cannot act now, for a reader (`title`). */
  readonly why: string;
  readonly accent: string | undefined;
  readonly entry: ControlEntry;
  /** An entity of the person's own: its round's tap and hold (`roundOf`), and its state for a reader. */
  readonly own?: {
    readonly onTap: (() => void) | undefined;
    readonly onHold: (() => void) | undefined;
    readonly state: string;
  };
}

/** A tyre as the card draws it: its wheel, its pressure and unit (or its warning's word), whether it is low, what it opens. */
interface Tyre {
  readonly wheel: Wheel;
  readonly value: string;
  readonly unit: string;
  readonly low: boolean;
  readonly id: string | undefined;
}

/** A distance as the card writes it, in its unit, and its number (null where it cannot be read). */
interface Distance {
  readonly value: string;
  readonly unit: string;
  readonly number: number | null;
}

/** A car's tank: its level, what is in it, how far it goes; whether it, its AdBlue, its oil or its service call. */
interface Tank {
  /** Its level (%): its own, else what is in it of `tank_size`; null where neither can be read. */
  readonly level: number | null;
  /** What is in it ("32 L"), null where the car does not say. */
  readonly volume: { readonly value: string; readonly unit: string } | null;
  readonly range: Distance;
  readonly low: boolean;
  readonly adblue: boolean;
  readonly oil: boolean;
  readonly service: boolean;
}

/** A hero as it draws: the battery or the tank — its word, its level (or its figure), its range, its mark, its tone. */
interface Gauge {
  readonly label: string;
  readonly level: number | null;
  /** Its figure where it has no level: what is in the tank. */
  readonly amount: { readonly value: string; readonly unit: string } | null;
  readonly range: Distance;
  /** The range's unit as its widest figure is laid out in. */
  readonly rangeUnit: string;
  readonly limit: number | null;
  readonly low: boolean;
  /** Its tone at rest: the card's colour (a lone tank's where the card names one), else the gas tone (a tank's). */
  readonly tone: Tone;
  /** What its tap opens. */
  readonly entity: string | undefined;
  /** Its glyph, where two gauges share the compact card. */
  readonly glyph: string;
}

/** What `renderCard` reads once and every part draws. */
interface Reading {
  readonly name: string;
  /** What it runs on, as the card draws it. */
  readonly energy: Energy;
  readonly level: number | null;
  readonly range: Distance;
  /** Its tank, where it is drawn burning fuel (alone or beside its battery). */
  readonly tank: Tank | null;
  readonly limit: number | null;
  readonly charge: Charge | null;
  /** The cable is said to be in (its sensor, or a charge that needs one): "Plugged in" only then. */
  readonly plugged: boolean;
  readonly activity: Activity;
  readonly low: boolean;
  /** What stands open (a window first, then a door, the boot, the front boot), null where all is shut. */
  readonly open: Opening | null;
  /** Its four tyres, front left to rear right: what the tyres' panel draws, and a low one the line says. */
  readonly tyres: readonly Tyre[];
  readonly cabin: Cabin;
  /** "Updated 2 h ago" while the car says nothing, '' otherwise. */
  readonly stale: string;
  /** Where it is ("Home", a zone, "Away"), '' where it has no tracker. */
  readonly place: string;
  /** Where it is in words, away from home (Kia's and Hyundai's address), '' otherwise. */
  readonly address: string;
  /** The car out of reach: every part at rest in the off skin, at its size (1.9). */
  readonly unavailable: boolean;
  readonly tone: Tone;
  /** What the head's badge says: what the car does, or the person's own (`own`); none while their template is asked. */
  readonly badge: { readonly text: string; readonly tone: Tone; readonly own?: boolean } | null;
}

/** The line under the battery: its parts, and the ink it is said in. */
interface Line {
  readonly segments: readonly Segment[];
  readonly ink: '' | 'warning' | 'ok' | 'cool' | 'heat';
}

/** A ring's radius, its ticks' length and its box, as the appliances' ring draws them. */
const RING_MAX = 88;
const RING_MIN = 56;
const RING_TICK = 12;
/** The strip's ring round its circle (the printer's): 2 px at r 26.5, 3.5 clear of the 44 circle. */
const STRIP_RADIUS = 26.5;
/**
 * The least a control's cell is: its 44 round and 6 a side. The cells touch (four of 80 at a 360 column, five of 70 on
 * a 392 card, where their words hold); a word keeps 2 of its cell clear, so two words side by side never touch.
 */
const CELL_MIN = 56;
const WORD_CLEAR = 2;
/** The tyres' car from above: its box in the panel. */
const CAR_WIDTH = 40;
/** The wheels, in the order the tyres' panel reads them: the front's left and right, then the rear's. */
const WHEELS: readonly Wheel[] = ['fl', 'fr', 'rl', 'rr'];
/** Minutes without a word from the car after which the card says when it last spoke (`stale_after`). */
export const STALE_AFTER = 30;
/** A lock's states, each a word its round may say. */
const LOCK_STATES: readonly string[] = [
  'locked',
  'unlocked',
  'locking',
  'unlocking',
  'jammed',
  'open',
  'opening',
];

/** The words of a control's state, for the reader: "Lock · Locked". */
const said = (view: Pick<ControlView, 'name' | 'word'>): string =>
  view.word && view.word !== view.name ? `${view.name} · ${view.word}` : view.name;

/**
 * A list's entry as an object: a bare key is `{ control }` (an entity's id `{ entity }`) / `{ row }`; `control: entity`,
 * the editor's word for one of the person's own, is its `entity` alone.
 */
const controlEntry = (raw: VehicleControl | ControlEntry): ControlEntry => {
  if (typeof raw === 'string') return isEntityId(raw) ? { entity: raw } : { control: raw };
  const { control, ...own } = raw;
  return (control as string) === 'entity' ? own : raw;
};
const rowEntry = (raw: VehicleRow | RowEntry): RowEntry =>
  typeof raw === 'string' ? { row: raw } : raw;

/** A control's word: its name ("Charging" for the charge's; the front boot is a bonnet where an engine is under it). */
export const controlWord = (key: VehicleControl, energy: Energy = 'electric'): MessageKey =>
  key === 'lock'
    ? 'lock.lock'
    : key === 'charging'
      ? 'vehicle.charge'
      : key === 'frunk' && energy !== 'electric'
        ? 'vehicle.bonnet'
        : `vehicle.${key}`;
/** The car from above (the tyres' panel): its body, its glass, its four wheels — a wheel with a warning in its ink. */
function carFromAbove(low: Readonly<Partial<Record<Wheel, boolean>>>): TemplateResult {
  const wheel = (x: number, y: number, key: Wheel) =>
    svg`<rect class=${low[key] ? 'is-low' : ''} x=${x} y=${y} width="5" height="13" rx="2.5" />`;
  return html`<svg class="vh-car" viewBox="0 0 40 72" aria-hidden="true">
    <rect x="7.5" y="3" width="25" height="66" rx="11" />
    <path d="M11 22.5c5.5-3 12.5-3 18 0" />
    <path d="M11.5 52c5.5 2.5 11.5 2.5 17 0" />
    <path d="M11 22.5v29.5" />
    <path d="M29 22.5v29.5" />
    ${wheel(1.5, 12, 'fl')}${wheel(33.5, 12, 'fr')}${wheel(1.5, 47, 'rl')}${wheel(33.5, 47, 'rr')}
  </svg>`;
}

/**
 * A car, electric, burning fuel or both: an electric one's battery on the charge cards' ruler (or as a ring) with its
 * range and its charge limit marked, when it will be full while it charges — the clock time and how long — a range that
 * runs low, a cabin too cold or too hot to get into, how long since it last said anything; where it is and how far it
 * has gone; its lock, climate, charging, boot, front boot, windows and sentry as one row of rounds, each acting on the
 * car (and asking first where that matters) or opening what it reads; its tyres from above. Given its device (or any of
 * its entities) it finds the rest: Tesla's three integrations, Renault, Volvo and Škoda, and Kia and Hyundai, MySkoda,
 * Polestar, MG, Volkswagen's two and BMW's CarData from HACS, by their own words; any other by what its entities are,
 * and by `roles`. A car that burns fuel (#207) draws its tank in the battery's place — its level in its tone, its range
 * beside it, the warning's when it runs low — and says on its line what is in it, its AdBlue, its oil and its service
 * when they call; a plug-in hybrid draws its battery and its tank (`energy`). Toyota's, Ford's, Mercedes-Benz's and
 * Stellantis's integrations from HACS are read for their tanks too.
 */
export class FluvyVehicleCard extends Card<VehicleCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: VehicleCardConfig): number {
    return vehicleHeight(config);
  }

  /** `roles` written as a map (`{ fuel: sensor.x }`) reads as the list it means, in the card and in its editor. */
  static override aliases: AliasSpec = {
    upgrade: (config) => {
      const roles = config['roles'];
      return roles && typeof roles === 'object' && !Array.isArray(roles)
        ? { ...config, roles: rolesOfMap(roles as Readonly<Record<string, unknown>>) }
        : config;
    },
  };

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    energyStyles,
    sheetStyles.rooms,
    css`
      .vh-card {
        position: relative;
        width: 100%;
      }
      /* the car's picture over its battery: its plate 2:1 across the column, or at its own size (#254), the whole car on
         the card (a picture with no ground of its own floats on it); none found, the plate keeps its place with the
         car's glyph */
      .vh-picture {
        position: relative;
        display: grid;
        place-items: center;
        margin: 16px auto 0;
        border-radius: var(--fluvy-radius-lg);
      }
      /* the card's button where its head is hidden (#254) */
      .vh-picture > .fv-tile__tap {
        border-radius: inherit;
      }
      /* the first part where the head is hidden sits at the card's padding (#254) */
      .vh-card > :first-child,
      .vh-card > .vh-hero:first-child > :first-child {
        margin-top: 0;
      }
      /* the whole car inside its plate, whatever size the plate is given (#254) */
      .vh-picture > img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .vh-picture.is-empty {
        background: var(--fluvy-inset, var(--fluvy-page));
        color: var(--fluvy-text-secondary);
      }
      .vh-picture.is-empty svg {
        width: 32px;
        height: 32px;
      }
      /* the picture in the head, in the circle's place: 64 × 44, the whole car */
      .vh-face {
        display: grid;
        flex: 0 0 64px;
        place-items: center;
        width: 64px;
        height: 44px;
        border-radius: var(--fluvy-radius-control);
        color: var(--fluvy-text-secondary);
      }
      .vh-face > img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }
      .vh-face.is-empty {
        background: var(--fluvy-inset, var(--fluvy-page));
      }
      .vh-face svg {
        width: 20px;
        height: 20px;
      }
      .is-unavailable .vh-picture > img,
      .is-unavailable .vh-face > img {
        filter: grayscale(1);
        opacity: 0.5;
      }
      /* the battery: its value row and its ruler, one tap (its details, or the card's own) laid over them */
      .vh-hero {
        position: relative;
      }
      .vh-hero.is-low .ef-top__side .fv-readout__value {
        color: var(--fluvy-warning);
      }
      .vh-dial {
        display: flex;
        justify-content: center;
        margin-top: 16px;
      }
      /* the line under the battery: one line, its parts fitted to it */
      .vh-line {
        height: 20px;
        margin-top: 16px;
        overflow: hidden;
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        color: var(--fluvy-text-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .vh-hero + .vh-line {
        margin-top: 8px;
      }
      .vh-line.is-warning {
        color: var(--fluvy-warning);
      }
      .vh-line.is-ok {
        color: var(--fluvy-success);
      }
      .vh-line.is-cool {
        color: var(--fluvy-state-climate-cool);
      }
      .vh-line.is-heat {
        color: var(--fluvy-state-climate-heat);
      }
      /* the compact card's battery: a 12 bar, its share in the card's colour, the percentage at its end; the limit a
         2 px mark across it */
      .vh-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 20px;
        margin-top: 16px;
      }
      .vh-bar__track {
        position: relative;
        flex: 1 1 auto;
        height: 12px;
        border-radius: 6px;
        background: var(--fluvy-inset, var(--fluvy-page));
        overflow: hidden;
      }
      .vh-bar__fill {
        display: block;
        height: 100%;
        border-radius: 6px;
        background: var(--tone-ink, var(--fluvy-accent));
        transition: width var(--fv-slow) var(--fv-ease);
      }
      .vh-bar__mark {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        margin-left: -1px;
        background: var(--fluvy-text);
        opacity: 0.6;
      }
      .vh-bar__value {
        flex: 0 0 auto;
        min-width: var(--vh-pct, 40px);
        font-size: 15px;
        font-weight: 600;
        line-height: 20px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .vh-bar + .vh-line {
        margin-top: 8px;
      }
      /* a hybrid's two bars, 8 apart, each led by its glyph (the battery's, the pump) */
      .vh-hero + .vh-hero > .vh-bar {
        margin-top: 8px;
      }
      .vh-bar__glyph {
        display: grid;
        flex: 0 0 20px;
        place-items: center;
        width: 20px;
        height: 20px;
        color: var(--fluvy-text-secondary);
      }
      .vh-bar__glyph svg {
        width: 20px;
        height: 20px;
      }
      /* the controls: equal cells across the column, touching, each a round and its word under it — one button; a
         shorter last row centred under the others */
      .vh-controls {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        row-gap: 12px;
        margin-top: 16px;
      }
      .vh-control {
        all: unset;
        position: relative;
        display: flex;
        flex: 0 0 calc(100% / var(--vh-cols, 5));
        flex-direction: column;
        align-items: center;
        gap: 4px;
        min-width: 0;
        box-sizing: border-box;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .vh-control .fv-ico {
        transition:
          scale var(--fv-fast) var(--fv-ease),
          background-color var(--fv-slow) var(--fv-ease),
          color var(--fv-slow) var(--fv-ease);
      }
      .vh-control:active .fv-ico {
        scale: 0.94;
      }
      .vh-control:focus-visible {
        outline: none;
      }
      .vh-control:focus-visible .fv-ico {
        outline: 2px solid var(--fluvy-accent);
        outline-offset: 2px;
      }
      .vh-control[disabled] {
        cursor: default;
        pointer-events: none;
      }
      .vh-control[aria-disabled='true'] .fv-ico {
        opacity: 0.4;
      }
      .vh-control__word {
        max-width: 100%;
        font-size: 12px;
        font-weight: 500;
        line-height: 16px;
        color: var(--fluvy-text-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .vh-control__word.is-warning {
        color: var(--fluvy-warning);
      }
      /* an entity of the person's own says its name, cut to an ellipsis where the cell is narrower */
      .vh-control__word.is-name {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .vh-control__word.is-cool {
        color: var(--fluvy-state-climate-cool);
      }
      .vh-control__word.is-heat {
        color: var(--fluvy-state-climate-heat);
      }
      @media (hover: hover) {
        .vh-control:hover .fv-ico--neutral {
          background: var(--fluvy-page-alt);
          color: var(--fluvy-text);
        }
      }
      /* the compact card's rounds: the words are their titles */
      .vh-controls--bare .vh-control {
        gap: 0;
      }
      .vh-rows {
        margin-top: 16px;
      }
      /* the quick actions: one line of rounds at the foot, from its start; 64 tall where their states stand under them */
      .vh-quick {
        display: flex;
        height: 44px;
        margin-top: 16px;
      }
      .vh-quick.is-under {
        height: 64px;
      }
      /* a column too narrow for a row's name and its value side by side: the value under the name, in the row's 48 */
      .vh-rows .fv-row--stack {
        flex-wrap: wrap;
        align-content: center;
        row-gap: 4px;
      }
      .vh-rows .fv-row--stack > .fv-row__text {
        flex-basis: 100%;
      }
      .vh-rows .fv-row--stack > .fv-row__value {
        top: 0;
      }
      /* the tyres from above: the car in the middle of a soft panel, each tyre's pressure at its wheel */
      .vh-tyres {
        position: relative;
        display: grid;
        grid-template-columns: 1fr ${CAR_WIDTH}px 1fr;
        grid-template-rows: 36px 36px;
        align-items: center;
        column-gap: 12px;
        row-gap: 0;
        height: 96px;
        margin-top: 16px;
        padding: 12px 16px;
        box-sizing: border-box;
        border-radius: var(--fluvy-radius-lg);
        background: var(--fluvy-inset, var(--fluvy-page));
        cursor: pointer;
      }
      .vh-tyres.is-bare {
        grid-template-columns: 1fr 1fr;
      }
      .vh-car {
        grid-row: 1 / 3;
        grid-column: 2;
        width: ${CAR_WIDTH}px;
        height: 72px;
        fill: none;
        stroke: var(--fluvy-text-secondary);
        stroke-width: 1.75;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .vh-car rect:not(:first-child) {
        fill: var(--fluvy-text-secondary);
        stroke: none;
      }
      .vh-car rect.is-low {
        fill: var(--fluvy-warning);
      }
      .vh-tyre {
        min-width: 0;
        font-size: 16px;
        font-weight: 600;
        line-height: 20px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .vh-tyre .fv-unit {
        margin-left: 4px;
        font-size: 12px;
        font-weight: 500;
        color: var(--fluvy-text-secondary);
      }
      .vh-tyre.is-left {
        text-align: right;
      }
      .vh-tyres.is-bare .vh-tyre.is-left {
        text-align: left;
      }
      /* a column too narrow for a pressure and its unit side by side: the unit under its figure, in the row's 36 */
      .vh-tyres.is-stacked .vh-tyre {
        display: flex;
        flex-direction: column;
      }
      .vh-tyres.is-stacked .vh-tyre .fv-unit {
        margin-left: 0;
        line-height: 16px;
      }
      .vh-tyre.is-low,
      .vh-tyre.is-low .fv-unit {
        color: var(--fluvy-warning);
      }
      /* the strip: the compact tile's anatomy (76, 16 in), the car's circle ringed by its charge, its round raised */
      .vh-card--mini {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 76px;
        padding: 16px;
        box-sizing: border-box;
      }
      /* held by another card's surface (the Expander's), the row stands out by its own padding */
      :host:has(> .vh-card--mini) {
        --fv-pad: 16px;
      }
      .vh-ring {
        position: relative;
        display: grid;
        place-items: center;
        flex: 0 0 44px;
        width: 44px;
        height: 44px;
      }
      .vh-ring > svg {
        position: absolute;
        top: -7px;
        left: -7px;
        width: 58px;
        height: 58px;
        transform: rotate(-90deg);
      }
      /* a hybrid's strip: the ring in two halves drawn as they stand, each from the foot up */
      .vh-ring--halves > svg {
        transform: none;
      }
      .vh-ring circle,
      .vh-ring path {
        fill: none;
        stroke-width: 2;
      }
      .vh-ring .vh-ring__track {
        stroke: var(--fluvy-border);
      }
      .vh-ring .vh-ring__fill {
        stroke: var(--tone-ink, var(--fluvy-accent));
        stroke-linecap: round;
        transition: stroke-dashoffset var(--fv-slow) var(--fv-ease);
      }
      .vh-card--mini .fv-row__text {
        flex: 1 1 auto;
        min-width: 0;
      }
      .vh-card--mini .fv-row__sub {
        font-variant-numeric: tabular-nums;
      }
      .vh-card--mini > .vh-control {
        z-index: 1;
        flex: 0 0 auto;
      }
      .vh-card--mini > .fv-tile__tap {
        border-radius: inherit;
      }
    `,
  ];

  private readonly head = new HeadFit(this);
  /** The clock for what the card says of time ("1 h 12 min left", "Updated 2 h ago"): a minute's tick while either shows. */
  protected readonly ticker = new Ticker(this, () => this.timed);
  /** Whether the card says anything of time now: the ticker draws it again each minute while it does. */
  private timed = false;
  /** The car: its device and its roles, found once per registry and config (the search walks every entity). */
  private found:
    | { readonly key: string; readonly registry: unknown; readonly entities: VehicleEntities }
    | undefined;
  /** A picture that would not load: the plate keeps its place with the car's glyph (until the address changes). */
  private readonly pictures = new BrokenPictures(this);

  static override editor(): Promise<CardEditor> {
    return import('./vehicle-editor.js');
  }

  /** A new card takes the house's first car. */
  static getStubConfig(hass: HomeAssistant | undefined): VehicleCardConfig {
    const [device] = vehicleDevices(hass);
    return { type: 'custom:fluvy-vehicle-card', ...(device ? { device } : {}) };
  }

  override getCardSize(): number {
    return this.config ? Math.round(vehicleHeight(this.config) / 50) : 9;
  }
  override getGridOptions(): LovelaceGridOptions {
    return this.variant === 'mini'
      ? { columns: 6, rows: 'auto', min_columns: 3 }
      : { columns: 12, rows: 'auto', min_columns: 3 };
  }

  private get variant(): VehicleVariant {
    return vehicleVariant(this.config);
  }

  /* ---------- the car ---------- */

  /** The car's entities: found on its device, then named by hand (only those with `scan: false`). */
  private car(): VehicleEntities {
    const c = this.config;
    const registry = this.hass?.entities;
    const key = JSON.stringify([c?.device, c?.entity, c?.roles, c?.scan]);
    if (this.found && this.found.registry === registry && this.found.key === key)
      return this.found.entities;
    const device = vehicleDevice(this.hass, c?.device, c?.entity);
    const entities = vehicleEntities(
      this.hass,
      device,
      c?.roles ?? [],
      c?.entity,
      c?.scan !== false,
    );
    this.found = { key, registry, entities };
    return entities;
  }

  protected override watched(): readonly string[] {
    const { roles, doors, windows, warnings } = this.car();
    return [
      ...Object.values(roles),
      ...doors,
      ...windows,
      ...Object.values(warnings),
      ...this.rowEntries().flatMap((entry) => (entry.entity ? [entry.entity] : [])),
      ...this.controlEntries().flatMap((entry) => (entry.control ? [] : [entry.entity])),
      ...this.quickActions().map((item) => item.entity),
      this.config?.image?.trim() === 'auto'
        ? this.devicePicture()
        : imageEntity(this.config?.image),
    ].filter((id): id is string => Boolean(id));
  }

  private now(): number {
    const frozen = this.config?._now ? Date.parse(this.config._now) : NaN;
    return Number.isFinite(frozen) ? frozen : Date.now();
  }

  private view(role: VehicleRole): EntityView | undefined {
    const id = this.car().roles[role];
    return id ? this.entity(id) : undefined;
  }

  /** A role's number, or null where it cannot be read. */
  private number(role: VehicleRole): number | null {
    const v = this.view(role);
    return v && v.status === 'ok' ? v.number : null;
  }

  /** Whether a binary role is on, off, or cannot be read (null). */
  private flag(role: VehicleRole): boolean | null {
    const v = this.view(role);
    if (!v || v.status !== 'ok') return null;
    return v.domain === 'binary_sensor' || v.domain === 'switch' ? v.state === 'on' : null;
  }

  private figure(n: number, digits: number): string {
    return formatNumber(this.hass, n, { digits });
  }

  /** A config's decimals, or the automatic ones. */
  private digits(raw: number | string | undefined, auto: number): number {
    const n = typeof raw === 'number' ? raw : Number(raw);
    return Number.isInteger(n) && n >= 0 && n <= 3 ? n : auto;
  }

  /** A range's unit: the card's (km or mi), else its sensor's, else the house's. */
  private rangeUnit(role: VehicleRole = 'range'): string {
    const asked = this.config?.range_unit;
    if (asked === 'km' || asked === 'mi') return asked;
    return this.view(role)?.unit || this.hass?.config.unit_system.length || 'km';
  }

  /** A range in the unit the card asks for (km ↔ mi), its decimals the card's. */
  private distanceOf(role: VehicleRole): Distance {
    const v = this.view(role);
    if (!v || v.status !== 'ok' || v.number === null) return { value: '—', unit: '', number: null };
    const unit = this.rangeUnit(role);
    const n = convertDistance(v.number, v.unit, unit);
    return { value: this.figure(n, this.digits(this.config?.range_decimals, 0)), unit, number: n };
  }

  /** A distance a row says, whole, in the range's unit where the card asks for one ("24,318 km"). */
  private distanceText(v: EntityView & { readonly number: number }): string {
    const asked = this.config?.range_unit;
    const unit = asked === 'km' || asked === 'mi' ? asked : v.unit;
    return `${this.figure(convertDistance(v.number, v.unit, unit), 0)} ${unit}`;
  }

  /** What the card draws the car as: its `energy`, else its tank where it has one and no battery, else its battery. */
  private energy(): Energy {
    const { roles } = this.car();
    return energyOf(this.config?.energy, {
      battery: Boolean(roles.battery),
      tank: Boolean(roles.fuel ?? roles.fuel_volume ?? roles.fuel_range),
    });
  }

  /** The entity the tank is read by: its level, else what is in it, else its range. */
  private tankEntity(): string | undefined {
    const { roles } = this.car();
    return roles.fuel ?? roles.fuel_volume ?? roles.fuel_range;
  }

  /**
   * What a fluid's or a service's entity says: its warning (a binary sensor, a warning's words), a level (%), a
   * distance (in km), days (a duration, or a date from now); null where it cannot be read.
   */
  private upkeep(role: VehicleRole, now: number): Upkeep {
    const v = this.view(role);
    if (!v || v.status !== 'ok') return null;
    if (v.domain === 'binary_sensor') return { kind: 'warning', on: v.state === 'on' };
    if (v.number === null) {
      const at =
        v.deviceClass === 'timestamp' || v.deviceClass === 'date' ? Date.parse(v.state) : NaN;
      if (Number.isFinite(at)) return { kind: 'days', days: (at - now) / 86_400_000 };
      const due = serviceWord(v.state);
      return due === null ? null : { kind: 'warning', on: due };
    }
    if (v.unit === '%') return { kind: 'level', percent: v.number };
    if (v.deviceClass === 'distance' || isDistance(v.unit))
      return { kind: 'distance', km: convertDistance(v.number, v.unit, 'km') };
    const seconds = /^(d|h|min|s)$/i.test(v.unit) ? durationSeconds(v.number, v.unit) : null;
    return seconds === null ? null : { kind: 'days', days: seconds / 86_400 };
  }

  /** An upkeep's figure: a level ("8 %"), a distance ("900 km"), days ("63 d"); '' for a warning or nothing. */
  private upkeepText(role: VehicleRole, now: number): string {
    const reading = this.upkeep(role, now);
    const v = this.view(role);
    if (!reading || !v) return '';
    if (reading.kind === 'level') return `${this.figure(reading.percent, 0)} %`;
    if (reading.kind === 'distance' && v.number !== null)
      return this.distanceText({ ...v, number: v.number });
    return reading.kind === 'days'
      ? withUnit(this.figure(Math.max(0, Math.round(reading.days)), 0), unitWord(this.hass, 'd'))
      : '';
  }

  /**
   * The tank: its level (its own, else what is in it of `tank_size`), what is in it, how far it goes — a car that burns
   * fuel alone as far as its whole range — and whether it runs low, its AdBlue runs low, its oil wants a look or its
   * service is due. None for an electric car.
   */
  private tank(energy: Energy, unavailable: boolean, now: number): Tank | null {
    if (energy === 'electric') return null;
    const volume = this.view('fuel_volume');
    const litres = volume && volume.status === 'ok' ? volume.number : null;
    const size = this.config?.tank_size;
    const raw =
      this.number('fuel') ??
      (litres !== null && typeof size === 'number' && size > 0 ? (litres / size) * 100 : null);
    const level = raw === null ? null : Math.min(100, Math.max(0, raw));
    const own = this.distanceOf('fuel_range');
    const range = own.number === null && energy === 'fuel' ? this.distanceOf('range') : own;
    return {
      level,
      volume:
        litres === null || !volume
          ? null
          : { value: this.figure(litres, /gal/i.test(volume.unit) ? 1 : 0), unit: volume.unit },
      range,
      low:
        !unavailable &&
        lowTank({
          warning: this.flag('fuel_low'),
          range: range.number,
          level,
          threshold: this.config?.low_range,
        }),
      adblue: !unavailable && lowAdBlue(this.upkeep('adblue', now)),
      oil: !unavailable && oilToCheck(this.upkeep('oil', now)),
      service:
        !unavailable && serviceDue(this.upkeep('service', now), this.upkeep('service_time', now)),
    };
  }

  /** How far it goes: its battery's range, its tank's, or a hybrid's both together. */
  private reach(r: Reading): Distance {
    if (!r.tank) return r.range;
    if (r.energy === 'fuel') return r.tank.range;
    const known = [r.range, r.tank.range].filter((d) => d.number !== null);
    const [first] = known;
    if (!first || known.length < 2) return first ?? r.range;
    const n = known.reduce(
      (sum, d) => sum + convertDistance(d.number as number, d.unit, first.unit),
      0,
    );
    return {
      value: this.figure(n, this.digits(this.config?.range_decimals, 0)),
      unit: first.unit,
      number: n,
    };
  }

  /** What the car draws (W): its charging power in its unit brought to watts. */
  private watts(): number | null {
    const v = this.view('charge_power');
    if (!v || v.status !== 'ok' || v.number === null) return null;
    const factor = /^kW$/i.test(v.unit) ? 1000 : /^MW$/i.test(v.unit) ? 1e6 : 1;
    return v.number * factor;
  }

  /** A power as the card writes it: in kW from a kilowatt (W under), or as the card asks. */
  private powerText(watts: number): string {
    const asked = this.config?.power_unit;
    const kw = asked === 'kW' || (asked !== 'W' && Math.abs(watts) >= 1000);
    const value = kw ? watts / 1000 : watts;
    return `${this.figure(value, this.digits(this.config?.power_decimals, kw ? 1 : 0))} ${kw ? 'kW' : 'W'}`;
  }

  /** The charge limit (%): its number's or its sensor's. */
  private limit(): number | null {
    const n = this.number('charge_limit');
    return n === null ? null : Math.min(100, Math.max(0, n));
  }

  /** Where its charge is, from its charging state, its cable and what it draws. */
  private charge(level: number | null, limit: number | null): Charge | null {
    const state = this.view('charging');
    return chargeOf({
      state:
        state && state.status === 'ok'
          ? { word: state.state, binary: state.domain === 'binary_sensor' }
          : null,
      plugged: this.cable(),
      watts: this.watts(),
      level,
      limit,
    });
  }

  /** Whether its cable is in: its plug sensor's word, null where it cannot be read, undefined where it has none. */
  private cable(): boolean | null | undefined {
    const plug = this.view('plugged');
    if (!plug) return undefined;
    if (plug.status !== 'ok') return null;
    return plug.domain === 'binary_sensor' ? plug.state === 'on' : pluggedWord(plug.state);
  }

  /** When it will be full, from a moment (a timestamp) or a duration: the time it ends and the seconds left. */
  private eta(now: number): { readonly at: number; readonly left: number } | null {
    const v = this.view('time_to_full');
    if (!v || v.status !== 'ok') return null;
    const moment =
      v.deviceClass === 'timestamp' || /^\d{4}-\d{2}-\d{2}T/.test(v.state)
        ? Date.parse(v.state)
        : NaN;
    if (Number.isFinite(moment))
      return moment > now ? { at: moment, left: (moment - now) / 1000 } : null;
    const seconds = durationSeconds(v.number, v.unit || 'min');
    return seconds !== null && seconds > 0 ? { at: now + seconds * 1000, left: seconds } : null;
  }

  /** "Updated 2 h ago" where the car has not said anything for longer than `stale_after`; '' otherwise. */
  private stale(now: number): string {
    const v = this.view('updated');
    if (!v || v.status !== 'ok') return '';
    const at = Date.parse(v.state);
    const after = (this.config?.stale_after ?? STALE_AFTER) * 60_000;
    if (!Number.isFinite(at) || now - at < Math.max(after, MINUTE)) return '';
    return s(this.hass, 'updated', { when: relativeTime(this.hass, new Date(at), new Date(now)) });
  }

  /** The car out of reach: none of what it says of itself can be read (its battery or its tank, its lock, its place). */
  private reachless(energy: Energy = this.energy()): boolean {
    const { roles } = this.car();
    const tank = energy === 'electric' ? [] : (['fuel', 'fuel_volume', 'fuel_range'] as const);
    const main = (['battery', 'range', 'lock', 'location', 'charging', ...tank] as const)
      .map((role) => roles[role])
      .filter((id): id is string => Boolean(id));
    return main.length > 0 && main.every((id) => this.entity(id).status !== 'ok');
  }

  /** What it does: drives, sleeps, is parked; out of reach. */
  private activity(): Activity {
    const state = this.view('state');
    const word =
      state && state.status === 'ok'
        ? state.domain === 'binary_sensor'
          ? state.state === 'on'
            ? 'online'
            : 'asleep'
          : state.state
        : null;
    const moving = this.flag('moving');
    return activityOf({
      state: word,
      shift: this.view('shift')?.state ?? null,
      speed: this.number('speed'),
      moving,
      reachless: this.reachless(),
    });
  }

  /** The cabin's temperature unit: its sensor's, else its climate's, else the house's. */
  private cabinUnit(): string {
    return (
      this.view('inside')?.unit ||
      this.view('climate')?.attr<string>('temperature_unit') ||
      this.hass?.config.unit_system.temperature ||
      '°C'
    );
  }

  /** The inside temperature: its sensor's, else its climate's own reading. */
  private inside(): { readonly n: number; readonly text: string; readonly unit: string } | null {
    const sensor = this.view('inside');
    const climate = this.view('climate');
    const unit = this.cabinUnit();
    const n =
      sensor && sensor.status === 'ok' && sensor.number !== null
        ? sensor.number
        : climate && climate.status === 'ok'
          ? (climate.attr<number>('current_temperature') ?? null)
          : null;
    if (n === null || !Number.isFinite(n)) return null;
    return { n, unit, text: `${this.figure(n, 0)} ${unit}` };
  }

  /** The car's name: the card's, else its device's, else its battery's. */
  private carName(): string {
    if (this.config?.name)
      return this.nameFor(this.view('battery') ?? this.entity(), this.config?.name);
    const device = vehicleDevice(this.hass, this.config?.device, this.config?.entity);
    return (
      deviceNameOf(device ? this.hass?.devices?.[device] : undefined) ||
      this.view('battery')?.name ||
      s(this.hass, 'title')
    );
  }

  private reading(now: number): Reading {
    const energy = this.energy();
    const battery = this.view('battery');
    const level =
      battery && battery.status === 'ok' && battery.number !== null
        ? Math.min(100, Math.max(0, battery.number))
        : null;
    const limit = this.limit();
    const range = this.distanceOf('range');
    const unavailable = this.reachless(energy);
    const charge = unavailable ? null : this.charge(level, limit);
    const activity = unavailable ? 'offline' : this.activity();
    const climateOn = this.climateOn();
    const inside = this.inside();
    const accent = toneOf(this.config, 'accent');
    const location = this.view('location');
    const place = location ? (location.status === 'ok' ? stateText(this.hass, location) : '—') : '';
    const words = this.view('address');
    const address =
      location?.state !== 'home' && words && words.status === 'ok' ? words.state.trim() : '';
    const badge = ((): { readonly text: string; readonly tone: Tone } => {
      if (unavailable) return { text: this.t('state.unavailable'), tone: 'off' };
      if (charge === 'charging') {
        const watts = this.watts();
        return {
          text:
            watts !== null && watts > 0
              ? s(this.hass, 'charging_at', { power: this.powerText(watts) })
              : s(this.hass, 'charging'),
          tone: accent,
        };
      }
      if (activity === 'driving') {
        const speed = this.view('speed');
        return {
          text:
            speed && speed.status === 'ok' && speed.number !== null && speed.number > 0
              ? s(this.hass, 'driving_at', {
                  speed: `${this.figure(speed.number, 0)} ${speed.unit}`,
                })
              : s(this.hass, 'driving'),
          tone: accent,
        };
      }
      if (charge === 'complete') return { text: s(this.hass, 'charged'), tone: 'ok' };
      if (charge === 'stopped' || charge === 'waiting' || charge === 'error')
        return { text: s(this.hass, 'plugged'), tone: charge === 'error' ? 'warning' : 'neutral' };
      return { text: s(this.hass, activity === 'asleep' ? 'asleep' : 'parked'), tone: 'neutral' };
    })();
    const own = unavailable ? undefined : this.ownBadge();
    return {
      name: this.carName(),
      energy,
      level,
      range,
      tank: this.tank(energy, unavailable, now),
      limit,
      charge,
      plugged: plugged(charge),
      activity,
      // a hybrid's battery running down is no warning: its tank takes over
      low:
        energy === 'electric' &&
        !unavailable &&
        charge !== 'charging' &&
        lowRange(range.number, level, this.config?.low_range),
      open: unavailable ? null : this.opening(),
      tyres: this.tyres(unavailable),
      cabin: climateOn || unavailable ? null : cabinOf(inside?.n ?? null, inside?.unit ?? '°C'),
      stale: this.stale(now),
      place,
      address,
      unavailable,
      tone: badge.tone,
      badge: own === null ? null : own ? { text: own, tone: badge.tone, own: true } : badge,
    };
  }

  /**
   * The person's own badge (`badge`, #251): its words, an entity's state, a template's answer; null while Home
   * Assistant has not answered (no badge, rather than the card's for a moment); undefined where it says nothing — an
   * empty answer, a template refused, an entity out of reach — and the card's own says what the car does.
   */
  private ownBadge(): string | null | undefined {
    const asked = this.config?.badge;
    const line = this.ownText(asked);
    if (!line) return undefined;
    if (line.text === PENDING_LINE) return null;
    if (isEntityId(asked) && this.hass?.states[asked] && !isUsable(this.entity(asked)))
      return undefined;
    return line.text.trim() || undefined;
  }

  /** What stands open, a window first: its windows' cover or sensors, its doors, its boot, its front boot. */
  private opening(): Opening | null {
    const { windows, doors } = this.car();
    const open = (id: string | undefined): boolean => {
      const v = id ? this.entity(id) : undefined;
      if (!v || v.status !== 'ok') return false;
      return v.domain === 'cover'
        ? v.state === 'open' || v.state === 'opening'
        : v.domain === 'binary_sensor'
          ? v.state === 'on'
          : /open|ajar/i.test(v.state);
    };
    const roles = this.car().roles;
    if (open(roles.windows) || windows.some(open)) return 'windows';
    if (doors.some(open)) return 'doors';
    if (open(roles.trunk)) return 'trunk';
    if (open(roles.frunk)) return 'frunk';
    return null;
  }

  /** Whether the climate runs: its entity's mode, its switch, its sensor that says so. */
  private climateOn(): boolean {
    const climate = this.view('climate');
    if (climate) return climate.status === 'ok' && climate.state !== 'off';
    return this.flag('climate_switch') ?? this.flag('climate_running') ?? false;
  }

  /* ---------- the line under the battery ---------- */

  /**
   * What a tank's line says at rest, each part giving way from the end: what is in it ("32 L in the tank", "32 L"
   * where the line is short), and when its service is ("Service in 4,200 km").
   */
  private tankRest(tank: Tank, now: number): Segment[] {
    const service = this.upkeepText('service', now) || this.upkeepText('service_time', now);
    return [
      ...(tank.volume
        ? [
            {
              text: s(this.hass, 'in_tank', { volume: `${tank.volume.value} ${tank.volume.unit}` }),
              short: `${tank.volume.value} ${tank.volume.unit}`,
              optional: true,
            },
          ]
        : []),
      ...(service ? [{ text: s(this.hass, 'service_in', { when: service }), optional: true }] : []),
    ];
  }

  private line(r: Reading, now: number): Line {
    const percent = (n: number): string => this.figure(n, 0);
    const limitText =
      r.limit !== null ? s(this.hass, 'limit_of', { percent: percent(r.limit) }) : '';
    const kind = lineOf({
      charge: r.charge,
      low: r.low,
      open: r.open,
      cabin: r.cabin,
      tyre: r.tyres.some((tyre) => tyre.low),
      ...(r.tank ? { tank: r.tank } : {}),
    });
    const words = (text: string, ink: Line['ink'] = '', short?: string): Line => ({
      segments: text ? [{ text, ...(short ? { short } : {}) }] : [],
      ink,
    });
    switch (kind) {
      case 'error':
        return words(s(this.hass, 'charge_error'), 'warning');
      case 'charging': {
        const eta = this.eta(now);
        const rate = this.view('charge_rate');
        const per =
          rate && rate.status === 'ok' && rate.number !== null && rate.number > 0
            ? s(this.hass, 'per_hour', { rate: `${this.figure(rate.number, 0)} ${rate.unit}` })
            : '';
        if (!eta)
          return {
            segments: [
              ...(r.limit !== null
                ? [{ text: s(this.hass, 'charging_to', { percent: percent(r.limit) }) }]
                : []),
              ...(per ? [{ text: per, optional: true }] : []),
            ],
            ink: '',
          };
        const at = when(this.hass, eta.at, now);
        const today = at.days === 0;
        const ready =
          r.limit !== null && r.limit < 100
            ? s(this.hass, today ? 'limit_at' : 'limit_on', {
                percent: percent(r.limit),
                time: at.time,
                day: at.day,
              })
            : s(this.hass, today ? 'full_at' : 'full_on', { time: at.time, day: at.day });
        return {
          segments: [
            { text: ready },
            { text: s(this.hass, 'left', { time: spanText(this.hass, eta.left) }), optional: true },
            ...(per ? [{ text: per, optional: true }] : []),
          ],
          ink: '',
        };
      }
      case 'low':
        return words(s(this.hass, 'low_range'), 'warning');
      case 'low_fuel':
        return words(s(this.hass, 'low_fuel'), 'warning');
      case 'adblue': {
        const left = this.upkeepText('adblue', now);
        return {
          segments: [
            { text: s(this.hass, 'adblue_low') },
            ...(left ? [{ text: left, optional: true }] : []),
          ],
          ink: 'warning',
        };
      }
      case 'oil':
        return words(s(this.hass, 'oil_check'), 'warning');
      case 'service':
        return words(s(this.hass, 'service_due'), 'warning');
      case 'tyre':
        // a line too short for it names the tyres alone, in the warning's ink
        return words(s(this.hass, 'tyre_pressure_low'), 'warning', s(this.hass, 'tyres'));
      case 'open': {
        // an engine's car opens a bonnet where an electric one opens its front boot; a line too short for "Boot open"
        // names the part alone, in the warning's ink, as a car's own display does ("Багажник" at 152)
        const part = r.open === 'frunk' && r.energy !== 'electric' ? 'bonnet' : (r.open ?? 'doors');
        return words(s(this.hass, `${part}_open`), 'warning', s(this.hass, part));
      }
      case 'complete':
        return words(s(this.hass, 'limit_reached'), 'ok', s(this.hass, 'limit_reached_short'));
      case 'waiting':
        return words(s(this.hass, 'waiting'), '');
      case 'stopped':
        return words(s(this.hass, 'not_charging'), '', s(this.hass, 'not_charging_short'));
      case 'cabin': {
        const inside = this.inside();
        return {
          segments: [
            { text: s(this.hass, r.cabin === 'cold' ? 'cold_inside' : 'hot_inside') },
            ...(inside ? [{ text: inside.text, optional: true }] : []),
          ],
          ink: r.cabin === 'cold' ? 'cool' : 'heat',
        };
      }
      case 'unplugged':
        return {
          segments: [
            { text: s(this.hass, 'unplugged') },
            ...(limitText ? [{ text: limitText, optional: true }] : []),
          ],
          ink: '',
        };
      default:
        // a tank says what is in it and when its service is, after a hybrid's limit
        return r.tank
          ? {
              segments: [
                ...(limitText ? [{ text: limitText }] : []),
                ...this.tankRest(r.tank, now),
              ],
              ink: '',
            }
          : words(limitText);
    }
  }

  private renderLine(r: Reading, now: number): TemplateResult | typeof nothing {
    if (this.config?.show_status === false) return nothing;
    if (r.unavailable) return html`<p class="vh-line">—</p>`;
    const line = this.line(r, now);
    const text = fitLine(line.segments, this.contentWidth, (t) =>
      this.head.ruler.width('vh-line', t),
    );
    return html`<p class="vh-line ${line.ink ? `is-${line.ink}` : ''}">${text}</p>`;
  }

  /* ---------- the controls ---------- */

  /** The controls the card shows, as entries, in order: the card's own, else those the car has. */
  private controlEntries(): ControlEntry[] {
    const listed = this.config?.controls;
    if (Array.isArray(listed))
      return listed
        .map(controlEntry)
        .filter((e) =>
          e.control === undefined ? isEntityId(e.entity) : VEHICLE_CONTROLS.includes(e.control),
        );
    return carControls(this.car()).map((control) => ({ control }));
  }

  /** A lock's state in Home Assistant's words, as its round says it. */
  private lockWord(v: EntityView, state: string): string {
    return stateText(this.hass, {
      ...v,
      status: 'ok',
      state,
      ...(v.stateObj ? { stateObj: { ...v.stateObj, state } } : {}),
    });
  }

  /**
   * Every word a control can say, whatever its state now: an opening's name and "Open", each of a lock's states, the
   * climate's off and on and a temperature at its widest, each of the charge's words, the sentry's name.
   */
  private controlWords(key: VehicleControl, name: string, shut: string): readonly string[] {
    const open = this.t('common.open');
    switch (key) {
      case 'lock': {
        const v = this.view('lock');
        return v?.domain === 'lock'
          ? LOCK_STATES.map((state) => this.lockWord(v, state))
          : [this.t('lock.locked'), this.t('lock.unlocked')];
      }
      case 'climate': {
        // a setpoint with its decimal; a cabin's reading below zero, or of three figures (a hot car in °F)
        const unit = this.cabinUnit();
        return [
          this.t('common.off'),
          this.t('common.on'),
          s(this.hass, 'climate'),
          ...[this.figure(88.8, 1), this.figure(-88, 0), this.figure(188, 0)].map(
            (figure) => `${figure} ${unit}`,
          ),
        ];
      }
      case 'charging':
        return (['charging', 'charged', 'plugged', 'stopped', 'unplugged', 'idle'] as const).map(
          (key) => s(this.hass, key),
        );
      case 'windows':
        return [open, shut, s(this.hass, 'vented')];
      case 'engine':
        return [name, s(this.hass, 'engine_running'), this.t('common.off')];
      case 'sentry':
        return [name];
      default:
        return [open, shut];
    }
  }

  /** A control as it stands: its round, its word, what a tap does. */
  private control(entry: ControlEntry, r: Reading): ControlView {
    const key = entry.control;
    if (!key) return this.ownControl(entry);
    const { roles, doors, windows } = this.car();
    const name = entry.name ?? this.t(controlWord(key, r.energy));
    /** What an opening says: its name while shut (the port's short one), "Open" while open (in the warning's ink). */
    const shut = entry.name ?? (key === 'charge_port' ? s(this.hass, 'port') : name);
    const opening = (isOpen: boolean): string => (isOpen ? this.t('common.open') : shut);
    const accent = this.accents.item(entry.color);
    const base = {
      name,
      words: this.controlWords(key, name, shut),
      accent,
      entry,
      ink: '' as ControlView['ink'],
      why: '',
      disabled: false,
    };
    /**
     * Whether a tap asks first (the control's `confirm`, else what it does by default), in its own words where it has
     * them, else in Home Assistant's ("Are you sure?").
     */
    const asks = (byDefault: boolean, text?: string): ActionConfig['confirmation'] =>
      (entry.confirm ?? byDefault) ? (text ? { text } : true) : false;
    const service = (id: string, action: string, confirm = asks(false)): ActionConfig => ({
      action: 'perform-action',
      perform_action: action,
      target: { entity_id: id },
      ...(confirm ? { confirmation: confirm } : {}),
    });
    const toned = (tone: Tone): Tone => (accent && tone === 'accent' ? 'accent' : tone);
    /** A control whose entity cannot be read: its place and its words' room kept, still, its word a dash. */
    const out = (glyphName: string, id: string | undefined): ControlView => ({
      ...base,
      glyph: entry.icon ?? glyphName,
      word: '—',
      tone: 'off',
      entity: id,
      act: undefined,
      disabled: true,
    });
    const open = (v: EntityView): boolean =>
      v.domain === 'cover'
        ? v.state === 'open' || v.state === 'opening'
        : v.domain === 'binary_sensor' || v.domain === 'switch'
          ? v.state === 'on'
          : /open|ajar/.test(v.state.toLowerCase());
    switch (key) {
      case 'lock': {
        const v = this.view('lock');
        if (!v || v.status !== 'ok' || r.unavailable) return out('lock', v?.id);
        const state = this.stateOf(v);
        const locked =
          v.domain === 'lock'
            ? state === 'locked' || state === 'locking'
            : v.domain === 'binary_sensor'
              ? state === 'off'
              : /lock|secur/i.test(state) && !/unlock/i.test(state);
        return {
          ...base,
          glyph: entry.icon ?? (locked ? 'lock' : 'unlock'),
          word:
            v.domain === 'lock'
              ? this.lockWord(v, state)
              : this.t(locked ? 'lock.locked' : 'lock.unlocked'),
          tone: locked ? toned('accent') : 'warning',
          ink: locked ? '' : 'warning',
          entity: v.id,
          act:
            v.domain === 'lock'
              ? locked
                ? service(v.id, 'lock.unlock', asks(true, s(this.hass, 'unlock_confirm')))
                : service(v.id, 'lock.lock', asks(false))
              : undefined,
        };
      }
      case 'climate': {
        const v = this.view('climate') ?? this.view('climate_switch');
        const start = roles.climate_start;
        const running = this.view('climate_running');
        const reading = v ?? running;
        if (!reading && !start) return out('fan', undefined);
        if ((reading && reading.status !== 'ok') || r.unavailable)
          return out('fan', reading?.id ?? start);
        const on = this.climateOn();
        const action =
          reading?.domain === 'climate' ? reading.attr<string>('hvac_action') : undefined;
        const target =
          reading?.domain === 'climate' ? reading.attr<number>('temperature') : undefined;
        const inside = this.inside();
        const warm =
          action === 'heating' || (target !== undefined && inside !== null && target > inside.n);
        const tone: Tone = on ? (action === 'cooling' || !warm ? 'cool' : 'heat') : 'neutral';
        const unit = this.cabinUnit();
        const cabin = r.cabin;
        const word = on
          ? typeof target === 'number'
            ? `${this.figure(target, Number.isInteger(target) ? 0 : 1)} ${unit}`
            : this.t('common.on')
          : cabin && inside
            ? inside.text
            : reading
              ? this.t('common.off')
              : s(this.hass, 'climate');
        const id = reading?.id ?? start;
        const act: ActionConfig | undefined =
          v?.domain === 'climate'
            ? service(v.id, on ? 'climate.turn_off' : 'climate.turn_on')
            : v?.domain === 'switch'
              ? service(v.id, on ? 'switch.turn_off' : 'switch.turn_on')
              : on && roles.climate_stop
                ? service(roles.climate_stop, 'button.press')
                : !on && start
                  ? service(start, 'button.press')
                  : undefined;
        return {
          ...base,
          glyph:
            entry.icon ??
            (on ? (tone === 'heat' ? 'flame' : tone === 'cool' ? 'snow' : 'fan') : 'fan'),
          word,
          tone: toned(tone),
          ink: !on && cabin ? (cabin === 'cold' ? 'cool' : 'heat') : '',
          entity: id,
          act,
        };
      }
      case 'charging': {
        const sw = this.view('charge_switch');
        const reading = sw ?? this.view('charging') ?? this.view('plugged');
        if (!reading && !roles.charge_start) return out('plug', undefined);
        if ((reading && reading.status !== 'ok') || r.unavailable) return out('plug', reading?.id);
        const charging = r.charge === 'charging';
        const unplugged = r.charge === 'unplugged';
        const word =
          r.charge === 'charging'
            ? s(this.hass, 'charging')
            : r.charge === 'complete'
              ? s(this.hass, 'charged')
              : r.charge === 'waiting'
                ? s(this.hass, 'plugged')
                : r.charge === 'stopped' || r.charge === 'error'
                  ? s(this.hass, 'stopped')
                  : r.charge === 'unplugged'
                    ? s(this.hass, 'unplugged')
                    : r.charge === 'idle'
                      ? s(this.hass, 'idle')
                      : '—';
        const stop = asks(true, s(this.hass, 'stop_charge_confirm'));
        // a switch turns by its own state (on while the charge is complete, it turns off), buttons by the charge; the
        // round looks as the charge is
        const on = sw ? this.stateOf(sw) === 'on' : charging;
        const act: ActionConfig | undefined = sw
          ? service(sw.id, on ? 'switch.turn_off' : 'switch.turn_on', on ? stop : asks(false))
          : on && roles.charge_stop
            ? service(roles.charge_stop, 'button.press', stop)
            : !on && roles.charge_start
              ? service(roles.charge_start, 'button.press')
              : undefined;
        // a charge cannot start without its cable
        const cableless = unplugged && Boolean(act) && !on;
        return {
          ...base,
          glyph: entry.icon ?? (charging ? 'bolt' : 'plug'),
          word,
          tone: charging
            ? toned('accent')
            : r.charge === 'complete'
              ? 'ok'
              : r.charge === 'error'
                ? 'warning'
                : 'neutral',
          entity: reading?.id ?? roles.charge_start,
          act: cableless ? undefined : act,
          disabled: cableless,
          why: cableless ? s(this.hass, 'not_plugged') : '',
        };
      }
      case 'charge_port':
      case 'trunk':
      case 'frunk': {
        const role = key;
        const v = this.view(role);
        const closedGlyph = role === 'charge_port' ? 'chargePort' : role;
        if (!v || v.status !== 'ok' || r.unavailable) return out(closedGlyph, v?.id);
        const isOpen = open(v);
        const confirm =
          role === 'trunk'
            ? asks(true, s(this.hass, isOpen ? 'close_trunk_confirm' : 'open_trunk_confirm'))
            : role === 'frunk'
              ? asks(!isOpen, isOpen ? undefined : s(this.hass, 'open_frunk_confirm'))
              : asks(false);
        // a cover opens and, where it can, closes (a front boot only opens); a port's switch toggles
        const closes = v.domain === 'cover' ? v.supports(2) : true;
        const act: ActionConfig | undefined =
          v.domain === 'cover'
            ? isOpen
              ? closes
                ? service(v.id, 'cover.close_cover', confirm)
                : undefined
              : service(v.id, 'cover.open_cover', confirm)
            : v.domain === 'switch'
              ? service(v.id, isOpen ? 'switch.turn_off' : 'switch.turn_on', confirm)
              : undefined;
        const word = opening(isOpen);
        return {
          ...base,
          glyph:
            entry.icon ??
            (isOpen ? (role === 'charge_port' ? 'chargePort' : `${role}Open`) : closedGlyph),
          word,
          tone: isOpen ? (role === 'charge_port' ? toned('accent') : 'warning') : 'neutral',
          ink: isOpen && role !== 'charge_port' ? 'warning' : '',
          entity: v.id,
          act,
        };
      }
      case 'windows': {
        const cover = this.view('windows');
        const sensors = windows.map((id) => this.entity(id));
        if (!cover && !sensors.length) return out('carWindow', undefined);
        const readable = cover ? [cover] : sensors.filter((v) => v.status === 'ok');
        if (!readable.length || (cover && cover.status !== 'ok') || r.unavailable)
          return out('carWindow', cover?.id ?? sensors[0]?.id);
        const opened = readable.filter(open);
        const isOpen = opened.length > 0;
        const word = isOpen && cover ? s(this.hass, 'vented') : opening(isOpen);
        return {
          ...base,
          glyph: entry.icon ?? (isOpen ? 'carWindowOpen' : 'carWindow'),
          word,
          tone: isOpen ? 'warning' : 'neutral',
          ink: isOpen ? 'warning' : '',
          entity: (opened[0] ?? readable[0])?.id,
          act: cover
            ? isOpen
              ? service(
                  cover.id,
                  'cover.close_cover',
                  asks(true, s(this.hass, 'close_windows_confirm')),
                )
              : service(cover.id, 'cover.open_cover', asks(true, s(this.hass, 'vent_confirm')))
            : undefined,
        };
      }
      case 'doors': {
        const sensors = doors.map((id) => this.entity(id));
        const readable = sensors.filter((v) => v.status === 'ok');
        if (!readable.length || r.unavailable) return out('carDoor', sensors[0]?.id);
        const opened = readable.filter(open);
        return {
          ...base,
          glyph: entry.icon ?? (opened.length ? 'carDoorOpen' : 'carDoor'),
          word: opening(opened.length > 0),
          tone: opened.length ? 'warning' : 'neutral',
          ink: opened.length ? 'warning' : '',
          entity: (opened[0] ?? readable[0])?.id,
          act: undefined,
        };
      }
      case 'engine': {
        // a switch starts it and stops it, a button starts it: each asks first, where its `confirm` does not say not to
        const v = this.view('engine');
        if (!v || !isUsable(v) || r.unavailable) return out('engine', v?.id);
        const switched = v.domain === 'switch';
        const running = switched && this.stateOf(v) === 'on';
        const ask = (stop: boolean) =>
          asks(true, s(this.hass, stop ? 'stop_engine_confirm' : 'start_engine_confirm'));
        return {
          ...base,
          glyph: entry.icon ?? 'engine',
          word: switched ? (running ? s(this.hass, 'engine_running') : this.t('common.off')) : name,
          tone: running ? toned('accent') : 'neutral',
          entity: v.id,
          act: switched
            ? service(v.id, running ? 'switch.turn_off' : 'switch.turn_on', ask(running))
            : service(v.id, 'button.press', ask(false)),
        };
      }
      case 'sentry': {
        const v = this.view('sentry');
        if (!v || v.status !== 'ok' || r.unavailable) return out('shield', v?.id);
        const on = this.stateOf(v) === 'on';
        return {
          ...base,
          glyph: entry.icon ?? 'shield',
          word: name,
          tone: on ? toned(accent ? 'accent' : 'armed') : 'neutral',
          entity: v.id,
          act: on
            ? service(v.id, 'switch.turn_off', asks(true, s(this.hass, 'sentry_off_confirm')))
            : service(v.id, 'switch.turn_on'),
        };
      }
    }
  }

  /**
   * What the rounds reach of the card: its house, its names, its states as drawn, its calls and its colours; a tap on
   * and off for what a person puts among its controls on purpose (a switch, a button, a script, a scene), as a room's
   * quick actions take one.
   */
  private host(): RoundsHost {
    return {
      hass: this.hass,
      toggles: TOGGLE_DOMAINS,
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

  /**
   * An entity of the person's own among the controls (#248), as every card draws its round (`roundOf`): its name, its
   * glyph, lit in its tone (its colour) while on, the dashed circle out of reach; its tap — its own, else on and off
   * where its kind takes one, else its details — asking first where `confirm` says so (never before its details open),
   * its hold its details. In the car's cell, its name its word (cut to an ellipsis, as a name may be), which never
   * widens the row: a row's cells are laid out by the car's own words.
   */
  private ownControl(entry: ControlEntry): ControlView {
    const host = this.host();
    const id = entry.entity ?? '';
    const item: RoundSpec = {
      group: 'entity',
      entity: id,
      ...(entry.name ? { name: entry.name } : {}),
      ...(entry.icon ? { icon: entry.icon } : {}),
      ...(entry.color ? { color: entry.color } : {}),
      ...(entry.tap_action ? { tap_action: entry.tap_action } : {}),
      ...(entry.hold_action ? { hold_action: entry.hold_action } : {}),
      ...(entry.double_tap_action ? { double_tap_action: entry.double_tap_action } : {}),
    };
    const view = this.entity(id);
    const tap = roundTap(host, item, view.domain);
    const acts = tap.action !== 'more-info' && tap.action !== 'none';
    const round = roundOf(
      host,
      acts && entry.confirm !== undefined
        ? {
            ...item,
            tap_action: { ...tap, confirmation: entry.confirm && (tap.confirmation ?? true) },
          }
        : item,
    );
    return {
      name: round.name,
      glyph: round.glyph,
      word: round.name,
      words: [],
      tone: !round.usable ? 'off' : round.on ? round.tone : 'neutral',
      ink: '',
      entity: view.id,
      act: undefined,
      disabled: !round.usable,
      why: '',
      accent: round.on ? round.accent : undefined,
      entry,
      own: { onTap: round.onTap, onHold: round.onHold, state: stateText(this.hass, view) },
    };
  }

  /**
   * How many controls a row holds: as many cells of 56 at least as the column takes, fewer while a word (each at its
   * widest, so a state that changes never moves the row) would not keep 2 of its cell clear — never a word cut: the
   * words of all of them where they wrap into rows (`wrap`), of the first `n` where the rest give way. The rounds alone
   * (compact) need their 44 and 8 between.
   */
  private controlColumns(views: readonly ControlView[], words: boolean, wrap: boolean): number {
    const w = this.contentWidth;
    const fit = (n: number): boolean => {
      if (!words) return w / n >= 44 + 8;
      const cell = w / n;
      return (
        cell >= CELL_MIN &&
        (wrap ? views : views.slice(0, n)).every((view) =>
          view.words.every(
            (word) => this.head.ruler.width('vh-control__word', word) <= cell - WORD_CLEAR,
          ),
        )
      );
    };
    for (let n = views.length; n > 1; n--) if (fit(n)) return n;
    return 1;
  }

  /** Runs a control's tap: its own action, else what it does on the car, else its details. */
  private press(view: ControlView): void {
    const own = view.entry.tap_action;
    if (own) this.tap(view.entity, own);
    else if (view.act) {
      // a lock or a switch moves under the finger: its new state is drawn until Home Assistant says it
      const service = view.act.perform_action ?? '';
      if (!view.act.confirmation && view.entity) {
        const next = /\.(lock)$/.test(service)
          ? 'locking'
          : /\.(unlock)$/.test(service)
            ? 'unlocking'
            : /turn_on$/.test(service)
              ? 'on'
              : /turn_off$/.test(service)
                ? 'off'
                : '';
        if (next && /^(lock|switch)\./.test(view.entity)) this.expect(view.entity, next);
      }
      this.tap(view.entity, view.act);
    } else this.tap(view.entity, { action: 'more-info' });
  }

  private renderControls(r: Reading, bare: boolean): TemplateResult | typeof nothing {
    if (this.config?.show_controls === false) return nothing;
    let views = this.controlEntries().map((entry) => this.control(entry, r));
    // a car with none of them keeps the row: its lock and its climate, still (1.9: a card keeps its size)
    if (!views.length)
      views = DEFAULT_CONTROLS.slice(0, 2).map((control) => this.control({ control }, r));
    // the card's own list wraps into rows as even as they come (nine are five and four, the shorter row centred);
    // the car's own keeps one row, those that do not hold it giving way in their order
    const listed = Array.isArray(this.config?.controls);
    const most = this.controlColumns(views, !bare, listed);
    const shown = listed ? views : views.slice(0, most);
    const columns = Math.ceil(shown.length / Math.ceil(shown.length / most));
    return html`<div
      class="vh-controls ${bare ? 'vh-controls--bare' : ''}"
      style="--vh-cols:${columns}"
    >
      ${shown.map((view) => this.renderControl(view, bare))}
    </div>`;
  }

  private renderControl(view: ControlView, bare: boolean): TemplateResult {
    const hold = view.entry.hold_action;
    const { own } = view;
    const onHold = own
      ? own.onHold
      : (): void => this.hold(view.entity, hold ?? { action: 'more-info' });
    const label = own
      ? `${view.name} · ${own.state}`
      : view.why
        ? `${said(view)} · ${view.why}`
        : said(view);
    return html`<button
      class="vh-control"
      data-target
      data-accent=${view.accent ?? nothing}
      aria-label=${label}
      title=${label}
      aria-disabled=${view.disabled ? 'true' : nothing}
      ?disabled=${view.tone === 'off'}
      .fvTap=${
        own
          ? own.onTap
          : this.tapper(
              view.entry.double_tap_action,
              `control_${view.entry.control}`,
              () => this.press(view),
              this.runner(view.entry.double_tap_action, view.entity),
            )
      }
      .fvHold=${onHold as PressTarget['fvHold']}
      @pointerdown=${startPress}
      @contextmenu=${preventMenu}
      @click=${view.disabled ? (event: Event) => event.preventDefault() : clickPress}
      @keydown=${onHold ? holdKey(onHold) : nothing}
    >
      <span class="fv-ico fv-ico--${view.tone}">${icon(view.glyph, 'car')}</span>
      ${
        bare
          ? nothing
          : own
            ? html`<span class="vh-control__word is-name" data-name>${view.word}</span>`
            : html`<span class="vh-control__word ${view.ink ? `is-${view.ink}` : ''}"
                >${view.word}</span
              >`
      }
    </button>`;
  }

  /* ---------- the quick actions ---------- */

  /** The quick actions the card lists (#251): an entity's rounds, a word it does not know left out. */
  private quickActions(): RoundSpec[] {
    const listed = this.config?.quick_actions;
    return Array.isArray(listed) && this.variant !== 'mini'
      ? roundsOf({ hass: this.hass }, listed)
      : [];
  }

  /**
   * The quick actions at the foot (#251), as a room's are drawn (`roundsIn`): 44 rounds 8 apart from the line's start,
   * as many as it holds, those that do not giving way from the end; each lit in its tone while on, its tap and its
   * hold, its state in a pill where asked (under its glyph, the line 64 tall, or beside it). The line keeps its place
   * while none of them can be drawn: the card's height is its config's.
   */
  private renderQuick(): TemplateResult | typeof nothing {
    const c = this.config;
    if (!c || this.variant === 'mini' || !Array.isArray(c.quick_actions) || !c.quick_actions.length)
      return nothing;
    const look = { ...c, states: c.show_quick_states, beside: c.quick_state_position === 'beside' };
    // the line starts at the column's edge: none of the 12 a room's rounds keep from what is before them
    const { template } = roundsIn(
      { ...this.host(), look },
      this.quickActions(),
      this.contentWidth + 12,
    );
    return html`<div class="vh-quick ${statesUnder(c) ? 'is-under' : ''}">${template}</div>`;
  }

  /* ---------- the rows ---------- */

  private rowEntries(): RowEntry[] {
    if (this.config?.show_rows === false || this.variant !== 'full') return [];
    const listed = this.config?.rows;
    return (Array.isArray(listed) ? listed : DEFAULT_ROWS).map(rowEntry);
  }

  /** A row's words: its name, its glyph, its value, the entity it opens. */
  private rowOf(
    entry: RowEntry,
    r: Reading,
  ): { title: string; glyph: string; value: string; entity: string | undefined; tone: Tone } {
    const read = (v: EntityView | undefined, digits?: number): string => {
      if (!v) return '—';
      if (v.status !== 'ok') return '—';
      if (v.number === null) return stateText(this.hass, v);
      return `${this.figure(v.number, digits ?? (Number.isInteger(v.number) ? 0 : 1))}${v.unit ? ` ${v.unit}` : ''}`;
    };
    if (!entry.row) {
      const v = entry.entity ? this.entity(entry.entity) : undefined;
      return {
        title: v ? this.nameFor(v, entry.name) : (textName(entry.name) ?? '—'),
        glyph: entry.icon ?? 'dots',
        value: read(v),
        entity: v?.id,
        tone: 'neutral',
      };
    }
    const key = entry.row;
    const title = textName(entry.name) ?? s(this.hass, key);
    const GLYPHS: Readonly<Record<VehicleRow, string>> = {
      location: 'pin',
      odometer: 'odometer',
      inside: 'thermo',
      outside: 'thermo',
      charge_power: 'bolt',
      charge_rate: 'bolt',
      charge_limit: 'battery',
      time_to_full: 'clock',
      software: 'update',
      speed: 'odometer',
      // the drop it wore before the set had a pump, where the card draws no tank
      fuel: r.tank ? 'fuel' : 'drop',
      fuel_range: 'fuel',
      fuel_volume: 'fuel',
      adblue: 'drop',
      oil: 'oil',
      service: 'wrench',
    };
    const glyphName = entry.icon ?? GLYPHS[key];
    const at = (value: string, entity: string | undefined, tone: Tone = 'neutral') => ({
      title,
      glyph: glyphName,
      value: r.unavailable ? '—' : value,
      entity,
      tone,
    });
    switch (key) {
      case 'location':
        return at(r.place || '—', this.car().roles.location);
      case 'odometer':
      case 'fuel_range': {
        const v = this.view(key);
        if (!v || v.status !== 'ok' || v.number === null) return at('—', v?.id);
        return at(this.distanceText({ ...v, number: v.number }), v.id);
      }
      case 'fuel_volume': {
        const v = this.view('fuel_volume');
        if (!v || v.status !== 'ok' || v.number === null) return at('—', v?.id);
        return at(`${this.figure(v.number, /gal/i.test(v.unit) ? 1 : 0)} ${v.unit}`, v.id);
      }
      case 'adblue':
      case 'oil': {
        // a level or how far it lasts; a warning's own words where that is all it says
        const now = this.now();
        const reading = this.upkeep(key, now);
        const low = key === 'adblue' ? lowAdBlue(reading) : oilToCheck(reading);
        const value =
          reading?.kind === 'warning'
            ? s(this.hass, low ? (key === 'adblue' ? 'level_low' : 'check') : 'level_ok')
            : this.upkeepText(key, now) || '—';
        return at(value, this.car().roles[key], low ? 'warning' : 'neutral');
      }
      case 'service': {
        // how far and how long to it ("4,200 km · 63 d"), "Due" once either has run out
        const now = this.now();
        const { roles } = this.car();
        const readings = [this.upkeep('service', now), this.upkeep('service_time', now)];
        const due = serviceDue(...readings);
        const parts = [this.upkeepText('service', now), this.upkeepText('service_time', now)];
        const value = due
          ? s(this.hass, 'due')
          : parts.filter(Boolean).join(' · ') ||
            (readings.some((reading) => reading?.kind === 'warning')
              ? s(this.hass, 'level_ok')
              : '—');
        return at(value, roles.service ?? roles.service_time, due ? 'warning' : 'neutral');
      }
      case 'inside': {
        const v = this.view('inside');
        const inside = this.inside();
        return at(inside?.text ?? '—', v?.id ?? this.car().roles.climate);
      }
      case 'charge_power': {
        const watts = this.watts();
        return at(watts === null ? '—' : this.powerText(watts), this.car().roles.charge_power);
      }
      case 'charge_limit':
        return at(
          r.limit === null ? '—' : `${this.figure(r.limit, 0)} %`,
          this.car().roles.charge_limit,
        );
      case 'time_to_full': {
        const eta = r.charge === 'charging' ? this.eta(this.now()) : null;
        return at(eta ? spanText(this.hass, eta.left) : '—', this.car().roles.time_to_full);
      }
      case 'software': {
        const v = this.view('software');
        return at(
          v ? stateText(this.hass, v) : '—',
          v?.id,
          v?.state === 'on' ? 'accent' : 'neutral',
        );
      }
      default: {
        const v = this.view(key);
        return at(read(v, 0), v?.id);
      }
    }
  }

  private renderRows(r: Reading): TemplateResult | typeof nothing {
    const entries = this.rowEntries();
    if (!entries.length) return nothing;
    const rows = entries.map((entry) => ({ entry, ...this.rowOf(entry, r) }));
    // a row's name is a label and its value a figure: neither is cut. The circles give way together where a row's
    // words would not hold beside one, then every value goes under its name, in the row's 48 (20, 4, 20)
    const w = this.contentWidth;
    const holds = (room: number): boolean =>
      rows.every(
        ({ title, value }) =>
          this.head.ruler.width('fv-row__title', title) +
            12 +
            this.head.ruler.width('fv-row__value', value) <=
          room,
      );
    const keep = holds(w - 40 - 12);
    const stack = !keep && !holds(w);
    return html`<div class="vh-rows">
      ${rows.map(({ entry, title, glyph: g, value, entity, tone }) => {
        const accent = this.accents.item(entry.color);
        return listRow({
          icon: keep ? g : null,
          tone: accent ? 'accent' : r.unavailable ? 'off' : tone,
          title,
          value,
          trailing: 'value',
          compact: true,
          stack,
          unavailable: r.unavailable,
          accent,
          // its details by default; a hold and a double tap where it has them
          ...this.pressOf(entry, entity, MORE_INFO, null),
        });
      })}
    </div>`;
  }

  /* ---------- the tyres ---------- */

  /**
   * The decimals every tyre is written in (one count for all four): the card's `tyre_decimals`, else their sensors'
   * display precision where Home Assistant's registry gives one, else one where they read under 10 (a bar's 2.3), none
   * above (a psi's 36, a kPa's 230).
   */
  private tyreDigits(views: readonly (EntityView | undefined)[]): number {
    const precisions = views.flatMap((v) => {
      const precision = v ? this.hass?.entities?.[v.id]?.display_precision : undefined;
      return typeof precision === 'number' && Number.isFinite(precision) ? [precision] : [];
    });
    return this.digits(
      this.config?.tyre_decimals,
      precisions.length ? Math.max(...precisions) : this.tyreScale(views) < 10 ? 1 : 0,
    );
  }

  /**
   * The pressure under which a tyre is low (`tyre_low`, #251), and the unit it is said in where it says one: a figure
   * in the tyres' unit, an entity's reading in its own, a template's answer in the tyres'; none where it cannot be read
   * (a template Home Assistant has not answered yet). The one place it is read.
   */
  private tyreLow(): { readonly value: number; readonly unit: string } | null {
    const own = this.config?.tyre_low;
    if (typeof own === 'number') return Number.isFinite(own) ? { value: own, unit: '' } : null;
    if (isEntityId(own)) {
      this.follows(own);
      const v = this.entity(own);
      return v.status === 'ok' && v.number !== null ? { value: v.number, unit: v.unit } : null;
    }
    const text = (this.ownText(own, false)?.text ?? '').trim().replace(',', '.');
    const value = Number(text);
    return text && Number.isFinite(value) ? { value, unit: '' } : null;
  }

  /** How large the tyres' figures run: their highest reading, else (out of reach) a car's usual 3 bar in their unit. */
  private tyreScale(views: readonly (EntityView | undefined)[]): number {
    const read = views.flatMap((v) => (v?.status === 'ok' && v.number !== null ? [v.number] : []));
    return read.length
      ? Math.max(...read.map(Math.abs))
      : convertPressure(3, 'bar', views.find((v) => v?.unit)?.unit ?? 'bar');
  }

  /**
   * The four tyres, front left to rear right: each one's pressure, all four in the same decimals (`tyreDigits`), or
   * where it has none what its warning says; low where its integration's warning is on (or its warning of every
   * tyre), or where it reads under `tyre_low` (said in another unit of pressure, brought to the tyre's).
   */
  private tyres(unavailable: boolean): Tyre[] {
    const { warnings } = this.car();
    const on = (id: string | undefined): boolean => Boolean(id) && this.entity(id).state === 'on';
    const all = on(warnings.all);
    const views = WHEELS.map((wheel) => this.view(`tyre_${wheel}`));
    const decimals = this.tyreDigits(views);
    const under = this.tyreLow();
    return WHEELS.map((wheel, index) => {
      const v = views[index];
      const read = v?.status === 'ok' && !unavailable ? v.number : null;
      const low =
        !unavailable &&
        (on(warnings[wheel]) ||
          all ||
          (read !== null &&
            under !== null &&
            read < convertPressure(under.value, under.unit || (v?.unit ?? ''), v?.unit ?? '')));
      // a tyre with no pressure of its own says what its warning says
      const value =
        read !== null
          ? formatNumber(this.hass, read, { digits: decimals, minDigits: decimals })
          : !v && warnings[wheel]
            ? s(this.hass, low ? 'tyre_low' : 'tyre_ok')
            : '—';
      return {
        wheel,
        value,
        unit: read !== null && v ? v.unit : '',
        low,
        id: v?.id ?? warnings[wheel],
      };
    });
  }

  private renderTyres(r: Reading): TemplateResult | typeof nothing {
    if (this.config?.show_tyres !== true || this.variant !== 'full') return nothing;
    const { tyres } = r;
    // the car from above gives way where a column would not hold the widest pressure beside it: the widest its
    // figures run to, in their decimals and their unit, whatever they read now
    const views = WHEELS.map((wheel) => this.view(`tyre_${wheel}`));
    const decimals = this.tyreDigits(views);
    const whole = String(Math.trunc(this.tyreScale(views))).length;
    const sample = formatNumber(this.hass, Number(`${'8'.repeat(whole)}.${'8'.repeat(decimals)}`), {
      digits: decimals,
      minDigits: decimals,
    });
    const widest = Math.max(
      ...tyres.map((t) => this.head.ruler.width('vh-tyre', t.value, 'fv-unit', t.unit)),
      this.head.ruler.width(
        'vh-tyre',
        sample,
        'fv-unit',
        views.find((v) => v?.unit)?.unit ?? 'bar',
      ),
    );
    const bare = (this.contentWidth - 32 - CAR_WIDTH - 24) / 2 < widest;
    // …then, where two columns would not hold it either (half a section), each unit goes under its figure
    const stacked = bare && (this.contentWidth - 32 - 12) / 2 < widest;
    const low = Object.fromEntries(tyres.map((t) => [t.wheel, t.low]));
    const label = (t: Tyre): string =>
      `${s(this.hass, `tyre_${t.wheel}`)} · ${t.value}${t.unit ? ` ${t.unit}` : ''}`;
    return html`<div
      class="vh-tyres ${bare ? 'is-bare' : ''} ${stacked ? 'is-stacked' : ''}"
      role="group"
      aria-label=${s(this.hass, 'tyres')}
      @click=${() => this.tap(tyres.find((t) => t.low)?.id ?? tyres[0]?.id, { action: 'more-info' })}
    >
      ${bare ? nothing : carFromAbove(low)}
      ${tyres.map(
        (t, index) =>
          html`<span
            class="vh-tyre ${index % 2 ? '' : 'is-left'} ${t.low ? 'is-low' : ''}"
            style="grid-row:${index < 2 ? 1 : 2};grid-column:${bare ? (index % 2) + 1 : index % 2 ? 3 : 1}"
            aria-label=${label(t)}
            >${t.value}${t.unit ? html`<span class="fv-unit">${t.unit}</span>` : nothing}</span
          >`,
      )}
    </div>`;
  }

  /* ---------- the picture ---------- */

  private pictured?: { registry: unknown; device: string | undefined; id: string | undefined };

  /** The car's device's own image entity (`image: auto`), looked up once a registry and a device. */
  private devicePicture(): string | undefined {
    const registry = this.hass?.entities;
    const device = vehicleDevice(this.hass, this.config?.device, this.config?.entity);
    let pictured = this.pictured;
    if (!pictured || pictured.registry !== registry || pictured.device !== device) {
      const id = Object.values(registry ?? {}).find(
        (entry) => entry.device_id === device && entry.entity_id.startsWith('image.'),
      )?.entity_id;
      pictured = this.pictured = { registry, device, id };
    }
    return pictured.id;
  }

  /** The car's picture: the address the card gives, an entity's own, or (`auto`) the integration's. */
  private pictureSrc(): string {
    const image = this.config?.image?.trim() ?? '';
    if (image !== 'auto') return imageOf(this.hass, image);
    return (
      imageOf(this.hass, this.devicePicture()) || imageOf(this.hass, this.car().roles.location)
    );
  }

  /**
   * The car's picture: in the head, or over the battery at its size (`image_size`, #254) — there the card's button
   * where the head is hidden (`press`: its tap and hold), named by the car.
   */
  private picture(lead: boolean, press?: Press, name = ''): TemplateResult {
    const src = this.pictures.shown(this.pictureSrc());
    const plate = lead || !this.config ? null : picturePlate(this.config, this.contentWidth);
    const cover =
      press?.onTap || press?.onHold ? pressCover(name, press.onTap, press.onHold) : nothing;
    return html`<span
      class="${lead ? 'vh-face' : 'vh-picture'} ${src ? '' : 'is-empty'}"
      style=${plate ? `width:${plate.width}px;height:${plate.height}px` : nothing}
      aria-hidden=${cover === nothing ? 'true' : nothing}
      >${src ? html`<img src=${src} alt="" @error=${this.pictures.failed} />` : glyph('car')}${cover}</span
    >`;
  }

  /* ---------- render ---------- */

  protected renderCard(): TemplateResult {
    const c = this.config;
    const { roles, doors, windows } = this.car();
    if (!Object.keys(roles).length && !doors.length && !windows.length)
      return this.renderEmpty(s(this.hass, 'no_vehicle'));
    const now = this.now();
    const r = this.reading(now);
    this.timed = r.charge === 'charging' || Boolean(r.stale) || Boolean(this.view('updated'));
    if (this.variant === 'mini') return this.renderMini(r);
    const at = c ? pictureAt(c) : null;
    // the head and the battery as the config shows them (#254): the picture is the card's button where the head is not
    const headed = c?.show_head !== false;
    return html`<article class="fv-card vh-card ${r.unavailable ? 'is-unavailable' : ''}" data-card>
      ${headed ? this.renderHead(r, at === 'head') : nothing}
      ${
        at === 'hero' && this.variant === 'full'
          ? this.picture(
              false,
              headed ? undefined : this.headActions(this.leadEntity(r) ?? c?.entity),
              r.name,
            )
          : nothing
      }
      ${c?.show_hero !== false ? this.renderHeroes(r) : nothing} ${this.renderLine(r, now)}
      ${this.renderControls(r, this.variant === 'compact')}
      ${this.variant === 'full' ? html`${this.renderRows(r)}${this.renderTyres(r)}` : nothing}
      ${this.renderQuick()}
    </article>`;
  }

  /**
   * The gauges the car draws: its battery, its tank, or a hybrid's both (the battery first) — the battery's in the
   * card's colour, a lone tank's too (the gas tone where the card names none), a hybrid's tank in the gas tone beside it.
   */
  private gauges(r: Reading): Gauge[] {
    const { roles } = this.car();
    const battery: Gauge = {
      label: s(this.hass, 'battery'),
      level: r.level,
      amount: null,
      range: r.range,
      rangeUnit: this.rangeUnit(),
      limit: this.config?.show_limit !== false && r.limit !== null ? r.limit : null,
      low: r.low,
      tone: toneOf(this.config, 'accent'),
      entity: roles.battery,
      glyph: 'battery',
    };
    if (!r.tank) return [battery];
    const tank: Gauge = {
      label: s(this.hass, 'fuel'),
      level: r.tank.level,
      amount: r.tank.level === null ? r.tank.volume : null,
      range: r.tank.range,
      rangeUnit: this.rangeUnit(roles.fuel_range || r.energy === 'hybrid' ? 'fuel_range' : 'range'),
      limit: null,
      low: r.tank.low,
      tone: r.energy === 'fuel' ? toneOf(this.config, 'gas') : 'gas',
      entity: this.tankEntity(),
      glyph: 'fuel',
    };
    return r.energy === 'fuel' ? [tank] : [battery, tank];
  }

  /** The heroes: each gauge on its ruler (or a lone one as a ring), or the compact card's bars. */
  private renderHeroes(r: Reading): TemplateResult | TemplateResult[] {
    const gauges = this.gauges(r);
    const [lone] = gauges.length === 1 ? gauges : [];
    if (this.variant === 'compact')
      return lone ? this.renderBar(r, lone, false) : gauges.map((g) => this.renderBar(r, g, true));
    if (lone)
      return this.config?.hero === 'ring' ? this.renderRing(r, lone) : this.renderRuler(r, lone);
    return gauges.map((g) => this.renderRuler(r, g));
  }

  /**
   * The head: the car (its circle, or its picture in the circle's place), its name, where it is and how long since it
   * last said anything, and what it does in the badge — which gives way first, as badges do.
   */
  private renderHead(r: Reading, picture: boolean): TemplateResult {
    const w = this.contentWidth;
    // where it is, where no row says it (its address away from home, which no row holds), and how long it has said nothing
    const placeInRows = this.rowEntries().some((entry) => entry.row === 'location');
    const place = placeInRows ? '' : r.place;
    const line = (...parts: string[]): string => parts.filter(Boolean).join(' · ');
    // the compact card has no value row: how far it goes leads the line (a hybrid's, on both)
    const reach = this.reach(r);
    const range =
      this.variant === 'compact' && this.config?.show_range !== false && reach.number !== null
        ? `${reach.value} ${reach.unit}`
        : '';
    const sub = line(range, r.address || place, r.stale);
    // an address too long for the line gives way to the place's word, then to the time alone: never cut
    const shorter = r.address
      ? [line(range, place, r.stale), line(range, r.stale), range]
      : [line(range, r.stale), range];
    // a picture in the head is 64 wide, the circle 44: the head is fitted as if its column were 20 narrower
    const fit = (line: string, forms: readonly string[]) =>
      this.head.fit({
        width: picture ? w - 20 : w,
        title: r.name,
        sub: line,
        shorter: forms,
        badge: r.badge,
        badgeFirst: true,
        ...(picture ? { icon: 'always' as const } : {}),
      });
    let fitted = fit(sub, shorter);
    // what it does outranks where it is: an address that would take the badge's room gives way to the place's word
    if (r.address && fitted.badge === nothing) fitted = fit(shorter[0] ?? '', shorter.slice(1));
    const tone: Tone = r.unavailable ? 'off' : r.tone;
    return head({
      icon: fitted.icon ? (this.config?.icon ?? 'car') : null,
      small: fitted.small,
      ...(picture && fitted.icon ? { lead: this.picture(true) } : {}),
      tone,
      title: r.name,
      sub: fitted.sub,
      trailing: fitted.badge,
      name: true,
      cut: fitted.cut,
      ...this.headActions(this.leadEntity(r) ?? this.config?.entity),
    });
  }

  /** What the head and the strip open: the battery, or a lone tank. */
  private leadEntity(r: Reading): string | undefined {
    return r.energy === 'fuel' ? this.tankEntity() : this.car().roles.battery;
  }

  /** A gauge's figure as a reader hears it: its level, what is in the tank, or the dash. */
  private gaugeText(g: Gauge): string {
    if (g.amount) return `${g.amount.value} ${g.amount.unit}`;
    return g.level === null ? '—' : `${this.figure(g.level, 0)} %`;
  }

  /**
   * A gauge's own tap, hold and double tap (its details by default, the hold and the double where set), over its value
   * row and ruler.
   */
  private heroCover(g: Gauge): TemplateResult | typeof nothing {
    const config = this.config;
    const { onTap, onHold } = this.pressOf(
      {
        tap_action: config?.hero_tap_action,
        hold_action: config?.hero_hold_action,
        double_tap_action: config?.hero_double_tap_action,
      },
      g.entity,
      MORE_INFO,
      null,
    );
    return pressCover(`${g.label} · ${this.gaugeText(g)}`, onTap, onHold);
  }

  /**
   * A gauge on the charge cards' ruler: its level (what is in a tank where it has no level) and its range over it, a
   * battery's limit marked.
   */
  private renderRuler(r: Reading, g: Gauge): TemplateResult {
    const w = this.contentWidth;
    const tone: Tone = r.unavailable ? 'off' : g.low ? 'warning' : g.tone;
    const showRange = this.config?.show_range !== false;
    const main = {
      label: g.label,
      value: g.amount?.value ?? (g.level === null ? '—' : this.figure(g.level, 0)),
      unit: g.amount?.unit ?? (g.level === null ? '' : '%'),
    };
    const range = s(this.hass, 'range');
    const side = showRange
      ? { figure: { label: range, value: g.range.value, unit: g.range.unit } }
      : null;
    // laid out for its widest figures — a full charge (a full tank's contents), a range of three figures — so a car
    // charging, driving or out of reach never moves the row
    const forms = {
      main: [
        main,
        { ...main, value: this.figure(100, 0), unit: '%' },
        ...(g.amount ? [{ ...main, value: this.figure(888, 0), unit: g.amount.unit }] : []),
      ],
      side: side
        ? [side.figure, { label: range, value: this.figure(888, 0), unit: g.rangeUnit }]
        : [],
    };
    return html`<div class="vh-hero ${g.low && !r.unavailable ? 'is-low' : ''}">
      ${valueRow(this.head.ruler, w, main, side, forms)}
      ${markedRuler({
        hass: this.hass,
        width: w,
        value: r.unavailable ? null : g.level,
        tone,
        mark: g.limit !== null ? { percent: g.limit, text: s(this.hass, 'limit') } : null,
        label: `${r.name} · ${g.label}`,
        measure: (text) => this.head.ruler.width(MARK_LABEL, text),
      })}
      ${this.heroCover(g)}
    </div>`;
  }

  /** A gauge as a ring: its level (or what is in a tank) in the disc, its range under it, a limit a dot outside it. */
  private renderRing(r: Reading, g: Gauge): TemplateResult {
    const w = this.contentWidth;
    const radius = Math.min(
      RING_MAX,
      Math.max(RING_MIN, Math.floor((w / 2 - RING_TICK - 12) / 4) * 4),
    );
    const tone: Tone = r.unavailable ? 'neutral' : g.low ? 'warning' : g.tone;
    const dash = (g.level === null && !g.amount) || r.unavailable;
    const level = dash ? null : g.level;
    const sub =
      this.config?.show_range !== false
        ? `${g.range.value}${g.range.unit ? ` ${g.range.unit}` : ''}`
        : '';
    return html`<div class="vh-hero vh-dial">
      <fluvy-dial
        gauge
        .radius=${radius}
        .tick=${RING_TICK}
        .large=${true}
        .stepper=${false}
        .tone=${tone}
        .min=${0}
        .max=${100}
        .fill=${level === null ? 0 : level / 100}
        .value=${level ?? undefined}
        .format=${level === null ? undefined : (n: number) => this.figure(n, 0)}
        .text=${dash ? '—' : level === null ? g.amount?.value : undefined}
        .unit=${dash ? '' : level === null ? (g.amount?.unit ?? '') : '%'}
        .label=${g.label}
        .sub=${sub}
        .current=${g.limit ?? undefined}
        ?disabled=${r.unavailable}
      ></fluvy-dial>
      ${this.heroCover(g)}
    </div>`;
  }

  /**
   * The compact card's gauge: its bar with a limit marked, its figure at the end; a hybrid's two each led by its glyph.
   */
  private renderBar(r: Reading, g: Gauge, led: boolean): TemplateResult {
    const tone: Tone = r.unavailable ? 'off' : g.low ? 'warning' : g.tone;
    const level = r.unavailable ? null : g.level;
    const widest = (unit: string) =>
      this.head.ruler.width('vh-bar__value', `${this.figure(g.amount ? 888 : 100, 0)} ${unit}`);
    const room = g.amount ? Math.max(widest('%'), widest(g.amount.unit)) : widest('%');
    return html`<div class="vh-hero">
      <div class="vh-bar fv-tone--${tone}" style="--vh-pct:${room}px">
        ${led ? html`<span class="vh-bar__glyph" aria-hidden="true">${icon(g.glyph)}</span>` : nothing}
        <span class="vh-bar__track" data-measure="value"
          ><span class="vh-bar__fill" style="width:${level ?? 0}%"></span>${
            g.limit !== null
              ? html`<span class="vh-bar__mark" style="left:${g.limit}%"></span>`
              : nothing
          }</span
        >
        <span class="vh-bar__value">${r.unavailable ? '—' : this.gaugeText(g)}</span>
      </div>
      ${this.heroCover(g)}
    </div>`;
  }

  /**
   * The strip: the car's circle ringed by its charge, its name over its charge, its range and what it does, and its
   * first control as a round — the strip is the card's button (a cover over it), the round raised beside it.
   */
  private renderMini(r: Reading): TemplateResult {
    const circumference = 2 * Math.PI * STRIP_RADIUS;
    const [lead, tank] = this.gauges(r);
    const gauge = lead as Gauge;
    const level = r.unavailable ? null : gauge.level;
    const tone: Tone = r.unavailable
      ? 'off'
      : gauge.low
        ? 'warning'
        : r.charge === 'charging'
          ? r.tone
          : gauge.tone;
    const [first] = this.controlEntries();
    // the strip's padding is 16: its words have the column less the ring's 44 and 12, and the round's where it holds
    const words = this.contentWidth + 8 - 44 - 12;
    const control =
      this.config?.show_controls === false || !first || words - 44 - 12 < ROW_NAME_MIN
        ? undefined
        : this.control(first, r);
    const room = words - (control ? 44 + 12 : 0);
    const reach = this.reach(r);
    // out of reach, the line says so alone, as a small tile does (the dash where the word would not hold); a hybrid
    // says its tank after its charge, and how far it goes on both
    const segments: Segment[] = r.unavailable
      ? [{ text: this.t('state.unavailable'), short: '—' }]
      : [
          { text: level === null && !gauge.amount ? '—' : this.gaugeText(gauge) },
          ...(tank
            ? [
                {
                  text:
                    tank.level === null
                      ? `${tank.label} ${this.gaugeText(tank)}`
                      : s(this.hass, 'fuel_of', { percent: this.figure(tank.level, 0) }),
                  optional: true,
                },
              ]
            : []),
          ...(this.config?.show_range !== false && reach.number !== null
            ? [{ text: `${reach.value} ${reach.unit}`, optional: true }]
            : []),
          ...(r.badge ? [{ text: r.badge.text, optional: true }] : []),
          ...(r.place ? [{ text: r.place, optional: true }] : []),
        ];
    const line = fitLine(segments, room, (text) => this.head.ruler.width('fv-row__sub', text));
    const { onTap, onHold } = this.headActions(this.leadEntity(r) ?? this.config?.entity);
    const car = html`<span
      class="fv-ico fv-ico--${r.unavailable ? 'off' : r.charge === 'charging' || r.activity === 'driving' ? r.tone : 'neutral'}"
      >${icon(this.config?.icon ?? 'car')}</span
    >`;
    return html`<article
      class="fv-card vh-card vh-card--mini ${r.unavailable ? 'is-unavailable' : ''}"
      data-card
    >
      ${
        tank
          ? this.ringHalves(r, gauge, tank, car)
          : html`<span class="vh-ring fv-tone--${tone}">
              <svg viewBox="0 0 58 58" aria-hidden="true" data-measure="drawn">
                <circle class="vh-ring__track" cx="29" cy="29" r=${STRIP_RADIUS} />
                ${
                  level === null
                    ? nothing
                    : svg`<circle class="vh-ring__fill" cx="29" cy="29" r=${STRIP_RADIUS} stroke-dasharray=${circumference.toFixed(2)} stroke-dashoffset=${(circumference * (1 - level / 100)).toFixed(2)} />`
                }
              </svg>
              ${car}
            </span>`
      }
      <span class="fv-row__text"
        ><span class="fv-row__title" data-name>${r.name}</span
        ><span class="fv-row__sub">${line}</span></span
      >
      ${onTap || onHold ? pressCover(`${r.name} · ${line}`, onTap, onHold) : nothing}
      ${control ? this.renderControl(control, true) : nothing}
    </article>`;
  }

  /**
   * A hybrid strip's circle: its ring in two halves, each filled from the foot up, 8° clear of the other at the foot
   * and the head — the battery's on the left (the line's first figure), the tank's on the right, each in its tone.
   */
  private ringHalves(r: Reading, battery: Gauge, tank: Gauge, car: TemplateResult): TemplateResult {
    const at = (deg: number): string => {
      const a = (deg * Math.PI) / 180;
      return `${(29 + STRIP_RADIUS * Math.cos(a)).toFixed(2)} ${(29 + STRIP_RADIUS * Math.sin(a)).toFixed(2)}`;
    };
    // from the foot (90°) round the left (clockwise) or the right, to the head
    const half = (left: boolean, g: Gauge, tone: Tone) => {
      const d = `M${at(left ? 98 : 82)}A${STRIP_RADIUS} ${STRIP_RADIUS} 0 0 ${left ? 1 : 0} ${at(left ? 262 : 278)}`;
      const level = r.unavailable ? null : g.level;
      return svg`<path class="vh-ring__track" d=${d} />${
        level === null || level <= 0
          ? nothing
          : svg`<path class="vh-ring__fill fv-tone--${tone}" d=${d} pathLength="100" stroke-dasharray="${level.toFixed(1)} 100" />`
      }`;
    };
    return html`<span class="vh-ring vh-ring--halves">
      <svg viewBox="0 0 58 58" aria-hidden="true" data-measure="drawn">
        ${half(true, battery, r.charge === 'charging' ? r.tone : battery.tone)}
        ${half(false, tank, tank.low ? 'warning' : tank.tone)}
      </svg>
      ${car}
    </span>`;
  }
}

/** The controls a car has, in the order a card shows them where it names none. */
export function carControls(found: VehicleEntities): VehicleControl[] {
  const { roles, doors, windows } = found;
  return DEFAULT_CONTROLS.filter((control) => {
    switch (control) {
      case 'lock':
        return Boolean(roles.lock);
      case 'climate':
        return Boolean(roles.climate ?? roles.climate_switch ?? roles.climate_start);
      case 'charging':
        return Boolean(
          roles.charge_switch ?? roles.charge_start ?? roles.charging ?? roles.plugged,
        );
      case 'windows':
        return Boolean(roles.windows) || windows.length > 0;
      case 'doors':
        return doors.length > 0;
      default:
        return Boolean(roles[control]);
    }
  });
}
