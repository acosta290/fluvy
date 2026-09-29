# Changelog

All notable changes to Fluvy are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Five automatic dashboards, each a template and a strategy of its own: **Home** (the dashboard of before, with a
  Rooms view when the house has two rooms with something in them, and a page per room), **Rooms** (a tab a floor,
  a card a room), **Energy** (now, production, devices, meters), **Security** (the alarm, the cameras, the openings
  room by room) and **Wall** (two columns for a tablet, without tabs). The panel's *Dashboards* tab lists them,
  creates any with one tap, edits each one's options apart, lists it in the sidebar or not, and recreates it in two
  taps; the settings file carries every dashboard's options.
- Two cards, forty-one in all: **Room** — an area as the approved area card (its photo under the name pill, its
  temperature, humidity and how many devices are on, its lights, climate, media and devices as rows or as inner
  tiles; as a tile, or as a compact row) — and **Map** — where everyone is, as columns of zones with the faces in
  each (two, then a "+N" disc), as rows, or as Home Assistant's own map on a plate.
- Wall mode for a tablet on the wall: no sidebar, no header, the screen kept awake, a screensaver with the clock (or
  black) after a while that any touch or a motion sensor wakes, day and night by Home Assistant's mode, the sun or
  a pair of hours with a night veil, the wall mesh behind the cards. The house sets it in the panel's *Wall* tab,
  whose preview shows the wall as it would be now (its night included) and which shows the screensaver itself on a
  tap; the tablet becomes a wall with `?kiosk` on the address (or the tab's switch) and remembers; a hold of the
  top-right corner pauses it. Everything of the wall loads only on a device that is one.
- Palettes that travel: a custom palette shared as a file (`<name>.fluvy-palette.json`) with a title and an author,
  read back onto the gallery, saved to the house (twelve, under *Yours*) or removed; the palettes the community has
  contributed ship under *Community* with their authors. A draft that equals one of them is that palette.
- Turkish (`tr`): the eighth language, in every card, page, dialog and editor form, with the words the automatic
  dashboards read a Turkish-named house by.
- Every card under one editors' contract: what to show (`show_*`), which items and in which order (subset lists
  with Fluvy's rows editor), at least one other layout (`variant`), the chip rows filling by default
  (`<x>_style: full | chips`), a `tap_action` and a `hold_action` (a still press on the head) on every entity card,
  a `tone` and a `color` on the card and on each item, `unknown` drawn as a live surface. New variants: compact cover,
  fan, vacuum, lock and alarm (144 tall), a camera tile, a gauge bar, compact energy and production, distribution
  rows, readouts grid, a plain heading, compact entities, the clock's face and layout apart, the calendar's
  calendars as items.
- Colour per card: every card takes a `color` — one of Home Assistant's colour names (`teal`, `deep-orange`…) or
  any `#rrggbb` — that stands in for the palette's accent inside it: its chart, its lit light, its icon circle,
  its dial. The colour is derived on the very palette the card wears, in light and in dark, through the same
  arithmetic that makes the palette (its ink readable on the card, its fill legible under its ink, twelve graph
  series apart), so a red card on Linen is Linen's red. The editor offers Home Assistant's colour picker, whose
  swatches show the palette's colours. Device tones (a fan, a heater, a speaker) keep their own.
- The dropdown: the cards' text field as a button, opening its list in the browser's top layer — over Home
  Assistant's sidebar and dialogs — under the field, or over it near the foot of the page, as wide as the field;
  keys, letters and the pointer as a native select's, a hint beside each name, the chosen row marked. The
  Preferences tab's language is the first to use it (eight chips before): *Automatic* with the language it
  resolves to, then Fluvy's languages by their own names with the English name beside.
- Preferences: a *Help improve this translation* row that opens the translating guide.
- View backgrounds: the wall mesh (`--fluvy-mesh-*`), derived from the palette's own page colour.

### Changed

- The cards' options share one vocabulary: `subtitle` (`sub`, `meta` before), `variant` (`layout`, `view`),
  `hours` (`trend_hours`), `color` (`accent`), `name` on an entity card (`title` before on the to-do, energy and
  production cards), `show_*` for every switch (`hide_completed` before), `calendars` as items on the calendar
  (`entities` + `tones`). Every older name is still read, for good; it is never written back.
- The settings are version 2: the house keeps its shared palettes and its wall. A house that goes back to 1.2 keeps
  them unread; a 1.2 save keeps what it does not know once the house has been saved by 1.3.
- The panel has six tabs — *Dashboards* (it was *Dashboard*) and *Wall* are new.
- The automatic dashboards' strategy, the wall, the community palettes and the cards' visual editor load on demand
  (their own chunks); a dashboard page pays only for the cards. The automatic dashboards cut their columns by every card's declared
  height, measured at a phone's column — the layouts are level where the old table left them uneven.
- The theme's named colours follow the tone Home Assistant gives each: pink is the armed alarm's rose, cyan the
  water, teal the presence green, lime the dehumidifier's green, light green the battery, deep purple the house,
  brown the gas (it was the accent). Every surface Home Assistant paints through them moves with them.
- The theme says which palette it is (`--fluvy-palette`), and so does a look applied live.
- Card editors: the choices of a dropdown (a variant, a forecast, a first weekday…) and the tones are said in the
  dashboard's language; they were English words whatever the language.
- A compact tile inside a card (a room's controls) is an inner tile: 84 tall, the control radius, the page's fill,
  no hairline; off, its icon circle is the card's fill with the text ink. The state line on an on-fill is the fill's
  ink at 80 % (4.5:1 on every palette; the palette gates hold it).
- The docs' card tables are generated from the code (`pnpm docs:cards`), and the release refuses a chunk over its budget.

### Fixed

- Tiles: a mini tile is never narrower than 84 px (a group asked for more columns lays out fewer), so its icon
  circle is always the 44 of every other tile; a small tile's state line is fitted to the tile — "Open · 40 %"
  loses its figure before it is cut, and an unavailable tile shows "—" where the word cannot fit — and a large
  unavailable tile drops its "· 11 days ago" the same way. A compact tile's icon left under 160 px, not under 128:
  the size queries measured the content box.
- Energy flow, gauge, bars and the other chart cards: in a column too narrow for the icon circle and the title,
  the circle goes and the title stays whole (a typed title may end in an ellipsis, as a name does). The energy
  card's curve draws in the card's colour again (its chart lacked a tone carrier).
- The cards' words arriving in a new language refreshed every card twice.
- The dropdown's list, once it scrolls (nine languages), was a tab stop of its own.
- The docs said "five tabs", listed the automatic dashboard's options without `weather` and `language`, and gave
  the Security view a rule it does not follow (it needs an alarm, a lock, a camera or a gate).

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
