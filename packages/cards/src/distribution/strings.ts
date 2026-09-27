import { createStrings } from '@fluvy/core';

/** The distribution card's own words; "Drawing now" comes from the shared strings. */
export const strings = createStrings({
  en: {
    distribution: 'Distribution',
    other: 'Other',
    max_rows: 'Rows before the rest becomes "Other"',
  },
  es: {
    distribution: 'Distribución',
    other: 'Otros',
    max_rows: 'Filas antes de agrupar el resto en «Otros»',
  },
});
