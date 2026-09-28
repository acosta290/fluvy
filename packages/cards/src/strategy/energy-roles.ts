import type { EnergyPrefs, EnergyRoles } from './types.js';
import {
  BATTERY_POWER,
  GRID,
  HOME_POWER,
  SOLAR,
  TODAY,
  type HomeRegistry,
} from './home-registry.js';

/*
 * The house's energy readings by their role — solar, grid, battery, house, today's production, the energy
 * dashboard's devices — from the energy dashboard's own preferences first, then from the registries' words.
 */

/** A source's power sensor from the energy preferences and whether it counts towards the house as negative. */
function preferredPower(
  home: HomeRegistry,
  prefs: EnergyPrefs | null,
  type: 'solar' | 'grid' | 'battery',
): { id: string; inverted: boolean } | undefined {
  for (const source of prefs?.energy_sources ?? []) {
    if (source.type !== type) continue;
    const inverted = source.power_config?.stat_rate_inverted;
    if (inverted) {
      if (home.hasState(inverted)) return { id: inverted, inverted: true };
      continue;
    }
    const plain = source.power_config?.stat_rate ?? source.stat_rate;
    if (plain && home.hasState(plain)) return { id: plain, inverted: false };
  }
  return undefined;
}

export function findEnergyRoles(home: HomeRegistry, prefs: EnergyPrefs | null): EnergyRoles {
  const { powers, energies } = home;
  // the energy dashboard's own power sensors first (they carry their sign); otherwise the readings by their words
  const solarPref = preferredPower(home, prefs, 'solar');
  const gridPref = preferredPower(home, prefs, 'grid');
  const batteryPref = preferredPower(home, prefs, 'battery');
  const solarPower = solarPref?.id ?? home.pick(powers, SOLAR);
  const gridPower = gridPref?.id ?? home.pick(powers, GRID);
  const batteryPower =
    batteryPref?.id ??
    home.pick(
      powers.filter((id) => id !== solarPower && id !== gridPower),
      BATTERY_POWER,
    );
  const homePower = home.pick(
    powers.filter((id) => ![solarPower, gridPower, batteryPower].includes(id)),
    HOME_POWER,
  );
  const solarToday =
    home.pick(
      energies.filter((id) => SOLAR.test(home.label(id))),
      TODAY,
    ) ?? prefs?.energy_sources?.find((s) => s.type === 'solar')?.stat_energy_from;
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
  return {
    solarPower,
    gridPower,
    batteryPower,
    homePower,
    gridInvert: gridPref?.inverted ?? false,
    batteryInvert: batteryPref?.inverted ?? false,
    gridSigned: gridPref !== undefined,
    solarToday,
    consumption,
    consumptionPowers,
    any: Boolean(solarPower || gridPower || consumption.length || energies.length),
  };
}
