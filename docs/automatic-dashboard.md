# The automatic dashboard

A dashboard whose configuration is one line:

```yaml
strategy:
  type: custom:fluvy-home
```

The panel's *Dashboard* tab creates it as `/fluvy-auto` with one button; any dashboard with that raw configuration
is the same thing. It is rebuilt every time it opens, from the registries, so a new device shows up by itself.

## What it builds

| View | What goes in it |
| --- | --- |
| **Home** | the greeting (your person, the date, the weather), the tabs, the lights under one heading, the appliances with their power and energy readings, the covers, the running thermostat, the temperatures, the weather and the clock, the energy flow and the solar or home energy curve, the locks and openings, and at the columns' feet the first media player, the vacuum, a to-do list and the first scene |
| **Lights** | every light and every switch whose words say it is a light, grouped by area (indoor and outdoor when there are no areas), dimmable ones as light cards and switches as tiles; the light automations as scenes last |
| **Climate** | thermostats, water heaters and humidifiers, the weather, the temperature and humidity sensors that are not the weather service's — humidity paired with its temperature |
| **Energy** | the energy flow (solar, grid, battery, house — found by their words and by the energy dashboard's preferences), production, the energy dashboard's devices, their distribution |
| **Security** | alarm panels, locks, gates and garage doors, the openings, the cameras — only when the house has an alarm, a lock, a gate or openings |
| **Media** | what plays now, then every other player |
| **Agenda** | the calendars in a month view, the to-do lists, the timers, the scripts and automations to run by hand — when there are calendars, timers, things to run, or more than one list |
| **Sensors** | device batteries, phones, the people, the openings (when there is no Security view), the plants, the helpers, the updates, the first camera |

Views a house has nothing for are left out. Every view keeps the same three columns, so the header never moves
between tabs, and blocks are cut into the columns so that they end on one line.

## How it reads a home

- **Words**, in English and Spanish, the way people name things: a switch called *Kitchen light* is a light, one
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

The dashboard's words follow the language of whoever opens it (Home Assistant's, or the one chosen in the panel's
*Preferences*).

## Limits

It never invents: a house without a weather entity gets no forecast, a house without energy preferences gets a flow
only if the words find its meters. A dashboard you want to shape by hand is better started by hand — add the cards
from the picker; each is documented in [the cards](cards.md).
