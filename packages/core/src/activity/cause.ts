import { domainOf } from '../entity.js';
import type { HomeAssistant } from '../ha/types.js';
import type { ActivityEvent } from './types.js';

/** Who or what made an entry happen, as the timeline says it ("by the automation Night", "by Marta"). */
export interface ActivityCause {
  readonly kind: 'person' | 'automation' | 'script' | 'service' | 'entity';
  readonly name: string;
  /** The automation, script or entity behind it (to open it). */
  readonly entityId?: string;
}

const friendly = (hass: HomeAssistant, id: string | undefined): string | undefined =>
  id ? (hass.states[id]?.attributes.friendly_name ?? undefined) : undefined;

/** People by their user id: the people of the house carry it (anyone may read them, not only an admin). */
export function peopleByUser(hass: HomeAssistant): Map<string, string> {
  const people = new Map<string, string>();
  for (const state of Object.values(hass.states)) {
    const user = state.attributes['user_id'];
    if (domainOf(state.entity_id) === 'person' && typeof user === 'string')
      people.set(user, state.attributes.friendly_name ?? state.entity_id);
  }
  return people;
}

export function causeOf(
  event: ActivityEvent,
  hass: HomeAssistant,
  people: ReadonlyMap<string, string>,
): ActivityCause | undefined {
  const context = event.context_entity_id;
  const contextDomain = event.context_domain ?? (context ? domainOf(context) : undefined);
  if (event.context_event_type === 'automation_triggered' || contextDomain === 'automation') {
    const name = event.context_name ?? friendly(hass, context);
    if (name) return { kind: 'automation', name, ...(context ? { entityId: context } : {}) };
  }
  if (event.context_event_type === 'script_started' || contextDomain === 'script') {
    const name = event.context_name ?? friendly(hass, context);
    if (name) return { kind: 'script', name, ...(context ? { entityId: context } : {}) };
  }
  const person = event.context_user_id ? people.get(event.context_user_id) : undefined;
  if (person) return { kind: 'person', name: person };
  if (context && context !== event.entity_id) {
    const name = event.context_name ?? friendly(hass, context);
    if (name) return { kind: 'entity', name, entityId: context };
  }
  if (event.context_event_type === 'call_service' && event.context_domain && event.context_service)
    return { kind: 'service', name: `${event.context_domain}.${event.context_service}` };
  return undefined;
}
