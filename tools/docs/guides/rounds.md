Any entities as rounds: lit while on, its ring the level of a light, a blind or a fan, the dashed ring out of reach.

```yaml
type: custom:fluvy-rounds-card
title: Quick picks # left out, no head: the rounds stand alone
items:
  - switch.kitchen_light
  - binary_sensor.kitchen_window
  - lock.front_door
  - entity: sensor.lounge_humidity
    show_state: true # its state under its icon
  - entity: scene.movie_night
    tap_action:
      action: perform-action
      perform_action: scene.turn_on
```

- A tap flips lights, switches, fans, blinds, valves, humidifiers, sirens, automations, remotes and groups. A lock locks
  at once and asks before it unlocks. Anything else opens its details: give it a `tap_action` to run it.
- A hold opens the details.
- `variant`: `rounds` (in lines), `labels` (each with its state under it) or `row` (a list row each, the row its tap).
- `columns` caps the rounds a line; `align` stands them from the start, in the middle or from edge to edge.

### A gauge on a round

A round can draw its reading on itself: an arc round its edge, an arc from zero, a sector or a flood.

```yaml
type: custom:fluvy-rounds-card
items:
  - entity: sensor.tablet_battery
    gauge: fill # floods from its foot
    thresholds:
      - value: 20
        below: true
        tone: warning # low under 20 %
  - entity: sensor.lounge_humidity
    gauge: arc # round its edge, from the top
  - entity: sensor.hot_water
    gauge: sector # a slice of the round
    min: 30
    max: 90
  - entity: sensor.bedroom_drift # °C an hour, from −2 to +2
    gauge: zero # from the top: left under zero, right over it
    max: 2
    decimals: 2
    thresholds:
      - value: 0
        below: true
        tone: cool
        label: Cooling
      - value: 0
        tone: heat
        label: Heating
```

- `min` and `max` take a number, an entity or a template. Left out, the entity's own range is used, or 0 to 100 for a
  percentage; with `zero`, `min` is `max` below zero. With no range known the gauge draws its track alone.
- `attribute` reads a number from an attribute in place of the state (`current_temperature`); `decimals` sets how its
  reading is written.
- `thresholds` colour the gauge by its reading. A band's `icon` becomes the round's and its `label` is read out with
  the reading.
- The gauge is the round's, so it draws wherever rounds do: a room's `quick_actions`, the Rooms card, a thermostat's
  `rounds`, a car's small icons. A round that says its state draws it on its key.
