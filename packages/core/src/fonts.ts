/**
 * Inter is part of the design (the 400/600 contrast, tabular numerals, optical size). A theme cannot
 * carry `@font-face`, so the bundle registers the faces itself, from the folder it was loaded from: once
 * in a page, when Fluvy is in use on it (the look says so — the theme on, Settings included, the look covering
 * the app, a wall, a dashboard that wears the look — or a card, a page or the panel of ours connects; a page on
 * another theme fetches none), and in every same-origin panel frame the shell reaches (HACS), whose document
 * has fonts of its own.
 */

/** Inter's Cyrillic (Russian's letters, Ukrainian's, Belarusian's, Serbian's, Bulgarian's, and №): a file of its own. */
const CYRILLIC = 'U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116';
/** Every other letter and symbol, in the Latin file: the two ranges share no character, whichever face came first. */
const LATIN = 'U+0000-03FF, U+0460-048F, U+0492-04AF, U+04B2-2115, U+2117-10FFFF';

/**
 * The faces, each with the characters it draws. The Latin ones are fetched when Fluvy is in use; a Cyrillic one only
 * when the page lays out a Cyrillic letter (the browser fetches a face by its range), so a page in any other language
 * never asks for it.
 */
const FACES: ReadonlyArray<
  readonly [file: string, style: string, range: string, onDemand: boolean]
> = [
  ['inter-variable.woff2', 'normal', LATIN, false],
  ['inter-italic-variable.woff2', 'italic', LATIN, false],
  ['inter-cyrillic-variable.woff2', 'normal', CYRILLIC, true],
  ['inter-italic-cyrillic-variable.woff2', 'italic', CYRILLIC, true],
];

/** A host page that ships Inter itself (the playground, a test) opts out with `__FLUVY_FONTS__ = false`. */
const optedOut = (): boolean =>
  (globalThis as { __FLUVY_FONTS__?: boolean }).__FLUVY_FONTS__ === false;

let folder: string | undefined;

/**
 * Where the font files are: the build's entry says (`fonts/` beside it, in the folder the integration serves the build
 * from) — this module is bundled into a chunk one folder down, so its own URL would miss them.
 */
export function setFontFolder(url: string): void {
  folder = url;
}

/**
 * Said on a document's `fonts` when one of our faces is added to it: a face loaded first and added after fires no
 * `loadingdone`, and what measures text (`FontsSettled`) listens for this beside it. Reading the set itself to find out
 * (its `size`) recomputes the page's styles.
 */
export const FACES_ADDED = 'fluvy-faces-added';

/** Registers the Inter faces in `target` (the page, or a frame's document); the files come from the browser's cache after the first. */
export function addFonts(target: Document): void {
  const Face = (target.defaultView as (Window & typeof globalThis) | null)?.FontFace;
  if (!Face || optedOut()) return;
  // Resolved at run time against wherever the bundle was loaded from; kept out of a
  // `new URL('…', import.meta.url)` literal so the bundler does not try to inline the font files.
  const here: string = import.meta.url;
  const base = new URL(folder ?? new URL('fonts/', here).href);
  for (const [file, style, unicodeRange, onDemand] of FACES) {
    const face = new Face('Inter', `url(${new URL(file, base).href}) format("woff2")`, {
      style,
      weight: '100 900',
      display: 'swap',
      unicodeRange,
    });
    // a face on demand is the page's from the start, fetched once a letter in its range is laid out: the page's fonts
    // then say `loadingdone` themselves, where a face loaded first and added after must be said (`FACES_ADDED`)
    if (onDemand) target.fonts.add(face);
    else
      face
        .load()
        .then((loaded) => {
          target.fonts.add(loaded);
          target.fonts.dispatchEvent(new Event(FACES_ADDED));
        })
        .catch(() => {
          /* Roboto remains: the stack has a real fallback */
        });
  }
}

let requested = false;

/** Registers Inter in this page, once. */
export function ensureFonts(): void {
  if (requested || typeof document === 'undefined') return;
  requested = true;
  addFonts(document);
}
