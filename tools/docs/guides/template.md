A tile whose `name`, `secondary`, `icon`, `color` and `active` may each be a Home Assistant template. With an `entity`
it is that entity's tile, and `entity` in the templates; without one it is your words alone.

```yaml
type: custom:fluvy-template-card
entity: sensor.washer_power
name: "{{ 'Washing' if states(entity) | float > 10 else 'Washer' }}"
secondary: "{{ states(entity) | round }} W"
icon: mdi:washing-machine
color: "{{ 'blue' if states(entity) | float > 10 else 'grey' }}"
active: "{{ states(entity) | float > 10 }}" # when the tile looks on
```

- `active`: `auto` (as its entity), `always`, `never`, or a template (on unless it gives `off`, `false`, `no`, `0`).
- `color` takes a colour or a tone (`warning`, `heat`); `tint: always` keeps it at rest. A template colour goes in YAML.
- Without an entity, a tap runs only an action that needs none: `navigate`, `url`, `perform-action`, `assist`.

### From Mushroom

A Mushroom template card pastes in. Change its type, and keep it still if it should be: Fluvy's tile toggles a light
or a switch on a tap, and opens its details on a hold.

```yaml
type: custom:fluvy-template-card # was custom:mushroom-template-card
entity: light.kitchen
primary: "{{ 'Cooking' if is_state(entity, 'on') else 'Kitchen' }}" # read as name
icon_color: "{{ 'amber' if is_state(entity, 'on') else 'grey' }}"   # read as color
layout: vertical             # the mini tile (vertical: true too)
tap_action: { action: none } # as Mushroom: no tap until you give one
hold_action: { action: none }
```

`fill_container`, `multiline_secondary`, `double_tap_action` and `entity_id` are dropped when the editor saves.
