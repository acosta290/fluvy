import type { HaFormSchemaItem, LovelaceCardConfig } from '@fluvy/core';
import type { FluvyRowsEditor } from '../rows-editor.js';

/*
 * A card's editor drawn in a test's page: Home Assistant's form stands in as an element that holds what the editor
 * hands it and answers a change as `ha-form` does, with the whole of its data and the one field changed — so a field
 * the form does not show keeps the value it was handed.
 */

/** `ha-form`, as the editor sees it. */
export class FormStub extends HTMLElement {
  data: Readonly<Record<string, unknown>> = {};
  schema: readonly HaFormSchemaItem[] = [];

  /** The person changes one field: the form says its whole value, as Home Assistant's does. */
  change(name: string, value: unknown): void {
    this.dispatchEvent(
      new CustomEvent('value-changed', { detail: { value: { ...this.data, [name]: value } } }),
    );
  }
}

if (!customElements.get('ha-form')) customElements.define('ha-form', FormStub);
if (!customElements.get('ha-sortable'))
  customElements.define('ha-sortable', class extends HTMLElement {});

/** The editor in the page with `config`, once it has drawn its forms. */
export async function drawEditor(
  editor: HTMLElement,
  config: LovelaceCardConfig,
): Promise<FluvyRowsEditor> {
  const element = editor as FluvyRowsEditor;
  element.setConfig(config);
  document.body.append(element);
  await new Promise((resolve) => setTimeout(resolve));
  await element.updateComplete;
  return element;
}

/** The card's own form: the editor's first. */
export const cardForm = (editor: FluvyRowsEditor): FormStub =>
  editor.shadowRoot!.querySelector<FormStub>('ha-form')!;

/** The names of the fields a form shows, through its rows. */
export const shownNames = (schema: readonly HaFormSchemaItem[]): string[] =>
  schema.flatMap((item) => (item.schema ? shownNames(item.schema) : [item.name]));

/** The titles of the lists the editor draws, in their order. */
export const listTitles = (editor: FluvyRowsEditor): string[] =>
  [...editor.shadowRoot!.querySelectorAll('.list__title')].map((title) => title.textContent ?? '');

/** The next config the editor writes. */
export const nextConfig = (editor: FluvyRowsEditor): Promise<LovelaceCardConfig> =>
  new Promise((resolve) =>
    editor.addEventListener(
      'config-changed',
      (event) => resolve((event as CustomEvent<{ config: LovelaceCardConfig }>).detail.config),
      { once: true },
    ),
  );
