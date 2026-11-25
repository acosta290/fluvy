// the map's words first: they travel with this chunk
import './english.js';
import { resolveEntity, strings, type HomeAssistant } from '@fluvy/core';
import {
  addGlyphs,
  baseStyles,
  clamp,
  glyph,
  haptic,
  localPoint,
  MotionMark,
  round,
  type GlyphName,
} from '@fluvy/ui';
import {
  LitElement,
  css,
  html,
  nothing,
  svg,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { CameraFeed, type FeedWant } from '../../camera/feed.js';
import { TextRuler } from '../../shared/fit.js';
import { FontsSettled } from '../../shared/fonts.js';
import { imageEntity, imageOf } from '../../shared/picture.js';
import { cornersOf, rectOf, type Calibration, type Point } from './calibration.js';
import { callOf, type Ways } from './calls.js';
import type { MapMode, Preset, RobotMap, Room } from './config.js';
import { PanZoom } from './pan-zoom.js';
import { send } from './presets.js';
import {
  jobOf,
  namesOf,
  withDrawn,
  withPoint,
  withRoom,
  withZone,
  type Selection,
} from './selection.js';

const s = strings('vacuum-map');

/** The map's own glyphs, in the set's hand: a zone's marquee, and four corners drawn in for the whole map. */
addGlyphs({
  zone: '<rect x="4" y="5" width="16" height="14" rx="2.5" stroke-dasharray="2.6 3.2"/>',
  fit: '<path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/>',
});
const ZONE = 'zone' as GlyphName;
const FIT = 'fit' as GlyphName;

/** What the card hands its map: who it is drawn for, what it draws, the robot's ways. */
export interface Scene {
  /** The robot. */
  readonly entity: string;
  /** None: a card of presets alone, which draws no map. */
  readonly map?: RobotMap;
  readonly presets: readonly Preset[];
  readonly rooms: readonly Room[];
  readonly ways: Ways;
  /** None: the map is not calibrated, and nothing is drawn or picked on it. */
  readonly calibration?: Calibration | undefined;
}

/** What the map asks of its card: its colours (the sheet they are derived on, and a colour's mark on it). */
export interface MapHost {
  adopt(root: ShadowRoot): void;
  accent(colour: string | undefined): string | undefined;
}

/** The map held as a hand left it, for the playground's frames: what is picked, its mode, a zone half marked. */
export interface MapHeld {
  readonly chosen?: Selection;
  readonly mode?: MapMode;
  readonly drawing?: readonly [Point, Point];
  /** How far it is enlarged, and where its picture's corner stands. */
  readonly zoom?: readonly [zoom: number, x: number, y: number];
}

/** Said when a hand changed what is picked: the card keeps it. */
export const MAP_CHOSEN = 'fluvy-map-chosen';
export interface MapChosenDetail {
  readonly chosen: Selection | undefined;
}

/* the plate's geometry: its controls 8 from its edges, 44 each, 8 apart */
const EDGE = 8;
const TARGET = 44;
/* a name on the map: a 24 pill, 8 each side of its words, 160 at most; a saved point's dot where its name has no
   room; 4 between two */
const TAG = 24;
const TAG_SIDES = 16;
const TAG_MOST = 160;
const DOT = 12;
const TAG_GAP = 4;
/** A saved zone's name stands on its top edge, this far in from its corner: a frame's title. */
const TAB_IN = 8;
/** Where a room's name stands when its middle is taken: this far under it and over it, while that is in the room. */
const STEPS = [0, 28, -28, 56, -56];
/** A zone marked smaller than this across or down is a slip of the finger. */
const DRAWN_LEAST = 8;
/** A name the bar has less than this for is left out. */
const NAMES_LEAST = 40;

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const meet = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** A shape of the map as it is drawn: its corners on the picture, and what a tap on it picks. */
interface Shape {
  readonly key: string;
  readonly kind: 'room' | 'zone';
  readonly points: readonly Point[];
  readonly chosen: boolean;
  readonly accent: string | undefined;
  readonly tap: () => void;
}

/**
 * What names a shape or stands for a place on the plate: a pill of its name. A shape whose name has no room still
 * takes its taps; a saved point has no shape, and stands as a dot then (`pin`).
 */
interface Tag {
  readonly key: string;
  readonly text: string;
  /** Where it stands on the picture: its middle, or (`tab`) the corner its pill starts from. */
  readonly at: Point;
  readonly tab?: boolean;
  readonly pin?: boolean;
  /** The shape it may step about in (a room's outline, on the picture): it stands at `at` where that is free. */
  readonly within?: readonly Point[];
  readonly chosen: boolean;
  readonly accent: string | undefined;
  readonly tap: () => void;
}

/** A tag placed: its 44 target on the plate, and whether it is its name's pill or a dot. */
interface PlacedTag extends Tag {
  readonly box: Box;
  readonly dot: boolean;
}

const finite = (points: readonly Point[]): boolean =>
  points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

/** The box a shape's corners span on the picture: its top left corner and its middle. */
function span(points: readonly Point[]): { readonly corner: Point; readonly middle: Point } {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  return {
    corner: [left, top],
    middle: [(left + Math.max(...xs)) / 2, (top + Math.max(...ys)) / 2],
  };
}

/** Whether a place lies inside a shape: a line from it crosses the shape's edge an odd number of times. */
const inside = (points: readonly Point[], [x, y]: Point): boolean =>
  points.reduce((odd, [ax, ay], index) => {
    const [bx, by] = points[(index + 1) % points.length] as Point;
    return ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax ? !odd : odd;
  }, false);

const outline = (points: readonly Point[]): string =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

const up4 = (value: number): number => Math.ceil(value / 4) * 4;

/**
 * The robot's map (#265): its picture whole in its plate (the camera family's feed: stills while the robot works, a
 * new picture when an image entity says one), its rooms and its saved zones drawn over it and tapped to pick them,
 * a zone marked or a point picked by hand in the mode a round starts, and at its foot what is picked with what to do
 * with it. Two fingers enlarge and carry it, one is the page's (`PanZoom`). It keeps no selection: the card does, and
 * hears `fluvy-map-chosen`. Its height is its plate's, whatever it shows.
 */
export class FluvyVacuumMap extends LitElement {
  static override styles: CSSResultGroup = [
    ...baseStyles,
    css`
      :host {
        display: block;
      }
      /* one finger scrolls the page; the browser's own pinch and double tap are not the plate's */
      .vm-plate {
        touch-action: pan-x pan-y;
        user-select: none;
        -webkit-user-select: none;
      }
      /* marking a zone, the finger is the map's */
      .vm-plate.is-drawing {
        touch-action: none;
      }
      .vm-plate:focus-visible {
        outline-offset: 2px;
      }
      /* the enlarged picture is cut by a box of its own, so the plate itself holds nothing past its edge */
      .vm-clip {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }
      .vm-layer {
        position: absolute;
        inset: 0;
        transform-origin: 0 0;
      }
      .vm-plate.is-drawing .vm-layer,
      .vm-plate.is-picking .vm-layer {
        cursor: crosshair;
      }
      .vm-plate.is-zoomed:not(.is-drawing, .is-picking) .vm-layer {
        cursor: grab;
      }
      /* the whole map, never cropped; a small one enlarged keeps its pixels' edges */
      .vm-layer .fv-plate__img {
        object-fit: contain;
      }
      .vm-plate.is-crisp .fv-plate__img {
        image-rendering: pixelated;
      }
      .vm-skeleton {
        position: absolute;
        inset: 0;
        border-radius: 0;
      }
      .vm-shapes {
        position: absolute;
        inset: 0;
        z-index: 2;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .vm-shape {
        fill: transparent;
        stroke: transparent;
        stroke-width: 2px;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
        cursor: pointer;
      }
      /* a saved zone is nowhere in the picture: it is drawn at rest too, in its colour */
      .vm-shape--zone {
        fill: color-mix(in srgb, var(--fluvy-accent) 12%, transparent);
        stroke: var(--fluvy-accent);
        stroke-width: 1.5px;
        stroke-dasharray: 5 4;
      }
      @media (hover: hover) {
        .vm-shape--room:hover {
          fill: color-mix(in srgb, var(--fluvy-card) 28%, transparent);
        }
      }
      /* what is picked keeps the picture's own colours inside a line of its colour; the rest of the map steps back
         under a veil of the plate's ground */
      .vm-shape.is-on {
        fill: transparent;
        stroke: var(--fluvy-accent);
        stroke-width: 2.5px;
        stroke-dasharray: none;
      }
      .vm-veil {
        fill: color-mix(in srgb, var(--fluvy-page-alt) 64%, transparent);
        pointer-events: none;
      }
      /* a line over a picture of any colour is cased: the card's own colour under it, a little wider */
      .vm-case {
        fill: none;
        stroke: color-mix(in srgb, var(--fluvy-card) 84%, transparent);
        stroke-width: 4px;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
        pointer-events: none;
      }
      .vm-case.is-on {
        stroke-width: 5.5px;
      }
      /* a shape smaller than a finger takes its taps from a band round it too, as wide as it is short of 44 */
      .vm-hit {
        fill: transparent;
        stroke: transparent;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
        pointer-events: all;
        cursor: pointer;
      }
      /* a zone under the finger */
      .vm-shape--drawn {
        fill: color-mix(in srgb, var(--fluvy-card) 36%, transparent);
        stroke: var(--fluvy-accent);
        stroke-width: 2.5px;
        stroke-linejoin: round;
        paint-order: stroke;
        pointer-events: none;
      }
      .vm-plate.is-drawing :is(.vm-shape, .vm-hit),
      .vm-plate.is-picking :is(.vm-shape, .vm-hit) {
        pointer-events: none;
      }
      /* a name on the map: a 24 pill in a 44 target. Every pill lies over every target (the two take the taps, the
         button's own box none), so a target that reaches over a neighbour's pill never takes its tap */
      .vm-tag {
        position: absolute;
        display: grid;
        place-items: center;
        height: 44px;
        pointer-events: none;
      }
      .vm-tag::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 3;
        pointer-events: auto;
      }
      .vm-tag__pill {
        position: relative;
        z-index: 4;
        max-width: 100%;
        height: 24px;
        padding: 0 8px;
        overflow: hidden;
        border-radius: 12px;
        background: color-mix(in srgb, var(--fluvy-card) 92%, transparent);
        box-shadow: inset 0 0 0 1px var(--fluvy-border);
        font-size: 12px;
        font-weight: 600;
        line-height: 24px;
        color: var(--fluvy-text);
        text-align: center;
        white-space: nowrap;
        text-overflow: ellipsis;
        pointer-events: auto;
        transition:
          background var(--fv-base) var(--fv-ease),
          color var(--fv-base) var(--fv-ease);
      }
      /* a saved zone's name wears the zone's colour at its edge */
      .vm-tag.is-tab .vm-tag__pill {
        box-shadow: inset 0 0 0 1px var(--fluvy-accent);
      }
      .vm-tag.is-dot .vm-tag__pill {
        width: 12px;
        height: 12px;
        padding: 0;
        border-radius: 50%;
        background: var(--fluvy-card);
        box-shadow: inset 0 0 0 3px var(--fluvy-accent);
      }
      .vm-tag.is-on .vm-tag__pill {
        background: var(--fluvy-primary, var(--fluvy-accent));
        box-shadow: inset 0 0 0 1px var(--fluvy-primary-edge, transparent);
        color: var(--fluvy-on-primary, var(--fluvy-text-on-accent));
      }
      .vm-tag.is-dot.is-on .vm-tag__pill {
        box-shadow: 0 0 0 2px var(--fluvy-card);
      }
      .vm-plate.is-drawing .vm-tag > *,
      .vm-plate.is-drawing .vm-tag::before,
      .vm-plate.is-picking .vm-tag > *,
      .vm-plate.is-picking .vm-tag::before {
        pointer-events: none;
      }
      /* the point to go to: the accent's dot in the card's ring */
      .vm-pin {
        position: absolute;
        z-index: 4;
        width: 16px;
        height: 16px;
        margin: -8px 0 0 -8px;
        border-radius: 50%;
        background: var(--fluvy-primary, var(--fluvy-accent));
        box-shadow:
          0 0 0 3px var(--fluvy-card),
          0 0 0 4px var(--fluvy-border);
        pointer-events: none;
      }
      /* the plate's rounds: what a hand may do at its bottom end, the whole map at its top end while it is enlarged */
      .vm-rounds {
        position: absolute;
        right: 8px;
        z-index: 5;
        display: flex;
        gap: 8px;
      }
      .vm-rounds--foot {
        bottom: 8px;
      }
      .vm-rounds--head {
        top: 8px;
      }
      @keyframes vm-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
      }
      /* what is picked, at the plate's foot: a pill of the card's surface over the map, where the rounds stood */
      .vm-bar {
        position: absolute;
        right: 8px;
        bottom: 8px;
        left: 8px;
        z-index: 5;
        display: flex;
        align-items: center;
        height: 44px;
        border-radius: 22px;
        background: color-mix(in srgb, var(--fluvy-card) 94%, transparent);
        box-shadow: inset 0 0 0 1px var(--fluvy-border);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        animation: vm-in 200ms var(--fv-ease-out) both;
      }
      /* what a hand marked at the plate's foot would lie under the bar: the bar stands at its head then */
      .vm-bar.is-head {
        top: 8px;
        bottom: auto;
        animation-name: vm-in-head;
      }
      @keyframes vm-in-head {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
      }
      /* a mode waiting for its finger: the bar says what it waits for and lets the finger through to the map */
      .vm-bar.is-waiting {
        pointer-events: none;
      }
      .vm-bar.is-waiting .fv-round {
        pointer-events: auto;
      }
      /* a mode whose bar cannot say what it waits for whole is its cross alone: a round, where the rounds stood */
      .vm-bar.is-bare {
        left: auto;
        width: 44px;
      }
      :host([reduced-motion]) .vm-bar {
        animation: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .vm-bar {
          animation: none;
        }
      }
      .vm-bar__label {
        flex: 1 1 0;
        min-width: 0;
        overflow: hidden;
        font-size: 13px;
        font-weight: 600;
        line-height: 20px;
        color: var(--fluvy-text);
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .vm-bar__label.is-hint {
        font-weight: 500;
        color: var(--fluvy-text-secondary);
      }
      .vm-go {
        display: grid;
        flex: none;
        place-items: center;
        min-width: 44px;
        height: 44px;
        padding: 0 4px 0 0;
      }
      /* its glyph alone: a 36 round in the middle of its 44 */
      .vm-go.is-glyph {
        padding: 0;
      }
      .vm-go__pill {
        display: grid;
        place-items: center;
        min-width: 36px;
        height: 36px;
        border-radius: 18px;
        background: var(--fluvy-primary, var(--fluvy-accent));
        box-shadow: inset 0 0 0 1px var(--fluvy-primary-edge, transparent);
        font-size: 13px;
        font-weight: 600;
        line-height: 20px;
        color: var(--fluvy-on-primary, var(--fluvy-text-on-accent));
        text-align: center;
        white-space: nowrap;
      }
      .vm-go__pill svg {
        width: 20px;
        height: 20px;
      }
      .vm-go:disabled .vm-go__pill {
        background: var(--fluvy-inset, var(--fluvy-page));
        box-shadow: none;
        color: var(--fluvy-text-secondary);
      }
      /* no picture: the unavailable skin, the map's glyph and why */
      .vm-plate.is-off {
        background: var(--fluvy-page);
        outline: 1px dashed var(--fluvy-unavailable-border);
        outline-offset: -1px;
      }
      .vm-off {
        position: absolute;
        right: 0;
        left: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-items: center;
      }
      .vm-off p {
        width: 100%;
        font-size: 13px;
        font-weight: 500;
        line-height: 24px;
        color: var(--fluvy-unavailable);
        text-align: center;
        white-space: nowrap;
      }
    `,
  ];

  static override properties = {
    hass: { attribute: false },
    scene: { attribute: false },
    chosen: { attribute: false },
    card: { attribute: false },
    held: { attribute: false },
    name: {},
    width: { type: Number },
    height: { type: Number },
    still: { type: Boolean },
    busy: { type: Boolean },
    mode_: { state: true },
    drawing_: { state: true },
    natural_: { state: true },
  };

  declare hass?: HomeAssistant;
  declare scene?: Scene;
  /** What is picked, as the card keeps it. */
  declare chosen?: Selection;
  declare card?: MapHost;
  /** The playground's hook: the map as a hand left it, taken as it is given. */
  declare held?: MapHeld;
  /** The robot's name: whose map it is, to a reader. */
  declare name: string;
  /** The plate's size, in its own pixels: the card's column, and its shape's height across it. */
  declare width: number;
  declare height: number;
  /** The robot is out of reach: the plate keeps its size and takes no tap. */
  declare still: boolean;
  /** The robot is at work: a camera's map is asked again every five seconds, else every minute. */
  declare busy: boolean;
  /** The mode a hand is in: marking a zone, or picking a point. */
  declare mode_: MapMode | undefined;
  /** The zone being marked, by two corners on the picture. */
  declare drawing_: readonly [Point, Point] | undefined;
  /** The picture's own size, read off the frame shown: what its calibration counts in. */
  declare natural_: readonly [number, number] | undefined;

  private readonly ruler = new TextRuler(() => this.renderRoot);
  private readonly feed = new CameraFeed(
    this,
    () => this.want(),
    () => this.plate,
  );
  private readonly view = new PanZoom(
    () => this.plate,
    () => this,
    () => this.requestUpdate(),
  );

  constructor() {
    super();
    this.name = '';
    this.width = 320;
    this.height = 240;
    this.still = false;
    this.busy = false;
    new MotionMark(this);
    new FontsSettled(this, () => {
      this.ruler.clear();
      this.requestUpdate();
    });
  }

  private get plate(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>('.vm-plate');
  }

  /* ---------- the picture ---------- */

  /**
   * The picture the feed fetches: a camera's still on a clock, an image entity's again when it says a new one, a
   * plain address once; as it is, never scaled (its calibration counts its own pixels).
   */
  private want(): FeedWant {
    const image = this.scene?.map?.image;
    const id = imageEntity(image);
    const view = id ? resolveEntity(this.hass, id) : null;
    const address = id ? '' : imageOf(this.hass, image);
    return {
      hass: this.hass,
      view,
      ...(address ? { address } : {}),
      live: false,
      refresh: this.busy ? 5 : 60,
      once: view?.domain !== 'camera',
      width: 0,
    };
  }

  /** Whether there is a picture to ask for at all. */
  private get pictured(): boolean {
    const want = this.want();
    return Boolean(
      want.address || (want.view?.status === 'ok' && want.view.attr('entity_picture')),
    );
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has('card') && this.renderRoot instanceof ShadowRoot)
      this.card?.adopt(this.renderRoot);
    if (changed.has('held') && this.held) {
      const [zoom = 1, x = 0, y = 0] = this.held.zoom ?? [];
      Object.assign(this.view, { zoom, x, y });
      this.mode_ = this.held.mode;
      this.drawing_ = this.held.drawing;
    }
    // a plate that changed its size holds its picture inside it still
    if (changed.has('width') || changed.has('height')) this.view.settle();
    // out of reach, or another map: a mode the map can no longer be in is left
    if (this.mode_ && (this.still || changed.has('scene')) && !this.modes().includes(this.mode_)) {
      this.mode_ = undefined;
      this.drawing_ = undefined;
    }
  }

  protected override updated(): void {
    const front = this.renderRoot.querySelector<HTMLImageElement>('.fv-plate__img.is-on');
    const [width, height] = [front?.naturalWidth ?? 0, front?.naturalHeight ?? 0];
    if (width && height && (width !== this.natural_?.[0] || height !== this.natural_[1]))
      this.natural_ = [width, height];
  }

  /* ---------- where things stand ---------- */

  /**
   * The picture laid whole in the plate: how many of the plate's pixels one of its own takes, and where its top left
   * corner stands, before it is enlarged.
   */
  private get laid(): { readonly scale: number; readonly x: number; readonly y: number } {
    const [width, height] = this.natural_ ?? [this.width, this.height];
    const scale = Math.min(this.width / width, this.height / height);
    return { scale, x: (this.width - width * scale) / 2, y: (this.height - height * scale) / 2 };
  }

  /** A pixel of the picture as a spot of the plate, enlarged and carried as it is. */
  private onPlate([x, y]: Point): Point {
    const { scale, x: left, y: top } = this.laid;
    const { zoom } = this.view;
    return [this.view.x + (left + x * scale) * zoom, this.view.y + (top + y * scale) * zoom];
  }

  /** A pointer's spot as a pixel of the picture. */
  private onPicture(event: { readonly clientX: number; readonly clientY: number }): Point {
    const plate = this.plate;
    const spot = plate ? localPoint(plate, event) : { x: 0, y: 0 };
    const { scale, x: left, y: top } = this.laid;
    const { zoom } = this.view;
    return [
      ((spot.x - this.view.x) / zoom - left) / scale,
      ((spot.y - this.view.y) / zoom - top) / scale,
    ];
  }

  /** The modes a hand may take here: those the config asks, the robot has a way for, on a calibrated map. */
  private modes(): readonly MapMode[] {
    const scene = this.scene;
    if (!scene?.map || !scene.calibration || this.still) return [];
    return scene.map.modes.filter((mode) =>
      mode === 'zone' ? scene.ways.zones !== undefined : scene.ways.point !== undefined,
    );
  }

  /** What the selection asks of the robot, as a call; none where the robot has no way for it. */
  private get call(): ReturnType<typeof callOf> {
    const { scene, chosen } = this;
    return scene && chosen
      ? callOf(scene.ways, jobOf(chosen, scene.rooms, scene.presets, scene.map?.repeats ?? 1))
      : undefined;
  }

  /* ---------- what a hand does ---------- */

  private pick(chosen: Selection | undefined): void {
    haptic(this, 'selection');
    this.dispatchEvent(
      new CustomEvent<MapChosenDetail>(MAP_CHOSEN, {
        detail: { chosen },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** A mode entered: what was picked gives way to what the hand is about to pick. */
  private enter(mode: MapMode): void {
    this.mode_ = mode;
    this.drawing_ = undefined;
    if (this.chosen) this.pick(undefined);
  }

  /** The bar's cross: nothing picked, no mode. */
  private readonly clear = (): void => {
    this.mode_ = undefined;
    this.drawing_ = undefined;
    if (this.chosen) this.pick(undefined);
  };

  /** Clean, or Go here: the robot is asked, and the map is as it was. A call Home Assistant refuses says so itself. */
  private readonly go = (): void => {
    const found = this.call;
    if (!this.hass || !found) return;
    haptic(this, 'light');
    send(this.hass, found).catch(() => undefined);
    this.clear();
  };

  private readonly onDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const layer = event.currentTarget as HTMLElement;
    if (this.mode_ === 'zone') {
      const at = this.onPicture(event);
      this.drawing_ = [at, at];
    } else if (!this.view.grab(event)) return;
    try {
      layer.setPointerCapture(event.pointerId);
    } catch {
      /* not a live pointer */
    }
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (this.drawing_) this.drawing_ = [this.drawing_[0], this.onPicture(event)];
    else this.view.drag(event);
  };

  /** The zone marked is the robot's once the finger lifts: its two corners through the calibration, the mode over. */
  private readonly onUp = (): void => {
    this.view.release();
    const drawn = this.drawing_;
    const calibration = this.scene?.calibration;
    this.drawing_ = undefined;
    if (!drawn || !calibration) return;
    const [a, b] = drawn.map((corner) => this.onPlate(corner)) as [Point, Point];
    if (Math.abs(a[0] - b[0]) < DRAWN_LEAST || Math.abs(a[1] - b[1]) < DRAWN_LEAST) return;
    // a calibration that sends a corner nowhere (a map seen at an angle, at its horizon) marks no zone
    const zone = rectOf(calibration.toRobot(drawn[0]), calibration.toRobot(drawn[1]));
    if (!zone.every(Number.isFinite)) return;
    this.mode_ = undefined;
    this.pick(withDrawn(this.chosen, zone));
  };

  private readonly onCancel = (): void => {
    this.view.release();
    this.drawing_ = undefined;
  };

  /**
   * A click on the picture, heard before what is drawn on it: one that ends a mouse's drag picks nothing, and one in
   * the point's mode is the point, as the robot counts it in whole numbers.
   */
  private readonly onClick = (event: MouseEvent): void => {
    const calibration = this.scene?.calibration;
    if (this.view.dragged) {
      this.view.dragged = false;
      event.stopPropagation();
    } else if (this.mode_ === 'point' && calibration) {
      event.stopPropagation();
      const [x, y] = calibration.toRobot(this.onPicture(event));
      if (Number.isFinite(x) && Number.isFinite(y))
        this.pick(withPoint([Math.round(x), Math.round(y)]));
    }
  };

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && (this.mode_ || this.chosen)) this.clear();
    else if (this.view.key(event)) event.preventDefault();
  };

  /* ---------- what is drawn ---------- */

  /** The rooms and the saved zones as shapes on the picture, and each one's name where it stands. */
  private drawn(): { readonly shapes: readonly Shape[]; readonly tags: readonly Tag[] } {
    const { scene, chosen } = this;
    const calibration = scene?.calibration;
    if (!scene || !calibration) return { shapes: [], tags: [] };
    const shapes: Shape[] = [];
    const tags: Tag[] = [];
    const accent = (colour: string | undefined): string | undefined => this.card?.accent(colour);
    // the saved zones first: where a room's name and a zone's would stand on each other, the zone's is the person's
    scene.presets.forEach((preset, index) => {
      if (!preset.onMap) return;
      const tint = accent(preset.color);
      const lit = chosen?.kind === 'zones' && chosen.presets.includes(index);
      const tap = (): void => this.pick(withZone(this.chosen, index));
      const corners = preset.zones.map((zone) => cornersOf(zone).map(calibration.toMap));
      corners.forEach((points, part) => {
        if (!finite(points)) return;
        shapes.push({
          key: `z${index}-${part}`,
          kind: 'zone',
          points,
          chosen: lit,
          accent: tint,
          tap,
        });
        if (!part)
          tags.push({
            key: `z${index}`,
            text: preset.name,
            at: span(points).corner,
            tab: true,
            chosen: lit,
            accent: tint,
            tap,
          });
      });
      const at = preset.point && calibration.toMap(preset.point);
      const gone = chosen?.kind === 'point' && chosen.preset === index;
      if (preset.point && at && finite([at]))
        tags.push({
          key: `p${index}`,
          text: preset.name,
          at,
          pin: true,
          chosen: gone,
          accent: tint,
          tap: () => this.pick(gone ? undefined : withPoint(preset.point as Point, index)),
        });
    });
    for (const room of scene.rooms) {
      const points = room.outline.map(calibration.toMap);
      if (points.length < 3 || !finite(points)) continue;
      const look = {
        key: `r${room.key}`,
        chosen: chosen?.kind === 'rooms' && chosen.rooms.includes(room.key),
        accent: accent(room.color),
        tap: (): void => this.pick(withRoom(this.chosen, room.key)),
      };
      shapes.push({ ...look, kind: 'room', points });
      tags.push({ ...look, text: room.name, at: span(points).middle, within: points });
    }
    return { shapes, tags };
  }

  /**
   * The names placed, those picked first: each as its pill where the map shows names and the pill stands clear of
   * the plate's controls and of the names placed before it — a room's a step under or over its middle where that is
   * taken, while it stays in the room — else not at all until the map is enlarged (its shape takes the taps), a saved
   * point's as a dot. A name's target (44, the pill in its middle) is held inside the plate, so a name by the edge
   * steps in from it.
   */
  private place(tags: readonly Tag[], taken: readonly Box[]): readonly PlacedTag[] {
    const names = this.scene?.map?.names !== false;
    const most = Math.min(TAG_MOST, this.width - 2 * EDGE);
    const placed: PlacedTag[] = [];
    const seen: Box[] = [...taken];
    const reach = this.laid.scale * this.view.zoom;
    for (const tag of [...tags].sort((a, b) => Number(b.chosen) - Number(a.chosen))) {
      const [x, y] = this.onPlate(tag.at);
      if (x < 0 || y < 0 || x > this.width || y > this.height) continue;
      // an even pill in its even target: its sides on whole pixels
      const pill =
        names && tag.text
          ? Math.min(
              most,
              2 * Math.ceil(this.ruler.width('vm-tag__pill', tag.text) / 2) + TAG_SIDES,
            )
          : 0;
      const steps = STEPS.filter(
        (step) =>
          !step ||
          (tag.within &&
            inside(tag.within, [tag.at[0], tag.at[1] + step / reach]) &&
            y + step < this.height),
      );
      const tries = [...(pill ? [pill] : []), ...(tag.pin ? [DOT] : [])].flatMap((size) =>
        steps.map((step) => [size, step] as const),
      );
      for (const [size, step] of tries) {
        const w = Math.max(TARGET, size);
        const h = size === DOT ? DOT : TAG;
        const left = tag.tab ? x + TAB_IN - (w - size) / 2 : x - w / 2;
        const box = {
          x: Math.round(clamp(left, 0, this.width - w)),
          y: Math.round(clamp(y + step - TARGET / 2, 0, this.height - TARGET)),
          w,
          h: TARGET,
        };
        // what the eye sees of it, and the gap it keeps from the next
        const sight = {
          x: box.x + (w - size) / 2 - TAG_GAP / 2,
          y: box.y + (TARGET - h) / 2 - TAG_GAP / 2,
          w: size + TAG_GAP,
          h: h + TAG_GAP,
        };
        if (seen.some((other) => meet(sight, other))) continue;
        seen.push(sight);
        placed.push({ ...tag, box, dot: size === DOT });
        break;
      }
    }
    return placed;
  }

  private renderTag(tag: PlacedTag): TemplateResult {
    const { box } = tag;
    return html`<button
      class="vm-tag ${tag.dot ? 'is-dot' : ''} ${tag.tab ? 'is-tab' : ''} ${
        tag.chosen ? 'is-on' : ''
      }"
      data-target
      data-measure="drawn"
      data-accent=${tag.accent ?? nothing}
      style="left:${box.x}px;top:${box.y}px;width:${box.w}px"
      aria-pressed=${tag.chosen ? 'true' : 'false'}
      aria-label=${tag.dot ? tag.text : nothing}
      title=${tag.dot ? tag.text : nothing}
      @click=${tag.tap}
    >
      <span class="vm-tag__pill" data-name>${tag.dot ? nothing : tag.text}</span>
    </button>`;
  }

  /**
   * The bar at the plate's foot while something is picked or a mode is on: the cross, what is picked (its names, or
   * what the mode waits for) where the bar holds it, and Clean or Go here: its word where the bar holds that beside
   * the cross, else its glyph, the word its label. A mode's bar with no room for what it waits for is its cross
   * alone, a round where the rounds stood; it goes while its finger is down: the map is the zone's.
   */
  private renderBar(head: boolean): TemplateResult | typeof nothing {
    const { scene, chosen, hass } = this;
    if (!scene || (!chosen && !this.mode_) || this.drawing_) return nothing;
    const inner = this.width - 2 * EDGE;
    const point = chosen?.kind === 'point';
    const word = chosen ? s(hass, point ? 'go' : 'clean') : '';
    const pill = word ? up4(this.ruler.width('vm-go__pill', word) + 32) : 0;
    const whole = pill + 4 <= inner - TARGET;
    const end = !word ? EDGE : whole ? Math.max(TARGET, pill + 4) : TARGET;
    const room = inner - TARGET - end - 4;
    const names = chosen ? namesOf(chosen, scene.rooms, scene.presets) : [];
    const own =
      chosen?.kind === 'zones' && chosen.drawn
        ? s(hass, 'zone')
        : point && !names.length
          ? s(hass, 'point')
          : '';
    const hint = chosen ? '' : s(hass, this.mode_ === 'zone' ? 'draw_hint' : 'pick_hint');
    const words = [...names, own].filter(Boolean).join(', ') || hint;
    // a name's words may end in an ellipsis; the map's own words are said whole or not at all
    const shown = names.length
      ? room >= NAMES_LEAST
      : this.ruler.width(`vm-bar__label${hint ? ' is-hint' : ''}`, words) <= room;
    return html`<div
      class="vm-bar ${chosen ? '' : `is-waiting ${shown ? '' : 'is-bare'}`} ${head ? 'is-head' : ''}"
      role="group"
      aria-label=${words}
    >
      ${round('close', 'bare', s(hass, 'clear'), this.clear)}
      <span
        class="vm-bar__label ${hint ? 'is-hint' : ''}"
        ?data-name=${names.length > 0}
        title=${names.length ? words : nothing}
        >${shown ? words : nothing}</span
      >
      ${
        word
          ? html`<button
              class="vm-go ${whole ? '' : 'is-glyph'}"
              data-target
              aria-label=${whole ? nothing : word}
              title=${whole ? nothing : word}
              ?disabled=${!this.call}
              @click=${this.go}
            >
              <span class="vm-go__pill" data-control style=${whole ? `width:${pill}px` : nothing}
                >${whole ? word : glyph(point ? 'locate' : 'play')}</span
              >
            </button>`
          : nothing
      }
    </div>`;
  }

  private renderOff(): TemplateResult {
    const words = s(this.hass, 'none');
    const fits =
      this.height >= 44 + 8 + 24 + 24 && this.ruler.width('vm-off > p', words) <= this.width - 32;
    // the glyph, and 8 and its line of 24 where it has its words, centred on the 4 grid
    const block = 44 + (fits ? 8 + 24 : 0);
    const top = Math.max(0, Math.round((this.height - block) / 2 / 4) * 4);
    return html`<div
      class="vm-plate fv-plate is-off"
      style="height:${this.height}px"
      role="img"
      aria-label=${words}
    >
      <div class="vm-off" style="top:${top}px">
        <span class="fv-ico fv-ico--off" data-icon>${glyph('map')}</span>
        ${fits ? html`<p>${words}</p>` : nothing}
      </div>
    </div>`;
  }

  /**
   * Where what a hand marked stands on the plate (a point, a zone's box), top to bottom; none for what is saved,
   * whose place is known without looking.
   */
  private get marked(): { readonly top: number; readonly bottom: number } | undefined {
    const { chosen } = this;
    const calibration = this.scene?.calibration;
    if (!chosen || !calibration || !this.natural_) return undefined;
    const corners =
      chosen.kind === 'point' && chosen.preset === undefined
        ? [chosen.point]
        : chosen.kind === 'zones' && chosen.drawn
          ? cornersOf(chosen.drawn)
          : [];
    const ys = corners.map((corner) => this.onPlate(calibration.toMap(corner))[1]);
    return ys.length && ys.every(Number.isFinite)
      ? { top: Math.min(...ys), bottom: Math.max(...ys) }
      : undefined;
  }

  /** What is drawn over the picture, in its own pixels: the veil round what is picked, the shapes, a zone marked. */
  private renderShapes(shapes: readonly Shape[]): TemplateResult | typeof nothing {
    const [width, height] = this.natural_ ?? [0, 0];
    if (!width || !height) return nothing;
    const calibration = this.scene?.calibration;
    const marked = this.chosen?.kind === 'zones' ? this.chosen.drawn : undefined;
    const markedAt = marked && calibration ? cornersOf(marked).map(calibration.toMap) : [];
    const lit = [
      ...shapes.filter((shape) => shape.chosen).map((shape) => shape.points),
      ...(markedAt.length && finite(markedAt) ? [markedAt] : []),
    ];
    const drawing = this.drawing_;
    const reach = this.laid.scale * this.view.zoom;
    // the rooms under the zones, which lie inside them; what is smaller than a finger with its band
    const ordered = [...shapes].sort(
      (a, b) => Number(a.kind === 'zone') - Number(b.kind === 'zone'),
    );
    const short = (points: readonly Point[]): number => {
      const xs = points.map(([x]) => x);
      const ys = points.map(([, y]) => y);
      const least = Math.min(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      return Math.max(0, TARGET - least * reach);
    };
    return svg`<svg
      class="vm-shapes"
      viewBox="0 0 ${width} ${height}"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      ${
        lit.length
          ? svg`<path
              class="vm-veil"
              fill-rule="evenodd"
              d="M0 0H${width}V${height}H0Z${lit.map((points) => `M${outline(points).replaceAll(' ', 'L')}Z`).join('')}"
            />`
          : nothing
      }
      ${ordered.map(
        (shape) => svg`${
          short(shape.points)
            ? svg`<polygon
                class="vm-hit"
                points=${outline(shape.points)}
                stroke-width=${short(shape.points)}
                @click=${shape.tap}
              />`
            : nothing
        }${
          shape.kind === 'zone' || shape.chosen
            ? svg`<polygon
                class="vm-case ${shape.chosen ? 'is-on' : ''}"
                points=${outline(shape.points)}
              />`
            : nothing
        }<polygon
          class="vm-shape vm-shape--${shape.kind} ${shape.chosen ? 'is-on' : ''}"
          data-accent=${shape.accent ?? nothing}
          points=${outline(shape.points)}
          @click=${shape.tap}
        />`,
      )}
      ${
        markedAt.length && finite(markedAt)
          ? svg`<polygon class="vm-case is-on" points=${outline(markedAt)} /><polygon
              class="vm-shape is-on"
              points=${outline(markedAt)}
            />`
          : nothing
      }
      ${
        drawing
          ? svg`<rect
              class="vm-shape--drawn"
              x=${Math.min(drawing[0][0], drawing[1][0])}
              y=${Math.min(drawing[0][1], drawing[1][1])}
              width=${Math.abs(drawing[0][0] - drawing[1][0])}
              height=${Math.abs(drawing[0][1] - drawing[1][1])}
              vector-effect="non-scaling-stroke"
            />`
          : nothing
      }
    </svg>`;
  }

  protected override render(): TemplateResult | typeof nothing {
    const { scene, hass } = this;
    if (!scene?.map) return nothing;
    if (this.still || !this.pictured || this.feed.failed) return this.renderOff();
    const { zoom } = this.view;
    const barred = Boolean(this.chosen || this.mode_);
    // the rounds stand where the bar does, one or the other, and leave the map half the plate's width: a narrow
    // plate holds the first of them, a plate half a section wide none
    const rounds = barred
      ? []
      : this.modes().slice(0, Math.max(0, Math.floor((this.width / 2 - EDGE) / (TARGET + EDGE))));
    const fit = this.view.zoomed;
    // the bar at the plate's foot, unless what a hand just marked lies there and not at its head
    const strip = TARGET + 2 * EDGE;
    const marked = this.marked;
    const head = marked !== undefined && marked.bottom > this.height - strip && marked.top > strip;
    const taken: Box[] = [];
    const across = rounds.length * (TARGET + EDGE);
    if (rounds.length)
      taken.push({
        x: this.width - EDGE - across,
        y: this.height - 2 * EDGE - TARGET,
        w: across + EDGE,
        h: TARGET + 2 * EDGE,
      });
    if (fit)
      taken.push({
        x: this.width - strip,
        y: head ? this.height - strip : 0,
        w: strip,
        h: strip,
      });
    if (barred && !this.drawing_)
      taken.push({ x: 0, y: head ? 0 : this.height - strip, w: this.width, h: strip });
    const { shapes, tags } = this.natural_ ? this.drawn() : { shapes: [], tags: [] };
    const calibration = scene.calibration;
    const pin =
      this.chosen?.kind === 'point' &&
      this.chosen.preset === undefined &&
      calibration &&
      this.natural_
        ? this.onPlate(calibration.toMap(this.chosen.point))
        : undefined;
    if (pin) taken.push({ x: pin[0] - 14, y: pin[1] - 14, w: 28, h: 28 });
    const crisp = this.laid.scale * zoom * (window.devicePixelRatio || 1) >= 2;
    const label = [this.name, s(hass, 'map')].filter(Boolean).join(' · ');
    return html`<div
      class="vm-plate fv-plate ${this.mode_ === 'zone' ? 'is-drawing' : ''} ${
        this.mode_ === 'point' ? 'is-picking' : ''
      } ${this.view.zoomed ? 'is-zoomed' : ''} ${crisp ? 'is-crisp' : ''}"
      style="height:${this.height}px"
      tabindex="0"
      role="group"
      aria-label=${label}
      @keydown=${this.onKey}
      @wheel=${{ handleEvent: this.view.wheel, passive: false }}
      @touchstart=${{ handleEvent: this.view.touchStart, passive: true }}
      @touchmove=${{ handleEvent: this.view.touchMove, passive: false }}
      @touchend=${this.view.touchEnd}
      @touchcancel=${this.view.touchEnd}
    >
      <div class="vm-clip" data-measure="skip">
        <div
          class="vm-layer"
          style="transform:translate(${this.view.x}px, ${this.view.y}px) scale(${zoom})"
          @pointerdown=${this.onDown}
          @pointermove=${this.onMove}
          @pointerup=${this.onUp}
          @pointercancel=${this.onCancel}
          @dblclick=${this.view.doubleClick}
          @click=${{ handleEvent: this.onClick, capture: true }}
        >
          ${this.feed.render('contain', this.width / this.height, '')}
          ${this.feed.stamp ? nothing : html`<span class="fv-skeleton vm-skeleton"></span>`}
          ${this.renderShapes(shapes)}
        </div>
      </div>
      ${this.place(tags, taken).map((tag) => this.renderTag(tag))}
      ${
        pin && finite([pin])
          ? html`<span
              class="vm-pin"
              data-measure="drawn"
              style="left:${Math.round(pin[0])}px;top:${Math.round(pin[1])}px"
            ></span>`
          : nothing
      }
      ${
        rounds.length
          ? html`<div class="vm-rounds vm-rounds--foot">
              ${rounds.map((mode) =>
                round(
                  mode === 'zone' ? ZONE : 'pin',
                  'on-page',
                  s(hass, mode === 'zone' ? 'draw' : 'pick'),
                  () => this.enter(mode),
                ),
              )}
            </div>`
          : nothing
      }
      ${
        fit
          ? html`<div class="vm-rounds vm-rounds--${head ? 'foot' : 'head'}">
              ${round(FIT, 'on-page', s(hass, 'fit'), () => this.view.fit())}
            </div>`
          : nothing
      }
      ${this.renderBar(head)}
    </div>`;
  }
}

if (!customElements.get('fluvy-vacuum-map'))
  customElements.define('fluvy-vacuum-map', FluvyVacuumMap);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-vacuum-map': FluvyVacuumMap;
  }
}
