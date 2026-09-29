# The theme

Fluvy's theme is generated, not written: one set of design tokens (`packages/tokens`) is derived into the theme file
Home Assistant reads, the CSS the cards are drawn with, and the look engine that recolours everything live. What you
see in a card and in a Home Assistant dialog comes from the same numbers.

## The file

`themes/fluvy/fluvy.yaml`, installed by the integration, holds one theme, **Fluvy**, with a light and a dark mode;
Home Assistant decides which mode from your profile (light, dark, or the system's). The file carries the default
look, Linen; every other palette and shape is applied on top of it by the panel, live, without a reload — the theme
file is what paints the first frame and what Home Assistant's own dialogs and pages follow.

## Palettes

Fifteen presets in two lines, each with a light and a dark mode that are derived, not inverted:

- **pastel** — Linen (the default), Sand, Sage, Mist, Clay, Slate, Harbour, Dusk, Ember (designed dark first);
- **electric** — Blaze, Flamingo, Iris, Volt, Mint, Noir (dark first).

Or a **custom** accent: a base (warm, neutral or cool), an accent colour, an optional highlight and a fill (tint or
solid). Every palette — preset or custom — goes through the same generator and the same contrast gates: text at
4.5:1 at least, icons and large text at 3:1, cards separated from the page and from their borders. An accent that
cannot carry text at 4.5:1 gets a darker ink for text and keeps its full colour for icons and charts.

## Share a palette

A custom palette travels as a file. In the panel's *Appearance* tab, with a custom accent chosen, the *Share* card
takes a title and an author and writes `<name>.fluvy-palette.json`; *Import a palette* reads one back onto the
gallery, where it is the palette chosen. An administrator may **save** it to the house's palettes — up to twelve,
shown under *Yours* in every browser of the house — or remove it. The palettes the community has contributed ship
with Fluvy under *Community* (six shown, *Show all* for the rest), each with its author beside it; a draft that equals
one of them is that palette, not "Custom". [How to contribute one](../CONTRIBUTING.md#contributing-a-palette).

## Shape and buttons

Three shapes set the radii of cards, tiles and controls: **soft** (20 / 16 / 12 px, the default), **round**
(28 / 22 / 16) and **crisp** (14 / 12 / 8). Circles and the rulers' 2 px lines never change. The buttons' style
(pills or crisp) follows the same setting.

## Using the theme on its own

The theme works without the cards: choose it in your profile and every Home Assistant page takes Fluvy's colours,
type and radii. The cards, the shell and the pages need the integration; the theme alone is a theme.

## Tokens for your own cards

Every colour, radius and spacing Fluvy uses is a custom property, `--fluvy-*`, set on the page while the look is
applied (and on Fluvy's dashboards when the scope is "only dashboards"). A card of your own that reads
`var(--fluvy-accent)` or `var(--fluvy-card)` follows the palette; the full list is what `packages/tokens` emits
(`pnpm build` writes it to `packages/tokens/dist/`). Home Assistant's own variables (`--primary-color`,
`--card-background-color`, the `--ha-color-*` scales, the state colours, the chart colours) are all set by the theme
file, so anything themed the Home Assistant way follows too.
