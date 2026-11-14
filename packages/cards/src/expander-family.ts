import { layoutHeightOf, type LovelaceCardConfig } from '@fluvy/core';
import type { FamilyEntry } from './energy-family.js';

/**
 * The Expander card, announced at start and defined when its chunk lands (`expander-cards.ts`), as the template card
 * is: what the card picker lists and how tall the card is at a 360 column, without the card itself — and the three
 * figures of its layout that height is counted with, which the card draws by too. Every page carries this file: it
 * stays tiny.
 */

/** A card's padding above and below, 20 and 20: what one held by the expander's surface turns out of its place. */
const PADS = 40;
/** The narrowest a card stands beside another: half a phone's section, less what a narrow phone takes off it. */
export const EXPANDER_COLUMN = 148;

const plain = (config: LovelaceCardConfig): boolean => config['style'] === 'plain';

/**
 * The room between its cards, in px: the config's on the 4 grid (64 at most), else its style's — on the surface a
 * card's own 20 and 20, a hairline between; without one, a section's 16.
 */
export function expanderGap(config: LovelaceCardConfig): number {
  const asked = Number(config['gap']);
  return config['gap'] !== undefined && Number.isFinite(asked)
    ? Math.min(64, Math.max(0, Math.round(asked / 4) * 4))
    : plain(config)
      ? 16
      : PADS;
}

/**
 * Its cards side by side in a width: as many as asked for (1, the default, to 4) while each stands `EXPANDER_COLUMN`
 * wide at least — on the surface, its column and the padding it turns out.
 */
export function expanderColumns(config: LovelaceCardConfig, width: number): number {
  const gap = expanderGap(config);
  const out = plain(config) ? 0 : PADS;
  let columns = Math.min(4, Math.max(1, Math.round(Number(config['columns'])) || 1));
  while (columns > 1 && (width - out - (columns - 1) * gap) / columns + out < EXPANDER_COLUMN)
    columns--;
  return columns;
}

/** Its chevron as a control of its own, a round beside the head or the foot's row: 44, or 56 (`chevron_size: large`). */
export const expanderRound = (config: LovelaceCardConfig): number =>
  config['chevron_size'] === 'large' ? 56 : 44;

/**
 * The card folded, which is how the dashboard plans it. Its head alone: 84 on its surface (the head's 44 in the
 * card's 20 above and below), 44 with none (`style: plain`); or the cards that stand as its head (`head_cards`,
 * #186) by what each declares, row by row in the columns a 360 section holds beside its round — one of another
 * maker counted as the head it stands for. Under it the foot, where its chevron stands there (`chevron_position:
 * bottom`): its row, 8 under a head on the page. What it holds is the person's to open.
 */
export function expanderHeight(config: LovelaceCardConfig): number {
  const bare = plain(config);
  const round = expanderRound(config);
  const chevron = config['show_chevron'] !== false;
  const bottom = config['chevron_position'] === 'bottom';
  const head = bare ? 44 : 84;
  const foot = chevron && bottom ? round + (bare ? 8 : 0) : 0;
  const cards: unknown = config['head_cards'];
  if (!Array.isArray(cards) || !cards.length) return head + foot;
  const columns = expanderColumns(config, 360 - (chevron && !bottom ? round + 12 : 0));
  // a row on the surface gives its padding to the card's, and to the room under it
  const between = expanderGap(config) - (bare ? 0 : PADS);
  let height = foot - between;
  for (let at = 0; at < cards.length; at += columns)
    height +=
      between +
      Math.max(
        ...cards
          .slice(at, at + columns)
          .map((card: LovelaceCardConfig | null) =>
            typeof card?.type === 'string' ? layoutHeightOf(card, head) : head,
          ),
      );
  return height;
}

export const EXPANDER_FAMILY: readonly FamilyEntry[] = [
  [
    'fluvy-expander-card',
    'Fluvy · Expander',
    'Any cards folded away under a head: a tap opens them, on one surface or each on its own.',
    expanderHeight,
  ],
];
