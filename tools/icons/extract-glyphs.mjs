#!/usr/bin/env node
/**
 * Dumps the fluvy glyph table (24 grid, stroke bodies) as JSON for the outliner:
 *   node tools/icons/extract-glyphs.mjs > glyphs.json   (then tools/icons/outline.py glyphs.json
 *   packages/core/src/icons/generated.ts packages/core/src/icons/generated-on-demand.ts packages/core/src/icons/parts)
 * Every glyph of the set but those only a card draws (a tab row's styles, the energy flow's nodes, a map's pin), the
 * appliances' kinds a person would pick for a card of their own (their chunk draws the rest), and the glyph sets of
 * 1.23 (`packages/ui/src/glyph-sets/`), each with the part of the set Home Assistant fetches it in.
 */
import { glyphBody, glyphNames } from '../../packages/ui/src/glyphs.ts';
import { APPLIANCE_GLYPHS, PICKABLE } from '../../packages/cards/src/appliance/glyphs.ts';
import { CLIMATE_GLYPHS } from '../../packages/ui/src/glyph-sets/climate.ts';
import { DEVICE_GLYPHS } from '../../packages/ui/src/glyph-sets/devices.ts';
import { ENERGY_GLYPHS } from '../../packages/ui/src/glyph-sets/energy.ts';
import { HOME_GLYPHS } from '../../packages/ui/src/glyph-sets/home.ts';
import { LEVEL_GLYPHS } from '../../packages/ui/src/glyph-sets/levels.ts';
import { OUTDOOR_GLYPHS } from '../../packages/ui/src/glyph-sets/outdoor.ts';
import { ROOM_GLYPHS } from '../../packages/ui/src/glyph-sets/rooms.ts';
import { SAFETY_GLYPHS } from '../../packages/ui/src/glyph-sets/safety.ts';

/** Glyphs no one picks in Home Assistant's icon picker: stroked by the cards that draw them, never outlined. */
const STROKE_ONLY = new Set([
  'tower',
  'generator',
  'swap',
  'pin',
  'tabsText',
  'tabsPills',
  'tabsNone',
  // the remote's keys, the panel's choices of a background and of the wall's way out
  'captions',
  'forward',
  'rewind',
  'tv',
  'gradient',
  'image',
  'hold',
]);

/**
 * Glyphs of the set Fluvy's own chrome never names (no Material icon it redraws, no sheet's mask): outlined into the
 * part `getIcon` fetches the first time Home Assistant asks for one of them (`fluvy:gate-open`), beside the index of
 * the set's other parts.
 */
const ON_DEMAND = new Set([
  'doorOpen',
  'gate',
  'gateOpen',
  'garage',
  'garageOpen',
  'window',
  'windowOpen',
  'cctv',
  'external',
  'refresh',
]);

/**
 * The set's other parts, each fetched the first time one of its glyphs is asked for: the appliances a person picks,
 * and each glyph set of 1.23 (a wall tablet's icons in Fluvy's hand, #226).
 */
const PARTS = {
  appliances: Object.fromEntries(PICKABLE.map((name) => [name, APPLIANCE_GLYPHS[name]])),
  levels: LEVEL_GLYPHS,
  energy: ENERGY_GLYPHS,
  devices: DEVICE_GLYPHS,
  climate: CLIMATE_GLYPHS,
  safety: SAFETY_GLYPHS,
  outdoor: OUTDOOR_GLYPHS,
  home: HOME_GLYPHS,
  rooms: ROOM_GLYPHS,
};

/** A table's entry as the outliner reads it: its body, its stroke. */
const entry = (glyph) =>
  typeof glyph === 'string'
    ? { body: glyph, strokeWidth: 1.75 }
    : { body: glyph[0], strokeWidth: glyph[1] };

const out = {};
for (const name of glyphNames) if (!STROKE_ONLY.has(name)) out[name] = glyphBody(name);
for (const name of ON_DEMAND) out[name] = { ...out[name], part: 'icons' };
for (const [part, table] of Object.entries(PARTS))
  for (const [name, glyph] of Object.entries(table)) {
    if (name in out) throw new Error(`${name} is in the set twice`);
    out[name] = { ...entry(glyph), part };
  }
process.stdout.write(JSON.stringify(out, null, 1));
