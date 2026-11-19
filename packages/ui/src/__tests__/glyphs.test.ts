import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { CLIMATE_GLYPHS } from '../glyph-sets/climate.js';
import { DEVICE_GLYPHS } from '../glyph-sets/devices.js';
import { ENERGY_GLYPHS } from '../glyph-sets/energy.js';
import { HOME_GLYPHS } from '../glyph-sets/home.js';
import { LEVEL_GLYPHS } from '../glyph-sets/levels.js';
import { OUTDOOR_GLYPHS } from '../glyph-sets/outdoor.js';
import { ROOM_GLYPHS, ROOM_ICONS } from '../glyph-sets/rooms.js';
import { SAFETY_GLYPHS } from '../glyph-sets/safety.js';
import { addGlyphs, glyphBody, glyphNames, isGlyph, type GlyphName } from '../glyphs.js';

/** A glyph's key as its `fluvy:` name says it (`kidsRoom` → `kids-room`). */
const kebab = (name: string): string => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const LAB = join(ROOT, 'apps', 'design-lab', 'fluvy.js');

/** The glyph sets of 1.23 (#226), by the family the design lab keeps them under. */
const SETS: Readonly<Record<string, Readonly<Record<string, string | readonly [string, number]>>>> =
  {
    levels: LEVEL_GLYPHS,
    energy: ENERGY_GLYPHS,
    devices: DEVICE_GLYPHS,
    climate: CLIMATE_GLYPHS,
    safety: SAFETY_GLYPHS,
    outdoor: OUTDOOR_GLYPHS,
    home: HOME_GLYPHS,
    rooms: ROOM_GLYPHS,
  };

interface Lab {
  readonly G: Record<string, string>;
  readonly GLYPH_SETS: Record<string, Record<string, string>>;
}

/** The design lab's tables (a plain script: run as it is). */
async function lab(): Promise<Lab> {
  const context: Record<string, unknown> = {
    document: {
      createElement: () => ({ style: {} }),
      body: { appendChild() {} },
      createRange: () => ({}),
    },
  };
  context['globalThis'] = context;
  vm.createContext(context);
  vm.runInContext(await readFile(LAB, 'utf8'), context);
  return context['FLUVY'] as Lab;
}

/** A lab glyph's body and stroke, as its `<svg>` says them. */
const drawn = (svg: string): { body: string; strokeWidth: number } => ({
  body: svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, ''),
  strokeWidth: Number(/stroke-width="([\d.]+)"/.exec(svg)?.[1]),
});

/** The design lab keeps its own copy of the glyph table (plain script, no modules). They must not drift. */
describe('glyph set', () => {
  it('contains every glyph of the design lab, path for path', async () => {
    for (const [name, svg] of Object.entries((await lab()).G)) {
      expect(isGlyph(name), `glyph "${name}" is missing`).toBe(true);
      expect(glyphBody(name as GlyphName).body, `glyph "${name}" differs from the design lab`).toBe(
        drawn(svg).body,
      );
    }
  });

  it('keeps the glyph sets of 1.23 as the design lab draws them, family by family, path for path and stroke for stroke', async () => {
    const sets = (await lab()).GLYPH_SETS;
    expect(Object.keys(sets)).toEqual(Object.keys(SETS));
    for (const [family, table] of Object.entries(SETS)) {
      expect(Object.keys(sets[family] ?? {}), family).toEqual(Object.keys(table));
      for (const [name, entry] of Object.entries(table)) {
        const [body, strokeWidth] = typeof entry === 'string' ? [entry, 1.75] : entry;
        expect(drawn(sets[family]?.[name] ?? ''), `${family}.${name}`).toEqual({
          body,
          strokeWidth,
        });
      }
    }
  });

  it('draws a set’s glyph once a chunk adds it, with its own stroke, never one of the set’s own', () => {
    const names = Object.values(SETS).flatMap((table) => Object.keys(table));
    expect(new Set(names).size, 'a name in two sets').toBe(names.length);
    for (const name of names) {
      expect(glyphNames, name).not.toContain(name);
      expect(isGlyph(name), name).toBe(false);
    }
    addGlyphs(LEVEL_GLYPHS);
    expect(isGlyph('batteryLow')).toBe(true);
    expect(glyphBody('signalWeak' as GlyphName)).toEqual({
      body: LEVEL_GLYPHS.signalWeak[0],
      strokeWidth: 2.2,
    });
    expect(glyphBody('valveShut' as GlyphName).strokeWidth).toBe(1.75);
  });

  it('draws a room by the area icon people pick for it, and no other', () => {
    expect(ROOM_ICONS['mdi:bed']).toBe('fluvy:bedroom');
    expect(ROOM_ICONS['mdi:stove']).toBe('fluvy:kitchen');
    expect(ROOM_ICONS['mdi:silverware-fork-knife']).toBe('fluvy:dining');
    expect(ROOM_ICONS['mdi:shower']).toBe('fluvy:bathroom');
    expect(ROOM_ICONS['mdi:teddy-bear']).toBe('fluvy:kids-room');
    expect(ROOM_ICONS['mdi:desk']).toBe('fluvy:office');
    expect(ROOM_ICONS['mdi:washing-machine']).toBe('fluvy:laundry');
    expect(ROOM_ICONS['mdi:flower']).toBe('fluvy:garden');
    expect(ROOM_ICONS['mdi:sofa']).toBe('fluvy:living-room');
    expect(ROOM_ICONS['mdi:garage']).toBe('fluvy:garage');
    expect(ROOM_ICONS['mdi:lightbulb']).toBeUndefined();
    // every glyph it names is one of the set's: a room's, or one of its own the room is drawn with
    const known = new Set([
      ...glyphNames.map(kebab),
      ...Object.values(SETS).flatMap((table) => Object.keys(table).map(kebab)),
    ]);
    for (const icon of new Set(Object.values(ROOM_ICONS)))
      expect(known.has(icon.slice('fluvy:'.length)), icon).toBe(true);
  });

  it('names every glyph of the sets in the theme guide, by its `fluvy:` name', async () => {
    const guide = await readFile(join(ROOT, 'docs', 'theme.md'), 'utf8');
    for (const name of Object.values(SETS).flatMap((table) => Object.keys(table)))
      expect(guide, kebab(name)).toContain(`\`${kebab(name)}\``);
  });
});
