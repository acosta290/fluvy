import { unsafeCSS } from 'lit';
import { climateCss } from './generated/climate.js';

/** The thermostat's sheet: a module of its own, so it travels in the Thermostat card's chunk. */
export const climateStyles = unsafeCSS(climateCss);
