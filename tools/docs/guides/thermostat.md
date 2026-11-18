![A thermostat heating with its valve at 42 %, one held back by an open window, and climate tiles saying what they do](../images/1.21/thermostat.webp)

The badge says what the device is doing (Heating, Idle, Preheating, Defrosting), not its mode. Where the entity says
no action, it shows the mode.

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
