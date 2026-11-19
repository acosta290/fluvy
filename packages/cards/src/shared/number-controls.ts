import { formatNumber, isUsable, localize, type EntityView, type HomeAssistant } from '@fluvy/core';
import { stepper } from '@fluvy/ui';
import { css, html, nothing, type TemplateResult } from 'lit';
import type { ControlHost } from './base.js';
import type { TextRuler } from './fit.js';
import { numberModel, numberText, nudge, NUMBERS, send, type NumberModel } from './number.js';
import { BUTTON_SIDES, rowStacks } from './row-end.js';
import { STEPPER, STEPPER_HALVES } from './value-row.js';

/*
 * The controls that set a number in place (#218), a chunk of its own fetched by the first card that asks for one: a
 * row's value between − and + on the Entities card, its value as a button that opens a field on the decimal keypad,
 * the Helpers card's figure typed the same way, and their sheet, worn on the card that draws them.
 */

/** How a number's row ends where it is set in place. */
export type RowControl = 'stepper' | 'entry';

/**
 * A number's control at its row's end: how it is set, the number as it stands, the end's width, and the room its
 * figure has (between the stepper's halves, or the button's and the field's own).
 */
export interface NumberEnd {
  readonly control: RowControl;
  readonly m: NumberModel;
  readonly width: number;
  readonly room: number;
}

/**
 * Every figure the number can show, as its control is laid out for them (never for the one it shows now, so a step
 * moves nothing): its ends, and a figure now where an end is open (a counter that counts on).
 */
export const numberFigures = (hass: HomeAssistant | undefined, m: NumberModel): string[] =>
  [m.min, m.max, m.min === null || m.max === null ? m.value : null]
    .filter((value): value is number => value !== null)
    .map((value) => numberText(hass, m, value));

/** The widest of `figures` with its unit, in a class of the card's (`TextRuler`). */
const widestFigure = (
  ruler: TextRuler,
  cls: string,
  figures: readonly string[],
  unit: string,
): number => Math.max(0, ...figures.map((figure) => ruler.width(cls, figure, 'fv-unit', unit)));

/** The room a typed figure takes: the field's sides (16 each) and the gap to its unit, around the widest figure. */
const ENTRY_SIDES = 32 + 4;

/**
 * The width of a number's figure as a button and as its field (the wider of the two, on the 4 grid), so the one takes
 * the other's place without moving: `figure` the widest figure's width with its unit.
 */
const entryWidth = (figure: number): number =>
  Math.ceil((figure + Math.max(BUTTON_SIDES, ENTRY_SIDES)) / 4) * 4;

/** The figure between the stepper's halves, as the house's stepper draws it (`stepper({ value })`). */
const STEPPED = 'fv-stepper fv-stepper--value > fv-stepper__value';

/** The figure's room between the stepper's halves: its widest figure and 4 on either side, on the 4 grid. */
const steppedRoom = (figure: number): number => Math.ceil((figure + 8) / 4) * 4;

/**
 * A figure typed for the number: its words read — a comma or a point as the decimal mark, as a language's keypad gives
 * it, the last of them where both are typed (the other a thousands' mark) — held to the range and to the step's
 * grid; null where it is none of them.
 */
export function typedNumber(text: string, m: NumberModel): number | null {
  const words = text.replace(/[\s']/g, '');
  const mark = Math.max(words.lastIndexOf('.'), words.lastIndexOf(','));
  const value = Number(
    mark < 0 ? words : `${words.slice(0, mark).replace(/[.,]/g, '')}.${words.slice(mark + 1)}`,
  );
  if (!words || !Number.isFinite(value)) return null;
  if ((m.min !== null && value < m.min) || (m.max !== null && value > m.max)) return null;
  const steps = (value - (m.min ?? 0)) / m.step;
  return Math.abs(steps - Math.round(steps)) < 1e-6 ? Number(value.toFixed(m.digits)) : null;
}

/** A field left with Escape: the blur that follows must not commit it. */
const cancelled = new WeakSet<HTMLInputElement>();
/** A field already closed: it answers one leaving, never a second before it is gone. */
const closed = new WeakSet<HTMLInputElement>();

/** A number's figure as a button that opens its field, or the field while it is typed in. */
interface Figure {
  readonly host: ControlHost;
  readonly hass: HomeAssistant | undefined;
  readonly view: EntityView;
  readonly m: NumberModel;
  /** The number's name: what a reader hears for the field, and for the button with its figure. */
  readonly name: string;
  /** The button's and the field's width, so the one takes the other's place without moving. */
  readonly width: number;
  /** The button's own classes (the Helpers card's figure is a size larger). */
  readonly cls: string;
  readonly typing: boolean;
  readonly onOpen: () => void;
  /** The field is gone (its figure sent, refused or let go): the button stands again. */
  readonly onClose: () => void;
}

/** A figure in its words: its value, and its unit while it has one. */
const words = (hass: HomeAssistant | undefined, view: EntityView, m: NumberModel): TemplateResult =>
  html`<span>${numberText(hass, m)}</span
    >${view.unit && m.value !== null ? html`<span class="fv-unit">${view.unit}</span>` : nothing}`;

/** What a reader hears for a number's control: its name and its figure. */
const said = (o: Pick<Figure, 'hass' | 'view' | 'm' | 'name'>): string =>
  `${o.name} · ${numberText(o.hass, o.m)}${o.view.unit && o.m.value !== null ? ` ${o.view.unit}` : ''}`;

/**
 * The number's figure on the link-button shape, which opens the house's field in its place (`.fv-field`, 44) on the
 * decimal keypad, its unit beside it, opened on the figure on screen and chosen whole. Enter or leaving it sends a
 * figure held to the range and the step; one that is not is refused (the field says so in the warning's words while it
 * is typed, and is let go on leaving); Escape lets it go. Keys typed in it never leave the card (Home Assistant's
 * shortcuts on the window).
 */
function figure(o: Figure): TemplateResult {
  if (!o.typing)
    return html`<button
      class="fv-btn fv-btn--link nm-figure ${o.cls}"
      style="width:${o.width}px"
      data-target
      aria-label=${said(o)}
      ?disabled=${o.m.unusable}
      @click=${o.onOpen}
    >
      ${words(o.hass, o.view, o.m)}
    </button>`;
  const read = (input: HTMLInputElement): number | null => typedNumber(input.value, o.m);
  const close = (input: HTMLInputElement, commit: boolean): void => {
    const value = commit ? read(input) : null;
    if (value !== null && value !== o.m.value) send(o.host, o.view, value);
    o.onClose();
  };
  return html`<label class="fv-field nm-entry" style="width:${o.width}px" data-control>
    <input
      class="fv-field__input"
      type="text"
      inputmode="decimal"
      enterkeyhint="done"
      autocomplete="off"
      aria-label=${o.name}
      .value=${
        o.m.value === null
          ? ''
          : formatNumber(o.hass, o.m.value, {
              digits: o.m.digits,
              minDigits: o.m.digits,
              grouping: false,
            })
      }
      @input=${(event: Event) => {
        const input = event.currentTarget as HTMLInputElement;
        input.setCustomValidity(read(input) === null && input.value.trim() ? '—' : '');
      }}
      @keydown=${(event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.isComposing) return;
        const input = event.currentTarget as HTMLInputElement;
        if (event.key === 'Enter') {
          event.preventDefault();
          if (read(input) !== null) input.blur();
        } else if (event.key === 'Escape') {
          cancelled.add(input);
          input.blur();
        }
      }}
      @blur=${(event: FocusEvent) => {
        const input = event.currentTarget as HTMLInputElement;
        if (closed.has(input)) return;
        closed.add(input);
        close(input, !cancelled.delete(input));
      }}
    />${o.view.unit ? html`<span class="fv-unit">${o.view.unit}</span>` : nothing}
  </label>`;
}

/** A row of the Entities card as its numbers' controls are laid out for it. */
export interface NumberRow {
  readonly view: EntityView;
  /** Its own say (`number_control`), else the card's. */
  readonly asked: RowControl | 'value' | undefined;
  /** Its name, which keeps its room beside the control. */
  readonly name: string;
  /** The state on screen (the one asked for until the house answers). */
  readonly shown: string;
}

/**
 * The numbers' controls at their rows' ends, by the rows' places: each as its row asks, else the card — its value
 * between − and +, or a button that opens a field to type it (a counter is stepped, never typed). Each kind is laid out
 * at one width down the list, its widest figure's (every figure each can show, never the one it shows now), so a step
 * moves nothing and the controls stand in one column; and where one of them would leave its row's name under its room
 * even without the circle (`rowStacks`), none is drawn: every number says its value, as any row's.
 */
export function rowEnds(
  ruler: TextRuler,
  width: number,
  hass: HomeAssistant | undefined,
  rows: readonly NumberRow[],
): (NumberEnd | null)[] {
  const asked = rows.map(({ view, asked: own, shown }) => {
    const control =
      own === 'stepper' || (own === 'entry' && view.domain !== 'counter') ? own : null;
    if (!control || !NUMBERS.has(view.domain)) return null;
    const m = numberModel(view, shown, !isUsable(view));
    const figures = numberFigures(hass, m);
    return {
      control,
      m,
      room:
        control === 'stepper'
          ? steppedRoom(widestFigure(ruler, STEPPED, figures, view.unit))
          : entryWidth(widestFigure(ruler, 'fv-row__value', figures, view.unit)),
    };
  });
  const widest = (control: RowControl): number =>
    Math.max(0, ...asked.map((end) => (end?.control === control ? end.room : 0)));
  const ends = asked.map((end) => {
    if (!end) return null;
    const room = widest(end.control);
    return { ...end, room, width: end.control === 'stepper' ? STEPPER_HALVES + room : room };
  });
  const holds = ends.every(
    (end, i) => !end || !rowStacks(ruler, width, { name: rows[i]?.name ?? '', end: end.width }),
  );
  return holds ? ends : ends.map(() => null);
}

/** A row's number control as its card draws it (`rowEnds`). */
export interface RowEnd {
  readonly root: Node;
  readonly host: ControlHost;
  readonly hass: HomeAssistant | undefined;
  readonly view: EntityView;
  readonly name: string;
  readonly end: NumberEnd;
  readonly typing: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}

/**
 * A row's number control: the house's stepper with its figure between its halves (− 21.5 °C +), or the figure's
 * button, or its field.
 */
export function rowEnd(o: RowEnd): TemplateResult {
  wear(o.root);
  const { m, room } = o.end;
  if (o.end.control === 'entry') return figure({ ...o, m, width: room, cls: '' });
  const label = said({ ...o, m });
  return stepper((direction) => nudge(o.host, o.view, m, direction), {
    disabled: m.unusable,
    value: words(o.hass, o.view, m),
    width: room,
    decrease: `${label} · ${localize(o.hass, 'common.decrease')}`,
    increase: `${label} · ${localize(o.hass, 'common.increase')}`,
  });
}

/** The Helpers card's figure as its card draws it (`number_entry`). */
export interface TypedFigure extends Omit<Figure, 'width' | 'cls'> {
  readonly root: Node;
  readonly ruler: TextRuler;
  /** The card's content column: the button and the stepper beside it must hold in it. */
  readonly room: number;
}

/** The Helpers card's figure's button: what it is drawn and measured in, a size larger than a row's. */
const BIG = 'fv-btn nm-figure nm-figure--big';
/** Between the figure and its stepper (`.in-field__control`'s gap). */
const GAP = 12;

/**
 * The Helpers card's figure typed (`number_entry`): a button of its words at 20 beside the stepper, which opens the
 * field in its place, both as wide as its widest figure; none (its words stay) where the button would not hold beside
 * the stepper (half a section).
 */
export function typedFigure(o: TypedFigure): TemplateResult | null {
  const width = entryWidth(widestFigure(o.ruler, BIG, numberFigures(o.hass, o.m), o.view.unit));
  if (o.room < width + GAP + STEPPER) return null;
  wear(o.root);
  return figure({ ...o, width, cls: 'nm-figure--big' });
}

/** A figure's field just opened: the keypad comes up on the figure, chosen whole, to be typed over. */
export function focusEntry(root: ParentNode): void {
  const input = root.querySelector<HTMLInputElement>('.nm-entry > input');
  input?.focus();
  input?.select();
}

/** The controls' sheet: the figure's button and its field (the stepper's figure is the house's, `stepper({ value })`). */
const SHEET = css`
  /* the figure as a button (the link shape, 44 tall), as wide as its widest figure (inline), its words centred, so
     the field takes its place without moving anything */
  .nm-figure {
    flex: 0 0 auto;
    justify-content: center;
    align-items: baseline;
    height: 44px;
    padding-inline: 0;
    line-height: 44px;
    font-variant-numeric: tabular-nums;
  }

  /* the Helpers card's, beside its stepper: the figure at 20, a step under the card's own 24 */
  .nm-figure--big {
    font-size: 20px;
    letter-spacing: -0.01em;
  }

  /* the field in its place, as wide: the figure typed at the end, its unit after it */
  .nm-entry {
    flex: 0 0 auto;
    box-sizing: border-box;
    gap: 4px;
  }

  .nm-entry > .fv-field__input {
    text-align: end;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .nm-entry > .fv-unit {
    margin-left: 0;
  }
`;

/** The controls' sheet on the card's root, after its own, once. */
function wear(root: Node): void {
  const sheet = SHEET.styleSheet;
  if (root instanceof ShadowRoot && sheet && !root.adoptedStyleSheets.includes(sheet))
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}
