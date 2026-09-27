import { html, nothing, type TemplateResult } from 'lit';
import { ORIGINAL_HISTORY } from '@fluvy/core';

import { pageIsOurs, takeOverPage, waitingBar, type HaPanel } from '../shared/takeover.js';

/** Home Assistant's History page (`/history`): a Lit element that renders its whole page itself. */
const TAG = 'ha-panel-history';
const OURS = 'fluvy-history';

/** The view is its own file, fetched when the History page first renders it (no other page pays for it). */
let loading: Promise<unknown> | undefined;
const load = (): Promise<unknown> => (loading ??= import('./view.js'));

/** Ours while the page wears Fluvy and the house has not kept Home Assistant's page. */
export const historyIsOurs = (doc: Document = document): boolean =>
  pageIsOurs(ORIGINAL_HISTORY, doc);

/**
 * Fluvy's History in place of Home Assistant's: our view reads the same address and the same links
 * (`?entity_id=…&start_date=…&end_date=…&back=1`) and keeps what was picked where Home Assistant keeps it.
 * Resolves whether the wrap took.
 */
export const takeOverHistory = (
  registry: CustomElementRegistry = customElements,
  doc: Document = document,
): Promise<boolean> =>
  takeOverPage({ tag: TAG, ours: OURS, kept: ORIGINAL_HISTORY, load, view }, registry, doc);

const view = (panel: HaPanel): TemplateResult =>
  html`<fluvy-history .hass=${panel.hass} .narrow=${panel.narrow ?? false}
    >${
      customElements.get(OURS)
        ? nothing
        : waitingBar(panel, panel.hass?.localize?.('panel.history') ?? '')
    }</fluvy-history
  >`;
