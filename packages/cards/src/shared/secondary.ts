import {
  formatNumber,
  isEntityId,
  isUsable,
  relativeTime,
  resolveEntity,
  stateText,
  type EntityView,
  type HomeAssistant,
} from '@fluvy/core';
import type { Secondary } from './config.js';
import { stateWord } from './domain.js';
import { changedAt } from './since.js';
import { asText, isTemplate, type TemplateTexts } from './templates.js';

/**
 * The line under a row's name, the same on every card that lists entities: the area when the row has one, else when
 * the entity last changed (the default); its state; nothing; an attribute by name; or a template, rendered live by
 * the card's `texts` (a blank line until Home Assistant answers, nothing without them, never the template itself).
 * A state that cannot be read is said as such whatever was asked (the row must never look fine), but for an unknown
 * one under a template: the person's own line reads it (a button never pressed is `unknown`, its normal state, #92).
 * `stateShown` is the row already showing the state elsewhere (a trailing value): `state` then says the area or the
 * time instead of repeating it. `short`: the line's shorter form, for a row too narrow for it — a time's ("32 d ago"),
 * a state's one word ("Not found"). `since`: where the row's last change is read from (#67), a timestamp sensor or
 * `attribute:<name>`; Home Assistant's own without it.
 */
export function secondaryText(
  hass: HomeAssistant | undefined,
  view: EntityView,
  secondary: Secondary | undefined,
  stateShown = false,
  texts?: TemplateTexts,
  short = false,
  since?: string,
): string {
  const mode = secondary ?? (view.areaName ? 'area' : 'last-changed');
  if (mode === 'none') return '';
  if (isTemplate(mode) && isUsable(view)) return texts?.line(mode, view.id) ?? '';
  if (view.status !== 'ok') return short ? stateWord(hass, view) : stateText(hass, view);
  if (mode === 'state')
    return stateShown ? fallback(hass, view, short, since) : stateText(hass, view);
  if (mode === 'area') return view.areaName || fallback(hass, view, short, since);
  if (mode === 'last-changed') return changed(hass, view, short, since);
  return attribute(hass, view, mode);
}

/** The area, or the time: what a row says when what was asked has nothing to say. */
const fallback = (
  hass: HomeAssistant | undefined,
  view: EntityView,
  short: boolean,
  since: string | undefined,
): string => view.areaName || changed(hass, view, short, since);

const changed = (
  hass: HomeAssistant | undefined,
  view: EntityView,
  short: boolean,
  since: string | undefined,
): string => {
  const at = changedAt(hass, view, since);
  return at ? relativeTime(hass, at, new Date(), short) : '';
};

/** An attribute as Home Assistant would write it (its unit, its translation), or as it is. */
function attribute(hass: HomeAssistant | undefined, view: EntityView, name: string): string {
  const value = view.attr<unknown>(name);
  if (value === undefined || value === null || value === '') return '';
  if (hass?.formatEntityAttributeValue && view.stateObj) {
    try {
      const text = hass.formatEntityAttributeValue(view.stateObj, name, value);
      if (typeof text === 'string' && text !== '') return text;
    } catch {
      /* the raw value below */
    }
  }
  return asText(value);
}

/** From five figures a whole count has short words for its size ("10K"): under them they save nothing. */
const SHORT_FROM = 10_000;

/**
 * A reading's shorter forms, longest first, for a line too narrow for it whole (#93): a large whole count in the
 * house's short words for its size, with its unit and then without ("5.1M queries", "5.1M"), else the figure without
 * its unit ("12,345.67"); a moment as long ago as it was ("12 days ago", "12 d ago"). `text` is the reading as Home
 * Assistant writes it. A figure keeps the decimals the person asked for (its display precision): never in short words.
 */
export function shorterForms(
  hass: HomeAssistant | undefined,
  view: EntityView,
  text: string,
): string[] {
  if (view.status !== 'ok') return [];
  if (view.deviceClass === 'timestamp') {
    const at = new Date(view.state);
    if (!Number.isFinite(at.getTime())) return [];
    return [...new Set([relativeTime(hass, at), relativeTime(hass, at, new Date(), true)])];
  }
  const n = view.number;
  if (n === null) return [];
  const unit = view.unit;
  // the figure as it is written, and what stands between it and its unit (a space, or none before "%")
  const bare = unit && text.endsWith(unit) ? text.slice(0, -unit.length).trimEnd() : '';
  const gap = bare ? text.slice(bare.length, -unit.length) : ' ';
  const precision = hass?.entities?.[view.id]?.display_precision;
  const whole = typeof precision === 'number' ? precision === 0 : Number.isInteger(n);
  if (!whole || Math.abs(n) < SHORT_FROM) return bare ? [bare] : [];
  const short = formatNumber(hass, n, { compact: true });
  return unit ? [`${short}${gap}${unit}`, short] : [short];
}

/** A card's own text as it shows: its words, and the shorter forms a value has for a column too narrow for it. */
export interface OwnLine {
  readonly text: string;
  /** A value's shorter forms, then none: a value is never cut. A person's words have none: they may end in an ellipsis. */
  readonly shorter: readonly string[];
}

/**
 * A card's own text that may be live (Discussion #156: a head's subtitle, its badge): a template, rendered by the
 * card's `texts` with `entity` as its entity and kept live — a blank line until Home Assistant answers where `held`,
 * else nothing, never the template itself; an entity the house has, as Home Assistant says its state (with its unit,
 * a moment as its date and time), "—" while it cannot be read; any other words as written, a word that only looks like
 * an entity's id among them. Undefined where the config says none: the card's own text stands.
 */
export function ownLine(
  hass: HomeAssistant | undefined,
  own: unknown,
  texts: TemplateTexts | undefined,
  entity?: string,
  held = true,
): OwnLine | undefined {
  if (own === undefined || own === null) return undefined;
  // YAML may write a figure where words were meant (`subtitle: 7`): they are its words
  const text = String(own);
  if (isTemplate(text))
    return {
      text: (held ? texts?.line(text, entity) : texts?.text(text, entity)) ?? '',
      shorter: [],
    };
  if (!isEntityId(text) || !hass?.states[text]) return { text, shorter: [] };
  const view = resolveEntity(hass, text);
  if (view.status !== 'ok') return { text: '—', shorter: [] };
  const said = stateText(hass, view);
  return { text: said, shorter: [...shorterForms(hass, view, said), ''] };
}
