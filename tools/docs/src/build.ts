/**
 * The cards' docs, written from the code or held to it (#199): a page a card in `docs/cards/`, each with the guide
 * written by hand for it in `tools/docs/guides/<card>.md` where there is one, the index in `docs/cards.md` and the
 * same beside the pages in `docs/cards/README.md`, and the same for an assistant in `docs/cards.json` and
 * `docs/llms.txt`. With `--check` nothing is written: it fails where a file is not what the code and the guides say,
 * and where the gallery, the pictures, the defaults, the sentences or the guides fall short (`checks.ts`). The
 * pictures are `pnpm docs:images`'s, taken in a browser; this reads only their manifest.
 *
 *   pnpm docs:cards                     writes the pages, the index and the data
 *   pnpm --filter @fluvy/docs check     what `pnpm check` runs
 */
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readCards, SECTIONS } from './cards.js';
import {
  checkDefaults,
  checkGallery,
  checkGuides,
  checkMeanings,
  checkPictures,
} from './checks.js';
import { ROOT } from './facts.js';
import { cardPage, cardsData, GUIDES, indexPage, llmsText, type Guides } from './pages.js';
import { FOLDER, MANIFEST, type Manifest } from './pictures.js';

const check = process.argv.includes('--check');
const PAGES = join(ROOT, 'docs', 'cards');
/** The index as the folder of the pages shows it on GitHub, under its files. */
const FOLDER_INDEX = 'README.md';

const cards = await readCards();
const sections = SECTIONS.map(([title]) => title);
const pictures = join(ROOT, FOLDER);
// the folder's files and its thumbnails', each by its way from the folder
const files = await readdir(pictures, { recursive: true }).catch(() => [] as string[]);
const manifest = JSON.parse(
  await readFile(join(pictures, MANIFEST), 'utf8').catch(() => '{}'),
) as Manifest;

/** The guides written by hand, each by its file's name without `.md`. */
const guides: Guides = Object.fromEntries(
  await Promise.all(
    (await readdir(join(ROOT, GUIDES)).catch(() => [] as string[]))
      .filter((name) => name.endsWith('.md'))
      .map(
        async (name) =>
          [name.slice(0, -'.md'.length), await readFile(join(ROOT, GUIDES, name), 'utf8')] as const,
      ),
  ),
);

/** Every file this writes, by its path from the repository's root, and what it holds. */
const written = new Map<string, string>([
  ['docs/cards.md', indexPage(cards, sections)],
  [`docs/cards/${FOLDER_INDEX}`, indexPage(cards, sections, { from: '../', pages: '' })],
  ...cards.map(
    (card) => [`docs/cards/${card.short}.md`, cardPage(card, manifest, guides)] as const,
  ),
  ['docs/cards.json', `${JSON.stringify(cardsData(cards, manifest), null, 2)}\n`],
  ['docs/llms.txt', llmsText(cards, sections)],
]);
const pages = new Set([FOLDER_INDEX, ...cards.map((card) => `${card.short}.md`)]);
const strays = (await readdir(PAGES).catch(() => [] as string[])).filter(
  (name) => !pages.has(name),
);

if (check) {
  const found = [
    ...checkGallery(cards),
    ...checkPictures(cards, files, manifest),
    ...checkDefaults(cards),
    ...checkMeanings(cards),
    ...checkGuides(cards, guides),
  ];
  for (const [path, text] of written)
    if ((await readFile(join(ROOT, path), 'utf8').catch(() => undefined)) !== text)
      found.push(`${path} is not what the code says: run pnpm docs:cards`);
  for (const name of strays)
    found.push(`docs/cards/${name} is the page of no card: run pnpm docs:cards`);
  if (found.length) {
    for (const line of found) console.error(`✗ ${line}`);
    process.exit(1);
  }
  console.log(
    `✓ the cards' docs: ${cards.length} cards, their pages, pictures, sentences, guides and data as the code says`,
  );
} else {
  await mkdir(PAGES, { recursive: true });
  for (const [path, text] of written) await writeFile(join(ROOT, path), text);
  for (const name of strays) await rm(join(PAGES, name));
  console.log(
    `docs: ${cards.length} cards in ${sections.length} sections, their pages, the index, cards.json and llms.txt`,
  );
}
