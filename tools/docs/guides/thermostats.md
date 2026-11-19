Every thermostat of the house, of a room or of a list, a row each: its room's icon and name, what it is doing, its
preset and its target, what the room measures, and the round that opens its details.

```yaml
type: custom:fluvy-thermostats-card
title: Heating
show_count: true # "2 of 4 heating"
show_average: true # "19.7° average"
house_actions: [all_off, presets]
thermostats: # left out, every climate of `area`, else of the house
  - climate.living_room
  - entity: climate.bedroom
    rounds: # after the one that opens it
      - entity: schedule.heating
        icon: mdi:calendar-clock
        tap_action:
          action: navigate
          navigation_path: /dashboard-home/climate
```

- A row is named by its room where it is the only thermostat of the card there; `names` (or its own `name`) names it
  by its entity instead.
- `control: stepper` ends each row in the target between − and +, each unit with its own step and range, sent once
  the taps settle; the room's temperature then leads the line. Where a row cannot hold it, every row ends in the
  room's temperature again.
- `house_actions`: `all_off` asks first, then turns off each thermostat that is on (its own off, else its Off mode);
  `presets` are the presets the thermostats offer between them, each saying how many offer it ("Boost 3/4"), and a
  tap sets that preset on each one that is on and offers it. A preset never turns one on.
- A thermostat out of reach keeps its row, greyed with "—", counted nowhere and left out of the house's actions.
- What it does not do yet: boosts, timers and scenes of its own temperatures. A schedule is the Heating schedule
  card's; give a row a round that goes to it.
