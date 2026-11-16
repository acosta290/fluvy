The cameras are those in `cameras`, else every camera of its `area`. Each tile is the camera's picture over its name
and a line that says what it sees.

```yaml
type: custom:fluvy-cameras-card
title: Outside
cameras:
  - entity: camera.driveway
    icon: mdi:fence
  - entity: camera.garden
    motion: binary_sensor.garden_person # the sensor its line reads
  - camera.terrace
  - camera.garage
columns: 2
camera_view: live # streams, not stills
max_live: 2       # the first two stream, the others keep to stills
```

- **The line**: "Motion detected" or "No motion", read from `motion`, else a motion, occupancy or presence sensor of
  the camera's device; else the camera's state ("Recording", "Offline"). `status` chooses `motion`, `state` or `none`.
- **Pictures**: a still refreshes every `refresh` seconds while it is on screen. `camera_view: live` streams the first
  `max_live` (four by default). A stream that cannot play falls back to stills and says "Stream unavailable".
- **Layout**: `columns: auto` is one in a narrow column, two from 320 px, up to four across a wide band. `variant: list`
  is a row per camera with its thumbnail; `compact` the pictures alone with their names.
- **The head's round** opens a sheet of every camera, with a switch to show them all live while the dashboard stays
  open (not with `max_live: 0`). Give the card a `hold_action` and the round runs that instead of the sheet.
