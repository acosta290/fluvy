# Changelog

All notable changes to Fluvy are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The dropdown: the cards' text field as a button, opening its list in the browser's top layer — over Home
  Assistant's sidebar and dialogs — under the field, or over it near the foot of the page, as wide as the field;
  keys, letters and the pointer as a native select's, a hint beside each name, the chosen row marked. The
  Preferences tab's language is the first to use it (eight chips before): *Automatic* with the language it
  resolves to, then Fluvy's languages by their own names with the English name beside.
- Preferences: a *Help improve this translation* row that opens the translating guide.
- Colour per card: every card takes a `color` — one of Home Assistant's colour names (`teal`, `deep-orange`…) or
  any `#rrggbb` — that stands in for the palette's accent inside it: its chart, its lit light, its icon circle,
  its dial. The colour is derived on the very palette the card wears, in light and in dark, through the same
  arithmetic that makes the palette (its ink readable on the card, its fill legible under its ink, twelve graph
  series apart), so a red card on Linen is Linen's red. The editor offers Home Assistant's colour picker, whose
  swatches show the palette's colours. Device tones (a fan, a heater, a speaker) keep their own.

### Changed

- The theme's named colours follow the tone Home Assistant gives each: pink is the armed alarm's rose, cyan the
  water, teal the presence green, lime the dehumidifier's green, light green the battery, deep purple the house,
  brown the gas (it was the accent). Every surface Home Assistant paints through them moves with them.
- The theme says which palette it is (`--fluvy-palette`), and so does a look applied live.

- Card editors: the choices of a dropdown (a variant, a forecast, a first weekday…) and the tones are said in the
  dashboard's language; they were English words whatever the language.

### Fixed

- Tiles: a mini tile is never narrower than 84 px (a group asked for more columns lays out fewer), so its icon
  circle is always the 44 of every other tile; a small tile's state line is fitted to the tile — "Open · 40 %"
  loses its figure before it is cut, and an unavailable tile shows "—" where the word cannot fit — and a large
  unavailable tile drops its "· 11 days ago" the same way.
- Energy flow, gauge, bars and the other chart cards: in a column too narrow for the icon circle and the title,
  the circle goes and the title stays whole (a typed title may end in an ellipsis, as a name does).
- The cards' words arriving in a new language refreshed every card twice.

## [1.2.1] — 2026-09-28

### Removed

- The swipe between a dashboard's views (1.2.0). Home Assistant draws one view at a time, so the arriving view
  could only appear once it was on the page — a slide out, a gap, a slide in — and rendering the neighbouring
  view ourselves proved neither light nor safe. A gesture that cannot show what is coming is worse than none;
  the tabs stay, and the *Swipe between views* preference goes with it.

## [1.2.0] — 2026-09-27

### Added

- Swipe between a dashboard's views on a phone: the view follows the finger, and letting go past a third of the
  width (or a flick) opens the next tab, which slides in from the finger's side. A drag that begins on a ruler, a
  dial, a slider, a scrolling row of chips or a map is theirs; a drag that leans vertical stays a scroll; the
  screen's edges are left to the system. Each person's to turn off in Preferences → *Swipe between views*.
- German, Dutch, French, Italian and Brazilian Portuguese, for every card, page and the settings panel, chosen in
  Preferences or taken from Home Assistant's language. One catalogue per language, fetched only when spoken; the
  automatic dashboard reads a house named in any of them.

## [1.1.2] — 2026-09-27

### Added

- Tiles card: each tile's readouts are chosen in the editor (a plug's power, its energy today, its cost); a wide
  tile shows three, a narrower one two. A sensor whose device class is monetary is labelled Cost.
- Light card: half a section is enough. Under 260 px of content (or `variant: compact`) the card keeps its head,
  with the level in the state line, and the brightness ruler alone, so two lamps share a line; the layout editor
  lets it go down to six columns (it stopped at nine).

## [1.1.1] — 2026-09-27

### Changed

- The demo opens in the light mode on Blaze, and lays its frames out in lanes filled by height: nothing overlaps,
  nothing is left hanging.

### Fixed

- Settings: the first card sits 16 px under the toolbar on a desktop too (it touched it).

## [1.1.0] — 2026-09-27

### Added

- A public demo at https://acosta290.github.io/fluvy/: the real cards, pages and settings panel on the simulated
  home, with the palette, mode, device and language changed live; deployed by `pages.yml` on every push to `main`.
- Motion clips in the README: the precision dimmer, the energy flow changing pace, a palette applied in the settings
  panel, a scrub across the History charts. `pnpm clips` records them on the playground (`tools/render/clip.mjs`)
  with the gestures the interaction suites prove.
- The settings panel's Dashboard tab lists Fluvy auto in Home Assistant's sidebar, or takes its entry out (an
  administrator's switch).

### Changed

- Activity: the icons sit 4 px clear of the timeline's spine, as the dots already did.
- The interaction suites and the clips share one gestures module (`tools/render/lib/gestures.mjs`).

### Fixed

- The documentation counts fifteen palettes (there was never a Cobalt), lists the automatic dashboard's options as
  the code has them (`dial | compact | ruler`, `ribbons | rail | legs`, eight views) and no longer mentions an
  Activity card that does not exist; CI measures the two devices sheets by their names.

## [1.0.2] — 2026-09-27

### Changed

- The README shows the whole product: the app with the sidebar and tabs, three galleries of cards, the two
  pages, the four tabs of the settings panel.


## [1.0.1] — 2026-09-27

### Changed

- The HACS listing says what Fluvy is: "Fluvy - Premium Theme & Cards", so a search for a theme finds it.
- The README renders inside HACS as well: absolute image URLs, no `<picture>` element.
- The licence badge is static, so it never depends on a cache.

### Removed

- The files prepared for Home Assistant's brands repository, which no longer takes custom integrations; the
  integration serves its own icon.


## [1.0.0] — 2026-09-27

The first public release.

### Added

- The Fluvy theme: one generated theme, light and dark, written from the same tokens the cards use.
- Thirty-nine cards for lights, climate, energy, media, security, calendar, clocks, helpers, people, weather and
  more, each with an editor form and a picker preview.
- The automatic dashboard (`strategy: { type: custom:fluvy-home }`): Home, Lights, Climate, Energy, Media and
  Sensors built from the registries and the energy preferences.
- The settings panel in the sidebar: sixteen palettes in a pastel and an electric line or a custom accent, three
  shapes, where the look applies, per-person preferences, applied live.
- The Activity and History pages, replacing Home Assistant's logbook and history pages while the house wants them.
- The shell: Home Assistant's own pages (Settings, dialogs, forms, the sidebar) in the same design while the
  Fluvy theme is worn.
- The integration (`custom_components/fluvy`): installs through HACS, serves the build, loads it on every page,
  registers the panel and the Lovelace resource, installs the theme, and says through Repairs what only you can do.
- English and Spanish.

[Unreleased]: https://github.com/acosta290/fluvy/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/acosta290/fluvy/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/acosta290/fluvy/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/acosta290/fluvy/releases/tag/v1.0.0
