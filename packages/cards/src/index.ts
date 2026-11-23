import { announceCard, lookHandle, registerCard, setDetailsSheets, setSidebar } from '@fluvy/core';
import '@fluvy/ui';
import { FluvyActionsCard } from './actions/actions-card.js';
import { FluvyBarsCard } from './bars/bars-card.js';
import { FluvyChipsCard } from './chips/chips-card.js';
import { FluvyClockCard } from './clock/clock-card.js';
import { FluvyDistributionCard } from './distribution/distribution-card.js';
import { FluvyEntitiesCard } from './entities/entities-card.js';
import { FluvyFanCard } from './fan/fan-card.js';
import { FluvyGaugeCard } from './gauge/gauge-card.js';
import { FluvyHeadingCard } from './heading/heading-card.js';
import { FluvyHelloCard } from './hello/hello-card.js';
import { FluvyHelpersCard } from './helpers/helpers-card.js';
import { FluvyHumidityCard } from './humidity/humidity-card.js';
import { FluvyLightCard } from './light/light-card.js';
import { FluvyOpeningsCard } from './openings/openings-card.js';
import { FluvyPeopleCard } from './people/people-card.js';
import { FluvyReadoutsCard } from './readouts/readouts-card.js';
import { FluvySceneCard } from './scene/scene-card.js';
import { FluvyScenesCard } from './scenes/scenes-card.js';
import { FluvySensorCard } from './sensor/sensor-card.js';
import { FluvyStatTilesCard } from './stat-tiles/stat-tiles-card.js';
import { FluvyTileCard } from './tile/tile-card.js';
import { FluvyTilesCard } from './tiles/tiles-card.js';
import { FluvyTimerCard } from './timer/timer-card.js';
import { FluvyTodoCard } from './todo/todo-card.js';
import { FluvyUpdatesCard } from './updates/updates-card.js';
import { FluvyRoomCard, loadQuickActions } from './room/room-card.js';
import { FluvyLightsCard } from './lights/lights-card.js';
import { FluvyMapCard } from './map/map-card.js';
import { defineStrategies } from './strategy/define.js';
import { ALERTS_FAMILY } from './alerts-family.js';
import { APPLIANCES_FAMILY } from './appliances-family.js';
import { AUTOMATIONS_FAMILY } from './automations-family.js';
import { CALENDAR_FAMILY } from './calendar-family.js';
import { CHART_FAMILY } from './chart-family.js';
import { CLIMATE_FAMILY, loadDoing } from './climate-family.js';
import { COVER_FAMILY } from './cover-family.js';
import { detailsSheets } from './details-family.js';
import { DEVICES_FAMILY } from './devices-family.js';
import { ENERGY_FAMILY, ENERGY_PERIOD_FAMILY, type FamilyEntry } from './energy-family.js';
import { EXPANDER_FAMILY } from './expander-family.js';
import { ITEMS_FAMILY } from './items-family.js';
import { MEDIA_FAMILY } from './media-family.js';
import { REMOTE_FAMILY } from './remote-family.js';
import { ROOMS_FAMILY } from './rooms-family.js';
import { ROUNDS_FAMILY } from './rounds-family.js';
import { SCHEDULE_FAMILY } from './schedule-family.js';
import { SLIDER_FAMILY } from './slider-family.js';
import { SWIPE_FAMILY } from './swipe-family.js';
import { THERMOSTATS_FAMILY } from './thermostats-family.js';
import { VACUUM_FAMILY } from './vacuum-family.js';
import { VEHICLE_FAMILY } from './vehicle-family.js';
import { TEMPLATE_FAMILY } from './template-family.js';
import { loadChartEngine } from './shared/chart-load.js';
import { WEB_FAMILY } from './web-family.js';
import { WEATHER_FAMILY } from './weather-family.js';

/** A card of the catalogue: its tag and its element (its name and what it is are the catalogue's words, `cards`). */
type CatalogueEntry = readonly [tag: string, element: CustomElementConstructor];

/**
 * The fluvy card catalogue. Registration happens while the module evaluates — never after an
 * await: Home Assistant gives a custom card two seconds to exist before it paints an error in its
 * place. The list reads everyday cards first, the specialised sets after.
 */
const CATALOGUE: readonly CatalogueEntry[] = [
  ['fluvy-tile-card', FluvyTileCard],
  ['fluvy-tiles-card', FluvyTilesCard],
  ['fluvy-light-card', FluvyLightCard],
  ['fluvy-lights-card', FluvyLightsCard],
  ['fluvy-entities-card', FluvyEntitiesCard],
  ['fluvy-fan-card', FluvyFanCard],
  ['fluvy-sensor-card', FluvySensorCard],
  ['fluvy-readouts-card', FluvyReadoutsCard],
  ['fluvy-people-card', FluvyPeopleCard],
  ['fluvy-openings-card', FluvyOpeningsCard],
  ['fluvy-hello-card', FluvyHelloCard],
  ['fluvy-chips-card', FluvyChipsCard],
  ['fluvy-heading-card', FluvyHeadingCard],
  ['fluvy-scene-card', FluvySceneCard],
  ['fluvy-scenes-card', FluvyScenesCard],
  ['fluvy-actions-card', FluvyActionsCard],
  ['fluvy-helpers-card', FluvyHelpersCard],
  ['fluvy-todo-card', FluvyTodoCard],
  ['fluvy-timer-card', FluvyTimerCard],
  ['fluvy-updates-card', FluvyUpdatesCard],
  ['fluvy-gauge-card', FluvyGaugeCard],
  ['fluvy-stat-tiles-card', FluvyStatTilesCard],
  ['fluvy-bars-card', FluvyBarsCard],
  ['fluvy-distribution-card', FluvyDistributionCard],
  ['fluvy-room-card', FluvyRoomCard],
  ['fluvy-map-card', FluvyMapCard],
  ['fluvy-humidity-card', FluvyHumidityCard],
  ['fluvy-clock-card', FluvyClockCard],
];

for (const [tag, element] of CATALOGUE) registerCard(tag, element);

/**
 * A family: its tags and heights, which every page carries, and its chunk — fetched at once, defined as it lands
 * (its English first), its cards with their elements.
 */
type Family = readonly [
  entries: readonly FamilyEntry[],
  chunk: () => Promise<{ readonly CARDS: readonly CatalogueEntry[] }>,
];

/**
 * The weather, calendar, template, web page, Expander, Slider, Cover, Vacuum, Thermostat, remote, items, chart, Swipe,
 * Rounds, Heating schedule, Thermostats and Rooms cards, the Energy period and Energy usage cards, and the media,
 * energy, devices, automations, appliances and alerts families.
 */
const FAMILIES: readonly Family[] = [
  [WEATHER_FAMILY, () => import('./weather-cards.js')],
  [CALENDAR_FAMILY, () => import('./calendar-cards.js')],
  [MEDIA_FAMILY, () => import('./media-cards.js')],
  [REMOTE_FAMILY, () => import('./remote-cards.js')],
  [ENERGY_FAMILY, () => import('./energy-cards.js')],
  [ENERGY_PERIOD_FAMILY, () => import('./energy-period-cards.js')],
  [DEVICES_FAMILY, () => import('./devices-cards.js')],
  [AUTOMATIONS_FAMILY, () => import('./automations-cards.js')],
  [APPLIANCES_FAMILY, () => import('./appliances-cards.js')],
  [ALERTS_FAMILY, () => import('./alerts-cards.js')],
  [TEMPLATE_FAMILY, () => import('./template-cards.js')],
  [WEB_FAMILY, () => import('./web-cards.js')],
  [EXPANDER_FAMILY, () => import('./expander-cards.js')],
  [SLIDER_FAMILY, () => import('./slider-cards.js')],
  [COVER_FAMILY, () => import('./cover-cards.js')],
  [VACUUM_FAMILY, () => import('./vacuum-cards.js')],
  [CLIMATE_FAMILY, () => import('./climate-cards.js')],
  [VEHICLE_FAMILY, () => import('./vehicle-cards.js')],
  [ITEMS_FAMILY, () => import('./items-cards.js')],
  [CHART_FAMILY, () => import('./chart-cards.js')],
  [SWIPE_FAMILY, () => import('./swipe-cards.js')],
  [ROUNDS_FAMILY, () => import('./rounds-cards.js')],
  [SCHEDULE_FAMILY, () => import('./schedule-cards.js')],
  [THERMOSTATS_FAMILY, () => import('./thermostats-cards.js')],
  [ROOMS_FAMILY, () => import('./rooms-cards.js')],
];

// the families: listed and measured now, their elements fetched at once and defined as they land
for (const [entries] of FAMILIES) for (const [tag, height] of entries) announceCard(tag, height);
/**
 * The families defined, the chart engine, the room's quick actions, what says what a thermostat is doing and what
 * says what each card is landed (what a test waits on before its page goes; the bundle never waits): they are fetched
 * with the families, so a core card's chart is drawn before its history answers, a room's quick actions with its first
 * render, a tile asked what its thermostat is doing says so from its first, and the card picker describes every card
 * by the time it is opened.
 */
export const familiesDefined: Promise<unknown> = Promise.all([
  ...FAMILIES.map(([, chunk]) => chunk()),
  loadChartEngine(),
  loadQuickActions(),
  loadDoing(),
  import('./about.js'),
]);

/** Every card with its element: the eager ones, then each family's (docs, tests), the chart engine landed. */
export async function catalogue(): Promise<readonly CatalogueEntry[]> {
  const [chunks] = await Promise.all([
    Promise.all(FAMILIES.map(([, chunk]) => chunk())),
    loadChartEngine(),
  ]);
  return [...CATALOGUE, ...chunks.flatMap(({ CARDS }) => CARDS)];
}
// the automatic dashboards' strategies (`strategy: { type: custom:fluvy-home }` and the other templates; their file is fetched when asked)
defineStrategies();

// Fluvy's own details sheets (1.20, #162) where the house asks for them, fetched the first time one opens
setDetailsSheets(
  detailsSheets(
    () => lookHandle()?.settings().sheets,
    () => lookHandle()?.settings().sheetsHistory,
  ),
);

// a dashboard's own sidebar (1.21, #187), fetched by the first dashboard whose configuration asks for one
setSidebar(() => import('./sidebar/index.js'));

// fluvy's settings: the element of the `panel_custom` Home Assistant shows in the sidebar

export { CATALOGUE };
export { loadPanel, panelOnDemand } from './panel/on-demand.js';
export { detailsSheets, openEntityDetails } from './details-family.js';
export { activityIsOurs, takeOverActivity } from './activity/takeover.js';
export { historyIsOurs, takeOverHistory } from './history/takeover.js';
export { takeOverDetails } from './details-history/takeover.js';
export {
  FluvyActionsCard,
  FluvyBarsCard,
  FluvyChipsCard,
  FluvyClockCard,
  FluvyDistributionCard,
  FluvyEntitiesCard,
  FluvyFanCard,
  FluvyGaugeCard,
  FluvyHeadingCard,
  FluvyHelloCard,
  FluvyHelpersCard,
  FluvyHumidityCard,
  FluvyLightCard,
  FluvyOpeningsCard,
  FluvyPeopleCard,
  FluvyReadoutsCard,
  FluvySceneCard,
  FluvyScenesCard,
  FluvySensorCard,
  FluvyStatTilesCard,
  FluvyTileCard,
  FluvyTilesCard,
  FluvyTimerCard,
  FluvyTodoCard,
  FluvyUpdatesCard,
};
