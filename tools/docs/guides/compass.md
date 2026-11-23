The Compass card draws a bearing on a 360° ring: the wind from a weather station, a car's heading, a dish's or the
sun's azimuth. A figure stands in the ring (the wind's speed), the point and the degrees under it.

```yaml
# a weather station: the wind, its 10-minute average beside it, three readouts under the ring
type: custom:fluvy-compass-card
name: Garden station
entity: sensor.wind_speed
direction_entity: sensor.wind_direction
secondary_direction_entity: sensor.wind_direction_10_min
stats:
  - entity: sensor.wind_gust
    name: Gusts
  - entity: sensor.wind_max_today
    name: Max today
```

```yaml
# a car's heading from its tracker, the ticks lit across it
type: custom:fluvy-compass-card
entity: sensor.model_y_speed
direction_entity: device_tracker.model_y
direction_attribute: heading
indicator: ticks
```

- `direction_entity` is read in degrees, or in English's letters for the sixteen points (`N`, `NNE` … `NNW`, in any
  case): an integration's `O` or `NO` is East in German and West in Spanish, so other letters are not guessed at. The
  sun's azimuth and a weather entity's `wind_bearing` are read on their own, and so is a weather entity's wind speed
  where the card has no `entity`; any other attribute is named with `direction_attribute`.
- Without `entity` or a weather entity, the ring reads the bearing itself ("291°" over "WNW").
- `face`: `classic` (the default) draws a compass's bezel, a band with the ticks across it and the four letters large
  outside it; `ring` draws the ticks alone with small letters in their place, as before 1.25. Where a language's
  letters are too wide for a narrow column (Polish "Wsch"), they step down together, or stand in the band's place.
- `indicator`: `arrow` (the default, laid across the ring at the bearing), `chevron` (a chevron in a ringed circle
  riding the ring), `knob`, `ticks` (the ticks lit across the bearing's sixteenth) or `dot`; the second bearing's
  `secondary_indicator` is a `dot` by default, in the secondary ink, and its `arrow` the arrow's outline.
- `arrow_points`: an arrow or a chevron points `outward` from the centre to the bearing, as a compass needle's head
  (the default), or `inward` at the figure, as the wind blows from its bearing; it turns the second's too.
- `north_offset` turns the ring for a window that does not face north: `-90` puts east at the top. The letters stay
  upright.
- In half a section the figure, the point and the degrees stand under the ring.
- `variant: compact` puts a small ring beside the figure under the head (the figure under it in a phone's narrowest
  column and in half a section), its readouts smaller; `variant: row` is one row for half a section, its circle ringed
  by the bearing, its name over the figure and the point.
