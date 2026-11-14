import type { Tint } from '../shared/colour.js';
import {
  plural,
  stateText,
  strings,
  toggleEntity,
  type ActionConfig,
  type EntityName,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  clickPress,
  holdKey,
  ico,
  linesNeeded,
  preventMenu,
  sheetStyles,
  startPress,
} from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { agoShort } from '../helpers/datetime.js';

import { Card, MORE_INFO, type CardEditor, type Press } from '../shared/base.js';

import { iconOf } from '../shared/domain.js';

import { TextRuler } from '../shared/fit.js';
import type { SceneChip } from '../shared/groups.js';

import { FontsSettled } from '../shared/fonts.js';
import { columnsOf, ITEM_ALIASES, type AliasSpec, type Columns } from '../shared/config.js';
import { chipRows, EMPTY, rowsOf, textWidth, type NameOf } from '../shared/heights.js';
import {
  asksGroups,
  emptyPanel,
  groupsHeight,
  groupsModule,
  groupsOf,
  itemsOf,
  listOf,
  type EmptyList,
  type Group,
  type Grouped,
  type SectionEntry,
} from '../shared/lists.js';

const s = strings('scenes');

export interface SceneItemConfig {
  entity: string;
  name?: EntityName;
  icon?: string;
  /** The second line ("All off", "Lock & arm"). Defaults to what the scene touches, else when it last ran. */
  subtitle?: string;
  /** What a tap does instead of running the scene. */
  tap_action?: ActionConfig;
  /** A still press and two taps on it: the card's where it names none (its details; a double tap none, #179). */
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
  /** The scene's own colour (a Home Assistant colour name or `#rrggbb`): its tile's when it is the last run. */
  color?: string;
}

export interface ScenesCardConfig extends FluvyCardConfig, EmptyList, Grouped {
  /** A section title above the tiles (the heading card's face). */
  title?: string;
  /**
   * The object form, for a per-scene `name`, `icon`, `subtitle` and `tap_action`. Wins over `entities`. A section
   * among them (`- section: Kitchen`) labels the scenes after it (#189).
   */
  scenes?: ReadonlyArray<string | SceneItemConfig | SectionEntry>;
  /**
   * `tiles` (default): a 76 tile a scene. `chips`: the scenes as pills that fill their rows on one card, the last run
   * one filled (#189).
   */
  variant?: 'tiles' | 'chips';
  /** `auto` (default): two a row while every name fits its two lines; `1` or `2` to say so (two at most). */
  columns?: Columns;
  /** `always`: every tile shows its colour at rest too — a wash and its hairline (`on`, the default: the last run). */
  tint?: Tint;
  /** Test hook: an ISO date that freezes "now" (the "applied … ago" lines). Undocumented. */
  _now?: string;
}

/**
 * When it last ran: scenes and buttons keep that in their state, scripts and automations in an
 * attribute. `state` is the one on screen — a press expects "now" there, whatever the domain — so the
 * later of the two is the answer for every kind.
 */
function firedAt(view: EntityView, state: string): number {
  const fromState = Date.parse(state);
  const fromAttr = Date.parse(view.attr<string | null>('last_triggered') ?? '');
  return Math.max(
    Number.isFinite(fromState) ? fromState : 0,
    Number.isFinite(fromAttr) ? fromAttr : 0,
  );
}

/**
 * Scenes as the sheet's 2-up tiles: a 76 tall button each — the glyph in its circle, the name and
 * what the scene touches. A scene has no "on", only a last time it was applied: the one applied
 * most recently carries the accent fill (the sheet's one active tile), and a press fills its tile at once (optimistic) while the
 * call is on its way.
 */
/** A tile's height, the tiles' grid gap, and a tile's padding (16 + 16), circle (44) and circle-to-text gap (12). */
const TILE = 76;
const GRID_GAP = 16;
const TILE_CHROME = 88;

/** A word of a script whose words run together (kana, kanji, hangul): a line may end anywhere inside it. */
const RUNS_TOGETHER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/**
 * Whether a name reads in a tile's two lines at `room`. In groups (`whole`), where names are short and often one
 * word, each word must hold a line too: one wider than it would end a line inside itself ("Concentrat-e"), and the
 * card draws one tile a row instead. A list without groups reads as 1.20 did.
 */
const reads = (
  name: string,
  room: number,
  measure: (text: string) => number,
  whole: boolean,
): boolean =>
  linesNeeded(name, room, measure) <= 2 &&
  (!whole ||
    (name.match(/[^\s-]*-(?=\S)|\S+/g) ?? []).every(
      (word) => RUNS_TOGETHER.test(word) || measure(word) <= room,
    ));

/**
 * The card's height at a 360 column from its config: its scenes in the groups its own sections make of them, or in
 * `groups` — the house's, where the config asks for them and whoever counts has read the house (`house-heights.ts`,
 * which says each scene's name too: `nameOf`, what a row of chips is laid out by).
 */
export function scenesHeight(
  config: ScenesCardConfig,
  nameOf: NameOf = () => undefined,
  groups: readonly Group<SceneItemConfig>[] = groupsOf(config.scenes ?? config.entities),
): number {
  const head = config.title ? 40 : 0;
  // no scenes: the empty panel where they would be
  if (!groups.length) return head + EMPTY;
  // a name the config gives, else the house's, else the id's own words
  const names = ({ items }: Group<SceneItemConfig>): string[] =>
    items.map(({ entity, name }) =>
      String(
        (typeof name === 'string' ? name : nameOf(entity)) ??
          entity.slice(entity.indexOf('.') + 1).replace(/_/g, ' '),
      ),
    );
  // as chips: the card's 20 round each group's rows of 44, its label over them
  if (config.variant === 'chips')
    return (
      head +
      40 +
      groups.reduce((height, group) => height + chipRows(names(group)) * 44, 0) +
      groupsHeight(groups, 16)
    );
  const asked = columnsOf(config.columns, 'auto');
  // two a row, unless asked one, or a name the config gives would not read in its two lines on a half tile at 360
  // (the card's own rule, `columns`, estimated: a title is 15/600)
  const half = (360 - GRID_GAP) / 2 - TILE_CHROME;
  const whole = groups.some(({ label }) => label);
  const long =
    asked === 'auto' &&
    groups.some(({ items }) =>
      items.some(
        ({ name }) =>
          typeof name === 'string' &&
          !reads(name, half, (text) => textWidth(text, 'title') * (15 / 16), whole),
      ),
    );
  const perRow = asked === 1 || long ? 1 : 2;
  // each group's tiles start a row of their own, under its label
  return (
    head +
    groups.reduce(
      (height, { items }) => height + rowsOf(items.length, perRow) * (TILE + GRID_GAP) - GRID_GAP,
      0,
    ) +
    groupsHeight(groups, GRID_GAP)
  );
}

export class FluvyScenesCard extends Card<ScenesCardConfig> {
  /** The card's height at a 360 column, for the automatic dashboard's columns. */
  static override layoutHeight(config: ScenesCardConfig): number {
    return scenesHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.ambient,
    sheetStyles.home,
    css`
      /* the lab fixes the sheet at 360; a dashboard column decides here */
      .am-scenes {
        width: 100%;
      }
      .am-scenes .hm-section {
        margin: 0 0 16px;
      }
      .hm-section__title {
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* a scene's name takes two lines before it gives way ("Encender Luz Porche & Patio") */
      .am-scene .fv-row__title {
        white-space: normal;
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow-wrap: anywhere;
      }
      .fv-grid2 {
        grid-template-columns: repeat(var(--am-cols, 2), minmax(0, 1fr));
      }
      .am-scene .fv-row__text {
        min-width: 0;
      }
      /* as chips: a group's first row under its label (or the card's edge), the next label 16 under the rows */
      .am-chips > .fv-group {
        margin: 16px 0 0;
      }
      .am-chips > :first-child {
        margin-top: 0;
      }
    `,
  ];

  static override editor(): Promise<CardEditor> {
    return import('./scenes-editor.js');
  }
  static override aliases: AliasSpec = { items: { scenes: ITEM_ALIASES } };

  static getStubConfig(_hass: unknown, entities: readonly string[]): ScenesCardConfig {
    return {
      type: 'custom:fluvy-scenes-card',
      entities: entities.filter((id) => id.startsWith('scene.')).slice(0, 4),
    };
  }

  private readonly ruler = new TextRuler(() => this.renderRoot as ParentNode | undefined);

  constructor() {
    super();
    new FontsSettled(this, () => {
      this.ruler.clear();
      this.requestUpdate();
    });
  }

  /**
   * Two tiles a row (164 wide at the least) while every name reads in its two lines there (`reads`: in groups,
   * `whole`, its words whole too); one a row when a name would not ("Encender Luz Porche & Patio" in a 352 column),
   * rather than cutting it.
   */
  private columns(names: readonly string[], whole: boolean): 1 | 2 {
    const asked = columnsOf(this.config?.columns, 'auto');
    if (asked === 1 || this.width < 344) return 1;
    if (asked !== 'auto') return 2;
    const room = (this.width - GRID_GAP) / 2 - TILE_CHROME; // a half tile, less its padding, circle and gap
    const fits = names.every((name) =>
      reads(name, room, (text) => this.ruler.width('fv-row__title', text), whole),
    );
    return fits ? 2 : 1;
  }

  /** The config's list: its scenes and the sections among them. */
  private list(): readonly unknown[] | undefined {
    return this.config?.scenes ?? this.config?.entities;
  }

  private items(): SceneItemConfig[] {
    return itemsOf(this.list());
  }

  protected override prepare(config: ScenesCardConfig): ScenesCardConfig {
    listOf(config, 'scenes', ['entities']);
    return config;
  }

  protected override watched(): readonly string[] {
    return this.items().map((item) => item.entity);
  }

  override getCardSize(): number {
    return Math.max(1, Math.ceil(this.items().length / 2)) * 2;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private run(view: EntityView): void {
    if (!this.hass) return;
    this.expect(view.id, new Date().toISOString()); // the newest "applied" is this one, now
    if (view.domain === 'automation')
      this.call('automation', 'trigger', {}, view.id); // `toggleEntity` would switch the automation off
    else void toggleEntity(this.hass, view.id);
  }

  private meta(item: SceneItemConfig, view: EntityView, at: number, now: Date): string {
    if (item.subtitle !== undefined) return item.subtitle;
    const members = view.attr<readonly string[] | null>('entity_id');
    const count = Array.isArray(members) ? members.length : 0;
    if (count > 0) return plural(this.hass, 'scenes.devices', count, { count });
    return at > 0 ? agoShort(this.hass, new Date(at), now) : s(this.hass, 'never');
  }

  /** What a scene answers: a tap runs it, or is its own; a still press and two taps its own, else the card's (#179). */
  private press(item: SceneItemConfig, view: EntityView): Press {
    return this.pressOf(
      {
        hold_action: this.config?.hold_action,
        double_tap_action: this.config?.double_tap_action,
        ...item,
      },
      view.id,
      () => this.run(view),
    );
  }

  /**
   * A scene as its chip (`variant: chips`): its name — the config's own glyph before it, where it gives one — on the
   * accent's fill while it is the last run (`active`), in its own colour where it has one; out of reach, the dashed
   * ring, which takes no tap (a still press opens its details).
   */
  private chip(item: SceneItemConfig, view: EntityView, active: boolean): SceneChip {
    const gone = view.status === 'missing' || view.status === 'unavailable';
    const accent = this.accents.item(item.color);
    const { onTap, onHold }: Press = gone
      ? { onHold: () => this.tap(view.id, MORE_INFO) }
      : this.press(item, view);
    return {
      key: item.entity,
      label: this.nameFor(view, item.name),
      name: true,
      active,
      unavailable: gone,
      ...(item.icon ? { glyph: item.icon } : {}),
      ...(accent ? { accent, tone: 'accent' as const } : {}),
      ...(onTap ? { onTap } : {}),
      ...(onHold ? { onHold } : {}),
    };
  }

  /**
   * The scenes in the groups the config asks for (`Grouped`), each with its short name, laid out by their chunk —
   * which draws the chips too: none while it is on its way, and one group of them all where the config asks for
   * neither, or the chunk cannot be fetched (the scenes are tiles then).
   */
  protected renderCard(): TemplateResult {
    const items = this.items();
    // no scenes: the panel where their tiles would be, across the grid and on the page as they are
    const panel = emptyPanel(this, !items.length, 'moon', 'common.no_scenes', true);
    const asked = this.config?.variant === 'chips' || asksGroups(this.config, this.list());
    const module = asked ? groupsModule(this) : null;
    const groups: readonly Group<SceneItemConfig>[] =
      (module
        ? module.laidOut<SceneItemConfig>(this.hass, this.config ?? {}, this.list())
        : module === null && [{ label: '', items }]) || [];
    const drawn = groups.flatMap((group) => group.items);
    const views = new Map(items.map((item) => [item.entity, this.entity(item.entity)]));
    const viewOf = (item: SceneItemConfig): EntityView => views.get(item.entity) as EntityView;
    const firedOf = (item: SceneItemConfig): number => {
      const view = viewOf(item);
      return view.status === 'ok' || view.status === 'unknown'
        ? firedAt(view, this.stateOf(view))
        : 0;
    };
    const newest = Math.max(0, ...items.map(firedOf));
    const active = (item: SceneItemConfig): boolean => newest > 0 && firedOf(item) === newest;

    const title = this.config?.title;
    const head = title
      ? html`<div class="hm-section">
          <div class="hm-section__lead"><h2 class="hm-section__title">${title}</h2></div>
        </div>`
      : nothing;
    if (module && this.config?.variant === 'chips' && !panel)
      return html`<div class="am-scenes">
        ${head}
        ${module.sceneChips(
          groups.map((group) => ({
            label: group.label,
            items: group.items.map((item) => this.chip(item, viewOf(item), active(item))),
          })),
          // the card's 20 on each side
          { ruler: this.ruler, width: this.width - 40 },
        )}
      </div>`;

    const columns = panel
      ? 1
      : this.columns(
          drawn.map((item) => this.nameFor(viewOf(item), item.name)),
          groups.some(({ label }) => label),
        );
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    const now = frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
    // the line under a name only while it fits the tile's words column: a state is dropped, never cut
    const room = (columns === 2 ? (this.width - GRID_GAP) / 2 : this.width) - TILE_CHROME;
    const fitted = (line: string): string =>
      line && this.ruler.width('fv-row__sub', line) <= room ? line : '';

    return html`<div class="am-scenes">
      ${head}
      <div class="fv-grid2" style="--am-cols:${columns}">
        ${panel}
        ${groups.map(
          (group) =>
            html`${group.label ? html`<h3 class="fv-group" data-name>${group.label}</h3>` : nothing}
            ${group.items.map((item) => {
              const view = viewOf(item);
              const name = this.nameFor(view, item.name);
              if (view.status === 'missing' || view.status === 'unavailable') {
                const state = fitted(stateText(this.hass, view));
                // out of reach, the scene's own tile in the off skin: its name keeps its two lines
                return html`<button
                  class="fv-tile am-scene fv-tile--off fv-tile--tap"
                  data-card
                  data-target
                  @click=${() => this.tap(view.id, MORE_INFO)}
                >
                  ${this.looksQuiet ? ico(iconOf(view, item.icon), 'neutral') : ico('ban', 'off')}
                  <span class="fv-row__text"
                    ><span class="fv-row__title">${name}</span
                    >${state ? html`<span class="fv-row__sub">${state}</span>` : nothing}</span
                  >
                </button>`;
              }
              const on = active(item);
              const meta = fitted(this.meta(item, view, firedOf(item), now));
              // a coloured scene keeps its colour at rest when the card asks (the last run is on: its full fill)
              const tinted = this.config?.tint === 'always' && Boolean(item.color) && !on;
              const { onTap, onHold } = this.press(item, view);
              return html`<button
                class="fv-tile am-scene fv-tile--tap ${on ? 'is-on fv-tile--accent' : ''} ${
                  tinted ? 'is-tinted' : ''
                }"
                data-card
                data-target
                data-accent=${this.accents.item(item.color) ?? nothing}
                aria-pressed=${on ? 'true' : 'false'}
                .fvTap=${onTap}
                .fvHold=${onHold}
                @pointerdown=${startPress}
                @contextmenu=${preventMenu}
                @click=${clickPress}
                @keydown=${holdKey(onHold)}
              >
                ${ico(iconOf(view, item.icon), on || tinted ? 'accent' : 'neutral')}
                <span class="fv-row__text">
                  <span class="fv-row__title">${name}</span>
                  ${meta ? html`<span class="fv-row__sub">${meta}</span>` : nothing}
                </span>
              </button>`;
            })}`,
        )}
      </div>
    </div>`;
  }
}
