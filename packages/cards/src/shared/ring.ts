import { icon, type IconRef } from '@fluvy/ui';
import { css, html, nothing, svg, type TemplateResult } from 'lit';

/*
 * The ring: a disc of the inset ground with four arrows round a middle key. The TV remote's D-pad (#143) and the
 * robot's drive pad (#178) are this one drawing, in a chunk of its own both fetch.
 */

/** One of the ring's arrows: its name, its glyph, and what a press, a release and a click of it run. */
export interface RingArrow {
  readonly key: string;
  readonly label: string;
  readonly glyph: IconRef;
  /** Drawn, taking no press. */
  readonly still?: boolean;
  readonly down?: (event: PointerEvent) => void;
  readonly up?: () => void;
  readonly click: (event: MouseEvent) => void;
}

export interface RingOptions {
  /** The disc's diameter. */
  readonly size: number;
  /** The middle key's: the remote's 64, less where a smaller ring would lay it under its arrows (`ringMiddle`). */
  readonly middle?: number;
  /** The arrows from the top, clockwise: up, right, down, left. */
  readonly arrows: readonly RingArrow[];
  /** The arrow whose quadrant is lit. */
  readonly lit?: string;
  /** The middle key: its name, what it shows (a word, a glyph, nothing) and what a click of it runs. */
  readonly centre: {
    readonly label: string;
    readonly content: unknown;
    readonly still?: boolean;
    readonly click: () => void;
  };
}

/** The middle key a ring of `size` holds clear of its arrows' 44 targets: 64 from 176, down to a finger's 44. */
export const ringMiddle = (size: number): number => Math.min(64, Math.max(44, size - 112));

/**
 * The ring, drawn into a positioned box of `size` the caller keeps: the disc, the lit quadrant, four arrows at 44
 * targets 28 inside its edge, and the middle key, a disc of the card's colour on its hairline (a drawn key, a target
 * but none of the house's control heights).
 */
export function ring({ size, middle = 64, arrows, lit, centre }: RingOptions): TemplateResult {
  const c = size / 2;
  const rGap = middle / 2 + 4;
  const rGlyph = c - 28;
  const rad = (deg: number): number => (deg * Math.PI) / 180;
  const pt = (r: number, deg: number): [number, number] => [
    c + r * Math.cos(rad(deg)),
    c + r * Math.sin(rad(deg)),
  ];
  const wedge = (deg: number): string => {
    const [x0, y0] = pt(c - 1, deg - 45);
    const [x1, y1] = pt(c - 1, deg + 45);
    const [x2, y2] = pt(rGap, deg + 45);
    const [x3, y3] = pt(rGap, deg - 45);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${c - 1} ${c - 1} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} A${rGap} ${rGap} 0 0 0 ${x3.toFixed(1)} ${y3.toFixed(1)} Z`;
  };
  const angle = (index: number): number => index * 90 - 90;
  const pressed = arrows.findIndex((arrow) => arrow.key === lit);
  return html`<svg
      class="fv-ring__plate"
      width=${size}
      height=${size}
      viewBox="0 0 ${size} ${size}"
      aria-hidden="true"
    >
      <circle class="fv-ring__disc" cx=${c} cy=${c} r=${c - 0.5} />
      ${pressed < 0 ? nothing : svg`<path class="fv-ring__wedge" d=${wedge(angle(pressed))} />`}
    </svg>
    ${arrows.map((arrow, index) => {
      const [x, y] = pt(rGlyph, angle(index));
      const up = arrow.up ?? nothing;
      return html`<button
        class="fv-ring__arrow ${index === pressed ? 'is-pressed' : ''}"
        style="left:${Math.round(x - 22)}px;top:${Math.round(y - 22)}px"
        data-control
        data-target
        aria-label=${arrow.label}
        title=${arrow.label}
        ?disabled=${arrow.still ?? false}
        @pointerdown=${arrow.down ?? nothing}
        @pointerup=${up}
        @pointerleave=${up}
        @pointercancel=${up}
        @click=${arrow.click}
      >
        ${icon(arrow.glyph)}
      </button>`;
    })}
    <button
      class="fv-ring__mid"
      style="left:${c - middle / 2}px;top:${c - middle / 2}px;width:${middle}px;height:${middle}px"
      data-target
      aria-label=${centre.label}
      title=${centre.label}
      ?disabled=${centre.still ?? false}
      @click=${centre.click}
    >
      ${centre.content}
    </button>`;
}

/** The ring's sheet: its disc, its lit quadrant, its arrows and its middle key, and what they wear out of reach. */
export const ringStyles = css`
  .fv-ring__plate {
    display: block;
  }
  .fv-ring__disc {
    fill: var(--fluvy-inset, var(--fluvy-page));
  }
  .fv-ring__wedge {
    fill: var(--fluvy-accent-fill);
  }
  .fv-ring__arrow,
  .fv-ring__mid {
    position: absolute;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: none;
    font: inherit;
    color: var(--fluvy-text);
    cursor: pointer;
    transition:
      transform var(--fv-fast) var(--fv-ease),
      color var(--fv-base) var(--fv-ease),
      background-color var(--fv-base) var(--fv-ease);
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
  }
  .fv-ring__arrow {
    width: 44px;
    height: 44px;
  }
  .fv-ring__arrow svg,
  .fv-ring__mid svg {
    width: 20px;
    height: 20px;
  }
  .fv-ring__arrow.is-pressed {
    color: var(--fluvy-accent-on-fill);
  }
  .fv-ring__mid {
    background: var(--fv-solid-card, var(--fluvy-card));
    box-shadow:
      inset 0 0 0 1px var(--fluvy-border),
      0 1px 2px rgb(0 0 0 / calc(0.06 * var(--fluvy-shade, 1)));
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .fv-ring__mid:active {
    transform: scale(0.94);
    background: var(--fluvy-page-alt);
  }
  .fv-ring__arrow[disabled],
  .fv-ring__mid[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }
  /* out of reach: what would vanish into the card's page fill wears the card's dashed skin; quiet, none of it */
  .is-off:where(:not([data-unavailable='quiet'])) .fv-ring__mid {
    background: transparent;
    outline: 1px dashed var(--fluvy-unavailable-border);
    outline-offset: -1px;
    box-shadow: none;
    color: var(--fluvy-unavailable);
  }
  .is-off:where(:not([data-unavailable='quiet'])) .fv-ring__disc {
    fill: transparent;
    stroke: var(--fluvy-unavailable-border);
    stroke-dasharray: 3 3;
  }
  .is-off:where(:not([data-unavailable='quiet'])) .fv-ring__arrow {
    color: var(--fluvy-unavailable);
  }
  .is-off .fv-ring__arrow[disabled],
  .is-off .fv-ring__mid[disabled] {
    opacity: 1;
  }
`;
