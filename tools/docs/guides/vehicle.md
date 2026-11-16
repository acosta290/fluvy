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
- Nothing that could move, wake or sound the car (horn, lights, keyless driving, remote start) is ever a control.
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
