![A robot vacuum with its battery and suction, then its drive pad in the card's place](../images/1.20/vacuum.webp)

### The drive pad

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
