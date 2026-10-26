import { describe, expect, it } from 'vitest';
import { roundsFit, sandboxOf, webUrl, type Round } from './url.js';

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
