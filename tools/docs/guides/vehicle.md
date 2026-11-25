Give the card the car's `device` (or one `entity` of it). It reads Tesla Fleet, Teslemetry, Tessie, Renault, Volvo and
Škoda from Home Assistant; Kia and Hyundai, MySkoda, Polestar, MG, Volkswagen and BMW CarData from HACS. Any other car
is read by what its entities are.

```yaml
type: custom:fluvy-vehicle-card
device: 7c1e…             # or entity: one of its entities
image: /local/model-y.png # or auto: its integration's picture
controls: [lock, climate, charging, trunk, frunk]
rows: [location, odometer, inside]
show_tyres: true
low_range: 50             # in the range's unit
```

- Controls that matter ask first: unlocking, the boot, the windows, stopping a charge, sentry off.
- Nothing that could move, wake or sound the car (horn, lights, keyless driving, remote start) is ever found for a
  control: what starts the engine is named by hand (`engine`, below).
- `roles` names an entity the card did not find; with `scan: false` only those count.

A car with no device (a Nissan Leaf on Home Assistant's integration), named by hand:

```yaml
type: custom:fluvy-vehicle-card
scan: false
name: Leaf
roles:
  - { role: battery, entity: sensor.leaf_charge }
  - { role: range, entity: sensor.leaf_range }
  - { role: plugged, entity: binary_sensor.leaf_plug_status }
  - { role: charging, entity: binary_sensor.leaf_charging_status }
  - { role: climate_switch, entity: switch.leaf_climate_control }
```

### A car that burns fuel

![An electric car, a plug-in hybrid with battery and tank, and a diesel with its AdBlue low](../images/1.22/fuel.webp)

A petrol or diesel car draws its tank in the battery's place, and warns of a low tank, AdBlue, oil or a service due.

```yaml
type: custom:fluvy-vehicle-card
device: 3f9a… # an Octavia diesel on MySkoda
rows: [location, adblue, service, odometer]
low_range: 80 # km: low under this, whatever the car says
```

```yaml
type: custom:fluvy-vehicle-card
device: 51c2… # an XC60 plug-in hybrid on Volvo's
energy: hybrid # auto (the default), electric, fuel, hybrid
tank_size: 71  # litres, where the car says only what is in it
rows: [location, fuel_volume, oil, service]
```

- The tank is also found on Toyota, Ford, Mercedes-Benz and Stellantis (HACS), else by ids ending `_fuel_level`,
  `_fuel_range`, `_adblue_range`, `_oil_level`, `_distance_to_service`, else by `roles`.
- Low: the car's own warning, else under `low_range`, else 15 %.

### Its engine, its own controls, tyres, badge and small icons

```yaml
type: custom:fluvy-vehicle-card
device: 9b2d… # a Haval H6 on GWM's integration
roles:
  - { role: engine, entity: switch.haval_h6_engine }
controls:
  - lock
  - engine # asks before it starts, and before it stops
  - { entity: switch.haval_h6_seat_heating, name: Seats }
  - { entity: script.find_my_car, name: Find, confirm: true }
show_tyres: true
tyre_low: sensor.haval_h6_tyre_threshold # or 2.1, or a template
tyre_decimals: 1 # auto: the sensors' own precision
badge: "{{ 'GPS ok' if is_state('binary_sensor.haval_h6_gps', 'on') else 'No GPS' }}"
quick_actions:
  - { entity: binary_sensor.haval_h6_gps, name: GPS, icon: mdi:crosshairs-gps }
  - { entity: sensor.haval_h6_gsm_signal, name: GSM, icon: mdi:signal }
show_quick_states: true
```

- `engine` is never found: name it in `roles`. A switch starts and stops it, a button starts it; `confirm: false` on
  its control stops it asking.
- An `entity` in `controls` sits in the car's row under its name: lit while on, a tap turns it on and off (a switch, a
  script, a scene), else opens it; `confirm: true` asks first.
- `tyre_low` is in the tyres' unit (an entity in another unit of pressure is converted). A tyre under it, or the car's
  own tyre warning, says Low tyre pressure on the line.
- The tyres read as an American writes them too: `show_tires`, `tire_low`, `tire_decimals`, and the roles `tire_fl`,
  `tire_fr`, `tire_rl` and `tire_rr`.
- `badge` takes the place of what the car is doing, in the head and on the mini strip; Unavailable still shows.
- `quick_actions` sit at the foot as a room's quick actions do, as many as one line holds.

### The picture at its own size

```yaml
type: custom:fluvy-vehicle-card
device: 7c1e…
image: /local/model-y.png
image_size: 50% # a share of the card's width, or a height: 120px
show_head: false
show_hero: false
show_status: false
show_controls: false
show_rows: false # every part hidden: the card is the picture, its tap the card's
```

### A liquid, a mini map and its parts in your own order

![A car's fuel as a liquid at 58 %, and in dark a battery as a liquid while it charges, its charge limit a line across it](../images/1.26/vehicle-liquid.webp)

![A car with a mini map at its foot and its address in a pill over it, and in dark the map in the picture's place](../images/1.26/vehicle-map.webp)

```yaml
type: custom:fluvy-vehicle-card
device: 9b2d…
hero: liquid    # ruler (the default), ring, liquid
map: auto       # the car's own tracker; or an entity, or a list, the car's first
map_size: 160px # as image_size: a share of the card's width, or a height
map_zoom: 15    # 1 to 20; without it Home Assistant fits the trackers
sections: [head, map, hero, controls, tyres, rows]
```

- `hero: liquid` draws the battery or the tank as the gauges' liquid, a hybrid's both: bubbles rise while the battery
  charges, the charge limit is a line across it, and `animate: false` rests it.
- The map is Home Assistant's own, with its own tiles: no key and no account, and the car's position is never sent
  anywhere to look its address up. The pill over its foot says the address the car's integration gives (a sensor named
  in `roles` as `address`), else the place's name; `show_address: false` hides it.
- `map_interactive: false` makes it a still picture whose tap opens the tracker: a map that pans can hold a phone's
  scroll.
- `map_theme` is `auto` (the card's own mode), `light` or `dark`; `hours_to_show` draws the trail behind the car. An
  entry of the list may be Home Assistant's own (`{ entity: device_tracker.car, label_mode: icon }`).
- `sections` names the parts to draw, in their order: `head`, `image`, `map`, `hero` (its line with it), `controls`,
  `rows`, `tyres`, `quick_actions`. A part left out is not drawn; without the key the card is as it was.
