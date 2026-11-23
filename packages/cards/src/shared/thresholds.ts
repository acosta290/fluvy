import { TONES, type Tone } from '@fluvy/ui';
import type { ThresholdBand } from '../chart/engine/model.js';
import { readFigure, type OwnHost } from './own-values.js';

/*
 * A reading's thresholds (1.22, #204): the figures past which a card says it in a colour, read and laid out. Each
 * colours from its value up (`>=`), or under it (`<`) with `below`; a reading takes the nearest that claims it — the
 * highest it reaches upward, the lowest it is under downward, and where one of each claims it the nearer, the one
 * above it on an even split — and a threshold in no colour (`tone: none`) ends a band there. Upward alone, that is the Chart
 * card's rule of 1.11, so its configs mean what they did. A value is a figure, an entity's reading (live: the card
 * watches it) or a template's answer, in the reading's unit, a reading of another unit of its family converted, as
 * every figure of a card's own is read (`own-values.ts`); one that cannot be read, or whose template is still to
 * answer, is left out, so a card never shows a colour it has no ground for. Fetched by the first card that names a
 * threshold (`Card.thresholds`), its first frame waiting for it: a card that names none never does.
 */

/** One threshold as a config writes it. */
export interface ThresholdItem {
  /** Where it starts: a figure, an entity whose reading it is, or a template whose answer it is, in the reading's unit. */
  value?: number | string;
  /** It colours under its value; else from it up. */
  below?: boolean;
  /** The tone of what it claims, or `none`: a reading it claims is drawn as one past no threshold. */
  tone?: Tone | 'none';
  /** A colour of the person's own, in its tone's place. */
  color?: string;
  /** What its band is called: said beside the reading, so colour is never all that says it. */
  label?: string;
  /** Its band's icon, in the reading's circle. */
  icon?: string;
}

/** What carries thresholds: a card's config, an item of its list. */
export interface ThresholdsConfig {
  thresholds?: readonly ThresholdItem[];
}

/** What a card hands its thresholds to read with: its colours, the house's entities, its templates' answers. */
export interface ThresholdHost extends OwnHost {
  readonly accents: {
    item(choice: unknown): string | undefined;
    ink(source: string): string;
  };
}

/** The band a reading is in, as the card draws it. */
export interface Band {
  readonly tone: Tone;
  /** The card's `data-accent` where its colour is the person's own (the accent inside it is that colour). */
  readonly accent?: string | undefined;
  /** Its figure's `data-ink` (`AccentSheet.ink`): its colour as a figure's words; none in the neutral. */
  readonly ink?: string | undefined;
  readonly label?: string | undefined;
  readonly icon?: string | undefined;
}

/** A config's thresholds as one card reads them now. */
export interface Thresholds {
  /** The band `reading` is in: none where it is past no threshold, or one in no colour, or cannot be read. */
  band(reading: number | null): Band | undefined;
  /** The stretches of the scale in their colours, from the lowest up, for a chart drawn in `unit`. */
  bands(): ThresholdBand[];
}

/** A threshold read: its value in the reading's unit. */
interface Read {
  readonly value: number;
  readonly below: boolean;
  readonly item: ThresholdItem;
}

/**
 * Whether a threshold says what it claims is drawn in: a tone (the information's too, which a Chart card's might name),
 * none, or a colour of its own.
 */
const says = (item: ThresholdItem): boolean =>
  typeof item.color === 'string' || item.tone === 'none' || toneOf(item) !== undefined;

/** A threshold's tone where it is one of the palette's (the information's too), else none: never a word of its own. */
const toneOf = (item: ThresholdItem): Tone | undefined =>
  item.tone === 'notice' || (TONES as readonly unknown[]).includes(item.tone)
    ? (item.tone as Tone)
    : undefined;

/**
 * The threshold that claims a reading: the highest upward one it reaches, the lowest downward one it is under, the
 * nearer of the two, the one above it on an even split (so every stretch runs from an edge up: `bands`).
 */
function claimOf(read: readonly Read[], reading: number): Read | undefined {
  let up: Read | undefined;
  let down: Read | undefined;
  for (const t of read)
    if (t.below) {
      if (reading < t.value && !(down && down.value < t.value)) down = t;
    } else if (reading >= t.value && !(up && up.value > t.value)) up = t;
  return up && down ? (reading - up.value < down.value - reading ? up : down) : (up ?? down);
}

/**
 * The thresholds `list` names, read for a reading in `unit` (a template asked with the card's or the row's entity, an
 * entity watched while it is read): every value is asked each time, so each template stays live.
 */
export function thresholdsOf(
  list: readonly unknown[],
  unit: string,
  host: ThresholdHost,
): Thresholds {
  const read = list.flatMap((entry): Read[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const item = entry as ThresholdItem;
    const value = readFigure(item.value, unit, host).value;
    return value === undefined || !says(item) ? [] : [{ value, below: item.below === true, item }];
  });
  /** The tone a threshold's band is drawn in, and the person's colour as its accent: none for `none`. */
  const look = ({ item }: Read): { tone: Tone; accent?: string | undefined } | undefined => {
    const accent = item.color ? host.accents.item(item.color) : undefined;
    if (accent) return { tone: 'accent', accent };
    // a colour that is none, beside a tone that is none of the palette's, says nothing: the band is left undrawn
    const tone = toneOf(item);
    return tone ? { tone } : undefined;
  };
  return {
    band: (reading) => {
      const claim = reading === null ? undefined : claimOf(read, reading);
      const drawn = claim && look(claim);
      if (!claim || !drawn) return undefined;
      const { label, icon } = claim.item;
      return {
        ...drawn,
        ink: drawn.tone === 'neutral' ? undefined : host.accents.ink(drawn.accent ?? drawn.tone),
        label: typeof label === 'string' && label.trim() ? label : undefined,
        icon: typeof icon === 'string' && icon ? icon : undefined,
      };
    },
    bands: () => {
      // where a reading's claim can change: at every value, and halfway between one upward and one downward above it
      const edges = [
        ...new Set([
          ...read.map((t) => t.value),
          ...read.flatMap((up) =>
            up.below
              ? []
              : read
                  .filter((t) => t.below && t.value > up.value)
                  .map((t) => (up.value + t.value) / 2),
          ),
        ]),
      ].sort((a, b) => a - b);
      const bands: Array<{ from: number | null; to: number | null; claim: Read | undefined }> = [];
      // under the lowest edge, then from each edge up to the next: one claim over each, the same claims as one
      for (const [k, from] of [null, ...edges].entries()) {
        const claim = claimOf(read, from ?? (edges[0] ?? 0) - 1);
        const last = bands.at(-1);
        if (last && last.claim === claim) last.to = edges[k] ?? null;
        else bands.push({ from, to: edges[k] ?? null, claim });
      }
      return bands.flatMap(({ from, to, claim }): ThresholdBand[] => {
        const drawn = claim && look(claim);
        return drawn
          ? [{ from, to, colour: drawn.tone, accent: drawn.accent, ...(unit ? { unit } : {}) }]
          : [];
      });
    },
  };
}
