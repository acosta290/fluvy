import type {
  AreaRegistryEntry,
  EntityRegistryDisplayEntry,
  FloorRegistryEntry,
  HomeAssistant,
} from './ha/types.js';

/*
 * The house by its rooms: which area an entity is in, what an area holds, and the order floors and areas read
 * in. One rule for every reader (a card, the automatic dashboard): an entity is in its own area, else its
 * device's; a dashboard shows the entities that have a state, are not hidden and are not a config or diagnostic
 * entity unless asked for.
 */

/** The registries this module reads; `floors` is absent on a Home Assistant without them. */
export type Registries = Pick<HomeAssistant, 'states' | 'entities' | 'devices' | 'areas'> &
  Partial<Pick<HomeAssistant, 'floors'>>;

/** The area an entity is in: its own, else its device's. */
export function areaOf(hass: Registries | undefined, entityId: string): string | undefined {
  const entry = hass?.entities?.[entityId];
  const device = entry?.device_id ? hass?.devices?.[entry.device_id] : undefined;
  return entry?.area_id ?? device?.area_id ?? undefined;
}

export interface UsableOptions {
  /** Keep hidden entities. */
  readonly hidden?: boolean;
  /** Keep diagnostic entities (a config entity never shows). */
  readonly diagnostic?: boolean;
}

/** An entity a dashboard should show: with a state, not hidden, not a config or diagnostic entity unless asked for. */
export function usableEntity(
  hass: Registries | undefined,
  entityId: string,
  { hidden = false, diagnostic = false }: UsableOptions = {},
): boolean {
  if (!hass?.states[entityId]) return false;
  const entry: EntityRegistryDisplayEntry | undefined = hass.entities?.[entityId];
  if (entry?.hidden && !hidden) return false;
  if (entry?.entity_category === 'config') return false;
  if (entry?.entity_category === 'diagnostic' && !diagnostic) return false;
  return true;
}

interface Index {
  readonly devices: unknown;
  readonly areas: unknown;
  readonly byArea: ReadonlyMap<string, readonly string[]>;
}
/** One index per entity registry (the object Home Assistant hands over), rebuilt when the devices or areas are new objects. */
const indexes = new WeakMap<object, Index>();

/** Entity ids by area, in id order; built in one pass and kept while the registries are the same objects. */
export function areaIndex(hass: Registries): ReadonlyMap<string, readonly string[]> {
  const entities = hass.entities ?? {};
  const kept = indexes.get(entities);
  if (kept && kept.devices === hass.devices && kept.areas === hass.areas) return kept.byArea;
  const byArea = new Map<string, string[]>();
  for (const id of Object.keys(hass.states).sort()) {
    const area = areaOf(hass, id);
    if (!area) continue;
    const list = byArea.get(area);
    if (list) list.push(id);
    else byArea.set(area, [id]);
  }
  indexes.set(entities, { devices: hass.devices, areas: hass.areas, byArea });
  return byArea;
}

export interface AreaEntitiesOptions extends UsableOptions {
  /** Only these domains, in this order of preference (the ids stay in id order). */
  readonly domains?: readonly string[];
}

/** The entities of an area a dashboard shows, in id order. */
export function areaEntities(
  hass: Registries,
  areaId: string,
  options: AreaEntitiesOptions = {},
): string[] {
  const domains = options.domains;
  return (areaIndex(hass).get(areaId) ?? []).filter(
    (id) =>
      usableEntity(hass, id, options) &&
      (!domains || domains.includes(id.slice(0, id.indexOf('.')))),
  );
}

/** The controls a room offers first: its lights, then its switches, covers and fans. */
export const CONTROL_DOMAINS: readonly string[] = ['light', 'switch', 'cover', 'fan'];
const ON_STATES: Readonly<Record<string, string>> = {
  light: 'on',
  switch: 'on',
  fan: 'on',
  cover: 'open',
};

export interface AreaSummary {
  /** Entities the area shows. */
  readonly total: number;
  /** Controls that are on (a cover: open). */
  readonly on: number;
  /** The controls, lights first, then switches, covers and fans. */
  readonly controls: readonly string[];
}

/** What an area holds, counted once. */
export function areaSummary(hass: Registries, areaId: string): AreaSummary {
  const ids = areaEntities(hass, areaId);
  const controls = CONTROL_DOMAINS.flatMap((domain) =>
    ids.filter((id) => id.startsWith(`${domain}.`)),
  );
  const on = controls.filter((id) => {
    const domain = id.slice(0, id.indexOf('.'));
    return hass.states[id]?.state === ON_STATES[domain];
  }).length;
  return { total: ids.length, on, controls };
}

export interface AreaClimate {
  readonly temperature?: string;
  readonly humidity?: string;
}

/** The area's temperature and humidity: the ones the registry names, else the first sensor of that class in it. */
export function areaClimate(hass: Registries, areaId: string): AreaClimate {
  const area = hass.areas?.[areaId];
  const sensors = areaEntities(hass, areaId, { domains: ['sensor'] });
  const first = (deviceClass: string): string | undefined =>
    sensors.find((id) => hass.states[id]?.attributes['device_class'] === deviceClass);
  const named = (id: string | null | undefined): string | undefined =>
    id && hass.states[id] ? id : undefined;
  const temperature = named(area?.temperature_entity_id) ?? first('temperature');
  const humidity = named(area?.humidity_entity_id) ?? first('humidity');
  return {
    ...(temperature ? { temperature } : {}),
    ...(humidity ? { humidity } : {}),
  };
}

const byName = (a: { name: string }, b: { name: string }): number => a.name.localeCompare(b.name);

/** The floors by level (the ground first), the unnumbered ones after, each group by name. */
export function floorsInOrder(hass: Registries): FloorRegistryEntry[] {
  return Object.values(hass.floors ?? {}).sort((a, b) => {
    const la = typeof a.level === 'number' ? a.level : Number.POSITIVE_INFINITY;
    const lb = typeof b.level === 'number' ? b.level : Number.POSITIVE_INFINITY;
    return la - lb || byName(a, b);
  });
}

/** The areas floor by floor (in the floors' order), the ones on no floor last, each group by name. */
export function areasInOrder(hass: Registries): AreaRegistryEntry[] {
  const floors = floorsInOrder(hass).map((floor) => floor.floor_id);
  const rank = (area: AreaRegistryEntry): number => {
    const index = area.floor_id ? floors.indexOf(area.floor_id) : -1;
    return index === -1 ? floors.length : index;
  };
  return Object.values(hass.areas ?? {}).sort((a, b) => rank(a) - rank(b) || byName(a, b));
}
