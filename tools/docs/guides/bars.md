A row's range and its limits may come from the house: `min`, `max`, `low` and `high` each take a figure, an entity
whose reading it is, or a Home Assistant template whose answer it is, kept live (the row's entity is `entity` in it).
The head's badge takes your own words, an entity's state or a template too.

```yaml
# each room against limits the house keeps in helpers; the badge says what the dehumidifier is doing
type: custom:fluvy-bars-card
title: Humidity
icon: mdi:water-percent
badge: "{{ 'Drying' if is_state('switch.dehumidifier', 'on') else '' }}"
badge_warn: "{count} to air"
rows:
  - entity: sensor.bedroom_humidity
    low: input_number.humidity_low
    high: "{{ states('input_number.humidity_high') }}"
  - entity: sensor.bathroom_humidity
    low: input_number.humidity_low
    high: "{{ states('input_number.humidity_high') | int + 10 }}" # a bathroom runs damper
```

- An entity in another unit of the same kind is converted: a limit in kW for a row in W.
- A limit whose template fails, or answers no figure, is its default: 20 % for a battery and a plant's soil, none for
  any other reading. While its answer is still to come it warns of nothing, and the badge waits for the count.
- A badge that says nothing (an empty answer, a template that fails) leaves the word to `badge_ok` or `badge_warn`,
  then to the card's own. `{count}` is filled in after the template has answered.
