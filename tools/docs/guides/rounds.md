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
