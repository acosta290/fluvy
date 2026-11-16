![Flights nearby as rows and as tiles](../images/1.11/items-flights.webp)

The card lists the items of a sensor's list attribute (aircraft overhead, departures, parcels), a row each, under a
head that counts them. `attribute: auto` takes the first attribute that holds a list (`flights`, `items`, `entries` or
`list` first); `items_template` gives the list as JSON instead, so any sensor works.

```yaml
# FlightRadar24: the flights preset draws itself
type: custom:fluvy-items-card
entity: sensor.flightradar24_current_in_area
title: Flights nearby
max_rows: 5
empty_text: Clear skies
```

`preset: auto` draws flights where the attribute is `flights` or the items carry a `callsign` or `flight_number`: the
callsign over the route (`AMS → BCN`), the altitude with a climbing or descending arrow, the aircraft's photo, the
nearest first. A tap opens the flight's sheet, with a link to flightradar24.com.

### A list of your own

`preset: none` and map each field: `item_name`, `item_secondary`, `item_value`, `item_unit`, `item_icon`,
`item_image`, `item_url`.

```yaml
type: custom:fluvy-items-card
entity: sensor.metro_departures
attribute: departures
preset: none
item_name: "{line} → {destination}" # words with {field}; {a|b} takes b where a is empty
item_secondary: Platform {platform}
item_value: due                      # a field alone: due, airport.city, legs.0.from
item_unit: min
sort: due
variant: compact
```

- A number is written in your locale, a date as a moment. A ` · ` part that says nothing is dropped.
- `sort` orders by a field (`sort_order: descending` to turn it); items without the field go last.
- `max_rows` (1 to 20) is the card's height, not the list's length: fewer items keep the size.
- `item_tap: none` makes the rows still; the head's tap opens the sensor's details.
