import {
  appHass,
  isEntityId,
  moreInfo,
  runAction,
  type DetailsSheetsOpener,
  type HomeAssistant,
  type SheetKind,
  type Sheets,
} from '@fluvy/core';

/**
 * Fluvy's own details sheets (1.20, #162): which entities have one, and who opens it. Every page carries this file: it
 * stays tiny. The sheets themselves are a chunk of their own (`details/`), fetched the first time one opens.
 */

/** The kinds with a sheet of their own: each built round one control, as its card is. */
const KINDS = /^(light|climate|water_heater|humidifier|cover|valve|media_player|fan)\./;

/**
 * Who opens the details of a Fluvy card (`setDetailsSheets`): Fluvy's sheet for an entity that has one, where the action
 * asks for it (`details: fluvy`) or says nothing and the house does (`house`: its `sheets`, fluvy's settings); Home Assistant's
 * dialog for every other entity, where either says `home-assistant`, and where the sheets cannot be fetched. The sheet
 * shows its last 24 hours as the action says (`history`, #243), else where the house shows them for its kind (`days`:
 * its `sheetsHistory`; none said, every kind).
 */
export const detailsSheets =
  (
    house: () => Sheets | undefined,
    days: () => readonly SheetKind[] | undefined = () => undefined,
  ): DetailsSheetsOpener =>
  (node, hass, entityId, own) => {
    if ((own.details ?? house()) !== 'fluvy' || !KINDS.test(entityId)) return false;
    import('./details/open.js').then(
      ({ openDetails }) => openDetails(node, hass, entityId, own.history ?? days()),
      () => moreInfo(node, entityId),
    );
    return true;
  };

/**
 * Opens an entity's details as a Fluvy card's tap does (1.23, #219), for a card of one's own: public as
 * `window.__fluvy.openDetails(entityId, { from, history })`. Fluvy's sheet where the house asks for them and the
 * entity has one, else Home Assistant's dialog — asked of `from`, the element of the card that asks (the focus goes
 * back to it, and the sheet reads at its size), else of Home Assistant's own root; the house Home Assistant's app
 * holds, else the one `from` was handed; its last 24 hours as `history` says (#243), else as the house shows them. An
 * id that is no entity's opens nothing.
 */
export function openEntityDetails(
  entityId: unknown,
  options?: { readonly from?: unknown; readonly history?: unknown } | null,
): void {
  const from = options?.from;
  const own = from instanceof HTMLElement ? from : undefined;
  const node = own ?? document.querySelector('home-assistant');
  const hass = appHass() ?? (own as (HTMLElement & { hass?: HomeAssistant }) | undefined)?.hass;
  if (!hass || !isEntityId(entityId) || !(node instanceof HTMLElement)) return;
  const history = options?.history;
  void runAction(
    node,
    hass,
    { action: 'more-info', ...(typeof history === 'boolean' ? { history } : {}) },
    entityId,
  );
}
