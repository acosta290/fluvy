![A thermostat heating with its valve at 42 %, one held back by an open window, and climate tiles saying what they do](../images/1.21/thermostat.webp)

The badge says what the device is doing (Heating, Idle, Preheating, Defrosting), not its mode. Where the entity says
no action, it shows the mode.

### The room first

For a card you read more than you set: the room's temperature as the large figure, the target as − and + beside it.

```yaml
type: custom:fluvy-thermostat-card
entity: climate.living_room
variant: compact      # or ruler; the dial draws both already
focus: current        # the room large, − 24° + beside it
modes_style: icons    # the modes in one row, an icon over each word
fan_style: chips      # each fan speed a chip of its own size
readouts:             # up to four, on one row under the value
  - sensor.living_room_humidity
  - sensor.heat_pump_power
  - entity: sensor.heat_pump_on_today
    name: On today
```

- Where − and + with the target do not fit (half a section on a phone), the target is the large figure again, the
  room in its label.
- `modes_style: icons` shows only the icons where a word does not fit; seven modes take two rows.
- A readout is named by its `name`, else by its sensor's name without the card's ("Living room humidity" on the
  living room's card reads "humidity"). It takes an `icon`, a `tone`, a `unit`, `decimals` and actions; a tap opens
  its sensor.

"On today" is a [History stats](https://www.home-assistant.io/integrations/history_stats/) sensor of the time the
heat pump spent heating today (set its unit to minutes in its settings):

```yaml
# configuration.yaml
template:
  - binary_sensor:
      - name: Heat pump heating
        state: "{{ state_attr('climate.living_room', 'hvac_action') == 'heating' }}"
sensor:
  - platform: history_stats
    name: Heat pump on today
    entity_id: binary_sensor.heat_pump_heating
    state: "on"
    type: time
    start: "{{ today_at() }}"
    end: "{{ now() }}"
```

### What it is doing

Each is off until asked for, and none makes the card taller.

| Key | Says | Found on |
| --- | --- | --- |
| `show_valve: true` | "Heating · 42 %" | The climate (ZHA, Netatmo), a valve sensor of its device, or Better Thermostat's valves |
| `show_window: true` | "Window open" | The climate (Better Thermostat too), or a window sensor of its device |
| `show_battery: true` | "Battery 8 %", at 20 % or less | The battery sensor of its device |

Where nothing is found, name it: `valve_entity` (or `valve_attribute`), `window_entity`, `battery_entity`.

```yaml
# a room behind Better Thermostat
type: custom:fluvy-thermostat-card
entity: climate.bedroom
show_valve: true
show_window: true
show_battery: true
```

Many air conditioners send no `hvac_action`, and their badge says the mode ("Heat") where it would say "Heating" or
"Idle". Name what knows, `state_entity`: a switch that is on while it heats, or a sensor whose state is `heating`,
`idle`, `cooling`.

```yaml
# a thermostat that reports no action: its heater's switch says it
type: custom:fluvy-thermostat-card
entity: climate.hallway
state_entity: switch.hallway_heater   # or a sensor whose state is heating, idle …
humidity_entity: sensor.hallway_humidity
```

### On tiles and rooms

```yaml
type: custom:fluvy-tiles-card
show_action: true # "Heating · 21.5°" on each climate or humidifier tile
tiles:
  - climate.living_room
  - entity: humidifier.nursery
    show_action: false # this one keeps its state
```

The room card takes `show_action` for its climate row; on the automatic dashboards it is
[`thermostat_state: detailed`](../automatic-dashboard.md#options).
