# Getting started

Ten minutes after installing Fluvy, this is the house.

## 1. Wear the theme

Open your profile (your name at the bottom of the sidebar) and choose **Fluvy** under *Theme*. The theme carries the
colours of every page; without it Fluvy's cards still work, but the rest of Home Assistant keeps its own look. The
panel's *Scope* tab offers the theme too.

## 2. Pick the look

Open **Fluvy** in the sidebar → **Appearance**. Sixteen palettes: a pastel line (Linen is the default) and an electric
one, or a custom accent on a warm, neutral or cool base. Three shapes (soft, round, crisp). What an administrator
chooses here is the house's look; anyone can keep a palette of their own in the same tab.

## 3. Decide where it applies

**Scope**: the look on Fluvy's dashboards only, or **everywhere** — Home Assistant's own pages, dialogs and forms in
the same design — with switches for the frame, the icons, and the Activity and History pages. "Everywhere" works while
the theme Home Assistant wears for you is Fluvy; another theme keeps its pages and Fluvy stays on its dashboards.

## 4. Let it build a dashboard

**Dashboard** → *Create*. The automatic dashboard reads your areas, devices, entities and energy preferences and
builds Home, Lights, Climate, Energy, Media and Sensors. It is a normal dashboard: open its raw configuration and it
is one line, `strategy: { type: custom:fluvy-home }`, with the options [the page about it](automatic-dashboard.md)
lists.

## 5. Add a card by hand

Edit any dashboard → **Add card** → the cards are listed as **Fluvy · …** with a live preview. Every card has an
editor form; every option is documented in [the cards](cards.md).

## 6. Make it yours

**Preferences**: the language of the cards (Home Assistant's or your own), motion (full or reduced), haptics on a
phone. These are yours, on every device you sign in on.
