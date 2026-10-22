#!/usr/bin/env node
/**
 * Dumps the fluvy glyph table (24 grid, stroke bodies) as JSON for the outliner:
 *   node tools/icons/extract-glyphs.mjs > glyphs.json   (then tools/icons/outline.py glyphs.json
 *   packages/core/src/icons/generated.ts packages/core/src/icons/generated-on-demand.ts)
 * Every glyph of the set but those only a card draws (a tab row's styles, the energy flow's nodes, a map's pin), and
 * the appliances' kinds a person would pick for a card of their own (their chunk draws the rest).
 */
import { glyphBody, glyphNames } from '../../packages/ui/src/glyphs.ts';
import { APPLIANCE_GLYPHS, PICKABLE } from '../../packages/cards/src/appliance/glyphs.ts';

/** Glyphs no one picks in Home Assistant's icon picker: stroked by the cards that draw them, never outlined. */
const STROKE_ONLY = new Set([
  'tower',
  'generator',
  'swap',
  'pin',
  'tabsText',
  'tabsPills',
  'tabsNone',
]);

/**
 * Glyphs Fluvy's own chrome never names (no Material icon it redraws, no sheet's mask): outlined into the set's part
 * that `getIcon` fetches the first time Home Assistant asks for one of them (`fluvy:washer`, `fluvy:gate-open`).
 */
const ON_DEMAND = new Set([
  ...PICKABLE,
  'doorOpen',
  'gate',
  'gateOpen',
  'garage',
  'garageOpen',
  'window',
  'windowOpen',
  'cctv',
]);

const out = {};
for (const name of glyphNames) if (!STROKE_ONLY.has(name)) out[name] = glyphBody(name);
for (const name of PICKABLE) out[name] = { body: APPLIANCE_GLYPHS[name], strokeWidth: 1.75 };
for (const name of ON_DEMAND) out[name] = { ...out[name], onDemand: true };
process.stdout.write(JSON.stringify(out, null, 1));
