/**
 * Motion. Everything stays under 320ms: a dashboard is a status surface, not a demo.
 *
 * Caveat carried into phase 2: overriding HA's `--ha-animation-duration-*` from a theme
 * writes inline styles on `<html>` and therefore beats HA's own
 * `prefers-reduced-motion` rule. Whoever wires these into the theme has to restore that
 * collapse from a Lovelace CSS resource.
 */
export const duration = {
  instant: '120ms',
  fast: '180ms',
  normal: '240ms',
  slow: '320ms',
} as const;

export const easing = {
  /** Default for anything that both enters and leaves. */
  standard: 'cubic-bezier(.2, 0, 0, 1)',
  /** Entering the screen: fast start, soft landing. */
  decelerate: 'cubic-bezier(0, 0, 0, 1)',
  /** Leaving the screen: soft start, quick exit. */
  accelerate: 'cubic-bezier(.3, 0, 1, 1)',
} as const;

export type DurationName = keyof typeof duration;
export type EasingName = keyof typeof easing;
