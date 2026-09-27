import type { HomeAssistant } from '../ha/types.js';
import { en, type MessageKey } from './en.js';
import { es } from './es.js';

export type { MessageKey } from './en.js';

const LOCALES: Record<string, Record<MessageKey, string>> = { en, es };

let override: string | undefined;

/** A person's choice of language for fluvy's own strings (fluvy's settings); undefined: Home Assistant's. */
export function setLanguageOverride(language: string | undefined): void {
  override = language;
}

/** The language fluvy's strings are in: the person's choice, else Home Assistant's. */
export function languageOverride(): string | undefined {
  return override;
}

/** fluvy's own strings. Entity states and attribute values come translated from Home Assistant itself. */
export function localize(
  hass: Pick<HomeAssistant, 'language'> | undefined,
  key: MessageKey,
  values?: Record<string, string | number>,
): string {
  const language = (override ?? hass?.language ?? 'en').split('-')[0] ?? 'en';
  const template = LOCALES[language]?.[key] ?? en[key];
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export const locales = LOCALES;
