import { describe, expect, it } from 'vitest';
import type { CardDoc, Key } from './cards.js';
import {
  checkDefaults,
  checkGallery,
  checkGuides,
  checkMeanings,
  checkPictures,
} from './checks.js';
import { drawn, mounted, type Example } from './gallery.js';
import { cardPage, demoOf, indexPage } from './pages.js';
import { digest, type Manifest } from './pictures.js';

const key = (over: Partial<Key> & { readonly key: string }): Key => ({
  label: over.key,
  type: 'text',
  required: false,
  values: [],
  meaning: `What ${over.key} does.`,
  meaningOf: over.key,
  ...over,
});

const EXAMPLE: Example = {
  config: { type: 'custom:fluvy-lamp-card', entity: 'light.desk', name: 'Desk lamp' },
  variants: { compact: {} },
};

/** A card of the docs' model: a lamp with a layout select, a switch, a name and a list of readouts. */
function lamp(example: Example | undefined = EXAMPLE): CardDoc {
  return {
    tag: 'fluvy-lamp-card',
    short: 'lamp',
    name: 'Lamp',
    description: 'A lamp and its readouts.',
    section: 'Everyday',
    keys: [
      key({ key: 'entity', label: 'Entity', type: 'entity (light)', required: true }),
      key({ key: 'name', label: 'Name', helper: 'Your own words' }),
      key({
        key: 'variant',
        label: 'Style',
        type: 'choice',
        default: 'full',
        values: [
          { value: 'full', label: 'Full' },
          { value: 'compact', label: 'Compact' },
        ],
      }),
      key({ key: 'show_icon', label: 'Show the icon', type: 'boolean', default: true }),
    ],
    lists: [
      {
        key: 'readouts',
        label: 'Readouts',
        meaning: 'The readouts under the lamp.',
        meaningOf: 'readouts[]',
        id: 'entity',
        item: [key({ key: 'entity', meaningOf: '[].entity' }), key({ key: 'unit' })],
      },
    ],
    reads: [{ from: 'layout', to: 'variant', partly: false }],
    layout: { key: 'variant', values: ['full', 'compact'], default: 'full' },
    ...(example ? { example } : {}),
    drawn: example ? drawn('fluvy-lamp-card', example) : [],
    known: new Set(['type', 'entity', 'name', 'variant', 'show_icon', 'readouts']),
    normalise: ({ layout, ...config }) => (layout ? { ...config, variant: layout } : config),
  };
}

const gallery = (config: Record<string, unknown>, more: Partial<Example> = {}) => ({
  'fluvy-lamp-card': { ...EXAMPLE, ...more, config: { ...EXAMPLE.config, ...config } },
});

describe('the gallery held to the cards', () => {
  it('takes an example a person could have written, with a line for every other layout', () => {
    expect(checkGallery([lamp()], gallery({ readouts: ['sensor.desk_power'] }))).toEqual([]);
  });

  it('names a card without an example, and an example of no card', () => {
    expect(checkGallery([lamp()], {})).toEqual([
      'fluvy-lamp-card: no example in tools/docs/src/gallery.ts',
    ]);
    expect(checkGallery([], gallery({}))).toEqual([
      'fluvy-lamp-card: an example for a card the catalogue does not have',
    ]);
  });

  it('refuses an older name, a test hook, a key of no editor and a default written out', () => {
    const found = checkGallery(
      [lamp()],
      gallery({ layout: 'full', _now: '2026-09-17T19:50:00Z', colour: 'red', show_icon: true }),
    );
    expect(found).toEqual([
      'fluvy-lamp-card: `layout` is an older name: write the one it is read as',
      "fluvy-lamp-card: `_now` is a test's hook, not a key",
      'fluvy-lamp-card: `colour` is no key of its editor',
      "fluvy-lamp-card: `show_icon: true` is the card's default: leave it out",
    ]);
  });

  it('holds what a layout adds to the example to the same rules', () => {
    expect(
      checkGallery([lamp()], gallery({}, { variants: { compact: { config: { glow: true } } } })),
    ).toEqual(['fluvy-lamp-card · compact: `glow` is no key of its editor']);
  });

  it('holds a list’s items to the fields its editor shows', () => {
    expect(
      checkGallery(
        [lamp()],
        gallery({ readouts: [{ entity: 'sensor.desk_power', label: 'Power' }] }),
      ),
    ).toEqual(['fluvy-lamp-card: readouts[0].label is no field of its items']);
  });

  it('wants a line for every value of the layout select, and none for the base’s', () => {
    expect(checkGallery([lamp()], gallery({}, { variants: {} }))).toEqual([
      'fluvy-lamp-card: no example for `variant: compact`',
    ]);
    expect(checkGallery([lamp()], gallery({}, { variants: { full: {}, compact: {} } }))).toEqual([
      'fluvy-lamp-card: an example for `variant: full`, which is the base',
    ]);
    expect(checkGallery([lamp()], gallery({ variant: 'compact' }))).toEqual([
      "fluvy-lamp-card: its example names `variant`: the base is the card's own layout",
    ]);
  });
});

describe('the pictures held to the gallery', () => {
  const card = lamp();
  const [base, compact] = card.drawn.map((one) => digest(mounted(one)));
  const manifest: Manifest = {
    lamp: { example: base ?? '', width: 784, height: 400 },
    'lamp.compact': { example: compact ?? '', width: 784, height: 160 },
  };
  const files = [
    'lamp-light.webp',
    'lamp-dark.webp',
    'lamp.compact-light.webp',
    'lamp.compact-dark.webp',
    'thumbs/lamp-light.webp',
    'thumbs/lamp-dark.webp',
  ];

  it('takes a picture in light and in dark of the base, of its thumbnail and of each other layout, as they stand', () => {
    expect(checkPictures([card], files, manifest)).toEqual([]);
  });

  it('names a missing picture, one of another example and one of no example, and says how to take them', () => {
    expect(
      checkPictures(
        [card],
        [...files.filter((name) => !name.endsWith('-dark.webp')), 'kettle-light.webp'],
        {
          lamp: { example: 'a0b1c2d3e4f5', width: 784, height: 400 },
          'lamp.full': { example: 'a0b1c2d3e4f5', width: 784, height: 400 },
        },
      ),
    ).toEqual([
      'docs/images/cards/lamp-dark.webp is missing',
      'docs/images/cards/thumbs/lamp-dark.webp is missing',
      "fluvy-lamp-card: its picture is of another example than the gallery's",
      'docs/images/cards/lamp.compact-dark.webp is missing',
      'fluvy-lamp-card · compact: its picture is not in docs/images/cards/pictures.json',
      'docs/images/cards/kettle-light.webp is the picture of no example',
      'docs/images/cards/pictures.json: `lamp.full` is no example',
      'run `pnpm docs:images` (the playground running) for the pictures',
    ]);
  });
});

describe('the guides held to the pages', () => {
  it('takes a card’s guide, its headings under the page’s own', () => {
    expect(
      checkGuides(
        [lamp()],
        { lamp: '### Dimming\n\n```yaml\n# a comment, no heading\nentity: light.desk\n```\n' },
        {},
      ),
    ).toEqual([]);
  });

  it('names the guide of no card, one that says nothing and a heading that would head the page', () => {
    expect(
      checkGuides([lamp()], { kettle: 'Boils.', lamp: '## Dimming\n\nHold to dim.' }, {}),
    ).toEqual([
      'tools/docs/guides/kettle.md is the guide of no card',
      'tools/docs/guides/lamp.md: "## Dimming" heads a page: a guide\'s headings start at `###`',
    ]);
    expect(checkGuides([lamp()], { lamp: ' \n' }, {})).toEqual([
      'tools/docs/guides/lamp.md says nothing: write the guide, or take the file away',
    ]);
  });

  it('wants a card whose guide is another’s to name a card', () => {
    expect(checkGuides([lamp()], {}, { lamp: ['kettle', 'Kettle'] })).toEqual([
      'GUIDE_OF: `lamp` reads the guide of `kettle`, and one of them is no card',
    ]);
  });
});

describe('what the docs say of every key', () => {
  it('wants every select and switch to say what the card does without it', () => {
    const card = lamp();
    const silent = { ...card, keys: [...card.keys, key({ key: 'look', type: 'choice' })] };
    expect(checkDefaults([card])).toEqual([]);
    expect(checkDefaults([silent])).toEqual([
      "fluvy-lamp-card: `look` declares no default: say it in the card's `defaults`, or in words in UNDECLARED (tools/docs/src/cards.ts)",
    ]);
  });

  it('wants a sentence for every key, every list and every field, and no sentence of no key', () => {
    const card = lamp();
    const meanings = Object.fromEntries(
      [...card.keys, ...card.lists, ...card.lists.flatMap((list) => list.item)].map((one) => [
        one.meaningOf,
        'said',
      ]),
    );
    expect(checkMeanings([card], meanings)).toEqual([]);
    const glow: Key = { key: 'glow', label: 'Glow', type: 'boolean', required: false, values: [] };
    const mute = { ...card, keys: [...card.keys, glow] };
    expect(checkMeanings([mute], { ...meanings, 'lamp.halo': 'said' })).toEqual([
      'fluvy-lamp-card: `glow` does not say what it does: write its sentence in MEANINGS (tools/docs/src/meanings.ts)',
      'MEANINGS: `lamp.halo` is read by no key: take it away',
    ]);
  });
});

describe('a card’s page', () => {
  const pictures: Manifest = {
    lamp: { example: '', width: 784, height: 400 },
    'lamp.compact': { example: '', width: 784, height: 160 },
  };
  const page = cardPage(lamp(), pictures);

  it('shows the picture in the reader’s theme, the YAML that draws it and the way to try it', () => {
    expect(page).toContain(
      '<picture><source media="(prefers-color-scheme: dark)" srcset="../images/cards/lamp-dark.webp"><img src="../images/cards/lamp-light.webp" width="392"',
    );
    expect(page).toContain(
      '## Example\n\n```yaml\ntype: custom:fluvy-lamp-card\nentity: light.desk\nname: Desk lamp\n```',
    );
    expect(page).toContain(
      `\`custom:fluvy-lamp-card\` · [Try it live](${demoOf('lamp')}) · [All cards](../cards.md#everyday)`,
    );
  });

  it('shows each other layout in a grid: the line that chooses it, then its picture, a way into the demo', () => {
    expect(page).toContain(
      'The picture above is `full`, the default; each of the others is the example plus the line over it',
    );
    expect(page).toContain(
      '<td align="center" valign="top" width="50%"><code>variant: compact</code><br><a href="https://acosta290.github.io/fluvy/?card=lamp&amp;layout=compact"><picture><source media="(prefers-color-scheme: dark)" srcset="../images/cards/lamp.compact-dark.webp"><img src="../images/cards/lamp.compact-light.webp" width="392" alt="The Lamp card in its compact layout"></picture></a></td>',
    );
    // a row short of cells is filled, so the cell keeps its half
    expect(page).toContain('<td align="center" valign="top" width="50%"></td>\n</tr></tbody>');
  });

  it('says of every key its default and what it does in a sentence, with what it takes', () => {
    expect(page).toContain('| Option | Default | What it does |');
    expect(page).toContain('| `name` |  | What name does. |');
    expect(page).toContain('| `variant` | `full` | What variant does. `full` · `compact`. |');
    expect(page).toContain('| `entity` | **required** | What entity does. A `light`. |');
    expect(page).toContain(
      '| [`readouts`](#readouts) |  | The readouts under the lamp. A list: [its items](#readouts). |',
    );
  });

  it('folds what every card shares under the card’s own keys, and the older names at the end', () => {
    const [own = '', shared = ''] = page.split('<details>\n<summary>Its look and its actions');
    expect(own).not.toContain('`show_icon`');
    expect(shared).toContain('| `show_icon` | `true` | What show_icon does. |');
    expect(shared).toContain('(../customising.md#options-every-card-takes)');
    expect(page).toContain(
      '<details>\n<summary>Older names the card still reads</summary>\n\n| Older name | Read as |\n| --- | --- |\n| `layout` | `variant` |\n\n</details>\n',
    );
  });

  it('says what an item of a list is, and of each of its fields what it does', () => {
    expect(page).toContain(
      '### `readouts`\n\nAn item is an entity id, or a map with `entity` and any of these fields.\n\n| Field | What it does |\n| --- | --- |\n| `entity` | What entity does. |\n| `unit` | What unit does. |',
    );
  });

  it('names the editor’s folded groups in rows of their own, and a value by the editor’s word where it says more', () => {
    const card = lamp();
    const grouped = cardPage(
      {
        ...card,
        keys: [
          ...card.keys,
          key({
            key: 'curve',
            group: 'Chart',
            type: 'choice',
            default: 'auto',
            values: [
              { value: 'auto', label: 'Automatic' },
              { value: 'step', label: 'In steps' },
            ],
          }),
          key({ key: 'floor', group: 'Chart', type: 'number', range: '0 to 10' }),
        ],
      },
      pictures,
    );
    // the lists stand with the form's own keys, before the first group
    expect(grouped).toContain(
      'A list: [its items](#readouts). |\n| **Chart** |  |  |\n| `curve` | `auto` | What curve does. `auto` · `step` (In steps). |\n| `floor` |  | What floor does. 0 to 10. |',
    );
  });

  it('prints the guide written by hand under its own heading, before the older names', () => {
    const guided = cardPage(lamp(), pictures, { lamp: '### Dimming\n\nHold to dim.\n' });
    expect(guided).toContain('## Guide\n\n### Dimming\n\nHold to dim.\n\n<details>');
    expect(page).not.toContain('## Guide');
  });

  it('sends a card whose guide is another card’s to that card’s page, where it is written', () => {
    const player = { ...lamp(), short: 'now-playing' };
    expect(cardPage(player, pictures, { media: 'The queue.' })).toContain(
      '## Guide\n\nThis card is in [the Media card’s guide](media.md#guide).',
    );
    expect(cardPage(player, pictures)).not.toContain('## Guide');
  });
});

describe('the index', () => {
  const cards = [lamp(), { ...lamp(), short: 'kettle', name: 'Kettle', section: 'Kitchen' }];
  const index = indexPage(cards, ['Everyday', 'Kitchen']);

  it('counts the cards in words and leads to what they share and to each section', () => {
    expect(index).toContain('# The cards\n\nTwo cards, each in the card picker');
    expect(index).toContain('(customising.md#options-every-card-takes)');
    expect(index).toContain('[Everyday](#everyday) · [Kitchen](#kitchen)');
  });

  it('draws each section’s cards three to a row: the thumbnail, the name and what it is, a way to its page', () => {
    expect(index).toContain(
      '## Everyday\n\n<table>\n<tbody><tr>\n<td align="center" valign="top" width="33%"><a href="cards/lamp.md"><picture><source media="(prefers-color-scheme: dark)" srcset="images/cards/thumbs/lamp-dark.webp"><img src="images/cards/thumbs/lamp-light.webp" width="280" alt=""></picture><br><b>Lamp</b></a><br>A lamp and its readouts.</td>\n<td align="center" valign="top" width="33%"></td>\n<td align="center" valign="top" width="33%"></td>\n</tr></tbody>\n</table>',
    );
  });

  it('is the same index from the folder of the pages, its ways from there', () => {
    const folder = indexPage(cards, ['Everyday', 'Kitchen'], { from: '../', pages: '' });
    expect(folder).toContain(
      '<a href="kettle.md"><picture><source media="(prefers-color-scheme: dark)" srcset="../images/cards/thumbs/kettle-dark.webp">',
    );
    expect(folder).toContain('(../customising.md#options-every-card-takes)');
    expect(folder).toContain('[Energy](../energy.md)');
  });
});
