# The automatic dashboards

Five dashboards Fluvy builds by itself, each from one line of configuration:

```yaml
strategy:
  type: custom:fluvy-home      # or fluvy-rooms, fluvy-energy, fluvy-security, fluvy-wall
```

The panel's *Dashboards* tab creates any of them with one tap (as `/fluvy-auto`, `/fluvy-rooms`, `/fluvy-energy`,
`/fluvy-security`, `/fluvy-wall`); any dashboard with that raw configuration is the same thing. Each is rebuilt every
time it opens, from the registries, so a new device shows up by itself.

| Template | What it is for |
| --- | --- |
| **Home** (`custom:fluvy-home`) | the whole house: Home, Rooms, Lights, Climate, Energy, Security, Media, Agenda and Sensors, each when the house has what it shows, and an Appliances page behind Home's appliance bands |
| **Rooms** (`custom:fluvy-rooms`) | a card a room, a tab a floor when the house has two or more; each room opens as its own page, with everything its card counts |
| **Energy** (`custom:fluvy-energy`) | Now (the flow, the balance, the house by source, the grid, the batteries, the car charger), Today (the Energy period bar across the view, and the day's flow, where it went, the score, the balance and the range's usage of electricity, water and gas following it), Production, Devices, Water & gas, Meters |
| **Security** (`custom:fluvy-security`) | Security (the alarm, what locks, what opens, the first four cameras on one Cameras card), Cameras (twelve cameras on one Cameras card across the view, the rest a "N more" row away), Openings room by room, every one |
| **Wall** (`custom:fluvy-wall`) | two columns for a tablet on the wall, read from a metre away: the greeting, the clock, the readings, the scenes and the rooms; the thermostat, the security rows and who is home |

## What the home dashboard builds

| View | What goes in it |
| --- | --- |
| **Home** | "Needs attention" first (leaks and smoke, open, unlocked, errors, low batteries; for an administrator also updates and repairs — hidden while all is clear), the greeting (your person, the date, the weather), the tabs, the lights under one heading, the covers, the running thermostat, the temperatures, the weather and the clock, the energy flow and the solar or home energy curve, the locks and openings, at the columns' feet the first media player, the vacuum, a to-do list and the house's scenes on one Scenes card, and under the columns the house's appliances: the large ones as whole cards side by side (four across a desktop, as many as fit on a tablet or a phone), the small ones as rows, each band leading to the Appliances page |
| **Rooms** | a card a room (its photo where the area has one), headed by floor when the house has more than one; each room opens its own page with everything its card counts (see [A room's page](#a-rooms-page)) — when the house has two rooms with something in them |
| **Lights** | every light and every switch whose words say it is a light, grouped by area (indoor and outdoor when there are no areas), dimmable ones as light cards and switches as tiles; the scenes and the light automations last on one card, titled *Scenes*, or *Automations* where an automation is among them |
| **Climate** | thermostats, water heaters and humidifiers, the weather, the temperature and humidity sensors that are not the weather service's — humidity paired with its temperature |
| **Energy** | the energy flow and the balance, the house's power by source, the grid (by phase when its meters are named so), the batteries, a car charger, the day's flow, where it went and the score (when the Energy dashboard meters its sources), production, the energy dashboard's devices, their distribution, water and gas |
| **Security** | alarm panels, locks, gates and garage doors, the openings, the first four cameras on one Cameras card — when the house has an alarm, a lock, a camera or a gate |
| **Media** | what plays now, then every other player |
| **Agenda** | the calendars in a month view, the to-do lists, the timers, the scripts and automations to run by hand — when there are calendars, timers, things to run, or more than one list |
| **Sensors** | device batteries, phones, the people and the map of their zones, the openings (when there is no Security view), the plants, the helpers, the updates, the first camera |

Views a house has nothing for are left out. Every view keeps the same three columns (two on the wall), so the header
never moves between tabs, and blocks are cut into the columns so that they end on one line. A room's page is a
subview: it opens from its card, never from the tabs, and its heading leads back.

## A room's page

A room's page reaches every entity of its area that a dashboard shows (not hidden, not a configuration or diagnostic
entity): in reading order, its scenes on one Scenes card, as its card's quick actions come before its devices, its
thermostats, its lights, its blinds, its garage doors and gates (each a cover card), its fans, its media players, its
plugs (with their power and energy beside them), its temperatures and humidities (each named by what it measures where
it alone measures it, as the room card names them), its doors, windows, motion, leak, smoke and gas sensors on one
Openings card for the room, its cameras, everything else it holds as rows under *Devices*, and its automations on one
Automations card for the room (each with its switch and when it last ran); its appliances across the page as on Home.
Each list keeps the house's cap (below), with its "N more" row; the Openings and Automations cards fold theirs at it on
the card itself.

A room's card counts its devices among them, and fills while one is on: its lights, its fans and covers, its media
players, its thermostats, water heaters and humidifiers, its vacuums and mowers, and its switches that power something.
A switch is one of those when Home Assistant calls it an outlet or a switch, when it is on no device, or when its device
is a plug or a relay; on a device that also has an appliance's controls (a select, a number, a button, a text, a time: a
dishwasher's programme, its delay, its start), a switch is the appliance's own option, and neither it nor those controls
count — unless the device is a plug that files its timer or its power-on behaviour as no setting (some Tuya and
Zigbee2MQTT plugs): its one switch beside a power or energy reading, with no other control, counts. Sensors, helpers,
scenes, automations, locks and cameras never count; the page still reaches them all, its scenes on a Scenes card and its
automations on an Automations card of their own. A plug tile on Home and on a room's page follows the same rule, and
`rooms` (below) gives a room its own say: what it includes counts, what it excludes leaves its card and its page.

## Capped lists

A view shows the first of a long list, so a big house still reads. Where a list goes past its cap, it ends with a
"N more" row, which opens a page of every one (a subview, back to the view it came from): the whole cards of a list of
cards (thermostats, cameras), a card a room for a list of rows (batteries, the security rows). One past the cap of a
list of rows or tiles is shown instead: it takes the room a "1 more" row would.

| List (`caps` key) | Where | Shows |
| --- | --- | --- |
| `lights` | Home, a room | 6 |
| `appliances` | the plug tiles of Home and a room | 4 |
| `covers` | Home, a room | 6 |
| `gates` | Security, a room | 2 |
| `thermostats` | Climate, a room | 4 |
| `fans` | Climate, a room | 2 |
| `humidity`, `temperatures` | Climate | 3, 4 |
| `readings` | the temperatures of Home and the wall, a room's readings | 3 |
| `security` | Home's security rows (the wall's: 6) | 5 |
| `alarms`, `locks`, `cameras` | Security (the Security dashboard's Cameras view: 12), a room's cameras | 2, 4, 4 |
| `media` | Media, a room | 6 |
| `calendars`, `lists`, `timers`, `actions` | Agenda | 3, 3, 3, 6 |
| `scenes` | Home, Lights (scenes and light automations), a room | 6 (12 as chips: `scenes_style`) |
| `batteries`, `phones`, `plants`, `helpers`, `updates` | Sensors | 8, 8, 4, 6, 8 |
| `consumption` | the energy dashboard's devices (Energy; the Energy dashboard's Devices view: 12) | 8 |
| `today` | the day's energy readings as stat tiles | 4 |
| `meters` | the Energy dashboard's power meters | 9 |
| `devices` | the rest of a room, as rows | 8 |
| `openings` | the Openings cards of Home, Security and a room | 4 |
| `automations` | a room's Automations card | 6 |

The Openings and Automations cards fold their own lists at their cap, the rest one tap away on the card itself rather
than on a page of their own; in full, they fold none. Home's appliance bands keep their own two rows (eight large, five
small) and lead to every appliance.

## How it reads a home

- **Words**, in every language Fluvy speaks (a house is named in its own language, whatever the UI's), the way people
  name things: a switch called *Kitchen light* is a light, one
  called *Washing machine* is an appliance; a switch called *boost*, *valve*, *beep* or *timer* is a setting, not an
  appliance.
- **Appliances**: what the appliance card finds — by what its integration says (LG ThinQ, Home Connect, Miele,
  SmartThings, Matter, Whirlpool, Tuya, hOn, Electrolux) or by its name — leaves the plug tiles for the appliance
  bands, and its own temperature or humidity sensor (a fridge's, an oven's) never counts as a room's reading; the
  energy views read the plugs' power as before.
- **Twins**: a device with a switch and an outlet of the same name shows once, with the device's power and energy
  readings beside it.
- **Places**: an entity whose name only says what it measures (*Temperature*) is named after its device or area. A
  reading in no area is placed by its device's name without the words that say a sensor (*Sensor*, *Snímač*,
  *érzékelő*, *Temperatur*), read with or without their accents. Where things shown together would read alike (a
  room's two meters, two thermometers of one place on Climate, two weather services' rows in one list, two *Ceiling
  light* tiles or two *Plug* tiles on Home, two *Movie* scenes on its Scenes card or among a wall's chips), each gains
  what tells it apart after a "·": its own words, else its device's name, else where it is (*Utility · Discharge
  power*, *Pressure · Met.no*, *Movie · Lounge*); a name said once stays as it is, and a humidity card beside a
  temperature card keeps its place, the cards saying what they read.
- **Rooms**: an entity belongs to its own area, else to its device's; hidden, configuration and diagnostic entities
  stay out. A room's climate comes from the temperature and humidity sensors set in the area's settings (honoured even
  when they are hidden or diagnostic), else from a sensor of each kind in the room — the first that reads, a dead one
  never hiding a working one — else from its thermostat or humidifier. A unit alone never makes a reading: a "%" is
  as often a battery. An area is a room when its room card would draw something — an entity, or one of those readings
  — and an entity whose state arrives late (Home Assistant still starting) is found the moment it does.
- **The weather service's sensors** (the platform is a weather integration) stay out of the climate view.
- **Solar, grid, battery**: the Energy dashboard first — when it carries the grid's power sensors the energy cards
  are given no sources and read it themselves (every connection, two sensors kept as two). Every array and battery it
  names counts, each with its own sign and charge: the flow and the balance are given them all, and the sun's gauge
  and curve are one an array, named by its sensor. Otherwise power sensors
  whose words say so: a meter named for what leaves the house (*export*, *feed-in*, *einspeisung*, *vertido*…) is the
  grid's second sensor, never the grid itself; grid meters named by phase (*L1*, *Phase A*, *fase 2*) are read per
  phase; a grid meter that reads negative through the night is understood as exporting-positive and inverted; the
  battery's charge is the battery sensor beside its power. A car charger is a power sensor named so (*wallbox*,
  *charger*, *ladestation*, *cargador*…); water and gas are the Energy dashboard's meters, else the house's own. Today's
  production is the Energy dashboard's solar meter, else a day's counter named for the sun (*today*, *heute*,
  今日, 日发电量, 日発電量…); with several arrays there, Production and History bars read them all together, each array in
  Production's legend named as the house calls it (by its device where two meters read alike); where the Energy
  dashboard links a solar forecast to your panels, Production draws it and a second Production card under it shows
  tomorrow's (`day: tomorrow`). Where every forecast linked there holds a week (Solcast's, Open-Meteo Solar
  Forecast's; Forecast.Solar's holds two days), the next seven days (`day: ahead`, `days: 7`) can stand under History
  bars, the last days and the next in one column: a card that starts hidden, shown from [Customise](#customise)
  (*Next days · forecast*, `production/ahead` on the Energy dashboard, `energy/ahead` on Home's). A forecast is never a
  reading: one named so in any language (*forecast*, *Prognose*, *previsión*, 预测…) or of a forecasting integration
  (Forecast.Solar, Solcast) takes no role, is neither a meter of the Meters view nor one of the day's tiles, and no room
  or Climate view counts it.

## Options

In a dashboard's raw configuration, or in the panel's *Dashboards* tab (each dashboard has its own card of options
there; *Recreate* takes them all back to their defaults). What goes past an option, one card hidden, moved or tuned,
is [Customise](#customise):

| Option | Values | Templates | What it does |
| --- | --- | --- | --- |
| `hide` | view names: `rooms`, `lights`, `climate`, `energy`, `security`, `media`, `agenda`, `sensors` (home); `today`, `production`, `devices`, `water`, `meters` (energy); `cameras`, `openings` (security) | home, energy, security | views left out (the first view always stays) |
| `thermostat_variant` | `dial` (default), `compact`, `ruler` | home, rooms, wall | how the thermostats are drawn |
| `thermostat_state` | `brief` (default), `detailed` | home, rooms, wall | what the thermostats say of what they are doing: as each card does by itself, or (`detailed`) with how far its valve is open, an open window and a low battery, each found where there is one (the thermostat card's `show_valve`, `show_window` and `show_battery`), a room's climate row saying what its thermostat is doing and what it is set to (the room card's `show_action`). Nothing is written until it is chosen; see [Thermostat](cards.md#thermostat) |
| `tile_size` | `large` (default), `compact` | home, rooms | the tiles' size on the Lights view, the Home view and a room's page |
| `tile_switch` | `show` (default), `hide`, `value`, `rocker` | home, rooms | the large tiles' switches, the lights' and the appliances': beside their icon circles, hidden (a tap on a tile's circle switches it, a tap on the tile opens its details), the level's figure in their place (the tile card's `show_switch`), or wall rockers (the tile card's `switch_style: rocker`: each tile then switches and nothing more, with no ruler, and a compact tile's rocker stands at its row's end) |
| `group_by` | `none` (default), `room` | home | which room a light or a scene belongs to (1.21): Home's lights under their rooms' quiet labels, and the scenes of Home and of the Lights view under theirs, the names short under each ([by room](#by-room)) |
| `scenes_style` | `tiles` (default), `chips` | home, rooms | the scenes as pills that fill their rows on one card, the last run one filled, by room on Home and on the Lights view; twelve before their "N more" row |
| `flow_style` | `stream` (default; `ribbons` reads as it), `legs`, `rail` | home, energy | the energy flow's drawing |
| `room_variant` | `photo` (default: a photo where the area has one, else a tile), `tile`, `row` | home, rooms | the rooms' cards |
| `room_name_position` | `bottom` (default), `top` | home, rooms | where a room's photo carries its name: at its foot beside the quick actions, or at its top, the foot then theirs alone; the panel offers it while the rooms may be photos |
| `room_readout_style` | `row` (default), `wrap` | home, rooms | a photo's readouts on one row, what does not hold giving way (the words to icons, the figures' size, their units), or wrapped so the words stay, as before 1.19 |
| `room_readout_labels` | `auto` (default: words while they hold, icons where they would not), `words`, `icons`, `none` | home, rooms | how a photo's readouts are labelled |
| `areas` | a list of area ids | wall | the rooms the wall shows, in that order, an empty one kept (default: every room with something in it) |
| `camera_refresh` | `5`, `10` (default), `30` | security | seconds between the cameras' stills |
| `scenes_max` | `4`, `6` (default), `8` | wall | how many scenes the wall offers as chips |
| `greeting_tabs` | `hide` (default), `show` | home, rooms, energy, security | the views as chips under the greeting too, besides the header's tabs (until 1.4 they always were) |
| `background` | `type`: `plain`, `gradient`, `color` or `image`, and that type's own keys: `colors` (one hex, or two from the top to the bottom), `image` (a path of Home Assistant's such as `/local/backgrounds/garden.jpg`, or a web address), `dim` (0 to 80 in steps of 5, default 40), `blur` (default `false`) | all | what lies behind this dashboard's cards in place of the house's (default: the house's, the panel's *Appearance › Background*; below); `type: plain` keeps this dashboard plain whatever the house chooses |
| `caps` | a list's own number or `none` by its key (`caps: { lights: 12, humidity: none }`), or `none` for every list | all | how many of a long list a view shows (default: the house's caps, above, each with its "N more" row); the panel offers *Shortened* (the default) or *In full* |
| `rooms` | by area id, a room's `include` and `exclude`, as the room card takes them: entity ids, patterns of ids, device ids or domains (`rooms: { kitchen: { exclude: [switch.dishwasher_*] } }`); and that room's own `name_position`, `readout_style` and `readout_labels`, over the dashboard's (`rooms: { kitchen: { name_position: top } }`) | home, rooms, wall | what that room's card counts and fills by, whether the room is shown, and what its page holds, and how its photo is drawn; in the raw configuration only (the settings file never carries a house's entities) |
| `exclude` | a list of entity ids, patterns of ids, device ids or domains, as a room's `exclude` takes them (`exclude: [climate.water_heater, sensor.inverter_mppt_*]`) | all | what no view shows nor counts, as if the house had none of it (below); the panel offers it in Home Assistant's entity picker, and the settings file never carries it |
| `edit` | an object of `views`, `cards` and `entities` | all | what was changed on its views and cards, kept as differences: hidden, moved, given options, a list's entities left out, added or put in order ([Customise](#customise), which writes it) |
| `weather` | a `weather.*` entity | all | the weather of the greeting and the clock (default: the first) |
| `language` | `en`, `es`, `de`, `nl`, `fr`, `it`, `pt-BR`, `pt-PT`, `tr`, `ja`, `hu`, `sk`, `pl`, `zh-Hans`, `ru`, `uk` | all | the dashboard's words in that language, whoever opens it |

Without `language`, the dashboard's words follow the language of whoever opens it (Home Assistant's, or the one
chosen in the panel's *Preferences*). A house is read in every language at once: a switch called *Küche* or
*cocina* is a light's room in any of them. The settings file *Preferences* exports (its last card, *Fluvy*) carries every dashboard's options
under `dashboards`, by url path; a file from Fluvy 1.2 (one `dashboard` key) still lands on the home dashboard.

## By room

Two options of the home dashboard say which room a light or a scene belongs to (1.21). Both are off until chosen, in
the panel's *Dashboards* tab or in the raw configuration, so a dashboard looks as it did:

```yaml
strategy:
  type: custom:fluvy-home
  group_by: room        # Home's lights and the scenes under their rooms
  scenes_style: chips   # the scenes as pills
```

- **`group_by: room`.** Home's lights stand room by room, each room's under its quiet label, their names short under
  it (*Kitchen Pendant* is *Pendant*); lights in no room stand under *Indoor* or *Outdoor*, as on the Lights view.
  The list's cap still counts tiles, and it takes the first rooms' lights: the rest is one tap away, under "N more".
  The scenes of Home and of the Lights view stand under their rooms' labels too, those in no room under *Whole home*.
- **`scenes_style: chips`.** Every Scenes card the dashboard writes draws its scenes as pills on one card (the Scenes
  card's `variant: chips`): by room on Home and on the Lights view, and on a room's own page without its room's name.
  As chips a list shows twelve before its "N more" row.

The rooms stand in the house's order, the panel's *Dashboards › Rooms in order*
([the settings panel](settings-panel.md#rooms-in-order)): every list by room follows it, the Rooms view, the Lights
view's groups, the lists a "N more" page splits by room, a wall's rooms and the room pages' tabs of the Rooms
dashboard. *Automatic*, the default, is each list as it always sorted: the rooms floor by floor and A to Z, a list
by room its biggest room first. What Customise moved on a dashboard stays that dashboard's own, over the house's.

## A background of its own

The house chooses what lies behind the cards of every dashboard in the panel's *Appearance › Background* (plain until
chosen; [the settings panel](settings-panel.md#background)). A dashboard may have its own instead: its card in the
*Dashboards* tab offers *As the house* or *Its own*, with the same four kinds, and saves it in its strategy:

```yaml
strategy:
  type: custom:fluvy-home
  background:
    type: image
    image: /local/backgrounds/dunes.jpg   # a file in config/www/backgrounds/
    dim: 40                               # how far towards the page's colour, so the greeting reads
    blur: false
```

`type: color` takes `colors: ['#1d4ed8', '#60a5fa']` (one, or two from the top to the bottom), `type: gradient` the
palette's own; an address the check refuses (white space, a quote, a parenthesis, a scheme other than `http` or
`https`) draws nothing. A view with a background of its own in Home Assistant's settings keeps it.

## Leaving entities out

`exclude` takes entities out of every view of a dashboard, its rooms' pages and its "N more" pages, without hiding them
from Home Assistant: its own pages, its area cards and every other dashboard still show them. The dashboard reads the
house as if it had none of them: no card shows one, no room counts one (each room's card is told to leave out those it
holds), the energy roles never take one when they find a meter by its words, and a device named whole leaves with
every entity it has. A room's own `include` still brings in what it names.

A house whose Climate view should hold its air conditioners alone, and whose inverter reports each MPPT's power beside
its total (which the words would take for the solar power before the total):

```yaml
strategy:
  type: custom:fluvy-home
  exclude:
    - climate.water_heater_thermostat   # on a dashboard of its own
    - sensor.inverter_mppt_*            # every MPPT reading, the total kept
```

In the panel's *Dashboards* tab each dashboard lists what it leaves out under *Entities left out*, in Home Assistant's
entity picker; a pattern, a device or a domain written in the raw configuration stays there as written.

## Customise

An automatic dashboard can be shaped without giving up what makes it automatic. In the panel's *Dashboards* tab each
dashboard's card opens with a **Customise** row (an administrator's): it lists the dashboard's views as chips, its
rooms' pages after them, and the open view's cards as rows, in the order they are read. Home Assistant's own pencil
leads there too: on an automatic dashboard it opens *Edit dashboard* with a first row, **Customise**, and the
dashboard's most used options under it (the views it shows, its thermostats, its tiles).

- **A view**: *Show this view* leaves it out or brings it back (the first view always shows), and the two arrows
  place it among the tabs, so any view can lead. A tap on *Place among the tabs* unfolds every tab as a row: drag
  one to its place by its handle, or switch it off there.
- **A card**: its switch hides it. Drag it by its handle (the six dots before its circle, with a mouse or a finger)
  to where it should be read, or tap its row for its buttons: to the top, up, down, to the bottom, *Options* and
  reset. *Options* opens the card's own form in a sheet; only what you change there is kept, so the rest of the card
  stays as the house builds it. A view of more than eight cards has a search field over them. A few cards are offered
  hidden, as something you turn on (the Production view's *Next days · forecast*, 1.21): their row says *Hidden*
  until its switch shows them, and `hidden: false` is all that is kept.
- **A list** (the lights of the Home view, a view's thermostats, the rows of the Security card): its entities are
  rows of their own under it. Each has a switch that leaves it out and a handle to drag it by; a tap on one unfolds
  its own buttons (to the top, up, down, to the bottom, and *Options* where the entity is a card of its own, such as
  a light's tile); *Add an entity* adds one of a domain the list takes.
- **Add a card** opens a sheet with three ways:
  - *This dashboard*: the cards of every other view and room page. Pick some by their switches, then **Show here
    too** (the card is on both views) or **Move here** (it is hidden where it was). Either way it stays automatic:
    it is the same card the house builds for its own view, with the devices that arrive later. Its row says where it
    comes from; its *Options* are its own on this view (a title, a variant), and *Remove* takes it away again, a
    moved one going back to its view.
  - *Fluvy's cards*: pick one of Fluvy's cards, fill in its own form (the card is drawn over it, on your house) and
    add it. Nothing to write.
  - *YAML*: a card's YAML, typed or pasted from another dashboard.

  What you add is laid after the view's own cards and moved like any other.
- **Reset**: one card, one view or the whole dashboard (*Back to automatic*), each on a second tap.

Nothing is saved on a tap: the bar at the foot counts the changes ("3 changes") and saves or discards them, and on a
wide screen the view is drawn beside its rows as it will be, on the real house.

**Scenes first on Home.** A command centre at the top of the dashboard takes two steps. Open *Customise*, tap the
*Scenes* row of the Home view and press *Move to the top* (or drag it there): it is now read first. For the scenes of
single rooms, tap *Add a card*, search "scenes" under *This dashboard*, switch on the kitchen's and the living
room's, press *Show here too*, and drag the new rows up beside the first. Each can be titled after its room in its
*Options*. A script or an automation joins a Scenes card as an entity (*Add an entity* under its row).

What is saved is one `edit` object in the dashboard's strategy. It holds differences, never a copy: everything it
does not name stays automatic, a new device still arrives in the card that draws it, and deleting `edit` is the
dashboard as the house builds it.

```yaml
strategy:
  type: custom:fluvy-home
  edit:
    views:
      media: { hidden: true }            # a view left out
      energy: { order: 0 }               # first among the tabs
      climate:
        add:                             # cards of your own, after the view's
          - type: markdown
            content: Filters are due in March
      home:
        also:                            # cards of other views shown here as well, still automatic
          - room-kitchen/scenes
          - room-living_room/scenes
    cards:
      home/weather: { hidden: true }     # a card left out
      energy/ahead: { hidden: false }    # a card offered hidden, shown (the week's solar forecast)
      home/flow: { order: 1 }            # read second on its view
      home/clock:
        options: { face: analog }        # keys laid over the generated card
      rooms/room:garden: { order: -1 }   # a negative place counts from the end: last
      home/lights:light.sofa:
        options: { name: Reading lamp }  # one card of a list
      home/also:room-kitchen/scenes:     # the kitchen's scenes as Home shows them:
        order: 0                         #   read first
        options: { title: Kitchen }      #   under a title of their own here
      room-living_room/scenes:
        hidden: true                     # moved: on Home alone, no longer on its room's page
    entities:
      home/lights:
        drop: [switch.patio_light]          # left out of the list
        add: [switch.desk_socket]           # shown besides
        order: [light.sofa, light.ceiling]  # these first, the rest in the house's order
```

| Key | What it holds |
| --- | --- |
| `views.<view>` | `hidden` (any view but the template's first), `order` (its place among the tabs), `add` (card configs laid after the view's own, each the part `<view>/own:<its place in the list>`) and `also` (the ids of other views' cards shown here as well, each the part `<view>/also:<that id>`) |
| `cards.<id>` | `hidden` (`true` leaves a card out, `false` shows one offered hidden), `order` (its place among its view's parts) and `options`: keys laid over the generated config (a variant, a title, a colour, the entity itself), `null` to take one away; a card's `type` is never changed |
| `entities.<id>` | `drop` (entities left out), `add` (entities shown besides: each one the house has, of a domain the list takes) and `order` (the entities read first, the others after them in the house's order) |

**Ids.** A view is named by its path (`home`, `climate`, `room-kitchen`). Every card stands in a part with an id of its
own, given by the generator and never read from what the card holds, so a renamed entity or a device added elsewhere
never moves an edit: `<view>/<part>`, such as `home/flow`, `home/lights`, `rooms/room:<area id>`,
`lights/lights:<area id>`, `energy/sankey`, `energy/tomorrow` (tomorrow's production, under today's
`energy/production`), `today/usage_water` (the Energy dashboard's water usage, beside `today/usage` and
`today/usage_gas`) or `room-kitchen/readings`. A list is one part (its heading, its cards and its "N more" row go
together), and a card it draws for one entity is `<list>:<entity id>`. The quickest way to learn an id is to make the
change in the panel and read the dashboard's raw configuration.

**Order.** `order` is a place: `0` is first, `1` second, and a negative one counts from the end (`-1` is last). The
parts that have none keep the house's order round those that do. A view's columns are cut again round a part that
moved, so they still end level; on the wall, a card joins the column of the card it now follows.

**A card of another view.** `also` names cards by their ids on their own views (`room-kitchen/scenes`,
`lights/lights:<area id>`, `media/media`), from any tab, room page or the appliances' page of the same dashboard
(a view the dashboard's *Views* option leaves out gives none: it is no view of it). The
strategy builds each on its own view a second time, with whatever you changed on it there, and lays it after the
view's own and your cards; on this view it is the part `<view>/also:<id>`, which takes an `order` and `options` of
its own. A list shown this way keeps its cap, and its "N more" row opens the whole list from the view that shows it
and comes back there. Hidden on its own view (`cards.<id>.hidden`), it shows here alone: that is *Move here*;
*Remove*, or a reset of the view, shows it on its own view again.

**What the house no longer has.** An id that matches nothing (a room that was deleted, a card of `also` whose view is
gone) is ignored and kept: it draws nothing, it is never an error on the dashboard, it works again if the room comes
back, and a reset takes it away.

The dashboard's other options keep working beside `edit`: `hide`, `exclude`, `areas`, `caps` and the rest are read
first, and `edit` is laid over what they leave. A list's cap counts what the list shows after the edit, so an entity
left out makes room for the next. The settings file never carries `edit` (it names this house's own entities) and
importing one leaves it where it is; *Recreate* takes it away with the other options.

## Limits

They never invent: a house without a weather entity gets no forecast, a house without energy preferences gets a flow
only if the words find its meters, a wall without scenes has no scene chips. A dashboard you want to shape card by
card is [customised](#customise); one you want to lay out freely is better started by hand — add the cards from the
picker; each is documented in [the cards](cards.md).
