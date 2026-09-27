# The settings panel

**Fluvy** in the sidebar, at `/fluvy`. Administrators see five tabs; everyone else sees Appearance (their own
palette) and Preferences.

| Tab | What it holds | Whose |
| --- | --- | --- |
| **Appearance** | palette (fifteen presets or a custom accent), shape (soft, round, crisp), button style; a live preview on real cards | the house; a person may keep their own palette and shape |
| **Scope** | dashboards only or everywhere; which dashboards when "only"; the frame, the icons, the Activity page, the History page | the house |
| **Dashboard** | create or recreate the automatic dashboard; its options | the house |
| **Preferences** | language of the cards, motion, haptics, swiping between views | each person |
| **About** | version, the shell's health, export and import of the settings | — |

## House and person

The **house settings** are what an administrator sets: everyone sees them. The **personal settings** are each person's,
on every device they sign in on: a palette and a shape of their own, or the house's; language; motion; haptics; swiping between a dashboard's views. The
look a person sees is the house's, with their own choices on top.

The language chosen here reaches every word Fluvy draws — the cards, the pages, this panel — and, with it, their dates
and numbers. Home Assistant's own words (entity states, its pages, its dialogs) keep the language of the profile.
*Automatic* takes Home Assistant's language, and English where Fluvy does not speak it yet (see
[translating](translating.md)).

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
