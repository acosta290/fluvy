import { formatNumber, numberAttr, type EntityView, type HomeAssistant } from '@fluvy/core';
import { clamp } from '@fluvy/ui';

/**
 * A value set on a ruler, read the same way wherever one is drawn — a large tile's foot, the Slider card (#77): its
 * range, its step and its unit, where its lit ticks start, the ticks it is drawn with and how its figures are written.
 * A player's volume and a fan's speed are 0–100 %; a number or a helper says its own range, step and unit.
 */
export interface Scale {
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
  /** Where its lit ticks start: a signed range's zero (an offset of −2…+2), else NaN, its start. */
  readonly origin: number;
  /** The decimals its figures take where its step's would say more: a fan's speeds are whole percents. */
  readonly digits?: number;
}

/** 0–100 %, a step of 1: a player's volume, a fan's speed. */
export const PERCENT: Scale = { min: 0, max: 100, step: 1, unit: '%', origin: Number.NaN };

/* media_player supported_features: the volume can be set */
export const VOLUME_SET = 4;

/** The domains whose state is a value set in a range: a number, a helper. */
export const NUMBERS: ReadonlySet<string> = new Set(['number', 'input_number']);

/** A card's own ends for its scale (`min`, `max`): each where it is a number. */
export interface OwnRange {
  readonly min?: number | undefined;
  readonly max?: number | undefined;
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * A number's or a helper's scale: its range, step and unit as Home Assistant reports them, the card's own `min` and
 * `max` over them where they still make a range (a soundbar kept under 60 %); null where there is no range to set. A
 * step that does not fit the range is a hundredth of it.
 */
export function numberScale(view: EntityView, own: OwnRange = {}): Scale | null {
  const range = (mine: OwnRange): readonly [number, number] | null => {
    const min = finite(mine.min) ? mine.min : numberAttr(view, 'min');
    const max = finite(mine.max) ? mine.max : numberAttr(view, 'max');
    return min !== null && max !== null && max > min ? [min, max] : null;
  };
  const ends = range(own) ?? range({});
  if (!ends) return null;
  const [min, max] = ends;
  const raw = numberAttr(view, 'step');
  const step = raw !== null && raw > 0 && raw <= max - min ? raw : (max - min) / 100;
  return { min, max, step, unit: view.unit, origin: min < 0 && max > 0 ? 0 : Number.NaN };
}

/** The decimals a scale's figures take: its own, else its step's (0.5 → 1, 0.25 → 2), none for a whole step. */
export const digitsOf = (scale: Scale): number =>
  scale.digits ?? (String(Number(scale.step.toFixed(6))).split('.')[1] ?? '').length;

/**
 * A figure on a scale as a card writes it: its step's decimals, and the typographic minus where `formatNumber` leaves
 * Intl's hyphen (loose in Inter); on a signed range a plus too ("−1.0", "0.0", "+0.5"), read as an offset. `brief`:
 * only the decimals it needs, as a ruler's words are written ("−2", "0", "+0.5").
 */
export function scaleText(
  hass: HomeAssistant | undefined,
  scale: Scale,
  value: number,
  brief = false,
): string {
  const digits = digitsOf(scale);
  const figure = formatNumber(hass, Math.abs(value), { digits, minDigits: brief ? 0 : digits });
  const sign = Number(value.toFixed(digits));
  return sign < 0 ? `−${figure}` : sign > 0 && scale.origin === 0 ? `+${figure}` : figure;
}

/** Ticks as fractions of a ruler's length. */
export interface Ticks {
  readonly minor: number;
  readonly major: number;
}

/**
 * The ticks a scale is drawn with: one a step — each a value the knob stops at — where its steps are no more than a
 * ruler's own ticks (`most`: 20 on a card, 12 on a tile), the majors on its quarters, else its halves, else its ends;
 * else the ruler's own (5 % and 25 % on a card, 1/12 and 1/4 on a tile).
 */
export function ticksOf(scale: Scale, most: number): Ticks {
  const steps = (scale.max - scale.min) / scale.step;
  const whole = Math.round(steps);
  if (Math.abs(steps - whole) > 1e-6 || whole < 1 || whole > most)
    return { minor: 1 / most, major: 1 / 4 };
  const every = whole % 4 === 0 ? whole / 4 : whole % 2 === 0 ? whole / 2 : whole;
  return { minor: 1 / whole, major: every / whole };
}

/** A player that is switched off (a television in standby counts): it has no volume to set. */
export const playerOff = (state: string): boolean => state === 'off' || state === 'standby';

/** Where an entity stands on its scale: a player's volume in %, a fan's speed, a number's state; null where it cannot say. */
export function readingOf(view: EntityView): number | null {
  if (view.domain === 'media_player') {
    const level = numberAttr(view, 'volume_level');
    return level === null ? null : Math.round(clamp(level, 0, 1) * 100);
  }
  if (view.domain === 'fan') return numberAttr(view, 'percentage');
  return view.number;
}

/**
 * The percentage a fan is sent for a speed: Home Assistant truncates it to an integer and maps it UP onto a speed, so
 * a stop's value is its floor — 66 is speed 2 of 3 where 67 would already be speed 3.
 */
export const fanPercentage = (value: number): number => Math.floor(clamp(value, 0, 100) + 1e-6);

/** The call that sets an entity to `value` on its scale: a player's volume, a fan's speed, a number's or a helper's value. */
export function setCall(
  view: EntityView,
  value: number,
): readonly [domain: string, service: string, data: Record<string, unknown>] {
  if (view.domain === 'media_player')
    return ['media_player', 'volume_set', { volume_level: clamp(value, 0, 100) / 100 }];
  if (view.domain === 'fan') return ['fan', 'set_percentage', { percentage: fanPercentage(value) }];
  return [view.domain, 'set_value', { value }];
}
