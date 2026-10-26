import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * The chart engine for a core card (the sensor's chart, the gauges): its own chunk (`chart`), fetched once as the
 * bundle starts, with the families (`index.ts`), so it is in practice there before any recorder answers; its sheet
 * adopted into the card's shadow root as it lands, and the card drawn again then. A card renders its skeleton while
 * `engine` is undefined — the skeleton it shows while its history is asked for, so the two waits make one
 * transition and no flash. A card in a lazy chunk (energy, history) imports the engine statically instead and adds
 * `chartStyles` to its own.
 *
 *   private readonly charts = new ChartLoader(this, (engine) => (this.scrubber = new engine.ScrubController(this)));
 *   render() { const engine = this.charts.engine; if (!engine || series === undefined) return skeleton; … }
 *
 * `landed` runs once, as the engine lands for this card (at once when it is already there): what the card makes of
 * the engine's own parts (its scrub controller) is made then.
 */
export type ChartEngine = typeof import('../chart/engine/index.js');

type Host = ReactiveControllerHost & { readonly renderRoot: HTMLElement | DocumentFragment };

let arrived: ChartEngine | undefined;
let pending: Promise<ChartEngine> | undefined;

/** The engine, fetched the first time it is asked for (once for the page). */
export const loadChartEngine = (): Promise<ChartEngine> =>
  (pending ??= import('../chart/engine/index.js').then((engine) => (arrived = engine)));

export class ChartLoader implements ReactiveController {
  /** The engine once it has landed: a card drawn after another fetched it has it from its first render. */
  engine: ChartEngine | undefined = arrived;

  constructor(
    private readonly host: Host,
    private readonly landed?: (engine: ChartEngine) => void,
  ) {
    host.addController(this);
    if (this.engine) landed?.(this.engine);
  }

  hostConnected(): void {
    if (this.engine) {
      this.adopt();
      return;
    }
    void loadChartEngine().then((engine) => {
      if (this.engine) return;
      this.engine = engine;
      this.landed?.(engine);
      this.adopt();
      this.host.requestUpdate();
    });
  }

  /** The engine's sheet beside the card's own (once; a second connection finds it there). */
  private adopt(): void {
    if (this.engine && this.host.renderRoot instanceof ShadowRoot)
      this.engine.adopt(this.host.renderRoot);
  }
}
