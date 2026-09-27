import {
  isActive,
  type ActionConfig,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { glyph, icon, sheetStyles } from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { Card } from '../shared/base.js';
import {
  actionField,
  entitiesField,
  fieldRow,
  formLabels,
  iconField,
  textField,
} from '../shared/form.js';
import { s } from './strings.js';

export interface HeadingCardConfig extends FluvyCardConfig {
  title?: string;
  /** Static text at the right ("Edit"). Wins over `entities`. */
  meta?: string;
  /** Counted instead: "2 of 4 on" while something is on, "4 devices" when nothing is. */
  entities?: readonly string[];
  /** Dashboard path the meta navigates to; it brings the chevron. `tap_action` does the same for any other action. */
  path?: string;
}

/**
 * A section heading on the page: the 20/600 title and a quiet meta at the right. Not a card
 * surface. With somewhere to go the meta becomes a button and gains the chevron, whose ink sits on
 * the column edge (the sheet's −5 optical margin: the chevron's ink ends 5 px inside its 16 box).
 *
 * Below other cards of its section the heading opens a new group: it sits 24 under them (the grid's
 * 16 + 8) and 16 above its own cards, as the sheet's section titles do. As the first card of a section
 * it keeps the column's top line, so the columns still start level.
 */
export class FluvyHeadingCard extends Card<HeadingCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.home,
    css`
      .hm-section {
        margin-top: 0;
        gap: 16px;
        animation: fv-enter 420ms var(--fv-ease-out) both;
        animation-delay: var(--fv-enter-delay, 0ms);
      }
      :host([follows]) .hm-section {
        margin-top: 8px;
      }
      .hm-section__title {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* the meta keeps its words; a title gives way first, and only a meta longer than half the row ellipsizes */
      .hm-section__meta {
        position: relative;
        flex: 0 0 auto;
        max-width: 60%;
        height: 24px;
        line-height: 24px;
        white-space: nowrap;
      }
      .hm-section__text {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hm-section__meta svg {
        transition: transform var(--fv-base) var(--fv-ease);
      }
      button.hm-section__meta {
        transition:
          color var(--fv-base) var(--fv-ease),
          opacity var(--fv-fast) var(--fv-ease);
      }
      /* the row is 24 tall; the finger gets 44 × (text + 24) around it */
      button.hm-section__meta::before {
        content: '';
        position: absolute;
        inset: -10px -12px;
      }
      button.hm-section__meta:active {
        opacity: 0.6;
      }
      button.hm-section__meta:focus-visible {
        outline-offset: 4px;
        border-radius: 4px;
      }
      @media (hover: hover) {
        button.hm-section__meta:hover {
          color: var(--fluvy-text);
        }
        button.hm-section__meta:hover svg {
          transform: translateX(2px);
        }
      }
    `,
  ];

  static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        fieldRow(textField('title'), iconField()),
        textField('meta'),
        entitiesField('entities'),
        textField('path'),
        actionField(),
      ],
      ...formLabels({
        meta: 'editor.subtitle',
      }),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): HeadingCardConfig {
    return {
      type: 'custom:fluvy-heading-card',
      title: 'Living room',
      entities: entities.filter((id) => /^(light|switch|fan|cover)\./.test(id)).slice(0, 4),
    };
  }

  protected override prepare(config: HeadingCardConfig): HeadingCardConfig {
    if (typeof config.title !== 'string' || config.title.trim() === '')
      throw new Error('fluvy-heading-card: "title" is required');
    return config;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    requestAnimationFrame(() => this.placeInSection());
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.placeInSection();
  }

  /** `follows` when a visible card comes before this one in its Home Assistant grid section (hidden cards do not count). */
  private placeInSection(): void {
    const cell = this.closest('.card');
    const root = cell?.getRootNode();
    const inGrid = root instanceof ShadowRoot && root.host.localName === 'hui-grid-section';
    let before = inGrid ? (cell?.previousElementSibling ?? null) : null;
    while (before && getComputedStyle(before).display === 'none')
      before = before.previousElementSibling;
    this.toggleAttribute('follows', before !== null);
  }

  override getCardSize(): number {
    return 1;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /** "2 of 4 on" while something is on, otherwise the plain count. Unreachable entities count as devices, never as on. */
  private counted(): string {
    const ids = this.config?.entities ?? [];
    if (ids.length === 0) return '';
    const on = ids.filter((id) => isActive(this.entity(id))).length;
    if (on > 0) return s(this.hass, 'on_of', { on, count: ids.length });
    return ids.length === 1
      ? s(this.hass, 'device')
      : s(this.hass, 'devices', { count: ids.length });
  }

  protected renderCard(): TemplateResult {
    const title = this.config?.title ?? '';
    const text = this.config?.meta ?? this.counted();
    const action: ActionConfig | undefined = this.config?.path
      ? { action: 'navigate', navigation_path: this.config.path }
      : this.config?.tap_action;
    const goes = action !== undefined && action.action !== 'none';
    const words = text ? html`<span class="hm-section__text">${text}</span>` : nothing;

    const lead = this.config?.icon;
    return html`<div class="hm-section">
      <div class="hm-section__lead">
        ${lead ? html`<span class="hm-section__icon">${icon(lead)}</span>` : nothing}
        <h2 class="hm-section__title">${title}</h2>
      </div>
      ${
        goes
          ? html`<button
              class="hm-section__meta"
              aria-label=${text ? `${title} · ${text}` : title}
              @click=${() => this.tap(undefined, action)}
            >
              ${words}${glyph('chevron')}
            </button>`
          : text
            ? html`<span class="hm-section__meta">${words}</span>`
            : nothing
      }
    </div>`;
  }
}
