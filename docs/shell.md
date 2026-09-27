# Everywhere

With the scope set to **everywhere**, Home Assistant's own pages take Fluvy's design while the theme Home Assistant
wears for you is Fluvy. This is the shell: a set of stylesheets the module attaches to Home Assistant's own components
— never a modified copy of them — that follow the theme and can be switched off piece by piece.

## What it restyles

- **The sidebar and the header**: Fluvy's glyphs for the built-in panels, the theme's colours, the type.
- **The frame**: the app steps 16 px inside the window, with a rounded opening and a hairline, and one scroll per
  page. It is the *Frame* switch in the *Scope* tab.
- **Icons**: the Material icons Home Assistant draws in its chrome (menus, pencils, close, back, search…) are shown
  as Fluvy's glyphs. The *Icons* switch.
- **Settings and its lists**, the notifications drawer, the quick search, the pickers, the code editor.
- **Forms and dialogs**: fields, selects, menus, switches, sliders, dialog footers, creation forms.
- **Dashboards in edit mode**: the edit bar, the frames of what can be edited, what adds and what edits.
- **Panels in a frame** (HACS): they get Inter and a shell of their own.
- **The Activity and History pages** (see [pages](pages.md)), with their own switches.

## What it never does

It never changes what a page does, never intercepts a click, and never persists anything. Every sheet is attached
while the shell is on and removed when it is off or when the page's theme is not Fluvy.

The one gesture it adds is **swiping between a dashboard's views** on a phone: the view follows the finger, and
letting go past a third of the width (or a flick) opens the next tab. A drag that begins on a ruler, a dial, a
slider, a scrolling row of chips or a map is theirs, a drag that leans vertical stays a scroll, and the screen's
edges are left to the system's back gesture. It is each person's to turn off in the *Preferences* tab of the
settings panel, and it only lives on the dashboards that wear the look.

## After a Home Assistant release

A Home Assistant release can rename or rebuild a page the shell restyles. Nothing breaks: a sheet that no longer
matches simply does nothing, and the page shows Home Assistant's own design in that spot. To see where that happened,
open the browser console on any page and type:

```js
__fluvy.shell.report()
```

It lists every sheet and whether Home Assistant still draws the element it was written for. Paste it into an issue;
the fix is usually a small one and ships in the next release.
