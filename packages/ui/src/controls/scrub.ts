import { noChange, type ReactiveController, type ReactiveControllerHost } from 'lit';
import { Directive, directive, PartType, type ElementPart, type PartInfo } from 'lit/directive.js';
import { scrubFraction } from './pointer.js';

/**
 * Reading a chart by pointing at it: a mouse over it, or a finger held on it, reads the value under it; the reading
 * ends when the pointer leaves (a finger lifts; a mouse keeps hovering after a click). One owner for every chart that
 * scrubs (energy, sensor, production, the history page): the host keeps a controller, the chart element takes
 * `scrub(controller)`, and the render reads `controller.value`.
 *
 *   private readonly scrubber = new ScrubController(this);
 *   html`<div class="chart" ${scrub(this.scrubber)}>…${this.scrubber.value ?? 'now'}</div>`
 *
 * `value` is the pointer's place as a fraction of the element's width (0–1), or what `snap` makes of it (an hour's
 * index); null while nothing is scrubbed.
 */
export class ScrubController implements ReactiveController {
  value: number | null = null;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly snap?: (fraction: number) => number,
  ) {
    host.addController(this);
  }

  hostDisconnected(): void {
    this.value = null;
  }

  /** Puts the reading at a place of the chart (0–1), or lets it go with null. What a keyboard moves. */
  set(value: number | null): void {
    const next =
      value === null ? null : Math.min(1, Math.max(0, this.snap ? this.snap(value) : value));
    if (next === this.value) return;
    this.value = next;
    this.host.requestUpdate();
  }

  /**
   * The keys that read a chart without a pointer: ← → a step (Shift, five), Home and End its ends, Escape lets go.
   * Returns whether the key was taken, so a host can leave the rest alone.
   */
  readonly key = (event: KeyboardEvent, step = 0.02): boolean => {
    const from = this.value ?? 1;
    const far = event.shiftKey ? step * 5 : step;
    switch (event.key) {
      case 'ArrowLeft':
        this.set(from - far);
        break;
      case 'ArrowRight':
        this.set(from + far);
        break;
      case 'Home':
        this.set(0);
        break;
      case 'End':
        this.set(1);
        break;
      case 'Escape':
        if (this.value === null) return false;
        this.set(null);
        break;
      default:
        return false;
    }
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  readonly move = (event: PointerEvent): void => {
    const fraction = scrubFraction(event);
    if (fraction === null) return;
    const value = this.snap ? this.snap(fraction) : fraction;
    if (value === this.value) return;
    this.value = value;
    this.host.requestUpdate();
  };

  readonly end = (event: PointerEvent): void => {
    if (event.type === 'pointerup' && event.pointerType === 'mouse') return;
    if (this.value === null) return;
    this.value = null;
    this.host.requestUpdate();
  };
}

class ScrubDirective extends Directive {
  private element: Element | undefined;
  private controller: ScrubController | undefined;

  constructor(part: PartInfo) {
    super(part);
    if (part.type !== PartType.ELEMENT) throw new Error('scrub() belongs on an element');
  }

  /** Nothing to draw: the listeners are wired in `update`. */
  render(controller: ScrubController): typeof noChange {
    void controller;
    return noChange;
  }

  override update(part: ElementPart, [controller]: [ScrubController]): typeof noChange {
    this.controller = controller;
    if (this.element !== part.element) {
      this.element = part.element;
      const move = (event: Event): void => this.controller?.move(event as PointerEvent);
      const end = (event: Event): void => this.controller?.end(event as PointerEvent);
      for (const type of ['pointerdown', 'pointermove']) part.element.addEventListener(type, move);
      for (const type of ['pointerup', 'pointercancel', 'pointerleave'])
        part.element.addEventListener(type, end);
    }
    return noChange;
  }
}

/** Makes an element a chart's scrubbing surface for `controller` (see `ScrubController`). */
export const scrub = directive(ScrubDirective);
