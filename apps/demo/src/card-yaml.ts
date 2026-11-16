import { catalogue } from '@fluvy/cards';
import { cardOptions, optionsYaml, type OptionsCard } from '../../../tools/docs/src/options.js';
import type { YamlCard } from './page.js';

/**
 * The YAML of the cards a plate holds, both ways "View YAML" shows it, from the docs' own reading of a card's options
 * (`tools/docs/src/options.ts`: its editor's form, lists and defaults) and their one writer. The cards' editors ride
 * with this module: it is fetched for the first "View YAML", never by a page.
 */
export interface CardYaml {
  /** The card's `type` (`custom:fluvy-tile-card`). */
  readonly type: string;
  /** Every option its editor shows, the unset ones as comments. */
  readonly all: string;
  /** What a person has to write: an example's is what the docs print. */
  readonly minimal: string;
}

/** Every card's class by its tag, read from the catalogue once. */
let classes: Promise<ReadonlyMap<string, OptionsCard>> | undefined;
const classesByTag = (): Promise<ReadonlyMap<string, OptionsCard>> =>
  (classes ??= catalogue().then(
    (entries) => new Map(entries.map(([tag, card]) => [tag, card as unknown as OptionsCard])),
  ));

/** The YAML of each card, in the house it reads; one that is none of the catalogue's is left out. */
export async function yamlOf(cards: readonly YamlCard[]): Promise<CardYaml[]> {
  const known = await classesByTag();
  return Promise.all(
    cards.flatMap(({ config, hass }) => {
      const card = known.get(config.type.replace(/^custom:/, ''));
      return card
        ? [
            cardOptions(card, config, hass).then((options) => ({
              type: config.type,
              all: optionsYaml(options, true),
              minimal: optionsYaml(options, false),
            })),
          ]
        : [];
    }),
  );
}
