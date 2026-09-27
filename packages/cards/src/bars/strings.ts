import { createStrings } from '@fluvy/core';

/** The bar list's own words: the fallback title and the editor fields. The badge wording comes from the config or the shared strings. */
export const strings = createStrings({
  en: {
    levels: 'Levels',
    rows: 'Entities',
    badge_ok: 'Badge when all is well',
    badge_warn: 'Badge with warnings, e.g. "{count} low"',
  },
  es: {
    levels: 'Niveles',
    rows: 'Entidades',
    badge_ok: 'Insignia cuando todo va bien',
    badge_warn: 'Insignia con avisos, p. ej. «{count} bajas»',
  },
});
