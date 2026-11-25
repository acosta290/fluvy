![The robot's map with its rooms and saved zones while it works, two rooms picked with Clean at the map's foot, and a zone marked by hand](../images/1.26/vacuum-map.webp)

### The map

`map` draws the robot's map under the head. Tap a room or a saved zone to pick it, several at once, then Clean; the
two rounds mark a zone by hand and pick a point to go to. Two fingers enlarge and move the map (Ctrl and the wheel,
or a double click, with a mouse); one finger scrolls the page.

```yaml
# Xiaomi with Xiaomi Cloud Map Extractor, Dreame or a Valetudo camera: the camera says its calibration and its rooms
type: custom:fluvy-vacuum-card
entity: vacuum.robot
map:
  image: camera.robot_map
```

```yaml
# Roborock (Home Assistant's own): its map is an image entity that says no calibration, so three points by hand
type: custom:fluvy-vacuum-card
entity: vacuum.roborock_s8
map:
  image: image.roborock_s8_ground_floor
  calibration:
    - { vacuum: { x: 25500, y: 25500 }, map: { x: 60, y: 214 } } # the dock, and where it is on the picture
    - { vacuum: { x: 26500, y: 25500 }, map: { x: 110, y: 214 } }
    - { vacuum: { x: 25500, y: 26500 }, map: { x: 60, y: 164 } }
  rooms:
    - id: 16
      name: Hall
      area: hall # Home Assistant's area, for vacuum.clean_area
      outline: [[24620, 22900], [27300, 22900], [27300, 25860], [24620, 25860]]
```

```yaml
# a plain floor plan: its own pixels are its measure, and an action of your own takes the numbers
type: custom:fluvy-vacuum-card
entity: vacuum.downstairs
map:
  image: /local/floor.png
  calibration: image
  controls: [names, zone]
  zone_action:
    action: perform-action
    perform_action: script.clean_spot
    data:
      zones: '[[selection]]'
      times: '[[repeats]]'
```

- `calibration`: left out, the map entity's own `calibration_points`; an entity id reads another's; three points fix
  a flat map, four one seen at an angle; `image` is a plain picture. A map that is not calibrated still shows, and
  its presets still run: only drawing and picking on it need it.
- `rooms`: left out, those the map's entity says. A room's `area` is Home Assistant's, cleaned by `vacuum.clean_area`
  where the robot takes it.
- `aspect_ratio` is the plate's shape, 4:3 by default: the card's height never comes from the picture.
- `controls: [names, zone, point]` chooses what stands on the map, `repeats` how many times a pick is cleaned.
- A Valetudo robot takes `topic: valetudo/robot`.

| Integration | Rooms | A zone | A point |
| --- | --- | --- | --- |
| Home Assistant | `vacuum.clean_area`, by area | | |
| Xiaomi Miio | `xiaomi_miio.vacuum_clean_segment` | `xiaomi_miio.vacuum_clean_zone` | `xiaomi_miio.vacuum_goto` |
| Roborock | `vacuum.send_command` with `app_segment_clean` | `app_zoned_clean`; one zone once, `roborock.set_vacuum_zoned_cleaning` | `roborock.set_vacuum_goto_position` |
| Dreame (HACS) | `dreame_vacuum.vacuum_clean_segment` | `dreame_vacuum.vacuum_clean_zone` | `dreame_vacuum.vacuum_goto` |
| Xiaomi Miot Auto (HACS), a Roborock | `xiaomi_miot.send_command` with `app_segment_clean` | `app_zoned_clean` | `app_goto_target` |
| Valetudo, with `topic` | `mqtt.publish` to `MapSegmentationCapability` | `ZoneCleaningCapability` | `GoToLocationCapability` |

- Untested on real robots: reports are welcome. A round the robot has no call for is not drawn.
- `room_action`, `zone_action` and `point_action` under `map` are calls of your own in the integration's place.

### Presets

`presets` are chips under the map, and work on a card with no map too. A tap runs one; a long press shows it on the
map, where it is drawn in its colour.

```yaml
type: custom:fluvy-vacuum-card
entity: vacuum.robot
map:
  image: camera.robot_map
presets:
  - name: Kitchen
    zone: [25500, 25000, 26500, 26500] # or zones, rooms: [16, 17], areas: [kitchen], point: [x, y]
    color: teal
    icon: mdi:silverware-fork-knife
    repeats: 2
    confirmation: true # asks first
  - name: Full clean # names nothing: starts the robot
  - name: Around the table
    tap_action:
      action: perform-action
      perform_action: vacuum.send_command
      data:
        command: app_zoned_clean
        params: '[[selection]]' # what is picked on the map, as numbers
```

- `[[selection]]`, `[[point_x]]`, `[[point_y]]`, `[[repeats]]` and `[[entity_id]]` are filled in by the card: numbers
  it computed and the card's own robot, nothing else.
- `presets: areas` is one chip for each area the robot has mapped in Home Assistant (its entity's settings).
- `show_presets`, `show_map` and `show_suction` hide a part; `presets_style: chips` sizes the chips by their words.

### The drive pad

![A robot vacuum with its battery and suction, then its drive pad in the card's place](../images/1.20/vacuum.webp)

`show_drive: true` adds a Drive command where the robot can be driven by hand. A tap is a short step; held, the robot
moves until you let go. Driving ends with Done, or after ten seconds without a press.

```yaml
type: custom:fluvy-vacuum-card
entity: vacuum.robot
show_drive: true
drive_speed: slow  # slow, normal (the default), fast
drive_style: sheet # the pad in a sheet, not in the card
```

| Integration | Drives with |
| --- | --- |
| Xiaomi Miio | `xiaomi_miio.vacuum_remote_control_*` |
| Roborock | `vacuum.send_command` with `app_rc_*` (not a Q7 or Q10) |
| Dreame (HACS) | `dreame_vacuum.vacuum_remote_control_move_step` |
| Xiaomi Miot Auto (HACS) | `xiaomi_miot.set_miot_property` (Dreame-made) or `send_command` (Roborock) |

- Untested on real robots: reports are welcome. Drive where you can see the robot.
- With Xiaomi Miot Auto a refused command is only logged, so the pad seems to do nothing.
- Ecovacs, iRobot and SharkIQ have no remote control in Home Assistant.

```yaml
# the same robot through a second integration: shown by one, driven by the other
type: custom:fluvy-vacuum-card
entity: vacuum.robot             # Xiaomi Home
drive_entity: vacuum.robot_miio  # Xiaomi Miio
show_drive: true
```

### Any other robot

`drive` names its calls: `move`, and `start` and `stop` where needed. In their data, `{{ velocity }}` (forward,
negative back), `{{ rotation }}` (left, negative right), `{{ seq }}` and `{{ random }}` are filled in by the card.

```yaml
type: custom:fluvy-vacuum-card
entity: vacuum.hallway
show_drive: true
drive:
  start:
    action: script.robot_manual_start
  move:
    action: script.robot_manual_move
    data:
      velocity: '{{ velocity }}' # 0.2 forward, -0.2 back
      rotation: '{{ rotation }}' # 45 left, -45 right
  stop:
    action: script.robot_manual_stop
  velocity: 0.2 # a full one; slow halves it, fast adds half
  rotation: 45
```

```yaml
# a Dreame-made robot on Xiaomi Miot Auto whose model the card does not tell
type: custom:fluvy-vacuum-card
entity: vacuum.robot_cleaner
show_drive: true
drive:
  move:
    action: xiaomi_miot.set_miot_property
    data:
      siid: 4
      piid: 15
      value: '{"spdv":{{ velocity }},"spdw":{{ rotation }},"audio":"false","random":{{ random }}}'
  stop:
    action: vacuum.stop
  velocity: 200
  rotation: 60
```
