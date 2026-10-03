import type { UnsubscribeFunc } from '@fluvy/core';

/** One `subscribeMessage` on the socket; `cancelled` when its owner left before Home Assistant answered. */
export interface Subscription {
  cancelled: boolean;
  unsubscribe?: UnsubscribeFunc;
}

/** Home Assistant's unsubscribe answers with a promise that rejects when the socket is already gone. */
export function release(subscription: Subscription): void {
  subscription.cancelled = true;
  try {
    void Promise.resolve(subscription.unsubscribe?.()).catch(() => undefined);
  } catch {
    /* nothing left to release */
  }
}
