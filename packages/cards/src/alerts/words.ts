import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { isTemplate, type TemplateTexts } from '../shared/templates.js';
import type { AlertResult } from './engine.js';

/*
 * What an alert says of each entity it matches (#184): its `name`, its `secondary` (the entity's message) and its
 * `icon`, each written as `attribute:<name>` — the attribute's value — or as a template Home Assistant renders for the
 * entity (`{{ state_attr(entity, 'title') }}`: `entity` its id, `user` the person's name). A split alert's tile says
 * its entity's; every alert's rows say theirs, in its sheet and on its line. Templates are rendered for an alert's first
 * `TEMPLATE_ROWS` entities in its order (one subscription each, let go of as an entity leaves); an attribute is read for
 * every one.
 */

/** The words an alert reads off each of its entities, as its config writes them; none where it says none. */
export interface EntityWords {
  readonly name?: string;
  readonly secondary?: string;
  readonly icon?: string;
}

export type WordKey = keyof EntityWords;

const KEYS: readonly WordKey[] = ['name', 'secondary', 'icon'];
const ATTRIBUTE = 'attribute:';

/** The most entities of one alert its templates are rendered for: a list of hundreds would hold as many subscriptions. */
export const TEMPLATE_ROWS = 50;

/** The attribute a word names (`attribute:title` is `title`); undefined for any other word. */
export const attributeOf = (word: unknown): string | undefined =>
  typeof word === 'string' && word.startsWith(ATTRIBUTE)
    ? word.slice(ATTRIBUTE.length).trim()
    : undefined;

/** Whether a word is read off each entity (an attribute's, a template's) rather than said as written. */
export const fromEntity = (word: unknown): word is string =>
  attributeOf(word) !== undefined || isTemplate(word);

/** An attribute's value as words; undefined where it says none (nothing, empty, a list or a map: no words). */
export function attributeText(state: HassEntity | undefined, name: string): string | undefined {
  const value: unknown = state?.attributes[name];
  return (typeof value !== 'object' && String(value ?? '').trim()) || undefined;
}

/**
 * What one render of a card says of its alerts' entities. Made during the card's render: every template it will be
 * asked for is asked of the card's `texts` there and then — what keeps it subscribed, and lets go of an entity that
 * left — and its answer kept, so the sheet reads the same words without asking. A template Home Assistant has not
 * answered yet is a blank (`PENDING_LINE`); one that answered nothing, or past the first `TEMPLATE_ROWS` entities, says
 * nothing: the row's own words stand.
 */
export class CulpritWords {
  private readonly rendered = new Map<string, string>();

  constructor(
    private readonly hass: HomeAssistant | undefined,
    texts: TemplateTexts | undefined,
    alerts: readonly AlertResult[],
  ) {
    if (texts)
      for (const result of alerts) {
        const words = result.definition.words;
        if (!words) continue;
        for (const key of KEYS) {
          const word = words[key];
          if (isTemplate(word))
            for (const row of result.rows.slice(0, TEMPLATE_ROWS))
              if (row.state) this.rendered.set(`${row.id}\n${word}`, texts.line(word, row.id));
        }
      }
  }

  /** What an alert says of one of its entities as `key`: its attribute's value, its template's answer, its words. */
  of(result: AlertResult, id: string, key: WordKey): string | undefined {
    const word = result.definition.words?.[key];
    if (word === undefined) return undefined;
    const attribute = attributeOf(word);
    if (attribute !== undefined) return attributeText(this.hass?.states[id], attribute);
    if (!isTemplate(word)) return word;
    return this.rendered.get(`${id}\n${word}`) || undefined;
  }
}
