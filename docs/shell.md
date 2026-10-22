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
- **Panels in a frame** (HACS): they get Inter and a shell of their own while the page wears Fluvy; on another theme
  the frame is left as Home Assistant draws it.
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

It never changes what a page does, never intercepts a click, and never persists anything. Every sheet is attached once,
when its element is defined, and stays attached: it is filled while the page wears Fluvy (and the house's choice it
waits on holds) and emptied otherwise, and an empty sheet does nothing. The view tabs', the device size's and the
wall's sheets are filled whatever the theme, because every rule in them hangs on a mark or a variable Fluvy writes only
where it is used — a dashboard that wears the look, a device that reads larger, a wall.

## When Fluvy steps aside

What no stylesheet can reach — a chart drawn on a canvas, an icon told only a path, a frame with a document of its own
— is reached by wrapping one method of a Home Assistant element: the charts' theme and series (`ha-chart-base`), the
icons' path (`ha-svg-icon`), HACS's frame (`ha-panel-custom`), the settings lists (`ha-config-navigation-list`), the
playing title in more-info (`ha-marquee-text`), a dashboard's panel, root and card editor (`ha-panel-lovelace`,
`hui-root`, `hui-dialog-edit-card`) and the Activity and History pages (`ha-panel-logbook`, `ha-panel-history`).
Every wrap is made once, and keeps to three rules:

- **Home Assistant's code always runs**, first and unchanged; Fluvy's part comes after it. Two wraps are the
  exception, and say so below.
- **Fluvy's part acts only where Fluvy is in use**: the page wears the Fluvy theme or the look covers the whole app,
  the dashboard on screen wears the look, or the device is a wall. On any other page — another theme, a dashboard the
  look does not dress — the charts keep Home Assistant's font and colours, the icons their Material paths, HACS's
  frame its own font, and Home Assistant's elements carry no attribute of Fluvy's, `<home-assistant>` included (the
  marks a dashboard wore come off when it is left). The page's background and theme colour are Home Assistant's too:
  Home Assistant writes them while Fluvy is still on the page, so the change that takes Fluvy off writes them once
  more, as Home Assistant does, from what the page then computes — its theme's.
- **Fluvy's part is caught**: if it throws — a Home Assistant release reshaped what it reads — that patch steps aside
  for the rest of the session, in that document alone (one that fails inside HACS's frame stays on the page, and the
  other way round). Home Assistant's code goes on alone, the console says so once (`[fluvy] svgIcons stepped aside:
  …`, with Home Assistant's version), and the report lists it.

The two wraps that do not run Home Assistant's code first act only where Fluvy is in use too, caught the same way:

- **The Activity and History pages** (`ha-panel-logbook`, `ha-panel-history`): while the page wears Fluvy (the Fluvy
  theme, or the look over the whole app) and the house keeps Fluvy's pages (*Scope* tab), the panel's `render` draws
  Fluvy's page *in place of* Home Assistant's. Only what it draws changes: the panel's state, routes and
  subscriptions stay Home Assistant's, and Fluvy's page is handed the panel's own `hass` and `narrow`. Another theme,
  or the house keeping Home Assistant's page, gives Home Assistant's render back at once (the panel draws again); and
  if Fluvy's page throws while it draws, Home Assistant's render draws in its place for the rest of the session.
- **A dashboard's actions in one menu** (`hui-root._renderActionItems`): on a dashboard that wears the look with its
  actions in one menu (the `fluvy-actions-menu` mark on its root), the root is lent `narrow` for that one call,
  before Home Assistant's render, which then draws the actions as on a phone: behind its one "…". The value is laid
  over the root's as one of its own and taken away as soon as the render returns or throws, so nothing updates, and
  Home Assistant's render runs once whatever Fluvy's part does. A root that holds `narrow` as its own value already
  is left as it is; a lending that throws steps aside, and the render runs as Home Assistant wrote it.

The report also sets Home Assistant's version beside the releases this build was checked against
(`Home Assistant 2026.10.2 (checked: 2026.9–2026.10)`), and the console says the same at its debug level once the page
connects. A version outside that range is a note, never a stop: what still fits works, and what does not steps aside.

## After a Home Assistant release

A Home Assistant release can rename or rebuild a page the shell restyles. Nothing breaks: a sheet that no longer
matches simply does nothing, a wrap whose method is gone is never made, one that no longer fits steps aside, and the
page shows Home Assistant's own design in that spot. To see where that happened, open the browser console on any page
and type:

```js
__fluvy.shell.report()
```

It lists every sheet and whether Home Assistant still draws the element it was written for, the shell's wraps (`true`
made, `false` its method is gone, `null` its element is not on this page yet), every patch that stepped aside with what
it threw (a panel frame's in that frame's own report, under `frames`), and Home Assistant's version. Paste it into an issue; the fix is usually a small one and ships in the next
release.
