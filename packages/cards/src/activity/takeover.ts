import { html, nothing, type TemplateResult } from 'lit';
import { ORIGINAL_ACTIVITY } from '@fluvy/core';

import { pageIsOurs, takeOverPage, waitingBar, type HaPanel } from '../shared/takeover.js';

/** Home Assistant's Activity page (`/logbook`): a Lit element that renders its whole page itself. */
const TAG = 'ha-panel-logbook';
const OURS = 'fluvy-activity';

/** The view is its own file, fetched when the Activity page first renders it (no other page pays for it). */
let loading: Promise<unknown> | undefined;
const load = (): Promise<unknown> => (loading ??= import('./view.js'));

/** Ours while the page wears Fluvy and the house has not kept Home Assistant's page. */
export const activityIsOurs = (doc: Document = document): boolean =>
  pageIsOurs(ORIGINAL_ACTIVITY, doc);

/**
 * Fluvy's Activity in place of Home Assistant's: our view reads the same address and the same links
 * (`?entity_id=…&start_date=…&back=1`). Resolves whether the wrap took.
 */
export const takeOverActivity = (
  registry: CustomElementRegistry = customElements,
  doc: Document = document,
): Promise<boolean> =>
  takeOverPage({ tag: TAG, ours: OURS, kept: ORIGINAL_ACTIVITY, load, view }, registry, doc);

const view = (panel: HaPanel): TemplateResult =>
  html`<fluvy-activity .hass=${panel.hass} .narrow=${panel.narrow ?? false}
    >${
      customElements.get(OURS)
        ? nothing
        : waitingBar(panel, panel.hass?.localize?.('panel.logbook') ?? '')
    }</fluvy-activity
  >`;
