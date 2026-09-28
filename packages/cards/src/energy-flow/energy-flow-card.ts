import {
  relativeTime,
  stateText,
  strings,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { head, ico, sheetStyles, type GlyphName, type Tone } from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  svg,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { Card } from '../shared/base.js';

import {
  boolField,
  editorLabels,
  entitiesField,
  entityField,
  fieldRow,
  iconField,
  selectField,
  textField,
  titleFields,
} from '../shared/form.js';

import { HeadFit } from '../energy/head.js';

import { legendReadouts } from '../energy/legend.js';

import { scaled, scaleOf, watts } from '../energy/power.js';
import { flowStatus, houseBalance, IDLE, intensity, type FlowStatus } from './model.js';

import {
  alongPoints,
  arcPoints,
  cubicPoints,
  pathData,
  reversed,
  travelKeyframes,
  trimEnd,
  type Cubic,
  type Point,
} from './path.js';
import type { RowsListSpec } from '../shared/rows-editor.js';

const s = strings('energy-flow');

export interface EnergyFlowReadout {
  entity: string;
  label?: string;
}

export interface EnergyFlowCardConfig extends FluvyCardConfig {
  title?: string;
  subtitle?: string;
  /** Production. Always flows towards the house. */
  solar_power?: string;
  /** Positive = importing from the grid; `grid_invert` flips a meter that signs it the other way. */
  grid_power?: string;
  grid_invert?: boolean;
  /** Positive = discharging into the house; `battery_invert` flips it. */
  battery_power?: string;
  battery_invert?: boolean;
  battery_level?: string;
  /** The house's own meter. Absent: solar + grid (import − export) + battery (discharge − charge). */
  home_power?: string;
  /** Up to three totals under the diagram (self-use, exported, imported today). */
  readouts?: ReadonlyArray<string | EnergyFlowReadout>;
  /** How the flows are drawn: `ribbons` (default: a band as thick as its power), `legs` (dashed curves with arrowheads) or `rail` (one track every source joins). */
  flow_style?: FlowStyle;
}

export type FlowStyle = 'ribbons' | 'legs' | 'rail';
export const FLOW_STYLES: readonly FlowStyle[] = ['ribbons', 'legs', 'rail'];

/* geometry of the sheet: 44 nodes stacked on one x, the house ring on the right, tails on one x */
const RING = 28; // contact radius: the 22 ring + 6 px clearance
const PITCH = 80; // node to node
const TOP = 42; // centre of the first node: one PITCH under the head's icon centre (20 + 22 + 16 + 42 = 122 = 42 + 80), so head, first and second node are evenly spaced
const BOTTOM = 30; // air under the last node's centre (8 px past its circle)
const TEXT_LEFT = 56; // 44 icon + 12
const TEXT_MAX = 120; // the sheet's text column
const TEXT_MIN = 88; // "Battery · 78 %" still fits
/** The text column and where every tail starts: 120 wide on the sheet, narrower before the links would be. */
function textColumn(w: number): { text: number; tailX: number } {
  const text = Math.min(TEXT_MAX, Math.max(TEXT_MIN, w - TEXT_LEFT - 108)); // 108 = 44 house + 64 of link
  return { text, tailX: TEXT_LEFT + text };
}
const CONTACT = [-40, 0, 40] as const; // three separate contact points, so every arrowhead stays visible
const PULL = [0.4376, 0.358] as const; // control-point pull of the sheet's links (44 and 36 of a 100.55 span)

/* the travelling dots */
const LAP = 3; // seconds a dot takes from tail to arrowhead at playback rate 1
const DOT = 6; // px
const BAND_STACK = 56; // the ribbons' house is a 56 circle (44 elsewhere): three bands still show their shares on it
const BAND_MIN = 14; // room for the 6 px dot with its 2 px halo and 2 px of band on either side
const BAND_MAX = 24; // a lone source is a band, not a block
const RAIL_TRACK = 48; // the shared track before the house: the connectors carry the colour most of the way
const DIAGRAM_MIN = 240; // narrower than this (a 6-column card) there is no room for a diagram: the sources and the house become a list
const STEPS = 24; // keyframe stops per link: 6 px chords on the sheet's curves, a quarter of a pixel off the true line at most
const SPACING = 32; // px between dots at least: a short link carries fewer
/** Phase of each dot and the density level that shows it: 1 → one dot, 2 → two halves apart, 3 → three thirds apart. */
const DOTS: ReadonlyArray<readonly [phase: number, levels: readonly number[]]> = [
  [0, [1, 2, 3]],
  [1 / 2, [2]],
  [1 / 3, [3]],
  [2 / 3, [3]],
];

interface Source {
  readonly key: 'solar' | 'grid' | 'battery';
  readonly cls: 'solar' | 'grid' | 'water';
  readonly tone: Tone;
  readonly glyph: GlyphName;
  readonly label: string;
  readonly view: EntityView;
  /** Signed watts, + towards the house and − away from it (export, charging); `null` when unusable. */
  readonly power: number | null;
}

interface Chevron {
  readonly x: number;
  readonly y: number;
  readonly left: boolean;
  readonly cls: Source['cls'] | 'house';
  /** half height: 4 on a leg or the rail, less inside a thin ribbon */ readonly h: number;
}

interface Link {
  readonly source: Source;
  readonly y: number;
  /** What the style draws: the dashed leg or the rail connector (`d`), or the ribbon's outline (`band`). */
  readonly d: string;
  readonly band: string;
  /** What the dots' way depends on (style, geometry, direction): when it changes, the keyframes are rebuilt. */
  readonly key: string;
  /** The dots' way, from where the energy comes from to where it goes, equally spaced by arc length. */
  readonly points: readonly Point[];
  readonly chevrons: readonly Chevron[];
  readonly idle: boolean;
  /** How many dots travel: 1 … 3, by power and by how much room the link has. */
  readonly level: number;
  /** Playback rate of the dots: 0.6 (a trickle, 5 s a lap) … 1.8 (5 kW and up, 1.7 s a lap). */
  readonly rate: number;
}

interface Stage {
  readonly sources: readonly Source[];
  readonly links: readonly Link[];
  readonly houseX: number;
  readonly houseY: number;
  readonly height: number;
  readonly style: FlowStyle;
  /** The rail's track (rail style), and its arrow into the house when something comes in. */
  readonly track: string;
  readonly inward: Chevron | null;
  /** Too narrow for the diagram: the card lists the sources and the house instead (no links, no dots). */
  readonly narrow: boolean;
}

const f = (n: number): string => n.toFixed(1);
const chevronPath = (c: Chevron): string => {
  const w = c.h * 1.25;
  return c.left
    ? `M${f(c.x + w)},${f(c.y - c.h)} L${f(c.x)},${f(c.y)} L${f(c.x + w)},${f(c.y + c.h)}`
    : `M${f(c.x - w)},${f(c.y - c.h)} L${f(c.x)},${f(c.y)} L${f(c.x - w)},${f(c.y + c.h)}`;
};

/**
 * The flow diagram: solar, grid and battery as icon circles feeding the house, each link carrying an
 * arrowhead at its destination and dots travelling along it, faster and denser with its power.
 * Direction follows the sign of the sensor, so a house that exports or a battery that charges reads
 * correctly in a still frame as well as in motion.
 *
 * Motion is CSS and runs on the compositor: every link gets one `@keyframes` rule that carries a dot
 * along the curve with `transform` (the curve sampled at equal arc lengths) and fades it at both ends
 * with `opacity`. It is paused while the link carries nothing and absent under reduced motion. The
 * only script is `updatePlaybackRate()` when a reading changes, which retunes the speed without
 * moving the dot — a changed `animation-duration` would make it jump. (`offset-path` draws the same
 * motion, but no browser animates `offset-distance` off the main thread: see the cost in the report.)
 */
export class FluvyEnergyFlowCard extends Card<EnergyFlowCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.energy,
    css`
      .ef-card {
        width: 100%;
      } /* the sheet fixes 360; a card takes the column it is given */
      .ef-stage {
        width: 100%;
      }
      .ef-stage svg {
        display: block;
      }
      .ef-cols {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .ef-cols .fv-readout {
        min-width: 0;
      }
      .ef-cols .fv-readout__label,
      .ef-node__label {
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      } /* names may ellipsize, values never */
      .ef-node__label {
        max-width: 100%;
      }
      .ef-link {
        transition: opacity var(--fv-slow) var(--fv-ease);
      }
      .ef-link--idle {
        opacity: 0.4;
      }

      /* the travelling energy: a mover carried along the link by its keyframes (see syncMotion), and the disc it carries */
      .ef-dots {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .ef-dots--solar {
        --ef-ink: var(--fluvy-state-energy-solar);
      }
      .ef-dots--grid {
        --ef-ink: var(--fluvy-state-energy-grid);
      }
      .ef-dots--water {
        --ef-ink: var(--fluvy-state-energy-water);
      }
      .ef-flow {
        position: absolute;
        left: 0;
        top: 0;
        width: ${DOT}px;
        height: ${DOT}px;
        opacity: 0;
        animation: var(--ef-run) ${LAP}s linear infinite;
        animation-delay: var(--ef-delay, 0s);
      }
      .ef-dots.is-idle .ef-flow {
        animation-play-state: paused;
      }
      .ef-flow::before {
        content: '';
        display: block;
        width: ${DOT}px;
        height: ${DOT}px;
        border-radius: 50%;
        background: var(--ef-ink);
        box-shadow: 0 0 0 2px var(--fluvy-card); /* the dash is cut around the dot, so it reads as one travelling packet */
        transform: scale(0);
        transition: transform var(--fv-slow) var(--fv-ease);
      }
      .ef-flow.is-on::before {
        transform: none;
      }

      /* the global reduced-motion rule shortens animations to 1 ms; a loop has to go away instead —
         the dashes and the arrowheads are the still the sheet was approved as */
      @media (prefers-reduced-motion: reduce) {
        .ef-dots {
          display: none;
        }
      }
    `,
  ];

  private ticker: number | undefined;
  private readonly head = new HeadFit(this);
  /** The card's own `<style>`: one `@keyframes` rule per link, rewritten only when a link's geometry changes. */
  private motion: HTMLStyleElement | undefined;
  private motionKey = '';
  /** What this update draws, worked out once in `willUpdate`: `render` reads it, `updated` writes its keyframes. */
  private scene: Stage = {
    sources: [],
    links: [],
    houseX: 0,
    houseY: 0,
    height: 0,
    style: 'ribbons',
    track: '',
    inward: null,
    narrow: false,
  };
  /** Links sampled for the keyframes, by path data: a reading changes far more often than a curve does. */
  private readonly sampled = new Map<string, { points: Point[]; length: number }>();
  /** The freshness text on screen, so the ticker only asks for a render when it would change. */
  private shownFreshness = '';

  static override lists: readonly RowsListSpec[] = [
    {
      key: 'readouts',
      title: 'editor.rows',
      domains: ['sensor'],
      schema: [entityField(['sensor']), textField('label')],
    },
  ];
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        titleFields(),
        fieldRow(
          entityField(['sensor'], 'solar_power', false),
          entityField(['sensor'], 'home_power', false),
        ),
        entityField(['sensor'], 'grid_power', false),
        boolField('grid_invert'),
        entityField(['sensor'], 'battery_power', false),
        boolField('battery_invert'),
        fieldRow(entityField(['sensor'], 'battery_level', false), iconField()),
        selectField('flow_style', FLOW_STYLES),
        entitiesField('readouts', ['sensor']),
      ],
      ...editorLabels(
        s,
        {
          grid_invert: 'editor_grid_invert',
          battery_invert: 'editor_battery_invert',
          battery_level: 'editor_battery_level',
          home_power: 'editor_home',
          readouts: 'editor_readouts',
        },
        {
          flow_style: 'editor.flow_style',
          solar_power: 'energy.solar',
          grid_power: 'energy.grid',
          battery_power: 'energy.battery',
        },
      ),
    };
  }

  static getStubConfig(
    hass: HomeAssistant | undefined,
    entities: readonly string[],
  ): EnergyFlowCardConfig {
    const power = entities.filter(
      (id) => id.startsWith('sensor.') && hass?.states[id]?.attributes.device_class === 'power',
    );
    const pick = (word: RegExp): string | undefined => power.find((id) => word.test(id));
    const solar = pick(/solar|pv|inverter/i);
    const battery = pick(/batter/i);
    const grid =
      pick(/grid|mains|red/i) ??
      power.find((id) => id !== solar && id !== battery) ??
      entities.find((id) => id.startsWith('sensor.')) ??
      '';
    return {
      type: 'custom:fluvy-energy-flow-card',
      grid_power: grid,
      ...(solar ? { solar_power: solar } : {}),
      ...(battery ? { battery_power: battery } : {}),
    };
  }

  protected override prepare(config: EnergyFlowCardConfig): EnergyFlowCardConfig {
    if (!config.solar_power && !config.grid_power && !config.battery_power) {
      throw new Error(
        'fluvy-energy-flow-card: set at least one of "solar_power", "grid_power", "battery_power"',
      );
    }
    return config;
  }

  override getCardSize(): number {
    return 2 + 2 * this.sourceIds().length + (this.readouts().length ? 1 : 0);
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private sourceIds(): string[] {
    const c = this.config;
    return [c?.solar_power, c?.grid_power, c?.battery_power].filter((id): id is string => !!id);
  }

  protected override watched(): readonly string[] {
    const c = this.config;
    return [
      ...this.sourceIds(),
      c?.battery_level,
      c?.home_power,
      ...this.readouts().map((r) => r.entity),
    ].filter((id): id is string => !!id);
  }

  private readouts(): EnergyFlowReadout[] {
    return (this.config?.readouts ?? [])
      .slice(0, 3)
      .map((r) => (typeof r === 'string' ? { entity: r } : r));
  }

  /* ---------- lifecycle ---------- */

  override connectedCallback(): void {
    super.connectedCallback();
    // "Live · 5 s ago" is a claim about the clock: checked every 5 s, rendered only when its words change
    this.ticker = window.setInterval(() => {
      if (
        this.config &&
        this.config.subtitle === undefined &&
        this.freshness() !== this.shownFreshness
      )
        this.requestUpdate();
    }, 5000);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearInterval(this.ticker);
    this.ticker = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.shownFreshness = this.freshness();
    this.scene = this.stage(this.sources());
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncMotion();
  }

  /** The dots' way along a path, sampled once per geometry (a resize or a new reading builds a new one). */
  private trail(key: string, fine: () => readonly Point[]): { points: Point[]; length: number } {
    let hit = this.sampled.get(key);
    if (!hit) {
      if (this.sampled.size > 12) this.sampled.clear(); // a resize leaves old widths behind
      this.sampled.set(key, (hit = alongPoints(fine(), STEPS)));
    }
    return hit;
  }

  /** Writes the keyframes of the links just rendered, then sets each link's pace. */
  private syncMotion(): void {
    // a ribbon's centreline moves with its share of the flow: the key carries the geometry, not just the path data
    const key = this.scene.links.map((link) => link.key).join('|');
    if (key !== this.motionKey) {
      this.motionKey = key;
      this.motion ??= this.renderRoot.appendChild(document.createElement('style'));
      this.motion.textContent = this.scene.links
        .map((link, i) => travelKeyframes(`ef-run-${i}`, link.points, DOT))
        .join('\n');
    }
    // speed follows power without a jump: the running animation keeps its progress and only changes pace
    for (const group of this.renderRoot.querySelectorAll<HTMLElement>('.ef-dots')) {
      const rate = Number(group.dataset['rate']);
      if (!(rate > 0) || group.classList.contains('is-idle')) continue;
      for (const dot of group.children) {
        for (const animation of dot.getAnimations()) {
          if (animation instanceof CSSAnimation && Math.abs(animation.playbackRate - rate) > 0.01)
            animation.updatePlaybackRate(rate);
        }
      }
    }
  }

  /* ---------- model ---------- */

  private sources(): Source[] {
    const c = this.config;
    const read = (id: string, invert: boolean): { view: EntityView; power: number | null } => {
      const view = this.entity(id);
      const raw = watts(view);
      return { view, power: raw === null ? null : invert ? -raw : raw };
    };
    const out: Source[] = [];
    if (c?.solar_power) {
      const { view, power } = read(c.solar_power, false);
      // an inverter asleep reports a few watts of its own draw as negative production: that is not a flow
      out.push({
        key: 'solar',
        cls: 'solar',
        tone: 'solar',
        glyph: 'sun',
        label: this.t('energy.solar'),
        view,
        power: power === null ? null : Math.max(0, power),
      });
    }
    if (c?.grid_power) {
      out.push({
        key: 'grid',
        cls: 'grid',
        tone: 'grid',
        glyph: 'bolt',
        label: this.t('energy.grid'),
        ...read(c.grid_power, c.grid_invert ?? false),
      });
    }
    if (c?.battery_power) {
      const level = c.battery_level ? this.entity(c.battery_level).number : null;
      const percent = level === null ? null : Math.round(Math.min(100, Math.max(0, level)));
      const label =
        percent === null ? this.t('energy.battery') : `${this.t('energy.battery')} · ${percent} %`;
      out.push({
        key: 'battery',
        cls: 'water',
        tone: 'water',
        glyph: 'battery',
        label,
        ...read(c.battery_power, c.battery_invert ?? false),
      });
    }
    return out;
  }

  private flowStyle(): FlowStyle {
    const style = this.config?.flow_style;
    return style && FLOW_STYLES.includes(style) ? style : 'ribbons';
  }

  /** The stage: where each node sits, and each flow drawn from where its energy comes from to where it goes — in the configured style. */
  private stage(sources: readonly Source[]): Stage {
    const count = sources.length;
    const style = this.flowStyle();
    if (this.contentWidth < DIAGRAM_MIN)
      return {
        sources,
        links: [],
        houseX: 0,
        houseY: 0,
        height: 0,
        style,
        track: '',
        inward: null,
        narrow: true,
      };
    const legs = style === 'legs';
    const houseR = style === 'ribbons' ? 28 : 22; // the ribbons land on a 56 circle
    const houseX = this.contentWidth - houseR;
    const houseEdge = houseX - houseR - 1; // where a ribbon or the rail meets the house's circle
    // every style: the house faces the middle of the sources; every leg, ribbon or connector leaves from its row's centre
    // (the approved sheet: two legs mirror each other at ∓40°, three meet the house at −40° / 0° / +40°)
    // …with its circle's top on the 4 px grid (the 56 house facing two rows sits 2 px under their middle)
    const houseY = Math.round((TOP + (PITCH / 2) * (count - 1) - houseR) / 4) * 4 + houseR;
    // the house label hangs 30 (36 on the big house) + 36 under its centre; the stage ends on the grid too
    const height =
      Math.ceil(
        Math.max(TOP + PITCH * (count - 1) + BOTTOM, houseY + (style === 'ribbons' ? 72 : 66)) / 4,
      ) * 4;
    const angles: readonly number[] =
      count >= 3 ? CONTACT : count === 2 ? [CONTACT[0], CONTACT[2]] : [CONTACT[1]]; // two legs meet the house at ∓40°: concave and convex, mirrored
    const { tailX } = textColumn(this.contentWidth);
    // ribbons: every band is as thick as its share of what flows (a thread at least); they stack on the house, centred on it
    const powers = sources.map((source) => Math.abs(source.power ?? 0));
    const flowing = powers.map((power) => (power >= IDLE ? power : 0));
    const total = flowing.reduce((sum, power) => sum + power, 0);
    // every band keeps BAND_MIN; what is left of the house's height is shared by power, so the stack fits the circle
    const budget = Math.max(0, BAND_STACK - BAND_MIN * count);
    const thickness = flowing.map((power) =>
      Math.min(BAND_MAX, BAND_MIN + (total > 0 ? Math.round((budget * power) / total) : 0)),
    );
    let slot = Math.round(houseY - thickness.reduce((sum, t) => sum + t, 0) / 2); // whole pixels: crisp band edges at 1×
    const railY = houseY;
    const junction = Math.max(tailX + 40, houseEdge - RAIL_TRACK); // the connectors join just before the short shared track
    let inward: Chevron | null = null;

    const links = sources.map((source, i): Link => {
      const y = TOP + i * PITCH;
      const power = powers[i] ?? 0;
      const out = (source.power ?? 0) < 0;
      const idle = power < IDLE;
      const chevrons: Chevron[] = [];
      let d = '';
      let band = '';
      let fine: () => Point[];
      if (legs) {
        const ly = y;
        const angle = ((angles[i] ?? 0) * Math.PI) / 180;
        const ex = houseX - RING * Math.cos(angle);
        const ey = houseY + RING * Math.sin(angle);
        const span = Math.max(16, ex - tailX);
        const in_: Cubic = {
          from: [tailX, ly],
          c1: [tailX + span * PULL[0], ly],
          c2: [ex - span * PULL[1], ey],
          to: [ex, ey],
        };
        const curve = out ? reversed(in_) : in_;
        d = pathData(curve);
        fine = () => cubicPoints(curve);
      } else if (style === 'ribbons') {
        const t = thickness[i] ?? BAND_MIN;
        const s0 = slot;
        const s1 = slot + t;
        slot = s1;
        const c = Math.max(24, (houseEdge - tailX) * 0.45);
        const top: Cubic = {
          from: [tailX, y - t / 2],
          c1: [tailX + c, y - t / 2],
          c2: [houseEdge - c, s0],
          to: [houseEdge, s0],
        };
        const bottom: Cubic = {
          from: [tailX, y + t / 2],
          c1: [tailX + c, y + t / 2],
          c2: [houseEdge - c, s1],
          to: [houseEdge, s1],
        };
        band = `${pathData(top)} L${f(houseEdge)},${f(s1)} ${pathData(reversed(bottom)).replace('M', 'L')} Z`;
        fine = () => {
          const a = cubicPoints(top);
          const b = cubicPoints(bottom);
          const mid = a.map((pt, k): Point => [
            (pt[0] + (b[k]?.[0] ?? pt[0])) / 2,
            (pt[1] + (b[k]?.[1] ?? pt[1])) / 2,
          ]);
          // the trail stops 12 px short of the chevron, so a dot never crosses it
          const way = out ? mid.reverse() : mid;
          return trimEnd(way, 12);
        };
        const h = Math.min(4, t / 2 - 3); // the chevron keeps 3 px of band above and below
        if (!idle)
          chevrons.push(
            out
              ? { x: tailX + 2, y, left: true, cls: source.cls, h }
              : { x: houseEdge - 2, y: (s0 + s1) / 2, left: false, cls: source.cls, h },
          );
      } else {
        const dy = railY - y;
        let way: Point[];
        const x0 = out ? tailX + 1 : tailX; // an export's arrow tip sits on tailX: the line stops just behind it
        if (Math.abs(dy) < 1) {
          d = `M${f(x0)},${f(y)} H${f(junction)}`;
          way = [
            [tailX, y],
            [junction, y],
          ];
        } else if (dy > 0) {
          // the row is above the rail: right, down, right
          const bend = junction - 24; // where the connector turns: a 12 arc down, a 12 arc back to the right
          d = `M${f(x0)},${f(y)} H${f(bend - 12)} a12,12 0 0 1 12,12 V${f(railY - 12)} a12,12 0 0 0 12,12`;
          way = [
            [tailX, y],
            [bend - 12, y],
            ...arcPoints(bend - 12, y + 12, 12, -90, 0),
            [bend, railY - 12],
            ...arcPoints(bend + 12, railY - 12, 12, 180, 90),
          ];
        } else {
          // below the rail: right, up, right
          const bend = junction - 24;
          d = `M${f(x0)},${f(y)} H${f(bend - 12)} a12,12 0 0 0 12,-12 V${f(railY + 12)} a12,12 0 0 1 12,-12`;
          way = [
            [tailX, y],
            [bend - 12, y],
            ...arcPoints(bend - 12, y - 12, 12, 90, 0),
            [bend, railY + 12],
            ...arcPoints(bend + 12, railY + 12, 12, 180, 270),
          ];
        }
        way.push([houseEdge, railY]);
        fine = () => (out ? [...way].reverse() : way);
        if (!idle && out) chevrons.push({ x: tailX, y, left: true, cls: source.cls, h: 4 }); // the tip ends the connector
        if (!idle && !out) inward = { x: houseEdge, y: railY, left: false, cls: 'house', h: 4 }; // the tip ends the track
      }
      const key = `${style}|${d}${band}|${out ? 'out' : 'in'}`;
      const trail = this.trail(key, fine);
      const strength = intensity(power);
      const room = Math.max(1, Math.floor(trail.length / SPACING));
      return {
        source,
        y,
        d,
        band,
        key,
        points: trail.points,
        chevrons,
        idle,
        level: Math.min(room, 1 + Math.min(2, Math.floor(strength * 3))),
        rate: 0.6 + 1.2 * strength,
      };
    });
    const track =
      style === 'rail' && count
        ? `M${f(junction - 3)},${f(railY)} H${f(inward ? houseEdge - 1 : houseEdge)}`
        : ''; // the track stops behind the arrow's tip
    return { sources, links, houseX, houseY, height, style, track, inward, narrow: false };
  }

  /** "Live · 5 s ago" while the readings are fresh, "12 min ago" once they are not: "live" is only said when true. */
  private freshness(): string {
    let newest = 0;
    for (const id of [...this.sourceIds(), this.config?.home_power]) {
      const at = Date.parse((id && this.hass?.states[id]?.last_updated) || '');
      if (at > newest) newest = at;
    }
    const live = s(this.hass, 'live');
    if (!newest) return live;
    const age = Math.max(0, Math.floor((Date.now() - newest) / 5000) * 5);
    if (age < 5) return `${live} · ${this.t('common.now').toLowerCase()}`;
    if (age < 60) return `${live} · ${s(this.hass, 'seconds_ago', { count: age })}`;
    const text = relativeTime(this.hass, new Date(newest));
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  private badge(status: FlowStatus): { text: string; tone: Tone } {
    switch (status.kind) {
      case 'solar':
        return { text: s(this.hass, 'solar_share', { percent: status.percent }), tone: 'solar' };
      case 'importing':
        return { text: this.t('energy.importing'), tone: 'grid' };
      case 'exporting':
        return { text: this.t('energy.exporting'), tone: 'grid' };
      case 'charging':
        return { text: s(this.hass, 'charging'), tone: 'water' };
      case 'discharging':
        return { text: s(this.hass, 'discharging'), tone: 'water' };
      case 'idle':
        return { text: this.t('energy.idle'), tone: 'neutral' };
    }
  }

  /* ---------- render ---------- */

  protected renderCard(): TemplateResult {
    const { sources, links, houseX, houseY, height, style, track, inward, narrow } = this.scene;
    const power = (key: Source['key']): number | null | undefined =>
      sources.find((source) => source.key === key)?.power;
    const flows = { solar: power('solar'), grid: power('grid'), battery: power('battery') };
    const homeId = this.config?.home_power;
    const home = homeId ? watts(this.entity(homeId)) : houseBalance(flows);
    const dead = home === null && sources.every((source) => source.power === null);

    const scale = scaleOf([...sources.map((source) => source.power), home], 'W');
    const figure = (value: number | null): string =>
      value === null ? '—' : `${scaled(this.hass, Math.abs(value), scale)} ${scale.unit}`;

    const w = this.contentWidth;
    const totals = this.readouts();
    // the head is measured, not guessed: at 300 px, in Spanish, with a long title, the badge is what gives way —
    // a clipped card title is a defect, a state the diagram already shows is not
    const fitted = this.head.fit({
      width: w,
      title: this.config?.title ?? s(this.hass, 'title'),
      sub: dead
        ? stateText(this.hass, sources[0]?.view ?? this.entity(homeId))
        : (this.config?.subtitle ?? this.shownFreshness),
      badge: dead ? null : this.badge(flowStatus(flows, home)),
    });

    return html`<article class="fv-card ef-card ${dead ? 'is-unavailable is-off' : ''}" data-card>
      ${head({
        icon: fitted.icon ? (this.config?.icon ?? 'bolt') : null,
        tone: dead ? 'off' : 'solar',
        title: this.config?.title ?? s(this.hass, 'title'),
        sub: fitted.sub,
        trailing: fitted.badge,
        name: Boolean(this.config?.title),
      })}
      ${
        narrow
          ? html`<div class="ef-list">
              ${sources.map(
                (source) =>
                  html`<div class="ef-list__row">
                    ${ico(source.glyph, source.power === null ? 'off' : Math.abs(source.power) < IDLE ? 'neutral' : source.tone, { onTap: () => this.tap(source.view.id, { action: 'more-info' }), label: source.label })}
                    <div class="ef-node__text ef-list__text">
                      <span class="ef-node__label">${source.label}</span
                      ><span class="ef-node__value">${figure(source.power)}</span>
                    </div>
                  </div>`,
              )}
              <div class="ef-list__row">
                ${ico('home', dead ? 'off' : 'accent', homeId ? { onTap: () => this.tap(homeId, { action: 'more-info' }), label: s(this.hass, 'house') } : {})}
                <div class="ef-node__text ef-list__text">
                  <span class="ef-node__label">${s(this.hass, 'house')}</span
                  ><span class="ef-node__value">${figure(home)}</span>
                </div>
              </div>
            </div>`
          : html` <div class="ef-stage" style="height:${height}px">
              <svg width=${w} height=${height} viewBox="0 0 ${w} ${height}" aria-hidden="true">
                ${
                  style === 'legs'
                    ? svg`<defs>${links.map(({ source: { cls } }) => svg`<marker id="ef-arrow-${cls}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1.5 1 6.5 4 1.5 7" class="ef-arrow ef-arrow--${cls}" /></marker>`)}</defs>
            ${links.map(({ source, d, idle }) => svg`<path d=${d} class="ef-link ef-link--${source.cls} ${idle ? 'ef-link--idle' : ''}" stroke-dasharray="6 8" marker-end="url(#ef-arrow-${source.cls})" />`)}`
                    : nothing
                }
                ${style === 'ribbons' ? links.map(({ source, band, idle }) => svg`<path d=${band} class="ef-band ef-band--${source.cls} ${idle ? 'ef-band--idle' : ''}" />`) : nothing}
                ${style === 'rail' ? svg`<path d=${track} class="ef-rail" />${links.map(({ source, d, idle }) => svg`<path d=${d} class="ef-join ef-join--${source.cls} ${idle ? 'ef-join--idle' : ''}" />`)}` : nothing}
                ${links.flatMap((link) => link.chevrons).map((c) => svg`<path d=${chevronPath(c)} class="ef-chev ef-chev--${c.cls}" />`)}
                ${inward ? svg`<path d=${chevronPath(inward)} class="ef-chev ef-chev--house" />` : nothing}
              </svg>
              ${links.map(
                ({ source, idle, level, rate }, i) =>
                  html`<div
                    class="ef-dots ef-dots--${source.cls} ${idle ? 'is-idle' : ''}"
                    data-measure="skip"
                    data-rate=${rate.toFixed(2)}
                    aria-hidden="true"
                    style="--ef-run:ef-run-${i}"
                  >
                    ${DOTS.map(([phase, levels]) => html`<span class="ef-flow ${!idle && levels.includes(level) ? 'is-on' : ''}" style="--ef-delay:${(-phase * LAP).toFixed(2)}s"></span>`)}
                  </div>`,
              )}
              ${links.map(
                ({ source, y }) =>
                  html` <div class="ef-node" style="left:0;top:${y - 22}px">
                      ${ico(source.glyph, source.power === null ? 'off' : Math.abs(source.power) < IDLE ? 'neutral' : source.tone, { onTap: () => this.tap(source.view.id, { action: 'more-info' }), label: source.label })}
                    </div>
                    <div
                      class="ef-node__text"
                      style="left:${TEXT_LEFT}px;top:${y - 18}px;width:${textColumn(w).text}px"
                    >
                      <span class="ef-node__label">${source.label}</span>
                      <span class="ef-node__value">${figure(source.power)}</span>
                    </div>`,
              )}
              <div
                class="ef-node ef-node--house ${style === 'ribbons' ? 'ef-node--big' : ''}"
                style="left:${houseX - (style === 'ribbons' ? 28 : 22)}px;top:${houseY - (style === 'ribbons' ? 28 : 22)}px"
              >
                ${ico('home', dead ? 'off' : 'accent', homeId ? { onTap: () => this.tap(homeId, { action: 'more-info' }), label: s(this.hass, 'house') } : {})}
              </div>
              <div
                class="ef-node__text ef-node__text--house"
                style="right:0;top:${houseY + (style === 'ribbons' ? 36 : 30)}px"
              >
                <span class="ef-node__label">${s(this.hass, 'house')}</span>
                <span class="ef-node__value">${figure(home)}</span>
              </div>
            </div>`
      }
      ${
        totals.length
          ? html`<div class="ef-cols fv-cols">
              ${legendReadouts(this.hass, totals, (id) => this.entity(id))}
            </div>`
          : nothing
      }
    </article>`;
  }
}
