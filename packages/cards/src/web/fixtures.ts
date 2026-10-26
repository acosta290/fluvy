/**
 * What the web page card's tests frame: happy-dom loads no frame unless told to, and says so of every one as an
 * error on the console it was given at start (not the test's), so the tests let it load them and answer every
 * request themselves with a page of nothing — the frame's `load` is then real. `hang` holds every answer back: a
 * page that never loads.
 */

interface FrameSettings {
  enableIframePageLoading: boolean;
  fetch: { interceptor?: { beforeAsyncRequest: () => Promise<Response> } };
}

const PAGE = '<!doctype html><title>A page</title><p>A page of nothing.</p>';

/** Answers every frame's request with a page of nothing, or with nothing at all (`hang`), until told otherwise. */
export function serveFrames(): { hang: (held: boolean) => void } {
  const { happyDOM, Response } = window as unknown as {
    happyDOM: { settings: FrameSettings };
    Response: typeof globalThis.Response;
  };
  let held = false;
  happyDOM.settings.enableIframePageLoading = true;
  happyDOM.settings.fetch.interceptor = {
    beforeAsyncRequest: () =>
      held
        ? new Promise<Response>(() => undefined)
        : Promise.resolve(new Response(PAGE, { headers: { 'content-type': 'text/html' } })),
  };
  return {
    hang: (value) => {
      held = value;
    },
  };
}

/** Waits for a card's frame to have loaded (real timers: the page answers a few milliseconds after it is asked). */
export async function untilLoaded(card: { readonly loaded_: boolean }): Promise<void> {
  for (let waited = 0; !card.loaded_ && waited < 2000; waited += 5)
    await new Promise((resolve) => setTimeout(resolve, 5));
  if (!card.loaded_) throw new Error('the frame did not load');
}
