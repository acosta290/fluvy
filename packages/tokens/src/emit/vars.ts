import { composite } from '../color/contrast.js';
import { cssVar, DEFAULT_MODE, DEFAULT_PALETTE, PALETTE_TOKEN } from '../config.js';
import type { AccentFamily } from '../build/derive/accent.js';
import {
  DEFAULT_PILL,
  DEFAULT_SHAPE,
  PILLS,
  type PillName,
  type ShapeName,
} from '../scales/radius.js';
import {
  density,
  duration,
  easing,
  fontFamily,
  fontSize,
  fontWeight,
  iconBox,
  lineHeight,
  numericVariant,
  SHAPES,
  spacing,
  SPACING_STEPS,
} from '../scales/index.js';
import { haModeVars } from '../ha/groups.js';
import {
  RAMP_STEPS,
  SEMANTIC_ROLES,
  STATE_KEYS,
  type Palette,
  type PaletteModeColors,
} from '../types.js';

/**
 * The brand names only some palettes write: a solid primary's edge, and a highlight's mark. A look applied inside
 * another (the settings panel wearing the look being chosen, a dashboard inside a themed page) declares them empty
 * when it has none, so nothing of the outer look's shows through.
 */
export const OPTIONAL_BRAND_VARS: readonly string[] = [
  cssVar('primary-edge'),
  cssVar('mark'),
  cssVar('on-mark'),
  cssVar('mark-edge'),
];

export type CssDeclaration = readonly [name: string, value: string];

export interface VarGroup {
  readonly title: string;
  readonly declarations: readonly CssDeclaration[];
}

/**
 * Mode-independent tokens: shape, rhythm, type and motion. Emitted once on `:root`
 * so a palette switch never re-declares them.
 */
export function scaleVars(
  shape: ShapeName = DEFAULT_SHAPE,
  pill: PillName = DEFAULT_PILL,
): readonly VarGroup[] {
  const radius = { ...SHAPES[shape], pill: PILLS[pill] };
  return [
    {
      title: 'Spacing — 4px base grid',
      declarations: [
        ...SPACING_STEPS.map((step): CssDeclaration => [cssVar(`space-${step}`), spacing[step]]),
        [cssVar('pad-comfortable'), density.comfortable.padding],
        [cssVar('gap-comfortable'), density.comfortable.gap],
        [cssVar('pad-compact'), density.compact.padding],
        [cssVar('gap-compact'), density.compact.gap],
      ],
    },
    {
      title: 'Radius',
      declarations: [
        ...Object.entries(radius).map(([name, value]): CssDeclaration => [
          cssVar(`radius-${name}`),
          value,
        ]),
        [cssVar('icon-box-size'), iconBox.size],
        [cssVar('icon-box-radius'), `var(${cssVar('radius-control')})`],
      ],
    },
    {
      title: 'Typography',
      declarations: [
        [cssVar('font-sans'), fontFamily.sans],
        [cssVar('font-mono'), fontFamily.mono],
        ...Object.entries(fontSize).map(([name, value]): CssDeclaration => [
          cssVar(`text-${name}`),
          value,
        ]),
        ...Object.entries(fontWeight).map(([name, value]): CssDeclaration => [
          cssVar(`weight-${name}`),
          value,
        ]),
        ...Object.entries(lineHeight).map(([name, value]): CssDeclaration => [
          cssVar(`leading-${name}`),
          value,
        ]),
        [cssVar('numeric'), numericVariant],
      ],
    },
    {
      title: 'Motion',
      declarations: [
        ...Object.entries(duration).map(([name, value]): CssDeclaration => [
          cssVar(`duration-${name}`),
          value,
        ]),
        ...Object.entries(easing).map(([name, value]): CssDeclaration => [
          cssVar(`ease-${name}`),
          value,
        ]),
      ],
    },
  ];
}

/** Which palette this is, in both modes alike: what a card reads to derive its own colour on this very palette. */
export function identityVars(palette: Pick<Palette, 'key'>): readonly VarGroup[] {
  return [{ title: 'Identity', declarations: [[PALETTE_TOKEN, palette.key]] }];
}

/**
 * What a card's own colour redefines inside it: the accent's seven, the ink on the solid accent, the primary
 * action, the highlight where the palette has none of its own, the accent ramp, the twelve graph series and the
 * lit light (the accent's twin) — and nothing else: surfaces, text, the neutral ramp, the other states, the marks
 * and every Home Assistant name stay the palette's.
 */
export function accentFamilyVars(
  family: AccentFamily,
  colors: PaletteModeColors,
): readonly CssDeclaration[] {
  const wash =
    colors.fillStyle === 'solid'
      ? composite(family.fill, colors.washBase, colors.washShare)
      : family.fill;
  return [
    [cssVar('text-on-accent'), family.onAccent],
    [cssVar('accent'), family.ink],
    [cssVar('accent-hover'), family.hover],
    [cssVar('accent-text'), family.text],
    [cssVar('accent-fill'), family.fill],
    [cssVar('accent-fill-border'), family.fillBorder],
    [cssVar('accent-wash'), wash],
    [cssVar('accent-on-fill'), family.onFill],
    [cssVar('primary'), family.primary.fill],
    [cssVar('primary-hover'), family.primary.hover],
    ...(colors.fillStyle === 'solid' && colors.mode === 'light'
      ? ([[cssVar('primary-edge'), family.fillBorder]] as const)
      : []),
    [cssVar('on-primary'), family.primary.on],
    ...(colors.mark
      ? []
      : ([
          [cssVar('highlight'), family.ink],
          [cssVar('highlight-fill'), family.fill],
          [cssVar('highlight-fill-border'), family.fillBorder],
          [cssVar('highlight-on-fill'), family.onFill],
        ] as const)),
    ...RAMP_STEPS.map((step): CssDeclaration => [cssVar(`accent-${step}`), family.ramp[step]]),
    ...family.graph.map((hex, index): CssDeclaration => [cssVar(`graph-${index + 1}`), hex]),
    [cssVar('state-light-active'), family.ink],
    [cssVar('state-light-active-fill'), family.fill],
    [cssVar('state-light-active-fill-border'), family.fillBorder],
    [cssVar('state-light-active-on-fill'), family.onFill],
  ];
}

/** The brand layer: every colour the product owns, complete for one palette × mode. */
export function brandColorVars(colors: PaletteModeColors): readonly VarGroup[] {
  return [
    {
      title: 'Surfaces',
      declarations: [
        [cssVar('page'), colors.surface.page],
        [cssVar('page-alt'), colors.surface.pageAlt],
        [cssVar('card'), colors.surface.card],
        [cssVar('card-elevated'), colors.surface.cardElevated],
        [cssVar('border'), colors.surface.border],
        [cssVar('border-strong'), colors.surface.borderStrong],
      ],
    },
    {
      // what lifts off the page (menus, popovers, the dial's disc) and the knob's own drop; dark needs a deeper shadow to read at all
      title: 'Elevation',
      declarations: [
        // black at an alpha, written as #rrggbbaa: the one colour notation every reader of the theme parses
        [
          cssVar('shadow-lift'),
          colors.mode === 'dark'
            ? '0 16px 40px -16px #000000cc, 0 2px 6px -2px #00000066'
            : '0 16px 40px -16px #00000059, 0 2px 6px -2px #0000001f',
        ],
        [
          cssVar('shadow-knob'),
          colors.mode === 'dark' ? '0 4px 10px -2px #00000099' : '0 4px 10px -2px #00000040',
        ],
      ],
    },
    {
      title: 'Text',
      declarations: [
        [cssVar('text'), colors.text.primary],
        [cssVar('text-secondary'), colors.text.secondary],
        [cssVar('text-disabled'), colors.text.disabled],
        [cssVar('text-on-accent'), colors.text.onAccent],
      ],
    },
    {
      title: 'Accent',
      declarations: [
        [cssVar('accent'), colors.accent.ink],
        [cssVar('accent-hover'), colors.accent.hover],
        [cssVar('accent-text'), colors.accent.text],
        [cssVar('accent-fill'), colors.accent.fill],
        [cssVar('accent-fill-border'), colors.accent.fillBorder],
        [cssVar('accent-wash'), colors.accent.wash],
        [cssVar('accent-on-fill'), colors.accent.onFill],
      ],
    },
    {
      title:
        'Roles — where you are, the primary action, you and today; how a resting icon circle and a solid fill are drawn',
      declarations: [
        [cssVar('selected'), colors.selected.fill],
        [cssVar('on-selected'), colors.selected.on],
        [cssVar('primary'), colors.primary.fill],
        [cssVar('primary-hover'), colors.primary.hover],
        // a solid primary is a light disc: on a white card in light mode it draws its edge (Noir's lime is 1.16:1)
        ...(colors.fillStyle === 'solid'
          ? ([
              [
                cssVar('primary-edge'),
                colors.mode === 'light' ? colors.accent.fillBorder : 'transparent',
              ],
            ] as const)
          : []),
        [cssVar('on-primary'), colors.primary.on],
        ...(colors.mark
          ? ([
              [cssVar('mark'), colors.mark.fill],
              [cssVar('on-mark'), colors.mark.on],
              // a lime mark on a white card in light mode draws its edge, as a solid primary does
              [
                cssVar('mark-edge'),
                colors.mode === 'light' ? colors.highlight.fillBorder : 'transparent',
              ],
            ] as const)
          : []),
        [cssVar('wash'), `${Math.round(colors.washShare * 100)}%`],
        [cssVar('wash-base'), colors.washBase],
        // on a solid fill, what sits on it (a switch, a ruler, a label) takes the fill's own ink: 100 %; 0 % keeps the tint's
        [cssVar('solid'), colors.fillStyle === 'solid' ? '100%' : '0%'],
        // an electric palette's placeholders (an avatar, an artwork) are its primary; 0 % keeps the soft line's sphere
        [cssVar('electric'), colors.character === 'vivid' ? '100%' : '0%'],
      ],
    },
    {
      title: 'Highlight — the second brand colour (the accent where a palette has none)',
      declarations: [
        [cssVar('highlight'), colors.highlight.ink],
        [cssVar('highlight-fill'), colors.highlight.fill],
        [cssVar('highlight-fill-border'), colors.highlight.fillBorder],
        [cssVar('highlight-on-fill'), colors.highlight.onFill],
      ],
    },
    {
      title: 'Ramps (higher number = lighter)',
      declarations: [
        ...RAMP_STEPS.map((step): CssDeclaration => [
          cssVar(`neutral-${step}`),
          colors.neutralRamp[step],
        ]),
        ...RAMP_STEPS.map((step): CssDeclaration => [
          cssVar(`accent-${step}`),
          colors.accentRamp[step],
        ]),
      ],
    },
    {
      title: 'Status',
      declarations: SEMANTIC_ROLES.flatMap((role): CssDeclaration[] => {
        const value = colors.semantic[role];
        return [
          [cssVar(role), value.ink],
          [cssVar(`${role}-fill`), value.fill],
          [cssVar(`${role}-fill-border`), value.fillBorder],
          [cssVar(`${role}-on-fill`), value.onFill],
        ];
      }),
    },
    {
      title: 'Domain states',
      declarations: STATE_KEYS.flatMap((key): CssDeclaration[] => {
        const value = colors.state[key];
        return [
          [cssVar(`state-${key}`), value.ink],
          [cssVar(`state-${key}-fill`), value.fill],
          [cssVar(`state-${key}-fill-border`), value.fillBorder],
          [cssVar(`state-${key}-on-fill`), value.onFill],
        ];
      }),
    },
    {
      title: 'Unavailable — neutral ink at 70%, dashed hairline, never red',
      declarations: [
        [cssVar('unavailable'), colors.unavailable.ink],
        [cssVar('unavailable-border'), colors.unavailable.border],
        [cssVar('unavailable-border-style'), 'dashed'],
      ],
    },
    {
      title: 'Graph series',
      declarations: colors.graph.map((hex, index): CssDeclaration => [
        cssVar(`graph-${index + 1}`),
        hex,
      ]),
    },
  ];
}

/** One palette × mode as the theme writes it: the brand layer, then Home Assistant's names (`../ha/groups.ts`). */
export function allPaletteVars(colors: PaletteModeColors): readonly VarGroup[] {
  return [...brandColorVars(colors), ...haModeVars(colors)];
}

/** The palette × mode that `:root` falls back to when no data attributes are present. */
export function defaultColors(palettes: readonly Palette[]): PaletteModeColors {
  const palette = palettes.find((entry) => entry.name === DEFAULT_PALETTE);
  if (palette === undefined) {
    throw new Error(`Default palette "${DEFAULT_PALETTE}" is not in the registry`);
  }
  return palette[DEFAULT_MODE];
}
