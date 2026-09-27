import {
  type CardLanguage,
  HOUSE_DEFAULTS,
  offeredLanguages,
  parsePalette,
  type Scope,
  wearsLook,
} from '@fluvy/core';
import { chips, emptyState, head, icon, listRow, options } from '@fluvy/ui';
import {
  CUSTOM_BASES,
  PILL_NAMES,
  SHAPE_NAMES,
  type CustomPalette,
  type FillStyle,
  type Hex,
  type PaletteChoice,
  type PillName,
  type ShapeName,
} from '@fluvy/tokens/runtime';
import { html, nothing, svg, type TemplateResult } from 'lit';
import {
  ACCENTS,
  accentFor,
  DEFAULT_CUSTOM,
  HIGHLIGHTS,
  isCustom,
  LINES,
  lookTitle,
  paletteTitle,
  swatchColors,
  type PanelContext,
  type StringKey,
} from './model.js';

/** A short choice (a variant, a language): one full row of chips, the chosen one on the accent fill. */
function choice(
  items: readonly { readonly key: string; readonly label: string; readonly active: boolean }[],
  onSelect: ((key: string) => void) | null,
): TemplateResult {
  return chips(items, onSelect ?? (() => undefined), onSelect ? '' : 'pn-chips--static', true);
}

/** One rhythm for every choice inside a card: 8 between cells on a phone, 12 on a wide panel. */
const gap = (ctx: PanelContext): number => (ctx.wide ? 12 : 8);

/* ---------- appearance ---------- */

/** The miniature's drawing sizes: a phone swatch, a wide one, the custom row's (its box less its 8 px inset). */
const ART = {
  phone: { w: 76, h: 56, on: 44 },
  wide: { w: 184, h: 80, on: 104 },
  row: { w: 80, h: 40, on: 48 },
} as const;

/**
 * A palette as a miniature of the product, drawn as one picture (it scales whole with its cell): its page, an
 * "on" tile in its fill (an icon circle, four lit ticks), an "off" tile in its card and, when it has one, its
 * highlight under it. Nothing yet (a custom palette not made): a plus.
 */
function miniature(
  choice: PaletteChoice | null,
  ctx: PanelContext,
  size: keyof typeof ART,
): TemplateResult {
  if (!choice) return html`<span class="pn-art pn-art--new">${icon('plus')}</span>`;
  const c = swatchColors(choice, ctx.mode);
  const { w, h, on } = ART[size];
  const off = w - on - 4;
  const offH = c.highlight ? h - 12 : h;
  const ticks = [0, 1, 2, 3].map((i) => 10 + i * 6);
  return html`<span
    class="pn-art"
    style="--sw-page:${c.page};--sw-card:${c.card};--sw-border:${c.border};--sw-accent:${c.accent};--sw-fill:${c.fill};--sw-tick:${c.tick}${c.highlight ? `;--sw-hl:${c.highlight}` : ''}"
    ><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect class="pn-art__on" width=${on} height=${h} rx="6" />
      <circle class="pn-art__disc" cx="14" cy="14" r="6" />
      <circle class="pn-art__glyph" cx="14" cy="14" r="3" />
      ${ticks.map(
        (x) => svg`<line class="pn-art__tick" x1=${x} x2=${x} y1=${h - 18} y2=${h - 10} />`,
      )}
      <rect
        class="pn-art__off"
        x=${on + 4.5}
        y="0.5"
        width=${off - 1}
        height=${offH - 1}
        rx="5.5"
      />
      ${c.highlight ? svg`<rect class="pn-art__hl" x=${on + 4} y=${h - 8} width=${off} height="8" rx="4" />` : nothing}
    </svg></span
  >`;
}

function swatch(
  choice: PaletteChoice,
  active: boolean,
  ctx: PanelContext,
  onPick: () => void,
): TemplateResult {
  return html`<button
    class="pn-swatch ${active ? 'is-active' : ''}"
    data-target
    aria-pressed=${active ? 'true' : 'false'}
    @click=${onPick}
  >
    ${miniature(choice, ctx, ctx.wide ? 'wide' : 'phone')}
    <span class="pn-swatch__name"
      ><span class="pn-swatch__label">${paletteTitle(choice, ctx.t)}</span
      >${active ? icon('check') : nothing}</span
    >
  </button>`;
}

/** A custom palette is neither line (its style chooses): a builder of its own under both. */
function customEntry(ctx: PanelContext): TemplateResult {
  const current = ctx.draft.palette;
  const applied = ctx.settings.look.palette;
  const known = isCustom(current) ? current : isCustom(applied) ? applied : null;
  const active = isCustom(current);
  return html`<button
    class="pn-custom ${active ? 'is-active' : ''}"
    data-target
    aria-pressed=${active ? 'true' : 'false'}
    @click=${() => ctx.setDraft({ palette: known ?? DEFAULT_CUSTOM })}
  >
    ${miniature(known, ctx, 'row')}
    <span class="pn-custom__text">
      <span class="pn-custom__title">${ctx.t('palette.custom')}</span>
      <span class="pn-custom__sub">${ctx.t('palette.custom_sub')}</span>
    </span>
    <span class="pn-custom__tail">${icon(active ? 'check' : 'chevron')}</span>
  </button>`;
}

function gallery(ctx: PanelContext): TemplateResult {
  const current = ctx.draft.palette;
  return html`${LINES.map(
    (line) =>
      html`<p class="fv-label pn-line">
          ${ctx.t(line.key === 'soft' ? 'palette.pastel' : 'palette.electric')}
        </p>
        <div class="pn-gallery" data-fill-row>
          ${line.names.map((name) =>
            swatch(name, current === name, ctx, () => ctx.setDraft({ palette: name })),
          )}
        </div>`,
  )}
  ${customEntry(ctx)}`;
}

/** Black or white, whichever reads better on a colour (WCAG luminance): the check on a chosen dot. */
function inkOn(color: Hex): string {
  const n = Number.parseInt(color.slice(1), 16);
  const linear = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * linear((n >> 16) & 255) + 0.7152 * linear((n >> 8) & 255) + 0.0722 * linear(n & 255);
  return (luminance + 0.05) / 0.05 > 1.05 / (luminance + 0.05) ? '#111111' : '#ffffff';
}

/** Colour dots, six a row on a phone and twelve on a wide panel (the highlights under the accents, column for column). */
function dots(
  colors: readonly (Hex | null)[],
  chosen: Hex | undefined,
  ctx: PanelContext,
  onPick: (color: Hex | undefined) => void,
): TemplateResult {
  return html`<div class="pn-dots">
    ${colors.map((color) => {
      const active = (color ?? undefined) === chosen;
      return html`<button
        class="pn-dot ${color ? '' : 'pn-dot--none'} ${active ? 'is-active' : ''}"
        data-target
        style=${color ? `--dot:${color};--dot-ink:${inkOn(color)}` : nothing}
        aria-label=${color ?? ctx.t('custom.none')}
        aria-pressed=${active ? 'true' : 'false'}
        @click=${() => onPick(color ?? undefined)}
      >
        ${active ? icon('check') : color ? nothing : icon('ban')}
      </button>`;
    })}
  </div>`;
}

/** "#FF4A1A", "ff4a1a" → "#ff4a1a"; anything else → undefined. */
function hexOf(text: string): Hex | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(text.trim());
  return match ? `#${(match[1] ?? '').toLowerCase()}` : undefined;
}

/** Any colour: typed as a hex in our own field, or picked from the system's well behind its swatch. */
function hexField(value: Hex, ctx: PanelContext, onColor: (color: Hex) => void): TemplateResult {
  return html`<div class="fv-field pn-hex">
    <input
      class="fv-field__input pn-hex__input"
      type="text"
      spellcheck="false"
      autocomplete="off"
      maxlength="7"
      aria-label=${ctx.t('custom.hex')}
      .value=${value}
      @change=${(event: Event) => {
        const input = event.target as HTMLInputElement;
        const color = hexOf(input.value);
        if (color) onColor(color);
        else input.value = value;
      }}
    />
    <label class="pn-hex__well" style="--dot:${value}" title=${ctx.t('custom.pick')}>
      <input
        type="color"
        .value=${value}
        aria-label=${ctx.t('custom.pick')}
        @change=${(event: Event) => {
          const color = hexOf((event.target as HTMLInputElement).value);
          if (color) onColor(color);
        }}
      />
    </label>
  </div>`;
}

function customEditor(custom: CustomPalette, ctx: PanelContext): TemplateResult {
  const set = (patch: Partial<CustomPalette>): void => {
    const next = parsePalette({ ...custom, ...patch });
    if (next) ctx.setDraft({ palette: next });
  };
  const vivid = custom.character === 'vivid';
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'drop', title: ctx.t('custom.title'), sub: ctx.t('custom.sub') })}
    <p class="fv-label pn-label">${ctx.t('custom.character')}</p>
    ${choice(
      [
        { key: 'soft', label: ctx.t('custom.soft'), active: !vivid },
        { key: 'vivid', label: ctx.t('custom.vivid'), active: vivid },
      ],
      (key) => {
        const character = key as CustomPalette['character'];
        // a listed accent keeps its place in the other style's list
        set({ character, accent: accentFor(custom.accent, character) });
      },
    )}
    <p class="fv-label pn-label">${ctx.t('custom.base')}</p>
    ${choice(
      CUSTOM_BASES.map((base) => ({
        key: base,
        label: ctx.t(`custom.${base}` as StringKey),
        active: custom.base === base,
      })),
      (key) => set({ base: key as CustomPalette['base'] }),
    )}
    ${
      vivid
        ? html`<p class="fv-label pn-label">${ctx.t('custom.fill')}</p>
            ${choice(
              [
                {
                  key: 'tint',
                  label: ctx.t('custom.tint'),
                  active: (custom.fill ?? 'tint') === 'tint',
                },
                { key: 'solid', label: ctx.t('custom.solid'), active: custom.fill === 'solid' },
              ],
              (key) => set({ fill: key as FillStyle }),
            )}`
        : nothing
    }
    <p class="fv-label pn-label">${ctx.t('custom.accent')}</p>
    ${dots(ACCENTS[custom.character], custom.accent, ctx, (accent) => accent && set({ accent }))}
    ${hexField(custom.accent, ctx, (accent) => set({ accent }))}
    ${
      vivid
        ? html`<p class="fv-label pn-label">${ctx.t('custom.highlight')}</p>
            <p class="pn-hint">${ctx.t('custom.highlight_sub')}</p>
            ${dots([null, ...HIGHLIGHTS], custom.highlight, ctx, (highlight) => {
              // a palette without a highlight carries none (not an empty one)
              const next: CustomPalette = {
                character: custom.character,
                base: custom.base,
                accent: custom.accent,
                ...(custom.fill ? { fill: custom.fill } : {}),
                ...(highlight ? { highlight } : {}),
              };
              ctx.setDraft({ palette: next });
            })}`
        : nothing
    }
  </section>`;
}

const SHAPE_GLYPH: Readonly<Record<ShapeName, string>> = {
  soft: 'shapeSoft',
  round: 'shapeRound',
  crisp: 'shapeCrisp',
};
const SHAPE_SIZES: Readonly<Record<ShapeName, string>> = {
  soft: '20 · 16 · 12',
  round: '28 · 22 · 16',
  crisp: '14 · 12 · 8',
};
const PILL_GLYPH: Readonly<Record<PillName, string>> = {
  round: 'pillRound',
  soft: 'pillSoft',
  crisp: 'pillCrisp',
};

/** The look on the real cards, and the switch that tries it on the whole app. */
export function appearancePreview(ctx: PanelContext, preview: TemplateResult): TemplateResult {
  return html`<section class="fv-card pn-card pn-card--preview">
    ${head({ icon: 'eye', title: ctx.t('preview.title'), sub: ctx.t('preview.sub') })} ${preview}
    <div class="pn-rows">
      ${listRow({
        icon: 'expand',
        title: ctx.t('preview.app'),
        sub: ctx.t('preview.app_sub'),
        trailing: 'switch',
        on: ctx.tryOnApp,
        onToggle: (on) => ctx.setTryOnApp(on),
      })}
    </div>
  </section>`;
}

/** The automatic dashboard's cards as its options draw them. */
export function dashboardPreview(ctx: PanelContext, preview: TemplateResult): TemplateResult {
  return html`<section class="fv-card pn-card pn-card--preview">
    ${head({ icon: 'eye', title: ctx.t('preview.title'), sub: ctx.t('dashboard.preview_sub') })}
    ${preview}
  </section>`;
}

export function appearance(ctx: PanelContext): TemplateResult {
  const { settings } = ctx;
  const palette = ctx.draft.palette;
  return html`<section class="fv-card pn-card">
      ${head({
        icon: 'palette',
        title: ctx.t('palette.title'),
        sub: settings.personalLook ? ctx.t('palette.own') : ctx.t('palette.house'),
      })}
      ${gallery(ctx)}
    </section>
    ${isCustom(palette) ? customEditor(palette, ctx) : nothing}
    <section class="fv-card pn-card">
      ${head({ icon: SHAPE_GLYPH[ctx.draft.shape], title: ctx.t('shape.title'), sub: ctx.t('shape.sub') })}
      ${options(
        SHAPE_NAMES.map((shape) => ({
          key: shape,
          glyph: SHAPE_GLYPH[shape],
          label: SHAPE_SIZES[shape],
          value: ctx.t(`shape.${shape}` as StringKey),
          active: ctx.draft.shape === shape,
        })),
        (key) => ctx.setDraft({ shape: key as ShapeName }),
        gap(ctx),
      )}
    </section>
    <section class="fv-card pn-card">
      ${head({ icon: PILL_GLYPH[ctx.draft.pills], title: ctx.t('pills.title'), sub: ctx.t('pills.sub') })}
      ${options(
        PILL_NAMES.map((pills) => ({
          key: pills,
          glyph: PILL_GLYPH[pills],
          label: ctx.t(`pills.size_${pills}` as StringKey),
          value: ctx.t(`pills.${pills}` as StringKey),
          active: ctx.draft.pills === pills,
        })),
        (key) => ctx.setDraft({ pills: key as PillName }),
        gap(ctx),
      )}
    </section>
    ${
      settings.personalLook
        ? html`<section class="fv-card pn-card pn-rows">
            ${listRow({
              icon: 'home',
              title: ctx.t('apply.back'),
              sub: ctx.t('apply.back_sub'),
              // it acts at once (it opens nothing): no chevron
              trailing: 'none',
              onTap: () =>
                ctx.run(() =>
                  ctx.handle.store.savePersonal({
                    palette: undefined,
                    shape: undefined,
                    pills: undefined,
                  }),
                ),
            })}
          </section>`
        : nothing
    }`;
}

/* ---------- scope ---------- */

/**
 * The theme Home Assistant wears for this person: Fluvy (from their profile, or the house's default theme), or
 * another one (`other`, by its name) — which then keeps every Home Assistant page, Fluvy staying on its dashboards.
 */
export interface ThemeInUse {
  readonly source: 'profile' | 'house' | 'other';
  /** The other theme's name, as the profile lists it. */
  readonly name?: string;
  /** Home Assistant's own way to the other theme: back to the default one, or to Fluvy. */
  leave(): void;
}

/**
 * Only on dashboards cannot hold while Home Assistant's own theme is Fluvy: every page would still wear it. Said
 * where the choice is made, with the way back (a person's own profile; the house's default theme is an
 * administrator's).
 */
function themeNote(ctx: PanelContext, theme: ThemeInUse): TemplateResult {
  const other = theme.source === 'other';
  const profile = theme.source === 'profile';
  const can = other || profile || ctx.admin;
  const title = other ? 'scope.theme_other' : profile ? 'scope.theme_profile' : 'scope.theme_house';
  const text = other
    ? ctx.t('scope.theme_other_sub', { theme: theme.name ?? '' })
    : ctx.t(
        profile
          ? 'scope.theme_profile_sub'
          : ctx.admin
            ? 'scope.theme_house_sub'
            : 'scope.theme_house_guest',
      );
  return html`<section class="fv-card pn-card pn-note">
    ${head({ icon: 'warn', tone: 'warning', title: ctx.t(title) })}
    <p class="pn-note__text">${text}</p>
    ${
      can
        ? html`<div class="pn-pair" data-fill-row>
            <button class="fv-btn fv-btn--quiet" data-target @click=${theme.leave}>
              ${ctx.t(other ? 'scope.theme_use_fluvy' : profile ? 'scope.theme_use' : 'scope.theme_use_ha')}
            </button>
          </div>`
        : nothing
    }
  </section>`;
}

export function scope(ctx: PanelContext, theme: ThemeInUse | null): TemplateResult {
  const { shown, admin } = ctx;
  const pick = admin ? (key: string) => ctx.editHouse({ scope: key as Scope }) : null;
  const listed = ctx.dashboards;
  const worn = (urlPath: string): boolean => wearsLook(shown, urlPath);
  const toggleDashboard = (urlPath: string, on: boolean): void => {
    // the implicit set (every fluvy dashboard) becomes an explicit list the first time one is changed
    const current = shown.dashboards.length
      ? shown.dashboards
      : listed.map((d) => d.urlPath).filter((path) => worn(path));
    const next = on
      ? [...new Set([...current, urlPath])]
      : current.filter((path) => path !== urlPath);
    ctx.editHouse({ dashboards: next });
  };
  return html`<section class="fv-card pn-card">
      ${head({ icon: 'globe', title: ctx.t('scope.title'), ...(admin ? {} : { sub: ctx.t('scope.admin_only') }) })}
      ${options(
        [
          {
            key: 'dashboards',
            glyph: 'grid',
            label: ctx.t('scope.only'),
            value: ctx.t('scope.dashboards'),
            active: shown.scope === 'dashboards',
          },
          {
            key: 'everywhere',
            glyph: 'ha',
            label: ctx.t('scope.everywhere'),
            value: ctx.t('scope.ha'),
            active: shown.scope === 'everywhere',
          },
        ],
        pick,
        gap(ctx),
      )}
      ${
        // the frame, the menus' icons and the Activity page belong to the whole app: offered where the look reaches it
        shown.scope === 'everywhere'
          ? html`<div class="pn-rows">
              ${listRow({
                icon: 'frame',
                title: ctx.t('scope.frame'),
                sub: ctx.t('scope.frame_sub'),
                trailing: 'switch',
                on: shown.frame,
                readonly: !admin,
                onToggle: (on) => ctx.editHouse({ frame: on }),
              })}
              ${listRow({
                icon: 'grid',
                title: ctx.t('scope.icons'),
                sub: ctx.t('scope.icons_sub'),
                trailing: 'switch',
                on: shown.icons,
                readonly: !admin,
                onToggle: (on) => ctx.editHouse({ icons: on }),
              })}
              ${listRow({
                icon: 'clock',
                title: ctx.t('scope.activity'),
                sub: ctx.t('scope.activity_sub'),
                trailing: 'switch',
                on: shown.activity,
                readonly: !admin,
                onToggle: (on) => ctx.editHouse({ activity: on }),
              })}
              ${listRow({
                icon: 'chart',
                title: ctx.t('scope.history'),
                sub: ctx.t('scope.history_sub'),
                trailing: 'switch',
                on: shown.history,
                readonly: !admin,
                onToggle: (on) => ctx.editHouse({ history: on }),
              })}
            </div>`
          : nothing
      }
    </section>
    ${
      // Fluvy's own theme defeats "only dashboards"; another theme keeps "everywhere" to Fluvy's dashboards
      theme && (theme.source === 'other') === (shown.scope === 'everywhere')
        ? themeNote(ctx, theme)
        : nothing
    }
    ${
      shown.scope === 'dashboards'
        ? html`<section class="fv-card pn-card">
            ${head({
              icon: 'grid',
              title: ctx.t('scope.list'),
              sub: shown.dashboards.length
                ? ctx.t('scope.list_chosen', { n: shown.dashboards.length })
                : ctx.t('scope.list_auto'),
            })}
            <div class="pn-rows">
              ${listed.map((d) =>
                listRow({
                  icon: d.icon ?? 'grid',
                  title: d.title,
                  sub: `/${d.urlPath}`,
                  trailing: 'switch',
                  on: worn(d.urlPath),
                  readonly: !admin,
                  onToggle: (on) => toggleDashboard(d.urlPath, on),
                }),
              )}
            </div>
          </section>`
        : nothing
    }`;
}

/* ---------- the automatic dashboard ---------- */

/** One choice of the dashboard's cards: the default writes nothing (the key goes). */
function styleChoice(
  ctx: PanelContext,
  key: string,
  current: unknown,
  choices: readonly { readonly value: string; readonly label: StringKey }[],
): TemplateResult {
  const [fallback] = choices;
  const chosen = typeof current === 'string' ? current : fallback?.value;
  return choice(
    choices.map((option) => ({
      key: option.value,
      label: ctx.t(option.label),
      active: chosen === option.value,
    })),
    ctx.admin
      ? (value) => ctx.editStrategy({ [key]: value === fallback?.value ? undefined : value })
      : null,
  );
}

export interface DashboardActions {
  create(): void;
  open(urlPath: string): void;
  /** Lists the automatic dashboard in Home Assistant's sidebar, or not. */
  showInSidebar(on: boolean): void;
  /** The automatic dashboard is being created: the row says so and does not take a second tap. */
  readonly creating: boolean;
}

export function dashboard(
  ctx: PanelContext,
  views: readonly { readonly key: string; readonly title: string; readonly icon: string }[],
  actions: DashboardActions,
): TemplateResult {
  const auto = ctx.dashboards.find((d) => d.strategy);
  const strategy = ctx.strategy ?? {};
  const hidden = new Set(Array.isArray(strategy['hide']) ? (strategy['hide'] as string[]) : []);
  return html`<section class="fv-card pn-card">
      ${head({ icon: 'grid', title: ctx.t('dashboard.title'), sub: ctx.t('dashboard.sub') })}
      ${
        auto
          ? html`<div class="pn-rows">
              ${listRow({
                icon: auto.icon ?? 'fluvy:sun',
                tone: 'accent',
                title: auto.title,
                sub: `/${auto.urlPath}`,
                trailing: 'chevron',
                onTap: () => actions.open(auto.urlPath),
              })}
              ${
                ctx.admin && auto.id
                  ? listRow({
                      icon: 'menu',
                      title: ctx.t('dashboard.sidebar'),
                      sub: ctx.t('dashboard.sidebar_sub'),
                      trailing: 'switch',
                      on: auto.inSidebar ?? false,
                      onToggle: (on) => actions.showInSidebar(on),
                    })
                  : nothing
              }
            </div>`
          : ctx.admin
            ? html`<div class="pn-rows">
                ${listRow({
                  icon: actions.creating ? 'auto' : 'plus',
                  tone: 'accent',
                  title: ctx.t(actions.creating ? 'dashboard.creating' : 'dashboard.create'),
                  sub: ctx.t('dashboard.create_sub'),
                  // it acts at once (it opens nothing): no chevron
                  trailing: 'none',
                  onTap: actions.creating ? undefined : actions.create,
                })}
              </div>`
            : emptyState('grid', ctx.t('dashboard.missing'))
      }
    </section>
    ${
      auto
        ? html`<section class="fv-card pn-card">
              ${head({ icon: 'list', title: ctx.t('dashboard.views'), ...(ctx.admin ? {} : { sub: ctx.t('scope.admin_only') }) })}
              <div class="pn-rows">
                ${views.map((view) =>
                  view.key === 'home'
                    ? listRow({
                        icon: view.icon,
                        title: view.title,
                        trailing: 'value',
                        value: ctx.t('dashboard.always'),
                      })
                    : listRow({
                        icon: view.icon,
                        title: view.title,
                        trailing: 'switch',
                        on: !hidden.has(view.key),
                        readonly: !ctx.admin,
                        onToggle: (on) => {
                          const hide = on
                            ? [...hidden].filter((key) => key !== view.key)
                            : [...hidden, view.key];
                          ctx.editStrategy({ hide: hide.length ? hide : undefined });
                        },
                      }),
                )}
              </div>
            </section>
            <section class="fv-card pn-card">
              ${head({ icon: 'sliders', title: ctx.t('dashboard.cards'), sub: ctx.t(ctx.admin ? 'dashboard.cards_sub' : 'scope.admin_only') })}
              <p class="fv-label pn-label">${ctx.t('dashboard.thermostat')}</p>
              ${styleChoice(ctx, 'thermostat_variant', strategy['thermostat_variant'], [
                { value: 'dial', label: 'dashboard.dial' },
                { value: 'compact', label: 'dashboard.compact' },
                { value: 'ruler', label: 'dashboard.ruler' },
              ])}
              <p class="fv-label pn-label">${ctx.t('dashboard.tiles')}</p>
              ${styleChoice(ctx, 'tile_size', strategy['tile_size'], [
                { value: 'large', label: 'dashboard.large' },
                { value: 'compact', label: 'dashboard.rows' },
              ])}
              <p class="fv-label pn-label">${ctx.t('dashboard.flow')}</p>
              ${styleChoice(ctx, 'flow_style', strategy['flow_style'], [
                { value: 'ribbons', label: 'dashboard.ribbons' },
                { value: 'rail', label: 'dashboard.rail' },
                { value: 'legs', label: 'dashboard.legs' },
              ])}
            </section>`
        : nothing
    }`;
}

/* ---------- preferences ---------- */

export function preferences(ctx: PanelContext): TemplateResult {
  const { shown } = ctx;
  return html`<section class="fv-card pn-card">
    ${head({ icon: 'person', title: ctx.t('pref.title'), sub: ctx.t('pref.sub') })}
    <p class="fv-label pn-label">${ctx.t('pref.language')}</p>
    ${choice(
      [
        { key: 'auto', label: ctx.t('pref.auto'), active: shown.language === 'auto' },
        ...offeredLanguages().map((language) => ({
          key: language.code,
          label: language.name,
          active: shown.language === language.code,
        })),
      ],
      (key) => ctx.editPersonal({ language: key as CardLanguage }),
    )}
    <div class="pn-rows">
      ${listRow({
        icon: 'motion',
        title: ctx.t('pref.reduce'),
        sub: ctx.t('pref.reduce_sub'),
        trailing: 'switch',
        on: shown.motion === 'reduced',
        onToggle: (on) => ctx.editPersonal({ motion: on ? 'reduced' : 'system' }),
      })}
      ${listRow({
        icon: 'haptic',
        title: ctx.t('pref.haptics'),
        sub: ctx.t('pref.haptics_sub'),
        trailing: 'switch',
        on: shown.haptics,
        onToggle: (on) => ctx.editPersonal({ haptics: on }),
      })}
      ${listRow({
        icon: 'clock',
        title: ctx.t('pref.activity_card'),
        sub: ctx.t('pref.activity_card_sub'),
        trailing: 'switch',
        on: shown.activityCard,
        onToggle: (on) => ctx.editPersonal({ activityCard: on }),
      })}
    </div>
  </section>`;
}

/* ---------- about ---------- */

export interface AboutInfo {
  readonly version: string;
  readonly shell: { readonly styled: number; readonly total: number } | null;
}

export interface AboutActions {
  exportSettings(): void;
  importSettings(file: File): void;
  reset(): void;
  readonly resetArmed: boolean;
}

export function about(ctx: PanelContext, info: AboutInfo, actions: AboutActions): TemplateResult {
  const defaults = lookTitle(
    { palette: HOUSE_DEFAULTS.palette, shape: HOUSE_DEFAULTS.shape, pills: HOUSE_DEFAULTS.pills },
    ctx.t,
  );
  const armed = actions.resetArmed;
  return html`<section class="fv-card pn-card">
      ${head({ icon: 'info', title: ctx.t('about.title'), sub: ctx.t('about.version', { version: info.version || '—' }) })}
      <div class="pn-rows">
        ${listRow({ icon: 'palette', title: ctx.t('about.look'), trailing: 'value', value: lookTitle(ctx.settings.look, ctx.t) })}
        ${listRow({
          icon: 'ha',
          title: ctx.t('about.shell'),
          sub: info.shell
            ? ctx.t('about.shell_value', { styled: info.shell.styled, total: info.shell.total })
            : ctx.t('about.shell_off'),
          trailing: 'none',
        })}
      </div>
    </section>
    <section class="fv-card pn-card">
      ${head({ icon: 'download', title: ctx.t('about.file'), sub: ctx.t('about.file_sub') })}
      <div class="pn-pair" data-fill-row>
        <button class="fv-btn fv-btn--quiet" data-target @click=${actions.exportSettings}>
          ${ctx.t('about.export')}
        </button>
        ${
          ctx.admin
            ? html`<label class="fv-btn fv-btn--quiet pn-file" data-target>
                ${ctx.t('about.import')}
                <input
                  type="file"
                  accept="application/json"
                  @change=${(event: Event) => {
                    const input = event.target as HTMLInputElement;
                    const file = input.files?.[0];
                    if (file) actions.importSettings(file);
                    input.value = '';
                  }}
                />
              </label>`
            : nothing
        }
      </div>
    </section>
    ${
      ctx.admin
        ? html`<section class="fv-card pn-card pn-rows ${armed ? 'is-armed' : ''}">
            ${listRow({
              icon: 'auto',
              tone: armed ? 'warning' : 'neutral',
              title: armed ? ctx.t('about.reset_armed') : ctx.t('about.reset'),
              sub: armed
                ? ctx.t('about.reset_cancels')
                : ctx.t('about.reset_sub', {
                    look: defaults,
                    scope: ctx.t(
                      HOUSE_DEFAULTS.scope === 'everywhere'
                        ? 'scope.summary_everywhere'
                        : 'scope.summary_dashboards',
                    ),
                  }),
              trailing: 'none',
              onTap: actions.reset,
            })}
          </section>`
        : nothing
    }`;
}
