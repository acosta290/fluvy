/*
 * What a car is doing, whatever its integration calls it: the charging states of Tesla's three integrations, BMW's,
 * Renault's, Volvo's, Kia's and Hyundai's, Volkswagen's two, Škoda's, Polestar's and MG's, each folded into the few a
 * card draws; whether it drives, sleeps or is parked; what it runs on, when its tank, its AdBlue and its oil are low and
 * its service due; and the line under its battery (or its tank), by what matters most now. The words a card writes for
 * an entity stay Home Assistant's (its state as it translates it); these decide the tone, the badge and the line.
 * Nothing is guessed: a reading that cannot be read is null, and what is not there is undefined.
 */

/**
 * Where its charge is: charging, at its limit, plugged in but not charging (stopped, or waiting for its time),
 * unplugged, failed; or not charging with nothing said of its cable (`idle`: Volvo's and Polestar's "idle", Renault's
 * "not in charge", BMW's "no charging" — their plug sensors, where they have one, say the rest).
 */
export type Charge =
  'charging' | 'complete' | 'stopped' | 'waiting' | 'unplugged' | 'error' | 'idle';

/**
 * A charging state's words, as `wordOf` writes them, by what they mean: Tesla's six; Renault's plug and charge states;
 * Volvo's; Škoda's and MySkoda's; Polestar's; MG's ("Charging (AC)"); Volkswagen's two, in words and run together
 * ("readyForCharging"); and a word anyone writes. "Off", "unsupported" and the like say nothing: the cable and the
 * power then do.
 */
const CHARGES: ReadonlyArray<readonly [Charge, RegExp]> = [
  [
    'charging',
    /^(charging|chargingactive|charging_active|charging_(ac|dc)|super_offboard_charging|charge_in_progress|charging_in_progress|v2g_charging_normal|smart_charging|fast_charging|ac_charging|dc_charging)$/,
  ],
  [
    'complete',
    /^(complete|completed|charged|fully_charged|finished_fully_charged|target_reached|chargingended|done|charge_ended|charging_finished|charge_complete|conserving|conservation|charge_purpose_reached_and_(not_)?conservation(_charging)?|chargepurposereachedand(not)?conservation(charging)?)$/,
  ],
  [
    'stopped',
    /^(stopped|charging_stopped|chargingpaused|charging_paused|ready|ready_for_charging|readyforcharging|plugged_in|charging_interrupted|no_power|discharging|v2g_discharging|v2x_discharging|v2l_connected|paused|finished_not_full)$/,
  ],
  ['idle', /^(idle|not_charging|not_in_charge|nocharging|no_charging|off)$/],
  [
    'waiting',
    /^(starting|initialization|connecting|scheduled|scheduled_charging|waiting|waiting_for_charging|waiting_for_a_planned_charge|waiting_for_current_charge|v2g_charging_waiting|energy_flap_opened|smart_charging_paused)$/,
  ],
  ['unplugged', /^(disconnected|unplugged|connect_cable|not_connected)$/],
  [
    'error',
    /^(error|fault|charge_error|chargingerror|charging_error|fault_charging|unrecognized_connection|plug_error)$/,
  ],
];

/** A word as the tables read it: lower case, anything between its letters an underscore ("Charging (AC)" → `charging_ac`). */
export const wordOf = (state: string | undefined): string =>
  (state ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/** What a plug state's words say of the cable (Renault's, Volvo's, Polestar's, We Connect ID's): in, out, or not said. */
export function pluggedWord(state: string | undefined): boolean | null {
  const word = wordOf(state);
  if (/^(plugged|connected|plugged_waiting_for_charge|on)$/.test(word)) return true;
  if (/^(unplugged|disconnected|off)$/.test(word)) return false;
  return null;
}

/** What a charging sensor's state means; null for a word it does not know (the card then reads its other roles). */
export function chargeWord(state: string | undefined): Charge | null {
  const word = wordOf(state);
  if (!word) return null;
  for (const [charge, words] of CHARGES) if (words.test(word)) return charge;
  return null;
}

/** What a car says of its charge, each null where it cannot be read and undefined where it has no such entity. */
export interface ChargeSources {
  /** A charging state sensor's word, or a charging binary sensor's (`on` / `off`). */
  readonly state?: { readonly word: string; readonly binary: boolean } | null | undefined;
  /** Whether its cable is in (a plug binary sensor). */
  readonly plugged?: boolean | null | undefined;
  /** What it draws now, in W. */
  readonly watts?: number | null | undefined;
  readonly level?: number | null | undefined;
  readonly limit?: number | null | undefined;
}

/** Under this much a car draws nothing worth calling a charge (a charger's standby, a sensor's rounding). */
const CHARGING_FROM = 50;

/**
 * Where the car's charge is, from what it says: its charging state's word (a binary sensor's `on` charges), else its
 * power while its cable is in, else its cable alone; a car plugged in at its limit is complete. Null where it says
 * nothing at all.
 */
export function chargeOf(sources: ChargeSources): Charge | null {
  const { state, plugged, watts, level, limit } = sources;
  const atLimit = typeof level === 'number' && typeof limit === 'number' && level >= limit;
  let charge: Charge | null = null;
  if (state)
    charge = state.binary ? (state.word === 'on' ? 'charging' : null) : chargeWord(state.word);
  if (charge === null && typeof watts === 'number' && watts >= CHARGING_FROM && plugged !== false)
    charge = 'charging';
  if ((charge === null || charge === 'idle') && typeof plugged === 'boolean')
    charge = plugged ? (atLimit ? 'complete' : 'stopped') : 'unplugged';
  // a charge that says it stopped with the car at its limit stopped because it is full
  if (charge === 'stopped' && atLimit) return 'complete';
  // a state that knows nothing of the cable is told by the cable
  if (plugged === false && charge !== null && charge !== 'error') return 'unplugged';
  return charge;
}

/** Whether a charge has the cable in: charging, done, stopped, waiting or failed (idle says nothing of it). */
export const plugged = (charge: Charge | null): boolean =>
  charge !== null && charge !== 'unplugged' && charge !== 'idle';

/* ---------- what the car does ---------- */

/** What the car does: drives, sleeps, is parked, or cannot be reached at all. */
export type Activity = 'driving' | 'asleep' | 'parked' | 'offline';

/** A vehicle state's words that say it sleeps, or that the car cannot be reached. */
const ASLEEP = /^(asleep|sleep|sleeping|suspended|likely_asleep|power_saving_mode|deep_sleep)$/;
const OFFLINE = /^(offline|unavailable|unreachable|no_internet|not_connected)$/;
const DRIVING = /^(driving|moving|car_in_use|in_motion)$/;
/** A gear other than park: drive, reverse, neutral. */
const GEAR = /^(d|r|n|b|drive|reverse|neutral)$/;

/** What the car says of itself, each null where it cannot be read and undefined where it has no such entity. */
export interface ActivitySources {
  /** Its vehicle state's word (Tesla's online, asleep or offline; a "car is on" binary sensor's on/off). */
  readonly state?: string | null | undefined;
  /** Its gear: P, R, N or D. */
  readonly shift?: string | null | undefined;
  /** Its speed now, in its unit. */
  readonly speed?: number | null | undefined;
  /** A driving binary sensor (moving, ignition, engine on). */
  readonly moving?: boolean | null | undefined;
  /** Whether everything it says is out of reach (its battery, its state and its lock alike). */
  readonly reachless: boolean;
}

/**
 * What the car does: out of reach where nothing of it can be read or its state says so; driving in a gear other than
 * park, at a speed, or by its driving sensor; asleep where its state says so; parked otherwise.
 */
export function activityOf(sources: ActivitySources): Activity {
  const state = wordOf(sources.state ?? '');
  if (sources.reachless || OFFLINE.test(state)) return 'offline';
  const shift = wordOf(sources.shift ?? '');
  if (
    GEAR.test(shift) ||
    (typeof sources.speed === 'number' && sources.speed > 0) ||
    sources.moving === true ||
    DRIVING.test(state)
  )
    return 'driving';
  if (ASLEEP.test(state)) return 'asleep';
  return 'parked';
}

/* ---------- what it runs on ---------- */

/** What the card draws a car as: its battery, its tank, or both (a plug-in hybrid). */
export type Energy = 'electric' | 'fuel' | 'hybrid';

/**
 * What a car runs on: what the card's `energy` says, else (`auto`) its tank where it has one and no battery the card
 * reads, else its battery — as every car was drawn before the card knew a tank, a hybrid's battery among them.
 */
export function energyOf(
  asked: unknown,
  has: { readonly battery: boolean; readonly tank: boolean },
): Energy {
  if (asked === 'electric' || asked === 'fuel' || asked === 'hybrid') return asked;
  return has.tank && !has.battery ? 'fuel' : 'electric';
}

/* ---------- the battery's line ---------- */

/** Below this charge, with no `low_range` of its own, a car's range is low (the house's low battery). */
export const LOW_CHARGE = 20;

/** Whether the range is low: under the card's `low_range` in the range's unit, else the charge at 20 % or less. */
export function lowRange(
  range: number | null,
  level: number | null,
  threshold: number | undefined,
): boolean {
  if (typeof threshold === 'number' && Number.isFinite(threshold))
    return range !== null && range <= threshold;
  return level !== null && level <= LOW_CHARGE;
}

/** At this level or under, a tank, AdBlue or the oil is low (a car's reserve light), where nothing else says so. */
export const LOW_LEVEL = 15;
/** AdBlue lasting this far or less is low (the cars themselves warn from about 2,400 km). */
export const LOW_ADBLUE_KM = 1000;

/**
 * Whether a tank is low: its warning on; else under the card's `low_range` in the range's unit; else, where the car
 * has no warning to ask, at 15 % or less.
 */
export function lowTank(o: {
  readonly warning: boolean | null | undefined;
  readonly range: number | null;
  readonly level: number | null;
  readonly threshold: number | undefined;
}): boolean {
  if (o.warning === true) return true;
  if (typeof o.threshold === 'number' && Number.isFinite(o.threshold))
    return o.range !== null && o.range <= o.threshold;
  return typeof o.warning !== 'boolean' && o.level !== null && o.level <= LOW_LEVEL;
}

/**
 * What a car says of a fluid or of its service, as a card reads it: its warning (on, off), a level (%), a distance
 * (km), days; null where it cannot be read.
 */
export type Upkeep =
  | { readonly kind: 'warning'; readonly on: boolean }
  | { readonly kind: 'level'; readonly percent: number }
  | { readonly kind: 'distance'; readonly km: number }
  | { readonly kind: 'days'; readonly days: number }
  | null;

/** AdBlue that runs low: its warning, 15 % of its tank, 1,000 km. */
export function lowAdBlue(reading: Upkeep): boolean {
  if (!reading) return false;
  if (reading.kind === 'warning') return reading.on;
  if (reading.kind === 'level') return reading.percent <= LOW_LEVEL;
  return reading.kind === 'distance' && reading.km <= LOW_ADBLUE_KM;
}

/** Oil to check: its warning, or its level (or its life) at 15 % or under. */
export function oilToCheck(reading: Upkeep): boolean {
  if (!reading) return false;
  if (reading.kind === 'warning') return reading.on;
  return reading.kind === 'level' && reading.percent <= LOW_LEVEL;
}

/** A service that is due: its warning, or no distance or no day left before it (or past it). */
export function serviceDue(...readings: readonly Upkeep[]): boolean {
  return readings.some((reading) =>
    !reading
      ? false
      : reading.kind === 'warning'
        ? reading.on
        : reading.kind === 'distance'
          ? reading.km <= 0
          : reading.kind === 'days' && reading.days <= 0,
  );
}

/**
 * A service warning's words (Volvo's "regular maintenance time for service", "distance driven overdue for service"):
 * due when its time has come or gone, not when it is almost here; null for a word that says nothing of it.
 */
export function serviceWord(state: string | undefined): boolean | null {
  const word = wordOf(state);
  if (!word || word === 'unknown_warning') return null;
  if (/almost/.test(word) || /^(no_warning|ok|none)$/.test(word)) return false;
  return /(^|_)(time_for_service|overdue|due|service_required)(_|$)/.test(word) ? true : null;
}

/** Whether the cabin is cold or hot enough to say so (while the climate is off), by the house's unit. */
export type Cabin = 'cold' | 'hot' | null;

/** Cold at 5 °C and under (41 °F), hot at 35 °C and over (95 °F): weather to warm it, or cool it, before a drive. */
const CABIN = { c: [5, 35], f: [41, 95] } as const;

export function cabinOf(inside: number | null, unit: string): Cabin {
  if (inside === null) return null;
  const [cold, hot] = CABIN[/F$/.test(unit) ? 'f' : 'c'];
  return inside <= cold ? 'cold' : inside >= hot ? 'hot' : null;
}

/** What of the car can stand open: its windows, its doors, its boot, its front boot. */
export type Opening = 'windows' | 'doors' | 'trunk' | 'frunk';

/**
 * What the line under the battery (or the tank) says, the most pressing first: why charging failed; while it charges,
 * when it is done; a range that is low; a tank that is low, AdBlue that runs low, oil to check, a service that is due;
 * a tyre that is low; something left open; done at its limit; plugged in and waiting (for its time, or for nothing); a cabin too cold or
 * too hot to get into; else where its limit stands, or that it is unplugged.
 */
export type LineKind =
  | 'error'
  | 'charging'
  | 'low'
  | 'low_fuel'
  | 'adblue'
  | 'oil'
  | 'service'
  | 'tyre'
  | 'open'
  | 'complete'
  | 'waiting'
  | 'stopped'
  | 'cabin'
  | 'unplugged'
  | 'none';

export function lineOf(o: {
  readonly charge: Charge | null;
  readonly low: boolean;
  readonly open: Opening | null;
  readonly cabin: Cabin;
  /** A tyre is low: its integration's warning, or its pressure under the card's `tyre_low`. */
  readonly tyre?: boolean;
  /** A tank's: low, its AdBlue low, its oil to check, its service due. */
  readonly tank?: {
    readonly low: boolean;
    readonly adblue: boolean;
    readonly oil: boolean;
    readonly service: boolean;
  };
}): LineKind {
  if (o.charge === 'error') return 'error';
  if (o.charge === 'charging') return 'charging';
  if (o.low) return 'low';
  if (o.tank?.low) return 'low_fuel';
  if (o.tank?.adblue) return 'adblue';
  if (o.tank?.oil) return 'oil';
  if (o.tank?.service) return 'service';
  if (o.tyre) return 'tyre';
  if (o.open) return 'open';
  if (o.charge === 'complete') return 'complete';
  if (o.charge === 'waiting') return 'waiting';
  if (o.charge === 'stopped') return 'stopped';
  if (o.cabin) return 'cabin';
  return o.charge === 'unplugged' ? 'unplugged' : 'none';
}

/* ---------- units ---------- */

/** A distance's metres, by its unit; null for a unit that is not a distance. */
const METRES: Readonly<Record<string, number>> = { m: 1, km: 1000, mi: 1609.344, ft: 0.3048 };

/** Whether a unit is one of a distance the card converts. */
export const isDistance = (unit: string): boolean => Object.hasOwn(METRES, unit.trim());

/** A distance in another unit (km ↔ mi); the same where either unit is not one the card converts. */
export function convertDistance(value: number, from: string, to: string): number {
  const a = METRES[from.trim()];
  const b = METRES[to.trim()];
  return a && b ? (value * a) / b : value;
}

/** A pressure's pascals, by its unit: Home Assistant's own pressure units. */
const PASCALS: Readonly<Record<string, number>> = {
  Pa: 1,
  hPa: 100,
  kPa: 1000,
  mbar: 100,
  cbar: 1000,
  bar: 100_000,
  psi: 6894.757,
  inHg: 3386.389,
  mmHg: 133.322,
};

/** A pressure in another unit (bar ↔ psi ↔ kPa); the same where either unit is not one the card converts. */
export function convertPressure(value: number, from: string, to: string): number {
  const a = PASCALS[from.trim()];
  const b = PASCALS[to.trim()];
  return a && b ? (value * a) / b : value;
}
