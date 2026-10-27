import {
  CHART_PRESET_NAMES,
  formatNumber,
  GAUGE_PRESET_NAMES,
  localize,
  PALETTE_SERIES,
  paletteOf,
  SERIES_COUNT,
  type ChartPreset,
  type GaugePreset,
} from '@fluvy/core';
import type { Hex, PaletteMode } from '@fluvy/tokens/runtime';
import { head, icon, listRow } from '@fluvy/ui';
import { html, nothing, svg, type TemplateResult } from 'lit';
import {
  GAUGE_PRESETS,
  HOUSE_ACTS,
  previewChart,
  previewGauge,
  previewSeries,
  previewStyle,
  seriesCheck,
} from '../chart/engine/index.js';
import { FINE_ROWS } from './chart-words.js';
import type { PanelContext } from './model.js';
import { choice, gap, hexField } from './sections.js';
import { chosenSet, roomForSet, SET_NAME_MAX, type SeriesDraft } from './series.js';

/*
 * The Charts tab (1.11): how every chart and gauge of the house is drawn where a card says nothing of its own, chosen
 * once like the look — the style and the gauge as tiles the engine draws, the fine settings the style acts on, the
 * series colours (the palette's six or a set of the house's own, made here and checked), and a preview of a chart, its
 * bars and a gauge in both modes. Every choice is an edit of the house's settings, shown on the page at once and saved
 * from the bar; the sets are kept at once, as the house's palettes are. An administrator's to change, read by anyone.
 */

export interface ChartActions {
  saveSet(draft: SeriesDraft): void;
  removeSet(id: string): void;
}

/** A reading as the panel's language writes it (the previews' figures). */
const formatter =
  (ctx: PanelContext) =>
  (value: number): string =>
    formatNumber(ctx.hass, value);

/* ---------- the tiles ---------- */

/** Tiles a row: two on a phone, four on a wide panel — the eight styles fill two rows, the four gauges one. */
const tileColumns = (ctx: PanelContext): number => (ctx.wide ? 4 : 2);

/** A tile's drawing room across: the tile's share of the card less its 8 and its picture's 8 on each side. */
function artWidth(ctx: PanelContext): number | undefined {
  if (!ctx.fit) return undefined;
  const n = tileColumns(ctx);
  return Math.floor((ctx.fit.width - (n - 1) * gap(ctx)) / n + 0.01) - 32;
}

/** A style's drawing room down: the picture's 72 on a phone (96 on a wide panel) less its 8 above and below. */
const STYLE_ART = { phone: 56, wide: 80 } as const;
/** The largest a gauge is drawn in its tile: a dial 96 across and 100 down, its picture's room (styles.ts). */
const GAUGE_SIZE = 96;

interface Tile {
  readonly key: string;
  readonly label: string;
  readonly active: boolean;
  readonly art: TemplateResult | typeof nothing;
}

/**
 * The Apple-like tiles of the house (the palettes' swatches): each a drawing on the card's surface over its name, the
 * chosen one in the accent's fill with a check; `onPick` null: shown to someone who may not change them.
 */
function tiles(
  ctx: PanelContext,
  items: readonly Tile[],
  onPick: ((key: string) => void) | null,
  kind: 'style' | 'gauge',
): TemplateResult {
  return html`<div
    class="pn-tiles ${ctx.wide ? 'pn-tiles--four' : ''} ${onPick ? '' : 'pn-tiles--static'}"
    data-fill-row
  >
    ${items.map(
      (item) =>
        html`<button
          class="pn-swatch pn-tile ${item.active ? 'is-active' : ''}"
          data-target
          aria-pressed=${item.active ? 'true' : 'false'}
          tabindex=${onPick ? nothing : '-1'}
          @click=${() => onPick?.(item.key)}
        >
          <span class="pn-art pn-art--chart pn-art--${kind} fv-tone--accent">${item.art}</span>
          <span class="pn-swatch__name"
            ><span class="pn-swatch__label">${item.label}</span>${
              item.active ? icon('check') : nothing
            }</span
          >
        </button>`,
    )}
  </div>`;
}

function styleCard(ctx: PanelContext): TemplateResult {
  const charts = ctx.shown.charts;
  const width = artWidth(ctx);
  const height = ctx.wide ? STYLE_ART.wide : STYLE_ART.phone;
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'chart', title: ctx.t('charts.style'), sub: ctx.t(ctx.admin ? 'charts.style_sub' : 'scope.admin_only') })}
    ${tiles(
      ctx,
      CHART_PRESET_NAMES.map((preset) => ({
        key: preset,
        label: localize(ctx.hass, `option.${preset}`),
        active: charts.style === preset,
        art: width ? previewStyle(preset, charts, width, height) : nothing,
      })),
      ctx.admin ? (key) => ctx.editCharts({ style: key as ChartPreset }) : null,
      'style',
    )}
  </section>`;
}

function gaugeCard(ctx: PanelContext): TemplateResult {
  const charts = ctx.shown.charts;
  const width = artWidth(ctx);
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'thermo', title: ctx.t('charts.gauge'), sub: ctx.t(ctx.admin ? 'charts.gauge_sub' : 'scope.admin_only') })}
    ${tiles(
      ctx,
      GAUGE_PRESET_NAMES.map((preset) => ({
        key: preset,
        label: localize(ctx.hass, `option.${preset}`),
        active: charts.gauge === preset,
        art: width
          ? previewGauge(preset, charts, {
              size: preset === 'ruler' ? width : Math.min(width, GAUGE_SIZE),
              format: formatter(ctx),
              small: true,
            })
          : nothing,
      })),
      ctx.admin ? (key) => ctx.editCharts({ gauge: key as GaugePreset }) : null,
      'gauge',
    )}
  </section>`;
}

/* ---------- the fine settings ---------- */

/**
 * What the chosen style lets the house tune, a row of chips each (the engine's `HOUSE_ACTS`: a setting the style does
 * not draw with is not offered), the waves where the gauge moves, and motion, which every chart has.
 */
function detailsCard(ctx: PanelContext): TemplateResult {
  const { admin } = ctx;
  const charts = ctx.shown.charts;
  const acts = HOUSE_ACTS[charts.style];
  const rows = FINE_ROWS.filter((row) =>
    row.acts === 'wave' ? GAUGE_PRESETS[charts.gauge].motion : acts.includes(row.acts),
  );
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'sliders', title: ctx.t('charts.details'), sub: ctx.t(admin ? 'charts.details_sub' : 'scope.admin_only') })}
    ${acts.length ? nothing : html`<p class="pn-note">${ctx.t('charts.classic_hint')}</p>`}
    ${rows.map(
      (row) =>
        html`<p class="fv-label pn-label">${ctx.t(row.label)}</p>
          ${choice(
            ctx,
            row.choices.map((c) => ({
              key: c.key,
              label: c.word(ctx),
              active: row.chosen(charts) === c.key,
            })),
            admin ? (key) => ctx.editCharts(row.patch(charts, key)) : null,
          )}`,
    )}
    <div class="pn-rows">
      ${listRow({
        icon: 'motion',
        title: ctx.t('charts.motion'),
        sub: ctx.t('charts.motion_sub'),
        trailing: 'switch',
        on: charts.animate,
        readonly: !admin,
        onToggle: (on) => ctx.editCharts({ animate: on }),
      })}
    </div>
  </section>`;
}

/* ---------- the series colours ---------- */

/** The palette's six series colours, as the look being chosen derives them in the mode on screen. */
const PALETTE_INKS = Array.from(
  { length: SERIES_COUNT },
  (_unused, n) => `var(--fluvy-graph-${n + 1})`,
);
/** The six columns of a set's picture, as tall as a chart's series might stand. */
const COLUMNS = [24, 34, 18, 30, 22, 36] as const;

/** A set of six colours as one picture: six rounded columns on the card's surface, scaled whole with its box. */
const setArt = (inks: readonly string[]): TemplateResult =>
  html`<span class="pn-art pn-art--chart pn-art--series"
    ><svg viewBox="0 0 80 40" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      ${inks.map(
        (ink, n) =>
          svg`<rect x=${n * 14} y=${40 - (COLUMNS[n] ?? 24)} width="10" height=${COLUMNS[n] ?? 24} rx="3" style=${`fill:${ink}`} />`,
      )}
    </svg></span
  >`;

/** A set as a row to choose it by: its picture, its name (the house's own words), a check when it is the one worn. */
function setRow(
  title: string,
  inks: readonly string[],
  active: boolean,
  onPick: (() => void) | null,
  sub?: string,
): TemplateResult {
  return html`<button
    class="pn-custom pn-set ${active ? 'is-active' : ''}"
    data-target
    aria-pressed=${active ? 'true' : 'false'}
    tabindex=${onPick ? nothing : '-1'}
    @click=${() => onPick?.()}
  >
    ${setArt(inks)}
    <span class="pn-custom__text">
      <span class="pn-custom__title" data-name>${title}</span>
      ${sub ? html`<span class="pn-custom__sub">${sub}</span>` : nothing}
    </span>
    ${active ? html`<span class="pn-custom__tail">${icon('check')}</span>` : nothing}
  </button>`;
}

/**
 * The colours of a chart's several series: the palette's six, or one of the house's sets — chosen with one tap; an
 * administrator makes a new set (twelve at most) or changes the one chosen.
 */
function seriesCard(ctx: PanelContext): TemplateResult {
  const { admin } = ctx;
  const sets = ctx.settings.chartSets;
  const chosen = chosenSet(sets, ctx.shown.charts.series);
  const pick = (id: string) => (admin ? () => ctx.editCharts({ series: id }) : null);
  const editing = ctx.seriesDraft !== undefined;
  const room = roomForSet(sets);
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'palette', title: ctx.t('charts.series'), sub: ctx.t(admin ? 'charts.series_sub' : 'scope.admin_only') })}
    <div class="pn-sets ${admin ? '' : 'pn-sets--static'}">
      ${setRow(
        ctx.t('charts.palette'),
        PALETTE_INKS,
        !chosen,
        pick(PALETTE_SERIES),
        ctx.t('charts.palette_sub'),
      )}
      ${sets.map((set) => setRow(set.name, set.colours, chosen?.id === set.id, pick(set.id)))}
    </div>
    ${
      // the editor open is the one way on: no second draft over it
      admin && !editing
        ? html`<div class="pn-rows">
              ${
                chosen
                  ? listRow({
                      icon: 'pencil',
                      title: ctx.t('charts.edit'),
                      sub: chosen.name,
                      subName: true,
                      onTap: () =>
                        ctx.setSeriesDraft({
                          id: chosen.id,
                          name: chosen.name,
                          colours: chosen.colours,
                        }),
                    })
                  : nothing
              }
              ${
                room
                  ? listRow({
                      icon: 'plus',
                      tone: 'accent',
                      title: ctx.t('charts.new'),
                      sub: ctx.t('charts.new_sub'),
                      onTap: () =>
                        ctx.setSeriesDraft({
                          name: '',
                          colours: paletteOf(ctx.draft.palette)[ctx.mode].graph.slice(
                            0,
                            SERIES_COUNT,
                          ),
                        }),
                    })
                  : nothing
              }
            </div>
            ${room ? nothing : html`<p class="pn-hint pn-hint--after">${ctx.t('charts.full')}</p>`}`
        : nothing
    }
  </section>`;
}

/**
 * What the tokens' gates say of a set, in words: two colours too close to tell apart (ΔE2000 under 8), and a colour
 * too faint on the card of either mode (under the icon's 3:1) — each naming the colours, so the field to change is
 * plain.
 */
function setWarnings(ctx: PanelContext, colours: readonly Hex[]): string[] {
  const palette = paletteOf(ctx.draft.palette, ctx.shown.statuses);
  const light = seriesCheck(colours, palette.light.surface.card);
  const dark = seriesCheck(colours, palette.dark.surface.card);
  const out: string[] = [];
  // two colours are as close on either card: the light one's check says it once
  for (const warning of light)
    if (warning.kind === 'close')
      out.push(ctx.t('charts.close', { a: colours[warning.a] ?? '', b: colours[warning.b] ?? '' }));
  for (const [mode, warnings] of [
    ['light', light],
    ['dark', dark],
  ] as const)
    for (const warning of warnings)
      if (warning.kind === 'faint')
        out.push(ctx.t(`charts.faint_${mode}`, { colour: colours[warning.index] ?? '' }));
  return out;
}

/**
 * The two modes side by side, each a card of its own in that mode's colours (`pn-day`, `pn-night`: the look scoped to
 * it), its name over what it draws `width` across.
 */
function modes(
  ctx: PanelContext,
  width: number | undefined,
  draw: (mode: PaletteMode, width: number) => TemplateResult,
): TemplateResult {
  const inner = width && Math.floor((width - gap(ctx)) / 2 + 0.01) - 24;
  return html`<div class="pn-modes" data-fill-row>
    ${(['light', 'dark'] as const).map(
      (mode) =>
        html`<div
          class="pn-mode ${mode === 'dark' ? 'pn-night' : 'pn-day'} fv-tone--accent"
          data-mode=${mode}
        >
          <p class="fv-label pn-mode__name">${ctx.t(`charts.${mode}`)}</p>
          ${inner ? draw(mode, inner) : nothing}
        </div>`,
    )}
  </div>`;
}

/**
 * A set of series colours being made or changed: its name, its six colours (the palette's to start with), what the
 * gates say of them, how they read on a light and a dark card, and Save — the house keeps it and the charts wear it.
 */
function setEditor(ctx: PanelContext, draft: SeriesDraft, actions: ChartActions): TemplateResult {
  const set = (patch: Partial<SeriesDraft>): void => ctx.setSeriesDraft({ ...draft, ...patch });
  const room = roomForSet(ctx.settings.chartSets, draft.id);
  const whole = draft.name.trim() !== '' && room;
  const warnings = setWarnings(ctx, draft.colours);
  const id = draft.id;
  return html`<section class="fv-card pn-card pn-editor">
    ${head({ icon: 'palette', title: ctx.t(id ? 'charts.editor_edit' : 'charts.editor_new'), sub: ctx.t('charts.editor_sub') })}
    <label class="pn-text">
      <span class="fv-label pn-label">${ctx.t('charts.name')}</span>
      <span class="fv-field"
        ><input
          class="fv-field__input"
          type="text"
          maxlength=${SET_NAME_MAX}
          .value=${draft.name}
          @input=${(event: Event) => set({ name: (event.target as HTMLInputElement).value })}
      /></span>
    </label>
    <p class="fv-label pn-label">${ctx.t('charts.colours')}</p>
    <div class="pn-hexes" data-fill-row>
      ${draft.colours.map((colour, n) =>
        hexField(
          colour,
          ctx,
          (picked) =>
            set({ colours: draft.colours.map((own, index) => (index === n ? picked : own)) }),
          ctx.t('charts.colour', { n: n + 1 }),
        ),
      )}
    </div>
    ${
      warnings.length
        ? html`<div class="pn-status pn-status--warning pn-check" role="status">
            ${warnings.map((warning) => html`<p class="pn-status__text">${warning}</p>`)}
          </div>`
        : html`<p class="pn-hint pn-hint--after pn-check">${ctx.t('charts.check_ok')}</p>`
    }
    ${modes(ctx, ctx.fit?.width, (mode, width) =>
      previewSeries(draft.colours, ctx.shown.charts, { mode, width, height: 64 }),
    )}
    ${room ? nothing : html`<p class="pn-hint pn-hint--after">${ctx.t('charts.full')}</p>`}
    <div class="pn-pair" data-fill-row>
      <button
        class="fv-btn fv-btn--quiet"
        data-target
        @click=${() => ctx.setSeriesDraft(undefined)}
      >
        ${ctx.t('charts.cancel')}
      </button>
      <button
        class="fv-btn fv-btn--accent"
        data-target
        ?disabled=${!whole}
        @click=${() => whole && actions.saveSet(draft)}
      >
        ${ctx.t('charts.save')}
      </button>
    </div>
    ${
      id
        ? html`<div class="pn-rows">
            ${listRow({
              icon: 'trash',
              title: ctx.t('charts.delete'),
              sub: draft.name,
              subName: true,
              trailing: 'none',
              onTap: () => actions.removeSet(id),
            })}
          </div>`
        : nothing
    }
  </section>`;
}

/** The Charts tab's cards (its preview apart: it goes under them, or beside them in the side column). */
export function charts(ctx: PanelContext, actions: ChartActions): TemplateResult {
  return html`${styleCard(ctx)} ${gaugeCard(ctx)} ${detailsCard(ctx)} ${seriesCard(ctx)}
  ${ctx.seriesDraft ? setEditor(ctx, ctx.seriesDraft, actions) : nothing}`;
}

/**
 * The charts as these settings draw them, in both modes side by side: a sensor's day with its bubble, the day's energy
 * as bars and a gauge — `width` the card's content (none until it is laid out).
 */
export function chartsPreview(ctx: PanelContext, width: number | undefined): TemplateResult {
  return html`<section class="fv-card pn-card pn-card--preview">
    ${head({ icon: 'eye', title: ctx.t('preview.title'), sub: ctx.t('charts.preview_sub') })}
    ${modes(ctx, width, (mode, inner) =>
      previewChart(ctx.shown.charts, { mode, width: inner, format: formatter(ctx) }),
    )}
  </section>`;
}
