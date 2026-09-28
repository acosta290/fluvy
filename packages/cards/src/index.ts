import { registerCard } from '@fluvy/core';
import '@fluvy/ui';
import { FluvyActionsCard } from './actions/actions-card.js';
import { FluvyAlarmCard } from './alarm/alarm-card.js';
import { FluvyBarsCard } from './bars/bars-card.js';
import { FluvyCalendarCard } from './calendar/calendar-card.js';
import { FluvyCameraCard } from './camera/camera-card.js';
import { FluvyChipsCard } from './chips/chips-card.js';
import { FluvyClockCard } from './clock/clock-card.js';
import { FluvyCoverCard } from './cover/cover-card.js';
import { FluvyDistributionCard } from './distribution/distribution-card.js';
import { FluvyEnergyCard } from './energy/energy-card.js';
import { FluvyEnergyDevicesCard } from './energy-devices/energy-devices-card.js';
import { FluvyEnergyFlowCard } from './energy-flow/energy-flow-card.js';
import { FluvyEntitiesCard } from './entities/entities-card.js';
import { FluvyFanCard } from './fan/fan-card.js';
import { FluvyGaugeCard } from './gauge/gauge-card.js';
import { FluvyHeadingCard } from './heading/heading-card.js';
import { FluvyHelloCard } from './hello/hello-card.js';
import { FluvyHelpersCard } from './helpers/helpers-card.js';
import { FluvyHumidityCard } from './humidity/humidity-card.js';
import { FluvyLightCard } from './light/light-card.js';
import { FluvyLockCard } from './lock/lock-card.js';
import { FluvyMediaCard } from './media/media-card.js';
import { FluvyNowPlayingCard } from './now-playing/now-playing-card.js';
import { FluvyOpeningsCard } from './openings/openings-card.js';
import { FluvyPeopleCard } from './people/people-card.js';
import { FluvyProductionCard } from './production/production-card.js';
import { FluvyReadoutsCard } from './readouts/readouts-card.js';
import { FluvySceneCard } from './scene/scene-card.js';
import { FluvyScenesCard } from './scenes/scenes-card.js';
import { FluvySensorCard } from './sensor/sensor-card.js';
import { FluvyStatTilesCard } from './stat-tiles/stat-tiles-card.js';
import { FluvyThermostatCard } from './thermostat/thermostat-card.js';
import { FluvyTileCard } from './tile/tile-card.js';
import { FluvyTilesCard } from './tiles/tiles-card.js';
import { FluvyTimerCard } from './timer/timer-card.js';
import { FluvyTodoCard } from './todo/todo-card.js';
import { FluvyUpdatesCard } from './updates/updates-card.js';
import { FluvyVacuumCard } from './vacuum/vacuum-card.js';
import { FluvyWeatherCard } from './weather/weather-card.js';
import { FluvyRoomCard } from './room/room-card.js';
import { FluvyMapCard } from './map/map-card.js';
import { FluvyRowsEditor } from './shared/rows-editor.js';
import { defineHomeStrategy } from './strategy/define.js';

/**
 * The fluvy card catalogue. Registration happens while the module evaluates — never after an
 * await: Home Assistant gives a custom card two seconds to exist before it paints an error in its
 * place. The list reads everyday cards first, the specialised sets after; Home Assistant's card picker
 * sorts custom cards by name, which is why every name starts with "Fluvy ·".
 */
const CATALOGUE: ReadonlyArray<
  readonly [tag: string, element: CustomElementConstructor, name: string, description: string]
> = [
  [
    'fluvy-tile-card',
    FluvyTileCard,
    'Fluvy · Tile',
    'A light, switch, cover, fan or sensor as a tile: large with a precision ruler or two readouts, compact row, or mini.',
  ],
  [
    'fluvy-tiles-card',
    FluvyTilesCard,
    'Fluvy · Tiles',
    'A group of compact or mini tiles, two to four per row, 8 px apart.',
  ],
  [
    'fluvy-light-card',
    FluvyLightCard,
    'Fluvy · Light',
    'The precision dimmer: relative drag, slide away to slow down, hold for the 1 % scale, colour temperature.',
  ],
  [
    'fluvy-thermostat-card',
    FluvyThermostatCard,
    'Fluvy · Thermostat',
    'Climate, water heater or humidifier on a dial, with modes, presets and fan speeds.',
  ],
  [
    'fluvy-entities-card',
    FluvyEntitiesCard,
    'Fluvy · Entities',
    'Rows of entities: a switch for what toggles, the value for what is measured.',
  ],
  [
    'fluvy-media-card',
    FluvyMediaCard,
    'Fluvy · Media',
    'A media player: artwork, seek bar, transport and volume — full, compact row or hero.',
  ],
  [
    'fluvy-now-playing-card',
    FluvyNowPlayingCard,
    'Fluvy · Now playing',
    'The compact player of the home screen: artwork, thin progress, transport and volume.',
  ],
  [
    'fluvy-cover-card',
    FluvyCoverCard,
    'Fluvy · Cover',
    'Blinds, shutters, garage doors and valves: vertical position ruler, tilt, open · stop · close, favourites.',
  ],
  [
    'fluvy-fan-card',
    FluvyFanCard,
    'Fluvy · Fan',
    'Speed ruler with steps, oscillation, direction and presets.',
  ],
  [
    'fluvy-vacuum-card',
    FluvyVacuumCard,
    'Fluvy · Vacuum',
    'Robot vacuum or mower: battery, start · stop · dock · locate, suction.',
  ],
  [
    'fluvy-lock-card',
    FluvyLockCard,
    'Fluvy · Lock',
    'Slide to unlock, never one accidental tap; codes, jammed state, related rows.',
  ],
  [
    'fluvy-alarm-card',
    FluvyAlarmCard,
    'Fluvy · Alarm',
    'Arm modes as tiles and the keypad sheet for codes.',
  ],
  [
    'fluvy-camera-card',
    FluvyCameraCard,
    'Fluvy · Camera',
    'A still that refreshes itself, with live and time pills; tap for the stream.',
  ],
  [
    'fluvy-weather-card',
    FluvyWeatherCard,
    'Fluvy · Weather',
    'Condition, temperature, feels-like, wind and the daily or hourly forecast.',
  ],
  [
    'fluvy-sensor-card',
    FluvySensorCard,
    'Fluvy · Sensor',
    'A sensor with its 24 h curve, trend, min, max and average.',
  ],
  [
    'fluvy-readouts-card',
    FluvyReadoutsCard,
    'Fluvy · Readouts',
    'Up to four values side by side with their trends.',
  ],
  [
    'fluvy-people-card',
    FluvyPeopleCard,
    'Fluvy · People',
    'Who is home: avatars, zones and times.',
  ],
  [
    'fluvy-openings-card',
    FluvyOpeningsCard,
    'Fluvy · Openings',
    'Doors, windows and motion at a glance, with what is open counted.',
  ],
  [
    'fluvy-hello-card',
    FluvyHelloCard,
    'Fluvy · Hello',
    'The greeting: name, date, weather and avatar.',
  ],
  [
    'fluvy-chips-card',
    FluvyChipsCard,
    'Fluvy · Chips',
    'A row of chips that navigate between views or open entities.',
  ],
  [
    'fluvy-heading-card',
    FluvyHeadingCard,
    'Fluvy · Heading',
    'A section title with its count and a link.',
  ],
  [
    'fluvy-scene-card',
    FluvySceneCard,
    'Fluvy · Scene',
    'One scene, script or button as a tile with a done state.',
  ],
  ['fluvy-scenes-card', FluvyScenesCard, 'Fluvy · Scenes', 'A grid of scenes and scripts.'],
  [
    'fluvy-actions-card',
    FluvyActionsCard,
    'Fluvy · Actions',
    'Buttons and scripts as a list with run buttons.',
  ],
  [
    'fluvy-helpers-card',
    FluvyHelpersCard,
    'Fluvy · Helpers',
    'Numbers, selects, texts, booleans and dates as their own controls.',
  ],
  ['fluvy-todo-card', FluvyTodoCard, 'Fluvy · To-do', 'A to-do list: check, add, hide the done.'],
  [
    'fluvy-timer-card',
    FluvyTimerCard,
    'Fluvy · Timer',
    'A timer counting down live, with pause and cancel.',
  ],
  [
    'fluvy-updates-card',
    FluvyUpdatesCard,
    'Fluvy · Updates',
    'Pending updates with install buttons and progress.',
  ],
  [
    'fluvy-energy-card',
    FluvyEnergyCard,
    'Fluvy · Energy',
    'Power right now, the day curve and the energy legend.',
  ],
  [
    'fluvy-energy-flow-card',
    FluvyEnergyFlowCard,
    'Fluvy · Energy flow',
    'Solar, grid, battery and home with animated flows.',
  ],
  [
    'fluvy-energy-devices-card',
    FluvyEnergyDevicesCard,
    'Fluvy · Energy devices',
    'Consumption per appliance as bar rows.',
  ],
  [
    'fluvy-gauge-card',
    FluvyGaugeCard,
    'Fluvy · Gauge',
    'A ring gauge for any numeric sensor with min, max and average.',
  ],
  [
    'fluvy-stat-tiles-card',
    FluvyStatTilesCard,
    'Fluvy · Stat tiles',
    'A headline value and a grid of read-only stat tiles.',
  ],
  [
    'fluvy-production-card',
    FluvyProductionCard,
    'Fluvy · Production',
    'Hourly production bars with the forecast behind.',
  ],
  [
    'fluvy-bars-card',
    FluvyBarsCard,
    'Fluvy · Bars',
    'Rows with a bar each: plants, batteries, strings, levels.',
  ],
  [
    'fluvy-distribution-card',
    FluvyDistributionCard,
    'Fluvy · Distribution',
    'One stacked bar and a legend: who draws what.',
  ],
  [
    'fluvy-room-card',
    FluvyRoomCard,
    'Fluvy · Room',
    'A room of the house from its area: its picture, its climate, what is on, and its controls.',
  ],
  [
    'fluvy-map-card',
    FluvyMapCard,
    'Fluvy · Map',
    'Where everyone is: the house’s zones as columns of faces, a row a person, or Home Assistant’s map on a plate.',
  ],
  [
    'fluvy-humidity-card',
    FluvyHumidityCard,
    'Fluvy · Humidity',
    'Humidity on a comfort band, with dew point and trend.',
  ],
  [
    'fluvy-clock-card',
    FluvyClockCard,
    'Fluvy · Clock',
    'Analog or digital, hero, side or tile, with or without weather.',
  ],
  [
    'fluvy-calendar-card',
    FluvyCalendarCard,
    'Fluvy · Calendar',
    'Agenda, month, week, month + day, timeline, upcoming or tile.',
  ],
];

for (const [tag, element, name, description] of CATALOGUE)
  registerCard({ tag, name, description }, element);
if (!customElements.get('fluvy-rows-editor'))
  customElements.define('fluvy-rows-editor', FluvyRowsEditor);
// the dashboard strategy a fresh install starts with: `strategy: { type: custom:fluvy-home }` (its file is fetched when asked)
defineHomeStrategy();

// fluvy's settings: the element of the `panel_custom` Home Assistant shows in the sidebar

export { CATALOGUE };
export { loadPanel, panelOnDemand } from './panel/on-demand.js';
export { activityIsOurs, takeOverActivity } from './activity/takeover.js';
export { historyIsOurs, takeOverHistory } from './history/takeover.js';
export {
  FluvyActionsCard,
  FluvyAlarmCard,
  FluvyBarsCard,
  FluvyCalendarCard,
  FluvyCameraCard,
  FluvyChipsCard,
  FluvyClockCard,
  FluvyCoverCard,
  FluvyDistributionCard,
  FluvyEnergyCard,
  FluvyEnergyDevicesCard,
  FluvyEnergyFlowCard,
  FluvyEntitiesCard,
  FluvyFanCard,
  FluvyGaugeCard,
  FluvyHeadingCard,
  FluvyHelloCard,
  FluvyHelpersCard,
  FluvyHumidityCard,
  FluvyLightCard,
  FluvyLockCard,
  FluvyMediaCard,
  FluvyNowPlayingCard,
  FluvyOpeningsCard,
  FluvyPeopleCard,
  FluvyProductionCard,
  FluvyReadoutsCard,
  FluvySceneCard,
  FluvyScenesCard,
  FluvySensorCard,
  FluvyStatTilesCard,
  FluvyThermostatCard,
  FluvyTileCard,
  FluvyTilesCard,
  FluvyTimerCard,
  FluvyTodoCard,
  FluvyUpdatesCard,
  FluvyVacuumCard,
  FluvyWeatherCard,
};
