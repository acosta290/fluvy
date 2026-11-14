import type { HaFormSchemaItem, HomeAssistant } from '@fluvy/core';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { defineSortableStub } from './ha-sortable.js';

type Labeler = (schema: HaFormSchemaItem, localize?: (key: string) => string) => string | undefined;

/** A select's option as a card's form writes it: its value, or its value under a label. */
type Option = string | { readonly value: string; readonly label?: string };
const valueOf = (option: Option): string => (typeof option === 'string' ? option : option.value);
const labelOf = (option: Option): string =>
  typeof option === 'string' ? option : (option.label ?? option.value);

/**
 * Home Assistant's form as the playground stands it in, for a card's editor drawn outside Home Assistant (Customise's
 * options sheet): each field of the schema as a box under its label, holding what the form was handed — a choice its
 * option's word, a switch its state, a row of a grid side by side, a folded group its title. A tap answers as the
 * form would, with the whole of its data: a choice moves on to its next option, a switch turns. The picking and the
 * typing themselves are Home Assistant's.
 */
class MockForm extends LitElement {
  static override properties = {
    hass: { attribute: false },
    data: { attribute: false },
    schema: { attribute: false },
    computeLabel: { attribute: false },
    computeHelper: { attribute: false },
  };
  declare hass: HomeAssistant | undefined;
  declare data: Readonly<Record<string, unknown>> | undefined;
  declare schema: readonly HaFormSchemaItem[] | undefined;
  declare computeLabel: Labeler | undefined;
  declare computeHelper: Labeler | undefined;

  static override styles = css`
    :host {
      display: block;
    }
    .fields,
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
    }
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .field,
    .group {
      display: grid;
      align-content: center;
      box-sizing: border-box;
      min-height: 56px;
      padding: 8px 16px;
      border: 0;
      border-radius: var(--fluvy-radius-control);
      background: none;
      box-shadow: inset 0 0 0 1px var(--fluvy-border-strong);
      color: var(--fluvy-text);
      font: inherit;
      text-align: start;
    }
    .label {
      overflow: hidden;
      font-size: 12px;
      font-weight: 500;
      line-height: 16px;
      color: var(--fluvy-text-secondary);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .value {
      overflow: hidden;
      font-size: 16px;
      line-height: 24px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .value:empty::before {
      content: '\\2014';
      color: var(--fluvy-text-disabled);
    }
    .switch {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 12px;
    }
    .switch .label {
      font-size: 16px;
      line-height: 24px;
      color: var(--fluvy-text);
      white-space: normal;
    }
    .track {
      position: relative;
      width: 48px;
      height: 28px;
      border-radius: 14px;
      background: var(--fluvy-border-strong);
    }
    .track::after {
      content: '';
      position: absolute;
      top: 4px;
      left: 4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--fluvy-card);
    }
    .is-on .track {
      background: var(--fluvy-primary, var(--fluvy-accent));
    }
    .is-on .track::after {
      left: 24px;
    }
    .group {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      font-size: 16px;
      font-weight: 500;
      line-height: 24px;
    }
    .group::after {
      content: '';
      width: 8px;
      height: 8px;
      margin-inline-end: 4px;
      border-right: 2px solid var(--fluvy-text-secondary);
      border-bottom: 2px solid var(--fluvy-text-secondary);
      transform: rotate(45deg);
    }
    .helper {
      margin: -8px 4px 0;
      font-size: 12px;
      line-height: 16px;
      color: var(--fluvy-text-secondary);
    }
  `;

  /** Home Assistant's own form is not ours to measure: the stand-in says so. */
  override connectedCallback(): void {
    super.connectedCallback();
    this.dataset['measure'] = 'skip';
  }

  private change(name: string, value: unknown): void {
    this.dispatchEvent(
      new CustomEvent('value-changed', { detail: { value: { ...this.data, [name]: value } } }),
    );
  }

  private field(item: HaFormSchemaItem): TemplateResult {
    const label = this.computeLabel?.(item, (key) => key) ?? item.name;
    const helper = this.computeHelper?.(item, (key) => key);
    const value = this.data?.[item.name];
    if (item.type === 'grid')
      return html`<div class="grid">${(item.schema ?? []).map((inner) => this.field(inner))}</div>`;
    if (item.type === 'expandable') return html`<div class="group">${item.title ?? label}</div>`;
    const selector = item.selector ?? {};
    if ('boolean' in selector)
      return html`<button
        class="field switch ${value ? 'is-on' : ''}"
        role="switch"
        aria-checked=${value ? 'true' : 'false'}
        data-field=${item.name}
        @click=${() => this.change(item.name, !value)}
      >
        <span class="label">${label}</span><span class="track"></span>
      </button>`;
    const select = (selector as { select?: { options?: readonly Option[] } }).select;
    if (select?.options?.length) {
      const options = select.options;
      const at = options.findIndex((option) => valueOf(option) === String(value));
      const chosen = options[at];
      return html`<button
          class="field"
          data-field=${item.name}
          @click=${() =>
            this.change(item.name, valueOf(options[(at + 1) % options.length] as Option))}
        >
          <span class="label">${label}</span
          ><span class="value">${chosen ? labelOf(chosen) : ''}</span>
        </button>
        ${helper ? html`<p class="helper">${helper}</p>` : nothing}`;
    }
    const name =
      typeof value === 'string'
        ? (this.hass?.states[value]?.attributes['friendly_name'] ?? value)
        : value === undefined || value === null || typeof value === 'object'
          ? ''
          : String(value);
    return html`<div class="field" data-field=${item.name}>
        <span class="label">${label}</span><span class="value">${name}</span>
      </div>
      ${helper ? html`<p class="helper">${helper}</p>` : nothing}`;
  }

  override render(): TemplateResult {
    return html`<div class="fields">${(this.schema ?? []).map((item) => this.field(item))}</div>`;
  }
}

/** Defines the stand-ins where Home Assistant's own are not there (always, in the playground). */
export function defineFormStub(): void {
  if (!customElements.get('ha-form')) customElements.define('ha-form', MockForm);
  defineSortableStub();
}
