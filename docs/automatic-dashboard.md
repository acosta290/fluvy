# The automatic dashboards

Five dashboards Fluvy builds by itself, each from one line of configuration:

```yaml
strategy:
  type: custom:fluvy-home      # or fluvy-rooms, fluvy-energy, fluvy-security, fluvy-wall
```

The panel's *Dashboards* tab creates any of them with one tap (as `/fluvy-auto`, `/fluvy-rooms`, `/fluvy-energy`,
`/fluvy-security`, `/fluvy-wall`); any dashboard with that raw configuration is the same thing. Each is rebuilt every
time it opens, from the registries, so a new device shows up by itself.

| Template | What it is for |
| --- | --- |
| **Home** (`custom:fluvy-home`) | the whole house: Home, Rooms, Lights, Climate, Energy, Security, Media, Agenda and Sensors, each when the house has what it shows |
| **Rooms** (`custom:fluvy-rooms`) | a card a room, a tab a floor when the house has two or more; each room opens as its own page |
| **Energy** (`custom:fluvy-energy`) | Now (the flow and the day's curve), Production, Devices, Meters |
| **Security** (`custom:fluvy-security`) | Security (the alarm, what locks, what opens, the first cameras), Cameras, Openings room by room |
| **Wall** (`custom:fluvy-wall`) | two columns for a tablet on the wall, read from a metre away: the greeting, the clock, the readings, the scenes and the rooms; the thermostat, the security rows and who is home |

## What the home dashboard builds

| View | What goes in it |
| --- | --- |
| **Home** | the greeting (your person, the date, the weather), the tabs, the lights under one heading, the appliances with their power and energy readings, the covers, the running thermostat, the temperatures, the weather and the clock, the energy flow and the solar or home energy curve, the locks and openings, and at the columns' feet the first media player, the vacuum, a to-do list and the first scene |
| **Rooms** | a card a room (its photo where the area has one), headed by floor when the house has more than one; each room opens its own page with its thermostat, lights, covers, media, appliances, readings and camera — when the house has two rooms with something in them |
| **Lights** | every light and every switch whose words say it is a light, grouped by area (indoor and outdoor when there are no areas), dimmable ones as light cards and switches as tiles; the light automations as scenes last |
| **Climate** | thermostats, water heaters and humidifiers, the weather, the temperature and humidity sensors that are not the weather service's — humidity paired with its temperature |
| **Energy** | the energy flow (solar, grid, battery, house — found by their words and by the energy dashboard's preferences), production, the energy dashboard's devices, their distribution |
| **Security** | alarm panels, locks, gates and garage doors, the openings, the cameras — when the house has an alarm, a lock, a camera or a gate |
| **Media** | what plays now, then every other player |
| **Agenda** | the calendars in a month view, the to-do lists, the timers, the scripts and automations to run by hand — when there are calendars, timers, things to run, or more than one list |
| **Sensors** | device batteries, phones, the people and the map of their zones, the openings (when there is no Security view), the plants, the helpers, the updates, the first camera |

Views a house has nothing for are left out. Every view keeps the same three columns (two on the wall), so the header
never moves between tabs, and blocks are cut into the columns so that they end on one line. A room's page is a
subview: it opens from its card, never from the tabs, and its heading leads back.

## How it reads a home

- **Words**, in every language Fluvy speaks (a house is named in its own language, whatever the UI's), the way people
  name things: a switch called *Kitchen light* is a light, one
  called *Washing machine* is an appliance; a switch called *boost*, *valve*, *beep* or *timer* is a setting, not an
  appliance.
- **Twins**: a device with a switch and an outlet of the same name shows once, with the device's power and energy
  readings beside it.
- **Places**: an entity whose name only says what it measures (*Temperature*) is named after its device or area.
- **The weather service's sensors** (the platform is a weather integration) stay out of the climate view.
- **Solar, grid, battery**: power sensors whose words say so; a grid meter that reads negative through the night is
  understood as exporting-positive and inverted. The energy dashboard's preferences win when they exist.

## Options

In the dashboard's raw configuration, or in the panel's *Dashboard* tab:

| Option | Values | What it does |
| --- | --- | --- |
| `thermostat_variant` | `dial` (default), `compact`, `ruler` | how the thermostats are drawn |
| `tile_size` | `large` (default), `compact` | the tiles' size on the Lights view and the Home view |
| `flow_style` | `ribbons` (default), `rail`, `legs` | the energy flow's drawing |
| `hide` | a list of `lights`, `climate`, `energy`, `security`, `media`, `agenda`, `sensors` | views left out (Home always stays) |
| `language` | `en`, `es`, `de`, `nl`, `fr`, `it`, `pt-BR` | the dashboard's words in that language, whoever opens it |

Without `language`, the dashboard's words follow the language of whoever opens it (Home Assistant's, or the one
chosen in the panel's *Preferences*). A house is read in every language at once: a switch called *Küche* or
*cocina* is a light's room in any of them.

## Limits

It never invents: a house without a weather entity gets no forecast, a house without energy preferences gets a flow
only if the words find its meters. A dashboard you want to shape by hand is better started by hand — add the cards
from the picker; each is documented in [the cards](cards.md).
