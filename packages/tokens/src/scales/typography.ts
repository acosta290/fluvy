/**
 * Typography. No webfont is loaded in phase 1 — a theme cannot carry `@font-face`,
 * so the system stack is the honest default until the Lovelace CSS resource lands.
 */
export const fontFamily = {
  sans: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
} as const;

/** px steps 10 → 40, same ladder as `--ha-font-size-xs…5xl`. */
export const fontSize = {
  xs: '10px',
  s: '12px',
  m: '14px',
  l: '16px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '28px',
  '4xl': '32px',
  '5xl': '40px',
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  condensed: '1.2',
  normal: '1.5',
  expanded: '1.7',
} as const;

/**
 * Applied to every numeric readout. Values that change every few seconds must not
 * reflow their neighbours, so digits are fixed width.
 */
export const numericVariant = 'tabular-nums';

export type FontSizeName = keyof typeof fontSize;
export type FontWeightName = keyof typeof fontWeight;
export type LineHeightName = keyof typeof lineHeight;
