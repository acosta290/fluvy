import type { HomeAssistant } from '../ha/types.js';
import type { RawHistory, RawState } from './types.js';

export interface HistoryRequest {
  readonly start: Date;
  readonly end: Date;
  readonly entityIds: readonly string[];
}

interface StreamMessage {
  readonly states: Record<string, readonly RawState[]>;
  readonly start_time?: number;
  readonly end_time?: number;
}

/** Domains whose history is only readable with its attributes (a climate's setpoints, a light's brightness). */
const NEEDS_ATTRIBUTES = new Set(['climate', 'humidifier', 'water_heater', 'thermostat']);

/** The states of one entity, oldest first, with a chunk that arrived out of order put back in order. */
function merge(
  kept: readonly RawState[] | undefined,
  incoming: readonly RawState[] | undefined,
): readonly RawState[] {
  if (!kept?.length) return incoming ?? [];
  if (!incoming?.length) return kept;
  const joined = [...kept, ...incoming];
  return (incoming[0] as RawState).lu < (kept[kept.length - 1] as RawState).lu
    ? joined.sort((a, b) => a.lu - b.lu)
    : joined;
}

/**
 * Home Assistant's history for a window, live until its end: the recorder's states arrive in chunks and every change
 * after them as it happens. `onChange` gets everything read so far and whether more is on its way. The connection
 * coming back reads the window again from scratch (a replay would start from a stale point). Returns the unsubscribe.
 */
export function subscribeHistory(
  hass: HomeAssistant,
  request: HistoryRequest,
  onChange: (states: RawHistory, loading: boolean) => void,
): () => void {
  let states: RawHistory = {};
  let unsubscribe: Promise<() => void> | undefined;
  let stopped = false;
  let first = true;

  const receive = (message: StreamMessage): void => {
    if (stopped) return;
    const incoming = message.states ?? {};
    const next: Record<string, readonly RawState[]> = { ...states };
    for (const entityId of Object.keys(incoming))
      next[entityId] = merge(states[entityId], incoming[entityId]);
    states = next;
    // the first message is the window Home Assistant kept; everything after it is a change as it happens
    first = false;
    onChange(states, first);
  };

  const subscribe = (): void => {
    if (!request.entityIds.length) {
      onChange({}, false);
      return;
    }
    unsubscribe = hass.connection
      .subscribeMessage<StreamMessage>(
        receive,
        {
          type: 'history/stream',
          entity_ids: [...request.entityIds],
          start_time: request.start.toISOString(),
          end_time: request.end.toISOString(),
          minimal_response: true,
          no_attributes: !request.entityIds.some((id) =>
            NEEDS_ATTRIBUTES.has(id.slice(0, Math.max(0, id.indexOf('.')))),
          ),
        },
        { resubscribe: false },
      )
      .then((off) => off as () => void)
      .catch(() => {
        if (!stopped) onChange(states, false);
        return () => undefined;
      });
  };

  const ready = (): void => {
    void unsubscribe?.then((off) => off());
    states = {};
    first = true;
    onChange(states, true);
    subscribe();
  };

  onChange(states, true);
  subscribe();
  hass.connection.addEventListener?.('ready', ready);
  return () => {
    stopped = true;
    hass.connection.removeEventListener?.('ready', ready);
    void unsubscribe?.then((off) => off());
  };
}
