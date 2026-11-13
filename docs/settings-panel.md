# The settings panel

**Fluvy** in the sidebar, at `/fluvy`: six tabs, in one row. What belongs to the house is an administrator's to change;
everyone else reads it, and changes their own (a palette of their own, their preferences, this device).

| Tab | What it holds | Whose |
| --- | --- | --- |
| **Appearance** | palette (fifteen presets, the house's saved palettes, the community's, or a custom accent — shared as a file), shape (soft, round, crisp), button style, the dashboards' tabs (Fluvy, pills, original or hidden; names, icons or both; the dashboard's name), the sidebar and header (Home Assistant's logo, dividers, the header on the page), lines in the sidebar after the items chosen; the page behind the cards (plain, the palette's gradient, a colour or two, a picture — see [Background](#background)); the cards (how opaque, and the blur behind a see-through one), the sliders (the style every slider is drawn in), the lights, where a card says nothing, and the status colours (see below); a live preview on real cards (its little house answers a tap itself: nothing at home changes) | the house; a person may keep their own palette and shape |
| **Charts** | the style every chart is drawn in and the gauge every gauge reads in, each a tile the chart engine draws; what the style lets the house tune; motion; how much of the past every chart shows and how far apart a line's points stand; the series colours (the palette's six, or a set of the house's own, made and checked here); a preview of a chart, its bars and a gauge in both modes side by side — see [Charts](#charts) | the house |
| **Scope** | dashboards only or everywhere; which dashboards when "only"; the frame, our icons in the sidebar and in Settings (a switch each — see [Our icons](#our-icons)), the Activity page, the History page, our chart in the details dialog (see [the details dialog](pages.md#the-details-dialog)) | the house |
| **Dashboards** | the five automatic dashboards: create any with one tap, open it, its options (its background among them: the house's, or its own), its sidebar entry, recreate it | the house |
| **Wall** | what this device is (a wall panel or not, said for this browser, and its address to open on the tablet), which dashboards are walls, the screensaver (with a preview of it), the way out (a × in the corner, or a long press), the way back from a subview (a button with its name, or Home Assistant's header), day and night, the background (plain, the wall mesh, or the dashboard's own: the house's page background or the wall dashboard's); the preview shows the wall as it would be now, in its night when it is night — see [wall mode](wall.md) | the house; *this device* is the tablet's own |
| **Preferences** | language of the cards (a dropdown: *Automatic* follows Home Assistant, or one of Fluvy's), motion, hold to slide (see [Sliders](#sliders)), haptics, a link to improving a translation; *This device · Size*: how large this screen reads its dashboards (90 to 150 %, the view alone — see [wall mode](wall.md)); *This device · Performance*: Auto, Full or Lite (see [Lite](#lite)); *This device · Sidebar beside the page* (see [below](#sidebar-beside-the-page)); *Fluvy*: the version, the shell's health, export and import of the settings, the house's reset | each person; *this device* is the screen's own; import and reset are an administrator's |

## House and person

The **house settings** are what an administrator sets: everyone sees them. The **personal settings** are each person's,
on every device they sign in on: a palette, a shape and tabs of their own, or the house's; language; motion; hold to
slide; haptics. The look a person sees is the house's, with their own choices on top. A **device setting** belongs to
one browser alone — whether it is a wall panel, the size it reads at, how hard it works (Lite) and how its sidebar
opens — and never follows a person.

## Background

What lies behind the cards of every dashboard that wears the look (1.19, Discussion #155; `background` in the house's
data). From the factory it is **Plain**, the page's own colour, as every page was: nothing changes on upgrade. Four
tiles choose the kind, and under them only that kind's rows:

| Kind | Rows | What the page draws |
| --- | --- | --- |
| **Plain** | — | the page's colour, as before |
| **Gradient** | — | the palette's own gradient: three soft stains in the page's hue over its colour (the wall mesh's family), in either mode |
| **Colour** | *Colour* (a hex, or the system's picker); *Two colours* on: *Second colour* | the colour, or a gradient from the first at the top to the second; in dark mode a pale colour is taken to the dark page's lightness (its hue kept), a deep one stays as it is |
| **Image** | *Picture*: a path of Home Assistant's (`/local/backgrounds/garden.jpg`, a file in `config/www/backgrounds/`) or a web address; *Dim*, 0 to 80 % in 5 % steps (40 by default), on a ruler; *Blur* (off by default) | the picture covering the view, held still while the page scrolls, taken towards the page's colour by its dim (towards light in light mode, towards dark in dark mode) so the words on the page read, and out of focus where asked |

The words that stand on the page — the greeting, a section's heading, the header when it is on the page's colour — take
the light ink on a deep colour, as a filled tile's do; the cards keep their own. A picture's address is checked before it
reaches the page: a path that starts with one `/`, or an `http` or `https` address, with no spaces, quotes, parentheses,
backslashes, semicolons, braces, angle brackets or invisible characters such as a zero-width space (a file name with a
space is written `%20`); `data:` and every other scheme are refused, and so is a name or a password before the host
(`https://user:pass@…`), which a browser never sends for a picture. One it cannot draw turns the field's words to the
warning, and nothing is kept.

The header on the page's colour (Appearance › Corner) lets the background through, frosted (a colour's header is the
colour itself); a header as a bar stays a bar. The background holds under the tabs, beside the sidebar and inside the
floating frame, in a subview and in the edit mode, and it never moves while the page scrolls: it is one layer of its
own, painted once. A view or a dashboard with a background of its own in Home Assistant's settings keeps it. On a wall
the wall's own choice wins (Wall › Background): plain or the mesh, unless it is *As the dashboard*. Fluvy's own pages
(Activity, History, this panel) and Home Assistant's own pages stay plain.

An automatic dashboard may have its own (Dashboards › its card › *Background*: *As the house*, or *Its own* with the same
four kinds), saved in its strategy as `background` ([the dashboard's options](automatic-dashboard.md)). The house's and
each dashboard's travel in the settings file, and in Home Assistant's backups with the rest of the house's settings.

## Cards

How solid every card is, whether it draws its border, how one looks while a device is unavailable, and whose details
it opens, where a card says nothing of its own (1.15, 1.19, 1.16, 1.20). Solid, bordered and dashed until chosen, so a
dashboard looks as it did; Fluvy's details sheets are on from 1.20, where Home Assistant's dialog opened before:

| Setting | Values | What a card takes from it |
| --- | --- | --- |
| **Opacity** | 0 to 100 %, in 5 % steps, on a ruler with its figure beside it (100: solid) | `card_opacity`: under 100 the view's background shows through the card |
| **Blur what shows through** | on · off (on by default) | what shows through a see-through card is blurred, so its words read over a busy picture; it covers every see-through card, the house's and one that sets its own `card_opacity` |
| **Border** | on · off (on by default) | `card_border`: off, a card draws no border, the hairline round it — round each tile where the card is a tile or a group of them — so it stands on its fill alone, or on its content alone where it is see-through at 0 % |
| **Fluvy's details sheets** | on · off (on by default) | whose details a `more-info` opens for a light, a thermostat (a climate, a water heater, a humidifier), a cover or a valve, a media player and a fan: Fluvy's own [sheet](cards.md#details-sheets), or, off, Home Assistant's dialog as for every other entity. An action's own `details: fluvy` or `details: home-assistant` wins. Stored as `sheets: fluvy` or `sheets: home-assistant` |
| **When unavailable** | Dashed · As when off (Dashed by default) | `unavailable`: `dashed` draws a card or a tile out of reach on the page's fill in a dashed hairline, its words faded and the ⊘ glyph in its circle; `quiet` (As when off) draws it as it is while off — its own surface, its own glyph, its words and controls at full strength — still saying "Unavailable", every value it cannot know a dash, every control still |

A change shows on every card of the page at once, before it is saved, and the preview stands its cards on a picture
while they are see-through; a card that sets `card_opacity` or `card_border` keeps its own (its editor shows the
house's until a value is chosen, and never writes it). It applies to every Fluvy card on a dashboard, a wall included, and to its preview in
the card editor and the card picker; not to Fluvy's own pages (Activity, History, this panel), nor to what opens from a
card (a sheet, a menu, a dialog), which stay solid. Home Assistant's own cards follow the theme's `ha-card-background`,
not this setting. A card that draws no surface (a heading, the greeting, the chips card's tabs, the web page card
`bare`) is unchanged.
Inside a see-through card its wells and washes go see-through with it, one material; a lit tile, a light card lit
whole, a switch's thumb and a knob keep their colour solid (a light's colour is what it says). Its quieter words (a
line under a name, a ruler's figures) darken in light mode and lighten in dark mode as the card goes see-through, and
from 50 % down they are written like its names, so they read on the background. Below about 35 % the background
decides what reads: in light mode pick a light picture, in dark mode a dark one.
Without its border a card loses only the hairline round its own surface, in whatever colour it wears (a `card_color`,
a lit tile): the tiles and wells inside it keep theirs, the ring of the keyboard's focus and a press stay, a tile under
the pointer still firms a hairline, and what opens from it is unchanged. A card out of reach in the dashed look keeps
its dashes, the only line that draws its shape on the page's fill; the quiet look draws it as it is while off,
without a border.

What shows through is the view's background: Home Assistant's *Background* in a view's settings (a picture, its size,
alignment and opacity), else the page's background chosen above (the dashboard's own, else the house's), else the
theme's `lovelace-background`, else the page's colour. Fluvy never paints over a view's own; on a wall the view's own
background shows, and the wall's (the mesh, the plain page, or the dashboard's) where the view has none.

Blur costs a tablet's graphics: on an older wall panel that scrolls slowly, turn it off (the cards stay see-through),
or set that tablet alone to [Lite](#lite).

## Sliders

The style every slider is drawn in where a card says nothing of its own (1.18, `sliders` in the house's data): the
light card's brightness and colour temperature, the Slider card, a large tile's ruler and a group's, the room's
brightness on the Lights card, the media card's volume, the fan's speed, the cover's position and a helper's number.
From the factory it is the **Ruler**, the slider every card drew before 1.18: nothing changes on upgrade. Each style
lives in the ruler's slot, so no card or tile changes height with it.

| Setting | Values (the factory's first) | What it draws |
| --- | --- | --- |
| **Style** | Ruler · Bar · Liquid · Fill | `slider_style` where a card names none (`house`): the **Ruler**, ticks by value lit from the origin to the knob, and the fine scale on a hold (1 % ticks); the **Bar**, Home Assistant's idea in the same slot, the track the inset ground, the fill the tone's ink and a 4 × 20 handle of the card's colour 8 inside its end (a colour temperature's is the gradient itself, the handle alone); the **Liquid**, the bar's slot with its fill as water, two slow waves at its edge that rest when motion is off (Charts › Motion, or the system's reduced motion); the **Fill**, a tile's: the whole tile is the slider, its lit wash reaching the level and stopping on a 2 px edge, the figure in its line and the foot free for its readouts. Fill acts on tiles (the tile card, the tiles card, the Slider card's tile); a card asked for it draws the ruler, and a card's editor offers it only where the card draws a tile |
| **Words under a bar or a liquid** | Ends and middle · None | `slider_words`: the figures under a bar or a liquid say the ends and the middle (a ruler says its own); none leaves the row empty, so no height moves |

Every style keeps the ruler's gestures: the drag is relative (grabbing never jumps the value), a finger drifting away
from the axis slows it to a tenth, the bubble reads the value while dragging, the keys step, page and go to the ends,
and a tap goes there. Only the Ruler holds still for the fine scale: a bar cannot zoom without lying about the level,
and a still press on a tile's fill is the tile's own (its tap, or its hold of 500 ms for the details). On a touch screen
the page's scroll comes first (#166): a finger that sets off across a slider (up or down the page past a ruler, a bar or
a fill) scrolls the page and leaves the slider where it was, a drag the browser takes for a scroll on its way sends
nothing, and the − and + of a stepper take their step as the finger lifts, so a scroll that starts on one steps nothing.
A change shows on every card of the page at once, before it is saved; a card that sets `slider_style` keeps its own (its
editor shows the house's until a value is chosen, and never writes it).

**Hold to slide** (*Preferences › Just for you*, 1.19, #166) is each person's, off from the factory, and acts on a touch
screen alone: a slider moves only after the finger has stood still on it for 200 ms. Meanwhile a ring of the slider's
ink closes round the knob (a bar's handle grows to 28, a liquid's handle surfaces at its level, a tile's fill takes the
ink along its edge from the middle); a finger that moves more than 10 px first is the page's scroll, and one lifted
before is a tap, which never moves a value (a tile's fill keeps its tap and its hold of 500 ms). Armed, the slider buzzes
and takes its drag look, and the finger is its whichever way it goes: the page stays still under it. On the Ruler the
fine scale comes 450 ms after the slider is armed, 650 ms after the press. It holds for every slider: the four styles,
the cover's position, the thermostat's dial, the room's hue wheel and the History page's time rail; with it on, the
dial's knob and the hue wheel let the page scroll from them too. A mouse and the keys never wait, and the steppers' −
and + stay taps.

**When unavailable** covers every card that shows a device: a tile, the tiles of a group (each may say its own: a
tile's `unavailable` in `tiles`), the light card, rows, rounds, chips, a room's tiles, an appliance's and a printer's
head, and the rest. As when off, only the look of being out of reach goes: the card keeps its size and its anatomy,
says "Unavailable", writes "—" for what it cannot know, and takes no tap where it cannot act. An entity that is not in
the house at all keeps the ⊘ glyph: it has no kind to borrow one from. A card that sets its own `unavailable` keeps it
(its editor shows the house's until one is chosen, and never writes it).

A card on a dashboard that opens in a see-through or an as-when-off house draws its first frame in that look, never
solid or dashed a moment before.

## Lite

*Preferences › This device › Performance* (1.19, #165): **Auto** (the factory's), **Full** or **Lite**, remembered by
the screen alone, so an old tablet can draw Lite while the phones do not. Lite turns down what exists, for that screen:
nothing is blurred behind a see-through card (it stays see-through) nor over a page's background (its picture stands
in focus and the header over it solid), no card enters as a view opens, every chart and gauge rests (a liquid on its
first frame), and motion is reduced as with *Reduce motion*, whatever the person chose.
Colours, sizes and what every card can do stay as they are, and the house's and the person's own settings are kept:
Full wears them again. **Auto** is Lite where the system asks for reduced motion, or where the browser says the device
has 2 GB of memory or less (Chromium's `navigator.deviceMemory`, which rounds 3 GB down to 2; Safari does not say, so
there Auto follows the motion alone).

## Sidebar beside the page

*Preferences › This device › Sidebar beside the page* (1.20, #173), for a tablet held sideways or any wide screen that
wants its width for the page: off from the factory and remembered by the screen alone, so a desktop keeps Home
Assistant's own way. On, the sidebar stays hidden until a menu button asks for it; it then stands beside the page,
which moves over for it, and the next tap of the menu hides it again. Without it, Home Assistant opens a hidden sidebar
as a drawer over the page, and folds an open one to its icons.

Every menu button asks: the header's, the sidebar's own, an app's (an add-on's panel) and a panel in a frame, by a tap,
a touch or the keyboard (Enter or Space). A long press on the sidebar's menu button still opens Home Assistant's *Edit
sidebar*. The two states are Home Assistant's own (*Profile › This browser › Always hide the sidebar*, and the sidebar
open), so the browser remembers the one it was left in, after the switch is turned off too. A phone (870 px wide or
less) keeps Home Assistant's drawer, and so do a kiosk, a wall and the companion app's own sidebar.

While the sidebar is hidden, every page has a menu button to bring it back, Fluvy's own pages too (the settings panel,
Activity, History). In the floating frame it stands where the sidebar's own menu button does, so the menu stays under
the finger as the sidebar comes and goes.

## Lights

Two of the house's settings (1.9) decide what a card of lights does where its own config says nothing. Both are off
until chosen, so a dashboard looks as it did:

| Setting | Values | What a card takes from it |
| --- | --- | --- |
| **Show their colour** | Never · When on · Always | a light card's `tint`: its light's colour on its whole surface, while the light is on, or at rest too |
| **In their bulb's colour** | off · on | `light_colors` on tiles, a tiles group, a room's tiles and rows, an entities card's rows: a lit bulb in its colour, a white in its warmth |

A change shows on every card of the page at once, before it is saved; a card that sets the key keeps its own. The
room lights card keeps its own default (its lights in their colours), and the automatic dashboards write neither.
How a white shows in its bulb's colour is each card's own (`light_whites`, 1.10): by its warmth, from a candle's to a
neutral daylight and a cool white, unless the card asks for the palette's lit light (`palette`); there is no house
setting for it.

## Status colours

Four of the house's settings (1.9) colour what a card says about the state of things, over every palette — a person's
own palette too:

| Status | What wears it |
| --- | --- |
| **Warning** | what wants a look: an open door or window, a low battery, a reminder due (an appliance's "Clean", "Refill"), an alert of severity warning, the warning tone a card or an item may be given |
| **Danger** | what is wrong now: a leak, smoke, a critical alert, the danger tone |
| **Success** | what is fine: an appliance ready, an eco programme, someone at home (the dot on their picture) |
| **Notice** | information: an alert of severity info |

Each is **Auto** — the palette's own, as before 1.9, so nothing changes on upgrade — or **Custom**: one of six colours
round the wheel (the orange is issue #47's), or any colour typed as a hex or picked from the system's picker. Fluvy
keeps the hue you picked and moves only its lightness — and the chroma the screen cannot show there — as far as it must
to read: the words in it at 4.5:1 on the card and the page, its icon at 3:1 on its circle, the words on its fill and
the fill's hairline as every status's. In light mode an orange like `#dc630b` (3.5:1 on white) becomes `#b04c00`
(5.4:1); in dark it is itself. From it come the status's whole family in both modes — its words, its icon, its fill,
the fill's edge and the ink on it — on every card and sheet, and in Home Assistant's own status colours
(`--warning-color`, `--error-color`, `--success-color` and their scales). Home Assistant's colour *names* (`orange`,
`red`, `green`) stay the palette's: a card asked for orange is still orange.

Where a picked colour sits too close to another status (warning, danger, success and notice stand 5.5 apart, CIEDE2000,
fill from fill and words from words, in light and in dark), Fluvy first takes more of its colour into its fill and
its words a step deeper; where that is not enough, the panel says so under it ("Close to Danger") and changes nothing
else — a hue is never turned aside. The settings are an administrator's (read-only for everyone else), shown on the
panel and the page at once, and saved from the bar ("Status colours · Warning · #dc630b").

## Charts

The house's chart settings (1.11, `charts` and `chartSets` in the house's data) decide how every chart and gauge is
drawn where a card's config says nothing — the sensor's chart and tile, and each chart card as it takes the styles;
the automatic dashboards and the History page write no chart key, so they follow the house too. From the factory the
style is **Classic**, the chart every card drew before 1.11: nothing changes on upgrade.

| Setting | Values (the factory's first) | What it draws |
| --- | --- | --- |
| **Style** | Classic · Soft · Glow · Minimal · Steps · Bars · Columns · Band | a card's `chart` where it names none; a style a card cannot draw (bars over several sensors, a band without one) is drawn Classic |
| **Gauge** | Ticks · Dial · Ring · Ruler · Liquid · Sky · Tank · Battery · Pulse · Air · Sun | a gauge's `gauge`: the dial's ticks, the thermostat's dial read, a ring lit to the value with Fluvy's knob at its end, the ruler read — every knob the thermostat's ball — or a gauge that moves with what it reads, drawn where a card's sensor is of its kind (a percentage, a temperature, water stored, a battery, power, wind, the sun's power) and the card's ticks elsewhere; each tile on a reading of its kind |
| **Line** | Regular · Thin · Bold | a style's line (2.5, 1.5 or 3 px); a card's `line_width` wins |
| **Soft shadow** | 5 px · 3 · 7 under the line, 35 % · 25 · 45 | the soft copy of the line in Soft and Glow |
| **Fill** | 18 % · 12 · 24 | the gradient under a line at its top (a flat fill two thirds of it); dark mode six points more |
| **Gridlines** | Hairline · Dashed · None | the hairlines a style draws |
| **Line's end** | Knob · Dot | Fluvy's knob (the thermostat's ball) or the classic dot where a style marks the end |
| **Now** | Knob · Line | where the past meets the forecast: the knob on the line over a hairline, or the hairline alone |
| **Bars' ends** | Both · Top | a bar rounded at both ends, or only away from its axis |
| **Bubble** | Dark · In the series' colour | the value's bubble over a chart |
| **Series colours** | From the palette · a saved set | the six colours of a chart's several series: the palette's (`--fluvy-graph-1…6`) or a set of six of the house's own, each colour one of the palette's (it follows the palette and the mode) or a hex of its own (fixed: its hue kept and each mode wearing it fitted to its card as the palette's are built); two still closer than ΔE 8 are said |
| **Waves** | Medium · Low · High | how tall a moving gauge's waves stand (4, 7 or 10 px); offered once a gauge that moves is chosen |
| **Motion** | On · Off | whether a chart draws itself in; a card's `animate` wins, and the system's reduced motion always holds |
| **Time shown** | 12 h · 4 h · 24 h · 48 h · 7 d | how much of the past a chart shows where a card names none (1.18; 24 hours before): the sensor's chart and tile, the energy card's line, a Chart card's `span`; a card's `hours` (the Chart card's `span`) wins — `hours: 24` is the energy card's day |
| **A point every** | Automatic · 5 min · 15 min · 30 min · 1 h | how far apart a line through time draws its points (1.18); a card's `points` wins. **Automatic** is a calm line for each card's width and style: its points on the house's round times (12:00, 12:30 …), the finest step that keeps them 5 px apart (4 for a thin line, 6 under a glow), each the mean of the readings around its time. A **fixed** step draws Home Assistant's reading at each of its times, so the line passes through what Home Assistant says at 12:00; down to a pixel apart, the line drawn thinner (to Home Assistant's own 1 px) where its points stand closer than its stroke reads, and no finer than the readings come (an hour's statistics by the hour) |

Wherever a line through time is read — a finger or a mouse on it — it says the reading itself, never the line: the time
snapped to the round one nearest (a statistic's five minutes, or what a pixel of the plot holds) and the reading Home
Assistant has then, so 12:00 says Home Assistant's 12:00 whatever the line draws there; the dot stands on the line.

Classic takes none of these but motion, the time shown and the points. The rule is one, everywhere: a card's own key wins over the house's setting,
which wins over the style's own default.

### The Charts tab

The tab chooses them as the Appearance tab chooses the look, and every change is shown at once — on the tab's own
drawings and on every card of the page that names no style — and saved from the bar with the rest ("Charts · Style ·
Soft"); Discard puts the saved ones back.

- **Style** and **Gauges**: a tile each (two a row on a phone, four on a wide panel, a last row's few sharing its
  width), the engine drawing the style on a day of temperature with its forecast (the bars styles on a day of energy)
  and the gauge on 62 %, in the fine settings chosen; the chosen one in the accent's fill with its check.
- **Details**: the fine settings the chosen style draws with, a row of chips each — no other is offered (the engine's
  `HOUSE_ACTS`). Classic takes none, and says so; then **Motion**, which every chart has.
- **Time**: **Time shown** and **A point every**, a row of chips each, every style's ("Charts · Time shown · 24 h"),
  and a line under them on what the two kinds of points draw.

  | Style | Line | Soft shadow | Fill | Gridlines | Line's end | Now | Bars' ends | Bubble |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Classic | | | | | | | | |
  | Soft | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
  | Glow | ✓ | ✓ | | | ✓ | ✓ | ✓ | ✓ |
  | Minimal | ✓ | | | | | | ✓ | ✓ |
  | Steps | ✓ | | ✓ | ✓ | | ✓ | ✓ | ✓ |
  | Bars, Columns | | | | ✓ | | | ✓ | ✓ |
  | Band | ✓ | | | ✓ | | ✓ | ✓ | ✓ |

  A style's bars' ends count wherever a card of slots (the history bars) draws it; the bubble is every style's while a
  chart is read.
- **Series colours**: the palette's six (its swatches as the look being chosen derives them, in the mode on screen),
  then the house's own sets, each pictured as the mode on screen wears it; a tap wears one. **New set…** opens on the
  palette's six, named: a dot each, the one being picked ringed, and under them its picker — the palette's twelve
  series colours, its accent with the statuses (Success, Warning, Danger, Notice) and the lit light, and the energy
  states (Solar, Grid, Battery, Water, Gas, House), each drawn as the look being chosen has it in the mode on screen —
  and **Custom**, a hex typed or picked from the system's picker (on a colour of the palette's it starts on that
  colour's hex). Each colour of a set is one or the other, and says which:
  - **Follows the palette** (the palette's mark on its dot): the set names the palette's colour (`graph-3`, `accent`,
    `ok`, `solar` …), so a chart wears that palette's own in each mode — choose another palette and the set changes
    with it, the same green in the charts as everywhere else. A new set follows the palette until a colour is made
    fixed.
  - **Fixed** (a lock on its dot): a hex of the house's own, its hue kept as chosen whatever the palette, and each mode
    wearing it fitted to its card as the palette's own six are built: a colour that does not read at 3:1 there is
    lifted (dark) or deepened (light) only as far as it takes, at its hue, and a little further where that sets it 8
    apart (ΔE2000) from the ones before it; a colour that reads is worn as picked. So a navy is lifted on the dark
    card and a cream deepened on the light one.

  Only what fitting cannot fix is said, on the colours as each mode wears them: two closer than 8 ("#2563eb and
  #2463ea are too close to tell apart", "Series 1 and Accent are too close to tell apart"), or brought together on one
  card ("… on a light card"). The two cards show the six lines side by side, as each wears them. **Save set** keeps it
  with the house at once (up to twelve, as its palettes) and wears it, an edit for the bar; **Edit this set** renames
  or recolours the one worn in its place, and **Delete this set** lets it go — charts that wore it wear the palette's
  again.
- **Preview**: a sensor's day with its bubble, the day's energy as bars and the house's gauge, drawn in the settings
  being chosen, in the light mode and the dark one side by side (under the cards, or in the side column on a wide
  screen). With motion off, every drawing is its resting frame.

Someone who is not an administrator sees the house's choices and the preview, and changes nothing.

## Where they are stored

In Home Assistant's own frontend data, not in a file of Fluvy's: the house under `frontend/set_system_data`
(key `fluvy`, writable by administrators), the person under `frontend/set_user_data` (key `fluvy`). Every browser
subscribes to both, so a palette changed on the desktop recolours the phone at once. What is stored is parsed and
never trusted: a value that does not make sense falls back to its default. A copy of the last applied look is kept in
the browser (`localStorage`, `fluvy:look`) only so that the page paints in the right colours before Home Assistant
answers.

**Backups.** Because both live in Home Assistant's frontend data, a Home Assistant backup keeps every setting of
Fluvy's and a restore brings them back: the look and the saved palettes, the cards' opacity and blur, the sliders' style, the statuses' colours, the lights' defaults,
the wall, the Charts tab (the style, the gauge, every detail, motion, the time shown and the points), the house's
own series colours, and which of Home Assistant's pages and its details dialog's history are Fluvy's. The panel's
*Preferences › Fluvy › Export* writes the same to a file — the house, the person and the options of every automatic
dashboard — and *Import* (an administrator's) reads it back on another house; a file from an earlier version brings
what it holds and leaves the rest at its defaults. What a screen keeps for itself (*This device · Size*,
*Performance* and *Sidebar beside the page*, a device's wall) stays in that browser and travels with neither. A card's own choices (its `chart`, its colours) are part of the
dashboard's configuration, which Home Assistant's backups keep as well.

## "Everywhere" and the theme

Home Assistant's own pages take Fluvy's design only while the theme Home Assistant wears for that person is **Fluvy**,
**Fluvy Light** or **Fluvy Dark** ([the three](theme.md#the-file)) — their profile's theme, or the house's default. With
another theme, every Home Assistant page keeps that theme and the look stays on Fluvy's dashboards, as with "only
dashboards". The panel says so, naming the theme in use, and offers the Fluvy theme through the profile's own theme
picker; it never changes anyone's theme by itself.

## Our icons

With the look everywhere, Fluvy draws its own icons in Home Assistant's menus, in two places the house chooses apart
(1.19), each on until it is turned off:

| Switch | What it covers | Off |
| --- | --- | --- |
| **Our icons in the sidebar** | the sidebar's own pages, the apps people add most, the notifications, Settings' item and the menu button | Home Assistant's icons in the sidebar |
| **Our icons in Settings** | Settings' lists (their icon circles, About's, the restart dialog's) and the Material icons of Home Assistant's own pages, HACS's among them: the menus, the pencils, close, back and search, the edit bar's | Home Assistant's coloured circles and its icons |

So a house can wear Fluvy's icons in the sidebar and keep Home Assistant's in Settings, or the other way round. A house
that had turned the one icons switch of 1.18 off finds both off, one that left it on finds both on: nothing changes on
upgrade, and a settings file exported from 1.18 imports the same way.
