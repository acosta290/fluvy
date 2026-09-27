import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, PALETTE_NAMES } from '../config.js';
import { fromHex, hueDistance, isHex, minPairwiseDeltaE } from '../color/index.js';
import { derivePalette, GATES, STATE_HUES } from '../build/derive.js';
import { derivePalettes } from '../build/palettes.js';
import { brandColour, checkContrast, checkStructure, collectHexValues } from '../emit/contrast.js';
import { seeds } from '../palettes/index.js';
import { RAMP_STEPS, SEMANTIC_ROLES, STATE_KEYS, type PaletteMode } from '../types.js';

const palettes = derivePalettes();

function eachMode<T>(fn: (name: string, mode: PaletteMode) => T): void {
  for (const palette of palettes) {
    for (const mode of PALETTE_MODES) {
      fn(palette.name, mode);
    }
  }
}

describe('registry', () => {
  it('derives exactly the registered palettes, in order', () => {
    expect(palettes.map((palette) => palette.name)).toEqual([...PALETTE_NAMES]);
  });
});

describe('hex format', () => {
  it('emits nothing but plain #rrggbb — HA mangles every other notation', () => {
    for (const palette of palettes) {
      for (const mode of PALETTE_MODES) {
        for (const [label, value] of collectHexValues(palette[mode])) {
          expect(isHex(value), `${palette.name}/${mode}/${label} = ${value}`).toBe(true);
        }
      }
    }
  });
});

describe('ramps', () => {
  it('increase in lightness monotonically from 05 to 95', () => {
    eachMode((name, mode) => {
      const palette = palettes.find((entry) => entry.name === name);
      if (palette === undefined) throw new Error(`missing ${name}`);
      for (const ramp of [palette[mode].neutralRamp, palette[mode].accentRamp]) {
        const lightness = RAMP_STEPS.map((step) => fromHex(ramp[step]).l);
        for (let i = 1; i < lightness.length; i += 1) {
          const previous = lightness[i - 1] ?? 0;
          const current = lightness[i] ?? 0;
          expect(current, `${name}/${mode} step ${RAMP_STEPS[i]}`).toBeGreaterThan(previous);
        }
      }
    });
  });

  it('never bottoms out at black or tops out at white', () => {
    eachMode((name, mode) => {
      const palette = palettes.find((entry) => entry.name === name);
      if (palette === undefined) throw new Error(`missing ${name}`);
      for (const ramp of [palette[mode].neutralRamp, palette[mode].accentRamp]) {
        expect(ramp['05']).not.toBe('#000000');
        expect(ramp['95']).not.toBe('#ffffff');
      }
    });
  });
});

describe('dark mode is derived, not inverted', () => {
  it('keeps the accent hue instead of flipping it', () => {
    // the brand colour: Noir draws its lines in ink in light mode, and its lime is the fill
    for (const palette of palettes) {
      const light = fromHex(brandColour(palette.light));
      const dark = fromHex(brandColour(palette.dark));
      expect(hueDistance(light.h, dark.h), palette.name).toBeLessThan(25);
    }
  });

  it('desaturates and lightens a soft accent rather than mirroring lightness', () => {
    for (const palette of palettes.filter((p) => p.character === 'soft')) {
      const light = fromHex(palette.light.accent.ink);
      const dark = fromHex(palette.dark.accent.ink);
      expect(dark.c, palette.name).toBeLessThan(light.c);
      expect(dark.l, palette.name).toBeGreaterThan(light.l);
      // A mirror would put the dark accent at 1 - lightL; it does not.
      expect(Math.abs(dark.l - (1 - light.l)), palette.name).toBeGreaterThan(0.02);
    }
  });

  it('does not reuse the light page as a channel inversion', () => {
    for (const palette of palettes) {
      const light = fromHex(palette.light.surface.page);
      const dark = fromHex(palette.dark.surface.page);
      expect(hueDistance(light.h, dark.h), palette.name).toBeLessThan(25);
      expect(dark.l, palette.name).toBeLessThan(0.25);
      expect(palette.dark.surface.page).not.toBe('#000000');
    }
  });

  it('lifts the dark card off the page by 4-6 lightness points', () => {
    for (const palette of palettes) {
      const lift = fromHex(palette.dark.surface.card).l - fromHex(palette.dark.surface.page).l;
      expect(lift, palette.name).toBeGreaterThanOrEqual(GATES.darkCardLift.min - 0.002);
      expect(lift, palette.name).toBeLessThanOrEqual(GATES.darkCardLift.max + 0.002);
    }
  });
});

describe('contrast gates', () => {
  it('passes every gated pair for every palette and mode', () => {
    const failures: string[] = [];
    for (const palette of palettes) {
      for (const mode of PALETTE_MODES) {
        for (const result of checkContrast(palette[mode])) {
          if (!result.pass) {
            failures.push(`${palette.name}/${mode} ${result.id}: ${result.ratio} < ${result.min}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('passes every structural check', () => {
    const failures: string[] = [];
    for (const palette of palettes) {
      for (const mode of PALETTE_MODES) {
        for (const result of checkStructure(palette, mode)) {
          if (!result.pass) failures.push(`${palette.name}/${mode} ${result.id}: ${result.detail}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('graph harmony', () => {
  it('anchors series 1 on the accent hue', () => {
    for (const palette of palettes) {
      for (const mode of PALETTE_MODES) {
        const colors = palette[mode];
        const first = colors.graph[0];
        if (first === undefined) throw new Error('empty graph series');
        const drift = hueDistance(fromHex(brandColour(colors)).h, fromHex(first).h);
        expect(drift, `${palette.name}/${mode}`).toBeLessThan(6);
      }
    }
  });

  it('repeats the six harmony hues as a second, deeper tone row', () => {
    for (const palette of palettes) {
      for (const mode of PALETTE_MODES) {
        const colors = palette[mode];
        for (let i = 0; i < 6; i += 1) {
          const base = colors.graph[i];
          const tone = colors.graph[i + 6];
          if (base === undefined || tone === undefined) throw new Error('missing series');
          expect(hueDistance(fromHex(base).h, fromHex(tone).h), `series ${i + 1}`).toBeLessThan(8);
          expect(fromHex(tone).l, `series ${i + 7}`).toBeLessThan(fromHex(base).l);
        }
      }
    }
  });

  it('keeps every series apart by at least the ΔE gate', () => {
    for (const palette of palettes) {
      for (const mode of PALETTE_MODES) {
        expect(
          minPairwiseDeltaE(palette[mode].graph),
          `${palette.name}/${mode}`,
        ).toBeGreaterThanOrEqual(GATES.graphSeparation);
      }
    }
  });
});

describe('status and domain states', () => {
  it('spaces domain-state hues around the wheel', () => {
    const hues = STATE_KEYS.map((key) => STATE_HUES[key]).sort((a, b) => a - b);
    for (let i = 0; i < hues.length; i += 1) {
      const current = hues[i] ?? 0;
      const next = hues[(i + 1) % hues.length] ?? 0;
      const gap = i === hues.length - 1 ? next + 360 - current : next - current;
      expect(gap, `after ${current}°`).toBeGreaterThanOrEqual(GATES.stateHueGap);
    }
  });

  it('keeps status inks distinguishable from the domain states nearest in hue', () => {
    for (const palette of palettes) {
      for (const mode of PALETTE_MODES) {
        const colors = palette[mode];
        // the twins are the accent itself: it counts once
        const inks = [
          ...SEMANTIC_ROLES.map((role) => colors.semantic[role].ink),
          ...STATE_KEYS.filter((key) => !palette.twins.includes(key)).map(
            (key) => colors.state[key].ink,
          ),
          ...(palette.twins.length && palette.character === 'vivid' ? [colors.accent.ink] : []),
        ];
        expect(minPairwiseDeltaE(inks), `${palette.name}/${mode}`).toBeGreaterThanOrEqual(
          GATES.roleSeparation,
        );
      }
    }
  });

  it('holds heat lighter than danger, so a warm room never reads as an alarm', () => {
    for (const palette of palettes) {
      const light = palette.light;
      expect(fromHex(light.state['climate-heat'].ink).l, palette.name).toBeGreaterThan(
        fromHex(light.semantic.danger.ink).l,
      );
    }
  });
});

describe('seed anchoring', () => {
  it('keeps the designer accent hue for the seeded mode', () => {
    for (const palette of palettes) {
      const seed = seeds[palette.name as keyof typeof seeds];
      const seeded = palette[seed.baseMode];
      expect(hueDistance(fromHex(seed.accentInk).h, fromHex(seeded.accent.ink).h)).toBeLessThan(1);
      expect(seeded.accent.fill).toBe(seed.accentFill);
    }
  });

  it('is deterministic', () => {
    expect(derivePalette(seeds.sand)).toEqual(derivePalette(seeds.sand));
  });
});

describe('sand snapshot', () => {
  it('matches the recorded palette', () => {
    expect(derivePalette(seeds.sand)).toMatchSnapshot();
  });
});
