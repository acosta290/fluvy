import {
  icon,
  listRow,
  releaseStepRepeat,
  startStepRepeat,
  stopStepRepeat,
  type IconRef,
  type Tone,
} from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { actionGap } from '../cover/common.js';
import { SWITCH_SLOT } from '../energy/head.js';
import type { FluvySelect, SelectChangeDetail } from '@fluvy/ui/select';
import { dropdownEnd } from '../shared/dropdown.js';
import type { TextRuler } from '../shared/fit.js';
import {
  buttonWidth,
  rowButton,
  rowsKeepIcon,
  rowStacks,
  valueCap,
  type RowEnd,
} from '../shared/row-end.js';
import { STEPPER } from '../shared/value-row.js';

/*
 * What the details sheets share under their dial: the row of keys (a device's commands, its switch, the dial's
 * steps) and the rows under them (a choice among options, a switch, a tap, two steps).
 */

/** A key of the row under a sheet's dial: a command (open, next), a switch (power, mute), or a step of the dial. */
export interface Key {
  readonly key: string;
  readonly glyph: IconRef | string;
  readonly label: string;
  readonly disabled?: boolean;
  /** A switch as it stands; on, it wears its tone's fill. A command has none. */
  readonly on?: boolean;
  readonly tone?: Tone;
  /** A step of the dial, down or up: held, it repeats. */
  readonly step?: 1 | -1;
}

/** A step key as the page's one repeat reads it: Lit refreshes `fvStep` on every render. */
type StepKey = HTMLButtonElement & { fvStep?: (direction: 1 | -1) => void };

/** One handler a direction, for the whole page: a render never swaps them under a press. */
const STEP_DOWN = {
  [-1]: (event: PointerEvent): void => startStepRepeat(event, -1),
  [1]: (event: PointerEvent): void => startStepRepeat(event, 1),
};
/** The keyboard's Enter and Space arrive as a click with no pointer behind it. */
const stepByKey =
  (direction: 1 | -1) =>
  (event: MouseEvent): void => {
    if (event.detail === 0) (event.currentTarget as StepKey).fvStep?.(direction);
  };
const STEP_KEY = { [-1]: stepByKey(-1), [1]: stepByKey(1) };

/**
 * The keys under a sheet's dial: one row of equal cells that fill its column (the action row's: 44 tall, the gap that
 * lands them on the grid), each a glyph named for a reader; a sheet hands it no more keys than its column holds
 * (`actionsThatFit`). A switch says whether it is on (`aria-pressed`); a step repeats while it is held, as a
 * stepper's half does, and counts from what is on screen.
 */
export function keys(
  items: readonly Key[],
  width: number,
  onKey: (key: string) => void,
  onStep: (direction: 1 | -1) => void = () => undefined,
): TemplateResult | typeof nothing {
  if (!items.length) return nothing;
  return html`<div
    class="fv-actions dt-keys"
    data-fill-row
    style="gap:${actionGap(width, items.length).gap}px;grid-template-columns:repeat(${items.length}, minmax(0, 1fr))"
  >
    ${items.map((item) =>
      item.step
        ? html`<button
            class="fv-action"
            data-control
            data-target
            data-key=${item.key}
            aria-label=${item.label}
            title=${item.label}
            ?disabled=${item.disabled ?? false}
            .fvStep=${onStep}
            @pointerdown=${STEP_DOWN[item.step]}
            @pointerup=${releaseStepRepeat}
            @pointerleave=${stopStepRepeat}
            @pointercancel=${stopStepRepeat}
            @click=${STEP_KEY[item.step]}
          >
            ${icon(item.glyph)}
          </button>`
        : html`<button
            class="fv-action ${item.on ? `is-on fv-tone--${item.tone ?? 'accent'}` : ''}"
            data-control
            data-target
            data-key=${item.key}
            aria-label=${item.label}
            aria-pressed=${item.on === undefined ? nothing : String(item.on)}
            title=${item.label}
            ?disabled=${item.disabled ?? false}
            @click=${() => onKey(item.key)}
          >
            ${icon(item.glyph)}
          </button>`,
    )}
  </div>`;
}

/** A row under a sheet's keys: its circle, its name, and what ends it. */
interface RowBase {
  readonly icon: IconRef;
  readonly title: string;
  readonly disabled: boolean;
}

/** A row that chooses among a device's options (a preset, an effect, a source): its value opens the dropdown. */
export interface ChoiceRow extends RowBase {
  readonly kind: 'choice';
  /** The option chosen; none where the device says none ("—"). */
  readonly chosen: string | null | undefined;
  readonly options: readonly string[];
  /** An option in the house's words. */
  readonly word: (option: string) => string;
  readonly choose: (option: string) => void;
}

/** A row that switches something on the device (a fan's oscillation). */
export interface SwitchRow extends RowBase {
  readonly kind: 'switch';
  readonly on: boolean;
  readonly tone: Tone;
  readonly toggle: (next: boolean) => void;
}

/** A row whose tap moves the device to its other way (a fan's direction), said on its line. */
export interface TapRow extends RowBase {
  readonly kind: 'tap';
  readonly sub: string;
  readonly tap: () => void;
}

/** A row that ends in a control of the sheet's own (a tilt's two steps), `end` wide. */
export interface ControlRow extends RowBase {
  readonly kind: 'control';
  readonly control: TemplateResult;
  readonly end: number;
}

export type SheetRow = ChoiceRow | SwitchRow | TapRow | ControlRow;

/** The steps of a row that ends in a stepper: its width, as the rows weigh it. */
export const STEPS_END = STEPPER;

const chosenWord = (row: ChoiceRow): string => (row.chosen ? row.word(row.chosen) : '—');

/** What ends a row, as the rows' rule weighs it. */
const endOf = (row: SheetRow): RowEnd =>
  row.kind === 'choice'
    ? dropdownEnd(row.title, chosenWord(row))
    : row.kind === 'switch'
      ? { name: row.title, end: SWITCH_SLOT }
      : row.kind === 'tap'
        ? { name: row.title, sub: row.sub, end: 44 }
        : { name: row.title, end: row.end };

/** A row's circle and the gaps on either side of its words; the one gap of a row that gave its circle away. */
const ROW_SIDES = 68;
const BARE_SIDE = 12;

/**
 * Whether a row's name holds whole beside what ends it, with its circle or without (`bare`). The lists' rule keeps a
 * name 96; a sheet's rows are named by labels of its own ("Preset", "Sound mode"), which are never cut.
 */
function labelHolds(ruler: TextRuler, width: number, bare: boolean, row: SheetRow): boolean {
  const end = endOf(row);
  const pill =
    end.end ?? Math.min(buttonWidth(ruler, end.button ?? '', true), valueCap(width, bare));
  return width - (bare ? BARE_SIDE : ROW_SIDES) - pill >= ruler.width('fv-row__title', row.title);
}

/**
 * A row's value in the link-button shape, which opens Fluvy's dropdown on the options given (the select's own row
 * chooses a select's option, `shared/dropdown.ts`): fetched with the pages' controls the first time one opens.
 */
function menu(row: ChoiceRow, value: string, chevron: boolean): TemplateResult {
  const open = (event: Event): void => {
    const button = event.currentTarget as HTMLElement;
    void import('@fluvy/ui/select').then(() => {
      const list = button.nextElementSibling as FluvySelect | null;
      if (list) list.open = !list.open;
    });
  };
  return html`${rowButton('link', value, `${row.title} · ${value}`, open, row.disabled, true, true, chevron)}<fluvy-select
      anchored
      .label=${row.title}
      .value=${row.chosen ?? ''}
      .options=${row.options.map((option) => ({ value: option, label: row.word(option) }))}
      ?disabled=${row.disabled}
      @fluvy-change=${(event: CustomEvent<SelectChangeDetail>) => row.choose(event.detail.value)}
    ></fluvy-select>`;
}

/**
 * The rows under a sheet's keys, laid out by the lists' own rule: what ends a row is never cut, so in a column too
 * narrow for a name beside it the rows give their circles to their names, all of them together, and a value that
 * still would not hold goes under its name.
 */
export function sheetRows(
  ruler: TextRuler,
  width: number,
  rows: readonly SheetRow[],
): TemplateResult | typeof nothing {
  if (!rows.length) return nothing;
  const keep =
    rowsKeepIcon(ruler, width, rows.map(endOf)) &&
    rows.every((row) => labelHolds(ruler, width, false, row));
  return html`<div class="dt-rows">
    ${rows.map((row) => {
      const base = {
        icon: keep ? row.icon : null,
        title: row.title,
        unavailable: row.disabled,
      };
      if (row.kind === 'switch')
        return listRow({
          ...base,
          tone: row.disabled ? 'off' : row.on ? row.tone : 'neutral',
          trailing: 'switch',
          on: row.on,
          switchTone: row.tone,
          onToggle: row.toggle,
        });
      const tone: Tone = row.disabled ? 'off' : 'neutral';
      if (row.kind === 'tap')
        return listRow({
          ...base,
          tone,
          sub: row.sub,
          trailing: 'chevron',
          onTap: row.disabled ? undefined : row.tap,
        });
      if (row.kind === 'control') return listRow({ ...base, tone, trailing: row.control });
      const value = chosenWord(row);
      const stack = rowStacks(ruler, width, endOf(row)) || !labelHolds(ruler, width, true, row);
      return listRow({
        ...base,
        tone,
        stack,
        trailing: menu(row, value, !stack || buttonWidth(ruler, value, true) <= width),
      });
    })}
  </div>`;
}

/** A list an entity's attribute holds, its words alone (a `null` from an integration is no list). */
export const listAttr = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
