import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Re-runs a card's text fitting when a web font may have changed its layout. A card measures laid-out
 * text (a greeting's size tier, a readout's label, a head's pills), so it measures again when a font
 * finishes loading — one frame later, because a face becomes usable for layout a frame after the event
 * says so — at `document.fonts.ready`, and once 1.2 s after the card connects as a safety net for a
 * face that loaded before the card listened. Create it once, in the card's constructor: it registers
 * itself with the card and lives as long as the card.
 */
export class FontsSettled implements ReactiveController {
  private timer = 0;
  private frame = 0;

  /** `onSettle` measures afresh; by default the card simply draws again (its fitting runs in its render). */
  constructor(
    host: ReactiveControllerHost,
    private readonly onSettle: () => void = () => host.requestUpdate(),
  ) {
    host.addController(this);
  }

  private readonly run = (): void => {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.onSettle());
  };

  hostConnected(): void {
    if (typeof document === 'undefined' || !document.fonts) return;
    document.fonts.addEventListener('loadingdone', this.run);
    void document.fonts.ready.then(this.run);
    this.timer = window.setTimeout(this.run, 1200);
  }

  hostDisconnected(): void {
    document.fonts?.removeEventListener('loadingdone', this.run);
    clearTimeout(this.timer);
    cancelAnimationFrame(this.frame);
  }
}
