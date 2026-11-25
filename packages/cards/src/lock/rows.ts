import {
  formatTime,
  isActive,
  isUsable,
  relativeTime,
  SAFE_TOGGLE,
  stateText,
  strings,
  toggleEntity,
  valueParts,
  type ActionConfig,
  type EntityName,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
} from '@fluvy/core';
import { listRow, sheetStyles, wordsClass, type Tone } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { HeadFit } from '../energy/head.js';
import { Card, type RowsHost } from '../shared/base.js';
import { currentTone, iconOf, toneFor } from '../shared/domain.js';
import { statusToneOf, toneOf } from '../shared/colour.js';
import { type Secondary } from '../shared/config.js';
import {
  chosenLabel,
  dropdown,
  dropdownEnd,
  SELECTS,
  type SelectRowConfig,
} from '../shared/dropdown.js';
import { ageShort } from '../shared/duration.js';
import {
  buttonWidth,
  fitValue,
  rowEndStyles,
  rowsKeepIcon,
  rowStacks,
  type ValueFit,
} from '../shared/row-end.js';
import { secondaryText } from '../shared/secondary.js';
import { changedAt, sinceIds } from '../shared/since.js';
import { TemplateTexts } from '../shared/templates.js';

/** A row of a list of entities; a select's offers its options in its order and words (#96). */
export interface RowConfig extends SelectRowConfig {
  entity: string;
  name?: EntityName;
  icon?: string;
  /** What the row says under its name: area, last change, state, none, an attribute, or a template; the area, else the time. */
  secondary?: Secondary;
  /** Where its last change is read from (#67): a timestamp sensor, or `attribute:<name>` of its own; else Home Assistant's. */
  since?: string;
  /** What the row answers (its entity's details where none is said, never the card's); a double tap none (#179). */
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  tone?: Tone;
  color?: string;
}

export interface RowsCardConfig extends FluvyCardConfig {
  /** Entities shown as 60 px rows under the card's own control. */
  rows?: ReadonlyArray<string | RowConfig>;
  show_rows?: boolean;
}

const s = strings('lock');

/**
 * A row switch is only for what is harmless to flip by accident (`SAFE_TOGGLE`), and never a way in, under a lock, an
 * alarm, a camera or a lamp: a garage door, a gate, a valve.
 */
const WAYS_IN: ReadonlySet<string> = new Set(['cover', 'valve']);
/** Domains whose state is worth reading at the end of the row. */
const READ_OUT = new Set([
  'sensor',
  'binary_sensor',
  'lock',
  'cover',
  'valve',
  'person',
  'device_tracker',
  'sun',
  'input_select',
  'select',
  'number',
  'input_number',
  'counter',
  'timer',
]);

/** Within half a day a time of day cannot be misread; after that a bare "21:40" would lie about the day. */
const RECENT_MS = 12 * 3600_000;

/** When the entity last changed — as its `since` says where that reads (#67) — and whether that is recent. */
function lastChanged(
  hass: HomeAssistant | undefined,
  view: EntityView,
  since?: string,
): { date: Date; recent: boolean } | null {
  const date = changedAt(hass, view, since);
  if (!date || Number.isNaN(date.getTime())) return null;
  return { date, recent: Date.now() - date.getTime() < RECENT_MS };
}

/** A recent change reads as its time ("21:40"), an older one as its age ("2 days ago"). */
function changedTime(hass: HomeAssistant | undefined, view: EntityView, since?: string): string {
  const changed = lastChanged(hass, view, since);
  if (!changed) return '';
  return changed.recent ? formatTime(hass, changed.date) : relativeTime(hass, changed.date);
}

/** Head sub line of a lock or an alarm: "21:40 by Marta", else "Since 21:40", else the age of the state. */
export function changedLine(hass: HomeAssistant | undefined, view: EntityView): string {
  if (view.status !== 'ok') return stateText(hass, view);
  const changed = lastChanged(hass, view);
  if (!changed) return view.areaName;
  const time = changedTime(hass, view);
  const who = view.attr<string | null>('changed_by');
  if (who) return s(hass, 'by', { time, who });
  return changed.recent ? s(hass, 'since', { time }) : time;
}

/**
 * That line's shorter forms, longest first, for a head too narrow for it: the time alone ("32 days ago" — who did it
 * goes first), then its short form ("32 d ago"). Never a time cut.
 */
export function changedShort(hass: HomeAssistant | undefined, view: EntityView): string[] {
  const changed = lastChanged(hass, view);
  if (view.status !== 'ok' || !changed) return [];
  return [
    changedTime(hass, view),
    ...(changed.recent ? [] : [relativeTime(hass, changed.date, new Date(), true)]),
  ];
}

/** A row as the list plans it: what it shows, and the width of what ends it. */
interface RowPlan {
  readonly row: RowConfig;
  readonly view: EntityView;
  readonly usable: boolean;
  readonly trailing: 'switch' | 'value' | 'chevron' | 'menu';
  readonly value: string;
  readonly end: number;
  readonly title: string;
  readonly words: string;
  /** The line's shorter form (`secondaryText`'s), for a row too narrow for its words: a time's, a state's one word. */
  readonly short: string;
  readonly age: boolean;
}

/**
 * Cards that end in a list of entity rows (lock, alarm, camera): their rows (`RowList`), counted, watched and drawn
 * under the card's own control.
 */
export abstract class RowsCard<C extends RowsCardConfig = RowsCardConfig> extends Card<C> {
  /** The head's fitting and the rows' (what gives way, in its order), for the card and its rows alike. */
  protected readonly headFit = new HeadFit(this);
  /** A row's second line when it is a template: rendered by Home Assistant, live. */
  protected readonly texts = new TemplateTexts(this);
  private readonly rows = new RowList(this, this.controlHost, this.headFit, this.texts);

  protected override prepare(config: C): C {
    this.rows.set(config.rows);
    return config;
  }

  protected get rowCount(): number {
    return this.config?.show_rows === false ? 0 : this.rows.length;
  }

  /** The card's entity, its rows', and what the rows' last change is read from (`since`). */
  protected override watched(): readonly string[] {
    return [this.config?.entity ?? '', ...this.rows.ids];
  }

  /** The rows, as history where `events` asks (`RowList.render`); none while they are hidden. */
  protected renderRows(events = false): TemplateResult | typeof nothing {
    return this.config?.show_rows === false ? nothing : this.rows.render(events);
  }
}

/**
 * The card a list of rows stands under, as its rows read it besides its helpers (`RowsHost`): its `hass`, its root, and
 * the rows its config lists.
 */
interface RowsElement {
  readonly hass?: HomeAssistant | undefined;
  readonly renderRoot: Node;
  readonly config?: Readonly<Record<string, unknown>> | undefined;
}

/** What the rows wear beside a card's own sheets: the devices' rows, and a row's end (a dropdown's value). */
const ROW_SHEETS = [sheetStyles.devices, rowEndStyles];

/**
 * The rows' sheets into a card's shadow root, once, beside its own (a lock's are its own already): a card of one
 * device wears them only where it draws rows.
 */
function adopt(root: Node): void {
  if (!(root instanceof ShadowRoot)) return;
  ROW_SHEETS.forEach(({ styleSheet, cssText }, index) => {
    if (styleSheet) {
      if (!root.adoptedStyleSheets.includes(styleSheet))
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, styleSheet];
    } else if (!root.querySelector(`style[data-fluvy-rows="${index}"]`)) {
      // no constructible sheets: a style element ahead of what Lit renders, where its own fallback puts them
      const element = document.createElement('style');
      element.dataset['fluvyRows'] = String(index);
      element.textContent = cssText;
      root.prepend(element);
    }
  });
}

/**
 * A list of entity rows under a card's own control: a lock's, an alarm's and a camera's (`RowsCard`), and those a card
 * of one device lists under its body (#262: a light's, a fan's, `Card.extraRows`). One trailing element per row, chosen
 * by the entity: a switch for what is safe to toggle, the value for what is measured, a select's value that opens its
 * dropdown (#96), a chevron for the rest. It reads the card through `host`: the card's own helpers are protected.
 */
export class RowList {
  private rowList: readonly RowConfig[] = [];
  /** The list the rows were last read from: a config's own is read once. */
  private listed: unknown;

  constructor(
    private readonly card: RowsElement,
    private readonly host: RowsHost,
    /** The card's head's fitting: the rows' (what gives way, in its order) is the same, on the same ruler. */
    private readonly headFit: HeadFit,
    /** A row's second line when it is a template: rendered by Home Assistant, live. */
    private readonly texts: TemplateTexts,
  ) {}

  /** The rows a config lists: each an entity's id or a row naming one; what names none is left out. */
  set(listed: unknown): void {
    if (listed === this.listed) return;
    this.listed = listed;
    this.rowList = (
      Array.isArray(listed) ? (listed as ReadonlyArray<string | RowConfig | null>) : []
    )
      .map((row) => (typeof row === 'string' ? { entity: row } : row))
      .filter((row): row is RowConfig => typeof row?.entity === 'string' && row.entity !== '');
  }

  get length(): number {
    return this.rowList.length;
  }

  /** The rows' entities, and what their last change is read from (`since`). */
  get ids(): readonly string[] {
    return [...this.rowList.map((row) => row.entity), ...sinceIds(this.rowList)];
  }

  private get hass(): HomeAssistant | undefined {
    return this.card.hass;
  }

  private get contentWidth(): number {
    return this.host.width();
  }

  /**
   * `events` draws the rows as history (camera detections): a chevron, and a neutral circle unless the row names a tone
   * or a colour; the line says when it changed as the time of day, unless the row asks for another one.
   */
  render(events = false): TemplateResult | typeof nothing {
    if (!this.rowList.length) return nothing;
    adopt(this.card.renderRoot);
    const plans = this.rowList.map((row) => this.plan(row, events));
    // a column too narrow for a name beside what ends its row gives every row's circle to its words, as every list does
    const keep =
      this.headFit.rowsKeepIcon(
        this.contentWidth,
        plans.map((p) => ({ title: p.title, value: p.value, end: p.end })),
      ) &&
      // …and a dropdown's value holds within its cap beside its name (the rows' rule for a button)
      rowsKeepIcon(
        this.headFit.ruler,
        this.contentWidth,
        plans.flatMap((p) => (p.trailing === 'menu' ? [dropdownEnd(p.title, p.value)] : [])),
      );
    // a value in words that would leave the name under its floor even without the circle goes under the name
    // (`under`); the others stay beside it, as they always have
    const placed = plans.map((p) => (!keep && p.trailing === 'value' ? this.under(p) : null));
    const beside = plans.filter((_, i) => !placed[i]?.stack);
    // an age in its full words ("21 days ago") where every row's fits beside what ends it, else every age short
    // ("21 d"): one form a list, never cut
    const short = beside.some(
      (p) => p.age && this.headFit.ruler.width('fv-row__sub', p.words) > this.wordsRoom(p, keep),
    );
    // the longest word of a value in words beside its name, so a name's floor leaves it its line (devices.css)
    const word = Math.max(
      0,
      ...beside.flatMap((p) =>
        /\S\s+\S/.test(p.value)
          ? p.value.split(/\s+/).map((w) => this.headFit.ruler.width('fv-row__value', w))
          : [],
      ),
    );
    return html`<div class="dv-rows" style=${word ? `--fv-word:${word}px` : nothing}>
      ${plans.map((p, i) => this.renderRow(p, events, keep, short, placed[i] ?? null))}
    </div>`;
  }

  /**
   * Where a row's value in words stands once the rows gave their circles away (`fitValue`), weighed at its narrowest as
   * the row draws it: its longest word, where it breaks between its words (Dutch "Niet / gedetecteerd" stays beside
   * its name), else the whole of it. Where even that would leave the name under its floor or the line's least form
   * would not hold (Home Assistant's one-word "Nedetekováno" at 204), it goes under the name, in the line's place.
   */
  private under(p: RowPlan): ValueFit {
    const { ruler } = this.headFit;
    const cls = `fv-row__value ${wordsClass(p.value)}`.trim();
    const narrowest = p.value
      .split(/\s+/)
      .reduce((wide, w) => (ruler.width(cls, w) > ruler.width(cls, wide) ? w : wide));
    return fitValue(ruler, {
      row: this.contentWidth,
      base: this.headFit.rowRoom(this.contentWidth, '', { icon: false }),
      name: p.title,
      value: narrowest,
      cls,
      least: p.age ? ruler.width('fv-row__sub', this.shortAge(p)) : 0,
      wraps: false,
    });
  }

  /** What a row shows and how wide its end is, before the list decides its circles and its ages. */
  private plan(row: RowConfig, events: boolean): RowPlan {
    const view = this.host.entity(row.entity);
    const usable = isUsable(view);
    const canToggle = usable && SAFE_TOGGLE.has(view.domain) && !WAYS_IN.has(view.domain);
    // a select's value opens its dropdown (#96), unless the row names a tap of its own
    const trailing: RowPlan['trailing'] =
      SELECTS.has(view.domain) && !row.tap_action
        ? 'menu'
        : canToggle
          ? 'switch'
          : !events && view.status === 'ok' && (view.number !== null || READ_OUT.has(view.domain))
            ? 'value'
            : 'chevron';
    const parts = trailing === 'value' ? valueParts(this.hass, view) : null;
    // a select says its option in the row's words (`labels`)
    const value =
      trailing === 'switch' || trailing === 'chevron'
        ? ''
        : SELECTS.has(view.domain)
          ? chosenLabel(this.hass, view, row, this.host.state(view))
          : parts
            ? `${parts.value}${parts.unit ? ` ${parts.unit}` : ''}`
            : stateText(this.hass, view);
    // the line says when it changed unless the row asks for another one (the area, its state, an attribute, a template,
    // none); in history that is the time of day (its age, once it is over half a day old)
    const mode = row.secondary ?? 'last-changed';
    const changed = lastChanged(this.hass, view, row.since);
    const time = events && mode === 'last-changed' && view.status === 'ok';
    const line = (short: boolean): string =>
      secondaryText(
        this.hass,
        view,
        mode,
        trailing === 'value' || trailing === 'menu',
        this.texts,
        short,
        row.since,
      );
    return {
      row,
      view,
      usable,
      trailing,
      value,
      // the end's own width: the value's words, a dropdown's button, a switch's 56 (its hit area), a chevron's 44
      end:
        trailing === 'value'
          ? this.headFit.ruler.width('fv-row__value', value)
          : trailing === 'menu'
            ? buttonWidth(this.headFit.ruler, value, true)
            : trailing === 'switch'
              ? 56
              : 44,
      title: this.host.name(view, row.name),
      words: time ? changedTime(this.hass, view, row.since) : line(false),
      short: time ? '' : line(true),
      // an age only where the line is one: a state's word (a row that cannot be read) is never shortened into one
      age:
        view.status === 'ok' &&
        changed !== null &&
        mode === 'last-changed' &&
        (!events || !changed.recent),
    };
  }

  /** A row's words' room: the column less its circle (where kept), the gap and what ends the row. */
  private wordsRoom(p: RowPlan, keep: boolean): number {
    return this.headFit.rowRoom(this.contentWidth, '', { icon: keep, end: p.end });
  }

  /** An age in its short form: "21 d", "3 h", "12 min" — "21日", "12分". */
  private shortAge(p: RowPlan): string {
    const changed = lastChanged(this.hass, p.view, p.row.since);
    return changed ? ageShort(this.hass, changed.date) : '';
  }

  private renderRow(
    p: RowPlan,
    events: boolean,
    keep: boolean,
    short: boolean,
    fit: ValueFit | null,
  ): TemplateResult {
    const { row, view, usable, trailing } = p;
    const state = this.host.state(view);
    const on = state === view.state ? isActive(view) : state === 'on';
    const tone = statusToneOf(row, toneFor(view));
    const menu = trailing === 'menu';
    // a value in words under the name takes the line's place, the row its 60, the line read in the row's label
    const under = fit?.stack ?? false;
    // a dropdown that would not hold beside the words even without the circle goes under them, the line its whole row
    const stack =
      under ||
      (menu &&
        !keep &&
        rowStacks(this.headFit.ruler, this.contentWidth, dropdownEnd(p.title, p.value, p.short)));
    // a row that cannot be read says its state's word where it fits; where it would be cut, the dashed skin says it
    // alone and the word is the row's label (as a gone tile's)
    const fits = (text: string): boolean =>
      this.headFit.ruler.width('fv-row__sub', text) <=
      (stack ? this.contentWidth : this.wordsRoom(p, keep));
    const word = view.status !== 'ok' && !fits(p.words) ? p.words : '';
    // a line the row cannot hold whole takes its shorter form ("32 d ago", "Not found"), read in full
    const sub = under
      ? ''
      : p.age && short
        ? this.shortAge(p)
        : word
          ? ''
          : fits(p.words)
            ? p.words
            : p.short;
    return listRow({
      icon: keep ? iconOf(view, row.icon) : null,
      tone: events
        ? usable
          ? toneOf(row, 'neutral')
          : 'off'
        : currentTone(view, on ? tone : 'neutral'),
      title: p.title,
      name: true,
      sub,
      // a short line is read in full; a word the row could not hold is read too
      ...(word
        ? { label: `${p.title} · ${word}` }
        : sub !== p.words
          ? { label: `${p.title} · ${p.words}` }
          : {}),
      stack,
      trailing: menu
        ? dropdown({
            host: this.host,
            hass: this.hass,
            view,
            row,
            name: p.title,
            value: p.value,
            stack,
            ruler: this.headFit.ruler,
            width: this.contentWidth,
          })
        : trailing,
      on,
      switchTone: tone === 'warning' ? 'accent' : tone,
      value: p.value,
      valueSize: fit?.size,
      valueTone: view.domain === 'binary_sensor' && on && tone === 'warning' ? 'warning' : '',
      unavailable: !usable,
      accent: this.host.accents.item(row.color),
      // a dropdown's row is no button of its own: its value is; out of reach, the row opens its details
      ...(menu && usable ? {} : this.host.press(row, view.id)),
      onToggle: (next) => {
        if (!this.hass) return;
        this.host.expect(view.id, next ? 'on' : 'off');
        void toggleEntity(this.hass, view.id);
      },
    });
  }
}

/** The rows each card of one device lists under its body (`extraRows`), made the first time it draws them. */
const extra = new WeakMap<RowsElement, RowList>();

/**
 * The rows a card of one device lists under its body (#262, `Card.extraRows`): its list, read from its config, fitted
 * on its head's ruler, each entity followed while it is drawn (the card watches none of them of its own).
 */
export function extraRows(
  card: RowsElement,
  host: RowsHost,
  fit: HeadFit,
  texts: TemplateTexts,
): TemplateResult | typeof nothing {
  let list = extra.get(card);
  if (!list) extra.set(card, (list = new RowList(card, host, fit, texts)));
  list.set(card.config?.rows);
  for (const id of list.ids) host.follow(id);
  return list.render();
}
