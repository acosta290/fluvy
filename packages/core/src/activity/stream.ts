import type { HomeAssistant } from '../ha/types.js';
import { eventKey } from './group.js';
import type { ActivityEvent } from './types.js';

interface StreamMessage {
  readonly events: readonly ActivityEvent[];
  /** More history is on its way. */
  readonly partial?: boolean;
}

export interface ActivityWindow {
  readonly start: Date;
  readonly end: Date;
  /** Only these entities (undefined: all of them). */
  readonly entityIds?: readonly string[];
}

/**
 * Home Assistant's activity for a window, live until its end: history arrives in chunks, then each new entry as it
 * happens. `onChange` gets every entry newest first, and whether history is still loading. The connection coming
 * back resubscribes from scratch (a replay would start from a stale point). Returns the unsubscribe.
 */
export function subscribeActivity(
  hass: HomeAssistant,
  window: ActivityWindow,
  onChange: (events: readonly ActivityEvent[], loading: boolean) => void,
): () => void {
  let events: ActivityEvent[] = [];
  let seen = new Set<string>();
  let unsubscribe: Promise<() => void> | undefined;
  let stopped = false;

  const receive = (message: StreamMessage): void => {
    if (stopped) return;
    const fresh = message.events.filter((event) => {
      const key = eventKey(event);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (fresh.length) {
      const incoming = [...fresh].sort((a, b) => b.when - a.when);
      const oldestNew = incoming[incoming.length - 1]!.when;
      const newestOld = events[0]?.when ?? -Infinity;
      // live entries land on top; a history chunk behind what we have, or anywhere, is merged in order
      events =
        oldestNew >= newestOld
          ? [...incoming, ...events]
          : [...events, ...incoming].sort((a, b) => b.when - a.when);
    }
    onChange(events, message.partial === true);
  };

  const subscribe = (): void => {
    const request: { type: string; [key: string]: unknown } = {
      type: 'logbook/event_stream',
      start_time: window.start.toISOString(),
      end_time: window.end.toISOString(),
    };
    if (window.entityIds) {
      if (!window.entityIds.length) {
        onChange([], false);
        return;
      }
      request['entity_ids'] = [...window.entityIds];
    }
    unsubscribe = hass.connection
      .subscribeMessage<StreamMessage>(receive, request, { resubscribe: false })
      .then((off) => off as () => void)
      .catch(() => {
        if (!stopped) onChange(events, false);
        return () => undefined;
      });
  };

  const ready = (): void => {
    void unsubscribe?.then((off) => off());
    events = [];
    seen = new Set();
    onChange(events, true);
    subscribe();
  };

  onChange(events, true);
  subscribe();
  hass.connection.addEventListener?.('ready', ready);
  return () => {
    stopped = true;
    hass.connection.removeEventListener?.('ready', ready);
    void unsubscribe?.then((off) => off());
  };
}
