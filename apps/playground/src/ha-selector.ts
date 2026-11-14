import type { HomeAssistant } from '@fluvy/core';
import { css, html, LitElement, type TemplateResult } from 'lit';
import { toYaml } from '../../../packages/cards/src/panel/sidebar/yaml.js';

/**
 * Home Assistant's selector as the playground stands it in, for the two the settings panel asks of it: an entity
 * picker, as many as chosen (what a dashboard leaves out) — a field an entry, its entity's name (an id the house does
 * not know, a pattern, as written), then Home Assistant's Add button — and its YAML field (`object`: a list's cards
 * where its stack editor is not to be had), the value as YAML in a box. The picking and the typing themselves are
 * Home Assistant's.
 */
/** A value as the YAML field shows it: its own lines, without a key over them. */
const yamlOf = (value: unknown): string => {
  const [first = '', ...rest] = toYaml('value', value).split('\n');
  return rest.length ? rest.map((line) => line.slice(2)).join('\n') : first.replace('value: ', '');
};

class MockSelector extends LitElement {
  static override properties = {
    hass: { attribute: false },
    selector: { attribute: false },
    value: { attribute: false },
    disabled: { type: Boolean },
  };
  declare hass: HomeAssistant | undefined;
  declare selector: unknown;
  declare value: unknown;
  declare disabled: boolean;

  static override styles = css`
    .list {
      display: grid;
      gap: 8px;
    }
    .field {
      display: grid;
      align-content: center;
      min-height: 56px;
      padding: 0 16px;
      border-radius: var(--fluvy-radius-control);
      box-shadow: inset 0 0 0 1px var(--fluvy-border-strong);
    }
    .field span {
      overflow: hidden;
      font-size: 16px;
      line-height: 24px;
      color: var(--fluvy-text);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .code {
      margin: 0;
      padding: 12px 16px;
      overflow: auto hidden;
      border-radius: var(--fluvy-radius-control);
      box-shadow: inset 0 0 0 1px var(--fluvy-border-strong);
      color: var(--fluvy-text);
      font:
        13px/20px ui-monospace,
        SFMono-Regular,
        Menlo,
        Consolas,
        monospace;
      white-space: pre;
    }
    .add {
      justify-self: start;
      height: 40px;
      padding: 0 12px;
      border: 0;
      border-radius: 20px;
      background: none;
      color: var(--fluvy-accent);
      font: inherit;
      font-size: 14px;
      font-weight: 600;
    }
  `;

  override render(): TemplateResult {
    if ((this.selector as { object?: unknown } | undefined)?.object)
      return html`<pre class="code">${yamlOf(this.value)}</pre>`;
    const ids = Array.isArray(this.value)
      ? this.value.filter((id): id is string => typeof id === 'string')
      : [];
    return html`<div class="list">
      ${ids.map((id) => {
        const name = this.hass?.states[id]?.attributes['friendly_name'];
        return html`<div class="field"><span>${typeof name === 'string' ? name : id}</span></div>`;
      })}
      <button class="add" ?disabled=${this.disabled}>+ Add entity</button>
    </div>`;
  }
}

/** Defines the stand-in where Home Assistant's own is not there (always, in the playground). */
export function defineSelectorStub(): void {
  if (!customElements.get('ha-selector')) customElements.define('ha-selector', MockSelector);
}
