![The remote in its full, compact, row and pad layouts, light and dark](../images/1.18/remote.webp)

`entity` is the player, `remote` the remote entity that takes the keys; either alone works.

```yaml
type: custom:fluvy-remote-card
entity: media_player.living_room_tv
remote: remote.living_room_tv
volume_entity: media_player.receiver # the volume goes to the receiver
apps:
  - app: netflix
  - name: Radio
    icon: mdi:radio
    source: Live TV
custom: # keys of your own
  - name: Guide
    key: guide
```

### Where a key goes

1. The player's own service (power, volume, play, a source).
2. Else the remote, as its integration takes it: Android TV Remote, Apple TV, Roku, LG webOS, Samsung, Fire TV, Xbox.
3. Else your own `commands`.

A key nothing takes is drawn disabled. The D-pad, the channel and the controller buttons need a `remote` (or an LG
television). `icons` gives any key an icon of your own: `icons: { assistant: mdi:microsoft-xbox }`.

```yaml
# a Samsung television whose back key has another name
type: custom:fluvy-remote-card
entity: media_player.bedroom_tv
remote: remote.bedroom_tv
variant: compact
keys: [back, home, play_pause, volume_down, volume_up]
commands:
  back: KEY_RETURN
```

### Layout

| `variant` | Draws | Height at 360 px |
| --- | --- | --- |
| `full` | Everything in `groups` | 572 |
| `compact` | The head and a row of `keys` | 144 |
| `pad` | The head and the D-pad | 276 |
| `row` | A mini row with its `controls` | 76 |

`groups` picks and orders the parts: `source`, `dpad`, `transport`, `volume`, `apps`, `channel`, `custom`, and
`gamepad` (the controller's A, B, X and Y with View, Xbox and Menu beside them, never there unless you list it).

### Apps

![App rounds with their logos, the open one coloured](../images/1.19/remote-apps.webp)

Left out, `apps` shows the player's sources that name a platform (Netflix, Disney+, YouTube and about fifty more), each
with its logo. Your own take `app`, or a `source`, `key` or `tap_action`, with any `name`, `icon`, `color` or `image`.

On Android TV Remote, an app opens best by a deep link: `activity: netflix://`. Opening by application ID goes through
the Play Store, which has not opened many apps since August 2026.

`apps_names: false` keeps the circles alone; their names are still read out.

### Xbox

![An Xbox's remote in light and dark: its apps without their names, the arrow pad, the controller's A, B, X and Y with View, the Xbox button and Menu, and the playback keys](../images/1.26/remote-xbox.webp)

An Xbox takes the arrows, A, B, X, Y, View, Menu and the Xbox button (`nexus`), and opens an app by its Microsoft
Store id: Netflix, YouTube, Disney+, Prime Video and about twenty more open with `app` alone. Give any other app its id
from the console's media browser as `app_id`.

```yaml
type: custom:fluvy-remote-card
entity: media_player.living_room_xbox
remote: remote.living_room_xbox
groups: [apps, dpad, gamepad, transport, volume]
apps: [{ app: netflix }, { app: appletv }, { app: disneyplus }, { app: jellyfin }, { app: plutotv }]
apps_names: false
```
