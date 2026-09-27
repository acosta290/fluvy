/** 4px base grid, mirroring HA's own `--ha-space-N` = N × 4px so the two can be bridged 1:1. */
export const SPACING_BASE_PX = 4;

export const SPACING_STEPS = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20] as const;
export type SpacingStep = (typeof SPACING_STEPS)[number];

export const spacing: Readonly<Record<SpacingStep, string>> = Object.fromEntries(
  SPACING_STEPS.map((step) => [step, `${step * SPACING_BASE_PX}px`]),
) as Readonly<Record<SpacingStep, string>>;

/**
 * Two density presets. Comfortable is the default dashboard rhythm; compact is for
 * dense tile grids and phone widths.
 */
export const density = {
  comfortable: { padding: '16px', gap: '12px' },
  compact: { padding: '12px', gap: '8px' },
} as const;

export type DensityName = keyof typeof density;
