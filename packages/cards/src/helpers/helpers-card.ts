import { strings } from '@fluvy/core';
import type {
  EntityView,
  FluvyCardConfig,
  LovelaceConfigForm,
  LovelaceGridOptions,
} from '@fluvy/core';
import { head, round, sheetStyles } from '@fluvy/ui';

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
  entityField,
  formLabels,
  iconField,
  nameIconFields,
  titleFields,
} from '../shared/form.js';
import { listsEditor } from '../shared/rows-editor.js';

import type { HelperHost, HelperRowConfig } from './context.js';
import { compactNumber, isBoxedNumber, numberBlocks } from './number.js';

import { buttonRow, momentRow, plainRow, switchRow } from './rows.js';

import { selectPiece } from './select.js';

import { rowStyles } from './styles.js';

import { textBlocks } from './text.js';

const s = strings('helpers');

export type { HelperRowConfig } from './context.js';

export interface HelpersCardConfig extends FluvyCardConfig {
  title?: string;
  subtitle?: string;
  /** The same helpers as `entities`, with a name, an icon, a context line or quick-set times per row (YAML). */
  rows?: ReadonlyArray<string | HelperRowConfig>;
}

const NUMBERS = new Set(['input_number', 'number', 'counter']);
const SELECTS = new Set(['input_select', 'select']);
const TEXTS = new Set(['input_text', 'text']);
const SWITCHES = new Set(['input_boolean', 'switch']);
const MOMENTS = new Set(['input_datetime', 'date', 'time', 'datetime']);
const BUTTONS = new Set(['input_button', 'button']);

/**
 * Every Home Assistant helper on one card, each in the idiom the design sheet gives its kind: a number
 * is a big tabular value with its stepper and the ruler under it, a select is a row of chips, a text
 * helper is the 44 field, and what is one tap (switch, date or time, button) is a list row.
 * One control per module: `number.ts`, `select.ts`, `text.ts`, `rows.ts`.
 */
export class FluvyHelpersCard extends Card<HelpersCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.inputs,
    rowStyles,
    css`
      /* the sheet places the ruler with .in-card > .fv-ruler (a fixed 360 card); here it is a custom element */
      fluvy-ruler {
        margin-top: 4px;
      }

      /* a name that does not fit beside its value sends the value and stepper to a line of their own */
      .in-field,
      .in-compact {
        flex-wrap: wrap;
        gap: 8px 12px;
        height: auto;
        min-height: 44px;
      }

      .in-field--top {
        min-height: 0;
      }

      .in-compact {
        min-height: 76px;
      }

      .in-field__text,
      .in-compact .fv-row__text {
        flex: 1 1 auto;
        max-width: 100%;
      }

      .in-field__control {
        flex: 0 0 auto;
        margin-left: auto;
      }

      .in-quick--flush {
        padding-left: 0;
      }

      /* the sheet's compact value is a 36 box around one digit; a unit or three digits may widen it */
      .in-compact__value {
        width: auto;
        min-width: 36px;
      }

      .in-compact__value .fv-unit {
        line-height: 1;
      }
    `,
  ];

  static override properties = { ...Card.properties, preview_: { state: true } };

  /** Value under the finger while a ruler drag is in flight, per entity. */
  declare preview_: Readonly<Record<string, number>>;

  constructor() {
    super();
    this.preview_ = {};
  }

  /** The card as its controls see it for this render (its own helpers are protected). */
  private hostView(): HelperHost {
    return {
      hass: this.hass,
      contentWidth: this.contentWidth,
      state: (view) => this.stateOf(view),
      expect: (id, state) => this.expect(id, state),
      call: (domain, service, data, id) => this.call(domain, service, data, id),
      moreInfo: (id) => this.tap(id, { action: 'more-info' }),
      preview: (id) => this.preview_[id],
      setPreview: (id, value) => {
        const next = { ...this.preview_ };
        if (value === null) delete next[id];
        else next[id] = value;
        this.preview_ = next;
      },
      editing: (id) =>
        (this.renderRoot as ShadowRoot).activeElement?.getAttribute('data-field') === id,
      refresh: () => this.requestUpdate(),
    };
  }

  static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        titleFields(),
        iconField(),
        entitiesField('entities', undefined, true),
        actionField(),
      ],
      ...formLabels({}),
    };
  }

  /** The visual editor: the card's own fields, then one form per item — a name, an icon, a tone, whatever the item may carry. */
  static getConfigElement(): HTMLElement {
    return listsEditor(this.getConfigForm(), [
      {
        key: 'rows',
        alias: 'entities',
        title: 'editor.rows',
        schema: [entityField(), nameIconFields()],
      },
    ]);
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): HelpersCardConfig {
    const helpers = entities.filter((id) =>
      /^(input_number|input_select|input_text|input_boolean|input_datetime|input_button|counter)\./.test(
        id,
      ),
    );
    return {
      type: 'custom:fluvy-helpers-card',
      entities: (helpers.length ? helpers : entities).slice(0, 4),
    };
  }

  protected override prepare(config: HelpersCardConfig): HelpersCardConfig {
    if (!config.rows?.length && !config.entities?.length)
      throw new Error('fluvy-helpers-card: add at least one entity');
    return config;
  }

  private rows(): HelperRowConfig[] {
    const source = this.config?.rows ?? this.config?.entities ?? [];
    return source.map((row) => (typeof row === 'string' ? { entity: row } : row));
  }

  protected override watched(): readonly string[] {
    return this.rows().map((row) => row.entity);
  }

  /**
   * A field whose name and value do not share the line drops the value a size (24 → 20 → 16) before
   * wrapping: "-1.5 °C" beside "Thermostat offset" fits at 20. Measured after each render, classes set
   * outside Lit's bindings like `fitPills`.
   */
  private fitFields(): void {
    for (const field of this.renderRoot.querySelectorAll<HTMLElement>('.in-field')) {
      const text = field.querySelector<HTMLElement>('.in-field__text');
      const control = field.querySelector<HTMLElement>('.in-field__control');
      const value = field.querySelector<HTMLElement>('.in-field__value');
      if (!text || !control || !value) continue;
      value.classList.remove('is-s', 'is-xs');
      const wrapped = (): boolean =>
        control.getBoundingClientRect().top > text.getBoundingClientRect().top + 1;
      if (!wrapped()) continue;
      value.classList.add('is-s');
      if (wrapped()) value.classList.replace('is-s', 'is-xs');
    }
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.fitFields();
  }

  override getCardSize(): number {
    return 1 + this.rows().length;
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected renderCard(): TemplateResult {
    const host = this.hostView();
    const rows = this.rows();
    const views = rows.map((row) => this.entity(row.entity));

    // one counter (or one boxed number) and no title: the sheet's compact card, not a titled list of one
    const [only] = rows;
    const [first] = views;
    if (
      only &&
      first &&
      rows.length === 1 &&
      !this.config?.title &&
      NUMBERS.has(first.domain) &&
      isBoxedNumber(host, first)
    ) {
      return compactNumber(host, first, only);
    }

    // blocks stand on their own; consecutive rows share one list, so the hairlines run between them
    const blocks: TemplateResult[] = [];
    let list: TemplateResult[] = [];
    const flush = (): void => {
      if (list.length) blocks.push(html`<div class="in-rows">${list}</div>`);
      list = [];
    };
    rows.forEach((row, index) => {
      const view = views[index] as EntityView;
      const domain = view.domain;
      const select = SELECTS.has(domain) ? selectPiece(host, view, row) : undefined;
      if (NUMBERS.has(domain)) {
        flush();
        blocks.push(...numberBlocks(host, view, row));
      } else if (TEXTS.has(domain)) {
        flush();
        blocks.push(...textBlocks(host, view, row));
      } else if (select && 'blocks' in select) {
        flush();
        blocks.push(...select.blocks);
      } else if (select) list.push(select.row);
      else if (SWITCHES.has(domain)) list.push(switchRow(host, view, row));
      else if (MOMENTS.has(domain)) list.push(momentRow(host, view, row));
      else if (BUTTONS.has(domain)) list.push(buttonRow(host, view, row));
      else list.push(plainRow(host, view, row));
    });
    flush();

    const areas = new Set(views.map((view) => view.areaName).filter(Boolean));
    const count =
      views.length === 1 ? s(this.hass, 'one') : s(this.hass, 'count', { count: views.length });
    const action = this.config?.tap_action;

    return html`<article class="fv-card" data-card>
      ${head({
        icon: this.config?.icon ?? 'sliders',
        tone: 'accent',
        title: this.config?.title ?? s(this.hass, 'title'),
        sub:
          this.config?.subtitle ??
          [areas.size === 1 ? [...areas][0] : '', count].filter(Boolean).join(' · '),
        // "…" appears when it has somewhere to go: a card of many entities has no more-info of its own
        trailing:
          action && action.action !== 'none'
            ? round('dots', 'quiet', this.t('common.more'), () => this.tap(undefined, action))
            : nothing,
      })}
      ${blocks}
    </article>`;
  }
}
