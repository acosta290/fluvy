/**
 * What `docs/` says about the cards, written from what the code says (`cards.ts`): a page a card
 * (`docs/cards/<card>.md`: its picture, the YAML that draws it, a picture of each other layout with the lines that
 * choose it, the YAML of its every option, every key in a table with what it does, its lists, its guide where one is
 * written by hand in `tools/docs/guides/`, the older names it reads), the index (`docs/cards.md`, and the same beside
 * the pages in `docs/cards/README.md`: every card by section in a grid, its picture, its name and what it is), and
 * the same as data for an assistant (`docs/cards.json`, `docs/llms.txt`). Pure text from the model: `build.ts` writes
 * it or holds the files to it.
 */
import type { CardDoc, Key, List } from './cards.js';
import { layoutKey } from './gallery.js';
import {
  pictureName,
  pictureStem,
  THUMB,
  thumbStem,
  type Manifest,
  type Mode,
} from './pictures.js';
import { wordsOf } from './words.js';
import { toYaml } from './yaml.js';

/** Where the repository is read from by an assistant: a page as plain text. */
const RAW = 'https://raw.githubusercontent.com/acosta290/fluvy/main/docs';
/** The live demo: every card's examples on the simulated house, each with its YAML. */
export const DEMO = 'https://acosta290.github.io/fluvy/';

/** A card's examples in the live demo, at one of its layouts where one is named. */
export const demoOf = (short: string, layout?: string): string =>
  `${DEMO}?card=${short}${layout ? `&layout=${encodeURIComponent(layout)}` : ''}`;

/** The folder a card's guide is written by hand in, from the repository's root: `<card>.md`, spliced into its page. */
export const GUIDES = 'tools/docs/guides';

/** The guides written by hand, by the card's short name: what its page says under "Guide". */
export type Guides = Readonly<Record<string, string | undefined>>;

/** The cards whose guide is another card's, by their short names: the card it is written under, and its name. */
export const GUIDE_OF: Readonly<Record<string, readonly [short: string, name: string]>> = {
  'now-playing': ['media', 'Media'],
  appliances: ['appliance', 'Appliance'],
};

/** The page of what the cards share and of the guides of no one card, from `docs/`. */
const CUSTOMISING = 'customising.md';

/** A section's card frame: what a picture is as wide as when nothing says otherwise (a full card and its margins). */
const FRAME = 392;
/** How many cards the index draws in a row, and how many layouts a page does. */
const INDEX_ROW = 3;
const LAYOUT_ROW = 2;

/** A text as HTML holds it, between tags or in an attribute. */
const html = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

/** The width a picture shows at: half its pixels. */
const shownWidth = (stem: string, pictures: Manifest): number =>
  Math.round((pictures[stem]?.width ?? 2 * FRAME) / 2);

/** A picture in the reader's theme: the dark one where GitHub is dark, `from` the page's way to `docs/`. */
function picture(stem: string, from: string, width: number, alt: string): string {
  const file = (mode: Mode): string => `${from}images/cards/${pictureName(stem, mode)}`;
  return `<picture><source media="(prefers-color-scheme: dark)" srcset="${file('dark')}"><img src="${file('light')}" width="${width}" alt="${html(alt)}"></picture>`;
}

/**
 * Cells in a grid, `across` to a row, each as wide as the others: an HTML table, since Markdown's has no cell without
 * a header. A row is a body of its own, so GitHub shades none of them (it shades a body's every other row), and a
 * row short of cells is filled with empty ones, so its cells stand under the others'.
 */
function grid(cells: readonly string[], across: number): string {
  const width = Math.floor(100 / across);
  const rows: string[] = [];
  for (let at = 0; at < cells.length; at += across) {
    const row = cells.slice(at, at + across);
    const filled = [...row, ...Array.from({ length: across - row.length }, () => '')];
    rows.push(
      `<tbody><tr>\n${filled
        .map((one) => `<td align="center" valign="top" width="${width}%">${one}</td>`)
        .join('\n')}\n</tr></tbody>`,
    );
  }
  return `<table>\n${rows.join('\n')}\n</table>`;
}

/** A text as a table's cell holds it: on one line, its bars escaped. */
const cell = (text: string): string => text.replaceAll('|', '\\|').replace(/\s*\n\s*/g, ' ');

/** A value as the YAML writes it, in code. */
const code = (value: unknown): string =>
  `\`${typeof value === 'string' ? value : JSON.stringify(value)}\``;

/** A sentence as it ends a cell's part: its full stop, unless it has one. */
const sentence = (text: string): string => (/[.!?…)]$/.test(text) ? text : `${text}.`);

/** Words as a sentence chooses among them: `a`, `a or b`, `a, b or c`. */
const either = (words: readonly string[]): string =>
  words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} or ${words.at(-1) ?? ''}`;

/** What the card does when a key is left out: `required`, a value, the same in words, or nothing said. */
function defaultOf(key: Key): string {
  if (key.required) return '**required**';
  if (key.defaultWords) return key.defaultWords;
  if (!('default' in key)) return '';
  const value = key.default;
  if (value === '' || value === null || value === undefined) return 'none';
  if (Array.isArray(value)) return value.length ? value.map(code).join(', ') : 'none';
  return code(value);
}

/** A word as it is held against another: its letters and digits alone, in lower case. */
const bare = (word: string): string => word.toLowerCase().replace(/[\s_-]+/g, '');

/** A choice's values in a row, each with the editor's word where it says more than the value (`auto` is "Automatic"). */
const valuesOf = (key: Key): string =>
  key.values
    .map(({ value, label }) =>
      bare(label).startsWith(bare(value)) ? code(value) : `${code(value)} (${label})`,
    )
    .join(' · ');

/**
 * What a key takes, where its sentence and its default do not say it: a choice's values, a number's range, the
 * domains an entity is of, that a switch with no default to show is one.
 */
function takes(key: Key): string {
  const [, kind = '', domains = ''] = /^(\w+)(?: \((.+)\))?/.exec(key.type) ?? [];
  const values = valuesOf(key);
  const own = key.type.endsWith(' or text') ? ', or your own' : '';
  const of = domains.split(', ').filter(Boolean).map(code);
  switch (kind) {
    case 'choice':
      return values ? `${values}${own}.` : '';
    case 'choices':
      return values ? `Any of ${values}${own}.` : 'A list.';
    case 'map':
      return values ? `Its keys: ${values}.` : '';
    case 'entity':
      return of.length ? `${/^`[aeiou]/.test(of[0] ?? '') ? 'An' : 'A'} ${either(of)}.` : '';
    case 'entities':
      return of.length ? `A list of ${either(of)} entities.` : 'A list of entities.';
    case 'number':
      return key.range ? sentence(key.range) : '';
    case 'boolean':
      return key.required || 'default' in key ? '' : '`true` or `false`.';
    default:
      return '';
  }
}

/** What a key or a list does, in a sentence: the docs' own, else what the editor says under it, else its word. */
const meaningOf = (said: Pick<Key, 'label' | 'meaning' | 'helper'>): string =>
  sentence(said.meaning ?? said.helper ?? said.label);

/** What a key does and what it takes, as one cell says them. */
const does = (key: Key): string => [meaningOf(key), takes(key)].filter(Boolean).join(' ');

/** A Markdown table: its header, then its rows, each a list of cells. */
const table = (head: readonly string[], rows: readonly (readonly string[])[]): string =>
  [head, head.map(() => '---'), ...rows]
    .map((row) => `| ${row.map(cell).join(' | ')} |`)
    .join('\n');

/**
 * Keys as a table's rows: the form's own first, then each folded group of the editor under its name, in a row of its
 * own. `row` is a key's cells.
 */
function keyRows(keys: readonly Key[], row: (key: Key) => readonly string[]): string[][] {
  const groups = ['', ...new Set(keys.flatMap((key) => (key.group ? [key.group] : [])))];
  return groups.flatMap((group) => {
    const rows = keys.filter((key) => (key.group ?? '') === group).map((key) => [...row(key)]);
    const [first] = rows;
    if (!group || !first) return rows;
    return [[`**${group}**`, ...first.slice(1).map(() => '')], ...rows];
  });
}

/**
 * The keys every card takes as every other does, its look and what a tap on it does: a page folds them under the
 * card's own, with this card's defaults, and the page of what the cards share says more of each.
 */
const SHARED: ReadonlySet<string> = new Set([
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'unavailable',
  'show_icon',
  'show_badge',
  'name_lines',
  'tap_action',
  'hold_action',
  'double_tap_action',
  'icon_tap_action',
  'icon_hold_action',
  'icon_double_tap_action',
]);

const OPTIONS = ['Option', 'Default', 'What it does'] as const;

/**
 * A card's options: its own keys in a table, its lists after the form's own and before the editor's folded groups,
 * then the keys every card shares, folded.
 */
function optionsSection(card: CardDoc): string[] {
  const option = (key: Key): string[] => [code(key.key), defaultOf(key), does(key)];
  const keys = card.keys.filter((key) => !SHARED.has(key.key));
  const own = [
    ...keyRows(
      keys.filter((key) => !key.group),
      option,
    ),
    ...card.lists.map((list) => [
      `[${code(list.key)}](#${list.key})`,
      '',
      `${meaningOf(list)} A list: [its items](#${list.key}).`,
    ]),
    ...keyRows(
      keys.filter((key) => key.group),
      option,
    ),
  ];
  const shared = keyRows(
    card.keys.filter((key) => SHARED.has(key.key)),
    option,
  );
  return [
    '## Options',
    ...(own.length ? [table(OPTIONS, own)] : []),
    ...(shared.length
      ? [
          `<details>\n<summary>Its look and its actions, as on every card</summary>\n\n${table(OPTIONS, shared)}\n\nMore about them in [Options every card takes](../${CUSTOMISING}#options-every-card-takes).\n\n</details>`,
        ]
      : []),
  ];
}

/** A list of the card: what an item is, and the fields it may carry. */
function listSection(list: List): string {
  const between =
    list.sections === 'labels'
      ? ' Between its items, `type: section` with a `label` heads a group.'
      : list.sections
        ? ' Between its items, `type: section` with a `label` heads a group and `type: divider` draws a line.'
        : '';
  const item =
    list.id === 'entity'
      ? 'An item is an entity id, or a map with `entity` and any of these fields.'
      : `An item is a map with \`${list.id}\` and any of these fields.`;
  return [
    `### \`${list.key}\``,
    `${item}${between}`,
    table(
      ['Field', 'What it does'],
      keyRows(list.item, (key) => [code(key.key), does(key)]),
    ),
  ].join('\n\n');
}

/** A card's other layouts in a grid: each one's picture, a way into the demo at it, and the lines that choose it. */
function layoutsSection(card: CardDoc, pictures: Manifest): string[] {
  const { layout, example } = card;
  const others = card.drawn.flatMap((one) => (one.layout ? [one.layout] : []));
  if (!layout || !example || !others.length) return [];
  const own = example.own
    ? `${code(example.own)}, the one the card takes by itself here`
    : `${code(layout.default)}, the default`;
  const added = others.map((value) =>
    toYaml({ [layoutKey(example)]: value, ...example.variants?.[value]?.config }).split('\n'),
  );
  // the lines first: the pictures are of many heights, and what heads a cell stands level with its neighbour's
  const cells = others.map((value, index) => {
    const stem = pictureStem(card.short, value);
    return `${(added[index] ?? []).map((line) => `<code>${html(line)}</code>`).join('<br>')}<br><a href="${html(demoOf(card.short, value))}">${picture(
      stem,
      '../',
      shownWidth(stem, pictures),
      `The ${card.name} card in its ${value} layout`,
    )}</a>`;
  });
  const lines = added.some((one) => one.length > 1) ? 'lines' : 'line';
  return [
    '## Layouts',
    `\`${layout.key}\` chooses the layout. The picture above is ${own}; each of the others is the example plus the ${lines} over it, and opens in the live demo.`,
    grid(cells, LAYOUT_ROW),
  ];
}

/** The YAML under "All options": every option the card's editor shows, each with its default (`options.ts`). */
const allOptionsYaml = (card: CardDoc): string =>
  card.allOptions ?? toYaml(card.example?.config ?? { type: `custom:${card.tag}` });

/** A card's guide: the one written by hand for it, or a line to the card's whose guide is its own too. */
function guideSection(card: CardDoc, guides: Guides): string[] {
  const guide = guides[card.short];
  if (guide) return ['## Guide', guide.trim()];
  const [other, name] = GUIDE_OF[card.short] ?? [];
  return other && name && guides[other]
    ? ['## Guide', `This card is in [the ${name} card’s guide](${other}.md#guide).`]
    : [];
}

/**
 * A heading as GitHub anchors it: lower case, its spaces hyphens, nothing but letters, digits, hyphens and
 * underscores.
 */
export const anchorOf = (heading: string): string =>
  heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .replaceAll(' ', '-');

/** What a generated page says of itself, first: what it is written from. */
const generated = (from: string): string =>
  `<!-- Generated by \`pnpm docs:cards\` from ${from}: change those, not this page. -->`;

/** A card's page. */
export function cardPage(card: CardDoc, pictures: Manifest, guides: Guides = {}): string {
  const example = card.example;
  const parts = [
    generated(
      `the card’s editor, its example in tools/docs/src/gallery.ts and its guide in ${GUIDES}/`,
    ),
    `# ${card.name}`,
    card.description,
    [
      `\`custom:${card.tag}\``,
      ...(example ? [`[Try it live](${demoOf(card.short)})`] : []),
      `[All cards](../cards.md#${anchorOf(card.section)})`,
    ].join(' · '),
  ];
  if (example)
    parts.push(
      picture(
        card.short,
        '../',
        shownWidth(card.short, pictures),
        `The ${card.name} card, drawn from the example below`,
      ),
      '## Example',
      `\`\`\`yaml\n${toYaml(example.config)}\n\`\`\``,
      'The picture above, on the demo house: put your own entities in place of its.',
    );
  parts.push(
    ...layoutsSection(card, pictures),
    '## All options',
    `\`\`\`yaml\n${allOptionsYaml(card)}\n\`\`\``,
    ...optionsSection(card),
  );
  if (card.lists.length) parts.push('## Lists', ...card.lists.map(listSection));
  parts.push(...guideSection(card, guides));
  if (card.reads.length)
    parts.push(
      `<details>\n<summary>Older names the card still reads</summary>\n\n${table(
        ['Older name', 'Read as'],
        card.reads.map((read) => [
          code(read.from),
          read.to
            ? `${code(read.to)}${read.partly ? ' (some of its values)' : ''}`
            : 'folded into the keys above',
        ]),
      )}\n\n</details>`,
    );
  return `${parts.join('\n\n')}\n`;
}

/** A word with its first letter in upper case: a sentence's first. */
const capital = (word: string): string => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

/**
 * The index: what the cards are and where what they share is written, then every card by section in a grid, its
 * thumbnail in the reader's theme, its name and what it is, each a way to its page. `from` is the way from the index
 * to `docs/` and `pages` its way to the cards' pages: `docs/cards.md` and the folder's own `docs/cards/README.md`
 * are the one index.
 */
export function indexPage(
  cards: readonly CardDoc[],
  sections: readonly string[],
  { from = '', pages = 'cards/' }: { readonly from?: string; readonly pages?: string } = {},
): string {
  const tile = (card: CardDoc): string =>
    `<a href="${pages}${card.short}.md">${picture(thumbStem(card.short), from, THUMB.width / 2, '')}<br><b>${html(card.name)}</b></a><br>${html(card.description)}`;
  return `${[
    generated('the catalogue and the gallery (tools/docs/src/pages.ts)'),
    '# The cards',
    `${capital(wordsOf(cards.length))} cards, each in the card picker as **Fluvy · …** with a live preview and an editor. Every card has a page of its own: its picture, an example in YAML, a picture of each of its layouts, a YAML with every option, and what each option does. [The live demo](${DEMO}) has each one to try.`,
    'In YAML a card is `type: custom:fluvy-<name>-card` plus the entity or entities it draws and any of its options; an option left at its default is left out.',
    [
      `- [Options every card takes](${from}${CUSTOMISING}#options-every-card-takes): names, icons, colours, actions, how an unavailable entity looks`,
      `- [Customising the cards](${from}${CUSTOMISING}): details sheets, templates, conditions, groups by room, pictures of your own, a state’s colour, thresholds`,
      `- [Energy](${from}energy.md), [the automatic dashboards](${from}automatic-dashboard.md) and [the theme](${from}theme.md): the cards at work together`,
    ].join('\n'),
    sections.map((section) => `[${section}](#${anchorOf(section)})`).join(' · '),
    ...sections.flatMap((section) => [
      `## ${section}`,
      grid(cards.filter((card) => card.section === section).map(tile), INDEX_ROW),
    ]),
  ].join('\n\n')}\n`;
}

/** A key as the data says it: no group, and a default only where there is one. */
const keyData = (key: Key): Record<string, unknown> => ({
  key: key.key,
  label: key.label,
  ...(key.meaning ? { does: key.meaning } : {}),
  ...(key.helper ? { helper: key.helper } : {}),
  type: key.type,
  ...(key.required ? { required: true } : {}),
  ...('default' in key ? { default: key.default } : {}),
  ...(key.defaultWords ? { default_in_words: key.defaultWords } : {}),
  ...(key.values.length
    ? { values: Object.fromEntries(key.values.map(({ value, label }) => [value, label])) }
    : {}),
  ...(key.range ? { range: key.range } : {}),
});

/** A picture's files and its size as the data says them, by its stem. */
const pictureData = (stem: string, pictures: Manifest): Record<string, unknown> => ({
  light: `images/cards/${pictureName(stem, 'light')}`,
  dark: `images/cards/${pictureName(stem, 'dark')}`,
  ...(pictures[stem] ? { width: pictures[stem]?.width, height: pictures[stem]?.height } : {}),
});

/** Every card as data: what `docs/cards.json` holds. */
export function cardsData(cards: readonly CardDoc[], pictures: Manifest): unknown {
  return {
    about:
      'Fluvy’s cards as data, generated from the cards’ editors by `pnpm docs:cards`. A card is `type` plus any of its `keys`; `does` says what a key does, `label` and `helper` are the editor’s words for it, `default` what the card does when the key is left out (never written by the editor), `values` a choice’s values with the editor’s word for each. `lists` are edited item by item: an item is the `id` field alone (a bare entity id) or a map with it and any of `item`. `example` draws the pictures; `layouts` are the example with one more key each, `layout_pictures` the picture of each; `demo` opens the example in the live demo. Paths are relative to docs/.',
    cards: cards.map((card) => ({
      type: `custom:${card.tag}`,
      name: card.name,
      description: card.description,
      section: card.section,
      page: `cards/${card.short}.md`,
      ...(card.example
        ? {
            demo: demoOf(card.short),
            pictures: pictureData(card.short, pictures),
            example: card.example.config,
          }
        : {}),
      ...(card.layout
        ? {
            layout: card.layout,
            layouts: Object.fromEntries(
              card.drawn.flatMap((one) => (one.layout ? [[one.layout, one.config]] : [])),
            ),
            layout_pictures: Object.fromEntries(
              card.drawn.flatMap((one) =>
                one.layout
                  ? [[one.layout, pictureData(pictureStem(card.short, one.layout), pictures)]]
                  : [],
              ),
            ),
          }
        : {}),
      keys: card.keys.map(keyData),
      ...(card.lists.length
        ? {
            lists: card.lists.map((list) => ({
              key: list.key,
              label: list.label,
              ...(list.meaning ? { does: list.meaning } : {}),
              ...(list.helper ? { helper: list.helper } : {}),
              id: list.id,
              ...(list.sections ? { between_items: list.sections } : {}),
              item: list.item.map(keyData),
            })),
          }
        : {}),
      ...(card.reads.length
        ? {
            older_names: card.reads.map((read) => ({
              from: read.from,
              ...(read.to ? { to: read.to } : {}),
              ...(read.partly ? { some_values_only: true } : {}),
            })),
          }
        : {}),
    })),
  };
}

/** The docs as an assistant finds its way in them: what Fluvy is, where the cards' data is, a line a card. */
export function llmsText(cards: readonly CardDoc[], sections: readonly string[]): string {
  const lines = [
    '# Fluvy',
    '',
    '> Fluvy is a theme and a card library for Home Assistant, installed through HACS. Its cards are Lovelace custom cards: in YAML a card is `type: custom:fluvy-<name>-card` plus the entity or entities it draws and any option of its editor.',
    '',
    'To write a card’s configuration, read its page: it has the card’s picture, the YAML that draws the picture, each of its layouts with the lines that choose it, a table of every option (its default, what it does, the values it takes), the fields of its lists’ items, its guide where it has one, and the older names it still reads. A key left at its default is left out. The same facts for every card at once, with every key’s type, are in cards.json.',
    '',
    '## Data',
    '',
    `- [cards.json](${RAW}/cards.json): every card’s keys, what each does, types, defaults, values, the editor’s words, its example, its layouts and its pictures`,
    `- [The live demo](${DEMO}): every card’s example on a simulated house, \`?card=<card>\` for one of them, with its YAML`,
    '',
    ...sections.flatMap((section) => [
      `## ${section}`,
      '',
      ...cards
        .filter((card) => card.section === section)
        .map(
          (card) =>
            `- [${card.name}](${RAW}/cards/${card.short}.md): \`custom:${card.tag}\`. ${card.description}`,
        ),
      '',
    ]),
    '## Guides',
    '',
    `- [The cards](${RAW}/cards.md): the index of the cards, by section`,
    `- [Customising the cards](${RAW}/${CUSTOMISING}): what every card shares (names, actions, colours, unavailable entities), details sheets, templates, conditions, groups by room, thresholds`,
    `- [Getting started](${RAW}/getting-started.md): the first dashboard`,
    `- [The automatic dashboards](${RAW}/automatic-dashboard.md): the dashboards Fluvy builds from the house, and their options`,
    `- [Energy](${RAW}/energy.md): the energy cards together`,
    `- [The theme](${RAW}/theme.md): palettes, colours, a colour per card`,
    `- [The settings panel](${RAW}/settings-panel.md): the house's settings`,
    `- [Troubleshooting](${RAW}/troubleshooting.md)`,
  ];
  return `${lines.join('\n')}\n`;
}
