import {
  applianceTiles,
  balanced,
  coverTiles,
  deviceRows,
  energyFlow,
  entityRows,
  flowed,
  full,
  hasSources,
  headed,
  heading,
  lightGroups,
  lightTiles,
  productionCards,
  readoutsCards,
  runsOf,
  scenesCard,
  solarCurves,
  solarGauges,
  thermostat,
  tileRows,
  when,
  type Loose,
} from '../layout.js';
import type { Card, Section, StrategyContext, ViewSpec } from '../types.js';
import { LIGHT_WORDS, type HomeRegistry } from '../home-registry.js';
import { roomsOf, roomsView } from '../rooms.js';
import { APPLIANCES_PATH, applianceSections } from '../appliances.js';
import {
  byArea,
  capped,
  each,
  foldAt,
  looseAfter,
  moreAfter,
  moreCard,
  moreKeys,
} from '../caps.js';
import { COLUMNS } from '../context.js';
import { listed, part } from '../edit.js';
import {
  consumptionRows,
  distributionCard,
  liveCards,
  metersCards,
  todayCards,
  todayTiles,
} from './energy.js';

/*
 * The views of the home dashboard (`custom:fluvy-home`), in the layout of the approved `/fluvy-home`: each one is
 * a small builder from the house (`HomeRegistry`) to sections of fluvy cards. Every list is capped so a big house
 * still reads, and ends in a "N more" row to a subview of every one (`caps.ts`). The other templates borrow these
 * builders. Every card stands in a part of its view under an id of its own (`part`, #170): a capped list under its
 * list's name, a card alone under what it is.
 */

/** Rows of entities under a title (a room's, where a subview lays them a card a room). */
const rowsCard = (
  home: HomeRegistry,
  title: string,
  ids: readonly string[],
  extra: Record<string, unknown> = {},
): Card => full('entities', { title, rows: entityRows(home, ids), ...extra });

/**
 * What needs a look, first on Home and hidden while all is clear: leaks and smoke, what is left open (five minutes, the
 * preset's wait: a door walked through never moves the page) or unlocked (ten), errors and low batteries; for an
 * administrator the updates and the repairs too. Three tiles, the rest under a fold.
 */
const attention = (ctx: StrategyContext): Card =>
  full('alerts', {
    title: ctx.t('strategy.attention'),
    alerts: [
      { preset: 'hazards' },
      { preset: 'open' },
      { preset: 'unlocked' },
      { preset: 'errors' },
      { preset: 'low_battery' },
      { preset: 'updates', admin_only: true },
      { preset: 'repairs' },
    ],
    max_alerts: 3,
  });

export function homeView(ctx: StrategyContext): Section[] {
  const { home, t, base, weather, energy } = ctx;
  const { climate } = home;
  const lights = capped(
    ctx,
    { key: 'lights', title: 'room.lights', icon: 'fluvy:bulb' },
    home.lights,
    (ids) => lightGroups(ctx, ids),
  );
  const appliances = capped(
    ctx,
    { key: 'appliances', title: 'strategy.appliances', icon: 'fluvy:plug' },
    home.applianceTiles,
    (ids) => tileRows(applianceTiles(home, ids, ctx.style)),
  );
  const covers = capped(
    ctx,
    { key: 'covers', title: 'room.covers', icon: 'fluvy:blinds' },
    home.covers,
    (ids) =>
      byArea(ctx, ids, t('room.covers'), (title, own) => [
        heading(title, 'fluvy:blinds', own),
        coverTiles(home, own),
      ]),
  );
  const readings = capped(
    ctx,
    { key: 'readings', title: 'strategy.readings', icon: 'fluvy:thermo' },
    home.temperatures,
    (ids) => readoutsCards(home, ids).map((card) => [card]),
  );
  const secured = capped(
    ctx,
    { key: 'security', title: 'strategy.security', icon: 'fluvy:shield' },
    [...home.domain('lock'), ...home.openings],
    (ids) => byArea(ctx, ids, t('strategy.security'), (title, own) => [rowsCard(home, title, own)]),
  );
  const scenes = capped(
    ctx,
    { key: 'scenes', title: 'strategy.scenes', icon: 'fluvy:sparkle' },
    home.scenes,
    (ids) => [[scenesCard(home, t('strategy.scenes'), ids)]],
  );
  // what needs a look, then the controls, the climate and the day, the energy and the house's state, in reading
  // order; the single-purpose cards fill the columns' feet; the appliances as the reporter of #47 drew them, across
  // under them
  const columns = flowed(
    ctx,
    [
      part(ctx, 'attention', [attention(ctx)]),
      ...part(
        ctx,
        'lights',
        when(lights.shown.length, () =>
          moreAfter(
            headed(
              heading(t('room.lights'), 'fluvy:bulb', lights.all, `${base}/lights`),
              tileRows(lightTiles(home, lights.shown, ctx.style)),
            ),
            lights,
          ),
        ),
      ),
      ...part(
        ctx,
        'appliances',
        when(appliances.shown.length, () =>
          moreAfter(
            headed(
              heading(t('strategy.appliances'), 'fluvy:plug', appliances.all),
              tileRows(applianceTiles(home, appliances.shown, ctx.style)),
            ),
            appliances,
          ),
        ),
      ),
      ...part(
        ctx,
        'covers',
        when(covers.shown.length, () =>
          moreAfter(
            [
              [
                heading(t('room.covers'), 'fluvy:blinds', covers.all),
                coverTiles(home, covers.shown),
              ],
            ],
            covers,
          ),
        ),
      ),
      part(
        ctx,
        'thermostat',
        when(climate[0], (id) => [thermostat(id, ctx.style)]),
      ),
      ...part(
        ctx,
        'readings',
        moreAfter(
          readoutsCards(home, readings.shown).map((card) => [card]),
          readings,
        ),
      ),
      part(
        ctx,
        'weather',
        when(weather, (entity) => [full('weather', { entity })]),
      ),
      part(ctx, 'clock', [full('clock', { face: 'digital', ...(weather ? { weather } : {}) })]),
      part(
        ctx,
        'flow',
        when(hasSources(energy), () => [energyFlow(energy, ctx.style)]),
      ),
      part(
        ctx,
        'curve',
        energy.solarPowers.length
          ? solarCurves(energy, { name: t('energy.solar') })
          : energy.homePower
            ? [full('energy', { entity: energy.homePower })]
            : [],
      ),
      part(
        ctx,
        'security',
        when(secured.shown.length, () => [
          rowsCard(home, t('strategy.security'), secured.shown, moreKeys(secured)),
        ]),
      ),
    ],
    [
      ...part(
        ctx,
        'media',
        when(home.first('media_player'), (id) => [
          full('media', { entity: id, variant: 'mini', ...home.named(id) }),
        ]),
      ),
      ...part(
        ctx,
        'vacuum',
        when(home.first('vacuum'), (id) => [full('vacuum', { entity: id, ...home.named(id) })]),
      ),
      // every printer, compact: an overview's card (the camera and the buttons are a tap away, on the device)
      ...home.printers.flatMap((device) =>
        part(ctx, `printer:${device}`, [full('printer', { device, variant: 'compact' })]),
      ),
      ...part(
        ctx,
        'todo',
        when(home.first('todo'), (id) => [full('todo', { entity: id })]),
      ),
      // the house's scenes, a tap away, their "N more" row kept under them
      ...part(
        ctx,
        'scenes',
        when(scenes.shown.length, () =>
          looseAfter([scenesCard(home, t('strategy.scenes'), scenes.shown)], scenes),
        ),
      ),
    ],
  );
  return [
    ...columns,
    ...applianceSections(ctx, home.applianceDevices, COLUMNS, {
      path: `${base}/${APPLIANCES_PATH}`,
      caps: true,
    }),
  ];
}

/**
 * By area when areas are assigned, else indoor / outdoor; the biggest group first; the scenes and the light automations
 * last, on one card titled by what it holds: Scenes, else Automations.
 */
export function lightsView(ctx: StrategyContext): Section[] {
  const { home, t } = ctx;
  const blocks = lightGroups(ctx, home.lights, true);
  const automations = home.automations.filter((id) => LIGHT_WORDS.test(id));
  const title = automations.length ? 'strategy.automations' : 'strategy.scenes';
  const scenes = capped(
    ctx,
    { key: 'scenes', title, icon: 'fluvy:sparkle' },
    [...home.scenes, ...automations],
    (ids) => [[scenesCard(home, t(title), ids)]],
  );
  blocks.push(
    ...part(
      ctx,
      'scenes',
      when(scenes.shown.length, () =>
        moreAfter([[scenesCard(home, t(title), scenes.shown)]], scenes),
      ),
    ),
  );
  return flowed(ctx, blocks);
}

/** Thermostats first, then the forecast, humidity and temperatures, shared out so the three columns end level. */
export function climateView(ctx: StrategyContext): Section[] {
  const { home } = ctx;
  // each reading by its place, two cards of one kind in one place told apart (#170): a humidity card beside a
  // temperature's says what it reads
  const placed = (ids: readonly string[]) => home.apart(ids, (id) => home.placeName(id));
  const humidityName = placed(home.humidities);
  const temperatureName = placed(home.temperatures);
  const fan = (id: string): Card => full('fan', { entity: id, ...home.named(id) });
  const humidity = (id: string): Card => {
    const temperature = home.temperatureBeside(id);
    return full('humidity', {
      entity: id,
      name: humidityName(id),
      ...(temperature ? { temperature_entity: temperature } : {}),
    });
  };
  const sensor = (id: string): Card => full('sensor', { entity: id, name: temperatureName(id) });
  const thermostats = capped(
    ctx,
    { key: 'thermostats', title: 'strategy.thermostats', icon: 'fluvy:thermo' },
    home.climate,
    each((id) => thermostat(id, ctx.style)),
  );
  const fans = capped(
    ctx,
    { key: 'fans', title: 'room.fans', icon: 'fluvy:fan' },
    home.fans,
    each(fan),
  );
  const humidities = capped(
    ctx,
    { key: 'humidity', title: 'strategy.humidity', icon: 'fluvy:humid' },
    home.humidities,
    each(humidity),
  );
  const temperatures = capped(
    ctx,
    { key: 'temperatures', title: 'strategy.temperatures', icon: 'fluvy:thermo' },
    home.temperatures,
    each(sensor),
  );
  return balanced(ctx, [
    ...part(
      ctx,
      'thermostats',
      looseAfter(
        thermostats.shown.map((id) => thermostat(id, ctx.style)),
        thermostats,
      ),
    ),
    ...part(ctx, 'fans', looseAfter(fans.shown.map(fan), fans)),
    ...part(
      ctx,
      'weather',
      home.weather.slice(0, 1).map((id) => full('weather', { entity: id })),
    ),
    ...part(ctx, 'humidity', looseAfter(humidities.shown.map(humidity), humidities)),
    ...part(ctx, 'temperatures', looseAfter(temperatures.shown.map(sensor), temperatures)),
  ]);
}

/**
 * The house's energy, shared out over three level columns: the live cards first (the flow, the balance, the day by
 * source, the grid, the batteries, the charger), then the day's totals, what the sun makes, what the house draws,
 * and water and gas.
 */
export function energyView(ctx: StrategyContext): Section[] {
  const { t, energy } = ctx;
  const { gridPower } = energy;
  return balanced(ctx, [
    ...liveCards(ctx),
    ...part(
      ctx,
      'curve',
      energy.prefsMeters
        ? []
        : energy.solarPowers.length
          ? solarCurves(energy, { name: t('energy.solar') })
          : gridPower
            ? [full('energy', { entity: gridPower, name: t('energy.grid') })]
            : [],
    ),
    ...todayCards(ctx),
    ...todayTiles(ctx),
    ...part(ctx, 'gauges', solarGauges(energy)),
    ...productionCards(ctx),
    ...distributionCard(ctx),
    ...consumptionRows(ctx),
    ...metersCards(ctx),
  ]);
}

/** Whether the house has a security view: an alarm, a lock, a camera or a way in (the openings then move there). */
export const secured = (home: HomeRegistry): boolean =>
  Boolean(home.alarms.length || home.locks.length || home.cameras.length || home.gateways.length);

/** The alarm first, then what opens (locks, garage doors and gates), what is open, and the first four cameras. */
export function securityView(ctx: StrategyContext): Section[] {
  return balanced(ctx, securityCards(ctx));
}

/**
 * The security overview's cards, each list at its cap: the alarms, the locks, the garage doors and gates, every
 * opening (the card folds them itself), the cameras on one Cameras card (`cameras` gives the dashboard's refresh).
 */
export function securityCards(
  ctx: StrategyContext,
  camerasCard: (ids: readonly string[]) => Card = (ids) => full('cameras', { cameras: [...ids] }),
): Loose[] {
  const { home, t } = ctx;
  const alarm = (id: string): Card => full('alarm', { entity: id, ...home.named(id) });
  const lock = (id: string): Card => full('lock', { entity: id, ...home.named(id) });
  const gate = (id: string): Card => full('cover', { entity: id, ...home.named(id) });
  const alarms = capped(
    ctx,
    { key: 'alarms', title: 'strategy.alarms', icon: 'fluvy:shield' },
    home.alarms,
    each(alarm),
  );
  const locks = capped(
    ctx,
    { key: 'locks', title: 'strategy.locks', icon: 'fluvy:lock' },
    home.locks,
    each(lock),
  );
  const gates = capped(
    ctx,
    { key: 'gates', title: 'strategy.gates', icon: 'fluvy:door' },
    home.gateways,
    each(gate),
  );
  const cameras = capped(
    ctx,
    { key: 'cameras', title: 'strategy.cameras', icon: 'fluvy:camera' },
    home.cameras,
    (ids) => runsOf(ids, 4).map((run) => [camerasCard(run)]),
  );
  const openings = listed(ctx, 'openings', home.openings);
  return [
    ...part(ctx, 'alarms', looseAfter(alarms.shown.map(alarm), alarms)),
    ...part(ctx, 'locks', looseAfter(locks.shown.map(lock), locks)),
    ...part(ctx, 'gates', looseAfter(gates.shown.map(gate), gates)),
    ...part(
      ctx,
      'openings',
      when(openings.length, () => [
        full('openings', {
          title: t('strategy.sensors'),
          entities: [...openings],
          ...foldAt(ctx, 'openings', openings),
        }),
      ]),
    ),
    ...part(
      ctx,
      'cameras',
      when(cameras.shown.length, () => looseAfter([camerasCard(cameras.shown)], cameras)),
    ),
  ];
}

/** What plays now (only while something does), then every other player of the house. */
export function mediaView(ctx: StrategyContext): Section[] {
  const { home } = ctx;
  const playing =
    home.players.find((id) => home.state(id) === 'playing') ??
    home.players.find((id) => home.state(id) === 'paused');
  const player = (id: string): Card => full('media', { entity: id, ...home.named(id) });
  // what plays first, wherever it is in the list
  const players = capped(
    ctx,
    { key: 'media', title: 'room.media', icon: 'fluvy:speaker' },
    playing ? [playing, ...home.players.filter((id) => id !== playing)] : home.players,
    each(player),
  );
  return balanced(
    ctx,
    part(
      ctx,
      'media',
      looseAfter(
        players.shown.map((id) =>
          id === playing ? full('now-playing', { entity: id, ...home.named(id) }) : player(id),
        ),
        players,
      ),
    ),
  );
}

/** The calendars, the lists, the timers and what a person runs by hand. */
export function agendaView(ctx: StrategyContext): Section[] {
  const { home, t } = ctx;
  const calendar = (ids: readonly string[]): Card =>
    full('calendar', { entities: [...ids], variant: 'month-day' });
  const list = (id: string): Card => full('todo', { entity: id });
  const timer = (id: string): Card => full('timer', { entity: id, ...home.named(id) });
  const actionsCard = (title: string, ids: readonly string[]): Card =>
    full('actions', { title, entities: [...ids] });
  const calendars = capped(
    ctx,
    { key: 'calendars', title: 'strategy.calendars', icon: 'fluvy:calendar' },
    home.calendars,
    (ids) => runsOf(ids, 3).map((run) => [calendar(run)]),
  );
  const lists = capped(
    ctx,
    { key: 'lists', title: 'strategy.lists', icon: 'fluvy:list' },
    home.lists,
    each(list),
  );
  const timers = capped(
    ctx,
    { key: 'timers', title: 'strategy.timers', icon: 'fluvy:timer' },
    home.timers,
    each(timer),
  );
  const runnables = capped(
    ctx,
    { key: 'actions', title: 'strategy.actions', icon: 'fluvy:script' },
    home.runnables,
    (ids) => byArea(ctx, ids, t('strategy.actions'), (title, own) => [actionsCard(title, own)]),
  );
  return balanced(ctx, [
    ...part(
      ctx,
      'calendars',
      when(calendars.shown.length, () => looseAfter([calendar(calendars.shown)], calendars)),
    ),
    ...part(ctx, 'lists', looseAfter(lists.shown.map(list), lists)),
    ...part(ctx, 'timers', looseAfter(timers.shown.map(timer), timers)),
    ...part(
      ctx,
      'actions',
      when(runnables.shown.length, () =>
        looseAfter([actionsCard(t('strategy.actions'), runnables.shown)], runnables),
      ),
    ),
  ]);
}

export function sensorsView(ctx: StrategyContext): Section[] {
  const { home, t } = ctx;
  const zones = home.zones.filter((id) => id !== 'zone.home');
  const { openings, people } = home;
  const bars = (title: string, rows: readonly unknown[]): Card => full('bars', { title, rows });
  const devices = (ids: readonly string[]): unknown[] => deviceRows(home, ids);
  const helpersCard = (title: string, ids: readonly string[]): Card =>
    full('helpers', { title, entities: [...ids] });
  const updatesCard = (title: string, ids: readonly string[]): Card =>
    full('updates', { title, entities: [...ids] });
  /** A list of the view, at its cap, its subview a card a room. */
  const list = (
    key: 'batteries' | 'phones' | 'plants' | 'helpers' | 'updates',
    icon: string,
    ids: readonly string[],
    card: (title: string, ids: readonly string[]) => Card,
  ) => {
    const title = t(`strategy.${key}`);
    const items = capped(ctx, { key, title: `strategy.${key}`, icon }, ids, (all) =>
      byArea(ctx, all, title, (name, own) => [card(name, own)]),
    );
    return part(
      ctx,
      key,
      when(items.shown.length, () => [card(title, items.shown), ...moreCard(items)]),
    );
  };
  const present = listed(ctx, 'people', people);
  const open = listed(ctx, 'openings', openings);
  // what runs on batteries, who is home, what is open, then the helpers and the updates
  return flowed(ctx, [
    list('batteries', 'fluvy:battery', home.batteries, (title, ids) => bars(title, devices(ids))),
    list('phones', 'fluvy:battery', home.phones, (title, ids) => bars(title, devices(ids))),
    [
      ...part(
        ctx,
        'people',
        when(present.length, () => [
          full('people', { title: t('strategy.people'), entities: [...present] }),
        ]),
      ),
      ...part(
        ctx,
        'map',
        when(zones.length && present.length, () => [
          {
            type: 'custom:fluvy-map-card',
            entities: [...present],
            variant: 'zones',
            grid_options: { columns: 12 },
          } as Card,
        ]),
      ),
    ],
    // with a security view the openings live there
    part(
      ctx,
      'openings',
      when(!secured(home) && open.length, () => [
        full('openings', {
          title: t('strategy.sensors'),
          entities: [...open],
          ...foldAt(ctx, 'openings', open),
        }),
      ]),
    ),
    list('plants', 'fluvy:leaf', home.plants, (title, ids) => bars(title, [...ids])),
    list('helpers', 'fluvy:sliders', home.helpers, helpersCard),
    list('updates', 'fluvy:update', home.updates, updatesCard),
    part(
      ctx,
      'camera',
      when(home.first('camera'), (id) => [full('camera', { entity: id })]),
    ),
  ]);
}

/** The home dashboard's views in tab order. Home is always there; the others only when the house has what they show. */
export const HOME_VIEWS: readonly ViewSpec[] = [
  { key: 'home', icon: 'fluvy:home', title: 'strategy.home', build: homeView, when: () => true },
  {
    key: 'rooms',
    icon: 'fluvy:door',
    title: 'strategy.rooms',
    build: roomsView,
    // one room is the home view; the rooms need two to be a view
    when: ({ home }) => roomsOf(home).length >= 2,
  },
  {
    key: 'lights',
    icon: 'fluvy:bulb',
    title: 'room.lights',
    build: lightsView,
    when: ({ home }) => home.lights.length > 0,
  },
  {
    key: 'climate',
    icon: 'fluvy:thermo',
    title: 'room.climate',
    build: climateView,
    when: ({ home, weather }) =>
      Boolean(home.climate.length || home.temperatures.length || weather),
  },
  {
    key: 'energy',
    icon: 'fluvy:bolt',
    title: 'strategy.energy',
    build: energyView,
    when: ({ energy }) => energy.any,
  },
  {
    key: 'security',
    icon: 'fluvy:shield',
    title: 'strategy.security',
    build: securityView,
    when: ({ home }) => secured(home),
  },
  {
    key: 'media',
    icon: 'fluvy:speaker',
    title: 'room.media',
    build: mediaView,
    when: ({ home }) => home.players.length > 0,
  },
  {
    key: 'agenda',
    icon: 'fluvy:calendar',
    title: 'strategy.agenda',
    build: agendaView,
    // one to-do list already lives on the home view
    when: ({ home }) =>
      Boolean(
        home.calendars.length ||
        home.timers.length ||
        home.runnables.length ||
        home.lists.length > 1,
      ),
  },
  { key: 'sensors', icon: 'fluvy:signal', title: 'strategy.sensors', build: sensorsView },
];
