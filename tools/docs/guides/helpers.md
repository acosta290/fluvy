![A select of thirty oven modes opened as a dropdown, and selects of a few options as chips](../images/1.13/dropdown.webp)

Each helper is drawn as its own control: a number with its −, + and ruler, a text as its field, a switch, a date or a
time, a button as a row, and a select as chips. A select of more than six options opens a dropdown instead.

```yaml
type: custom:fluvy-helpers-card
rows:
  - entity: select.oven_cooking_mode
    name: Upper zone
    options: [conventional, fan_conventional, grill, pizza] # four of thirty, in this order: chips
  - entity: select.tv_picture_mode
    display: dropdown # auto (chips up to six), chips or dropdown
    labels:
      gen_589828: AI Mode # words of your own for a raw option
```

- `options` offers a part of the select's options, in your order. Options the select does not list are left out.
- In the dropdown, the arrow keys and Enter choose, a letter jumps to the next name, Escape closes it unchanged.

A select's row on the Entities card, and among the lock, alarm and camera cards' rows, opens the same dropdown and takes
the same `options` and `labels`:

```yaml
type: custom:fluvy-entities-card
rows:
  - entity: select.oven_cooking_mode
    options: [conventional, fan_conventional, grill, pizza]
    labels:
      fan_conventional: Fan oven
```

A row with a `tap_action` of its own keeps it, and still shows its value in its `labels`.

A number's value can be typed too (1.23): `number_entry: true` makes it a button that opens the keypad, and the figure
typed is sent once it is on the helper's grid and inside its range (Enter or leaving the field; Escape lets it go). A
counter keeps its − and +.

On the Entities card, a number's row (an `input_number`, a `number`, a `counter`) can end in its value between − and +
or in a value to type, for every number of the card or for one row:

```yaml
type: custom:fluvy-entities-card
title: Heating presets
number_control: stepper # value (the default), stepper or entry
rows:
  - input_number.heating_comfort
  - input_number.heating_eco
  - entity: input_number.heating_away
    number_control: entry # this row typed
```

The controls of a card stand at one width, laid out for the widest figure each can show; where one of them would leave
its name too little room (half a section, a long name), every row says its plain value instead.
