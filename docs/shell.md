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

## The view tabs' sheet

The tabs in a dashboard's header (`hui-root`) are styled by one more sheet, filled whatever the theme, whose every
rule hangs on a mark Fluvy puts on the dashboard's root: `fluvy-tabs` (the style), `fluvy-tab-content` (names, icons
or both), `fluvy-tab-title` with `--fluvy-dashboard-title` (the dashboard's name). The marks are set on the dashboards
that wear the look, after each update of the root, and taken off in the edit mode and for Home Assistant's own style
— so a dashboard without them, or a Home Assistant release that reshapes the header, shows Home Assistant's tabs.
Home Assistant gives an icon tab its view's name only as `aria-label`; the name is written from there.

## The corner's sheets

Two more sheets for `ha-sidebar` fill only while the house makes a choice, which the look writes on `<html>`:
`fluvy-sidebar-logo` (Home Assistant's logo on the menu button, the name at 16) and `fluvy-flat` (no hairline under
the sidebar's head). A dashboard's header takes the same choices as marks on its root (`fluvy-flat`,
`fluvy-header-page`, and `fluvy-actions-menu`: the root's own actions render is asked for its phone's one menu), in the
view tabs' sheet.

## The wall's sheets

A device that is a wall panel ([wall mode](wall.md)) carries `fluvy-wall` on `<html>`, and three more sheets fill
only while it does, whatever the theme: the page (no overscroll, no text selection), the drawer (`ha-drawer`: the
sidebar shell hidden, the drawer's width zero) and the dashboard (`hui-root`: the header hidden, the view padded by
the tablet's safe area, the wall mesh as the view's background when the house asks for it). Each has a probe like
the others, so a Home Assistant release that renames what they find leaves the sidebar and the header in place —
the wall fails open, never trapped.

## The device's size

A device that reads its dashboards larger ([wall mode](wall.md), *Reading from across the room*) carries
`--fluvy-zoom` on `<html>` (`1.25`; nothing at 100 %), and the `device-zoom` sheet on `hui-root` turns it into CSS
`zoom` on the dashboard's view alone (`#view > hui-view`), back to 1 in the edit mode. The sheet is filled whatever
the theme, since every rule hangs on the variable; the loader sets the variable from the device's memory before
Home Assistant paints, and the bundle takes it over.

## What it never does

It never changes what a page does, never intercepts a click, and never persists anything. Every sheet is attached
while the shell is on and removed when it is off or when the page's theme is not Fluvy.

## After a Home Assistant release

A Home Assistant release can rename or rebuild a page the shell restyles. Nothing breaks: a sheet that no longer
matches simply does nothing, and the page shows Home Assistant's own design in that spot. To see where that happened,
open the browser console on any page and type:

```js
__fluvy.shell.report()
```

It lists every sheet and whether Home Assistant still draws the element it was written for. Paste it into an issue;
the fix is usually a small one and ships in the next release.
