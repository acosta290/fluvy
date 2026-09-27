import type { HomeAssistant } from '../ha/types.js';

/**
 * Card-local strings. Words several cards share live in `en.ts` / `es.ts`; a card's own labels live
 * next to the card, in a table with the same keys in every language (English is the fallback).
 *
 *   const s = createStrings({ en: { remaining: 'Remaining' }, es: { remaining: 'Restante' } });
 *   s(this.hass, 'remaining')
 */
export function createStrings<K extends string>(
  tables: { en: Record<K, string> } & Partial<Record<string, Record<K, string>>>,
) {
  return (
    hass: Pick<HomeAssistant, 'language'> | undefined,
    key: K,
    values?: Record<string, string | number>,
  ): string => {
    const language = (hass?.language ?? 'en').split('-')[0] ?? 'en';
    const template = tables[language]?.[key] ?? tables.en[key];
    if (!values) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match,
    );
  };
}
