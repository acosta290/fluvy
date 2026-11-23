#!/usr/bin/env node
/**
 * The release invariants, as a check that fails loudly:
 *
 *   node tools/release/check.mjs                 what `pnpm check` runs: the versions and the metadata agree
 *   node tools/release/check.mjs --release       before a release is built: the integration folder is complete too
 *   node tools/release/check.mjs --tag v1.2.0    in CI, on a tag: the tag names the same version
 *
 * - one version: the root package.json, every workspace package.json and custom_components/fluvy/manifest.json;
 * - one set of metadata (license, author, homepage, repository, bugs, engines) on every workspace package;
 * - with --release: the build the integration ships is present (frontend/manifest.json with its build stamp,
 *   fluvy.js, loader.js, the theme, the icons), and every text file over 1 KB has its compressed sidecars, each
 *   holding exactly its file's bytes (`packages/bundle/scripts/sidecars.mjs`).
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { holds, SIDECARS, travelsCompressed } from '../../packages/bundle/scripts/sidecars.mjs';
import { readJson, workspaceManifests } from './lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const release = args.includes('--release') || args.includes('--tag');

/** Each chunk's gzip budget in bytes (`core` is what every page loads; the rest come on demand). */
const BUDGETS = {
  'fluvy.js': 2048,
  // 238 KB since 2026-11-23 (1.25: a toggle decided as Home Assistant's, the cards' exact colours asked for, a card's
  // own figures from an entity or a template, the chips' plain style, the sheets' kinds, the dialogs' plain base,
  // settings 9: measured at 237.4 KB). 236 KB since 1.9 (the head as the card's button, the grey ladder, the value row, empty lists, the room's contents,
  // the appliances' announcement and icons, heights read from the house, the judges' fixes; the lazy families'
  // English left core first, about 9 KB): 224 in 1.8, 222 in 1.7, 220 before
  core: 243_712,
  // the settings panel and its English. 44 KB since 2026-11-14 (1.21, 3.3 KB: the form Home Assistant's pencil opens on
  // an automatic dashboard, #188, 1.2 KB; the house's order of its rooms and the dashboards' groups by room and chips,
  // #189, 1.0 KB; a dashboard's Sidebar row, its route and its saves beside the strategy, #187, 0.9 KB; what a
  // thermostat says and the screensaver at the device's size, #185, #190): measured at 42.1 KB; 40 before
  panel: 45_056,
  // Customise (1.20, #170): the Dashboards tab's section that edits an automatic dashboard's views and cards (what it
  // reads of the dashboard, what it changes of its `edit`, its rows, its sheet, its English), fetched the first time a
  // dashboard is customised. 14 KB since 2026-11-14 (1.21, #188, 3.1 KB: rows dragged to their places and sent to
  // an end, the tabs as a list, the sheet "Add a card" with its three ways, a view's rows searched; a card offered
  // hidden, #190): measured at 12.3 KB; 12 before, measured at 9.3 KB
  customise: 14_336,
  // a dashboard's sidebar in the panel (1.21, #187): the Dashboards tab's section that writes `fluvy_sidebar:` without
  // YAML (none, the ready-made one, the person's own: where it stands, its lists of cards in Home Assistant's stack
  // editor, the YAML of a dashboard kept in a file, its English), fetched the first time a dashboard's sidebar is
  // opened. Measured at 4.9 KB
  'sidebar-editor': 6144,
  // the automatic dashboards. 32 KB since 2026-11-15 (1.22: an eighteenth language's naming words, Bulgarian's, as
  // written and as an entity id writes them, 1.2 KB, a dashboard's Names, its Long names, rooms as tabs and the Lights
  // and Climate dashboards, 1.3 KB; Danish and Swedish after it: measured at 31.4 KB); 30 KB since 2026-11-15 (1.22:
  // the naming words of a seventeenth language, Czech, took it 48 B past 29: measured at 29.0 KB); 29 KB since
  // 2026-11-13 (1.20: every card stands in a part with an id of its own and a person's `edit` is laid over them, #170,
  // 2.1 KB; the range's usage, tomorrow's production, several arrays and what is shown together told apart, 1.4 KB:
  // measured at 27.7 KB); 25 KB since 2026-11-12 (1.19.1: scenes on Home and room pages, labels told apart, forecasts):
  // 24 before
  strategy: 32_768,
  // the naming words (1.23: every language's, 11.7 KB, out of the strategy's chunk) and the rule that reads a switch's
  // name as a lamp's (#219), fetched with the strategy and by the first card asked for `lamp_switches`; measured at
  // 11.7 KB. 13 KB since 2026-11-23 (1.25: Traditional Chinese's naming words, #238: measured at 12.3 KB)
  words: 13_312,
  // the heights the strategy counts with the house: what an entity's capabilities draw, what a room holds
  'house-heights': 4096,
  wall: 16_384,
  // the chart engine (1.11): the scales, paths, bars, axes, rings and gauges every chart card draws with, the styles,
  // their sheet, the gauges that move (7 KB of it) — what the sensor's chart waits on, so the Chart card keeps a
  // chunk of its own. Planned at 19–20 KB before the moving gauges. 25 KB since 2026-11-19 (1.23: a thing's states laid as
  // stretches, `@fluvy/core/spans`, and the timeline's gaps and its lowest, highest and last readings, #228): measured
  // at 24.1 KB; 24 before
  chart: 25_600,
  // the Chart card (1.11, #68): the card, the readers of its series (history, statistics, a list, a forecast), its
  // editor and its English. 17 KB since 2026-11-13 (1.20: following an Energy date picker, `collection_key`, #181, and
  // the round's double tap on its rows and head, #179): measured at 16.6 KB; 16 before. 20 KB since 2026-11-19 (1.23:
  // states as strips under the chart with their colours by state, a history's `stat`, #228): measured at 18.7 KB
  'chart-card': 20_480,
  // the energy family: every energy card, the flow's drawing and motion, the model they share, its sheet. 88 KB since
  // 2026-11-15 (1.22, #202, 0.6 KB: the flow's names on three lines and its last-resort lane, Production's badge by the
  // hour, Where it went's words said to a screen reader): measured at 87.0 KB; 87 KB since 2026-11-14 (1.21, #190,
  // 0.9 KB: Where it went's words in their bars' order in the fewest tiers and the lift of a word's bar, Production's
  // arrays past four as Other, a forecast's miss shared): measured at 86.5 KB; 86 KB since 2026-11-13 (1.20, 4.6 KB:
  // Production's forecast from Home Assistant, tomorrow and the days ahead, #183; every array counted, History bars
  // summing sensors, the flow's names on two lines, imported meters, #181, #183; the round's double tap, #179):
  // measured at 85.5 KB; 81 KB since 2026-11-12 (1.19.1, #170, 0.9 KB: the flow's steady layout, its words giving way
  // before its list, the house's words clear of its lanes, two sources of a kind told apart by their devices); 80 KB
  // since 1.10 (its sheet left core, 2.4 KB); 76 since 1.9 (the family's English, the history bars' live day and
  // resets, the power chart's axes); 64 before
  energy: 90_112,
  // the Energy period card: the strip, its picker and its sheet (1.11, #62); the Energy usage card joins it. 17 KB
  // since 2026-11-13 (1.20: water and gas over the range, #181, and the period's bar, #182): measured at 16.7 KB; 16
  // before
  'energy-period': 17_408,
  // the history bars' readings: the resets and the steps, the recorder's history, fetched by the first card needing them
  'history-bars-readings': 8192,
  // the media family: the player and the now-playing strip
  media: 16_384,
  // the devices family: the lock, the alarm and its keypad, the camera and the cameras, the printer, the job's times,
  // and since 1.20 the rows the lock, the alarm and the camera are built on (they left core, 1.1 KB; measured at
  // 30.9 KB). 36 KB since 2026-10-22 (the Cameras card, #60: its tiles, its feeds, its lines and its editor): 32 before
  devices: 36_864,
  // the cameras' sheet: fetched when a Cameras card's round opens it
  'cameras-sheet': 8192,
  // the appliances family: the washer, the dryer, the dishwasher and their kin, plug mode, the pet devices, their
  // English. 66 KB since 2026-11-06 (1.15, #120, 0.9 KB: which commands ask first and their words, the DE1's call for a
  // hand and its failure in the house's words, its plugin's prefix, its tank and its drinks out of reach, each card's
  // own opacity); 64 KB since 2026-11-04 (1.14, #115, 0.7 KB: a device of any integration read by its own words, a DE1's
  // camel-cased states, counters and tank, hcpy's keys run together; the editor's roles by kind, its lists offering
  // the device's own entities); 63 KB since 2026-11-04 (1.13.1: a cycle's energy from SmartThings' meters, PetKit's
  // states and their words, device: none read as before, the compact and ring heights from what the house draws); 62 KB
  // since 2026-11-04 (#112, 6.5 KB: the feeder, the fountain and the litter box — their PetKit and
  // PETLIBRO keys, consumables and commands, their meals read from a plan, their tiles, their names in every language);
  // 55 KB since 2026-11-04 (Hungarian's naming words, #110; the integration's own entities before a helper on its
  // device and Off while the power switch is, #91; Home Connect's programmes Home Assistant has no words for); 54 since 2026-10-20 (the
  // Japanese naming words, in kanji, kana and romaji, #54); 53 since 2026-10-19 (the #47 judge's
  // fixes: rows that never repeat the hero, the head's picture chosen by the whole name, a fridge on a plug that never
  // finishes and asks before it is switched off, the compact line's shorter forms); 51 since the reporter's LG house
  // (#47: LG's older integration read by its device sensor's attributes, both LG integrations known by their
  // signatures, LG's states and cycles worded in eight languages); 48 before
  // 68 KB since 2026-11-11 (1.19: Russian's appliance stems, #167, about 900 B; measured at 66.8 KB); 70 KB since
  // 2026-11-15 (1.22: Bulgarian's appliance stems as written and as an id writes them, 0.9 KB, a head's two lines:
  // measured at 69.2 KB with Danish and Swedish)
  // 71 KB since 2026-11-23 (1.25: Traditional Chinese's appliance kinds, #238: measured at 70.0 KB)
  appliances: 72_704,
  // the appliances' pictures: one product drawing a kind, fetched by the first card that draws one
  'appliance-art': 32_768,
  // the automations family: the card, the schedule model and its store. 20 KB since 1.9 (the family's English, the
  // targets of a schedule): 16 before
  automations: 20_480,
  // the schedule sheet: targets, verbs, days, moments and the name, fetched when one is opened
  'automations-sheet': 16_384,
  // the alerts family: the card (five variants and its editor), what it watches (the matcher, the engine, the memory,
  // the repairs) and its English. 24 KB, measured at 19.6 KB with the card (planned at 16 before it was built)
  alerts: 24_576,
  // the alerts' sheet: fetched when it is opened
  'alerts-sheet': 12_288,
  // the template card: its card on the tile's, the parsers of its templates' answers, its English (1.10, #59)
  template: 8192,
  // the web page card: its card, its address and rounds rules, its English (1.11, #61)
  web: 8192,
  // the Rounds card (1.23, #224): its card and its English, the rounds it draws the quick actions'; measured at 2.3 KB
  rounds: 4096,
  // the Thermostats card (1.23, #230, #219): its card, what it reads of the house and its English; what a thermostat
  // is doing and its model the Thermostat card's, the rows and their rounds the quick actions'
  thermostats: 8192,
  // the Rooms card (1.23, #225): its card, where the house's rooms open and its English; its rounds are the quick
  // actions', the rooms' glyphs it draws their set's (`glyphs-rooms`). Measured at 4.4 KB
  rooms: 8192,
  // what each card is (1.22, #193): the line the card picker's search reads and Customise's list says under each name,
  // in English, which left core; measured at 3.6 KB. 5 KB since 2026-11-20 (1.23: the Compass, Rounds, Heating schedule,
  // Thermostats and Rooms cards' lines): measured at 4.0 KB
  about: 5120,
  // the Expander card (1.20, #180): the card, what holds the cards it folds, what remembers how it was left and its
  // English; measured at 5.2 KB
  expander: 8192,
  // the Expander card's editor: its form, and Home Assistant's stack editor set under it, and the Swipe card's built on
  // it (1.22, #206); fetched when one is edited. Measured at 3.2 KB with both
  'expander-editor': 4096,
  // the Swipe card (1.22, #206): the card, what remembers where it was left, what a finger's drag is theirs on, its
  // English; it holds its cards with the Expander's chunk. Measured at 6.2 KB
  swipe: 8192,
  // a dashboard's own sidebar (1.21, #187): the element beside the views, what reads `fluvy_sidebar:` and puts it in
  // Home Assistant's view row, its three ways of standing (beside the views, above them, a drawer), its English;
  // fetched by the first dashboard that asks for one. Measured at 7.6 KB
  sidebar: 10_240,
  // the Slider card: its card on the tile's and its English, its editor with the forms (1.11.1, #77)
  slider: 8192,
  // the Cover card (1.22: it left core): the blind's, the garage door's, the gate's and the valve's card and its sheet,
  // the tilt's slats, its presets, its numbers turned round (#203)
  cover: 8192,
  // the Vacuum card (1.20: it left core, 1.4 KB of what every page loads): the robot's and the mower's card, which
  // robots a hand can drive and how (#178), the drive pad's English
  vacuum: 8192,
  // the drive pad (1.20, #178): the ring with Stop in its middle, a robot's remote control from its start to its stop,
  // its sheet; fetched by the first Vacuum card that draws a Drive command
  'vacuum-drive': 8192,
  // the ring (1.20): the disc of four arrows round a middle key the TV remote and the drive pad both draw
  ring: 4096,
  // the Thermostat card (1.21, 2026-11-14: it left core, 4.9 KB of what every page loads): the climate's, the water
  // heater's and the humidifier's card and its rules, 5.6 KB, and what says what a thermostat is doing with what it
  // reads of its valve, its window and its battery (#185), which a tile and a room's row reach here; measured at
  // 7.3 KB. 9 KB since 2026-11-19 (1.23: the room as the large figure with the target's stepper, the modes as icons
  // and the readouts under the value, #215): measured at 8.7 KB
  climate: 9216,
  // the TV remote card (1.18, #143): the card, its keys and the integrations' commands for them, the platforms it
  // knows by name, its English; its editor goes with the forms. Measured at 11.2 KB
  remote: 16_384,
  // the platforms' logos (1.18, #143): Simple Icons' and Material Design Icons' marks on the grid and Fluvy's
  // monograms, fetched by the first remote card that draws an app
  'app-logos': 24_576,
  // the Vehicle card: the card (three layouts, its editor), what finds a car's entities on thirteen integrations and
  // folds their words, its glyphs and its English (1.13, #84); measured at 20.2 KB. 26 KB since 2026-11-15 (1.22,
  // #207: a car that burns fuel, its tank, a plug-in hybrid's two gauges, AdBlue, oil and the next service, and the
  // words of five more integrations, 3.6 KB: measured at 24.0 KB)
  vehicle: 26_624,
  // the Heating schedule card (1.23, #229): the card, the week and the automation it reads and writes, how a preset
  // looks, its store and its English; its editor goes with the forms. Measured at 12.0 KB
  schedule: 16_384,
  // its sheet (1.23, #229): a day's times, a day copied to others, the presets and what Save writes, fetched the first
  // time the card is tapped. Measured at 6.6 KB
  'schedule-sheet': 8192,
  // Fluvy's own details sheets (1.20, #162): the light's, the thermostat's, the cover's, the player's and the fan's,
  // what they share (the sheet, its keys and rows, its day) and their English, fetched the first time a card opens
  // one. Measured at 11.5 KB
  details: 16_384,
  // the items family: the card, its fields and presets, its English (1.11, #66)
  items: 12_288,
  // the items' sheet: fetched when an item is tapped
  'items-sheet': 8192,
  // the light card's colour controls: the quick colours' table and row, fetched by the first colour bulb, and their
  // grammar, which the light's editor shares. 8 KB since 1.15 (the grammar left core, 0.4 KB): 4 before
  'light-colour': 8192,
  // the room lights' colour sheet (1.18, #137): the room as one bulb, its switch, the hue wheel; fetched when a
  // card's colour round is tapped (its controls are the light card's, in `light-colour`)
  'lights-colour': 8192,
  // the rounds (1.13, #113; 1.23, #224): a room's quick actions, the engine every card draws rounds with (their sets,
  // levels, taps, holds and states) and the list row that ends in them, fetched as the bundle starts. 5 KB since
  // 2026-11-20, measured at 4.3 KB: the list row took a card's control at its end (#230), its chevrons, a row's own
  // room and its rounds in columns (#225); 4 before
  'quick-actions': 5120,
  // the weather card, and the Compass card since 1.23 (#209: the card and its English; its editor goes with the forms)
  // 14 KB since 2026-11-23 (1.25: the Compass card's classic face, its letters' fit and its chevron, #247: measured at
  // 13.0 KB)
  weather: 14_336,
  // the calendar card: its views, what reads its events, its sheet (1.18: it left core, 9.7 KB of what every page
  // loads, for the release's new card and styles); measured at 11.5 KB
  calendar: 16_384,
  editor: 8192,
  // the fields every card's editor is built of: the schema's helpers, a list's row form, and the editors' English
  // (1.15: they left core, 4.3 KB). 9 KB since 2026-11-15 (1.22: a card's thresholds, #204, its state's colours, #196,
  // and a list's names, #200: measured at 8.3 KB)
  // 10 KB since 2026-11-23 (1.25: exact colours in every editor, #250, the horizontal cover's word, #244: measured at
  // 9.0 KB)
  fields: 10_240,
  // the editors of the cards every page carries: their forms, lists and defaults, fetched with the visual editor
  // (1.11: they left core, 6.3 KB). 14 KB since 1.18 (the TV remote's editor, #143, and the room's colour round, #137,
  // with the sliders' style on every editor that draws one): measured at 12.7 KB; 12 before. 15 KB since 2026-11-13
  // (1.20: every editor's Interactions section, #179, the vacuum's drive pad, #178, the rocker's style, #177): measured
  // at 14.1 KB. 16 KB since 2026-11-15 (1.22: two lines for a head's name, #191, a tile's readouts each with its name,
  // unit and decimals, #197, a list's names, #200): measured at 15.0 KB. 19 KB since 2026-11-19 (1.23: the Rounds
  // card's and the Compass card's editors, a card's own blur, the thermostat's focus, icons and readouts, a chart's
  // states): measured at 17.1 KB, the round's other new cards' editors to come. 20 KB since 2026-11-20 (the Heating
  // schedule's, the Thermostats card's and the Rooms card's editors, the numbers set in place): measured at 19.3 KB
  // 22 KB since 2026-11-23 (1.25: the chips' style and names, #241, the Rooms card's quick actions' taps, #239, the
  // Bars card's limits as text, #253, the Vehicle card's lists of its own controls and small icons, #248 #251): measured at
  // 21.4 KB
  forms: 22_528,
  // 6 KB since 2026-11-13 (1.20: Ukrainian's words for a view's icon, #176, about 400 B; measured at 5.0 KB); 5 since
  // 2026-11-11 (1.19: Russian's, #167, about 800 B); 4 before
  'view-icons': 6144,
  // what a see-through card wears (1.15): its sheet and what writes its fills at its opacity
  glass: 4096,
  // what a card quiet out of reach wears (1.16): its sheet
  quiet: 4096,
  // colours worn as they are named (1.25, #250): Home Assistant's own value for each of its colour names and the family
  // a colour wears exactly, fetched by the first card that asks (or the house), and with the light card's colours.
  // Measured at 1.0 KB
  exact: 2048,
  // what reads a card's thresholds (1.22, #204): their values, the band a reading is in, the stretches a chart colours;
  // fetched by the first card that names one
  thresholds: 2048,
  // the controls that set a number in place (1.23, #218): a row's value between − and +, a figure typed, their sheet;
  // fetched by the first card that asks for one
  'number-controls': 4096,
  // the slider styles (1.18, #144): the bar, the liquid and a tile's fill the ruler draws when asked, and their sheet
  'slider-styles': 4096,
  // the switch styles (1.20, #177): the wall rocker a tile draws in its switch's place when asked, what a tile's
  // entity makes of it (a cover’s travels) and its sheet; measured at 1.5 KB
  'switch-styles': 4096,
  // the page's background: the layer under a dashboard's view, its marks and its sheet. 4 KB since 2026-11-11 (1.19,
  // #155)
  background: 4096,
  // this device's sidebar beside the page (1.20, #173): what answers the menus' asks
  dock: 1024,
  // what Home Assistant's open dialogs paint (1.25, #242: `__fluvy.shell.dialogs()`), asked for in the console alone;
  // measured at 0.7 KB
  'shell-dialogs': 1024,
  // a list in groups (1.21, #189): the house's rooms and floors or a list's own sections under their labels, the
  // short names inside a group and the scenes as chips; fetched by the first Tiles or Scenes card asked for groups
  groups: 4096,
  // the icon set's glyphs Fluvy's chrome never names (the garage, the gate, the window, the door open: 10 outlines) and
  // the index of its other parts (1.23, #226): measured at 2.5 KB
  icons: 4096,
  // the icon set's other parts (1.23, #226), each fetched the first time Home Assistant asks for one of its glyphs:
  // measured at 1.4 (appliances) to 3.6 KB (climate, 17 outlines)
  'icons-appliances': 4096,
  'icons-levels': 4096,
  'icons-energy': 4096,
  'icons-devices': 4096,
  'icons-climate': 4096,
  'icons-safety': 4096,
  'icons-outdoor': 4096,
  'icons-home': 4096,
  'icons-rooms': 4096,
  // the glyph sets a card draws by itself (1.23, #226): the rooms', which the Rooms and Thermostats cards draw (#225,
  // #230)
  'glyphs-rooms': 4096,
  // the levels in Fluvy's icons (1.23, #226): what picks a battery's charge, a signal's bars, a valve open or shut, and
  // the twelve glyphs that say them
  levels: 2048,
  // what only the chunks fetched later share (1.20: it left core, 1.9 KB of what every page loads): the local dates
  // and the month grid, the ticker, a sheet's laid width, a name's plain letters, and since 1.21 a person's own
  // picture in a head's circle (the Thermostat card left core, and nothing every page runs reads one); measured at
  // 2.9 KB
  shared: 4096,
  // what the pages share: the date picker, the time field, the dropdown; the Activity and History pages' period,
  // sources, layers, CSV and chrome's sheet. 12 KB since 1.10 (those left core, 2.3 KB; the sources in 1.13): 8 before
  pages: 12_288,
  activity: 32_768,
  history: 16_384,
  // our history in Home Assistant's details dialog (1.20, #162): the block, its readers and its English; measured at
  // 7.3 KB
  'details-history': 10_240,
  // 48 KB since 2026-11-15 (1.22: the cards' names and what each card is, #193, 3.6 to 4.4 KB a language: Russian and
  // Ukrainian, the longest, went 2.2 KB over 44); 44 KB since 2026-11-13 (1.20: Customise's words, #170, the details
  // sheets' and dialog's, #162, the drive pad's, the Expander's, the alerts' and the round's editor words, about 3 KB a
  // language: Russian, the longest, went 140 B over 40, and Ukrainian, #176, stands beside it); 40 KB since 2026-11-11
  // (1.19: Russian, #167, whose Cyrillic is two bytes a letter: its catalogue measured 35.9 KB, where no Latin one
  // passes 32); 32 KB since 2026-11-06 (1.16: a card's look when unavailable and its brightness while on, #126 #124,
  // the names' and roles' editor words, #125 #127, which commands ask first, unknown names said: Hungarian and Slovak,
  // the longest, went 64 B over 30); 30 KB since 2026-11-04 (the pet devices' words, #112, and the Vehicle card's, #84:
  // its states, its line, its controls and rows, its editor and the parts a car's entities play, 1.2 KB a language;
  // Hungarian, the longest, went over 28); 28 since 1.11 (the date picker's, the units', a row's real last change's,
  // the web page's and the Items card's words, the flights preset's among them: Japanese, the longest, went 320 B over
  // 24); 24 since 1.9 (the appliances' and the alerts' words), 20 in 1.8, 16 before. 52 KB since 2026-11-19 (1.23: the
  // Compass, Rounds, Rooms, Thermostats and Heating schedule cards' words and their editors', a card's own blur, the
  // thermostat's room first, a chart's states, the icons' levels: Russian, the longest, went 672 B over 48 with half of
  // them)
  lang: 53_248,
  'rolldown-runtime': 2048,
  'loader.js': 4096,
};
const tag = args[args.indexOf('--tag') + 1];
const problems = [];
const problem = (text) => problems.push(text);

const rootManifest = await readJson(join(root, 'package.json'));
const { version } = rootManifest;
const META = ['license', 'author', 'homepage', 'repository', 'bugs', 'engines'];

for (const file of await workspaceManifests(root)) {
  const manifest = await readJson(file);
  const name = relative(root, file).replace(/\\/g, '/');
  if (manifest.version !== version) problem(`${name}: version ${manifest.version} ≠ ${version}`);
  for (const key of META) {
    const expected =
      key === 'repository' && file !== join(root, 'package.json')
        ? {
            ...rootManifest.repository,
            directory: relative(root, dirname(file)).replace(/\\/g, '/'),
          }
        : rootManifest[key];
    if (JSON.stringify(manifest[key]) !== JSON.stringify(expected))
      problem(`${name}: "${key}" differs from the root package.json`);
  }
}

const integration = join(root, 'custom_components', 'fluvy');
const haManifest = await readJson(join(integration, 'manifest.json'));
if (haManifest.version !== version)
  problem(`custom_components/fluvy/manifest.json: version ${haManifest.version} ≠ ${version}`);
if (args.includes('--tag') && tag !== `v${version}`) problem(`tag ${tag} ≠ v${version}`);

if (release) {
  const exists = async (path) =>
    stat(join(integration, path))
      .then(() => true)
      .catch(() => false);
  for (const path of [
    'frontend/fluvy.js',
    'frontend/loader.js',
    'frontend/manifest.json',
    // every face the build ships (packages/bundle/scripts/finish.mjs) and the licence that goes with them
    'frontend/fonts/inter-variable.woff2',
    'frontend/fonts/inter-italic-variable.woff2',
    'frontend/fonts/inter-cyrillic-variable.woff2',
    'frontend/fonts/inter-italic-cyrillic-variable.woff2',
    'frontend/fonts/OFL-Inter.txt',
    'themes/fluvy.yaml',
    'brand/icon.png',
    'brand/icon@2x.png',
  ])
    if (!(await exists(path)))
      problem(`custom_components/fluvy/${path} is missing (run pnpm build)`);
  if (await exists('frontend/manifest.json')) {
    const built = await readJson(join(integration, 'frontend', 'manifest.json'));
    if (built.version !== version)
      problem(`frontend/manifest.json: version ${built.version} ≠ ${version}`);
    if (!/^[0-9a-f]{8}$/.test(built.build ?? '')) problem('frontend/manifest.json: no build stamp');
    // every script under its budget (gzip): what a page pays for what it opens. A chunk is named before its
    // eight-character hash (`chunks/strategy-6-wdQvpS.js` → `strategy`; a language's catalogue is `lang`); the
    // fonts are not scripts and have no budget here
    for (const [file, { gzip }] of Object.entries(built.files ?? {})) {
      if (!/^(fluvy\.js|loader\.js|chunks\/.+\.js)$/.test(file)) continue;
      const name = file.replace(/^chunks\//, '').replace(/-[\w-]{8}\.js$/, '');
      const budget = BUDGETS[name.startsWith('lang-') ? 'lang' : name];
      if (budget === undefined)
        problem(`${file}: no budget for this chunk (tools/release/check.mjs)`);
      else if (gzip > budget) problem(`${file}: ${gzip} B gzip over its budget of ${budget} B`);
    }
  }
  // what Home Assistant sends in a file's place: every text file over 1 KB has its sidecars, and each holds exactly its
  // file's bytes (a stale one would be served for it)
  const frontend = join(integration, 'frontend');
  const shipped = (
    await readdir(frontend, { recursive: true, withFileTypes: true }).catch(() => [])
  )
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
  const present = new Set(shipped);
  for (const path of shipped) {
    const file = relative(root, path);
    const suffix = SIDECARS.find((ending) => path.endsWith(ending));
    if (suffix) {
      const source = path.slice(0, -suffix.length);
      if (!present.has(source) || !travelsCompressed(source, (await stat(source)).size))
        problem(`${file}: a compressed sidecar of nothing the build compresses`);
      else if (!holds(suffix, await readFile(path), await readFile(source)))
        problem(`${file}: does not hold its file's bytes (it would be served in their place)`);
    } else if (travelsCompressed(path, (await stat(path)).size))
      for (const ending of SIDECARS)
        if (!present.has(`${path}${ending}`))
          problem(`${file}: no ${ending} beside it (run pnpm build)`);
  }
}

if (problems.length > 0) {
  for (const text of problems) console.error(`✗ ${text}`);
  process.exit(1);
}
console.log(
  `✓ Fluvy ${version}: versions and metadata agree${release ? ', the integration folder is complete' : ''}`,
);
