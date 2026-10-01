import type { SheetSpec } from '../scenes.js';
import './balance.js'; // the cards

/**
 * The balance and the grid in a house that never set up the Energy dashboard, with nothing configured: each says
 * what it needs instead of drawing a guess.
 */
export const sheet: SheetSpec = {
  states: [],
  frames: [
    {
      title: 'Balance · nothing configured',
      cards: [{ type: 'custom:fluvy-energy-balance-card' }],
    },
    {
      title: 'Balance · a period, no Energy dashboard',
      cards: [{ type: 'custom:fluvy-energy-balance-card', period: 'day' }],
    },
    {
      title: 'Grid · nothing configured',
      cards: [{ type: 'custom:fluvy-grid-card' }],
    },
    {
      title: 'Half a column',
      cards: [
        { type: 'custom:fluvy-energy-balance-card', cols: 6 },
        { type: 'custom:fluvy-grid-card', cols: 6 },
      ],
    },
  ],
};
