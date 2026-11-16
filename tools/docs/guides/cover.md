![A blind's tilt drawn as slats: part open, closed and open](../images/1.22/cover-tilt.webp)

### Tilt and presets

```yaml
type: custom:fluvy-cover-card
entity: cover.office_blind
tilt_style: slats              # the tilt drawn as the blind's slats
position_presets: [0, 50, 100] # chips under the commands
tilt_presets: [0, 50, 100]
```

The slats stand beside the position where the card is wide enough, else under the commands. `favorites` is for
places with a name of their own.

![Presets as chips, a blind counted down, and a narrow card with its tilt under the commands](../images/1.22/cover-more.webp)

### A cover counted its own way

Home Assistant counts 0 as closed and 100 as open. These keys turn the card's numbers round; the open and close
commands stay as they are.

| Key | When |
| --- | --- |
| `invert_position: true` | Your cover says 100 % when it is closed |
| `invert_tilt: true` | Its tilt says 100 % when the slats are closed |
| `direction: down` | You count how far it has come down ("35 % down") |

```yaml
type: custom:fluvy-cover-card
entity: cover.bedroom_blind
invert_position: true
direction: down
open_label: Up   # the words at the ruler's ends
closed_label: Down
```

Tiles, voice assistants and automations still read Home Assistant's numbers. Better fix the cover at its source where
you can: KNX (`invert_position`, `invert_angle`), MQTT (`position_open`, `position_closed`, `tilt_min`, `tilt_max`),
Zigbee2MQTT (`invert_cover`) or a
[template cover](https://www.home-assistant.io/integrations/cover.template/).
