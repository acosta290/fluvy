import { FluvyChartCard } from '../../../../packages/cards/src/chart/chart-card.js';
import type { StateSeed } from '../hass.js';
import { NOW } from '../now.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-chart-card'))
  customElements.define('fluvy-chart-card', FluvyChartCard);

/*
 * A Chart card's series of states (#228), on the sheets' evening (Thursday 17 September 2026, 21:47): the hall tablet's
 * battery over the day with its charger's smart plug as a strip under it (the plug turns on at 20 % and off at 80 %,
 * and dropped off the network for forty minutes before dawn: striped, never "off"); the heat pump's power with its
 * mode as words, each in a colour of its own and its standby the strip's own fill; the kitchen's temperature with the
 * back door under it; the washer and the porch light as strips alone, and the front door alone, a tile too; a boiler's
 * call for heat as a template sensor's 0 and 100, read as their mean and as their highest (`stat: max`); and a sensor
 * that went unavailable for four hours, drawn as a gap in a line and in columns. The recorder answers from
 * the sheets' moment alone, so a frame is the same at every width and in either theme.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOW_ISO = NOW.toISOString();
/** Thursday's midnight: the times below are its clock's (negative: Wednesday's). */
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate()).getTime();
const at = (hour: number, minute = 0): number => TODAY + hour * HOUR + minute * MINUTE;

const BATTERY = 'sensor.chs_tablet_battery';
const CHARGER = 'switch.chs_tablet_charger';
const PUMP_POWER = 'sensor.chs_heat_pump_power';
const PUMP_MODE = 'sensor.chs_heat_pump_mode';
const KITCHEN = 'sensor.chs_kitchen_temperature';
const BACK_DOOR = 'binary_sensor.chs_back_door';
const FRONT_DOOR = 'binary_sensor.chs_front_door';
const WASHER = 'sensor.chs_washer';
const PORCH = 'light.chs_porch';
const BOILER = 'sensor.chs_boiler_call';
const BEDROOM = 'sensor.chs_bedroom_temperature';
const DEHUMIDIFIER = 'sensor.chs_dehumidifier_power';
const GARAGE_PLUG = 'switch.chs_garage_plug';

/** A pseudo-random fraction of an index, the same on every page. */
const noise = (i: number): number => (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1;

/** A thing's changes of state: from each moment, its state until the next. */
type Changes = ReadonlyArray<readonly [number, string]>;

/** The state in force at `t`. */
const stateAt = (changes: Changes, t: number): string => {
  let state = changes[0]?.[1] ?? 'unknown';
  for (const [from, said] of changes) if (from <= t) state = said;
  return state;
};

/* ---------- the hall tablet and its charger ---------- */

/**
 * The tablet's battery from Tuesday's 21:00, every five minutes, and its charger's plug: a wall tablet's screen takes
 * six points an hour, the charger gives twenty-five; an automation turns the plug on at 20 % and off at 80 %. The plug
 * dropped off the network from 05:10 to 05:50 (the tablet ran on, the charger was off).
 */
const tablet = (() => {
  const levels: Array<readonly [number, number]> = [];
  const plug: Array<[number, string]> = [];
  const lost = [at(5, 10), at(5, 50)] as const;
  let level = 63;
  let on = false;
  plug.push([at(-25), 'off']);
  for (let t = at(-25); t <= NOW.getTime(); t += 5 * MINUTE) {
    level += on ? 25 / 12 : -(5.4 + 1.2 * noise(t / HOUR)) / 12;
    if (!on && level <= 20) {
      on = true;
      plug.push([t, 'on']);
    } else if (on && level >= 80) {
      on = false;
      plug.push([t, 'off']);
    }
    levels.push([t, Math.round(level)]);
  }
  plug.push([lost[0], 'unavailable'], [lost[1], stateAt(plug, lost[1])]);
  plug.sort((a, b) => a[0] - b[0]);
  return { levels, plug: plug as Changes };
})();

/* ---------- the heat pump ---------- */

/** The heat pump's mode through the day: standby at night, heating the morning and the evening, hot water and defrosts. */
const PUMP: Changes = [
  [at(-25), 'standby'],
  [at(-5, 30), 'heating'],
  [at(-3, 0), 'standby'],
  [at(5, 20), 'heating'],
  [at(6, 0), 'hot_water'],
  [at(6, 40), 'heating'],
  [at(7, 12), 'defrost'],
  [at(7, 21), 'heating'],
  [at(9, 15), 'standby'],
  [at(15, 50), 'heating'],
  [at(18, 22), 'defrost'],
  [at(18, 30), 'heating'],
  [at(19, 5), 'hot_water'],
  [at(19, 48), 'heating'],
  [at(21, 30), 'standby'],
];

/** What the heat pump draws in each mode (W), with a compressor's wobble. */
const PUMP_WATTS: Readonly<Record<string, number>> = {
  standby: 18,
  heating: 1650,
  hot_water: 2350,
  defrost: 420,
};
const pumpPower = (t: number): number => {
  const watts = PUMP_WATTS[stateAt(PUMP, t)] ?? 0;
  return watts < 100 ? watts : Math.round(watts * (0.92 + 0.14 * noise(t / (10 * MINUTE))));
};

/* ---------- the kitchen and its back door ---------- */

/** The back door: the morning's bins, the lunch break, the shopping brought in, the cat let out. */
const BACK: Changes = [
  [at(-25), 'off'],
  [at(-6, 10), 'on'],
  [at(-6, 14), 'off'],
  [at(7, 42), 'on'],
  [at(7, 49), 'off'],
  [at(12, 31), 'on'],
  [at(12, 34), 'off'],
  [at(17, 55), 'on'],
  [at(18, 21), 'off'],
  [at(21, 8), 'on'],
  [at(21, 11), 'off'],
];

/** The kitchen's temperature: the day's swing, the oven at dinner, and a cool draught while the back door is open. */
const kitchen = (t: number): number => {
  const hour = (t - TODAY) / HOUR;
  let cooled = 0;
  BACK.forEach(([from, state], i) => {
    if (state !== 'on' || from > t) return;
    const to = BACK[i + 1]?.[0] ?? t;
    const open = Math.min(t, to) - from;
    cooled +=
      Math.min(2.4, (open / MINUTE) * 0.12) * Math.exp(-Math.max(0, t - to) / (40 * MINUTE));
  });
  const day = 20.4 + 1.3 * Math.sin(((hour - 10) / 24) * 2 * Math.PI);
  const oven = 1.4 * Math.exp(-(((((hour % 24) + 24) % 24) - 19) ** 2) / 1.2);
  return Math.round((day + oven - cooled) * 10) / 10;
};

/* ---------- strips alone ---------- */

/** The washer's programme this morning and this evening, its words as its integration writes them. */
const WASHER_STATES: Changes = [
  [at(-25), 'idle'],
  [at(8, 5), 'washing'],
  [at(9, 0), 'rinsing'],
  [at(9, 25), 'spinning'],
  [at(9, 38), 'idle'],
  [at(18, 40), 'washing'],
  [at(19, 30), 'rinsing'],
  [at(19, 52), 'spinning'],
  [at(20, 4), 'idle'],
];

/** The porch light: on from dusk to its timer, and from dusk again tonight. */
const PORCH_STATES: Changes = [
  [at(-25), 'on'],
  [at(-1, 0), 'off'],
  [at(5, 55), 'on'],
  [at(7, 10), 'off'],
  [at(19, 58), 'on'],
];

/** The front door: out in the morning, the post at noon, home in the evening. */
const FRONT: Changes = [
  [at(-25), 'off'],
  [at(7, 55), 'on'],
  [at(7, 57), 'off'],
  [at(12, 2), 'on'],
  [at(12, 3), 'off'],
  [at(17, 48), 'on'],
  [at(17, 51), 'off'],
  [at(20, 15), 'on'],
  [at(20, 16), 'off'],
];

/* ---------- a 0/100 template sensor (#228, @twodrops) ---------- */

/** The boiler's call for heat as a template sensor writes it: 100 while it calls, 0 while it does not. */
const BOILER_CALLS: Changes = [
  [at(-25), '0'],
  [at(9, 52), '100'],
  [at(10, 31), '0'],
  [at(11, 40), '100'],
  [at(11, 58), '0'],
  [at(13, 14), '100'],
  [at(14, 2), '0'],
  [at(15, 33), '100'],
  [at(15, 41), '0'],
  [at(17, 5), '100'],
  [at(18, 20), '0'],
  [at(19, 26), '100'],
  [at(20, 9), '0'],
  [at(21, 4), '100'],
  [at(21, 22), '0'],
];

/* ---------- a sensor that went away (the gap) ---------- */

/** Off the network from 01:40 to 05:50 (the Zigbee router's update): a gap, never the last reading carried across. */
const AWAY = [at(1, 40), at(5, 50)] as const;
const bedroom = (t: number): number => {
  const hour = (t - TODAY) / HOUR;
  return Math.round((18.9 + 1.6 * Math.sin(((hour - 11) / 24) * 2 * Math.PI)) * 10) / 10;
};
const dehumidifier = (t: number): number => {
  const hour = ((((t - TODAY) / HOUR) % 24) + 24) % 24;
  return hour > 1 && hour < 8 ? Math.round(185 + 30 * noise(t / (15 * MINUTE))) : 2;
};

/** The garage plug: on overnight for the mower's battery, out of reach since 20:40. */
const GARAGE: Changes = [
  [at(-25), 'off'],
  [at(-2, 0), 'on'],
  [at(6, 30), 'off'],
  [at(20, 40), 'unavailable'],
];

/* ---------- the recorder ---------- */

/** A thing's changes as `history/history_during_period` sends them: its state at the window's start, each change in it. */
const rowsOf = (changes: Changes, start: number, end: number) => {
  const to = Math.min(end, NOW.getTime());
  return [
    { s: stateAt(changes, start), lu: start / 1000 },
    ...changes.filter(([t]) => t > start && t <= to).map(([t, s]) => ({ s, lu: t / 1000 })),
  ];
};

/** A sensor read every `step`, as changes (a reading only where it moved), unavailable where `away` says. */
const readOf = (
  value: (t: number) => number,
  step: number,
  away?: readonly [number, number],
): Changes => {
  const out: Array<[number, string]> = [];
  for (let t = at(-25); t <= NOW.getTime(); t += step) {
    const said = away && t >= away[0] && t < away[1] ? 'unavailable' : String(value(t));
    if (out[out.length - 1]?.[1] !== said) out.push([t, said]);
  }
  return out;
};

const RECORDED: Readonly<Record<string, Changes>> = {
  [BATTERY]: tablet.levels.map(([t, v]) => [t, String(v)] as const),
  [CHARGER]: tablet.plug,
  [PUMP_POWER]: readOf(pumpPower, 2 * MINUTE),
  [PUMP_MODE]: PUMP,
  [KITCHEN]: readOf(kitchen, 2 * MINUTE),
  [BACK_DOOR]: BACK,
  [FRONT_DOOR]: FRONT,
  [WASHER]: WASHER_STATES,
  [PORCH]: PORCH_STATES,
  [BOILER]: BOILER_CALLS,
  [BEDROOM]: readOf(bedroom, 5 * MINUTE, AWAY),
  [DEHUMIDIFIER]: readOf(dehumidifier, 5 * MINUTE, AWAY),
  [GARAGE_PLUG]: GARAGE,
};

/** The state now: the last change. */
const now = (id: string): string => stateAt(RECORDED[id] ?? [], NOW.getTime());

const seed = (id: string, name: string, attributes: Record<string, unknown> = {}): StateSeed => [
  id,
  now(id),
  { friendly_name: name, ...attributes },
];

const POWER = { unit_of_measurement: 'W', device_class: 'power', state_class: 'measurement' };
const TEMPERATURE = {
  unit_of_measurement: '°C',
  device_class: 'temperature',
  state_class: 'measurement',
};

/** A Chart card frozen on the sheets' moment. */
const card = (extra: Record<string, unknown>) => ({
  type: 'custom:fluvy-chart-card',
  _now: NOW_ISO,
  ...extra,
});

/** The issue's card: the hall tablet's battery over the day, its charger's plug as a strip under it. */
const TABLET = card({
  title: 'Hall tablet',
  icon: 'battery',
  series: [
    { entity: BATTERY, name: 'Battery' },
    { entity: CHARGER, kind: 'states', name: 'Charger' },
  ],
  span: '24h',
  chart: 'soft',
});

/** The heat pump's power, its mode as words under it: heating, hot water and defrost in colours of their own. */
const HEAT_PUMP = card({
  title: 'Heat pump',
  icon: 'heater',
  series: [
    { entity: PUMP_POWER, name: 'Power' },
    {
      entity: PUMP_MODE,
      kind: 'states',
      name: 'Mode',
      state_colors: { heating: 'heat', hot_water: 'water', defrost: 'cool', standby: 'none' },
    },
  ],
  span: '24h',
  chart: 'soft',
});

/** The kitchen's temperature, the back door under it: the draughts line up with the door. */
const KITCHEN_DOOR = card({
  title: 'Kitchen',
  series: [
    { entity: KITCHEN, name: 'Temperature' },
    { entity: BACK_DOOR, kind: 'states', name: 'Back door' },
  ],
  span: 'today',
  chart: 'classic',
});

/**
 * The washer and the porch light as strips alone: they take the plot's room. The washer's words are all "doing
 * something" to Home Assistant: its colours name each phase, and its idle the strip's own fill.
 */
const STRIPS_ALONE = card({
  title: 'Utility',
  series: [
    {
      entity: WASHER,
      kind: 'states',
      name: 'Washer',
      state_colors: { idle: 'none', washing: 'water', rinsing: 'cool', spinning: 'accent' },
    },
    { entity: PORCH, kind: 'states', name: 'Porch light' },
  ],
  span: '24h',
});

const FRONT_ALONE = card({
  series: [{ entity: FRONT_DOOR, kind: 'states', name: 'Front door' }],
  span: '24h',
});

/** The boiler's call as 0 and 100: its mean blurs a call's edges, its highest stepped keeps them square. */
const boiler = (extra: Record<string, unknown>) =>
  card({
    series: [{ entity: BOILER, name: 'Boiler call', ...extra }],
    span: '12h',
    chart: 'soft',
    show_head: false,
  });
const HIGHEST = { stat: 'max', curve: 'step' };

export const sheet: SheetSpec = {
  states: [
    seed(BATTERY, 'Hall tablet battery', {
      unit_of_measurement: '%',
      device_class: 'battery',
      state_class: 'measurement',
    }),
    seed(CHARGER, 'Hall tablet charger'),
    seed(PUMP_POWER, 'Heat pump power', POWER),
    seed(PUMP_MODE, 'Heat pump mode', {
      device_class: 'enum',
      options: ['standby', 'heating', 'hot_water', 'defrost'],
    }),
    seed(KITCHEN, 'Kitchen temperature', TEMPERATURE),
    seed(BACK_DOOR, 'Back door', { device_class: 'door' }),
    seed(FRONT_DOOR, 'Front door', { device_class: 'door' }),
    seed(WASHER, 'Washer', {
      device_class: 'enum',
      options: ['idle', 'washing', 'rinsing', 'spinning'],
    }),
    seed(PORCH, 'Porch light'),
    seed(BOILER, 'Boiler call'),
    seed(BEDROOM, 'Bedroom temperature', TEMPERATURE),
    seed(DEHUMIDIFIER, 'Dehumidifier', POWER),
    seed(GARAGE_PLUG, 'Garage plug'),
  ],
  ws: {
    'history/history_during_period': (message) => {
      const ids = (message['entity_ids'] as readonly string[]).filter((id) => id in RECORDED);
      if (!ids.length) return undefined;
      const start = Date.parse(String(message['start_time']));
      const end = Date.parse(String(message['end_time']));
      return Object.fromEntries(ids.map((id) => [id, rowsOf(RECORDED[id] ?? [], start, end)]));
    },
  },
  frames: [
    // #228's picture: a battery's line and its charger's on and off as a strip under the plot, on its time
    { title: 'Chart states · tablet and charger', cards: [TABLET] },
    { title: 'Chart states · tablet and charger, a phone', width: 360, cards: [TABLET] },
    // a word state in colours of its own (`state_colors`), its standby the strip's own fill
    { title: 'Chart states · heat pump and its mode', cards: [HEAT_PUMP] },
    { title: 'Chart states · kitchen and back door', cards: [KITCHEN_DOOR] },
    // states alone: the strips take the plot's room, read by hand as a chart is
    { title: 'Chart states · strips alone', cards: [STRIPS_ALONE, FRONT_ALONE] },
    {
      title: 'Chart states · compact and tiles',
      cards: [
        { ...TABLET, variant: 'compact' },
        { ...FRONT_ALONE, variant: 'tile', cols: 6 },
        { ...TABLET, variant: 'tile', cols: 6 },
      ],
    },
    // four series: the legend under the axis, the strip under the plot
    {
      title: 'Chart states · four series',
      cards: [
        card({
          title: 'Heat pump',
          series: [
            { entity: PUMP_POWER, name: 'Power' },
            { entity: KITCHEN, name: 'Kitchen' },
            { entity: BEDROOM, name: 'Bedroom' },
            {
              entity: PUMP_MODE,
              kind: 'states',
              name: 'Mode',
              state_colors: {
                heating: 'heat',
                hot_water: 'water',
                defrost: 'cool',
                standby: 'none',
              },
            },
          ],
          span: '24h',
        }),
      ],
    },
    // a plug out of reach now: its last stretch striped, the card in the off skin
    {
      title: 'Chart states · out of reach',
      cards: [
        card({
          series: [{ entity: GARAGE_PLUG, kind: 'states', name: 'Garage plug' }],
          span: '24h',
        }),
      ],
    },
    {
      title: 'Chart states · half a section',
      heights: [152, 172, 211, 266],
      cards: [
        { ...TABLET, cols: 6 },
        { ...FRONT_ALONE, cols: 6 },
      ],
    },
    // @twodrops' template sensor of 0 and 100: its mean draws ramps between them, its highest stepped only 0 and 100
    {
      title: 'Chart · 0 and 100, the mean and the highest',
      cards: [
        { ...boiler({}), title: 'The mean' },
        { ...boiler(HIGHEST), title: 'The highest' },
      ],
    },
    // a sensor unavailable from 01:40 to 05:50: a gap in its line and its columns, never its last reading carried on
    {
      title: 'Chart · a sensor that went away',
      cards: [
        card({
          series: [{ entity: BEDROOM, name: 'Bedroom' }],
          span: '24h',
          chart: 'soft',
        }),
        card({
          series: [{ entity: DEHUMIDIFIER, name: 'Dehumidifier', kind: 'columns' }],
          span: '24h',
        }),
      ],
    },
  ],
};
