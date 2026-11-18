Give the card the appliance's `device`, or one `entity` of it. It finds the rest by its integration (LG ThinQ, Home
Connect, Miele, SmartThings, LocalThings, Matter, Whirlpool, Tuya, hOn, Electrolux, PetKit, PETLIBRO) or by the
entities' names.

```yaml
type: custom:fluvy-appliance-card
device: 1f2c… # or entity: one of its entities
kind: washer  # auto by default
rows: [program, water, energy]
```

- Buttons appear only where the integration says exactly how: start, pause, stop, power, the light.
- `picture_min: 44` keeps the picture at 44 px or more in a narrow column; a long name ends in "…" instead.
- An administrator gets a bell by the time left: "Tell me when it's done" writes an automation that notifies them.

### When the card guesses wrong

`kind` says what it is. `roles` names an entity for a role, or `none` to drop one it found. `scan: false` reads only
what you name. A helper on the device plays a role only where the integration has nothing for it.

```yaml
# a dishwasher that starts even with its remote start off
type: custom:fluvy-appliance-card
device: 3c5d…
roles:
  - role: remote
    entity: none # the rest as found
```

```yaml
# buttons of your own: a device's buttons, a helper's or a script
type: custom:fluvy-appliance-card
device: 9a7e…
scan: false
show_controls: true
roles:
  - { role: state, entity: sensor.dishwasher_machine_state }
  - { role: start, entity: button.dishwasher_start }
  - { role: pause, entity: button.dishwasher_pause }
  - { role: stop, entity: script.dishwasher_stop }
```

### Asking first

`confirm` lists the commands that ask in Home Assistant's dialog first: `start`, `resume`, `pause`, `stop`, `off`,
`feed`, `clean`, `level`.

- Left out: a stop asks, and so do switching off while it runs (a fridge at any time), a meal, a clean, a levelling
  and a litter box's resume. An oven, a microwave and an air fryer also ask before they start.
- A list replaces that set, so include `off`. `confirm: []` asks for nothing.

```yaml
type: custom:fluvy-appliance-card
entity: switch.washer_power
variant: row
confirm: [start, stop, off]
```

### Any device

![A Decent espresso machine over MQTT, read as a coffee machine](../images/1.14/any-device.webp)

The picker lists every device with a sensor or a switch, whatever its integration. Set `kind`, and name in `roles`
what the card did not find. More readings go in `rows` as `entity` rows.

```yaml
type: custom:fluvy-appliance-card
device: 4b9e… # Decent Espresso DE1PRO over MQTT
kind: coffee
drinks: [Default, Londinium, Blooming espresso]
rows:
  - last_brew
  - entity: sensor.decent_espresso_de1pro_de1_steam_temperature
    name: Steam
roles:
  - { role: state, entity: sensor.decent_espresso_de1pro_de1_state }
  - { role: power, entity: switch.decent_espresso_de1pro_de1_on }
  - { role: program, entity: select.decent_espresso_de1pro_de1_profile }
```

### Feeders, fountains and litter boxes

![A pet feeder: food left, next meal, last meal, fed today and its desiccant](../images/1.13/pets.webp)

`kind: feeder`, `fountain` or `litter_box`, found on PetKit and PETLIBRO. Two `tiles` show what is left; the round is a
meal, a clean or a resume, each asked first.

```yaml
type: custom:fluvy-appliance-card
device: 9a41… # a PetKit or PETLIBRO feeder
tiles: [food, next_meal]
rows: [last_meal, fed_today, desiccant]
feed_amount: 20 # a PetKit meal; PETLIBRO uses the device's amount
low_days: 5     # a part is "soon" within 5 days (7 by default)
```

Readings: `last_meal`, `next_meal`, `fed_today`, `drank_today`, `purified`, `pump`, `last_use`, `uses_today`. Parts:
`food`, `desiccant`, `water_tank`, `water_filter`, `litter`, `waste`, `deodorant`, `clean`, `filter`.

### The appliances card

Lists the house's appliances (or those in `appliances`), what needs a hand first.

```yaml
type: custom:fluvy-appliances-card
variant: cards # each appliance as its whole card, side by side
show: active   # only the busy ones
```
