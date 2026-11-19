import { strings, type HomeAssistant } from '@fluvy/core';
import type { GlyphName, Tone } from '@fluvy/ui';
import type { Preset } from './automation.js';

/**
 * A preset as the card draws it (#229): its name, its glyph and its tone — the card's own for it where its config says
 * one (`presets`), else Fluvy's for Home Assistant's seven climate presets (Comfort, Eco, Away, Home, Sleep, Boost,
 * Activity: in the viewer's language, whatever language wrote them), else the person's own name for it, a glyph and a
 * tone of the presets' turn.
 */

const s = strings('schedule');

/** The presets Home Assistant names for a climate (`PRESET_*`), which Fluvy names in every language. */
export const STANDARD = ['comfort', 'eco', 'away', 'home', 'sleep', 'boost', 'activity'] as const;
export type Standard = (typeof STANDARD)[number];

export const isStandard = (key: string): key is Standard =>
  (STANDARD as readonly string[]).includes(key);

const GLYPH: Readonly<Record<Standard, GlyphName>> = {
  comfort: 'home',
  eco: 'leaf',
  away: 'away',
  home: 'home',
  sleep: 'moon',
  boost: 'bolt',
  activity: 'person',
};

const TONE: Readonly<Record<Standard, Tone>> = {
  comfort: 'heat',
  eco: 'ok',
  away: 'cool',
  home: 'house',
  sleep: 'media',
  boost: 'solar',
  activity: 'dry',
};

/** The tones a preset of the person's own takes, in turn. */
const OWN_TONES: readonly Tone[] = ['accent', 'water', 'presence', 'gas', 'grid', 'battery'];

/** What a card's config may say of one preset (`presets`): its key, and its name, icon, tone and colour on the card. */
export interface PresetConfig {
  readonly preset: string;
  readonly name?: string;
  readonly icon?: string;
  readonly tone?: Tone;
  readonly color?: string;
}

/** A preset as the card draws it. */
export interface PresetLook {
  readonly key: string;
  readonly name: string;
  /** Fluvy's glyph, or the card's own icon (`mdi:…`). */
  readonly icon: string;
  readonly tone: Tone;
  /** The card's own colour for it, where it gave one. */
  readonly color?: string;
}

/** Fluvy's word for one of Home Assistant's presets, in the viewer's language. */
export const standardWord = (
  hass: Pick<HomeAssistant, 'language'> | undefined,
  key: Standard,
): string => s(hass, `preset.${key}`);

/**
 * How a preset is drawn: the card's config for it first, then Fluvy's for a preset Home Assistant names, then the
 * person's own name (the automation's) with the next tone of the turn (`index`: its place among the person's own).
 */
export function presetLook(
  hass: Pick<HomeAssistant, 'language'> | undefined,
  own: readonly PresetConfig[] | undefined,
  preset: Pick<Preset, 'key'> & { readonly name?: string },
  index: number,
): PresetLook {
  const asked = own?.find((entry) => entry?.preset === preset.key);
  const standard = isStandard(preset.key) ? preset.key : undefined;
  const name =
    asked?.name?.trim() || (standard ? standardWord(hass, standard) : preset.name || preset.key);
  return {
    key: preset.key,
    name,
    icon: asked?.icon || (standard ? GLYPH[standard] : 'thermo'),
    tone:
      asked?.tone ?? (standard ? TONE[standard] : (OWN_TONES[index % OWN_TONES.length] as Tone)),
    ...(asked?.color ? { color: asked.color } : {}),
  };
}

/**
 * Every preset's look, in the plan's order: the person's own presets each take the next tone of the turn, so two of
 * them never share one by their place in the list.
 */
export function presetLooks(
  hass: Pick<HomeAssistant, 'language'> | undefined,
  own: readonly PresetConfig[] | undefined,
  presets: readonly (Pick<Preset, 'key'> & { readonly name?: string })[],
): PresetLook[] {
  let others = 0;
  return presets.map((preset) =>
    presetLook(hass, own, preset, isStandard(preset.key) ? 0 : others++),
  );
}
