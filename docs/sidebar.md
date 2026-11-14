# A dashboard's sidebar

A dashboard can keep a panel beside its views that stays the same on every view: the time and the weather, a menu of
the dashboard's own pages, whatever cards belong to the whole dashboard and not to one view. It stands **beside** the
views (they keep the rest of the width, nothing is covered), its head and its foot stay in sight, and only its middle
scrolls when it holds more than the window. It is one key in the dashboard's configuration, `fluvy_sidebar:`, and a
dashboard without the key is exactly as it was.

It is not Home Assistant's own sidebar (the one that lists the dashboards), and not a card: it belongs to one
dashboard, and it holds cards. On a wall tablet it is the column that never changes.

## Where the key goes

Beside `views:` in a dashboard's raw configuration (⋮ › *Edit dashboard* › ⋮ › *Raw configuration editor*, or the
dashboard's YAML file), or beside `strategy:` on an automatic dashboard:

```yaml
fluvy_sidebar:
  header:
    cards:
      - type: custom:fluvy-clock-card
        face: digital
        weather: weather.home
        show_forecast: false
  menu:
    items: views
  footer:
    cards:
      - type: custom:fluvy-alerts-card
        variant: banner
        alerts:
          - preset: hazards
          - preset: open
          - preset: unlocked
          - preset: low_battery
views:
  - title: Home
    path: home
    icon: mdi:home
  # …
```

That is a complete sidebar: a clock at the head, the dashboard's views as its menu, what needs a look at the foot.

## Every key

```yaml
fluvy_sidebar:
  position: start             # start | end
  width:                      # or one figure for both: 300, or '24%'
    phone: 0                  #   0 = none on that device
    tablet: 280
    desktop: 320
  phone: none                 # none | top | drawer
  style: panel                # panel | card | plain
  collapsible: false
  header:
    cards: []                 # stay at the top
  menu:
    items: views              # or a list of pages, below
    pinned: false             # true: the menu stays under the head too
  cards: []                   # the middle: scrolls when it is taller than the window
  footer:
    cards: []                 # stay at the foot
  views: [home, lights]       # only beside these views (their paths); all of them without the key
  subviews: true              # false: not in a subview
  users: []                   # only for these people (user ids); everyone without the key
  hide_tabs: false            # true: the header's tabs give way to the menu
  card_opacity: 100           # its surface alone; the house's cards' without the key
```

| Key | What it does |
| --- | --- |
| `position` | The side it stands on: `start` (the left, in a language read from the left) or `end`. `left` and `right` are read as `start` and `end`. |
| `width` | How wide it is beside the views, in px (160 to 560) or as a share of the dashboard (`'24%'`, 10 to 50), for each device: a **phone** is a window under 600 px wide, a **tablet** under 1280, a **desktop** above. `0` is no sidebar on that device. One figure is the tablet's and the desktop's. |
| `phone` | What a phone gets while its width is 0: `none`; `top`, the head's cards and the menu as a row of pills above the view; `drawer`, the whole sidebar in a drawer over the view, opened by a round at the foot of its side and closed by a tap beside it, by Escape or by choosing a page. |
| `style` | `panel`: from edge to edge on the card's fill, a hairline at its inner edge, under the header as Home Assistant's own sidebar is beside it. `card`: one card, with the view's gap round it. `plain`: no surface, each card on its own. On a surface (`panel`, `card`) the cards draw none of their own and stand in one column, a hairline between them, as in the [Expander](cards.md#expander). |
| `collapsible` | A round at its foot folds it to a rail of the menu's icons, and unfolds it; each device remembers how it left each dashboard. |
| `header`, `cards`, `footer` | Lists of cards, any card: Fluvy's, Home Assistant's own, a custom one. The head and the foot never scroll. |
| `menu` | `items: views` lists the dashboard's own views: not its subviews, and not a view Home Assistant hides from the person (`visible`). The open view is marked, and inside a subview the view it goes back to. A view without an icon takes the one its name says. |
| `views`, `subviews` | Where it shows: only beside the views named by their paths, and not in subviews when `subviews: false`. |
| `users` | The people it is drawn for, by their user id (Settings › People › Users). |
| `hide_tabs` | With `menu.items: views`, Home Assistant's tabs leave the header while the sidebar is in sight (never while it is a drawer: the menu is then a tap away). |
| `card_opacity` | How opaque its surface is, 0 to 100. Without it the sidebar follows the house's cards (*Appearance › Cards*): see-through where they are, with what shows through blurred. |

### A menu of your own

```yaml
fluvy_sidebar:
  menu:
    items:
      - title: Home
        icon: mdi:home
        path: /wall-tablet/home      # an address inside Home Assistant
      - title: Lights
        path: lights                 # a view of this dashboard, by its path
      - title: Good night
        icon: mdi:weather-night
        tap_action:                  # or what a tap runs, as on any card
          action: perform-action
          perform_action: scene.turn_on
          target:
            entity_id: scene.good_night
```

A page needs its `title`, and a `path` or a `tap_action`. A `path` is an address inside Home Assistant (it starts with
one `/`) or one of this dashboard's views by its path; anything else is left out. The page the address names is marked.

## How it behaves

- **The edit mode** hides it: a dashboard is edited at its whole width.
- **A wall** (see [Wall mode](wall.md)) draws it from the top of the screen, as it has no header. A kiosk that hides
  the header by another means is followed too: the sidebar starts where the view does.
- **The floating frame**, Home Assistant's own sidebar docked, folded or hidden, and this device's *Sidebar beside the
  page*: it stands inside the dashboard's own area, after Home Assistant's sidebar, and moves with the view.
- **This device's size** (*Preferences › This device*): it grows with the view.
- **A view with a theme of its own** themes the sidebar with it.
- **A language read from the right** has its start on the right.
- **Sections and masonry views**: a sections view counts its columns from the room it has, so it loses a column
  beside the sidebar and stays tidy. A masonry view counts from the window, so its columns get narrower: sections
  views are the better company.
- **This device may opt out**: *Preferences › This device › Hide dashboard sidebars* hides every dashboard's sidebar
  on that screen alone.

The sidebar is drawn by a file of its own that only a dashboard with the key fetches. Should a future Home Assistant
reshape its dashboard page, the sidebar steps aside for the session (the console says so once) and the dashboard is
whole without it.

## What does not go together

- **sidebar-card** on the same dashboard: two sidebars. Rename its `sidebar:` key to `fluvy_sidebar:` (below) and
  take its resource out, or keep it on other dashboards only.
- **Home Assistant's per-view `sidebar:`** (a sections view's own column) is another thing and keeps working: it is
  written inside a view, scrolls with it and is that view's alone.

## Coming from sidebar-card

| sidebar-card | Here |
| --- | --- |
| `sidebar:` | `fluvy_sidebar:` |
| `digitalClock`, `date`, `weatherEntity` | a Clock card in `header.cards` (`face: digital`, `weather:`) |
| `presence` | a People card (`custom:fluvy-people-card`) |
| `template` | a Template card (`custom:fluvy-template-card`) |
| `sidebarMenu` (`name`, `icon`, `tap_action`) | `menu.items` (`title`, `icon`, `path` or `tap_action`), or `menu.items: views` |
| `menuStyle`, `showLabel` | the menu is rows of a circle and a name; `collapsible` folds it to its circles |
| `cards`, `bottomCard` | `footer.cards` (they stay) or `cards` (they scroll) |
| `glanceBar` | an Alerts card in `footer.cards` (`custom:fluvy-alerts-card`) |
| `trends` | a Chart card (`custom:fluvy-chart-card`) |
| `width: {mobile, tablet, desktop}` (shares) | `width: {phone, tablet, desktop}` (px, or `'25%'`) |
| `breakpoints` | fixed: a phone under 600, a tablet under 1280 |
| `hideOnPath` | `views:` (where it does show), `subviews: false` |
| `hideTopMenu`, `hideHassSidebar` | [Wall mode](wall.md), or Home Assistant's own kiosk |
| `style`, `cardStyle`, `accentColor` | `style: panel`, `card` or `plain`; its colours are the look's |
