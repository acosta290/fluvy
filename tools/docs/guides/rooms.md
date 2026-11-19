Every room in one card: a row each with the room's icon, its name, its temperature and humidity, and its rounds at
the end. Left without a list, it shows every area with something in it, in the house's order of its rooms.

```yaml
type: custom:fluvy-rooms-card
default_actions: [lights, climate, covers] # each room's lights, thermostat and blinds
rooms: # left out: every area, in the house's order
  - living_room
  - area: kids_room
    name: Mia's room
    color: pink
    quick_actions: # this room's own, over default_actions
      - lights
      - climate
      - entity: media_player.kids_speaker
        icon: mdi:music
```

- An area's icon from Home Assistant (`mdi:sofa`, `mdi:bed`, `mdi:stove`) is drawn as Fluvy's room; `icon` sets
  another.
- A tap opens the room's own `path`, else its page on the Rooms dashboard (or Home's Rooms view) where the house has
  one, else the area's settings for an administrator; a room's own `tap_action` and `hold_action` come first.
- `variant`: `rows`, `compact` (48 px rows, the temperature at their end) or `tiles` (two a row from a phone's width).
- What does not fit a row gives way in order: the arrows, then the rounds from the end, then the circles.
- To fold the card away under a head, put it in an [Expander](expander.md): it remembers whether it was open.
