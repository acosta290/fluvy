import { readPrefs, type EnergyPrefs } from '../energy-model/prefs.js';
import { prefSources } from '../energy-model/sources.js';
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
 * registries' words.
 */

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
  const solarPower = solarPref?.id ?? home.pick(powers, SOLAR);
  // a meter named for what leaves the house is never the grid's own: it is the export beside an import
  const exporting = powers.filter(
    (id) => id !== solarPower && GRID_EXPORT.test(home.label(id)) && !SOLAR.test(home.label(id)),
  );
  const gridMeters = powers.filter(
    (id) => id !== solarPower && !exporting.includes(id) && GRID.test(home.label(id)),
  );
  const phases = gridMeters.filter((id) => PHASE.test(home.label(id)));
  const gridPhases = !gridPref && phases.length >= 2 ? phases.slice(0, 3) : [];
  const gridPower =
    gridPref?.id ??
    home.pick(
      gridMeters.filter((id) => !gridPhases.includes(id)),
      GRID,
    );
  const gridExport = !gridPref ? exporting[0] : undefined;
  const batteryPower =
    batteryPref?.id ??
    home.pick(
      powers.filter(
        (id) =>
          id !== solarPower &&
          id !== gridPower &&
          !gridPhases.includes(id) &&
          !exporting.includes(id),
      ),
      BATTERY_POWER,
    );
  const charger = home.pick(
    powers.filter((id) => ![solarPower, gridPower, batteryPower].includes(id)),
    CHARGER,
  );
  const homePower = home.pick(
    powers.filter(
      (id) =>
        ![solarPower, gridPower, batteryPower, charger, gridExport].includes(id) &&
        !gridPhases.includes(id),
    ),
    HOME_POWER,
  );
  // the battery's charge: the energy dashboard's, else the battery-class sensor beside its power sensor
  const batteryLevel =
    house.sources.find((s) => s.kind === 'battery' && s.soc && home.hasState(s.soc))?.soc ??
    (batteryPower
      ? home.beside(batteryPower, 'battery').find((id) => home.hasState(id))
      : undefined);
  const solarToday =
    home.pick(
      energies.filter((id) => SOLAR.test(home.label(id))),
      TODAY,
    ) ?? house.sources.find((s) => s.kind === 'solar')?.energyIn[0];
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
