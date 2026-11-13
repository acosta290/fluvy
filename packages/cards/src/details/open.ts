import { domainOf, type HomeAssistant } from '@fluvy/core';
import './climate.js';
import './cover.js';
import './fan.js';
import './light.js';
import './media.js';
import type { DetailsSheet, LiveHass } from './sheet.js';

/** Each kind's sheet: what `details-family.ts` lists, one for one. */
const SHEETS: Readonly<Record<string, keyof HTMLElementTagNameMap>> = {
  light: 'fluvy-details-light',
  climate: 'fluvy-details-climate',
  water_heater: 'fluvy-details-climate',
  humidifier: 'fluvy-details-climate',
  cover: 'fluvy-details-cover',
  valve: 'fluvy-details-cover',
  media_player: 'fluvy-details-media',
  fan: 'fluvy-details-fan',
};

/** The sheet open now: one at a time, as a dialog is. */
let current: DetailsSheet | undefined;

/**
 * Opens an entity's details sheet for the card that asked (`node`): a sheet of its kind on the page's body — over the
 * dashboard, the sidebar and whatever popup the card stands in — which follows Home Assistant through that card,
 * gives the focus back to what was tapped in it, and goes from the page as it closes.
 */
export function openDetails(node: HTMLElement, hass: HomeAssistant, entityId: string): void {
  const tag = SHEETS[domainOf(entityId)];
  if (!tag) return;
  // what was tapped, read before a sheet already open leaves and hands the focus back to its own opener
  const tapped = node.shadowRoot?.activeElement;
  current?.remove();
  const card = node as HTMLElement & Partial<LiveHass>;
  const sheet = document.createElement(tag) as DetailsSheet;
  sheet.setConfig({ type: `custom:${tag}`, entity: entityId });
  // the card's own `hass` is already in the language Fluvy speaks: the sheet takes Home Assistant's, as a card does
  sheet.hass = card.rawHass ?? hass;
  sheet.addEventListener(
    'fluvy-closed',
    () => {
      sheet.remove();
      if (current === sheet) current = undefined;
    },
    { once: true },
  );
  document.body.append(sheet);
  current = sheet;
  sheet.open(
    tapped instanceof HTMLElement ? tapped : node,
    'rawHass' in card ? (card as LiveHass) : undefined,
  );
}
