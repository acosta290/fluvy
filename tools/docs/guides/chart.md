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

### Series

- `source`: `history`, `statistics`, `attribute` or `forecast`. Left out: a weather's forecast, else a known list in
  its attributes, else its history.
- Lists read by themselves: Nordpool, Tibber, ENTSO-E, Frank Energie, Solcast (its 10 % and 90 % as a band), and any
  list of times and values. `time_key` and `value_key` name other keys.
- `kind`: `line`, `area`, `columns` or `band` (lows and highs).
- `unit`: one the sensor's converts to, or the unit its list is written in (Solcast's kW under a kWh sensor).
- `color` takes a colour or a palette name that follows the palette: `graph-1` to `graph-12`, `accent`, `ok`,
  `warning`, `danger`, `solar`, `grid`, `battery`, `water`, `gas`, `home`.

### Window

`span`: the house's window (12 hours), `<N>h` or `<N>d` rolling to now, `today`, or `today+tomorrow` (today alone until
tomorrow's prices are out). With `collection_key` it follows a
[date picker](../energy.md#following-home-assistants-date-picker).

`thresholds` are written in the first series' unit ([thresholds](../customising.md#thresholds)); the chart style and
its fine keys are the sensor card's ([charts](../customising.md#charts)).
