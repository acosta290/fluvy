![A room's cards on one surface and a camera on a wall, each with its page marks](../images/1.22/swipe.webp)

The Swipe card holds any cards, one a page, turned by a finger, a trackpad, the keys or the page marks under them.
Only the page in view and its neighbours are built, so ten cameras cost what three do.

```yaml
# a wall's cameras, turning by themselves
type: custom:fluvy-swipe-card
loop: true   # on from the last page is the first
autoplay: 8  # seconds a page; 3 at least
cards:
  - type: custom:fluvy-camera-card
    entity: camera.driveway
  - type: custom:fluvy-camera-card
    entity: camera.garden
  - type: custom:fluvy-camera-card
    entity: camera.garage
```

```yaml
# the rooms on their own surfaces, opening on the kitchen every time
type: custom:fluvy-swipe-card
style: plain
start: 2       # counted from 1
remember: off  # session (the default) reopens on the page you left
show_indicators: false
cards:
  - type: custom:fluvy-room-card
    area: living_room
  - type: custom:fluvy-room-card
    area: kitchen
  - type: custom:fluvy-room-card
    area: bedroom
```

```yaml
# three side by side on a desktop, one more each turn
type: custom:fluvy-swipe-card
columns: 3
gap: 24
color: teal  # the page mark in force, and the Fluvy cards inside that name no colour
cards:
  - type: custom:fluvy-grid-card
  - type: custom:fluvy-batteries-card
  - type: custom:fluvy-production-card
  - type: custom:fluvy-energy-flow-card
```

- `style: card` (the default) holds the cards on one surface; `plain` leaves each its own.
- `columns` shows up to four side by side, as many as the width holds (148 px each at least).
- A drag that starts on a ruler, a dial, a map or a sideways row is theirs, as is one on anything marked
  `data-swipe="off"`.
- Autoplay waits while a finger or the pointer is on it, and never runs with reduced motion.
- The card is as tall as its tallest page, so turning never moves what is under it.
