import { domainOf, SHEET_KINDS, type HomeAssistant, type SheetKind } from '@fluvy/core';
import { zoomOf } from '@fluvy/ui';
import './climate.js';
import './cover.js';
import './fan.js';
import './light.js';
import './media.js';
import type { DetailsSheet, LiveHass } from './sheet.js';

/** Each domain's sheet and the kind the house names it by: what `details-family.ts` lists, one for one. */
const SHEETS: Readonly<Record<string, readonly [keyof HTMLElementTagNameMap, SheetKind]>> = {
  light: ['fluvy-details-light', 'light'],
  climate: ['fluvy-details-climate', 'climate'],
  water_heater: ['fluvy-details-climate', 'climate'],
  humidifier: ['fluvy-details-climate', 'climate'],
  cover: ['fluvy-details-cover', 'cover'],
  valve: ['fluvy-details-cover', 'cover'],
  media_player: ['fluvy-details-media', 'media'],
  fan: ['fluvy-details-fan', 'fan'],
};

/** The sheet open now: one at a time, as a dialog is. */
let current: DetailsSheet | undefined;

/**
 * The size a card reads at: the CSS zoom it is drawn under (a view a device reads larger), never the passing scale of
 * a transform round it as it is tapped (a press, a popup sliding in); its box against its own width where the browser
 * cannot say.
 */
const sizeOf = (node: HTMLElement): number => node.currentCSSZoom ?? zoomOf(node);

/**
 * Opens an entity's details sheet for the card that asked (`node`): a sheet of its kind on the page's body — over the
 * dashboard, the sidebar and whatever popup the card stands in — which reads at the size that card reads at (a view
 * a device reads larger, an edit mode or a panel that does not), follows Home Assistant through that card, gives the
 * focus back to what was tapped in it, and goes from the page as it closes. Its last 24 hours stand at its foot as
 * `history` says (#243): an action's yes or no, else the kinds the house shows them for.
 */
export function openDetails(
  node: HTMLElement,
  hass: HomeAssistant,
  entityId: string,
  history: boolean | readonly SheetKind[] = SHEET_KINDS,
): void {
  const [tag, kind] = SHEETS[domainOf(entityId)] ?? [];
  if (!tag || !kind) return;
  // what was tapped, read before a sheet already open leaves and hands the focus back to its own opener
  const tapped = node.shadowRoot?.activeElement;
  current?.remove();
  const card = node as HTMLElement & Partial<LiveHass>;
  const sheet = document.createElement(tag) as DetailsSheet;
  const day = typeof history === 'boolean' ? history : history.includes(kind);
  sheet.setConfig({
    type: `custom:${tag}`,
    entity: entityId,
    ...(day ? {} : { show_history: false }),
  });
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
    // the card's size, in whole percents (a device's sizes are)
    Math.round(sizeOf(node) * 100) / 100,
  );
}
