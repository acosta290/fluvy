The week lives in Home Assistant, not in the card, and runs with every browser closed. It is two things you can see
in Settings:

- **A schedule helper** (Settings → Devices & services → Helpers), Home Assistant's own: the heating times of each day,
  each with the preset it heats to (`preset: comfort` in its data). Between the times, the base preset (Eco).
- **An automation** (Settings → Automations), named "Heating schedule · Bedroom": it holds the presets and their
  temperatures, and sets the thermostat each time the helper changes, and when Home Assistant starts.

```yaml
type: custom:fluvy-schedule-card
entity: climate.bedroom
variant: today          # one day's line, for a small space
first_weekday: monday
presets:                # how a preset looks on this card
  - preset: away
    icon: mdi:bag-suitcase
    tone: cool
```

**Making one.** On a thermostat with no schedule, "Create a schedule" opens the sheet on a week to start from:
workdays 06:30–08:30 and 17:00–22:30 in Comfort, weekends 08:00–23:00, Eco between. Save writes the helper (named
after the room) and its automation; Cancel writes nothing.

**Changing it.** A tap on a day opens the sheet on that day: add, move or remove its times, choose each one's preset,
copy the day to others, set the presets' temperatures, add one of your own. Two times that overlap are refused. The
switch in the head turns the automation off and on; turned on, the time it is now takes effect at once. Where the
schedule was changed in Home Assistant while the sheet was open, Save writes nothing and says so; Reload opens it again
as it is now.

- `schedule`: the helper, where the card should not find it by its automation.
- "Use the thermostat's own presets" sets the thermostat's own Comfort, Eco or Away (`preset_mode`) where it has
  them, instead of a temperature. A unit that only keeps a range heats to the preset and never cools.
- Only administrators change the schedule; everyone else reads it and may switch it.
- An automation edited by hand in Home Assistant is its own from then on: the card shows the week and says where to
  change it. A helper kept in YAML is changed in YAML.
