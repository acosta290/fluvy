import { ON_DEMAND_PATHS, PARTS, type Outline } from './generated-on-demand.js';

export { keywordsOf } from './keywords.js';

/*
 * The set's glyphs beyond core's part, which no page needs until Home Assistant asks for one: this chunk holds the
 * glyphs of the set Fluvy's own chrome never names (a garage, a gate, a window, a door open), the index of the set's
 * other parts (the appliances, the levels, energy, devices, climate, safety, outdoors, home, rooms), each fetched the
 * first time one of its glyphs is asked for, and the words the icon picker finds each glyph by.
 */

/** The part that holds a name, by the names each holds. */
const partOf = (name: string): (typeof PARTS)[string] | undefined =>
  Object.values(PARTS).find(([held]) => held.split(' ').includes(name));

/** Every name the chunk and the parts it fetches hold. */
export const names = (): string[] => [
  ...Object.keys(ON_DEMAND_PATHS),
  ...Object.values(PARTS).flatMap(([held]) => held.split(' ')),
];

/** A glyph by its name, its part fetched the first time; undefined for a name no part holds. */
export async function outlineOf(name: string): Promise<Outline | undefined> {
  if (Object.hasOwn(ON_DEMAND_PATHS, name)) return ON_DEMAND_PATHS[name];
  const part = partOf(name);
  return part ? (await part[1]()).PATHS[name] : undefined;
}
