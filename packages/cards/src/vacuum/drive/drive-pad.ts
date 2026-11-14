// the pad's words first: they travel with the Vacuum card's chunk, which this one follows
import '../english.js';
import { localize, strings, type HomeAssistant } from '@fluvy/core';
import { baseStyles, haptic, icon, MotionMark, preventMenu, type GlyphName } from '@fluvy/ui';
import {
  LitElement,
  css,
  html,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { ring, ringMiddle, ringStyles, type RingArrow } from '../../shared/ring.js';
import type { DriveProfile } from '../drive.js';
import { DIRECTIONS, DriveSession, type Direction } from './session.js';

const s = strings('drive');

/** Said when remote control is over by itself (ten seconds without a press, a hidden page) or by a call refused. */
export const DRIVE_END = 'fluvy-drive-end';
export interface DriveEndDetail {
  readonly failed: boolean;
}

const GLYPHS: Readonly<Record<Direction, GlyphName>> = {
  forward: 'up',
  right: 'chevron',
  back: 'down',
  left: 'chevronLeft',
};

/** The keyboard's arrows drive too, while the pad has the focus. */
const KEYS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'forward',
  ArrowRight: 'right',
  ArrowDown: 'back',
  ArrowLeft: 'left',
};

/** How long an arrow's quadrant stays lit after its press. */
const LIT_MS = 180;

/**
 * The drive pad (#178): the remote's ring with Stop in its middle, driving a robot by hand. Attached with a profile
 * it starts the robot's remote control; a tap on an arrow is one step, an arrow held (a finger, or a key of the
 * keyboard's arrows) keeps the robot moving and stops it when let go, Stop stops it; taken off the page, it ends
 * remote control and says nothing, from a node no longer on the page (whoever took it off knows: the card that drew it
 * in its sheet instead, or that left the page with it). Over by itself or by a refused call, it says `fluvy-drive-end`.
 * Without a profile it is drawn and does nothing (the playground).
 */
export class FluvyDrivePad extends LitElement {
  static override styles: CSSResultGroup = [
    ...baseStyles,
    ringStyles,
    css`
      :host {
        display: grid;
        place-items: center;
      }
      @keyframes dp-in {
        from {
          opacity: 0;
          transform: scale(0.94);
        }
      }
      .dp-ring {
        position: relative;
        animation: dp-in 220ms var(--fv-ease-out) both;
      }
      /* a finger held on an arrow is the robot's, never the page's scroll */
      .fv-ring__arrow {
        touch-action: none;
      }
    `,
  ];

  static override properties = {
    hass: { attribute: false },
    profile: { attribute: false },
    size: { type: Number },
    lit_: { state: true },
  };

  declare hass?: HomeAssistant;
  declare profile?: DriveProfile;
  /** The ring's diameter. */
  declare size: number;
  /** The arrow whose quadrant is lit. */
  declare lit_: string;

  private session: DriveSession | undefined;
  /** Remote control has started for this stay on the page: over, it does not start again. */
  private begun = false;
  /** The arrow a finger or a key holds, and whether it is a key's. */
  private held: Direction | undefined;
  private keyed = false;
  /** A finger pressed the arrow the next click is of: that click is its release, not a step. */
  private fingered = false;
  private litTimer = 0;

  constructor() {
    super();
    this.size = 176;
    this.lit_ = '';
    new MotionMark(this);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.begun = false;
    this.begin();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.litTimer);
    this.session?.end();
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('profile')) this.begin();
  }

  /** A pad that drives takes the focus as it comes: the keyboard's arrows drive from the first key. */
  protected override firstUpdated(): void {
    if (this.profile) this.focus();
  }

  /** The pad's focus is Stop's: the arrows are a key away, and Enter stops the robot. */
  override focus(): void {
    this.renderRoot.querySelector<HTMLElement>('.fv-ring__mid')?.focus();
  }

  /** Remote control starts once, with the profile the pad is first given while it is on the page. */
  private begin(): void {
    if (this.begun || !this.profile || !this.isConnected) return;
    this.begun = true;
    this.session = new DriveSession(this.profile, {
      call: ({ domain, service, data, target }) =>
        this.hass
          ? this.hass.callService(
              domain,
              service,
              { ...data },
              target ? { entity_id: [...target] } : undefined,
            )
          : Promise.reject(new Error('no Home Assistant')),
      ended: (failed) => {
        this.session = undefined;
        this.held = undefined;
        this.lit_ = '';
        if (this.isConnected)
          this.dispatchEvent(
            new CustomEvent<DriveEndDetail>(DRIVE_END, {
              detail: { failed },
              bubbles: true,
              composed: true,
            }),
          );
      },
    });
    this.session.start();
  }

  /** Ends remote control, as Done does. */
  end(): void {
    this.session?.end();
  }

  /** An arrow taken, by a finger or by a key: lit, and the robot moving. */
  private down(direction: Direction, keyed: boolean): void {
    this.held = direction;
    this.keyed = keyed;
    clearTimeout(this.litTimer);
    this.lit_ = direction;
    haptic(this, 'selection');
    this.session?.press(direction);
  }

  /** The arrow let go, if it is the one held. */
  private up(direction: Direction): void {
    if (this.held !== direction) return;
    this.held = undefined;
    this.session?.release();
    this.dim();
  }

  private dim(): void {
    clearTimeout(this.litTimer);
    this.litTimer = window.setTimeout(() => {
      this.lit_ = '';
    }, LIT_MS);
  }

  private arrow(direction: Direction): RingArrow {
    return {
      key: direction,
      label: s(this.hass, direction),
      glyph: GLYPHS[direction],
      down: (event) => {
        if (event.button !== 0 && event.pointerType === 'mouse') return;
        // the arrow keeps its finger wherever it slides, so its release is always heard; a pointer the browser
        // does not track (one a test made up) is let go on the arrow itself
        try {
          (event.currentTarget as Element).setPointerCapture(event.pointerId);
        } catch {
          /* not a live pointer */
        }
        this.fingered = true;
        this.down(direction, false);
      },
      up: () => this.up(direction),
      // a click no finger began (Enter, Space, a reader's tap) is one step
      click: (event) => {
        const fingered = this.fingered;
        this.fingered = false;
        if (fingered && event.detail > 0) return;
        this.lit_ = direction;
        this.dim();
        this.session?.step(direction);
      },
    };
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const direction = KEYS[event.key];
    if (event.key === 'Escape') this.end();
    if (!direction) return;
    event.preventDefault();
    if (!event.repeat) this.down(direction, true);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const direction = KEYS[event.key];
    if (direction) this.up(direction);
  };

  /** The focus gone elsewhere takes its held key with it: its release would never be heard. */
  private readonly onBlur = (): void => {
    if (this.held && this.keyed) this.up(this.held);
  };

  protected override render(): TemplateResult {
    const size = this.size;
    return html`<div
      class="dp-ring"
      style="width:${size}px;height:${size}px"
      role="group"
      aria-label=${s(this.hass, 'start')}
      @keydown=${this.onKeyDown}
      @keyup=${this.onKeyUp}
      @focusout=${this.onBlur}
      @contextmenu=${preventMenu}
    >
      ${ring({
        size,
        middle: ringMiddle(size),
        arrows: DIRECTIONS.map((direction) => this.arrow(direction)),
        lit: this.lit_,
        centre: {
          label: localize(this.hass, 'vacuum.stop'),
          content: icon('stop'),
          click: () => this.session?.halt(),
        },
      })}
    </div>`;
  }
}

if (!customElements.get('fluvy-drive-pad')) customElements.define('fluvy-drive-pad', FluvyDrivePad);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-drive-pad': FluvyDrivePad;
  }
}
