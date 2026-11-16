The card draws the house's energy as Home Assistant's usage graph does: a column for each hour of a day, each day of a
week or a month, each month of a year. Above the line, where the house took it from (the sun, the battery, the grid on
top); below, what went into the battery and out to the grid. The figures are the Energy dashboard's, slot by slot.

```yaml
type: custom:fluvy-energy-usage-card
period: week   # day (the default), week, month, year
compare: true  # last week as ghost columns behind this one
sources:
  - { type: solar, name: Roof }
  - battery
  - { type: grid, color: '#7c5cff' }
```

```yaml
# following a date picker on the dashboard: its range, its Compare
type: custom:fluvy-energy-usage-card
collection_key: energy_casa
variant: compact
```

- `sources` lists the sources in the order they stack, each with its `name`, `color` (a palette name follows the
  palette) and `show`. Left out: every source of the Energy dashboard. Past `max_sources` the last fold into "Other".
- `show_returns: false` leaves out what went out; `show_legend: false` the legend.
- `variant: compact` is the chart and its axis; `mini` a strip under the head.
- `mode: flows`, `plot_height` and water or gas (`kind`) are in [the energy cards](../energy.md#the-cards); following
  a picker in [following Home Assistant's date picker](../energy.md#following-home-assistants-date-picker).
