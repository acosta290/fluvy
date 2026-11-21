import type { LovelaceCardConfig } from '@fluvy/core';
import { applianceVariant } from '../appliance-variant.js';
import { twoLines } from './heights.js';

/*
 * A card's head with its name in two lines where one would end it in an ellipsis (`name_lines: 2`, 1.22, #191): the
 * head is a line taller whatever its name says (44 → 68: the two lines and the line under them, 4 from its edges), so
 * a row of cards stays level. One rule for what the card draws (`Card.nameLines` marks its host) and what it declares
 * (counted once wherever a card's height is read: `houseHeightOf`, a card the Expander holds).
 */

/** What a head adds where its name takes two lines. */
export const HEAD_LINE = 24;

/**
 * Where a card's `name_lines` is no head's, by `<card>:<layout>` (a layout left out is the card's default): a card that
 * draws no head of its own, or whose `name_lines` is its tiles' names, which its own height counts (a tile, a set of
 * them, the template card, a room's controls and its lights); and a head card's layout that draws none — a tile, a row,
 * a banner, a picture alone, the alerts' tiles and the weather's hero (the last two their cards' defaults).
 */
const NO_HEAD_LINES =
  /^(tiles?|template|lights|room|scenes?|chips|clock|energy-period|heading|hello|media|now-playing|readouts):|^alerts:(|tiles|mini|chips|banner)$|^weather:(|full)$|^web:(frame|bare)$|^(slider|sensor|calendar|chart):tile$|^(printer|remote|appliance):row$|^vehicle:mini$|^appliances:cards$/;

/**
 * A card of Fluvy's as `<card>:<layout>`: its short name and the layout its config asks for (left out: the card's
 * default); undefined for a card of another maker. What a rule by card and layout is read against (`NO_HEAD_LINES`,
 * the padding a card held by a surface turns out: `heldPadding`).
 */
export function cardLayout(config: LovelaceCardConfig | undefined): string | undefined {
  const card = /^custom:fluvy-(.+)-card$/.exec(String(config?.type))?.[1];
  if (!config || card === undefined) return undefined;
  // an appliance's layout is its kind's where it asks for none (a kettle's row)
  return `${card}:${card === 'appliance' ? applianceVariant(config) : String(config['variant'] ?? '')}`;
}

/**
 * Whether a card's layout draws a head that names it: not one turned off (`show_head: false`), nor a weather without
 * its name, nor a layout whose `name_lines` is no head's (`NO_HEAD_LINES`).
 */
export function namesHead(config: LovelaceCardConfig | undefined): boolean {
  const layout = cardLayout(config);
  if (!config || layout === undefined) return false;
  if (config['show_head'] === false || config['show_name'] === false) return false;
  return !NO_HEAD_LINES.test(layout);
}

/**
 * What a card's head adds to its height for its name's lines: `HEAD_LINE` where its config asks for two and its
 * layout draws a head that names it (`namesHead`), else 0.
 */
export const headLines = (config: LovelaceCardConfig | undefined): number =>
  twoLines(config) && namesHead(config) ? HEAD_LINE : 0;

/**
 * Whether a card's head hides its name (`name_lines: 0`, #237): its circle and its line stay where they are, the line
 * beside the circle on its own, the head as tall as with one line; read aloud still, the head's button named by it.
 */
export const hidesName = (config: LovelaceCardConfig | undefined): boolean =>
  String(config?.['name_lines']) === '0' && namesHead(config);
