import { registerCard } from '@fluvy/core';
import { MEDIA_FAMILY } from './media-family.js';
import { FluvyMediaCard } from './media/media-card.js';
import { FluvyNowPlayingCard } from './now-playing/now-playing-card.js';

/**
 * The media family's elements: this module is its own chunk, fetched at start (`index.ts`) and defined as it lands.
 * The names, descriptions and heights live in `media-family.ts`, which every page carries.
 */
const ELEMENTS: Readonly<Record<string, CustomElementConstructor>> = {
  'fluvy-media-card': FluvyMediaCard,
  'fluvy-now-playing-card': FluvyNowPlayingCard,
};

export const MEDIA_CATALOGUE = MEDIA_FAMILY.map(
  ([tag, name, description]) =>
    [tag, ELEMENTS[tag] as CustomElementConstructor, name, description] as const,
);

for (const [tag, element, name, description] of MEDIA_CATALOGUE)
  registerCard({ tag, name, description }, element);
