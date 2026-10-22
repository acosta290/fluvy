import { unsafeCSS } from 'lit';
import { mediaCss } from './generated/media.js';

/** The player's sheet: a module of its own, so it travels in the media family's chunk. */
export const mediaStyles = unsafeCSS(mediaCss);
