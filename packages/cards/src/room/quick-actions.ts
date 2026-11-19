import { TOGGLE_DOMAINS } from '@fluvy/core';
import {
  membersOf,
  roundsIn,
  roundsOf,
  type RoundGroup,
  type RoundsBlock,
  type RoundsHost,
  type RoundsRoom,
} from '../shared/rounds.js';
import type { RoomCardConfig } from './room-card.js';

/*
 * A room's quick actions (#113): rounds at the end of its head, its row or its picture (`shared/rounds.ts`), each one
 * of the room's sets — its lights, its blinds, its fans, its players — or an entity of the person's choosing, each
 * saying its state where asked (#205). Their own chunk, fetched with the families as the bundle starts: the room card
 * draws them from its first render in practice.
 */

export { answered } from '../shared/rounds.js';

/** What a room asks for when it names no rounds: its lights, then its blinds. */
const DEFAULT: readonly RoundGroup[] = ['lights', 'covers'];

/** What the rounds reach of their room: the card's config besides, whose list they are. */
export interface QuickHost extends RoundsHost {
  readonly config: RoomCardConfig | undefined;
}

/** The sets a room's rounds stand for when the card names none: its lights, then its blinds, where it has them. */
export const defaultGroups = (room: RoundsRoom): RoundGroup[] =>
  DEFAULT.filter((group) => membersOf(room, group).length);

/**
 * The quick actions in `room`, as many as it holds (`roundsIn`): those asked for (`quick_actions`), else the room's
 * lights and blinds; a set the room does not hold has none. A tap runs what a round stands for — a scene, a vacuum, a
 * player as much as a lamp (#113, #172) — a lock asking before it unlocks.
 */
export function quickRounds(host: QuickHost, room: number): RoundsBlock {
  const { config } = host;
  const asked = config?.quick_actions;
  return roundsIn(
    {
      ...host,
      // the card's colours and lights' colours, and its rounds' states (`show_quick_states`) where they stand
      look: config && {
        ...config,
        states: config.show_quick_states,
        beside: config.quick_state_position === 'beside',
      },
      toggles: TOGGLE_DOMAINS,
    },
    roundsOf(host, Array.isArray(asked) ? asked : DEFAULT),
    room,
  );
}
