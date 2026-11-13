import { ORIGINAL_DETAILS } from '@fluvy/core';
import { html, type TemplateResult } from 'lit';

import { takeOverPage, type HaPanel } from '../shared/takeover.js';

/**
 * The history block of Home Assistant's details dialog (`ha-more-info-history`: in the dialog's main view, and in the
 * history view its chart button opens for a light, a cover, a player …), read by its `hass` and its `entityId`.
 */
const TAG = 'ha-more-info-history';
const OURS = 'fluvy-details-history';

interface HaHistory extends HaPanel {
  entityId?: unknown;
}

/** The block is its own file, fetched the first time a dialog shows it (no page that never opens one pays for it). */
let loading: Promise<unknown> | undefined;
const load = (): Promise<unknown> => (loading ??= import('./view.js'));

/**
 * What Home Assistant draws of a thing's attributes through time (a climate's temperatures and targets): its own block
 * stays.
 */
const ATTRIBUTE_LINES = /^(climate|humidifier|water_heater)\./;

const view = (block: HaHistory): TemplateResult | undefined =>
  typeof block.entityId === 'string' && block.entityId && !ATTRIBUTE_LINES.test(block.entityId)
    ? html`<fluvy-details-history
        .hass=${block.hass}
        .entityId=${block.entityId}
      ></fluvy-details-history>`
    : undefined;

/**
 * Fluvy's history in place of Home Assistant's in its details dialog, while the page wears Fluvy and the house has not
 * kept Home Assistant's: the dialog itself — its head, its buttons, the controls of a light or a climate — stays Home
 * Assistant's. An element that no longer declares `hass` and `entityId` keeps its own block, and the shell's report
 * says why. Resolves whether the wrap took.
 */
export const takeOverDetails = (
  registry: CustomElementRegistry = customElements,
  doc: Document = document,
): Promise<boolean> =>
  takeOverPage(
    { tag: TAG, ours: OURS, kept: ORIGINAL_DETAILS, load, view, reads: ['hass', 'entityId'] },
    registry,
    doc,
  );
