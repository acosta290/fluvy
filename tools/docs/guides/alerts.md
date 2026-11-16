![Alerts as tiles, chips, rows under a head, and a banner](../images/1.9/alerts-tiles-chips-banner-rows.webp)

Each alert is one line: a ready-made `preset`, or a matcher of your own. That one line drives its count, its list in the
sheet and its buttons.

```yaml
type: custom:fluvy-alerts-card
alerts:
  - preset: unavailable
    domain: light          # a preset narrowed to the lights
    name: Lights unavailable
  - preset: low_battery
  - preset: open
    for: { minutes: 15 }   # only once open for 15 minutes
  - preset: errors
  - preset: updates
```

- **Presets**: `low_battery`, `unavailable`, `open`, `unlocked`, `hazards`, `errors`, `updates`, `lights_on`,
  `ha_alerts` (Home Assistant's `alert` entities), `repairs` (for administrators).
- **Waiting**: `unavailable` and `open` show after five minutes, `unlocked` after ten. `for` sets your own; `for: 0`
  shows at once.
- **Your own matcher**: ids, `entity_id` patterns, `domain`, `device_class`, `integration`, `area`, `floor`, `label`,
  `device`, `state`, `above`, `below`, `attribute`, `for` …; `conditions` take Home Assistant's visibility shapes.
- **Severity**: `critical`, `warning`, `info`. `escalate` raises an alert after a while or past a count.
- **Layout**: `variant` is `tiles` (the default), `mini`, `chips`, `rows` under a head, or a `banner` that turns
  through them.
- **All clear**: the card hides itself; `hide_empty: false` keeps an "All clear" tile.
- **A tap** opens the alert's sheet, with a button for each entity (Lock, Close, Install) and one for all. A long press
  opens every alert.
- **Snooze** for an hour, eight hours, until tomorrow morning or until it changes. It follows you to every device;
  `snooze: device` keeps it on this one.
