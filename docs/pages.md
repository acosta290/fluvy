# Activity, History and the details dialog

Two of Home Assistant's pages, drawn in Fluvy's idiom: **Activity** at `/logbook` and **History** at `/history`; and
the history in Home Assistant's **details dialog**, the one a tap on an entity opens. They replace the built-in ones
while the house wants them (*Scope* tab); switching any of them off gives Home Assistant's own back at once.

## Activity

The logbook as a timeline: entries grouped by hour, each with the thing that changed, what happened, and who or what
caused it — a person, an automation, a script, a service call — the way Home Assistant's logbook knows it. A search
narrows the day; the sources filter keeps only the areas, devices or entities you care about; the date picker and the
‹ › arrows move by day. New entries arrive live. **Export** writes the shown day as CSV.

## History

The history page as a set of charts and state lines: sensors as curves, on/off things as coloured stretches, grouped
by device or by area, with a legend that expands. A scrub cursor reads every curve at one moment; a mark sits at its
value; a curve reaches the window's own highest and lowest reading; nothing is read past the end of the record. The
range picker offers the usual windows and a custom one; the search and the sources filter work as on Activity.

## Both pages

- They use Home Assistant's own APIs (`logbook/event_stream`, `history/*`) and remember their pickers where Home
  Assistant remembers its own, so switching back and forth loses nothing.
- Every language Fluvy speaks (see [translating](translating.md)), Home Assistant's own state words.
- On a phone the filters fold into a sheet; on a wall tablet the page is one scroll, never a scroll in a scroll.

## The details dialog

A tap on a card (Fluvy's or Home Assistant's) or on an entity in Settings opens Home Assistant's details dialog. Since
1.20 its **History** block is Fluvy's (#162); everything else in the dialog stays Home Assistant's: its head, the gear
and the menu, the state row, a light's or a cover's controls, the logbook and the attributes. The block is the same
in the dialog's main view and in the history view a light, a cover or a player opens with the chart button.

- **The window**: chips for the house's window (*Charts* tab, 12 hours from the factory), a day and a week. The one
  chosen is kept for the next dialog until the page reloads. **Open in History** opens the History page on the same
  entity and the same window.
- **A measure** (a temperature, a power) is its line in the house's chart style, read by hand: a finger or the mouse
  on it (or the arrow keys) shows the reading and its time in the bubble. The head says how much it moved over the
  window; under the chart, its lowest, highest and average. Where Home Assistant keeps statistics (a sensor with a
  `state_class`) it reads their five-minute averages, as Home Assistant's own block does, and their hourly averages
  over a week; elsewhere the states themselves.
- **A meter** (`state_class: total` or `total_increasing`: energy, water, gas) is read by what it gained: a bar each
  hour (each day over a week), the hour still running paler. **Per hour · Total** turns it into the meter's running
  total, a line that **breaks where the meter was reset** (a daily yield at midnight), a dotted hairline marking it,
  never a slope down a cliff. The head says what it gained today; under the chart, what it gained in the window, its
  best hour (or day) and the average.
- **Anything else** (a door, a lamp, a select, a person) is a band of the stretches it spent in each state: on in the
  accent, doing something quieter in the neutral ink, unknown striped. The head says how long it was on (open,
  playing …) or how often it changed; the bubble reads the stretch under the cursor.
- A climate, a humidifier and a water heater keep Home Assistant's block: their history is their attributes through
  time (temperatures and targets), which Home Assistant draws.
- It is drawn again every minute and at every change of the entity, its last reading always the one now.

**Off.** *Scope › Everywhere › Our chart in the details dialog* gives Home Assistant's block back at once, for
everyone. In a settings file (*Preferences › Fluvy › Export*) it is the house's `details`:

```json
{ "fluvy": 1, "house": { "details": false } }
```

If a Home Assistant release reshapes the dialog's history block, Home Assistant's block simply stays, and the
browser's console says why once (`[fluvy] fluvy-details-history stepped aside: …`).
