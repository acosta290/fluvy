import type { CustomPalette } from '@fluvy/tokens/runtime';
import type { FrameSpec, SheetSpec } from '../scenes.js';
import { BLUE, dozen, sheet as glass } from './glass.js';

/**
 * A page read by its edges (1.19, #154): the E-ink palette's surface, `surface: line` — the page and the cards one
 * colour, each card closed by its edge, nothing casting a shadow — and `ink`, its edge in the text's ink, each frame
 * in that palette whatever the page wears, in either mode. The see-through cards' dozen, as a dashboard holds them: a
 * card and a tile, on, off and out of reach (its dashes on the same edge), what the page's fill draws inside a card (a
 * stepper, chips, a room's tiles, a track), a card of its own colour and a lit one; then what stands on the page
 * itself, the cards see-through on a view's background, and a card quiet out of reach.
 */

/** The E-ink palette (`palettes/community/e-ink.fluvy-palette.json`), and the same in ink. */
const LINE: CustomPalette = {
  character: 'soft',
  base: 'neutral',
  accent: '#1f1f1f',
  surface: 'line',
};
const INK: CustomPalette = { ...LINE, surface: 'ink' };

/** The dozen in a palette of the frame's own: on the page, or see-through on a view's background. */
const worn = (title: string, palette: CustomPalette, opacity = 100, backdrop = ''): FrameSpec => ({
  ...dozen(title, backdrop, opacity),
  palette,
});

export const sheet: SheetSpec = {
  ...glass,
  frames: [
    worn('Line · a dozen cards', LINE),
    worn('Ink · a dozen cards', INK),
    // what stands on the page's ground with no card under it: a heading, the dashboard's tabs, a scene
    {
      title: 'Line · on the page itself',
      palette: LINE,
      cards: [
        { type: 'custom:fluvy-heading-card', title: 'Living room' },
        {
          type: 'custom:fluvy-chips-card',
          chips: [
            { name: 'Home', path: '/fluvy-auto/home' },
            { name: 'Living room', path: '/fluvy-auto/living' },
            { name: 'Energy', path: '/energy' },
          ],
        },
        { type: 'custom:fluvy-tile-card', entity: 'light.ceiling', cols: 6 },
        { type: 'custom:fluvy-tile-card', entity: 'light.reading', cols: 6 },
        { type: 'custom:fluvy-tile-card', entity: 'light.co_gone', cols: 6 },
        { type: 'custom:fluvy-tile-card', entity: 'switch.desk_plug', cols: 6 },
      ],
    },
    worn('Line · see-through at 50, on a view’s background', LINE, 50, BLUE),
    // quiet out of reach: the card's own surface and its edge, no dashes
    {
      title: 'Line · out of reach, dashed and quiet',
      palette: LINE,
      cards: [
        { type: 'custom:fluvy-light-card', entity: 'light.co_gone' },
        { type: 'custom:fluvy-light-card', entity: 'light.co_gone', unavailable: 'quiet' },
        { type: 'custom:fluvy-tile-card', entity: 'light.co_gone', cols: 6 },
        { type: 'custom:fluvy-tile-card', entity: 'light.co_gone', unavailable: 'quiet', cols: 6 },
      ],
    },
  ],
};
