Each sensor's state is said in its class's words (a door's Open and Closed, a motion's Detected and Clear, a leak's Wet
and Dry), and the head counts what needs acting on ("2 open"): an open door, window or cover, a leak, smoke, a
problem.

```yaml
type: custom:fluvy-openings-card
rows:
  - binary_sensor.bedroom_window # a window: counted when open
  - entity: binary_sensor.bedroom_window_tilt # no class: said, never counted
    name: Tilt
    icon: mdi:window-open-variant
    states:
      on: Tilted
      off: Closed
  - entity: binary_sensor.side_door_contact # no class: read as a door
    device_class: door
```

- `device_class` gives a sensor a class (`door`, `window`, `garage_door`, `opening`, `motion`, `moisture`, `smoke` …):
  its words, its icon and whether it counts.
- `states` gives words of your own, by state (`on`, `off`; a cover's `open`, `closed`). The class still decides what
  counts: with `device_class: window`, a tilted window counts as open.
- An unquoted `on:` or `off:` (read as true or false in YAML mode) works as written.

What is detected (motion, occupancy, presence, a vibration) is an event and counts as nothing, until you say it is an
alert (1.23):

```yaml
type: custom:fluvy-openings-card
alert_classes: [motion, occupancy] # these count too while on
rows:
  - binary_sensor.hall_motion # detected: the warning tone, "1 detected"
  - binary_sensor.front_door
  - entity: binary_sensor.nursery_motion
    alert: false # never an alert, whatever the card says
  - entity: binary_sensor.shed_window_tilt
    alert: true # an alert while on, though it has no class
```

- `alert_classes` adds binary sensor classes to those that alert. The head then says "2 detected" where everything
  alerting is of them, "2 alerts" with an opening among them; a row shows how long it has been on.
- A row's `alert` comes first: `true` makes its on an alert, `false` never. The card's `tone` is the alert's colour.
- The real time of the last change: `since` and `since_pattern`
  ([templates in row text](../customising.md#templates-in-row-text)).
