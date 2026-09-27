import { describe, expect, it } from 'vitest';
import { converter, differenceCiede2000 } from 'culori';
import {
  chromaEnvelope,
  composite,
  contrastRatio,
  deltaE,
  ensureContrast,
  fromHex,
  hueDistance,
  isHex,
  mixHue,
  toHex,
} from '../color/index.js';

describe('hex output', () => {
  it('always produces lowercase #rrggbb', () => {
    for (let l = 0; l <= 1.0001; l += 0.1) {
      for (let h = 0; h < 360; h += 45) {
        expect(isHex(toHex({ l, c: 0.3, h }))).toBe(true);
      }
    }
  });

  it('gamut-maps out-of-range chroma instead of throwing', () => {
    expect(isHex(toHex({ l: 0.5, c: 5, h: 120 }))).toBe(true);
  });

  it('round-trips a hex through OKLCH within one 8-bit step', () => {
    for (const hex of ['#8a5a2b', '#1e1b16', '#fffdfa', '#46596e']) {
      expect(toHex(fromHex(hex))).toBe(hex);
    }
  });
});

describe('WCAG 2.1 contrast', () => {
  it('reports 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('is symmetric and self-contrast is 1', () => {
    expect(contrastRatio('#8a5a2b', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#8a5a2b'),
      10,
    );
    expect(contrastRatio('#8a5a2b', '#8a5a2b')).toBeCloseTo(1, 10);
  });

  it("matches the documented ratio of HA's default primary on white", () => {
    expect(contrastRatio('#009ac7', '#ffffff')).toBeCloseTo(3.26, 2);
  });
});

describe('composite', () => {
  it('returns the background at alpha 0 and the foreground at alpha 1', () => {
    expect(composite('#000000', '#ffffff', 0)).toBe('#ffffff');
    expect(composite('#000000', '#ffffff', 1)).toBe('#000000');
  });

  it('flattens to an opaque hex in between', () => {
    expect(composite('#000000', '#ffffff', 0.7)).toBe('#4d4d4d');
  });
});

describe('ensureContrast', () => {
  it('leaves a colour alone when it already clears the gate', () => {
    const start = fromHex('#4a3418');
    expect(ensureContrast(start, '#ffffff', 4.5, 'darker')).toEqual(start);
  });

  it('moves lightness only, never hue or chroma', () => {
    const start = { l: 0.8, c: 0.08, h: 62 };
    const fitted = ensureContrast(start, '#ffffff', 4.5, 'darker');
    expect(fitted.h).toBe(start.h);
    expect(fitted.c).toBe(start.c);
    expect(fitted.l).toBeLessThan(start.l);
    expect(contrastRatio(toHex(fitted), '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('hue helpers', () => {
  it('wraps the shortest way around the circle', () => {
    expect(mixHue(350, 10, 0.5)).toBeCloseTo(0, 5);
    expect(hueDistance(350, 10)).toBeCloseTo(20, 5);
  });
});

describe('chroma envelope', () => {
  it('peaks at mid lightness and collapses at both ends', () => {
    expect(chromaEnvelope(0.5)).toBeCloseTo(1, 5);
    expect(chromaEnvelope(0)).toBeCloseTo(0, 5);
    expect(chromaEnvelope(1)).toBeCloseTo(0, 5);
    expect(chromaEnvelope(0.958)).toBeLessThan(0.3);
  });
});

describe('deltaE', () => {
  it('is zero for identical colours and positive otherwise', () => {
    expect(deltaE('#8a5a2b', '#8a5a2b')).toBeCloseTo(0, 6);
    expect(deltaE('#8a5a2b', '#46596e')).toBeGreaterThan(10);
  });
});

describe('the colour maths the browser runs', () => {
  // a fixed walk over the cube: greys, primaries, and everything between
  const samples = Array.from({ length: 400 }, (_, i) => {
    const n = (i * 2654435761) % 16777216;
    return `#${n.toString(16).padStart(6, '0')}`;
  }).concat(['#000000', '#ffffff', '#808080', '#ff0000', '#00ff00', '#0000ff']);

  it('reads OKLCH as culori does', () => {
    const oklch = converter('oklch');
    for (const hex of samples) {
      const ours = fromHex(hex);
      const theirs = oklch(hex);
      expect(ours.l, hex).toBeCloseTo(theirs?.l ?? 0, 12);
      expect(ours.c, hex).toBeCloseTo(theirs?.c ?? 0, 12);
      if (ours.c > 1e-6) expect(ours.h, hex).toBeCloseTo(theirs?.h ?? 0, 9);
    }
  });

  it('measures CIEDE2000 as culori does', () => {
    const ciede2000 = differenceCiede2000();
    for (let i = 0; i < samples.length - 1; i += 1) {
      const a = samples[i] as string;
      const b = samples[i + 1] as string;
      expect(deltaE(a, b), `${a} ${b}`).toBeCloseTo(ciede2000(a, b), 10);
    }
  });
});
