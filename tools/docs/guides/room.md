The room card draws a room from its `area`: its lights, powered switches, fans, covers, players, thermostats and
vacuums. Never a sensor.

```yaml
type: custom:fluvy-room-card
area: kitchen
exclude: [switch.dishwasher_*] # ids, patterns, device ids or domains
include: [switch.coffee_machine] # from any area
```

### Quick actions

![Rooms with rounds for their lights, blinds and a fan, each ringed by how much is on](../images/1.13/quick-actions.webp)

Rounds at the end of the head, each switching its set and ringed by how much is on. By default the room's lights and
blinds.

```yaml
type: custom:fluvy-room-card
area: living_room
quick_actions:
  - lights            # or covers, fans, media
  - scene.movie_night # a scene or a script runs on a tap
  - entity: switch.kettle
    name: Kettle
    color: '#e2725b'
```

A tap turns a set off while any of it is on, else on; blinds open, close or stop; players pause or play. A hold opens
the details.

### Quick actions with their state

![Rooms whose rounds say a temperature, a humidity, a light's level and an open door](../images/1.22/room-states.webp)

```yaml
type: custom:fluvy-room-card
area: hall
show_quick_states: true      # or show_state: true on one round
quick_state_position: beside # under (the default) makes the head 20 px taller
quick_actions:
  - lights
  - binary_sensor.front_door
  - entity: sensor.hall_co2
    show_state: false        # this one stays a round
```

### Picture and readouts

```yaml
type: custom:fluvy-room-card
area: living_room
variant: photo
name_position: top    # the foot is left to the quick actions
readout_labels: icons # auto, words, icons or none
```

On the automatic dashboards, `rooms` (by area id) tunes each room the same way:

```yaml
strategy:
  type: custom:fluvy-home
  room_name_position: top # every room
  rooms:
    kitchen:
      exclude: [switch.dishwasher_*]
      name_position: bottom # this room
```
