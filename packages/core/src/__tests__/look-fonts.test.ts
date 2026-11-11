// @vitest-environment happy-dom
import { afterAll, describe, expect, it } from 'vitest';
import { THEME_SENTINEL } from '@fluvy/tokens/config';
import { FACES_ADDED } from '../fonts.js';
import { startLook } from '../look/start.js';

/*
 * Inter is registered by the look once Fluvy is in use on the page, never before: a page on another theme asks for
 * no face of ours, and the moment Home Assistant applies the Fluvy theme (its sentinel inline on <html>) every face is
 * registered, once. The Latin faces are fetched then; the Cyrillic ones are the page's to fetch when it draws a
 * Cyrillic letter, the browser reading their range.
 */

/** The faces the page asked for, as `FontFace` stood in: their family and source, their load answered at once. */
const asked: string[] = [];
const fetched: string[] = [];
const added: FakeFace[] = [];
/** What the page's faces were told as ours were added (`FACES_ADDED`, for what measures text). */
const said: string[] = [];
class FakeFace {
  constructor(
    family: string,
    readonly source: string,
    readonly descriptors: { readonly unicodeRange: string },
  ) {
    asked.push(`${family}: ${source}`);
  }
  load(): Promise<FakeFace> {
    fetched.push(this.source);
    return Promise.resolve(this);
  }
}

/** A unicode-range covers a code point. */
const covers = (range: string, code: number): boolean =>
  range.split(',').some((part) => {
    const [from = '', to = from] = part.trim().replace('U+', '').split('-');
    return code >= parseInt(from, 16) && code <= parseInt(to, 16);
  });

/** The style mutation observed, the faces loaded and added. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('the look registers Inter', () => {
  Object.assign(window, { FontFace: FakeFace });
  Object.defineProperty(document, 'fonts', {
    value: {
      add: (face: FakeFace) => added.push(face),
      dispatchEvent: (event: Event) => said.push(event.type),
    },
    configurable: true,
  });
  const look = startLook();
  afterAll(() => look?.stop());

  it('asks for no face on a page where Fluvy is not in use', async () => {
    expect(look).toBeDefined();
    await settle();
    expect(asked).toEqual([]);
  });

  it('registers every face once Home Assistant applies the theme, and never twice', async () => {
    document.documentElement.style.setProperty(THEME_SENTINEL, '1');
    await settle();
    expect(asked).toEqual([
      expect.stringMatching(/^Inter: url\(.*\/inter-variable\.woff2\) format\("woff2"\)$/),
      expect.stringMatching(/^Inter: url\(.*\/inter-italic-variable\.woff2\) format\("woff2"\)$/),
      expect.stringMatching(/^Inter: url\(.*\/inter-cyrillic-variable\.woff2\) format\("woff2"\)$/),
      expect.stringMatching(
        /^Inter: url\(.*\/inter-italic-cyrillic-variable\.woff2\) format\("woff2"\)$/,
      ),
    ]);
    expect(added).toHaveLength(4);
    // the two loaded first say so as they are added; the two on demand are the page's own to load
    expect(said).toEqual([FACES_ADDED, FACES_ADDED]);
    // the theme applied again (dark mode): nothing more is asked for
    document.documentElement.style.setProperty('--primary-color', '#856529');
    await settle();
    expect(asked).toHaveLength(4);
  });

  it('fetches the Latin faces, and leaves the Cyrillic ones to a page that draws a Cyrillic letter', () => {
    expect(fetched).toEqual([
      expect.stringMatching(/\/inter-variable\.woff2/),
      expect.stringMatching(/\/inter-italic-variable\.woff2/),
    ]);
    // each letter in one file's range: Ж, ё and № in the Cyrillic one, A, ł, ° and → in the Latin one
    const range = (file: string): string =>
      added.find((face) => face.source.includes(`/${file}`))!.descriptors.unicodeRange;
    const latin = range('inter-variable.woff2');
    const cyrillic = range('inter-cyrillic-variable.woff2');
    for (const code of [0x416, 0x451, 0x2116])
      expect([covers(latin, code), covers(cyrillic, code)]).toEqual([false, true]);
    for (const code of [0x41, 0x142, 0xb0, 0x2192])
      expect([covers(latin, code), covers(cyrillic, code)]).toEqual([true, false]);
  });
});
