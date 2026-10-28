import { FluvyWebCard } from '../../../../packages/cards/src/web/web-card.js';
import type { SheetSpec } from '../scenes.js';

// its chunk lands after the page has drawn: the sheet defines the card from its module, as the template sheet does
if (!customElements.get('fluvy-web-card')) customElements.define('fluvy-web-card', FluvyWebCard);

const WEB = 'custom:fluvy-web-card';
/**
 * Two pages served beside the page (the playground's, the demo's under its base): their `load` reaches the card, so
 * the plate draws.
 */
const PAGE = `${import.meta.env.BASE_URL}web/page.html`;
const DARK = `${import.meta.env.BASE_URL}web/page-dark.html`;
/** A map site, served beside them: what a plate looks like holding one (the README's picture). */
const MAP = `${import.meta.env.BASE_URL}web/radar.html`;
/** An http page, kept back on a dashboard read as served over https (`_https`: the playground is not). */
const PLAIN = { type: WEB, url: 'http://grafana.local:3000/d/house', _https: true };
/** A page that never answers (`_slow`): the plate says it is still loading at once, not after twenty seconds. */
const NEVER = { type: WEB, url: PAGE, _slow: true };

/**
 * The web page card (#61): a page on a plate under a head, in a frame or bare; its shape, its height, its scale,
 * its looks, its sandbox levels and its reload, at a full card, a half card and a wide band; an http page kept back
 * and a page still loading, their words clear of the rounds wherever the plate holds them.
 */
export const sheet: SheetSpec = {
  states: [],
  frames: [
    {
      title: 'Plate · 16:9',
      cards: [{ type: WEB, url: PAGE, title: 'Lightning', subtitle: 'Europe' }],
    },
    {
      title: 'Plate · a map',
      cards: [{ type: WEB, url: MAP, title: 'Lightning', subtitle: 'Live strikes' }],
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
    // an http page on an https dashboard: the off plate's globe over its words above the rounds, their short form,
    // the words alone, or beside the rounds on a plate wide and low — never under them
    {
      title: 'Insecure',
      cards: [
        { ...PLAIN, title: 'Grafana', show_reload: true },
        { ...PLAIN, variant: 'frame' },
        { ...PLAIN, variant: 'bare' },
        { ...PLAIN, height: 68, title: 'A low plate' },
      ],
    },
    {
      title: 'Insecure · half pairs',
      cards: [
        { ...PLAIN, title: 'Grafana', cols: 6 },
        { ...PLAIN, variant: 'frame', show_reload: true, cols: 6 },
      ],
    },
    {
      title: 'Insecure · half pairs · bare',
      cards: [
        { ...PLAIN, variant: 'bare', show_reload: true, cols: 6 },
        { ...PLAIN, variant: 'bare', cols: 6 },
      ],
    },
    // still loading: the words over the skeleton with the tab on their line where it holds, else alone
    {
      title: 'Slow',
      cards: [
        { ...NEVER, title: 'Lightning', show_reload: true },
        { ...NEVER, variant: 'frame' },
        { ...NEVER, variant: 'bare' },
        { ...NEVER, height: 68, title: 'A low plate' },
      ],
    },
    {
      title: 'Slow · half pairs',
      cards: [
        { ...NEVER, title: 'Lightning', cols: 6 },
        { ...NEVER, variant: 'frame', show_reload: true, cols: 6 },
      ],
    },
    {
      title: 'Slow · half pairs · bare',
      cards: [
        { ...NEVER, variant: 'bare', show_reload: true, cols: 6 },
        { ...NEVER, variant: 'bare', cols: 6 },
      ],
    },
  ],
};
