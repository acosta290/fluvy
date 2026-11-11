import { describe, expect, it } from 'vitest';
import { derivePalette, GATES } from '../build/derive.js';
import { contrastRatio, fromHex } from '../color/index.js';
import { PALETTE_MODES, PALETTE_NAMES } from '../config.js';
import { buildReports } from '../emit/contrast.js';
import { surfaceInset } from '../emit/vars.js';
import { accentFamily } from '../build/accent-family.js';
import { COMMUNITY_PALETTES } from '../palettes/community/index.js';
import { parseCustomPalette, type CustomPalette } from '../palettes/custom.js';
import { paletteKey, parsePaletteKey } from '../palettes/key.js';
import { parsePaletteFile } from '../palettes/file.js';
import { lookDeclarations, seedOf } from '../runtime.js';
import type { PaletteMode } from '../types.js';

/** The E-ink palette as its file gives it, and the same set off by its fill (what it was before it could say). */
const EINK: CustomPalette = { character: 'soft', base: 'neutral', accent: '#1f1f1f' };
const line = derivePalette(seedOf({ ...EINK, surface: 'line' }));
const ink = derivePalette(seedOf({ ...EINK, surface: 'ink' }));
const fill = derivePalette(seedOf(EINK));

const declared = (palette: typeof line, mode: PaletteMode): Map<string, string> =>
  new Map(lookDeclarations(palette, mode));

describe('a surface read by its edges (#154)', () => {
  it('is said by a palette, left unsaid where it is the fill, and anything else is the fill', () => {
    expect(parseCustomPalette({ ...EINK, surface: 'line' })).toEqual({ ...EINK, surface: 'line' });
    expect(parseCustomPalette({ ...EINK, surface: 'ink' })).toEqual({ ...EINK, surface: 'ink' });
    for (const surface of ['fill', 'outline', '', 3, null])
      expect(parseCustomPalette({ ...EINK, surface }), String(surface)).toEqual(EINK);
    const file = parsePaletteFile({
      fluvy_palette: 1,
      name: 'paper',
      title: 'Paper',
      palette: { ...EINK, surface: 'line' },
    });
    expect(file?.palette.surface).toBe('line');
  });

  it('keys a palette after its surface, and a palette without one as before', () => {
    expect(paletteKey(EINK)).toBe('custom:soft:neutral:#1f1f1f::');
    expect(paletteKey({ ...EINK, surface: 'line' })).toBe('custom:soft:neutral:#1f1f1f:::line');
    for (const custom of [
      { ...EINK, surface: 'line' },
      { ...EINK, surface: 'ink' },
      {
        character: 'vivid',
        base: 'cool',
        accent: '#ff4a1a',
        fill: 'solid',
        highlight: '#e2ff3d',
        surface: 'line',
      },
    ] satisfies CustomPalette[])
      expect(parsePaletteKey(paletteKey(custom))).toEqual(custom);
    for (const key of [
      'custom:soft:neutral:#1f1f1f:::fill',
      'custom:soft:neutral:#1f1f1f:::dotted',
      'custom:soft:neutral:#1f1f1f:::line:ink',
    ])
      expect(parsePaletteKey(key), key).toBeUndefined();
  });

  it('gives the page and the cards one colour: the card’s in light, the page’s in dark', () => {
    for (const palette of [line, ink]) {
      expect(palette.light.surface.page).toBe(fill.light.surface.card);
      expect(palette.dark.surface.page).toBe(fill.dark.surface.page);
      for (const mode of PALETTE_MODES) {
        const { page, card, cardElevated } = palette[mode].surface;
        expect([card, cardElevated], mode).toEqual([page, page]);
      }
    }
  });

  it('keeps the step the two stood apart by inside the cards, as its inset', () => {
    expect(line.light.line?.inset).toBe(fill.light.surface.page);
    expect(line.dark.line?.inset).toBe(fill.dark.surface.card);
  });

  it('moves nothing else: every ink, hairline, fill and status is the fill surface’s', () => {
    // what a surface is: its page and cards, what closes them, the words on where you are, a dialog's buttons
    const SURFACE = ['surface', 'unavailable', 'selected', 'buttons', 'line'];
    const rest = (colors: object): object =>
      Object.fromEntries(Object.entries(colors).filter(([key]) => !SURFACE.includes(key)));
    for (const mode of PALETTE_MODES) {
      expect(rest(line[mode]), mode).toEqual(rest(fill[mode]));
      const { surface } = fill[mode];
      expect(line[mode].surface.border).toBe(surface.border);
      expect(line[mode].surface.borderStrong).toBe(surface.borderStrong);
      expect(line[mode].surface.pageAlt).toBe(surface.pageAlt);
      expect(line[mode].unavailable.ink).toBe(fill[mode].unavailable.ink);
      // where you are: the ink as a pill, its words in the page's colour
      expect(line[mode].selected.on).toBe(line[mode].surface.page);
    }
  });

  it('closes a card by an edge that clears 3:1 on the page, in both modes; the hairline would not', () => {
    for (const mode of PALETTE_MODES) {
      const { page, borderStrong } = line[mode].surface;
      const edge = line[mode].line!.edge;
      expect(contrastRatio(edge, page), mode).toBeGreaterThanOrEqual(GATES.edgeVsPage);
      // the strong hairline taken deeper, no further than the gate asks
      expect(contrastRatio(edge, page), mode).toBeLessThan(GATES.edgeVsPage + 0.15);
      expect(contrastRatio(borderStrong, page), mode).toBeLessThan(GATES.edgeVsPage);
      expect(fromHex(edge).h).toBeCloseTo(fromHex(borderStrong).h, 0);
    }
  });

  it('draws the edge in the text’s ink where the palette asks for ink', () => {
    for (const mode of PALETTE_MODES) {
      expect(ink[mode].line?.edge, mode).toBe(ink[mode].text.primary);
      expect(ink[mode].line?.inset).toBe(line[mode].line?.inset);
    }
  });

  it('dashes the same edge round what is out of reach', () => {
    for (const mode of PALETTE_MODES) {
      expect(line[mode].unavailable.border).toBe(line[mode].line?.edge);
      expect(fill[mode].unavailable.border).not.toBe(line[mode].line?.edge);
    }
  });

  it('is gated by its edge in place of the card against the page, and by its inks on its inset', () => {
    for (const palette of [line, ink])
      for (const report of buildReports([palette])) {
        const ids = report.contrast.map((gate) => gate.id);
        expect(ids).toContain('surface/edge-on-page');
        expect(ids).not.toContain('surface/card-on-page');
        const edge = report.contrast.find((gate) => gate.id === 'surface/edge-on-page')!;
        expect(edge.min).toBe(GATES.edgeVsPage);
        // whatever is read on the page is read on the inset
        const onPage = ids.filter((id) => id.endsWith('-on-page') && !id.startsWith('surface/'));
        expect(onPage.length).toBeGreaterThan(20);
        for (const id of onPage) expect(ids).toContain(id.replace(/-on-page$/, '-on-inset'));
        expect(
          [...report.contrast, ...report.structural].filter((gate) => !gate.pass),
          report.mode,
        ).toEqual([]);
        // dark: the lift the card had over the page is its inset's
        if (report.mode === 'dark')
          expect(report.structural.find((gate) => gate.id === 'dark/card-lift')?.pass).toBe(true);
      }
    const before = buildReports([fill]).flatMap((report) => report.contrast.map((gate) => gate.id));
    expect(before).toContain('surface/card-on-page');
    expect(before.some((id) => /edge|inset/.test(id))).toBe(false);
  });

  it('declares its edge and its inset, closes what lifts by the edge and casts no shadow', () => {
    for (const mode of PALETTE_MODES) {
      const look = declared(line, mode);
      const { edge, inset } = line[mode].line!;
      expect(look.get('--fluvy-edge')).toBe(edge);
      expect(look.get('--fluvy-inset')).toBe(inset);
      expect(look.get('--fluvy-page')).toBe(look.get('--fluvy-card'));
      expect(look.get('--fluvy-shadow-lift')).toBe(`0 0 0 1px ${edge}`);
      expect(look.get('--fluvy-shadow-knob')).toBe('0 0 0 0 #00000000');
      expect(look.get('--fluvy-shade')).toBe('0');
      expect(look.get('--fluvy-unavailable-border')).toBe(edge);
      // Home Assistant's own cards, sheets and header take the edge; its fields and resting switch the inset
      expect(look.get('--ha-card-border-color')).toBe(edge);
      expect(look.get('--ha-bottom-sheet-border-color')).toBe(edge);
      expect(look.get('--app-header-border-bottom')).toBe(`1px solid ${edge}`);
      expect(look.get('--ha-color-form-background')).toBe(inset);
      expect(look.get('--input-fill-color')).toBe(inset);
      expect(look.get('--ha-switch-thumb-box-shadow')).toBe('none');
      expect(look.get('--primary-background-color')).toBe(line[mode].surface.page);
    }
    expect(declared(line, 'light').get('--ha-switch-background-color')).toBe(
      line.light.line?.inset,
    );
  });

  it('is flat: no stop of its mesh moves off its page, on a view, a wall or the screensaver', () => {
    for (const mode of PALETTE_MODES) {
      const look = declared(line, mode);
      for (const stop of [
        'mesh-1',
        'mesh-2',
        'mesh-3',
        'mesh-wall-1',
        'mesh-wall-2',
        'mesh-wall-3',
      ])
        expect(look.get(`--fluvy-${stop}`), stop).toBe(line[mode].surface.page);
      expect(declared(fill, mode).get('--fluvy-mesh-2')).not.toBe(fill[mode].surface.page);
    }
  });

  it('leaves a palette set off by its fill none of it: the three names are declared empty', () => {
    for (const mode of PALETTE_MODES) {
      const look = declared(fill, mode);
      for (const name of ['--fluvy-edge', '--fluvy-inset', '--fluvy-shade'])
        expect(look.get(name), name).toBe('initial');
      expect(look.has('--app-header-border-bottom')).toBe(false);
      expect(look.get('--fluvy-shadow-lift')).toMatch(/^0 16px 40px/);
    }
  });

  it('washes a card of its own colour’s inner fills over the inset, not over the page', () => {
    for (const mode of PALETTE_MODES) {
      const seed = seedOf({ ...EINK, surface: 'line' });
      const family = accentFamily(seed, line[mode], '#3f51b5');
      // the same wash a fill surface gives: the inset is the colour the page was (light), the card was (dark)
      const own = surfaceInset(family, line[mode]);
      expect(own).not.toBe(line[mode].surface.page);
      if (mode === 'light')
        expect(own).toBe(
          surfaceInset(accentFamily(seedOf(EINK), fill.light, '#3f51b5'), fill.light),
        );
    }
  });

  it('is the E-ink palette’s, and no other shipped palette’s', () => {
    const eink = COMMUNITY_PALETTES.find((entry) => entry.name === 'e-ink');
    expect(eink?.palette.surface).toBe('line');
    for (const entry of COMMUNITY_PALETTES.filter((other) => other.name !== 'e-ink'))
      expect(entry.palette.surface, entry.name).toBeUndefined();
    for (const name of PALETTE_NAMES) {
      const palette = derivePalette(seedOf(name));
      for (const mode of PALETTE_MODES) expect(palette[mode].line, name).toBeUndefined();
    }
  });
});
