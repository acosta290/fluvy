import { addGlyphs } from '@fluvy/ui';
import { LEVEL_GLYPHS, type LevelGlyphName } from '@fluvy/ui/glyph-sets/levels';
import type { EntityView } from '../entity.js';

/*
 * The levels in Fluvy's icons (1.23, #226), fetched as the house turns them on (fluvy's settings → Appearance › Cards):
 * the glyphs that say them join the set as the chunk lands, and `levelOf` picks one for what an entity reads — the one
 * glyph of its kind (`battery`, `signal`, `drop`) everywhere else, and wherever its state says no level.
 */
addGlyphs(LEVEL_GLYPHS);

/** A battery's charge in percent: empty to 10, low to 35, half to 70, full above. */
const charge = (level: number): LevelGlyphName =>
  level <= 10
    ? 'batteryEmpty'
    : level <= 35
      ? 'batteryLow'
      : level <= 70
        ? 'batteryHalf'
        : 'batteryFull';

const BARS: readonly LevelGlyphName[] = [
  'signalNone',
  'signalWeak',
  'signalFair',
  'signalGood',
  'signalStrong',
];

/**
 * A signal's bars, as a phone counts them: in dBm (a radio's strength: -55 and up the four, a bar less for each 11.25
 * under it), or in percent (a bar a quarter, any signal at all one); undefined in any other unit, which says no strength.
 */
function bars(level: number, unit: string): LevelGlyphName | undefined {
  if (unit === 'dBm') return BARS[Math.min(4, Math.max(0, Math.floor((level + 100) / 11.25)))];
  if (unit === '%') return BARS[level <= 0 ? 0 : Math.min(4, 1 + Math.floor(level / 25))];
  return undefined;
}

/**
 * The glyph that says what the entity reads: a battery sensor's charge, a battery that is low (a binary sensor on) or
 * charging, a signal's strength, a valve open or shut. Undefined for anything else, and for a reading that says
 * nothing (unknown, unavailable, a word): its kind's one glyph.
 */
export function levelOf(view: EntityView): LevelGlyphName | 'battery' | undefined {
  const { domain, deviceClass, number: level } = view;
  if (domain === 'valve')
    return ['open', 'opening'].includes(view.state)
      ? 'valveOpen'
      : ['closed', 'closing'].includes(view.state)
        ? 'valveShut'
        : undefined;
  if (domain === 'binary_sensor') {
    if (deviceClass === 'battery') return view.state === 'on' ? 'batteryLow' : undefined;
    if (deviceClass === 'battery_charging')
      return view.state === 'on' ? 'batteryCharging' : view.state === 'off' ? 'battery' : undefined;
    return undefined;
  }
  if (domain !== 'sensor' || level === null || level === undefined) return undefined;
  if (deviceClass === 'battery') return charge(level);
  if (deviceClass === 'signal_strength') return bars(level, view.unit);
  return undefined;
}
