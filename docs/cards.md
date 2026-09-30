# The cards

Forty-one cards, listed as **Fluvy · …** in the card picker, each with a live preview and an editor form. The form is
the reference for a card's options: it shows what the card does by default, and a default you leave as it is is never
written into the configuration. In YAML, a card is `type: custom:<tag>` plus the entity or entities it draws and any
option the editor offers; the *Options* column below names them (a select's values in brackets, a list with its item
keys), and *Reads* the older names a card still accepts (read, never written back). Every entity card also takes
`entity`, `name`, `icon`, `tap_action`, `hold_action`, `tone` and `color`; a list card takes `title`. The tables are
generated from the code (`pnpm docs:cards`).

Every card holds from 300 to 520 px wide, in light and dark, in every language Fluvy speaks; `unavailable`, `unknown` and a
missing entity are drawn on purpose (a quiet surface, inert controls, a dash for the value), never as an error. Names
may be shortened with an ellipsis; values never are. A card that takes an action changes on screen first and calls
the service after; sliders and dials send on release, not per frame.

`tap_action` and `hold_action` are Home Assistant's actions: `more-info` (the default), `toggle`, `navigate`, `url`,
`perform-action` (and `call-service`, as it was written before Home Assistant 2024.8), `assist`, `fire-dom-event`
and `none`. The icon circle answers the tap and a still press on the head the hold; a tile answers both on its whole
surface. An action with a `confirmation` is asked about first, by Home Assistant's own dialog, and nothing on the
card moves before the answer.

## Customisation

Every card exposes what to show (section switches such as `show_fan`), which items appear and in which order (subset
lists such as `modes: [off, heat, cool]`), and at least one other layout through `variant`. Chip rows fill the row by
default and are content-sized on request (`preset_style`, `fan_style`, `suction_style: chips`). Cards that list rows
(lock, alarm, camera, bars, stat tiles) take a `rows` list edited with Fluvy's own rows editor.

<!-- generated:cards -->

## Everyday

| Card | Type | What it is | Options | Reads |
| --- | --- | --- | --- | --- |
| **Tile** | `custom:fluvy-tile-card` | A light, switch, cover, fan or sensor as a tile: large with a precision ruler or two readouts, compact row, or mini. | `size` (`large`, `compact`, `mini`), `readouts` | — |
| **Tiles** | `custom:fluvy-tiles-card` | A group of compact or mini tiles, two to four per row, 8 px apart. | `size` (`compact`, `mini`, `large`), `columns` (`1`, `2`, `3`, `4`, `auto`), `readouts`, `tiles` (a list: `entity`, `name`, `icon`, `tone`, `color`, `readouts`, `tap_action`, `hold_action`) | `entities` → `tiles` |
| **Light** | `custom:fluvy-light-card` | The precision dimmer: relative drag, slide away to slow down, hold for the 1 % scale, colour temperature. | `variant` (`auto`, `full`, `compact`), `show_temperature`, `temperature_tint`, `live_update` | — |
| **Thermostat** | `custom:fluvy-thermostat-card` | Climate, water heater or humidifier on a dial, with modes, presets and fan speeds. | `variant` (`dial`, `compact`, `ruler`), `modes_style` (`tiles`, `chips`, `full`), `modes` (`off`, `heat`, `cool`, `heat_cool`, `auto`, `dry`, `fan_only`), `show_presets`, `preset_style` (`full`, `chips`), `show_fan`, `fan_style` (`full`, `chips`) | — |
| **Entities** | `custom:fluvy-entities-card` | Rows of entities: a switch for what toggles, the value for what is measured. | `title`, `subtitle`, `variant` (`rows`, `compact`), `show_count`, `rows` (a list: `entity`, `name`, `icon`, `secondary`, `tone`, `color`, `tap_action`) | `entities` → `rows` |
| **Media** | `custom:fluvy-media-card` | A media player: artwork, seek bar, transport and volume — full, compact row or hero. | `variant` (`full`, `mini`, `hero`), `source_style` (`full`, `chips`), `show_source`, `show_volume` | — |
| **Now playing** | `custom:fluvy-now-playing-card` | The compact player of the home screen: artwork, thin progress, transport and volume. | `show_volume` | — |
| **Cover** | `custom:fluvy-cover-card` | Blinds, shutters, garage doors and valves: vertical position ruler, tilt, open · stop · close, favourites. | `subtitle`, `tilt_angle`, `variant` (`full`, `compact`), `favorites_style` (`full`, `chips`), `show_tilt`, `show_favorites`, `favorites`, `favorites` (a list: `name`, `position`, `tilt`) | — |
| **Fan** | `custom:fluvy-fan-card` | Speed ruler with steps, oscillation, direction and presets. | `subtitle`, `variant` (`full`, `compact`), `show_presets`, `preset_style` (`full`, `chips`), `show_oscillation`, `show_direction` | — |
| **Vacuum** | `custom:fluvy-vacuum-card` | Robot vacuum or mower: battery, start · stop · dock · locate, suction. | `subtitle`, `variant` (`full`, `compact`), `show_battery`, `battery_entity`, `area_entity`, `duration_entity`, `remaining_entity`, `suction_style` (`full`, `chips`) | — |
| **Lock** | `custom:fluvy-lock-card` | Slide to unlock, never one accidental tap; codes, jammed state, related rows. | `subtitle`, `variant` (`full`, `compact`), `show_rows`, `rows`, `rows` (a list: `entity`, `name`, `icon`, `secondary`, `tone`, `color`, `tap_action`) | — |
| **Alarm** | `custom:fluvy-alarm-card` | Arm modes as tiles and the keypad sheet for codes. | `subtitle`, `variant` (`tiles`, `compact`), `modes` (`disarm`, `arm_home`, `arm_away`, `arm_night`, `arm_vacation`, `arm_custom_bypass`), `show_rows`, `rows`, `rows` (a list: `entity`, `name`, `icon`, `secondary`, `tone`, `color`, `tap_action`) | — |
| **Camera** | `custom:fluvy-camera-card` | A still that refreshes itself, with live and time pills; tap for the stream. | `subtitle`, `refresh`, `show_rows`, `rows`, `rows` (a list: `entity`, `name`, `icon`, `secondary`, `tone`, `color`, `tap_action`) | `sub` → `subtitle` |
| **Weather** | `custom:fluvy-weather-card` | Condition, temperature, feels-like, wind and the daily or hourly forecast. | `forecast` (`daily`, `hourly`, `both`), `days`, `show_forecast` | `forecast` → `show_forecast` |
| **Sensor** | `custom:fluvy-sensor-card` | A sensor with its 24 h curve, trend, min, max and average. | `subtitle`, `variant` (`chart`, `tile`), `hours`, `show_stats` | — |
| **Readouts** | `custom:fluvy-readouts-card` | Up to four values side by side with their trends. | `hours`, `variant` (`grid`, `row`), `rows` (a list: `entity`, `name`, `tap_action`) | `entities` → `rows` |
| **People** | `custom:fluvy-people-card` | Who is home: avatars, zones and times. | `title`, `variant` (`grid`, `rows`), `map_path`, `show_zone`, `show_time` | `layout` → `variant` |
| **Openings** | `custom:fluvy-openings-card` | Doors, windows and motion at a glance, with what is open counted. | `title`, `subtitle`, `max_rows`, `show_count` | — |

## Rooms and the map

| Card | Type | What it is | Options | Reads |
| --- | --- | --- | --- | --- |
| **Room** | `custom:fluvy-room-card` | A room of the house from its area: its picture, its climate, what is on, and its controls. | `area`, `variant` (`photo`, `tile`, `row`), `controls` (`rows`, `tiles`, `none`), `show_climate`, `show_count`, `picture`, `path`, `temperature_entity`, `humidity_entity`, `size` (`large`, `compact`, `mini`), `readouts`, `tiles` (a list: `entity`, `name`, `icon`, `tone`, `color`, `readouts`, `tap_action`, `hold_action`) | — |
| **Map** | `custom:fluvy-map-card` | Where everyone is: the house’s zones as columns of faces, a row a person, or Home Assistant’s map on a plate. | `zones`, `title`, `variant` (`zones`, `map`, `rows`), `map_shape` (`wide`, `square`), `hours_to_show`, `default_zoom`, `fit_zones`, `show_empty`, `show_distance`, `map_path`, `zones` (a list: `entity`, `name`, `icon`) | — |

## Structure and navigation

| Card | Type | What it is | Options | Reads |
| --- | --- | --- | --- | --- |
| **Hello** | `custom:fluvy-hello-card` | The greeting: name, date, weather and avatar. | `person`, `weather`, `show_weather`, `show_date`, `show_avatar` | — |
| **Chips** | `custom:fluvy-chips-card` | A row of chips that navigate between views or open entities. | `chips`, `chips` (a list: `name`, `icon`, `path`, `entity`, `action`) | `label` → `name` |
| **Heading** | `custom:fluvy-heading-card` | A section title with its count and a link. | `title`, `subtitle`, `variant` (`bar`, `plain`), `path` | `meta` → `subtitle` |

## Scenes, actions and helpers

| Card | Type | What it is | Options | Reads |
| --- | --- | --- | --- | --- |
| **Scene** | `custom:fluvy-scene-card` | One scene, script or button as a tile with a done state. | `subtitle`, `show_subtitle` | `meta` → `subtitle` |
| **Scenes** | `custom:fluvy-scenes-card` | A grid of scenes and scripts. | `title`, `columns` (`auto`, `1`, `2`), `scenes` (a list: `entity`, `name`, `icon`, `subtitle`, `tap_action`) | `entities` → `scenes` |
| **Actions** | `custom:fluvy-actions-card` | Buttons and scripts as a list with run buttons. | `title`, `subtitle`, `columns`, `rows` (a list: `entity`, `name`, `icon`, `secondary`) | `entities` → `rows` |
| **Helpers** | `custom:fluvy-helpers-card` | Numbers, selects, texts, booleans and dates as their own controls. | `title`, `subtitle`, `options_style` (`full`, `chips`), `rows` (a list: `entity`, `name`, `icon`, `secondary`, `presets`) | `entities` → `rows` |
| **To-do** | `custom:fluvy-todo-card` | A to-do list: check, add, hide the done. | `subtitle`, `show_completed`, `show_add`, `show_due` | `title` → `name`, `hide_completed` → `show_completed` |
| **Timer** | `custom:fluvy-timer-card` | A timer counting down live, with pause and cancel. | `show_gauge`, `show_actions` | — |
| **Updates** | `custom:fluvy-updates-card` | Pending updates with install buttons and progress. | `title`, `subtitle`, `show_up_to_date`, `toggle`, `toggle_secondary` | — |

## Energy

| Card | Type | What it is | Options | Reads |
| --- | --- | --- | --- | --- |
| **Energy** | `custom:fluvy-energy-card` | Power right now, the day curve and the energy legend. | `subtitle`, `hours`, `variant` (`full`, `compact`), `cost_entity`, `show_cost`, `legend`, `legend` (a list: `entity`, `name`) | `title` → `name` |
| **Energy flow** | `custom:fluvy-energy-flow-card` | Solar, grid, battery and home with animated flows. | `title`, `subtitle`, `solar_power`, `home_power`, `grid_power`, `grid_invert`, `battery_power`, `battery_invert`, `battery_level`, `flow_style` (`ribbons`, `legs`, `rail`), `readouts`, `readouts` (a list: `entity`, `name`) | — |
| **Energy devices** | `custom:fluvy-energy-devices-card` | Consumption per appliance as bar rows. | `title`, `subtitle`, `sort`, `max_rows`, `rows` (a list: `entity`, `name`, `icon`, `tone`, `color`, `cost_entity`, `tap_action`) | `entities` → `rows` |
| **Gauge** | `custom:fluvy-gauge-card` | A ring gauge for any numeric sensor with min, max and average. | `subtitle`, `variant` (`ring`, `bar`), `min`, `max`, `max_entity`, `label`, `badge`, `hours` | — |
| **Stat tiles** | `custom:fluvy-stat-tiles-card` | A headline value and a grid of read-only stat tiles. | `title`, `subtitle`, `tiles`, `badge_entity`, `badge_label`, `rows`, `tiles` (a list: `entity`, `name`, `icon`, `tone`, `highlight`), `rows` (a list: `entity`, `name`, `icon`, `secondary`, `tone`, `color`, `tap_action`) | — |
| **Production** | `custom:fluvy-production-card` | Hourly production bars with the forecast behind. | `subtitle`, `forecast_entity`, `peak_entity`, `show_forecast`, `show_peak`, `variant` (`full`, `compact`) | `title` → `name` |
| **Bars** | `custom:fluvy-bars-card` | Rows with a bar each: plants, batteries, strings, levels. | `title`, `subtitle`, `rows`, `badge_ok`, `badge_warn`, `rows` (a list: `entity`, `name`, `icon`, `secondary`, `sub_entity`, `tone`, `color`, `min`, `max`, `low`, `high`, `plain`, `tap_action`) | — |
| **Distribution** | `custom:fluvy-distribution-card` | One stacked bar and a legend: who draws what. | `title`, `subtitle`, `max_rows`, `variant` (`stack`, `rows`), `entities` (a list: `entity`, `name`, `tone`, `color`) | — |
| **Humidity** | `custom:fluvy-humidity-card` | Humidity on a comfort band, with dew point and trend. | `subtitle`, `low`, `high`, `temperature_entity`, `humidifier_entity`, `hours`, `show_trend` | `trend_hours` → `hours` |

## Time

| Card | Type | What it is | Options | Reads |
| --- | --- | --- | --- | --- |
| **Clock** | `custom:fluvy-clock-card` | Analog or digital, hero, side or tile, with or without weather. | `face` (`analog`, `digital`), `variant` (`hero`, `side`, `tile`), `numerals` (`none`, `quarters`, `all`), `title`, `show_seconds`, `hour12`, `show_date`, `show_week`, `weather`, `show_forecast`, `time_zone` | `variant` → `face`, `seconds` → `show_seconds`, `date` → `show_date`, `week` → `show_week`, `forecast` → `show_forecast` |
| **Calendar** | `custom:fluvy-calendar-card` | Agenda, month, week, month + day, timeline, upcoming or tile. | `variant` (`agenda`, `month`, `week`, `month-day`, `timeline`, `upcoming`, `tile`), `title`, `tile` (`date`, `next`), `first_weekday` (`language`, `sunday`, `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, `saturday`), `days`, `start_hour`, `end_hour`, `calendars` (a list: `entity`, `name`, `tone`, `color`) | `entities` → `calendars` |

<!-- /generated:cards -->

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
