import type { HomeAssistant } from '@fluvy/core';
import { RETRY_AFTER } from '../automations/store.js';
import { release, type Subscription } from '../shared/subscription.js';
import {
  checkWeek,
  helperDays,
  helperOf,
  sameWeek,
  weekOfResponse,
  type HelperItem,
  type Week,
} from './plan.js';

/**
 * The schedule helpers of the house as the Heating schedule card reads and writes them (#229), one store per
 * connection: several cards hear the same helpers. Home Assistant keeps a helper made in its interface in a storage
 * collection, which anyone may hear (`schedule/subscribe`: every helper at once, then each change, so an edit in Home
 * Assistant's own helper dialog reaches the card as it is saved); a schedule entity is tied to its helper by its
 * registry entry (`config/entity_registry/get`, anyone: its `unique_id` is the helper's id). A schedule kept in YAML
 * is no helper of the collection: its week is asked of the entity itself (`schedule.get_schedule`, anyone, once), and
 * it is never written. What an automation names (`search/related`, anyone) says a guest which helper a heating
 * automation follows. A failed question is asked again after a wait that grows (30 s, 2 min, 10 min).
 *
 * Writing is an administrator's alone, as Home Assistant has it, and narrow: `create` and `update` take a week that
 * holds (`checkWeek`), build the message from it (`helperDays`) and send it only where reading it back says the same
 * week; `remove` takes a helper's id. Before a write the card reads the helper again (`reread`, `schedule/list`), so a
 * change made in Home Assistant since its sheet opened is never written over.
 */

/** One question about one thing: its answer, whether it is on its way, and when a failed one may be asked again. */
interface Asked<T> {
  answer: T | undefined;
  /** Answered (or refused for good): nothing more to ask. */
  done: boolean;
  inflight: Promise<void> | undefined;
  failures: number;
  retryAt: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** What Home Assistant's frontend rejects a socket call with where it refused one (`{ code, message }`). */
const codeOf = (error: unknown): unknown => (isRecord(error) ? error['code'] : undefined);

/** One change of the helpers' collection, as `schedule/subscribe` sends it. */
interface Change {
  readonly change_type?: unknown;
  readonly schedule_id?: unknown;
  readonly item?: unknown;
}

const stores = new WeakMap<object, PlanStore>();

export class PlanStore {
  private hass: HomeAssistant;
  /** The helpers of the collection, by id, as last heard. */
  private readonly items = new Map<string, HelperItem>();
  /** The collection's first answer has landed (or it cannot be heard: no helper is then any entity's). */
  private listed = false;
  private unheard = false;
  /** Each schedule entity's helper id (its registry entry's `unique_id`); '' where it has none. */
  private readonly uniques = new Map<string, Asked<string>>();
  /** Each schedule entity's week, as `get_schedule` answered it. */
  private readonly answers = new Map<string, Asked<Week>>();
  /** Each automation entity's entities, as `search/related` answered it. */
  private readonly named = new Map<string, Asked<readonly string[]>>();
  private readonly listeners = new Set<() => void>();
  private subscription: Subscription | undefined;
  private pending = false;

  private constructor(hass: HomeAssistant) {
    this.hass = hass;
  }

  /** The store of that connection (one per house), reading the `hass` handed in from now on. */
  static for(hass: HomeAssistant): PlanStore {
    const key = (hass.connection as object | undefined) ?? hass;
    let store = stores.get(key);
    if (!store) {
      store = new PlanStore(hass);
      stores.set(key, store);
    }
    store.hass = hass;
    return store;
  }

  /** Whether this person may write helpers: Home Assistant's administrators, read live. */
  get admin(): boolean {
    return this.hass.user?.is_admin === true;
  }

  /** The helper behind a schedule entity, where it is one of the collection's (made in Home Assistant's interface). */
  helper(entity: string): HelperItem | undefined {
    const id = this.uniques.get(entity)?.answer;
    return id ? this.items.get(id) : undefined;
  }

  /** A schedule entity's week: its helper's, else what the entity answered; nothing before either. */
  week(entity: string): Week | undefined {
    return this.helper(entity)?.week ?? this.answers.get(entity)?.answer;
  }

  /** Whether everything worth asking about that entity's week has had its answer, or its failure. */
  settled(entity: string): boolean {
    if (this.week(entity)) return true;
    const unique = this.uniques.get(entity);
    if (!unique?.done && !unique?.failures) return false;
    if (!this.listed && !this.unheard) return false;
    const answer = this.answers.get(entity);
    return Boolean(answer?.done || answer?.failures);
  }

  /** The entities an automation names, as Home Assistant last answered; nothing before the first answer. */
  entitiesOf(automation: string): readonly string[] | undefined {
    return this.named.get(automation)?.answer;
  }

  /**
   * Asks what is worth asking about a schedule entity: its registry entry, once; then, where it is no helper of the
   * collection (a YAML schedule's, or the collection unheard), its week, once. Resolves once those in flight landed.
   */
  async load(entity: string): Promise<void> {
    const unique = this.ask(this.uniques, entity, async () => {
      const entry = await this.hass.callWS<Record<string, unknown>>({
        type: 'config/entity_registry/get',
        entity_id: entity,
      });
      return typeof entry['unique_id'] === 'string' ? entry['unique_id'] : '';
    });
    await unique;
    const id = this.uniques.get(entity)?.answer;
    if (!this.listed && !this.unheard) return; // the collection's first answer comes with a listener: asked then
    if (id && this.items.has(id)) return;
    await this.ask(this.answers, entity, async () => {
      const answer = await this.hass.callWS<unknown>({
        type: 'call_service',
        domain: 'schedule',
        service: 'get_schedule',
        target: { entity_id: entity },
        return_response: true,
      });
      return weekOfResponse(answer, entity);
    });
  }

  /** Asks Home Assistant which entities an automation names (`search/related`), once it is worth asking. */
  async loadNamed(automation: string): Promise<void> {
    await this.ask(this.named, automation, async () => {
      const answer = await this.hass.callWS<Record<string, unknown>>({
        type: 'search/related',
        item_type: 'automation',
        item_id: automation,
      });
      const entities = isRecord(answer) ? answer['entity'] : undefined;
      return Array.isArray(entities)
        ? entities.filter((each): each is string => typeof each === 'string')
        : [];
    });
  }

  /** One question, asked where it is worth asking: never answered, not in flight, not waiting out a failure. */
  private ask<T>(
    table: Map<string, Asked<T>>,
    key: string,
    question: () => Promise<T | undefined>,
  ): Promise<void> {
    let entry = table.get(key);
    if (!entry) {
      entry = { answer: undefined, done: false, inflight: undefined, failures: 0, retryAt: 0 };
      table.set(key, entry);
    }
    if (entry.inflight) return entry.inflight;
    if (entry.done || Date.now() < entry.retryAt) return Promise.resolve();
    const asked = entry;
    asked.inflight = question()
      .then(
        (answer) => {
          asked.answer = answer;
          asked.done = true;
          asked.failures = 0;
        },
        (error: unknown) => {
          // an entity the registry does not know, a service the house has not: nothing to ask again
          if (codeOf(error) === 'not_found' || codeOf(error) === 'service_validation_error') {
            asked.done = true;
            return;
          }
          asked.failures += 1;
          asked.retryAt =
            Date.now() + (RETRY_AFTER[Math.min(asked.failures, RETRY_AFTER.length) - 1] ?? 0);
        },
      )
      .finally(() => {
        asked.inflight = undefined;
        this.notify();
      });
    return asked.inflight;
  }

  /**
   * A helper as Home Assistant holds it this moment (`schedule/list`), whatever has been heard of it: what it is now,
   * kept, or nothing where it is gone. What a write checks first, so it never undoes a change it has not heard.
   */
  async reread(entity: string): Promise<HelperItem | undefined> {
    const id = this.uniques.get(entity)?.answer;
    if (!id) return undefined;
    const listed = await this.hass.callWS<unknown>({ type: 'schedule/list' });
    const item = helperOf(
      (Array.isArray(listed) ? listed : []).find((raw) => isRecord(raw) && raw['id'] === id),
    );
    if (item) this.items.set(id, item);
    else this.items.delete(id);
    this.notify();
    return item;
  }

  /* ---------- writing ---------- */

  private guard(week: Week): void {
    if (!this.admin) throw new Error('only an administrator may write helpers');
    if (checkWeek(week)) throw new Error('not a week Home Assistant takes');
  }

  /** Sends a helper's message where reading it back says the week asked, and keeps the helper Home Assistant answers. */
  private async send(
    message: { readonly type: string; readonly [key: string]: unknown },
    week: Week,
  ): Promise<HelperItem> {
    const read = helperOf({ id: 'check', name: 'check', ...message });
    if (!read || !sameWeek(read.week, week)) throw new Error('not the week asked');
    const item = helperOf(await this.hass.callWS<unknown>(message));
    if (!item) throw new Error('Home Assistant answered no helper');
    this.items.set(item.id, item);
    this.notify();
    return item;
  }

  /**
   * Makes a helper (`schedule/create`) and finds its entity: the one its id names where the registry says it is that
   * helper's, else the one the registry lists for it. Rejects with what Home Assistant said where it refused.
   */
  async create(
    name: string,
    icon: string,
    week: Week,
  ): Promise<{ readonly item: HelperItem; readonly entity: string }> {
    this.guard(week);
    const item = await this.send(
      { type: 'schedule/create', name, icon, ...helperDays(week) },
      week,
    );
    const unique = (entity: string): Promise<unknown> =>
      this.hass
        .callWS<Record<string, unknown>>({ type: 'config/entity_registry/get', entity_id: entity })
        .then((entry) => entry['unique_id'])
        .catch(() => undefined);
    let entity = `schedule.${item.id}`;
    if ((await unique(entity)) !== item.id) {
      const entries = await this.hass.callWS<unknown>({ type: 'config/entity_registry/list' });
      const found = (Array.isArray(entries) ? entries : []).find(
        (entry) =>
          isRecord(entry) && entry['platform'] === 'schedule' && entry['unique_id'] === item.id,
      ) as Record<string, unknown> | undefined;
      if (typeof found?.['entity_id'] !== 'string') throw new Error('the helper has no entity');
      entity = found['entity_id'];
    }
    this.uniques.set(entity, {
      answer: item.id,
      done: true,
      inflight: undefined,
      failures: 0,
      retryAt: 0,
    });
    this.notify();
    return { item, entity };
  }

  /** Writes a helper's week (`schedule/update`), its name and icon kept: Home Assistant replaces every day it is sent. */
  async update(item: HelperItem, week: Week): Promise<HelperItem> {
    this.guard(week);
    return this.send(
      {
        type: 'schedule/update',
        schedule_id: item.id,
        name: item.name,
        ...(item.icon ? { icon: item.icon } : {}),
        ...helperDays(week),
      },
      week,
    );
  }

  /** Deletes a helper (one just made, where what followed it failed). */
  async remove(id: string): Promise<void> {
    if (!this.admin) throw new Error('only an administrator may write helpers');
    await this.hass.callWS({ type: 'schedule/delete', schedule_id: id });
    this.items.delete(id);
    this.notify();
  }

  /* ---------- hearing ---------- */

  /**
   * Hears the store change (an answer, a helper saved anywhere), coalesced to one call per turn. The first listener
   * opens the collection's changes, the last one leaving closes them.
   */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    if (this.listeners.size === 1) this.listen();
    let listening = true;
    return () => {
      if (!listening) return;
      listening = false;
      this.listeners.delete(callback);
      if (this.listeners.size === 0 && this.subscription) {
        release(this.subscription);
        this.subscription = undefined;
      }
    };
  }

  /** A batch of the collection's changes: every helper added or updated kept, every one removed forgotten. */
  private heard(changes: unknown): void {
    for (const change of Array.isArray(changes) ? (changes as Change[]) : []) {
      if (!isRecord(change)) continue;
      const id = change.schedule_id;
      if (change.change_type === 'removed' && typeof id === 'string') {
        this.items.delete(id);
        continue;
      }
      const item = helperOf(change.item);
      if (item) this.items.set(item.id, item);
    }
    this.listed = true;
    this.notify();
  }

  private listen(): void {
    if (this.subscription) return;
    const subscription: Subscription = { cancelled: false };
    this.subscription = subscription;
    this.hass.connection
      .subscribeMessage(
        (changes: unknown) => {
          if (!subscription.cancelled) this.heard(changes);
        },
        { type: 'schedule/subscribe' },
      )
      .then((unsubscribe) => {
        subscription.unsubscribe = unsubscribe;
        if (subscription.cancelled) release(subscription); // the last listener left while the socket was answering
      })
      .catch(() => {
        // a house without the schedule integration: every week is asked of its entity
        this.unheard = true;
        this.notify();
      });
  }

  private notify(): void {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      for (const listener of this.listeners) listener();
    });
  }
}
