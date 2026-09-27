# Activity and History

Two of Home Assistant's pages, drawn in Fluvy's idiom: **Activity** at `/logbook` and **History** at `/history`.
They replace the built-in pages while the house wants them (*Scope* tab); switching either off gives Home Assistant's
own page back at once.

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

## Both

- They use Home Assistant's own APIs (`logbook/event_stream`, `history/*`) and remember their pickers where Home
  Assistant remembers its own, so switching back and forth loses nothing.
- Spanish and English, Home Assistant's own state words.
- On a phone the filters fold into a sheet; on a wall tablet the page is one scroll, never a scroll in a scroll.
