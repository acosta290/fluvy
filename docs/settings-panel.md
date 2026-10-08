# The settings panel

**Fluvy** in the sidebar, at `/fluvy`. Administrators see five tabs, in one row; everyone else sees Appearance (their own
palette) and Preferences.

| Tab | What it holds | Whose |
| --- | --- | --- |
| **Appearance** | palette (fifteen presets, the house's saved palettes, the community's, or a custom accent — shared as a file), shape (soft, round, crisp), button style, the dashboards' tabs (Fluvy, pills, original or hidden; names, icons or both; the dashboard's name), the sidebar and header (Home Assistant's logo, dividers, the header on the page); a live preview on real cards (its little house answers a tap itself: nothing at home changes) | the house; a person may keep their own palette and shape |
| **Scope** | dashboards only or everywhere; which dashboards when "only"; the frame, the icons, the Activity page, the History page | the house |
| **Dashboards** | the five automatic dashboards: create any with one tap, open it, its options, its sidebar entry, recreate it | the house |
| **Wall** | what this device is (a wall panel, its address to open on the tablet), which dashboards are walls, the screensaver (with a preview of it), the way out (a × in the corner, or a long press), the way back from a subview (a button with its name, or Home Assistant's header), day and night, the background; the preview shows the wall as it would be now, in its night when it is night — see [wall mode](wall.md) | the house; *this device* is the tablet's own |
| **Preferences** | language of the cards (a dropdown: *Automatic* follows Home Assistant, or one of Fluvy's), motion, haptics, a link to improving a translation; *This device · Size*: how large this screen reads its dashboards (90 to 150 %, the view alone — see [wall mode](wall.md)); *Fluvy*: the version, the shell's health, export and import of the settings, the house's reset | each person; *this device* is the screen's own; import and reset are an administrator's |

## House and person

The **house settings** are what an administrator sets: everyone sees them. The **personal settings** are each person's,
on every device they sign in on: a palette, a shape and tabs of their own, or the house's; language; motion; haptics.
The look a person sees is the house's, with their own choices on top. A **device setting** belongs to one browser
alone — whether it is a wall panel, and the size it reads at — and never follows a person.

## Where they are stored

In Home Assistant's own frontend data, not in a file of Fluvy's: the house under `frontend/set_system_data`
(key `fluvy`, writable by administrators), the person under `frontend/set_user_data` (key `fluvy`). Every browser
subscribes to both, so a palette changed on the desktop recolours the phone at once. What is stored is parsed and
never trusted: a value that does not make sense falls back to its default. A copy of the last applied look is kept in
the browser (`localStorage`, `fluvy:look`) only so that the page paints in the right colours before Home Assistant
answers.

## "Everywhere" and the theme

Home Assistant's own pages take Fluvy's design only while the theme Home Assistant wears for that person is **Fluvy**
— their profile's theme, or the house's default. With another theme, every Home Assistant page keeps that theme and the
look stays on Fluvy's dashboards, as with "only dashboards". The panel says so, and offers the Fluvy theme through the
profile's own theme picker; it never changes anyone's theme by itself.
