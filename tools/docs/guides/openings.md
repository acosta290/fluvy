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
- The real time of the last change: `since` and `since_pattern`
  ([templates in row text](../customising.md#templates-in-row-text)).
