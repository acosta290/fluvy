import type { Hex } from '../types.js';
import type { HaColorName } from './named.js';

/**
 * Home Assistant's own value for each of its colour names (`--red-color` … in its frontend's `color.globals.ts`, the
 * same in light and dark): what a bulb glows when asked for one, and what a card that wears its colours exactly draws
 * (`exact_colors`, 1.25, #250) — where the theme and every other card draw the palette's tone of the name
 * (`NAMED_COLORS`).
 */
export const HA_STANDARD_COLORS: Readonly<Record<HaColorName, Hex>> = {
  red: '#f44336',
  pink: '#e91e63',
  orange: '#ff9800',
  'deep-orange': '#ff6f22',
  amber: '#ffc107',
  yellow: '#ffeb3b',
  lime: '#cddc39',
  green: '#4caf50',
  'light-green': '#8bc34a',
  teal: '#009688',
  cyan: '#00bcd4',
  blue: '#2196f3',
  'light-blue': '#03a9f4',
  indigo: '#3f51b5',
  purple: '#926bc7',
  'deep-purple': '#6e41ab',
  brown: '#795548',
  'light-grey': '#bdbdbd',
  grey: '#9e9e9e',
  'dark-grey': '#606060',
  'blue-grey': '#607d8b',
  black: '#000000',
  white: '#ffffff',
};
