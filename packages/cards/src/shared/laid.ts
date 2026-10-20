import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Draws the host again when the width it drew for is not the one it was laid out at. A sheet reads its content
 * width while it renders (the `clientWidth` of its `.fv-sheet`): before its first layout that is 0 and it draws for
 * the design's 360, and on a slow device nothing has laid it out by the time its fonts settle either — so its rows
 * kept their circles and ran past their row in a 266 column. The controller observes the element `find` gives once
 * it exists, and when the width the host reads differs from what its last render read, asks for another render.
 * Create it once, in the host's constructor: it registers itself with the host and lives as long as the host.
 */
export class LaidWidth implements ReactiveController {
  private observer: ResizeObserver | undefined;
  private observed: Element | undefined;
  private drawn: number | undefined;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly find: () => Element | null | undefined,
    private readonly read: () => number,
  ) {
    host.addController(this);
  }

  /** What this render reads. */
  hostUpdate(): void {
    this.drawn = this.read();
  }

  /** The element to watch, once drawn (and again when a render replaces it). */
  hostUpdated(): void {
    const element = this.find() ?? undefined;
    if (element === this.observed) return;
    this.observer?.disconnect();
    this.observed = element;
    if (!element || typeof ResizeObserver === 'undefined') return;
    this.observer ??= new ResizeObserver(() => this.check());
    this.observer.observe(element);
  }

  hostDisconnected(): void {
    this.observer?.disconnect();
    this.observed = undefined;
  }

  private check(): void {
    if (this.drawn !== undefined && this.read() !== this.drawn) this.host.requestUpdate();
  }
}
