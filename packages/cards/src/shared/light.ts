import { resolveEntity, WHITE, type EntityView, type HomeAssistant } from '@fluvy/core';
import type { Tone } from '@fluvy/ui';
import type { Coloured } from './colour.js';

/** Home Assistant's colour modes that carry a colour of their own (a white or a dimmed lamp does not). */
export const COLOURED: ReadonlySet<string> = new Set(['hs', 'rgb', 'rgbw', 'rgbww', 'xy']);

/** The colour modes under which a light dims: every mode but `onoff`. */
export const DIMMABLE: ReadonlySet<string> = new Set([
  'brightness',
  'color_temp',
  'hs',
  'xy',
  'rgb',
  'rgbw',
  'rgbww',
  'white',
]);

/**
 * Whether a bulb dims, by the modes it reports; a light Home Assistant has not described (gone, or unavailable since
 * it started) draws as a dimmer.
 */
export const dims = (modes: readonly string[]): boolean =>
  !modes.length || modes.some((mode) => DIMMABLE.has(mode));

/** `[r, g, b]` as `#rrggbb`: each channel rounded and kept to 0–255, any further channel (white, warm white) left out. */
export const hexOf = (rgb: readonly number[]): string =>
  `#${rgb
    .slice(0, 3)
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/**
 * How a lit white shows its colour: by its temperature (the default since 1.10, #58), or as the palette's lit light
 * (`palette`).
 */
export type LightWhites = 'palette' | 'temperature';

/**
 * The colour a lit bulb glows: its `rgb_color` while it is on in a colour mode (`#rrggbb`), and in its white Home
 * Assistant's colour for its temperature, marked to be drawn on the whites' scale (`WHITE`: candle to warm to
 * neutral to cool, by its warmth) unless the card asks for the palette's (`light_whites: palette`); a light that only
 * dims, one that only switches and an off one have none.
 */
export function bulbHex(view: EntityView, on: boolean, whites?: LightWhites): string | undefined {
  const rgb = view.attr<number[] | null>('rgb_color');
  if (!on || !Array.isArray(rgb) || rgb.length < 3) return undefined;
  const mode = view.attr<string | null>('color_mode') ?? '';
  if (COLOURED.has(mode)) return hexOf(rgb);
  return whites !== 'palette' && mode === 'color_temp' ? WHITE + hexOf(rgb) : undefined;
}

/**
 * The colour of lights glowing together (a group's members, a room's lights): each lit one's (`bulbHex`) weighted by
 * its brightness — a white by its temperature, or nothing where the palette shows whites, so one red bulb among them
 * glows red where Home Assistant's own mean would wash it out; whites alone, a white; none: no member glows a colour.
 */
export function meanHex(lights: readonly EntityView[], whites?: LightWhites): string | undefined {
  let [r, g, b, weight, white] = [0, 0, 0, 0, true];
  for (const light of lights) {
    const hex = bulbHex(light, light.state === 'on', whites);
    if (!hex) continue;
    const share = light.attr<number>('brightness') || 255;
    const n = Number.parseInt(hex.slice(-6), 16);
    r += ((n >> 16) & 255) * share;
    g += ((n >> 8) & 255) * share;
    b += (n & 255) * share;
    weight += share;
    white &&= hex.startsWith(WHITE);
  }
  return weight ? (white ? WHITE : '') + hexOf([r / weight, g / weight, b / weight]) : undefined;
}

/** A light group's members (`entity_id`); none for a single light. */
export function memberIds(view: EntityView): string[] {
  const ids = view.attr<unknown>('entity_id');
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

/** What a card of lights watches: each light, and a group's members (its colour is theirs). */
export const withMembers = (ids: readonly string[], hass: HomeAssistant | undefined): string[] =>
  ids.flatMap((id) => [id, ...memberIds(resolveEntity(hass, id))]);

/**
 * The lamps of some lights, each once: a group as its members, so a group listed beside its members (a room's lights)
 * counts them once in their mean (`meanHex`).
 */
export const lampsOf = (ids: readonly string[], hass: HomeAssistant | undefined): string[] => [
  ...new Set(
    ids.flatMap((id) => {
      const members = memberIds(resolveEntity(hass, id));
      return members.length ? members : [id];
    }),
  ),
];

/**
 * The colour each light last glowed on this page, as each way of showing whites drew it: what one switched on shows
 * before Home Assistant says (two cards of one lamp, one with the palette's whites, never borrow each other's).
 */
const glowed = new Map<string, string>();

/**
 * The colour a light drawn lit glows: what Home Assistant says it glows (`bulbHex`; a group, its members' `meanHex`,
 * as the house has them), kept — or, while it is drawn on before Home Assistant has said so (the switch flipped), the
 * one it last glowed with these whites, so it never flashes the palette's light first.
 */
export function litColour(
  view: EntityView,
  on: boolean,
  whites: LightWhites | undefined,
  hass: HomeAssistant | undefined,
): string | undefined {
  if (!on) return undefined;
  const key = `${whites ?? 'temperature'} ${view.id}`;
  if (view.state !== 'on') return glowed.get(key);
  const members = memberIds(view).map((id) => resolveEntity(hass, id));
  const hex = members.length ? meanHex(members, whites) : bulbHex(view, true, whites);
  if (hex) glowed.set(key, hex);
  else glowed.delete(key);
  return hex;
}

/**
 * What a light drawn on a card of several wears, by one rule on every card (#58): its own colour, else its own tone,
 * else its bulb's (`glow`, where the card shows bulbs' colours), else the card's colour, else the card's tone, else the
 * palette's lit light: the colour for its `data-accent` (none: its tone draws it) and its tone. A bulb's colour and
 * the card's are drawn in the lit light, which a colour's family redefines (the card's reaches it as the card's
 * accent), an item's own in the accent, as every item's colour is.
 */
export function lightLook(
  item: Coloured,
  card: Coloured | undefined,
  glow: string | undefined,
): readonly [colour: unknown, tone: Tone] {
  const colour = item.color || (item.tone ? undefined : glow);
  return [
    colour,
    item.tone ?? (item.color ? 'accent' : (!colour && !card?.color && card?.tone) || 'light'),
  ];
}
