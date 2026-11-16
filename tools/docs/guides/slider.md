The slider card sets any value on the light card's ruler: a media player's volume, a `number` or `input_number` in its
own range and step, or a fan's speed.

```yaml
# a soundbar whose volume is a number and whose power is a switch
type: custom:fluvy-slider-card
entity: number.soundbar_volume
toggle_entity: switch.soundbar_power
name: Soundbar
variant: compact
live_update: true # sends while you drag, not only on release
```

```yaml
# a player's volume, kept under 60 %
type: custom:fluvy-slider-card
entity: media_player.living_room
max: 60
```

- `min` and `max` narrow the ruler within the entity's range. `label` names the figure (Volume, Speed or Value by
  default).
- `control: auto` puts what fits at the head's end: mute for a player, the switch for a fan, or `toggle_entity`'s
  switch. `mute`, `switch` or `none` ask for one.
- A range across zero (an offset of −2 to +2) is lit from zero to the knob, its figures signed.
- `variant: compact` keeps the head and the ruler; `tile` is a large tile with the ruler at its foot.
- `tint`: the colour on the surface while what it sets is on (`on`, a tile's default), at rest too (`always`), or never
  (`off`, the full and compact card's default).
