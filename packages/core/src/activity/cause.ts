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

/** A person of the house as the activity names them: their name, their entity and the picture Home Assistant has. */
export interface ActivityPerson {
  readonly name: string;
  readonly entityId: string;
  /** Their `entity_picture`, as Home Assistant gives it ('' none). */
  readonly picture: string;
}

/**
 * An account Home Assistant keeps (`config/auth/list`, an administrator's to read): its name, and whether Home Assistant
 * made it for an integration (Home Assistant Cloud, the Supervisor) rather than a person signing in.
 */
export interface ActivityAccount {
  readonly name: string;
  readonly system: boolean;
}

/**
 * The user behind an entry (its `context_user_id`): a person of the house, an account no person stands for (someone's
 * sign-in, a tool's token), or one Home Assistant made for an integration.
 */
export interface ActivityWho {
  readonly kind: 'person' | 'account' | 'integration';
  readonly userId: string;
  readonly name: string;
  /** The person's entity (to open their details) and picture ('' none); an account has neither. */
  readonly entityId?: string;
  readonly picture: string;
  /** The one reading the page. */
  readonly you: boolean;
}

const friendly = (hass: HomeAssistant, id: string | undefined): string | undefined =>
  id ? (hass.states[id]?.attributes.friendly_name ?? undefined) : undefined;

/** People by their user id: the people of the house carry it (anyone may read them, not only an admin). */
export function peopleByUser(hass: HomeAssistant): Map<string, ActivityPerson> {
  const people = new Map<string, ActivityPerson>();
  for (const state of Object.values(hass.states)) {
    const user = state.attributes['user_id'];
    const picture = state.attributes['entity_picture'];
    if (domainOf(state.entity_id) === 'person' && typeof user === 'string')
      people.set(user, {
        name: state.attributes.friendly_name ?? state.entity_id,
        entityId: state.entity_id,
        picture: typeof picture === 'string' ? picture : '',
      });
  }
  return people;
}

/**
 * The accounts by their user id, for an administrator (Home Assistant names them to no one else): one with no name
 * is left out. Anyone else, and an answer that does not come, gets none.
 */
export async function accountsOf(hass: HomeAssistant): Promise<Map<string, ActivityAccount>> {
  const accounts = new Map<string, ActivityAccount>();
  if (!hass.user?.is_admin) return accounts;
  const users = await hass.callWS<unknown>({ type: 'config/auth/list' }).catch(() => undefined);
  for (const user of Array.isArray(users)
    ? (users as readonly Partial<Record<string, unknown>>[])
    : [])
    if (typeof user.id === 'string' && typeof user.name === 'string' && user.name.trim())
      accounts.set(user.id, { name: user.name, system: user.system_generated === true });
  return accounts;
}

export function causeOf(
  event: ActivityEvent,
  hass: HomeAssistant,
  people: ReadonlyMap<string, ActivityPerson>,
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
  if (person) return { kind: 'person', name: person.name };
  if (context && context !== event.entity_id) {
    const name = event.context_name ?? friendly(hass, context);
    if (name) return { kind: 'entity', name, entityId: context };
  }
  if (event.context_event_type === 'call_service' && event.context_domain && event.context_service)
    return { kind: 'service', name: `${event.context_domain}.${event.context_service}` };
  return undefined;
}

/**
 * Who did it, where Home Assistant knows: the person whose user started it — a run a person's tap fired carries their
 * user too (Home Assistant 2026.5 on) — else, for an administrator, the account's name; the one reading is always
 * themselves. Nobody is invented: a switch pressed by hand, a sensor, a schedule carry no user, and someone else's
 * account with no person behind it is nobody to anyone but an administrator.
 */
export function whoOf(
  event: ActivityEvent,
  hass: HomeAssistant,
  people: ReadonlyMap<string, ActivityPerson>,
  accounts: ReadonlyMap<string, ActivityAccount>,
): ActivityWho | undefined {
  const userId = event.context_user_id;
  if (!userId) return undefined;
  const you = hass.user?.id === userId;
  const person = people.get(userId);
  if (person)
    return {
      kind: 'person',
      userId,
      name: person.name,
      entityId: person.entityId,
      picture: person.picture,
      you,
    };
  const account = hass.user?.is_admin ? accounts.get(userId) : undefined;
  const name = account?.name ?? (you ? hass.user?.name : undefined);
  if (!name) return undefined;
  return { kind: account?.system ? 'integration' : 'account', userId, name, picture: '', you };
}
