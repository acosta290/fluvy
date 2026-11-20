import {
  clock12,
  dayPeriods,
  formatNumber,
  haptic,
  localize,
  navigate,
  strings,
  type HomeAssistant,
} from '@fluvy/core';
import {
  baseStyles,
  fitPills,
  ico,
  label,
  optionGrid,
  round,
  sheetStyles,
  stepper,
  toggle,
  type ChipItem,
} from '@fluvy/ui';
import type { SelectChangeDetail, SelectOption } from '@fluvy/ui/select';
import '@fluvy/ui/select';
import '@fluvy/ui/time-field';
import type { TimeFieldDetail } from '@fluvy/ui/time-field';
import {
  LitElement,
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { apiMessage } from '../../automations/store.js';
import { field } from '../../helpers/context.js';
import { textField } from '../../helpers/text.js';
import { fittedColumns, type ChipFit } from '../../shared/chips.js';
import type { Weekday } from '../../shared/dates.js';
import { TextRuler } from '../../shared/fit.js';
import { FontsSettled } from '../../shared/fonts.js';
import { LaidWidth } from '../../shared/laid.js';
import { fitPair } from '../../shared/pair.js';
import { sheetDialog, sheetInsets } from '../../shared/sheet-insets.js';
import { presetName, type Preset } from '../automation.js';
import { blockWords, dayWord, hours, lineStyles, spanOf, track } from '../lines.js';
import { DAY_END, STEP, type Block, type DayProblem, type Week } from '../plan.js';
import { isStandard, standardWord, type PresetLook } from '../presets.js';
import {
  addBlock,
  addPreset,
  copyTo,
  draftOf,
  heatingDraft,
  missingStandard,
  offersOwn,
  ownMode,
  ownName,
  problemOf,
  removable,
  removeBlock,
  removePreset,
  renameOwn,
  setBlock,
  stepPreset,
  type Draft,
  type HeatingDraft,
  type Unit,
} from './draft.js';

export type { HeatingDraft } from './draft.js';

const s = strings('schedule');

/** What the sheet edits (or reads): the room's plan and what it may set the thermostat to. */
export interface HeatingRequest {
  /** The room the plan heats: the sheet's line under its title. */
  readonly room: string;
  readonly climate: string;
  /** The week as read; none for a new plan (the start week). */
  readonly week?: Week;
  /** The presets as read (none: the start presets) and the base, where the plan has one of Fluvy's. */
  readonly presets?: readonly Preset[];
  readonly base?: string;
  /**
   * Why the plan may only be read here: the person is no administrator (`guest`), the helper is kept in YAML (`yaml`),
   * its automation was edited in Home Assistant (`foreign`).
   */
  readonly readOnly?: 'guest' | 'yaml' | 'foreign';
  /** The automation's config id, for Home Assistant's editor (a `foreign` one). */
  readonly configId?: string;
  /** The day it opens on, and the week's days in the card's order. */
  readonly day: Weekday;
  readonly days: readonly Weekday[];
  readonly unit: Unit;
  /** The presets as the card draws them (their names, glyphs, tones). */
  readonly looks: (presets: readonly Pick<Preset, 'key' | 'name'>[]) => readonly PresetLook[];
  /**
   * Writes the plan; resolves `changed` where Home Assistant changed it since the sheet opened (nothing is written),
   * rejects with what Home Assistant said where it refused it.
   */
  save(draft: HeatingDraft): Promise<'changed' | undefined>;
  /** Opens the sheet again on the plan as Home Assistant holds it now, on the day shown. */
  reload(day: Weekday): void;
}

/** A press this soon after opening is the tail of the tap that opened the sheet, not a decision. */
const GUARD_MS = 350;
const LEAVE_MS = 200;

/**
 * What the dialog keeps to itself, sitting in a popup that closes on a window's Escape and slides closed from a touch
 * on itself: Escape closes the sheet alone, and a touch that starts in the sheet is the sheet's.
 */
const keepEscape = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') event.stopPropagation();
};
const keepTouch = { handleEvent: (event: Event): void => event.stopPropagation(), passive: true };

/**
 * The heating sheet (#229): a modal bottom sheet (as the schedule sheet is) that edits a room's week — a day chosen,
 * its line, its times as rows (a preset, from, until; added, removed; two that overlap refused in words), the day
 * copied to others; the presets with their temperatures, added and removed, the one of the gaps, the thermostat's own
 * where it has them — and saves it through the card (the helper and the automation), or reads it for someone who may
 * not change it, saying why. Cancel leaves both untouched. Fetched the first time a card opens it. `docked` draws it
 * in the flow (the playground).
 */
export class FluvyHeatingSheet extends LitElement {
  static override styles: CSSResultGroup = [
    ...baseStyles,
    sheetStyles.devices,
    sheetStyles.inputs,
    sheetDialog,
    lineStyles,
    css`
      :host(:not([docked])) {
        display: contents;
      }
      .fv-sheet__head {
        height: auto;
        min-height: 44px;
      }
      /* a title of words takes a second line in a narrow sheet; a word wider than its line steps it down to 16 */
      .hs-title--s {
        font-size: 16px;
        line-height: 20px;
      }
      .hs-section {
        margin-top: 24px;
      }
      /* a section's label takes the lines its words need (a narrow sheet's German), never laid over what follows */
      .hs-section > .fv-label {
        height: auto;
        margin: 0 0 8px;
      }
      .hs-days {
        display: grid;
        gap: 4px;
      }
      .hs-line {
        margin-top: 16px;
      }
      /* a time: its preset and its remove round on one line, from and until under them */
      .hs-blocks {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
        margin-top: 16px;
      }
      .hs-block {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 8px;
        padding: 12px;
        border-radius: 16px;
        background: var(--fluvy-inset, var(--fluvy-page));
      }
      .hs-block__head,
      .hs-block__times {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .hs-block__head fluvy-select {
        flex: 1 1 auto;
        min-width: 0;
      }
      /* from and until on the 4 grid, as wide as each other, the dash between them */
      .hs-block__times {
        justify-content: space-between;
      }
      .hs-block__times fluvy-time-field {
        flex: 0 0 var(--hs-time);
      }
      /* a column too narrow for from and until side by side: the preset over them, the remove round beside until */
      .hs-block--stack {
        grid-template-columns: minmax(0, 1fr) 44px;
        column-gap: 8px;
      }
      .hs-block--stack .hs-block__preset {
        grid-column: 1 / -1;
      }
      .hs-block--stack fluvy-time-field {
        grid-column: 1;
      }
      .hs-block--stack .fv-round {
        grid-column: 2;
        grid-row: 3;
      }
      .hs-dash {
        flex: 0 0 auto;
        color: var(--fluvy-text-secondary);
      }
      .hs-swatch {
        flex: 0 0 auto;
        width: 12px;
        height: 12px;
        margin-left: 4px;
        border-radius: 4px;
        background: var(--tone-fill);
        box-shadow: inset 0 0 0 1px var(--tone-border);
      }
      /* a read-only time: its preset's swatch, its name and its times */
      .hs-read {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 44px;
        font-size: 15px;
        font-weight: 500;
        line-height: 20px;
      }
      .hs-read__name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hs-read__time {
        margin-left: auto;
        color: var(--fluvy-text-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      /* a button the width of the sheet: its words take a second line rather than leave it */
      .hs-wide {
        width: 100%;
        height: auto;
        min-height: 48px;
        margin-top: 8px;
        padding-block: 12px;
        line-height: 20px;
        text-align: center;
        white-space: normal;
      }
      .hs-note,
      .hs-error {
        margin: 8px 0 0;
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
      }
      .hs-note {
        color: var(--fluvy-text-secondary);
      }
      .hs-error {
        color: var(--fluvy-danger);
      }
      /* a preset: its circle, its name and its temperature, its remove round, its stepper */
      .hs-preset {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 60px;
      }
      .hs-preset .in-field {
        flex: 1 1 auto;
        min-width: 0;
        height: auto;
        margin-top: 0;
      }
      /* a column too narrow for a preset's words beside its stepper: the stepper on a line of its own under them */
      .hs-step {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-bottom: 8px;
      }
      /* a field whose title would not hold beside its control puts the control on a line of its own */
      .hs-field--stack .in-field {
        flex-wrap: wrap;
        height: auto;
        row-gap: 8px;
      }
      .hs-field--stack .in-field__text {
        flex: 1 0 100%;
      }
      .hs-field--stack .fv-row__title,
      .hs-field--wrap .fv-row__title {
        white-space: normal;
      }
      .hs-field--wrap .in-field {
        height: auto;
        min-height: 44px;
        gap: 12px;
      }
      .hs-field--stack .in-field > :not(.in-field__text) {
        margin-left: auto;
      }
      .hs-name {
        margin: 0 0 8px 56px;
      }
      .hs-base fluvy-select {
        width: 144px;
      }
      .ss-footer {
        margin-top: 24px;
      }
      .dv-actions {
        grid-template-columns: repeat(2, minmax(0, var(--ss-pair, 172px)));
      }
      .dv-actions--stacked {
        grid-template-columns: minmax(0, var(--ss-pair, 172px));
      }
      .dv-actions--one {
        grid-template-columns: minmax(0, var(--ss-pair, 172px));
      }
      .dv-actions .fv-btn {
        width: 100%;
        min-width: 0;
        padding-inline: 8px;
        white-space: nowrap;
      }
      .is-busy .hs-body {
        opacity: 0.4;
        pointer-events: none;
      }
    `,
    sheetInsets,
  ];

  static override properties = {
    hass: { attribute: false },
    docked: { type: Boolean, reflect: true },
    request_: { state: true },
    draft_: { state: true },
    busy_: { state: true },
    error_: { state: true },
    changed_: { state: true },
    copied_: { state: true },
    leaving_: { state: true },
    editing_: { state: true },
  };

  declare hass?: HomeAssistant;
  /** Draws the sheet in the flow instead of in a modal dialog (the playground). */
  declare docked: boolean;
  declare request_: HeatingRequest | null;
  declare draft_: Draft | null;
  declare busy_: boolean;
  declare error_: string;
  /** Home Assistant changed the plan since the sheet opened: Save would undo that, the sheet offers to read it again. */
  declare changed_: boolean;
  /** What the last copy said ("Copied to Tue–Fri"), until the next gesture. */
  declare copied_: string;
  declare leaving_: boolean;
  /** The name field of a preset of the person's own that has the focus (its key). */
  declare editing_: string;

  private readonly ruler = new TextRuler(() => this.renderRoot as ParentNode | undefined);
  private openedBy: HTMLElement | undefined;
  /** A preset of the person's own just added, whose name's field takes the focus once it is drawn. */
  private naming = '';
  private openedAt = 0;
  private leaveTimer = 0;

  constructor() {
    super();
    this.docked = false;
    this.request_ = null;
    this.draft_ = null;
    this.busy_ = false;
    this.error_ = '';
    this.changed_ = false;
    this.copied_ = '';
    this.leaving_ = false;
    this.editing_ = '';
    new FontsSettled(this, () => {
      this.ruler.clear();
      fitPills(this.renderRoot, true);
      this.requestUpdate();
    });
    // drawn for the design's 360 before it is laid out: drawn again for the width it was given
    new LaidWidth(
      this,
      () => this.renderRoot.querySelector('.fv-sheet'),
      () => this.fit.width,
    );
  }

  get isOpen(): boolean {
    return this.request_ !== null && !this.leaving_;
  }

  /** Opens the sheet on a plan (or none, for a new one); `openedBy` gets the focus back. */
  open(request: HeatingRequest, openedBy?: HTMLElement): void {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = 0;
    this.openedBy = openedBy;
    this.request_ = request;
    this.draft_ = draftOf(
      request,
      request.unit,
      (key) => standardWord(this.hass, key),
      request.readOnly === undefined,
    );
    this.busy_ = false;
    this.error_ = '';
    this.changed_ = false;
    this.copied_ = '';
    this.leaving_ = false;
    this.editing_ = '';
    this.openedAt = performance.now();
  }

  /** Leaves; safe to call at any time. Nothing the sheet changed is kept. */
  close(): void {
    if (!this.request_ || this.leaving_) return;
    if (this.docked) {
      this.busy_ = false;
      this.error_ = '';
      this.changed_ = false;
      return;
    }
    this.leaving_ = true;
    this.leaveTimer = window.setTimeout(() => this.finishClose(), LEAVE_MS);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.finishClose();
  }

  private finishClose(): void {
    clearTimeout(this.leaveTimer);
    this.leaveTimer = 0;
    const wasOpen = this.request_ !== null;
    const opener = this.openedBy;
    this.openedBy = undefined;
    this.leaving_ = false;
    this.busy_ = false;
    this.request_ = null;
    this.draft_ = null;
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog?.open) dialog.close();
    if (wasOpen && opener?.isConnected) opener.focus();
  }

  protected override updated(changed: PropertyValues): void {
    const dialog = this.renderRoot.querySelector('dialog');
    if (dialog && !dialog.open && this.request_ && !this.leaving_) dialog.showModal();
    if (changed.has('request_') && this.request_ && !this.docked)
      requestAnimationFrame(() =>
        this.renderRoot.querySelector<HTMLElement>('.hs-days .is-active')?.focus(),
      );
    if (this.naming) {
      this.renderRoot
        .querySelector<HTMLInputElement>(`[data-field="name-${this.naming}"]`)
        ?.focus();
      this.naming = '';
    }
    fitPair(this.renderRoot.querySelector<HTMLElement>('.dv-actions'));
    fitPills(this.renderRoot);
  }

  /** The sheet's content width (its 16 sides off), the design's 360 before it is laid out. */
  private get fit(): ChipFit {
    const sheet = this.renderRoot.querySelector<HTMLElement>('.fv-sheet');
    const laid = sheet?.clientWidth ?? 0;
    return { ruler: this.ruler, width: laid > 0 ? laid - 32 : 360 };
  }

  /* ---------- the draft ---------- */

  private get editable(): boolean {
    return this.request_ !== null && this.request_.readOnly === undefined;
  }

  private patch(next: Draft | undefined): void {
    if (!next) return;
    this.draft_ = next;
    this.error_ = '';
    this.copied_ = '';
  }

  private dayWord(day: Weekday, style: 'short' | 'long'): string {
    return dayWord(this.hass, day, style);
  }

  /** The days the copy went to, as people say them: one by one, or a run of three or more with a dash. */
  private daysText(days: readonly Weekday[], order: readonly Weekday[]): string {
    const picked = order.filter((day) => days.includes(day));
    const parts: string[] = [];
    for (let i = 0; i < picked.length;) {
      let j = i;
      while (
        j + 1 < picked.length &&
        order.indexOf(picked[j + 1] as Weekday) === order.indexOf(picked[j] as Weekday) + 1
      )
        j++;
      const first = this.dayWord(picked[i] as Weekday, 'short');
      if (j - i >= 2) parts.push(`${first}–${this.dayWord(picked[j] as Weekday, 'short')}`);
      else for (let k = i; k <= j; k++) parts.push(this.dayWord(picked[k] as Weekday, 'short'));
      i = j + 1;
    }
    return parts.join(', ');
  }

  private problemText(problem: DayProblem): string {
    const hass = this.hass;
    return problem.kind === 'overlap'
      ? s(hass, 'overlap', {
          first: spanOf(hass, problem.first),
          second: spanOf(hass, problem.second),
        })
      : s(hass, 'order', { time: spanOf(hass, problem.block) });
  }

  private async save(): Promise<void> {
    const request = this.request_;
    const draft = this.draft_;
    const out = request && draft ? heatingDraft(draft, request.unit) : undefined;
    if (!request || !out || this.busy_ || this.leaving_ || !this.editable) return;
    if (performance.now() - this.openedAt < GUARD_MS) return;
    this.busy_ = true;
    this.error_ = '';
    let saved: 'changed' | undefined;
    try {
      saved = await request.save(out);
    } catch (error) {
      if (this.request_ !== request) return; // closed while Home Assistant was answering
      this.busy_ = false;
      this.error_ = haSaid(error) || s(this.hass, 'failed');
      haptic(this, 'failure');
      return;
    }
    if (this.request_ !== request) return;
    this.busy_ = false;
    if (saved === 'changed') {
      this.changed_ = true;
      haptic(this, 'warning');
      return;
    }
    haptic(this, 'success');
    this.close();
  }

  private onDialogClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return; // only the scrim closes
    if (performance.now() - this.openedAt >= GUARD_MS) this.close();
  }

  /* ---------- render ---------- */

  private section(word: string, body: TemplateResult, className = ''): TemplateResult {
    return html`<section class="hs-section ${className}">${label(word)}${body}</section>`;
  }

  /**
   * The week's days as chips that fill a row (seven, or four and three where a column cannot hold seven short words),
   * each its short word and its long one for a reader: the one shown pressed (`chosen`), or several (the copy's).
   */
  private dayChips(
    days: readonly Weekday[],
    chosen: readonly Weekday[],
    onTap: (day: Weekday) => void,
    disabled: readonly Weekday[] = [],
  ): TemplateResult {
    const items: ChipItem[] = days.map((day) => ({ key: day, label: this.dayWord(day, 'short') }));
    const grid = optionGrid(days.length, fittedColumns(items, this.fit, [7, 4]));
    return html`<div
      class="fv-chips fv-chips--fill hs-days"
      role="group"
      style="grid-template-columns:repeat(${grid.tracks}, minmax(0, 1fr))"
    >
      ${days.map((day, index) => {
        const active = chosen.includes(day);
        return html`<button
          class="fv-chip ${active ? 'is-active' : ''}"
          data-target
          aria-pressed=${active ? 'true' : 'false'}
          aria-label=${this.dayWord(day, 'long')}
          ?disabled=${disabled.includes(day)}
          style=${grid.spans[index] === 1 ? nothing : `grid-column:span ${grid.spans[index]}`}
          @click=${() => onTap(day)}
        >
          <span class="fv-chip__pill" data-control>${this.dayWord(day, 'short')}</span>
        </button>`;
      })}
    </div>`;
  }

  /** The shown day's line, as the card draws it taller, and its hours. */
  private renderLine(draft: Draft, looks: Map<string, PresetLook>): TemplateResult {
    const width = this.fit.width;
    return html`<div class="hs-line">
      ${track({
        blocks: draft.week[draft.day],
        looks,
        base: looks.get(draft.base),
        width,
        tall: true,
        words: (block, room) =>
          blockWords(this.hass, block, room, (text) =>
            this.ruler.width('sc-time sc-time--tall', text),
          ),
        accent: () => undefined,
      })}
      ${hours(this.hass, width, 0)}
    </div>`;
  }

  /** A time of the shown day: its preset, its remove round, from and until. */
  private renderBlock(
    block: Block,
    index: number,
    options: readonly SelectOption[],
    draft: Draft,
  ): TemplateResult {
    const hass = this.hass;
    const set = (part: Partial<Block>): void => this.patch(setBlock(draft, index, part));
    const time = (which: 'from' | 'to', value: number): TemplateResult =>
      html`<fluvy-time-field
        .value=${value}
        .step=${STEP}
        .hour12=${clock12(hass)}
        .periods=${dayPeriods(hass)}
        ?end-of-day=${which === 'to'}
        .label=${s(hass, which)}
        .hoursLabel=${localize(hass, 'page.hours')}
        .minutesLabel=${localize(hass, 'page.minutes')}
        @fluvy-time=${(event: CustomEvent<TimeFieldDetail>) =>
          set({ [which]: Math.min(DAY_END, Math.max(0, event.detail.value)) })}
      ></fluvy-time-field>`;
    // the two fields (80 each, a 12-hour clock's 128), the dash and their gaps inside the time's 12 sides
    const box = clock12(hass) ? 128 : 80;
    const preset = html`<fluvy-select
      class="hs-block__preset"
      .label=${localize(hass, 'climate.preset')}
      .value=${block.preset ?? ''}
      .options=${options}
      @fluvy-change=${(event: CustomEvent<SelectChangeDetail>) => set({ preset: event.detail.value })}
    ></fluvy-select>`;
    const remove = round('trash', 'quiet', s(hass, 'remove'), () => {
      haptic(this, 'light');
      this.patch(removeBlock(draft, index));
    });
    // a column too narrow for from and until side by side: the preset on a line of its own, from and until under it,
    // the remove round beside until
    if (this.fit.width - 24 < 2 * box + 24)
      return html`<div class="hs-block hs-block--stack">
        ${preset}${time('from', block.from)}${time('to', block.to)}${remove}
      </div>`;
    // side by side, each field takes half of what the dash and its gaps leave, down to the 4 grid
    const half = Math.floor((this.fit.width - 24 - 24) / 2 / 4) * 4;
    return html`<div class="hs-block">
      <div class="hs-block__head">${preset}${remove}</div>
      <div class="hs-block__times" style="--hs-time:${half}px">
        ${time('from', block.from)}<span class="hs-dash" aria-hidden="true">–</span
        >${time('to', block.to)}
      </div>
    </div>`;
  }

  /** The shown day's times: editable rows, or what they are in words for someone who may only read them. */
  private renderTimes(draft: Draft, looks: Map<string, PresetLook>): TemplateResult {
    const hass = this.hass;
    const blocks = draft.week[draft.day];
    const base = looks.get(draft.base);
    if (!this.editable)
      return html`<div class="hs-blocks">
        ${
          blocks.length
            ? blocks.map((block) => {
                const look =
                  (block.preset !== undefined ? looks.get(block.preset) : undefined) ?? base;
                return html`<div class="hs-read">
                  <span
                    class="hs-swatch fv-tone--${look ? (look.color ? 'accent' : look.tone) : 'neutral'}"
                  ></span
                  ><span class="hs-read__name" data-name>${look?.name ?? block.preset ?? ''}</span
                  ><span class="hs-read__time">${spanOf(hass, block)}</span>
                </div>`;
              })
            : html`<p class="hs-note">${s(hass, 'no_times', { preset: base?.name ?? '' })}</p>`
        }
      </div>`;
    const options = draft.presets.map((preset) => ({
      value: preset.key,
      label: looks.get(preset.key)?.name ?? preset.name,
    }));
    const problem = problemOf(draft);
    const added = addBlock(draft);
    return html`<div class="hs-blocks">
        ${
          blocks.length
            ? blocks.map((block, index) => this.renderBlock(block, index, options, draft))
            : html`<p class="hs-note">${s(hass, 'no_times', { preset: base?.name ?? '' })}</p>`
        }
      </div>
      <button
        class="fv-btn fv-btn--quiet hs-wide"
        data-control
        data-target
        ?disabled=${!added}
        @click=${() => {
          haptic(this, 'selection');
          this.patch(added);
        }}
      >
        ${added ? s(hass, 'add') : s(hass, 'full')}
      </button>
      ${
        problem
          ? html`<p class="hs-error" role="alert">
              ${problem.day === draft.day ? '' : `${this.dayWord(problem.day, 'long')}: `}${this.problemText(problem.problem)}
            </p>`
          : nothing
      }`;
  }

  /** "Copy this day to": the other days as chips, chosen one by one, and Copy. */
  private renderCopy(request: HeatingRequest, draft: Draft): TemplateResult {
    const hass = this.hass;
    const toggleDay = (day: Weekday): void => {
      haptic(this, 'selection');
      const chosen = draft.copyTo.includes(day)
        ? draft.copyTo.filter((each) => each !== day)
        : [...draft.copyTo, day];
      this.draft_ = { ...draft, copyTo: chosen };
      this.copied_ = '';
    };
    const copy = (): void => {
      haptic(this, 'success');
      const said = s(hass, 'copied', { days: this.daysText(draft.copyTo, request.days) });
      this.patch(copyTo(draft));
      this.copied_ = said;
    };
    return this.section(
      s(hass, 'copy'),
      html`${this.dayChips(request.days, draft.copyTo, toggleDay, [draft.day])}
        <button
          class="fv-btn fv-btn--quiet hs-wide"
          data-control
          data-target
          ?disabled=${!draft.copyTo.length || checkDayOf(draft) !== undefined}
          @click=${copy}
        >
          ${s(hass, 'copy_button')}
        </button>
        ${this.copied_ ? html`<p class="hs-note" role="status">${this.copied_}</p>` : nothing}`,
      'hs-copy-section',
    );
  }

  /** The presets: each its circle, its name and its temperature (or the thermostat's own), its stepper. */
  private renderPresets(
    request: HeatingRequest,
    draft: Draft,
    looks: Map<string, PresetLook>,
  ): TemplateResult {
    const hass = this.hass;
    const unit = request.unit;
    const editable = this.editable;
    const digits = unit.step < 1 ? 1 : 0;
    const value = (temperature: number): string =>
      `${formatNumber(hass, temperature, { digits, minDigits: digits })} ${unit.unit}`;
    const width = this.fit.width;
    const rows = draft.presets.map((preset) => {
      const look = looks.get(preset.key);
      const own = ownMode(draft, preset.key, unit);
      const name = look?.name ?? preset.name;
      // read only, a figure the plan could not be read for (a guest's) is unknown, never made up
      const read = request.presets?.find((each) => each.key === preset.key);
      const said =
        own || read?.mode !== undefined
          ? s(hass, 'own_mode')
          : editable || read?.temperature !== undefined
            ? value(preset.temperature)
            : '—';
      const canGo = editable && removable(draft, preset.key);
      const steps = editable && !own;
      // the words' room beside the circle (44 and 12), the remove round and the stepper (96 and 12): where the name or
      // the figure would not hold it, the stepper takes a line of its own under them
      const remove = canGo ? 56 : 0;
      const needs = Math.max(
        this.ruler.width('fv-row__title', name),
        this.ruler.width('fv-row__sub', said),
      );
      // stacked, the remove round goes under the words with the stepper, the words keep the row beside the circle
      const alone = steps && needs > width - 56 - remove - 108;
      const room = alone ? width - 56 : width - 56 - remove - (steps ? 108 : 0);
      // the base says so after the figure where the line holds both, else the figure alone
      const full = preset.key === draft.base ? `${said} · ${s(hass, 'base')}` : said;
      const line = this.ruler.width('fv-row__sub', full) <= room ? full : said;
      const step = steps
        ? stepper((direction) => this.patch(stepPreset(draft, preset.key, direction, unit)), {
            decrease: localize(hass, 'common.decrease'),
            increase: localize(hass, 'common.increase'),
          })
        : nothing;
      const gone = canGo
        ? round('trash', 'quiet', s(hass, 'remove'), () =>
            this.patch(removePreset(draft, preset.key)),
          )
        : nothing;
      return html`<div class="hs-preset">
          ${ico(look?.icon ?? 'thermo', look ? (look.color ? 'accent' : look.tone) : 'neutral')}
          ${field(name, line, nothing, false)} ${alone ? nothing : html`${gone}${step}`}
        </div>
        ${alone ? html`<div class="hs-step">${gone}${step}</div>` : nothing}
        ${
          editable && !isStandard(preset.key)
            ? html`<div
                class="hs-name"
                @focusin=${() => {
                  this.editing_ = preset.key;
                }}
              >
                ${textField({
                  id: `name-${preset.key}`,
                  value: preset.name,
                  label: s(hass, 'name'),
                  maxLength: 40,
                  glyph: 'pencil',
                  editing: this.editing_ === preset.key,
                  commitOn: 'leave',
                  onCommit: (typed) => {
                    const renamed = renameOwn(draft, preset.key, typed);
                    if (renamed !== draft) this.patch(renamed);
                    // another preset's name (or one of Home Assistant's): said, and the name stays
                    else if (presetName(typed) && presetName(typed) !== preset.name)
                      this.error_ = s(hass, 'same_name');
                  },
                  onLeave: () => {
                    this.editing_ = '';
                  },
                })}
              </div>`
            : nothing
        }`;
    });
    if (!editable) return this.section(s(hass, 'presets'), html`${rows}`);
    const missing = missingStandard(draft);
    const offers: SelectOption[] = [
      ...missing.map((key) => ({ value: key, label: standardWord(hass, key) })),
      { value: '', label: s(hass, 'own_preset') },
    ];
    const add = (key: string): void => {
      haptic(this, 'selection');
      const name = key
        ? standardWord(hass, key as (typeof missing)[number])
        : ownName(draft, (count) => s(hass, 'new_preset', { count }));
      this.patch(addPreset(draft, key || name, name, unit));
      // one of the person's own: its name's field takes the focus, to be named at once
      if (!key) this.naming = name;
    };
    const baseOptions = draft.presets.map((preset) => ({
      value: preset.key,
      label: looks.get(preset.key)?.name ?? preset.name,
    }));
    return this.section(
      s(hass, 'presets'),
      html`${rows}
        <button
          class="fv-btn fv-btn--quiet hs-wide"
          data-control
          data-target
          @click=${(event: Event) => {
            const list = (event.currentTarget as HTMLElement).nextElementSibling as
              (HTMLElement & { open: boolean }) | null;
            if (list) list.open = !list.open;
          }}
        >
          ${s(hass, 'add_preset')}</button
        ><fluvy-select
          anchored
          .label=${s(hass, 'add_preset')}
          .value=${'-'}
          .options=${offers}
          @fluvy-change=${(event: CustomEvent<SelectChangeDetail>) => add(event.detail.value)}
        ></fluvy-select>
        <div class="hs-section hs-base ${this.fieldFit(s(hass, 'base'), 144)}">
          ${field(
            s(hass, 'base'),
            '',
            html`<fluvy-select
              .label=${s(hass, 'base')}
              .value=${draft.base}
              .options=${baseOptions}
              @fluvy-change=${(event: CustomEvent<SelectChangeDetail>) =>
                this.patch({ ...draft, base: event.detail.value })}
            ></fluvy-select>`,
            false,
          )}
        </div>
        ${
          offersOwn(draft, unit)
            ? html`<div class="hs-section ${this.fieldFit(s(hass, 'own_modes'), 56)}">
                ${field(
                  s(hass, 'own_modes'),
                  s(hass, 'own_modes_line'),
                  toggle(
                    draft.own,
                    'accent',
                    (next) => this.patch({ ...draft, own: next }),
                    s(hass, 'own_modes'),
                  ),
                  false,
                )}
              </div>`
            : nothing
        }`,
    );
  }

  /**
   * How a field's title stands beside a control of `control` px and the 12 between: on its line (''); in the lines its
   * words need where each of them holds the room (`hs-field--wrap`); else the control goes under it (`hs-field--stack`).
   */
  private fieldFit(title: string, control: number): string {
    const room = this.fit.width - control - 12;
    if (this.ruler.width('fv-row__title', title) <= room) return '';
    return title.split(' ').every((word) => this.ruler.width('fv-row__title', word) <= room)
      ? 'hs-field--wrap'
      : 'hs-field--stack';
  }

  /** Why the plan may only be read here, and for an automation edited by hand the way to it in Home Assistant. */
  private renderWhy(request: HeatingRequest): TemplateResult | typeof nothing {
    const hass = this.hass;
    const why = request.readOnly;
    if (!why) return nothing;
    const id = request.configId;
    return html`<p class="hs-note">${s(hass, why)}</p>
      ${
        why === 'foreign' && id
          ? html`<button
              class="fv-btn fv-btn--link hs-wide"
              data-control
              data-target
              @click=${() => {
                navigate(`/config/automation/edit/${id}`);
                this.close();
              }}
            >
              ${s(hass, 'open_in_ha')}
            </button>`
          : nothing
      }`;
  }

  private renderSheet(request: HeatingRequest, draft: Draft): TemplateResult {
    const hass = this.hass;
    const looks = new Map(request.looks(draft.presets).map((look) => [look.key, look]));
    const fresh = request.week === undefined;
    const whole = this.editable && heatingDraft(draft, request.unit) !== undefined;
    // a title wraps at its words; one with a word wider than its line beside the round steps down to 16, and where not
    // even that holds, its short form ("Verwarmingsschema" → "Schema" at 211)
    const room = this.fit.width - 44 - 12;
    const holds = (text: string, cls: string): boolean =>
      text.split(' ').every((word) => this.ruler.width(cls, word) <= room);
    const full = s(hass, fresh ? 'new' : 'card');
    const title = holds(full, 'fv-sheet__title hs-title--s')
      ? full
      : s(hass, fresh ? 'new_short' : 'short');
    const step = !holds(title, 'fv-sheet__title');
    return html`<div class="fv-sheet hs-sheet ${this.busy_ ? 'is-busy' : ''}" data-card>
      <div class="fv-sheet__grabber"><span></span></div>
      <div class="fv-sheet__head">
        <div class="fv-card__titles">
          <h2 class="fv-sheet__title ${step ? 'hs-title--s' : ''}" id="hs-title">${title}</h2>
          <p class="fv-card__sub" data-name>${request.room}</p>
        </div>
        ${round('close', 'quiet', localize(hass, 'keypad.close'), () => this.close())}
      </div>
      <div class="hs-body">
        ${this.renderWhy(request)}
        ${this.section(
          s(hass, 'day'),
          html`${this.dayChips(request.days, [draft.day], (day) => {
            haptic(this, 'selection');
            this.patch({ ...draft, day, copyTo: draft.copyTo.filter((each) => each !== day) });
          })}
          ${this.renderLine(draft, looks)}`,
        )}
        ${this.section(s(hass, 'times'), this.renderTimes(draft, looks))}
        ${this.editable ? this.renderCopy(request, draft) : nothing}
        ${this.renderPresets(request, draft, looks)}
      </div>
      <div class="ss-footer">
        ${
          this.editable
            ? html`<div class="dv-actions">
                <button
                  class="fv-btn fv-btn--quiet"
                  data-control
                  data-target
                  @click=${() => this.close()}
                >
                  ${localize(hass, 'keypad.cancel')}
                </button>
                ${
                  this.changed_
                    ? html`<button
                        class="fv-btn fv-btn--accent"
                        data-control
                        data-target
                        @click=${() => request.reload(draft.day)}
                      >
                        ${localize(hass, 'common.reload')}
                      </button>`
                    : html`<button
                        class="fv-btn fv-btn--accent"
                        data-control
                        data-target
                        ?disabled=${!whole || this.busy_}
                        @click=${() => void this.save()}
                      >
                        ${s(hass, 'save')}
                      </button>`
                }
              </div>`
            : html`<div class="dv-actions dv-actions--one">
                <button
                  class="fv-btn fv-btn--quiet"
                  data-control
                  data-target
                  @click=${() => this.close()}
                >
                  ${localize(hass, 'keypad.close')}
                </button>
              </div>`
        }
        ${
          this.changed_ || this.error_
            ? html`<p class="hs-error" role="alert">
                ${this.changed_ ? s(hass, 'changed') : this.error_}
              </p>`
            : nothing
        }
      </div>
    </div>`;
  }

  protected override render(): TemplateResult | typeof nothing {
    const request = this.request_;
    const draft = this.draft_;
    if (!request || !draft) return nothing;
    if (this.docked) return this.renderSheet(request, draft);
    return html`<dialog
      class=${this.leaving_ ? 'is-leaving' : ''}
      aria-labelledby="hs-title"
      @cancel=${(event: Event) => {
        event.preventDefault();
        this.close();
      }}
      @close=${() => this.finishClose()}
      @click=${(event: MouseEvent) => this.onDialogClick(event)}
      @keydown=${keepEscape}
      @touchstart=${keepTouch}
    >
      ${this.renderSheet(request, draft)}
    </dialog>`;
  }
}

/**
 * What Home Assistant said refusing a write, in its words: the config API's (`apiMessage`), or the socket's
 * `{ code, message }`; nothing for a refusal of Fluvy's own (an `Error`), which the sheet says in its words.
 */
const haSaid = (error: unknown): string => {
  if (error instanceof Error) return '';
  const message = (error as { message?: unknown } | null)?.message;
  return apiMessage(error) || (typeof message === 'string' ? message.trim() : '');
};

/** The shown day's own problem, which a copy would carry to the others. */
const checkDayOf = (draft: Draft): DayProblem | undefined => {
  const problem = problemOf(draft);
  return problem?.day === draft.day ? problem.problem : undefined;
};

if (!customElements.get('fluvy-heating-sheet'))
  customElements.define('fluvy-heating-sheet', FluvyHeatingSheet);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-heating-sheet': FluvyHeatingSheet;
  }
}
