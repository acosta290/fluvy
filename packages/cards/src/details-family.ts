import { moreInfo, type DetailsSheetsOpener, type Sheets } from '@fluvy/core';

/**
 * Fluvy's own details sheets (1.20, #162): which entities have one, and who opens it. Every page carries this file: it
 * stays tiny. The sheets themselves are a chunk of their own (`details/`), fetched the first time one opens.
 */

/** The kinds with a sheet of their own: each built round one control, as its card is. */
const KINDS = /^(light|climate|water_heater|humidifier|cover|valve|media_player|fan)\./;

/**
 * Who opens the details of a Fluvy card (`setDetailsSheets`): Fluvy's sheet for an entity that has one, where the action
 * asks for it (`details: fluvy`) or says nothing and the house does (`house`: its `sheets`, fluvy's settings); Home Assistant's
 * dialog for every other entity, where either says `home-assistant`, and where the sheets cannot be fetched.
 */
export const detailsSheets =
  (house: () => Sheets | undefined): DetailsSheetsOpener =>
  (node, hass, entityId, own) => {
    if ((own ?? house()) !== 'fluvy' || !KINDS.test(entityId)) return false;
    import('./details/open.js').then(
      ({ openDetails }) => openDetails(node, hass, entityId),
      () => moreInfo(node, entityId),
    );
    return true;
  };
