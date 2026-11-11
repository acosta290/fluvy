import { parseBackground, type LovelaceCardConfig, type PageBackground } from '@fluvy/core';
import type { FrameSpec, SheetSpec } from '../scenes.js';
import { sheet as extras } from './home-extras.js';
import { sheet as home } from './home.js';
import { sheet as sliders } from './slider-styles.js';

/*
 * A page background (1.19, Discussion #155), the design page's frames on real cards: a phone's view — the greeting, two
 * tiles, a light card — on each kind, solid and see-through (70 %): plain, the palette's gradient, a pale colour, a
 * deep one and a gradient of two (the greeting and a heading take the light ink on it), and a picture undimmed, at its
 * 40 % default, blurred, and under solid cards; an address the check refuses draws plain. Light and dark are the page's
 * (`&mode=dark`): a pale colour is taken to the dark page, a deep one stays. The layer itself, held still under a
 * dashboard's header while the page scrolls, is the dashboard frame's (`?dashboard=background&page=image`).
 */

/** The greeting is frozen on the sheet's evening (the `_now` test hook), so every render says the same thing. */
const EVENING = '2026-09-17T21:47:12';
/** The design's picture: dunes under an evening sky, drawn (the playground serves it as a path). */
export const DUNES = '/backgrounds/dunes.svg';

/** A phone's view, as the design draws it; `opacity` makes every card see-through. */
const view = (opacity?: number): Array<LovelaceCardConfig & { cols?: number }> => {
  const own = opacity === undefined ? {} : { card_opacity: opacity };
  return [
    { type: 'custom:fluvy-hello-card', _now: EVENING, name: 'Marta', person: 'person.marta' },
    { type: 'custom:fluvy-tile-card', entity: 'light.ceiling', cols: 6, ...own },
    { type: 'custom:fluvy-tile-card', entity: 'light.reading', cols: 6, ...own },
    { type: 'custom:fluvy-light-card', entity: 'light.ss_kitchen', variant: 'compact', ...own },
  ];
};

const on = (background: Partial<PageBackground>): PageBackground => parseBackground(background);
const frame = (title: string, background?: PageBackground, opacity?: number): FrameSpec => ({
  title,
  width: 360,
  cards: view(opacity),
  ...(background ? { background } : {}),
});

const GRADIENT = on({ type: 'gradient' });
const SAGE = on({ type: 'color', colors: ['#dbe5d8'] });
const BLUE = on({ type: 'color', colors: ['#1d4ed8', '#60a5fa'] });
const picture = (dim: number, blur = false): PageBackground =>
  on({ type: 'image', image: DUNES, dim, blur });

export const sheet: SheetSpec = {
  states: [...extras.states, ...home.states, ...sliders.states],
  registry: extras.registry,
  frames: [
    frame('Plain · as before'),
    frame('Gradient', GRADIENT),
    frame('Gradient · see-through', GRADIENT, 70),
    frame('A colour · sage', SAGE),
    frame('Two colours · blue', BLUE),
    frame('Two colours · blue, see-through', BLUE, 70),
    frame('Picture · undimmed', picture(0), 70),
    frame('Picture · dimmed 40 %, the default', picture(40), 70),
    frame('Picture · dimmed and blurred', picture(40, true), 70),
    frame('Picture · under solid cards', picture(40)),
    // a dim at its most: the picture a stain on the page's colour
    frame('Picture · dimmed 80 %', picture(80), 70),
    // the words that stand on the page take the light ink on a deep colour: the greeting and a section's heading
    {
      title: 'Words on the page · blue',
      width: 360,
      background: BLUE,
      cards: [
        { type: 'custom:fluvy-hello-card', _now: EVENING, name: 'Marta', person: 'person.marta' },
        { type: 'custom:fluvy-heading-card', title: 'Living room', subtitle: 'Edit' },
        { type: 'custom:fluvy-tile-card', entity: 'light.ceiling', cols: 6 },
        { type: 'custom:fluvy-tile-card', entity: 'light.reading', cols: 6 },
      ],
    },
    // an address the check refuses (white space, a parenthesis) never reaches the page: it draws plain
    frame(
      'Picture · a refused address draws plain',
      on({ type: 'image', image: '/local/a (1).jpg' }),
    ),
  ],
};
