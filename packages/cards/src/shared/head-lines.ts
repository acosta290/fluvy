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
  /^(tiles?|template|lights|room|scenes?|chips|clock|energy-period|heading|hello|media|now-playing|readouts):|^alerts:(|tiles|mini|chips|banner)$|^weather:(|full)$|^web:(frame|bare)$|^(slider|sensor|calendar|chart):tile$|^(printer|remote|appliance|compass):row$|^vehicle:mini$|^appliances:cards$/;

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

/**
 * Whether a card's head is left with nothing in it (#259): no circle (`show_icon: never`), its name hidden
 * (`hidesName`) and `quiet`, the card's own answer read from its config alone (`Card.quiet`): its line, its badge and
 * whatever trails its head all switched off. Never from what the house says, as a card's height follows its config: an
 * Appliances count left empty while nothing runs keeps its head while `show_count` is on. Such a head is not drawn:
 * the card's first part sits at its 20 all round, the card says its title aloud, and its height drops the head and the
 * gap under it (`headlessOf`).
 */
export const headless = (config: LovelaceCardConfig | undefined, quiet: boolean): boolean =>
  quiet && config?.['show_icon'] === 'never' && hidesName(config);

/** What a head left with nothing in it (`headless`) takes off its card's height: its 44 and the `gap` under it. */
export const headlessOf = (
  config: LovelaceCardConfig | undefined,
  quiet: boolean,
  gap: number,
): number => (headless(config, quiet) ? 44 + gap : 0);

/**
 * A head's line asked away: `subtitle: ''`, or no `subtitle` where the card's own line is off by its config (`off`:
 * its count's switch, a line it draws only where asked).
 */
export const noLine = (config: LovelaceCardConfig | undefined, off = false): boolean =>
  (config?.['subtitle'] ?? (off ? '' : undefined)) === '';

/** A head's own badge asked away: `show_badge: false` (#203), or the card's own switch for it (`off`). */
export const noBadge = (config: LovelaceCardConfig | undefined, off = false): boolean =>
  off || config?.['show_badge'] === false;

/** The `quiet` of a head with a line and a badge of its own: both asked away. */
export const muted = (config: LovelaceCardConfig | undefined): boolean =>
  noLine(config) && noBadge(config);
