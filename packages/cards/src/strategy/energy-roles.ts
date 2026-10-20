import { readPrefs, type EnergyPrefs } from '../energy-model/prefs.js';
import { prefSources } from '../energy-model/sources.js';
import { says, type Rules } from '../shared/words.js';
import type { EnergyRoles } from './types.js';
import {
  BATTERY_POWER,
  CHARGER,
  GRID,
  GRID_EXPORT,
  HOME_POWER,
  SOLAR,
  TODAY,
  type HomeRegistry,
} from './home-registry.js';

/*
 * The house's energy readings by their role — solar, grid, battery, house, a car charger, today's production, the
 * energy dashboard's devices, water and gas — from the energy dashboard's own preferences first, then from the
 * registries' words: a reading's name says one role, the longest of words that overlap winning (`shared/words.ts`).
 */

type Role = 'solar' | 'export' | 'grid' | 'battery' | 'charger' | 'home';

/**
 * The roles a reading's name can say, the first listed winning where a name says two that stand apart: the sun,
 * what leaves the house, the grid, the battery, the car's charger, the house itself.
 */
const ROLE_WORDS: Rules<Role> = [
  ['solar', SOLAR],
  ['export', GRID_EXPORT],
  ['grid', GRID],
  ['battery', BATTERY_POWER],
  ['charger', CHARGER],
  ['home', HOME_POWER],
];

/** A grid meter named by its phase: `grid_power_l1`, "Phase A", `fase_2`, `faz 3`. */
const PHASE =
  /(^|[\s_.-])(l[1-3]|phase[\s_-]?[1-3abc]|fase[\s_-]?[1-3]|faz[\s_-]?[1-3])([\s_.-]|$)/i;

/** A source's power sensor from the energy preferences and whether it counts towards the house as negative. */
function preferredPower(
  home: HomeRegistry,
  prefs: EnergyPrefs | null,
  type: 'solar' | 'grid' | 'battery',
): { id: string; inverted: boolean } | undefined {
  for (const source of readPrefs(prefs).sources) {
    if (source.kind !== type || !source.measure) continue;
    const id = source.measure.power?.[0];
    if (id && home.hasState(id)) return { id, inverted: source.measure.invert ?? false };
  }
  return undefined;
}

export function findEnergyRoles(home: HomeRegistry, prefs: EnergyPrefs | null): EnergyRoles {
  const { powers, energies } = home;
  const house = readPrefs(prefs);
  // the energy dashboard's own power sensors first (they carry their sign); otherwise the readings by their words
  const solarPref = preferredPower(home, prefs, 'solar');
  const gridPref = preferredPower(home, prefs, 'grid');
  const batteryPref = preferredPower(home, prefs, 'battery');
  // each reading's one role by its words (a reading the preferences name may say any)
  const role = new Map(
    [...powers, ...energies].map((id) => [id, says(home.label(id), ROLE_WORDS)]),
  );
  const saying = (list: readonly string[], said: Role): string[] =>
    list.filter((id) => role.get(id) === said);
  const solarPower = solarPref?.id ?? saying(powers, 'solar')[0];
  // a meter named for what leaves the house is never the grid's own: it is the export beside an import
  const exporting = saying(powers, 'export').filter((id) => id !== solarPower);
  const gridMeters = saying(powers, 'grid').filter((id) => id !== solarPower);
  const phases = gridMeters.filter((id) => PHASE.test(home.label(id)));
  const gridPhases = !gridPref && phases.length >= 2 ? phases.slice(0, 3) : [];
  const gridPower = gridPref?.id ?? gridMeters.find((id) => !gridPhases.includes(id));
  const gridExport = !gridPref ? exporting[0] : undefined;
  const batteryPower =
    batteryPref?.id ??
    saying(powers, 'battery').find((id) => id !== solarPower && id !== gridPower);
  const charger = saying(powers, 'charger').find(
    (id) => ![solarPower, gridPower, batteryPower].includes(id),
  );
  const homePower = saying(powers, 'home').find(
    (id) => ![solarPower, gridPower, batteryPower].includes(id),
  );
  // the battery's charge: the energy dashboard's, else the battery-class sensor beside its power sensor
  const batteryLevel =
    house.sources.find((s) => s.kind === 'battery' && s.soc && home.hasState(s.soc))?.soc ??
    (batteryPower
      ? home.beside(batteryPower, 'battery').find((id) => home.hasState(id))
      : undefined);
  const solarToday =
    saying(energies, 'solar').find((id) => TODAY.test(home.label(id))) ??
    house.sources.find((s) => s.kind === 'solar')?.energyIn[0];
  const consumption = (prefs?.device_consumption ?? [])
    .map((d) => d.stat_consumption)
    .filter((id) => home.hasState(id));
  // each device's power: the power sensor beside its energy statistic (same device, or the same name stem);
  // without devices in the energy dashboard, the appliances' own plugs
  const powerBeside = (id: string): string | undefined =>
    home.readoutsOf(id).find((reading) => home.deviceClass(reading) === 'power');
  const consumptionPowers = (consumption.length ? consumption : home.appliances)
    .map(powerBeside)
    .filter((p): p is string => Boolean(p));
  // water and gas: the energy dashboard's meters, else every meter of that class the house has
  const volume = (deviceClass: string): string[] =>
    home
      .sensors(deviceClass, true)
      .filter((id) => home.state(id) !== undefined && home.stateClass(id) === 'total_increasing');
  const meters = [...house.water, ...house.gas].filter((id) => home.hasState(id));
  return {
    solarPower,
    gridPower,
    gridImport: gridExport ? gridPower : undefined,
    gridExport: gridExport && gridPower ? gridExport : undefined,
    gridPhases,
    batteryPower,
    batteryLevel,
    homePower,
    charger,
    gridInvert: gridPref?.inverted ?? false,
    batteryInvert: batteryPref?.inverted ?? false,
    gridSigned: gridPref !== undefined || gridPhases.length > 0,
    solarToday,
    consumption,
    consumptionPowers,
    // the cards read the energy dashboard themselves when it carries the grid's power (or the house has no grid to
    // find): a dashboard that measures only the sun would otherwise hide the grid the words found
    prefsPower:
      prefSources(prefs).some((source) => source.type === 'grid') ||
      (prefSources(prefs).length > 0 && !gridPower && !gridPhases.length),
    prefsMeters: house.sources.some((s) => s.energyIn.length > 0 || s.energyOut.length > 0),
    meters: meters.length ? meters : [...volume('water'), ...volume('gas')].slice(0, 4),
    any: Boolean(
      solarPower || gridPower || gridPhases.length || consumption.length || energies.length,
    ),
  };
}
