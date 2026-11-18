![The automations card, a lamp's timers, and the sheet for a new schedule](../images/1.9/automations-one-lamp.webp)

The card lists every automation of the house (on or off, when it last ran) and the schedules Fluvy wrote, with their
days, times and next run. A schedule is a normal Home Assistant automation: it is in Settings → Automations too, and
Home Assistant's editor opens it.

```yaml
type: custom:fluvy-automations-card
show: schedules # only the schedules
variant: tiles
entities:
  - automation.good_morning
  - automation.blinds
```

**A new schedule.** Tap `+` and choose:

- What it targets, and what it does: on, off, open, close, run; a brightness or a target temperature.
- On which days: every day, workdays (the workday integration's sensor), the weekend, or days you pick.
- When: a time, or sunrise or sunset with an offset. With an end: until when (quick ends 15 min, 30 min, 1 h, 2 h).

Only administrators add, edit or delete. Everyone else sees the list, the switches and Home Assistant's dialog on a
tap. An automation edited past Fluvy's shape is still listed, as a plain row.

### A timer for one lamp

In a popup, `targets` keeps the card to one lamp: the list shows its schedules and the automations related to it, the
head says when it next turns on, and `+` opens the sheet already set to it. A timer is `+`, a time, Save.

```yaml
type: custom:fluvy-automations-card
title: Timers
targets:
  - entity: light.kitchen
    verb: 'on' # what a new schedule starts on: on, off, open, close, run
    level: 40  # the brightness it turns on to, 1 to 100 (a thermostat: temperature)
```
