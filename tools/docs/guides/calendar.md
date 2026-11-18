The week and the month start on the day `first_weekday` says: a weekday, or `language` (the default: your profile's,
else your language's).

```yaml
# the week view as the next seven days
type: custom:fluvy-calendar-card
variant: week
first_weekday: today
calendars:
  - calendar.family
  - calendar.work
```

`first_weekday: today` makes the week strip today and the six days after it ("Next 7 days"). It rolls over at midnight
by itself, for a wall dashboard that is never reloaded. A month keeps your week's first day.
