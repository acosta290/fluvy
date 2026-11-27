![Today's and tomorrow's electricity prices, stepped, the cheapest and the dearest hours marked](../images/1.11/chart-card-nordpool.webp)

Up to six `series` on one chart: a sensor's history, its statistics, a list in its attributes, or a weather's
forecast. The past is solid, the future dashed.

```yaml
# Nordpool prices: raw_today and raw_tomorrow are read by themselves
type: custom:fluvy-chart-card
title: Electricity price
series:
  - entity: sensor.nordpool_kwh_nl_eur_3_10_021
    tone: ok # the line's colour where it is cheap
span: today+tomorrow
chart: step
thresholds:
  - { value: 0.18, tone: warning }
  - { value: 0.26, tone: danger }
highlight: both # the cheapest and the dearest window ahead
highlight_hours: 2
```

```yaml
# the measured temperature, then the forecast after it
type: custom:fluvy-chart-card
title: Temperature
series:
  - entity: sensor.living_room_temperature
    name: Living room
  - entity: weather.home # its hourly forecast
    name: Outside
    color: graph-4 # the palette's fourth series colour
span: today+tomorrow
```

```yaml
# a wall tablet's battery, its charger's plug as a strip under the chart
type: custom:fluvy-chart-card
title: Hall tablet
series:
  - entity: sensor.hall_tablet_battery
  - entity: switch.hall_tablet_charger
    kind: states # on and off as a strip, on the chart's time
    name: Charger
span: 24h
```

```yaml
# the supply's voltage before and after a voltage optimiser: a readout each, each in thresholds of its own
type: custom:fluvy-chart-card
title: Supply
series:
  - entity: sensor.grid_voltage
    name: Input
    highlight: both # its lowest and highest points
    thresholds:
      - { value: 245, tone: warning }
      - { value: 253, tone: danger }
  - entity: sensor.house_voltage
    name: House
    highlight: both
    thresholds:
      - { value: 216, tone: warning, below: true }
span: 3h
readouts: true # a readout each over the chart, in place of the legend
```

![A chart of three series with a readout each over it in place of the legend, and in dark each series' highest point marked and said under its readout](../images/1.26/chart-readouts.webp)

### Series

- `source`: `history`, `statistics`, `attribute` or `forecast`. Left out: a weather's forecast, else a known list in
  its attributes, else its history.
- Lists read by themselves: Nordpool, Tibber, ENTSO-E, Frank Energie, Solcast (its 10 % and 90 % as a band), and any
  list of times and values. `time_key` and `value_key` name other keys.
- `kind`: `line`, `area`, `columns`, `band` (lows and highs) or `states`: any entity's states (a switch, a door, a
  heat pump's mode) as a strip under the chart. On takes the series' colour, `unavailable` and `unknown` are striped,
  and `state_colors` gives a state its own: `{ heating: heat, hot_water: water, standby: none }` (`none` leaves it
  empty).
- `stat` on a history: `mean` (the default), `min`, `max` or `last`, what each point or step reads. A template sensor
  of 0 and 100 drawn with `stat: max` and `curve: step` reads 0 or 100, never a value between.
- A sensor that was `unavailable` or `unknown` leaves a gap in its line and its columns.
- `unit`: one the sensor's converts to, or the unit its list is written in (Solcast's kW under a kWh sensor).
- `color` takes a colour or a palette name that follows the palette: `graph-1` to `graph-12`, `accent`, `ok`,
  `warning`, `danger`, `solar`, `grid`, `battery`, `water`, `gas`, `home`.
- `highlight`: `min`, `max` or `both` marks the series' lowest and highest points with a dot, what is to come too, and
  says them in the value row ("High 5.4 kW · 13:00"); columns light up with their figures over them. The figures are
  the readings' own: a peak of a few seconds the line smooths over still reads, the reading now counts, and statistics
  read each period's own lowest and highest.
- `thresholds` on a series are written in its own unit and take the card's place for it.

### Window

`span`: the house's window (12 hours), `<N>h` or `<N>d` rolling to now, `today`, or `today+tomorrow` (today alone until
tomorrow's prices are out). With `collection_key` it follows a
[date picker](../energy.md#following-home-assistants-date-picker).

`readouts: true` gives two series or more a readout each over the chart, in place of the legend, as the sensor card
does for several sensors; where a column would cut a name, the legend's lines come back.

`plot_height` sets the chart's height in the full and compact layouts (120 by default, 80 to 480): the card grows or
shrinks with it. Without it, a card given a fixed number of rows in Home Assistant's Layout tab fills them, its chart
taking the room.

`thresholds` are written in the first series' unit and colour the series written in it
([thresholds](../customising.md#thresholds)); the chart style and its fine keys are the sensor card's
([charts](../customising.md#charts)).
