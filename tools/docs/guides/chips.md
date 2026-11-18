A chip's `name`, `icon` and `color` may each be a Home Assistant template, rendered live. The chip's `entity` is
`entity` in them.

```yaml
type: custom:fluvy-chips-card
chips:
  # a count that stays current
  - name: "{{ states.person | selectattr('state', 'eq', 'home') | list | count }} home"
    icon: mdi:home-account
    path: /dashboard-home/people
  # a colour that follows a state
  - name: "{{ states.light | selectattr('state', 'eq', 'on') | list | count }} lights on"
    icon: mdi:lightbulb-group
    color: "{{ 'amber' if is_state('light.kitchen', 'on') else 'grey' }}"
  # a chip that shows only while there is something to say
  - name: "{{ 'Washer done' if is_state('sensor.washer_state', 'finished') else '' }}"
    entity: sensor.washer_state
```

- A template that renders nothing leaves the chip its icon; a chip with no icon is then left out.
- A template that fails shows nothing of itself.
- `icon` takes an `mdi:` icon or a Fluvy glyph's name; `color` a colour name or `#rrggbb`.
- The row stays one line, whatever the words.
- Fluvy runs no JavaScript: a button-card label between `[[[ ]]]` shows as written. Write it as a template.
