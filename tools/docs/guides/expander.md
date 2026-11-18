![An expander folded and open on one surface, and a garden group in its own colour](../images/1.20/expander.webp)

The Expander folds any cards away under a head; a tap opens them. Folded, its cards are not built, so it costs
nothing.

```yaml
type: custom:fluvy-expander-card
title: Seldom used
icon: mdi:archive
entities: # counted on the head's line: "1 of 3 on"
  - light.guest_room
  - light.attic
  - switch.towel_heater
cards:
  - type: custom:fluvy-tiles-card
    entities: [light.guest_room, light.attic, switch.towel_heater]
  - type: entities
    entities: [sensor.attic_temperature]
```

- `style: card` (the default) holds every card on one surface; `plain` leaves each its own.
- `columns` (up to 4) and `gap` (px) lay the cards side by side.
- `color` colours the circle and the Fluvy cards inside that name no colour; `icon_color` the circle alone.
- A `tap_action` of its own leaves folding to the chevron.

### Folded or open

```yaml
# opens with the garage door, folds 10 minutes after you open it
type: custom:fluvy-expander-card
title: Garage
subtitle: "{{ states('cover.garage_door') }}"
remember: user # device (the default): per browser; user: per person; off
open_when:     # an entity with state, state_not, above or below
  entity: binary_sensor.garage_door
  state: "on"
close_after: 10 # minutes
cards:
  - type: custom:fluvy-camera-card
    entity: camera.garage
```

`expanded: true` starts it open. `open_when` folds it again when the condition ends, unless you touched it.

### Cards in the head

![A clock and weather as the head, open and folded, and a head opened from another card](../images/1.21/expander.webp)

`head_cards` puts cards in the head's place: a clock, a weather tile. They stay on the page while folded, and the
chevron folds.

```yaml
type: custom:fluvy-expander-card
title: Today              # names the chevron's button
chevron_position: bottom  # a "Show more" row at the foot
chevron_size: large       # 56 px, for a wall tablet
head_cards:
  - type: custom:fluvy-clock-card
    face: digital
cards:
  - type: custom:fluvy-weather-card
    entity: weather.home
```

### Open it from another card

Give the expander an `id`; any card's `fire-dom-event` opens, folds or toggles it.

```yaml
type: custom:fluvy-template-card
name: Forecast
tap_action:
  action: fire-dom-event
  fluvy_expander:
    id: forecast     # the expander's id
    action: toggle   # or open, close
```

- A card inside the expander needs no id: `fluvy_expander: toggle`.
- Several expanders with one `id` move together.
- Home Assistant's action picker lacks `fire-dom-event`: write it in YAML (the expander's editor shows the line).
- `show_chevron: false` with `tap_action: { action: none }` leaves it to another card or `open_when`.

### From expander-card

Buttons that open an expander-card keep working; only the cards change.

| expander-card | Fluvy's Expander |
| --- | --- |
| `type: custom:expander-card` | `type: custom:fluvy-expander-card` |
| `title-card` | `head_cards` (one card or several) |
| `title`, `cards`, `expanded` | The same |
| `title-card-button-overlay`, `overlay-margin` | `chevron_position` |
| `title-card-clickable` | `tap_action: {action: fire-dom-event, fluvy_expander: toggle}` on the head's card |
| `expander-card-id` | `id` |
| `storage-id` | `remember` |
| `clear`, `clear-children` | `style`: `card` (one surface) or `plain` (each its own) |
| `expanded-gap` | `gap` |
| `show-button-users` | `show_chevron: false` |
