/*
 * The screen stays on while the wall is awake: a screen wake lock, asked for while the page is visible and again
 * whenever it becomes visible (the browser drops it when the page hides). Only a secure page has the API; without
 * it, or when the browser refuses, nothing happens and the tablet's own screen timeout rules.
 */

interface WakeLockSentinel {
  release(): Promise<void>;
  readonly released: boolean;
}

interface WithWakeLock {
  readonly navigator: {
    readonly wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
  };
  readonly document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
}

/** Holds the screen awake until stopped; safe to call where there is no wake lock. */
export function keepAwake(win: WithWakeLock): () => void {
  const api = win.navigator.wakeLock;
  if (!api) return () => undefined;
  let sentinel: WakeLockSentinel | undefined;
  let stopped = false;
  const request = (): void => {
    if (stopped || win.document.visibilityState !== 'visible' || (sentinel && !sentinel.released))
      return;
    api
      .request('screen')
      .then((held) => {
        if (stopped) void held.release();
        else sentinel = held;
      })
      .catch(() => undefined);
  };
  const onVisible = (): void => request();
  win.document.addEventListener('visibilitychange', onVisible);
  request();
  return () => {
    stopped = true;
    win.document.removeEventListener('visibilitychange', onVisible);
    if (sentinel && !sentinel.released) void sentinel.release();
    sentinel = undefined;
  };
}
