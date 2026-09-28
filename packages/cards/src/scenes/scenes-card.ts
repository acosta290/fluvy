import {
  stateText,
  strings,
  toggleEntity,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { ico, linesNeeded, sheetStyles } from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { agoShort } from '../helpers/datetime.js';

import { Card } from '../shared/base.js';

import { glyphFor } from '../shared/domain.js';

import { TextRuler } from '../shared/fit.js';

import { FontsSettled } from '../shared/fonts.js';

import { entityField, formLabels, nameIconFields, textField } from '../shared/form.js';
import { listsEditor } from '../shared/rows-editor.js';

const s = strings('scenes');

export interface SceneItemConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** The second line ("All off", "Lock & arm"). Defaults to what the scene touches, else when it last ran. */
  meta?: string;
}

export interface ScenesCardConfig extends FluvyCardConfig {
  /** A section title above the tiles (the heading card's face). */
  title?: string;
  /** The object form, for a per-scene `name`, `icon` and `meta`. Wins over `entities`. */
  scenes?: ReadonlyArray<string | SceneItemConfig>;
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
/** The tiles' grid gap, and a tile's padding (16 + 16), circle (44) and circle-to-text gap (12). */
const GRID_GAP = 16;
const TILE_CHROME = 88;

export class FluvyScenesCard extends Card<ScenesCardConfig> {
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
      button.fv-tile--off {
        width: 100%;
        text-align: left;
      }
    `,
  ];

  static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        textField('title'),
        {
          name: 'entities',
          required: true,
          selector: {
            entity: {
              multiple: true,
              domain: ['scene', 'script', 'button', 'input_button', 'automation'],
            },
          },
        },
      ],
      ...formLabels({ title: 'editor.title', entities: 'editor.entities' }),
    };
  }

  /** The visual editor: the card's own fields, then one form per item — a name, an icon, a tone, whatever the item may carry. */
  static getConfigElement(): HTMLElement {
    return listsEditor(this.getConfigForm(), [
      {
        key: 'scenes',
        alias: 'entities',
        title: 'editor.scenes',
        domains: ['scene', 'script', 'button', 'input_button', 'automation'],
        schema: [
          entityField(['scene', 'script', 'button', 'input_button', 'automation']),
          nameIconFields(),
          textField('meta'),
        ],
      },
    ]);
  }

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
   * Two tiles a row (164 wide at the least) while every name reads in its two lines there; one a row
   * when a name would not ("Encender Luz Porche & Patio" in a 352 column), rather than cutting it.
   */
  private columns(names: readonly string[]): 1 | 2 {
    if (this.width < 344) return 1;
    const room = (this.width - GRID_GAP) / 2 - TILE_CHROME; // a half tile, less its padding, circle and gap
    const fits = names.every(
      (name) => linesNeeded(name, room, (text) => this.ruler.width('fv-row__title', text)) <= 2,
    );
    return fits ? 2 : 1;
  }

  private items(): SceneItemConfig[] {
    const source = this.config?.scenes ?? this.config?.entities ?? [];
    return source
      .map((item) => (typeof item === 'string' ? { entity: item } : item))
      .filter((item) => Boolean(item.entity));
  }

  protected override prepare(config: ScenesCardConfig): ScenesCardConfig {
    if (!config.scenes?.length && !config.entities?.length)
      throw new Error('fluvy-scenes-card: add at least one scene');
    return config;
  }

  protected override watched(): readonly string[] {
    return this.items().map((item) => item.entity);
  }

  override getCardSize(): number {
    return Math.ceil(this.items().length / 2) * 2;
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
    if (item.meta !== undefined) return item.meta;
    const members = view.attr<readonly string[] | null>('entity_id');
    const count = Array.isArray(members) ? members.length : 0;
    if (count > 0)
      return count === 1 ? s(this.hass, 'device_one') : s(this.hass, 'devices', { count });
    return at > 0 ? agoShort(this.hass, new Date(at), now) : s(this.hass, 'never');
  }

  protected renderCard(): TemplateResult {
    const items = this.items();
    if (items.length === 0) return this.renderEmpty();
    const views = items.map((item) => this.entity(item.entity));
    const columns = this.columns(
      items.map((item, index) => item.name ?? (views[index] as EntityView).name),
    );
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    const now = frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();

    const fired = views.map((view) =>
      view.status === 'ok' || view.status === 'unknown' ? firedAt(view, this.stateOf(view)) : 0,
    );
    const newest = Math.max(0, ...fired);

    const title = this.config?.title;
    return html`<div class="am-scenes">
      ${
        title
          ? html`<div class="hm-section">
              <div class="hm-section__lead"><h2 class="hm-section__title">${title}</h2></div>
            </div>`
          : nothing
      }
      <div class="fv-grid2" style="--am-cols:${columns}">
        ${items.map((item, index) => {
          const view = views[index] as EntityView;
          const name = item.name ?? view.name;
          if (view.status === 'missing' || view.status === 'unavailable') {
            return html`<button
              class="fv-tile fv-tile--off fv-tile--tap"
              data-card
              data-target
              @click=${() => this.tap(view.id, { action: 'more-info' })}
            >
              ${ico('ban', 'off')}
              <span class="fv-row__text"
                ><span class="fv-row__title">${name}</span
                ><span class="fv-row__sub">${stateText(this.hass, view)}</span></span
              >
            </button>`;
          }
          const at = fired[index] ?? 0;
          const active = at > 0 && at === newest;
          const meta = this.meta(item, view, at, now);
          return html`<button
            class="fv-tile am-scene fv-tile--tap ${active ? 'is-on fv-tile--accent' : ''}"
            data-card
            data-target
            aria-pressed=${active ? 'true' : 'false'}
            @click=${() => this.run(view)}
          >
            ${ico(item.icon ?? view.attr<string | null>('icon') ?? glyphFor(view), active ? 'accent' : 'neutral')}
            <span class="fv-row__text">
              <span class="fv-row__title">${name}</span>
              ${meta ? html`<span class="fv-row__sub">${meta}</span>` : nothing}
            </span>
          </button>`;
        })}
      </div>
    </div>`;
  }
}
