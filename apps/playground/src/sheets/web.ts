import { FluvyWebCard } from '../../../../packages/cards/src/web/web-card.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the template sheet does
if (!customElements.get('fluvy-web-card')) customElements.define('fluvy-web-card', FluvyWebCard);

const WEB = 'custom:fluvy-web-card';
/** Two pages of the playground's own origin: their `load` reaches the card, so the plate draws. */
const PAGE = '/web/page.html';
const DARK = '/web/page-dark.html';

/**
 * The web page card (#61): a page on a plate under a head, in a frame or bare; its shape, its height, its scale,
 * its looks, its sandbox levels and its reload, at a full card, a half card and a wide band.
 */
export const sheet: SheetSpec = {
  states: [],
  frames: [
    {
      title: 'Plate · 16:9',
      cards: [{ type: WEB, url: PAGE, title: 'Lightning', subtitle: 'Europe' }],
    },
    { title: 'Frame', cards: [{ type: WEB, url: PAGE, variant: 'frame' }] },
    { title: 'Bare', cards: [{ type: WEB, url: PAGE, variant: 'bare' }] },
    // a dense page drawn smaller shows more of itself
    {
      title: '4:3 at 0.75',
      cards: [{ type: WEB, url: PAGE, aspect_ratio: '4:3', scale: 0.75, show_reload: true }],
    },
    // the dark look inverts a light page; a dark page under the page's own look stays dark
    {
      title: 'Dark',
      cards: [
        { type: WEB, url: PAGE, look: 'dark', title: 'Inverted', cols: 6 },
        { type: WEB, url: DARK, title: 'Dark already', cols: 6 },
      ],
    },
    { title: 'Auto', cards: [{ type: WEB, url: PAGE, look: 'auto', title: 'Follows the card' }] },
    {
      title: 'Strict',
      cards: [{ type: WEB, url: PAGE, sandbox: 'strict', title: 'Strict sandbox' }],
    },
    {
      title: 'Refresh 1',
      cards: [{ type: WEB, url: PAGE, refresh: 1, show_reload: true, title: 'Every minute' }],
    },
    // a height written wins over the shape; the head's words give way before they are cut
    {
      title: 'Height 120',
      cards: [
        {
          type: WEB,
          url: PAGE,
          height: 120,
          title: 'A low plate',
          subtitle: 'Its rounds still in',
        },
      ],
    },
    // two halves of a section: a plate 152 wide holds one round, 172 two
    {
      title: 'Half pairs',
      cards: [
        { type: WEB, url: PAGE, title: 'Lightning', show_reload: true, cols: 6 },
        { type: WEB, url: DARK, variant: 'frame', show_reload: true, cols: 6 },
      ],
    },
    {
      title: 'Half pairs · bare',
      cards: [
        { type: WEB, url: PAGE, variant: 'bare', show_reload: true, cols: 6 },
        { type: WEB, url: DARK, variant: 'bare', look: 'dark', cols: 6 },
      ],
    },
    // a wide band at 21:9: a map across a desktop
    {
      title: 'Band · 21:9',
      width: 1400,
      cards: [
        { type: WEB, url: PAGE, aspect_ratio: '21:9', title: 'Across the band', show_reload: true },
      ],
    },
    // Home Assistant's own iframe card as it is pasted
    {
      title: 'Pasted',
      cards: [
        {
          type: WEB,
          url: PAGE,
          aspect_ratio: '50%',
          title: 'Was type: iframe',
          hide_background: true,
        },
      ],
    },
  ],
};
