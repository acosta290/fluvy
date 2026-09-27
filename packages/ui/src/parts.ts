import { html, nothing, type TemplateResult } from 'lit';
import { startStepRepeat, stopStepRepeat } from './controls/pointer.js';
import { glyph, isGlyph, type GlyphName } from './glyphs.js';

/**
 * Template functions for the fluvy primitives — the same markup and class names as the approved
 * design sheets (`apps/design-lab/fluvy.js`), rendered by Lit so the DOM is stable and transitions run.
 * Nothing here knows about Home Assistant: values in, callbacks out.
 */

export type Tone =
  | 'accent'
  | 'light'
  | 'heat'
  | 'cool'
  | 'dry'
  | 'fan'
  | 'water'
  | 'solar'
  | 'grid'
  | 'media'
  | 'neutral'
  | 'off'
  | 'warning';

/** Either a fluvy glyph name or a Home Assistant icon id (`mdi:…`), which `<ha-icon>` draws. */
export type IconRef = GlyphName | `${string}:${string}`;

/** `fluvy:cloud-sun` → the glyph name `cloudSun`. */
const glyphOf = (ref: string): string =>
  ref.slice(ref.indexOf(':') + 1).replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());

export function icon(
  ref: IconRef | string | undefined,
  fallback: GlyphName = 'dots',
): TemplateResult {
  if (ref && ref.startsWith('fluvy:')) {
    const name = glyphOf(ref);
    if (isGlyph(name)) return glyph(name);
  }
  if (ref && ref.includes(':')) return html`<ha-icon class="fv-haicon" .icon=${ref}></ha-icon>`;
  return glyph(isGlyph(ref) ? ref : fallback);
}

export interface IcoOptions {
  readonly hero?: boolean;
  readonly onTap?: ((event: Event) => void) | undefined;
  readonly label?: string;
  /** The circle is itself a switch in this state (a tile too narrow for one beside it): role switch, aria-checked. */
  readonly checked?: boolean;
}

export function ico(
  ref: IconRef | string | undefined,
  tone: Tone = 'accent',
  options: IcoOptions = {},
): TemplateResult {
  const cls = `fv-ico fv-ico--${tone}${options.hero ? ' fv-ico--hero' : ''}${options.onTap ? ' fv-ico--tap' : ''}`;
  if (options.onTap)
    return html`<button
      class=${cls}
      data-icon
      data-target
      role=${options.checked === undefined ? nothing : 'switch'}
      aria-checked=${options.checked === undefined ? nothing : String(options.checked)}
      aria-label=${options.label ?? nothing}
      @click=${options.onTap}
    >
      ${icon(ref)}
    </button>`;
  return html`<span class=${cls} data-icon>${icon(ref)}</span>`;
}

export interface HeadOptions {
  readonly icon?: IconRef | string | undefined;
  readonly tone?: Tone;
  readonly title: string;
  readonly sub?: string;
  readonly trailing?: TemplateResult | typeof nothing;
  readonly onIconTap?: ((event: Event) => void) | undefined;
  readonly iconLabel?: string;
  /** The title is a name (a device's, a person's): it may end in an ellipsis in a narrow column, as names do. */
  readonly name?: boolean;
}

export function head(o: HeadOptions): TemplateResult {
  return html`<div class="fv-card__head">
    ${ico(o.icon, o.tone ?? 'accent', { onTap: o.onIconTap, ...(o.iconLabel ? { label: o.iconLabel } : {}) })}
    <div class="fv-card__titles">
      <h3 class="fv-card__title" data-name=${o.name ? '' : nothing}>${o.title}</h3>
      ${o.sub ? html`<p class="fv-card__sub">${o.sub}</p>` : nothing}
    </div>
    ${o.trailing ?? nothing}
  </div>`;
}

export const label = (text: string): TemplateResult => html`<p class="fv-label">${text}</p>`;

/** Badges size to their text: 14 px sides, rounded up to the 4 grid by `fitPills()` after render. */
export const badge = (text: string, tone: Tone = 'accent'): TemplateResult =>
  html`<span class="fv-badge fv-badge--${tone}" data-control data-fit="28">${text}</span>`;

export interface ReadoutOptions {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly size?: 'xs' | 's' | 'm' | 'l';
  readonly trend?: 'up' | 'down' | undefined;
}

export function readout(o: ReadoutOptions): TemplateResult {
  return html`<div class="fv-readout fv-readout--${o.size ?? 'm'}">
    <p class="fv-readout__label">${o.label}</p>
    <p class="fv-readout__value">
      <span>${o.value}</span
      >${o.unit ? html`<span class="fv-unit">${o.unit}</span>` : nothing}${o.trend ? html`<span class="fv-trend ${o.trend === 'down' ? 'fv-trend--down' : ''}">${glyph(o.trend === 'down' ? 'trendDown' : 'trendUp')}</span>` : nothing}
    </p>
  </div>`;
}

/** 48×28 switch inside a 56×44 hit area. */
export function toggle(
  on: boolean,
  tone: Tone,
  onToggle: (next: boolean) => void,
  ariaLabel = '',
  disabled = false,
): TemplateResult {
  const flip = (event: Event): void => {
    event.stopPropagation();
    if (!disabled) onToggle(!on);
  };
  const key = (event: KeyboardEvent): void => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      flip(event);
    }
  };
  return html`<span class="fv-hit ${disabled ? 'is-fixed' : ''}" data-target @click=${flip}
    ><span
      data-control
      class="fv-switch fv-switch--${tone} ${on ? 'is-on' : ''}"
      role="switch"
      tabindex=${disabled ? -1 : 0}
      aria-checked=${on ? 'true' : 'false'}
      aria-disabled=${disabled ? 'true' : 'false'}
      aria-label=${ariaLabel || nothing}
      @keydown=${key}
      ><span class="fv-switch__thumb"></span></span
  ></span>`;
}

/** − | + pill (96 × 44). Holding a half repeats the step, always through the latest `onStep`. */
export function stepper(
  onStep: (direction: 1 | -1) => void,
  options: { disabled?: boolean; className?: string; decrease?: string; increase?: string } = {},
): TemplateResult {
  const keyClick =
    (direction: 1 | -1) =>
    (event: MouseEvent): void => {
      if (event.detail === 0) onStep(direction);
    }; // keyboard activation only
  const half = (direction: 1 | -1, name: string, icon: 'minus' | 'plus'): TemplateResult =>
    html`<button
      class="fv-stepper__half"
      data-target
      aria-label=${name}
      ?disabled=${options.disabled ?? false}
      .fvStep=${onStep}
      @pointerdown=${(event: PointerEvent) => startStepRepeat(event, direction)}
      @pointerup=${stopStepRepeat}
      @pointerleave=${stopStepRepeat}
      @pointercancel=${stopStepRepeat}
      @click=${keyClick(direction)}
    >
      ${glyph(icon)}
    </button>`;
  return html`<div class="fv-stepper ${options.className ?? ''}" data-control>
    ${half(-1, options.decrease ?? '−', 'minus')}${half(1, options.increase ?? '+', 'plus')}
  </div>`;
}

export interface OptionItem {
  readonly key: string;
  readonly label: string;
  readonly value?: string;
  readonly glyph?: IconRef | string;
  readonly tone?: Tone;
  readonly active?: boolean;
}

/** Up to three tiles share a row; four make a 2 × 2; more wrap in threes — a tile never gets too narrow for its value. */
export const optionColumns = (count: number): number =>
  count <= 3 ? Math.max(1, count) : count === 4 ? 2 : 3;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * How option tiles share their rows: every row is filled edge to edge. Full rows split the column into
 * `columns` equal cells; a shorter last row splits it into as many equal cells as it holds (5 modes on
 * 3 columns: 3 + 2 wider). Returns the grid's track count and each tile's span.
 */
export function optionGrid(
  count: number,
  columns: number,
): { readonly tracks: number; readonly spans: readonly number[] } {
  const perRow = Math.max(1, Math.min(columns, count));
  const last = count % perRow;
  if (last === 0) return { tracks: perRow, spans: Array.from({ length: count }, () => 1) };
  const tracks = (perRow * last) / gcd(perRow, last);
  return {
    tracks,
    spans: Array.from({ length: count }, (_, index) =>
      index >= count - last ? tracks / last : tracks / perRow,
    ),
  };
}

/** Option tiles: glyph top-left, label, value; active = tone fill only. They share the column in equal cells and every row is full. */
export function options(
  items: readonly OptionItem[],
  onSelect: ((key: string) => void) | null,
  gap = 4,
  height = 84,
  columns = optionColumns(items.length),
): TemplateResult {
  const stat = onSelect === null;
  const grid = optionGrid(items.length, columns);
  return html`<div
    class="fv-options"
    style="grid-template-columns:repeat(${grid.tracks}, minmax(0, 1fr));gap:${gap}px"
  >
    ${items.map((o, index) => {
      const cls = `fv-option ${stat ? 'fv-option--stat ' : ''}${o.active ? `is-active fv-option--${o.tone ?? 'accent'}` : ''}`;
      const body = html`<span class="fv-option__glyph">${icon(o.glyph)}</span
        ><span class="fv-option__label">${o.label}</span
        ><span class="fv-option__value">${o.value ?? ''}</span>`;
      // a minimum, not a height: a tile whose value takes two lines grows, and its row grows with it
      const style = `min-height:${height}px${grid.spans[index] === 1 ? '' : `;grid-column:span ${grid.spans[index]}`}`;
      return stat
        ? html`<div class=${cls} data-card style=${style}>${body}</div>`
        : html`<button
            class=${cls}
            data-target
            style=${style}
            aria-pressed=${o.active ? 'true' : 'false'}
            @click=${() => onSelect(o.key)}
          >
            ${body}
          </button>`;
    })}
  </div>`;
}

export interface ChipItem {
  readonly key: string;
  readonly label: string;
  readonly glyph?: IconRef | string;
  readonly active?: boolean;
}

/**
 * The columns of a full chip row: one row while the labels fit in equal cells of a card's column
 * (four short words do, "Silent · Basic · Strong · Full Speed" does not), else two or three per row;
 * a label is never cut to make a row.
 */
export function chipColumns(labels: readonly string[]): number {
  const count = labels.length;
  const longest = Math.max(0, ...labels.map((label) => label.length));
  if (count <= 3) return Math.max(1, count);
  if (count === 4) return longest <= 7 ? 4 : 2;
  return longest <= 6 && count <= 5 ? count : 3;
}

/**
 * Chips. Content-sized by default (14 px sides, the row does not stretch); `fill` = equal chips that
 * fill the whole row — every row, the last one splitting the width among its own chips.
 */
export function chips(
  items: readonly ChipItem[],
  onSelect: (key: string) => void,
  className = '',
  fill = false,
): TemplateResult {
  const grid = fill ? optionGrid(items.length, chipColumns(items.map((c) => c.label))) : undefined;
  return html`<div
    class="fv-chips ${className} ${fill ? 'fv-chips--fill' : ''}"
    style=${grid ? `grid-template-columns:repeat(${grid.tracks}, minmax(0, 1fr))` : nothing}
  >
    ${items.map((c, index) => html`<button class="fv-chip ${c.active ? 'is-active' : ''}" data-target data-fit=${fill ? nothing : '28'} style=${grid && grid.spans[index] !== 1 ? `grid-column:span ${grid.spans[index]}` : nothing} aria-pressed=${c.active ? 'true' : 'false'} @click=${() => onSelect(c.key)}><span class="fv-chip__pill" data-control>${c.glyph ? icon(c.glyph) : nothing}${c.label}</span></button>`)}
  </div>`;
}

export interface ActionItem {
  readonly key: string;
  readonly glyph: IconRef | string;
  readonly label: string;
  readonly primary?: boolean;
  readonly disabled?: boolean;
}

/** Action row: glyph buttons in equal cells that fill the column (16 gap, 44 tall, radius 12). */
export function actions(
  items: readonly ActionItem[],
  onAction: (key: string) => void,
): TemplateResult {
  return html`<div
    class="fv-actions"
    style="grid-template-columns:repeat(${items.length}, minmax(0, 1fr))"
  >
    ${items.map((a) => html`<button class="fv-action ${a.primary ? 'fv-action--accent' : ''}" data-control data-target aria-label=${a.label} title=${a.label} ?disabled=${a.disabled ?? false} @click=${() => onAction(a.key)}>${icon(a.glyph)}</button>`)}
  </div>`;
}

/** A round button (the language's 44 circle); `on-page` on the page's ground, `bare` with no fill of its own. */
export function round(
  ref: IconRef | string,
  kind: 'quiet' | 'accent' | 'on-page' | 'bare' | '',
  ariaLabel: string,
  onClick: (event: Event) => void,
  disabled = false,
  extra = '',
): TemplateResult {
  return html`<button
    class="fv-round ${kind ? `fv-round--${kind}` : ''} ${extra}"
    data-control
    data-target
    aria-label=${ariaLabel}
    title=${ariaLabel}
    ?disabled=${disabled}
    @click=${onClick}
  >
    ${icon(ref)}
  </button>`;
}

export function button(
  text: string,
  kind: 'quiet' | 'accent' | 'link',
  onClick: (event: Event) => void,
  fill = false,
): TemplateResult {
  return html`<button
    class="fv-btn fv-btn--${kind}"
    data-control
    data-target
    style=${fill ? 'width:100%' : nothing}
    data-fit=${fill ? nothing : '32'}
    @click=${onClick}
  >
    ${text}
  </button>`;
}

export interface ListRowOptions {
  readonly icon?: IconRef | string | undefined;
  readonly tone?: Tone;
  readonly title: string;
  readonly sub?: string;
  readonly trailing?: 'switch' | 'chevron' | 'value' | 'none';
  readonly on?: boolean;
  readonly value?: string;
  readonly valueTone?: 'warning' | '';
  readonly switchTone?: Tone;
  readonly unavailable?: boolean;
  /** Shown as it is but not changeable here (someone who may only look): full strength, a switch that does not move. */
  readonly readonly?: boolean;
  readonly onTap?: (() => void) | undefined;
  readonly onToggle?: ((next: boolean) => void) | undefined;
}

/** A value that reads as words, not a figure: it may take two lines instead of one. */
const words = (value: string | undefined): boolean => /[a-zà-ÿ]{3}/i.test(value ?? '');
const wordy = (value: string | undefined): boolean => (value ?? '').length > 14 && words(value);
/** A value in words: prose (`--text`, a smaller two-line style) or a short state (`--words`, which a card may let wrap). */
const wordsClass = (value: string | undefined): string =>
  wordy(value) ? 'fv-row__value--text' : words(value) ? 'fv-row__value--words' : '';

/** 60 px row: icon circle, title/sub, one trailing element. */
export function listRow(o: ListRowOptions): TemplateResult {
  const trailing = o.trailing ?? 'chevron';
  const tail =
    trailing === 'switch'
      ? toggle(
          o.on ?? false,
          o.switchTone ?? 'accent',
          o.onToggle ?? (() => undefined),
          o.title,
          (o.unavailable ?? false) || (o.readonly ?? false),
        )
      : trailing === 'value'
        ? html`<span
            class="fv-row__value ${o.valueTone ? `fv-row__value--${o.valueTone}` : ''} ${wordsClass(o.value)}"
            >${o.value ?? ''}</span
          >`
        : trailing === 'chevron'
          ? html`<span class="fv-row__chevron">${glyph('chevron')}</span>`
          : nothing;
  return html`<div
    class="fv-row ${o.onTap ? 'fv-row--tap' : ''} ${o.unavailable ? 'is-unavailable' : ''}"
    role=${o.onTap ? 'button' : nothing}
    tabindex=${o.onTap ? 0 : nothing}
    @click=${o.onTap ?? nothing}
    @keydown=${activateKey(o.onTap)}
  >
    <span class="fv-ico fv-ico--${o.tone ?? 'neutral'}" data-icon>${icon(o.icon)}</span>
    <span class="fv-row__text"
      ><span class="fv-row__title">${o.title}</span
      >${o.sub ? html`<span class="fv-row__sub">${o.sub}</span>` : nothing}</span
    >
    ${tail}
  </div>`;
}

/** The language's empty state: a 44 ring with a glyph over one secondary line, centred in a 120 panel. */
export function emptyState(ref: IconRef | string, text: string, hint = ''): TemplateResult {
  return html`<div class="fv-empty-state" role="status">
    <span class="fv-empty-state__ring">${icon(ref)}</span
    ><span class="fv-empty-state__text">${text}</span>
    ${hint ? html`<span class="fv-empty-state__hint">${hint}</span>` : nothing}
  </div>`;
}

export interface BarRowOptions {
  readonly icon?: IconRef | string | undefined;
  readonly tone?: Tone;
  readonly title: string;
  readonly sub?: string;
  readonly value?: string;
  readonly fraction: number;
  readonly barTone?: Tone;
  readonly valueTone?: 'warning' | '';
  readonly onTap?: (() => void) | undefined;
}

/** Enter / Space on an element that plays a button (`role="button"`), ignoring keys bubbling up from a control inside it. */
export const activateKey =
  (run: (() => void) | undefined) =>
  (event: KeyboardEvent): void => {
    if (
      run &&
      (event.key === 'Enter' || event.key === ' ') &&
      event.target === event.currentTarget
    ) {
      event.preventDefault();
      run();
    }
  };

/** 76 px row with a 4 px bar under the text (plants, strings, batteries, meters). */
export function barRow(o: BarRowOptions): TemplateResult {
  const pct = Number.isFinite(o.fraction)
    ? Math.round(Math.min(1, Math.max(0, o.fraction)) * 100)
    : 0;
  return html`<div
    class="fv-row fv-row--bar ${o.onTap ? 'fv-row--tap' : ''}"
    role=${o.onTap ? 'button' : nothing}
    tabindex=${o.onTap ? 0 : nothing}
    @click=${o.onTap ?? nothing}
    @keydown=${activateKey(o.onTap)}
  >
    <span class="fv-ico fv-ico--${o.tone ?? 'neutral'}" data-icon>${icon(o.icon)}</span>
    <span class="fv-row__text"
      ><span class="fv-row__title">${o.title}</span
      >${o.sub ? html`<span class="fv-row__sub">${o.sub}</span>` : nothing}<span class="fv-bar"
        ><span
          class="fv-bar__fill fv-bar--${o.barTone ?? o.tone ?? 'neutral'}"
          data-measure="value"
          style="width:${pct}%"
        ></span></span
    ></span>
    <span class="fv-row__value ${o.valueTone ? `fv-row__value--${o.valueTone}` : ''}"
      >${o.value ?? ''}</span
    >
  </div>`;
}

export interface StackItem {
  readonly label: string;
  readonly value: number;
  readonly display: string;
  readonly tone: Tone;
}

/** One stacked bar of segments and a legend with square swatches. */
export function stack(items: readonly StackItem[]): TemplateResult {
  const part = (value: number): number => (Number.isFinite(value) ? Math.max(0, value) : 0);
  const total = items.reduce((sum, i) => sum + part(i.value), 0) || 1;
  return html`<div class="fv-stack">
      ${items.map((i) => html`<span class="fv-stack__seg fv-bar--${i.tone}" data-measure="value" style="width:${((part(i.value) / total) * 100).toFixed(2)}%"></span>`)}
    </div>
    <div class="fv-legend">
      ${items.map((i) => html`<div class="fv-legend__row"><i class="fv-swatch fv-bar--${i.tone}"></i><span class="fv-legend__name">${i.label}</span><span class="fv-legend__value">${i.display}</span></div>`)}
    </div>`;
}

/** Axis / ruler labels placed by value; the ends hug the edges. */
function placed(
  cls: string,
  items: readonly (readonly [fraction: number, text: string])[],
): TemplateResult {
  return html`<div class=${cls}>
    ${items.map(([f, text]) =>
      !(f > 0)
        ? html`<span class="is-first" style="left:0">${text}</span>`
        : f >= 1
          ? html`<span class="is-last" style="right:0">${text}</span>`
          : html`<span style="left:${(f * 100).toFixed(3)}%">${text}</span>`,
    )}
  </div>`;
}

export const axis = (items: readonly (readonly [number, string])[]): TemplateResult =>
  placed('fv-axis', items);
export const rulerLabels = (items: readonly (readonly [number, string])[]): TemplateResult =>
  placed('fv-ruler-labels', items);

const up4 = (n: number): number => Math.ceil(n / 4) * 4;

/**
 * Sizes every `[data-fit]` pill from its text plus the declared side padding, rounded up to the 4 px
 * grid — the rule the design sheets are measured by. The text is measured with layout metrics (the used
 * `width` under `max-content`), not client rects: a card that is still scaling in would otherwise measure
 * 1.5 % short. The used width keeps its fraction and is rounded up — `offsetWidth` rounds to the nearest
 * pixel, and a 68.4 px label given a 68 px box breaks onto a second line. `force` re-measures pills whose
 * text did not change (a web font arrived).
 */
export function fitPills(root: ParentNode, force = false): void {
  root.querySelectorAll<HTMLElement>('[data-fit]').forEach((el) => {
    const pad = Number(el.dataset['fit']);
    if (!pad) return;
    const text = el.textContent ?? '';
    if (!force && el.dataset['fitKey'] === text) return;
    const previous = el.style.width;
    // the box that lays the content out: a chip's pill, otherwise the pill itself
    const box = el.querySelector<HTMLElement>('.fv-chip__pill') ?? el;
    box.style.paddingLeft = ''; // measured without last time's lead-in and tail
    box.style.paddingRight = '';
    el.style.width = 'max-content';
    const natural = Math.ceil(parseFloat(getComputedStyle(el).width) || el.offsetWidth);
    const width = up4(natural + pad);
    const next = `${width}px`;
    el.style.width = next === previous ? previous : next;
    // content starts on a whole pixel (an icon on a half pixel blurs at 1×); the fractional remainder is air on the right.
    // The right side is padded too, never more than what is left, so the content box is at least the text: a pill capped
    // by a max-width ellipsises inside its padding, an uncapped one never does.
    const lead = Math.round((width - natural) / 2);
    box.style.justifyContent = 'flex-start';
    box.style.paddingLeft = `${lead}px`;
    box.style.paddingRight = `${Math.max(0, width - natural - lead)}px`;
    el.dataset['fitKey'] = text;
  });
}
