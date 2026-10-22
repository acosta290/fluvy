import { unsafeCSS } from 'lit';
import { energyCss } from './generated/energy.js';

/** The energy family's sheet: a module of its own, so it travels in the family's chunk, one copy for all its cards. */
export const energyStyles = unsafeCSS(energyCss);
