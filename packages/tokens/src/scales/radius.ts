/**
 * Radius scale. `card` and `control` are the two shapes the product is recognised by; the rest exist so
 * nested elements can step down without guessing. A shape sets the whole scale at once: Soft is the
 * approved one (card 20, tile 16, control 12, sheet 24), Round opens it up for a softer, bolder look and
 * Crisp tightens it. Pills and circles never change.
 */
export type ShapeName = 'soft' | 'round' | 'crisp';

export interface RadiusScale {
  readonly sm: string;
  readonly md: string;
  /** Every rectangular tappable: buttons, fields, option tiles. */
  readonly control: string;
  /** A tile, an inner panel. */
  readonly lg: string;
  readonly card: string;
  /** Dialogs and sheets. */
  readonly xl: string;
  readonly pill: string;
  readonly circle: string;
}

export const SHAPE_NAMES: readonly ShapeName[] = ['soft', 'round', 'crisp'];
export const DEFAULT_SHAPE: ShapeName = 'soft';

/**
 * How round the pill-shaped things are (chips, tabs, badges, a notice), chosen apart from the shape: a true pill
 * (the approved one), or the corners of a soft or a crisp button. A switch stays a capsule and a circle a circle.
 */
export type PillName = 'round' | 'soft' | 'crisp';
export const PILL_NAMES: readonly PillName[] = ['round', 'soft', 'crisp'];
export const DEFAULT_PILL: PillName = 'round';
export const PILLS: Readonly<Record<PillName, string>> = {
  round: '9999px',
  soft: '12px',
  crisp: '6px',
};

const scale = (
  sm: number,
  md: number,
  control: number,
  lg: number,
  card: number,
  xl: number,
): RadiusScale => ({
  sm: `${sm}px`,
  md: `${md}px`,
  control: `${control}px`,
  lg: `${lg}px`,
  card: `${card}px`,
  xl: `${xl}px`,
  pill: '9999px',
  circle: '50%',
});

export const SHAPES: Readonly<Record<ShapeName, RadiusScale>> = {
  soft: scale(4, 8, 12, 16, 20, 24),
  round: scale(6, 10, 16, 22, 28, 32),
  crisp: scale(2, 6, 8, 12, 14, 18),
};

/** The approved scale (Soft). */
export const radius = SHAPES[DEFAULT_SHAPE];

export type RadiusName = keyof RadiusScale;

/** The icon slot of a tile: a 40×40 box with the control radius. */
export const iconBox = {
  size: '40px',
  radius: radius.control,
} as const;
