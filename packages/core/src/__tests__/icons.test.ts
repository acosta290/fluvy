import { describe, expect, it } from 'vitest';
import { ICON_PATHS } from '../icons/generated.js';
import { ICON_SET, iconNames, registerIcons } from '../icons/index.js';

describe('fluvy icon set', () => {
  it('outlines every glyph as closed filled rings on the 24 grid', () => {
    expect(iconNames().length).toBeGreaterThanOrEqual(80);
    for (const [name, path] of Object.entries(ICON_PATHS)) {
      expect(name, name).toMatch(/^[a-z0-9-]+$/);
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
  });

  it('registers once through window.customIcons and answers the frontend contract', async () => {
    (globalThis as { window?: unknown }).window ??= globalThis;
    registerIcons();
    const host = globalThis as unknown as {
      customIcons?: Record<
        string,
        {
          getIcon: (n: string) => Promise<{ path: string; viewBox?: string }>;
          getIconList: () => Promise<{ name: string }[]>;
        }
      >;
    };
    const set = host.customIcons?.[ICON_SET];
    expect(set).toBeDefined();
    const sun = await set!.getIcon('sun');
    expect(sun.path.startsWith('M')).toBe(true);
    expect(sun.viewBox).toBe('0 0 24 24');
    expect((await set!.getIcon('nope')).path).toBe('');
    expect((await set!.getIconList()).some((i) => i.name === 'cloud-sun')).toBe(true);
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
