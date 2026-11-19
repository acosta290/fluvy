import { CARD_ICONS } from '@fluvy/ui';
import { describe, expect, it } from 'vitest';
import { ON_DEMAND_PATHS, PARTS, type Outline } from '../icons/generated-on-demand.js';
import { ICON_PATHS } from '../icons/generated.js';
import { ICON_SET, iconNames, iconOutline, registerIcons } from '../icons/index.js';
import { MDI_GLYPHS } from '../icons/mdi.js';
import { CONFIG_GLYPHS } from '../shell/css/settings.js';

/** Every part's glyphs, by part (core's, the first part fetched, and each other), fetched as `getIcon` fetches them. */
async function everyPart(): Promise<Record<string, Readonly<Record<string, Outline>>>> {
  const parts: Record<string, Readonly<Record<string, Outline>>> = {
    core: ICON_PATHS,
    icons: ON_DEMAND_PATHS,
  };
  for (const [name, [, load]] of Object.entries(PARTS)) parts[name] = (await load()).PATHS;
  return parts;
}

describe('fluvy icon set', () => {
  it('outlines every glyph as closed filled rings on the 24 grid', async () => {
    expect((await iconNames()).length).toBeGreaterThanOrEqual(240);
    for (const part of Object.values(await everyPart()))
      for (const [name, outline] of Object.entries(part)) {
        expect(name, name).toMatch(/^[a-z0-9-]+$/);
        // a glyph drawn all faint (a signal no bar reaches) has no path of its own, only its faint one
        const drawn = (typeof outline === 'string' ? [outline] : outline).filter(Boolean);
        expect(drawn.length, name).toBeGreaterThan(0);
        for (const path of drawn) {
          // each ring: an absolute start, relative steps, closed
          const rings = path.match(/M[^Mz]*z/g) ?? [];
          expect(rings.join(''), name).toBe(path);
          for (const ring of rings) {
            const [start = '', steps = ''] = ring.slice(1, -1).split('l');
            const numbers = (text: string): number[] =>
              (text.match(/-?(?:\d+\.?\d*|\.\d+)/g) ?? []).map(Number);
            let [x = 0, y = 0] = numbers(start);
            const moves = numbers(steps);
            for (let i = 0; i <= moves.length; i += 2) {
              expect(x, `${name}: x`).toBeGreaterThanOrEqual(-0.5);
              expect(x, `${name}: x`).toBeLessThanOrEqual(24.5);
              expect(y, `${name}: y`).toBeGreaterThanOrEqual(-0.5);
              expect(y, `${name}: y`).toBeLessThanOrEqual(24.5);
              x += moves[i] ?? 0;
              y += moves[i + 1] ?? 0;
            }
          }
        }
      }
  });

  it('keeps in core what the shell draws, each other glyph in one part, and the index true to the parts', async () => {
    for (const glyph of [...Object.values(MDI_GLYPHS), ...Object.values(CONFIG_GLYPHS)])
      expect(ICON_PATHS[glyph], glyph).toBeTypeOf('string');
    const parts = await everyPart();
    const held = Object.values(parts).flatMap((part) => Object.keys(part));
    expect(new Set(held).size, 'a glyph in two parts').toBe(held.length);
    for (const [name, [names]] of Object.entries(PARTS))
      expect(names.split(' ').sort(), name).toEqual(Object.keys(parts[name] ?? {}).sort());
    expect(Object.keys(ON_DEMAND_PATHS)).toEqual(
      expect.arrayContaining(['gate', 'gate-open', 'garage-open', 'door-open', 'window']),
    );
    expect(Object.keys(parts['appliances'] ?? {})).toContain('washer');
    // the glyph sets of 1.23 (#226), each its own part: what Fluvy draws by itself (the levels, the rooms) too
    for (const [part, name] of [
      ['levels', 'battery-low'],
      ['levels', 'signal-weak'],
      ['levels', 'valve-shut'],
      ['energy', 'solar-panel'],
      ['devices', 'router'],
      ['climate', 'co2'],
      ['safety', 'leak'],
      ['outdoor', 'sprinkler'],
      ['home', 'ceiling-light'],
      ['rooms', 'kids-room'],
    ] as const)
      expect(Object.keys(parts[part] ?? {}), part).toContain(name);
    expect(new Set(await iconNames()).size).toBe(held.length);
  });

  it('outlines what a glyph draws faint apart: the bars a signal does not reach', async () => {
    const levels = (await PARTS['levels']![1]()).PATHS;
    expect(levels['signal-strong']).toBeTypeOf('string');
    for (const name of ['signal-none', 'signal-weak', 'signal-fair', 'signal-good', 'signal-off'])
      expect(levels[name], name).toHaveLength(2);
    // no bar reached: all four faint, nothing drawn full (the cross of `signal-off` is)
    expect(levels['signal-none']?.[0]).toBe('');
    expect(levels['signal-off']?.[0]).not.toBe('');
    // a database's top is its ellipse: drawn in the outline too
    expect(ICON_PATHS.database.match(/M/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('registers once through window.customIcons and answers the frontend contract', async () => {
    (globalThis as { window?: unknown }).window ??= globalThis;
    registerIcons();
    const host = globalThis as unknown as {
      customIcons?: Record<
        string,
        {
          getIcon: (
            n: string,
          ) => Promise<{ path: string; secondaryPath?: string; viewBox?: string }>;
          getIconList?: () => Promise<{ name: string }[]>;
        }
      >;
    };
    const set = host.customIcons?.[ICON_SET];
    expect(set).toBeDefined();
    const sun = await set!.getIcon('sun');
    expect(sun.path.startsWith('M')).toBe(true);
    expect(sun.viewBox).toBe('0 0 24 24');
    expect(sun.secondaryPath).toBeUndefined();
    expect((await set!.getIcon('nope')).path).toBe('');
    // the first part is fetched for the names it holds, a part of the index for its own, and both are listed
    expect((await set!.getIcon('gate-open')).path).toBe(ON_DEMAND_PATHS['gate-open']);
    const router = await set!.getIcon('router');
    expect(router.path.startsWith('M')).toBe(true);
    expect(router.secondaryPath).toBeUndefined();
    const weak = await set!.getIcon('signal-weak');
    expect(weak.path.startsWith('M')).toBe(true);
    expect(weak.secondaryPath?.startsWith('M')).toBe(true);
    expect(await iconOutline('signal-weak')).toEqual(weak);
    // the same set on the glyphs' own ink, for the cards: unlisted, the outline the same, its grid the scale undone
    const card = host.customIcons?.[CARD_ICONS];
    expect(card?.getIconList).toBeUndefined();
    expect(await card!.getIcon('signal-weak')).toEqual({
      ...weak,
      viewBox: '-1.33 -1.33 26.67 26.67',
    });
    const listed = (await set!.getIconList!()).map((i) => i.name);
    for (const name of ['cloud-sun', 'washer', 'battery-charging', 'kitchen', 'air-quality'])
      expect(listed).toContain(name);
    registerIcons();
    expect(host.customIcons?.[ICON_SET]).toBe(set);
  });

  it("takes over from the loader's stand-in and answers the icons asked of it meanwhile", async () => {
    (globalThis as { window?: unknown }).window ??= globalThis;
    const host = globalThis as unknown as { customIcons: Record<string, unknown> };
    let handOver: (set: { getIcon: (n: string) => Promise<{ path: string }> }) => void = () => {};
    const real = new Promise<{ getIcon: (n: string) => Promise<{ path: string }> }>((resolve) => {
      handOver = resolve;
    });
    host.customIcons[ICON_SET] = {
      handOver,
      getIcon: (name: string) => real.then((set) => set.getIcon(name)),
    };
    const early = (
      host.customIcons[ICON_SET] as { getIcon: (n: string) => Promise<{ path: string }> }
    ).getIcon('sun'); // the sidebar asks before the build arrives
    registerIcons();
    expect((host.customIcons[ICON_SET] as { handOver?: unknown }).handOver).toBeUndefined();
    expect((await early).path).toBe(ICON_PATHS['sun']);
  });
});
