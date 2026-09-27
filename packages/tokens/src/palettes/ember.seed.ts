import type { PaletteSeed } from '../types.js';

/**
 * The one dark-first seed: its light mode is derived, which is what proves the
 * derivation runs in both directions rather than inverting channels.
 */
export const ember: PaletteSeed = {
  name: 'ember',
  title: 'Ember',
  description: 'Dark-first: banked-fire warmth, amber on near-black charcoal.',
  baseMode: 'dark',
  page: '#121009',
  card: '#1e1b16',
  accentInk: '#e0b183',
  accentFill: '#3a2e1f',
  accentOnFill: '#f5e4ce',
};
