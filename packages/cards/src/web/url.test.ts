import { describe, expect, it } from 'vitest';
import { roundsFit, sandboxOf, stateLayout, webUrl, type PlateRoom, type Round } from './url.js';

/** A dashboard served over https, and one over plain http on the home network. */
const SECURE = { href: 'https://ha.example/lovelace/0', protocol: 'https:' };
const PLAIN = { href: 'http://ha.local:8123/lovelace/0', protocol: 'http:' };

describe('webUrl', () => {
  it('frames an https page, its host for the head’s line', () => {
    expect(webUrl('https://www.lightningmaps.org/?lang=en#m=oss', SECURE)).toEqual({
      state: 'ok',
      href: 'https://www.lightningmaps.org/?lang=en#m=oss',
      host: 'www.lightningmaps.org',
    });
  });

  it('frames an http page on an http dashboard, and keeps it back on an https one', () => {
    expect(webUrl('http://grafana.local:3000/d/abc', PLAIN)).toEqual({
      state: 'ok',
      href: 'http://grafana.local:3000/d/abc',
      host: 'grafana.local:3000',
    });
    expect(webUrl('http://grafana.local:3000/d/abc', SECURE)).toEqual({
      state: 'insecure',
      href: 'http://grafana.local:3000/d/abc',
      host: 'grafana.local:3000',
    });
  });

  it('resolves a relative address against the dashboard, on its own scheme', () => {
    expect(webUrl('/local/map.html', SECURE)).toEqual({
      state: 'ok',
      href: 'https://ha.example/local/map.html',
      host: 'ha.example',
    });
    expect(webUrl('local/map.html', PLAIN)).toEqual({
      state: 'ok',
      href: 'http://ha.local:8123/lovelace/local/map.html',
      host: 'ha.local:8123',
    });
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<p>hi</p>',
    'blob:https://ha.example/8f4e',
    'file:///etc/hosts',
    'ftp://files.example/',
    'http://',
    '',
    '   ',
    undefined,
    42,
  ])('refuses %j', (value) => {
    expect(webUrl(value, SECURE)).toEqual({ state: 'refused' });
  });
});

describe('sandboxOf', () => {
  it('standard is Home Assistant’s own set, as its iframe card writes it', () => {
    expect(sandboxOf('standard', false)).toBe(
      'allow-forms allow-popups allow-pointer-lock allow-same-origin allow-scripts allow-modals allow-downloads',
    );
  });

  it('top navigation adds Home Assistant’s token to either level', () => {
    expect(sandboxOf('standard', true)).toBe(
      'allow-forms allow-popups allow-pointer-lock allow-same-origin allow-scripts allow-modals allow-downloads allow-top-navigation-by-user-activation',
    );
    expect(sandboxOf('strict', true)).toBe(
      'allow-forms allow-pointer-lock allow-scripts allow-top-navigation-by-user-activation',
    );
  });

  it('strict keeps the page from its identity, pop-ups, modals and downloads', () => {
    expect(sandboxOf('strict', false)).toBe('allow-forms allow-pointer-lock allow-scripts');
  });

  it('off is no sandbox at all', () => {
    expect(sandboxOf('off', false)).toBeUndefined();
    expect(sandboxOf('off', true)).toBeUndefined();
  });
});

describe('roundsFit', () => {
  const ALL: readonly Round[] = ['reload', 'open', 'fullscreen'];

  it.each<[number, readonly Round[], readonly Round[]]>([
    // a half card of 152 (its plate 112): one round and its ends take 68, two 120
    [112, ALL, ['fullscreen']],
    // 172 (132): two fit, three (172) do not
    [132, ALL, ['open', 'fullscreen']],
    // a full card of 211 (171): one short of three
    [171, ALL, ['open', 'fullscreen']],
    [172, ALL, ALL],
    [320, ALL, ALL],
    // what is not asked for is not drawn; what is asked for goes in the same order
    [112, ['open', 'fullscreen'], ['fullscreen']],
    [132, ['reload', 'fullscreen'], ['reload', 'fullscreen']],
    [112, ['reload', 'fullscreen'], ['fullscreen']],
    [320, ['fullscreen', 'open'], ['open', 'fullscreen']],
    [320, ['open'], ['open']],
    // the last round never goes, whatever the width
    [20, ['fullscreen'], ['fullscreen']],
    [20, ['reload'], ['reload']],
    [320, [], []],
  ])('at %i, %j keeps %j', (width, wanted, kept) => {
    expect(roundsFit(width, wanted)).toEqual(kept);
  });
});

describe('stateLayout', () => {
  /** The off plate's words as English lays them out at 13/500 ("This page needs https", "Needs https"). */
  const OFF = { full: 140, short: 76, glyph: true };
  /** The slow plate's: "Still loading", "Loading", and the link to the tab with its dot. */
  const SLOW = { full: 84, short: 52, link: 140 };
  const at = (width: number, height: number, rounds = 2): PlateRoom => ({ width, height, rounds });

  it('lays the globe over the words above the rounds where the plate holds both (a phone’s 288 × 164)', () => {
    // 164 less the rounds' 56 and the block's 76 leaves 32: 16 above it, 16 under it
    expect(stateLayout(at(288, 164), OFF)).toEqual({
      place: 'above',
      glyph: true,
      words: 'full',
      link: false,
      top: 16,
      reserve: 56,
    });
    // a bare phone card's 328 × 184 leaves 52: the block starts on the 4 grid, the odd 4 under it
    expect(stateLayout(at(328, 184), OFF)).toMatchObject({ glyph: true, top: 24 });
  });

  it('gives the globe up, then the full words, before anything goes under the rounds', () => {
    // 266's plate (226 × 128): 56 over the rounds within its 8s, the globe and a line 76 — the line alone
    expect(stateLayout(at(226, 128), OFF)).toMatchObject({ glyph: false, words: 'full' });
    // 211's (171 × 96): one line of 24 and its 8 above and below; the full words are 140 of 139
    expect(stateLayout(at(171, 96), OFF)).toMatchObject({
      place: 'above',
      glyph: false,
      words: 'short',
    });
  });

  it('goes beside the rounds on a plate wide and low, short where the full words do not hold there', () => {
    expect(stateLayout(at(320, 68), OFF)).toEqual({
      place: 'beside',
      glyph: false,
      words: 'full',
      link: false,
      reserve: 12 + 96 + 16,
    });
    expect(stateLayout(at(240, 68), OFF)).toMatchObject({ place: 'beside', words: 'short' });
  });

  it('says nothing where nothing holds: a half card’s plate of 68 or 76, and a bare one of 84', () => {
    expect(stateLayout(at(112, 68, 1), OFF)).toBeUndefined();
    expect(stateLayout(at(132, 76), OFF)).toBeUndefined();
    expect(stateLayout(at(152, 84), OFF)).toBeUndefined();
  });

  it('keeps the globe alone on a plate tall and too narrow for the words', () => {
    expect(stateLayout(at(100, 140, 1), OFF)).toMatchObject({ glyph: true, words: 'none' });
  });

  it('offers the tab on the slow line where the line holds it, else the words alone', () => {
    expect(stateLayout(at(320, 180), SLOW)).toMatchObject({ words: 'full', link: true });
    expect(stateLayout(at(226, 128), SLOW)).toMatchObject({ words: 'full', link: false });
    expect(stateLayout(at(100, 128), SLOW)).toMatchObject({ words: 'short', link: false });
  });

  it('takes the whole plate where it has no rounds, and any room where the view or the screen decides it', () => {
    expect(stateLayout(at(171, 96, 0), OFF)).toMatchObject({ glyph: true, reserve: 0 });
    expect(stateLayout(at(171, Number.POSITIVE_INFINITY), OFF)).toMatchObject({
      glyph: true,
      words: 'short',
    });
  });
});
