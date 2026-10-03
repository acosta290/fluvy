import type { HomeAssistant } from '@fluvy/core';

/** A canned answer to one WebSocket message type. */
export type Handler = (message: Record<string, unknown>) => unknown;

declare global {
  interface Window {
    /** Every message a frame's own house was asked, newest last: the suites read what the cards requested. */
    fluvyAsked?: Record<string, unknown>[];
  }
}

/**
 * Another house for one frame: its own answers (another Energy dashboard, statistics that cannot be read …) and its
 * own connection, which the cards key their caches on, kept stable across renders. Everything else is the sheet's.
 */
export function house(ws: Record<string, Handler>, options: { co2?: boolean } = {}) {
  const connection = { subscribeMessage: async () => () => undefined };
  let seen: HomeAssistant['entities'] | undefined;
  let entities: HomeAssistant['entities'] = {};
  return (hass: HomeAssistant): HomeAssistant => {
    if (seen !== hass.entities) {
      seen = hass.entities;
      entities =
        options.co2 === false
          ? Object.fromEntries(
              Object.entries(hass.entities).filter(([, e]) => e.platform !== 'co2signal'),
            )
          : hass.entities;
    }
    return {
      ...hass,
      entities,
      connection: connection as unknown as HomeAssistant['connection'],
      callWS: async <T>(message: { type: string; [key: string]: unknown }): Promise<T> => {
        (window.fluvyAsked ??= []).push(message);
        const handler = ws[message.type];
        if (!handler) return hass.callWS<T>(message);
        return handler(message) as T;
      },
    };
  };
}
