import type { PaletteSeed } from '../types.js';

/*
 * The electric line: one bright accent at full chroma on near-neutral greys, near-black ink. Each seed
 * gives the light mode (Noir the dark); the other mode is derived through the vivid profile, and the
 * gates still hold — a vivid accent is a graphic colour, its text is derived deeper.
 */

export const blaze: PaletteSeed = {
  name: 'blaze',
  title: 'Blaze',
  description:
    'Electric orange on cool white: icons, curves and the primary action burn; the rest stays quiet.',
  baseMode: 'light',
  character: 'vivid',
  page: '#ebecee',
  card: '#ffffff',
  accentInk: '#f94410',
  accentFill: '#ffe8e0',
  accentOnFill: '#36130b',
  // heat moves to red: the orange is the brand's, a radiator must not read as the accent
  states: { 'climate-heat': { hue: 16 } },
};

export const volt: PaletteSeed = {
  name: 'volt',
  title: 'Volt',
  description: 'Periwinkle tiles and a lime highlight on a cool grey, filled solid with black ink.',
  baseMode: 'light',
  character: 'vivid',
  fill: 'solid',
  page: '#dcdfe3',
  card: '#ffffff',
  accentInk: '#5a6ff0',
  accentFill: '#a3b8ff',
  accentOnFill: '#101318',
  highlight: '#e2ff3d',
  // the house is the accent in the energy flow
  twin: 'energy-home',
};

export const flamingo: PaletteSeed = {
  name: 'flamingo',
  title: 'Flamingo',
  description: 'Hot pink on a soft grey, with pale pink plates for what is on.',
  baseMode: 'light',
  character: 'vivid',
  page: '#edebed',
  card: '#ffffff',
  accentInk: '#fe2c79',
  accentFill: '#ffe4ef',
  accentOnFill: '#36101b',
};

export const mint: PaletteSeed = {
  name: 'mint',
  title: 'Mint',
  description: 'A clean green filled solid, with black ink: fresh without turning pastel.',
  baseMode: 'light',
  character: 'vivid',
  fill: 'solid',
  page: '#e8edeb',
  card: '#ffffff',
  accentInk: '#009b67',
  accentFill: '#7eedc3',
  accentOnFill: '#0b1d16',
  // someone at home is the brand green itself; "all good" steps to a yellower green, clear of it
  twin: 'presence-home',
  statuses: { success: { hue: 142 } },
};

export const iris: PaletteSeed = {
  name: 'iris',
  title: 'Iris',
  description: 'Ultraviolet on white, with a cyan highlight for the moments that matter.',
  baseMode: 'light',
  character: 'vivid',
  page: '#ecebf1',
  card: '#ffffff',
  accentInk: '#7447ff',
  accentFill: '#ece6ff',
  accentOnFill: '#1e1a3a',
  highlight: '#5ce1ff',
  // the house is the accent in the energy flow
  twin: 'energy-home',
};

/**
 * The one dark-first electric seed: lime on charcoal, filled solid. Its derived light mode draws its lines in
 * ink and keeps the lime as the fill: black, lime and white.
 */
export const noir: PaletteSeed = {
  name: 'noir',
  title: 'Noir',
  description: 'Dark-first: charcoal with a lime that glows, filled solid with black ink.',
  baseMode: 'dark',
  character: 'vivid',
  fill: 'solid',
  page: '#101114',
  card: '#1b1c20',
  accentInk: '#d4ff3a',
  accentFill: '#d4ff3a',
  accentOnFill: '#0e1204',
};
