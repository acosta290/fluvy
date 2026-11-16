The line under the title is the player's own: who made what plays, else its state. `secondary` puts your own line
there, in every layout: words, a template (the player is `entity` in it), or an entity, said as its state with its
unit.

```yaml
type: custom:fluvy-media-card
entity: media_player.lounge_tv
variant: mini
secondary: sensor.lounge_tv_status # or "{{ state_attr(entity, 'source') }} · {{ states('sensor.soundbar_volume') }}"
```

- Words that do not fit lose their last ` · ` parts, then end in "…".
- A television (`device_class: tv`) that is on but plays nothing Home Assistant can name is titled by its app or
  input, else its name.
- `image` shows a picture of your own where the player has no artwork
  ([pictures of your own](../customising.md#pictures-of-your-own)).

The Now playing card takes neither `secondary` nor `image`: use the Media card for those.
