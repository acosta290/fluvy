# The cards

Thirty-nine cards, listed as **Fluvy · …** in the card picker, each with a live preview and an editor form. The form is
the reference for a card's options: it shows what the card does by default, and a default you leave as it is is never
written into the configuration. In YAML, a card is `type: custom:<tag>` plus the entity or entities it draws and any
option the editor offers; the *Editor options* column below names them.

Every card holds from 300 to 520 px wide, in light and dark, in every language Fluvy speaks; `unavailable`, `unknown` and a
missing entity are drawn on purpose (a quiet surface, inert controls, a dash for the value), never as an error. Names
may be shortened with an ellipsis; values never are. A card that takes an action changes on screen first and calls
the service after; sliders and dials send on release, not per frame.

## Customisation

Every card exposes what to show (section switches such as `show_fan`), which items appear and in which order (subset
lists such as `modes: [off, heat, cool]`), and at least one other layout through `variant`. Chip rows fill the row by
default and are content-sized on request (`preset_style`, `fan_style`, `suction_style: chips`). Cards that list rows
(lock, alarm, camera, bars, stat tiles) take a `rows` list edited with Fluvy's own rows editor.

## Everyday

| Card | Type | What it is | Editor options |
| --- | --- | --- | --- |
| **Tile** | `custom:fluvy-tile-card` | A light, switch, cover, fan or sensor as a tile: large with a precision ruler or two readouts, compact row, or mini. | `size`, `readouts` |
| **Tiles** | `custom:fluvy-tiles-card` | A group of compact or mini tiles, two to four per row, 8 px apart; a large tile's foot shows the readouts chosen for it (two, or three when it is wide). | `entities`, `size`, `columns`, per tile `readouts` |
| **Light** | `custom:fluvy-light-card` | The precision dimmer: relative drag, slide away to slow down, hold for the 1 % scale, colour temperature. Half a section wide it turns compact: the level in the head, the ruler alone. | `variant` (`auto`, `full`, `compact`), `show_temperature`, `temperature_tint`, `live_update` |
| **Thermostat** | `custom:fluvy-thermostat-card` | Climate, water heater or humidifier on a dial, with modes, presets and fan speeds. | `variant`, `modes_style`, `show_presets`, `preset_style`, `show_fan`, `fan_style` |
| **Entities** | `custom:fluvy-entities-card` | Rows of entities: a switch for what toggles, the value for what is measured. | `entities`, `secondary` |
| **Media** | `custom:fluvy-media-card` | A media player: artwork, seek bar, transport and volume — full, compact row or hero. | `variant` |
| **Now playing** | `custom:fluvy-now-playing-card` | The compact player of the home screen: artwork, thin progress, transport and volume. | — |
| **Cover** | `custom:fluvy-cover-card` | Blinds, shutters, garage doors and valves: vertical position ruler, tilt, open · stop · close, favourites. | `subtitle`, `tilt_angle` |
| **Fan** | `custom:fluvy-fan-card` | Speed ruler with steps, oscillation, direction and presets. | `subtitle`, `show_presets` |
| **Vacuum** | `custom:fluvy-vacuum-card` | Robot vacuum or mower: battery, start · stop · dock · locate, suction. | `subtitle`, `suction_style` |
| **Lock** | `custom:fluvy-lock-card` | Slide to unlock, never one accidental tap; codes, jammed state, related rows. | `rows` |
| **Alarm** | `custom:fluvy-alarm-card` | Arm modes as tiles and the keypad sheet for codes. | `rows` |
| **Camera** | `custom:fluvy-camera-card` | A still that refreshes itself, with live and time pills; tap for the stream. | `sub`, `refresh`, `rows` |
| **Weather** | `custom:fluvy-weather-card` | Condition, temperature, feels-like, wind and the daily or hourly forecast. | `name`, `forecast`, `days` |
| **Sensor** | `custom:fluvy-sensor-card` | A sensor with its 24 h curve, trend, min, max and average. | `name`, `subtitle`, `variant`, `hours`, `show_stats` |
| **Readouts** | `custom:fluvy-readouts-card` | Up to four values side by side with their trends. | `hours`, `name` |
| **People** | `custom:fluvy-people-card` | Who is home: avatars, zones and times. | `title`, `layout`, `map_path` |
| **Openings** | `custom:fluvy-openings-card` | Doors, windows and motion at a glance, with what is open counted. | `max_rows` |

## Structure and navigation

| Card | Type | What it is | Editor options |
| --- | --- | --- | --- |
| **Hello** | `custom:fluvy-hello-card` | The greeting: name, date, weather and avatar. | `name` |
| **Chips** | `custom:fluvy-chips-card` | A row of chips that navigate between views or open entities. | `label`, `path` |
| **Heading** | `custom:fluvy-heading-card` | A section title with its count and a link. | `title`, `meta`, `entities`, `path` |

## Scenes, actions and helpers

| Card | Type | What it is | Editor options |
| --- | --- | --- | --- |
| **Scene** | `custom:fluvy-scene-card` | One scene, script or button as a tile with a done state. | `meta` |
| **Scenes** | `custom:fluvy-scenes-card` | A grid of scenes and scripts. | `title`, `meta` |
| **Actions** | `custom:fluvy-actions-card` | Buttons and scripts as a list with run buttons. | `columns`, `secondary` |
| **Helpers** | `custom:fluvy-helpers-card` | Numbers, selects, texts, booleans and dates as their own controls. | `entities` |
| **To-do** | `custom:fluvy-todo-card` | A to-do list: check, add, hide the done. | `hide_completed` |
| **Timer** | `custom:fluvy-timer-card` | A timer counting down live, with pause and cancel. | `show_gauge` |
| **Updates** | `custom:fluvy-updates-card` | Pending updates with install buttons and progress. | `show_up_to_date` |

## Energy

| Card | Type | What it is | Editor options |
| --- | --- | --- | --- |
| **Energy** | `custom:fluvy-energy-card` | Power right now, the day curve and the energy legend. | `hours`, `label` |
| **Energy flow** | `custom:fluvy-energy-flow-card` | Solar, grid, battery and home with animated flows. | `grid_invert`, `battery_invert`, `flow_style`, `readouts`, `label` |
| **Energy devices** | `custom:fluvy-energy-devices-card` | Consumption per appliance as bar rows. | `sort` |
| **Gauge** | `custom:fluvy-gauge-card` | A ring gauge for any numeric sensor with min, max and average. | `name`, `subtitle`, `min`, `max`, `label`, `badge`, `hours` |
| **Stat tiles** | `custom:fluvy-stat-tiles-card` | A headline value and a grid of read-only stat tiles. | `tiles`, `badge_label`, `rows`, `highlight`, `secondary` |
| **Production** | `custom:fluvy-production-card` | Hourly production bars with the forecast behind. | — |
| **Bars** | `custom:fluvy-bars-card` | Rows with a bar each: plants, batteries, strings, levels. | `rows`, `badge_ok`, `badge_warn`, `sub`, `plain` |
| **Distribution** | `custom:fluvy-distribution-card` | One stacked bar and a legend: who draws what. | `max_rows`, `name` |
| **Humidity** | `custom:fluvy-humidity-card` | Humidity on a comfort band, with dew point and trend. | `name`, `subtitle`, `low`, `high`, `trend_hours` |

## Time

| Card | Type | What it is | Editor options |
| --- | --- | --- | --- |
| **Clock** | `custom:fluvy-clock-card` | Analog or digital, hero, side or tile, with or without weather. | `variant`, `layout`, `numerals`, `title`, `seconds`, `date`, `week`, `forecast`, `time_zone` |
| **Calendar** | `custom:fluvy-calendar-card` | Agenda, month, week, month + day, timeline, upcoming or tile. | `view`, `title`, `tile`, `first_weekday`, `days`, `start_hour`, `end_hour` |

## A minimal card

```yaml
type: custom:fluvy-tile-card
entity: light.living_room_lamp
```

Open the editor on it to see every option the tile offers — size, readouts, the tap action — with its default.

## Where they are used

The [automatic dashboard](automatic-dashboard.md) puts every one of these cards to use in a house that has one of
everything; its tests hold that promise. The [design language](../design/language.md) is what each card is built and
reviewed against.
