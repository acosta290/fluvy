// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { derivePalette, onDarkPage, seedOf } from '@fluvy/tokens/runtime';
import {
  BACKGROUND_DEFAULTS,
  drawsNothing,
  HOUSE_DEFAULTS,
  imageAddress,
  parseBackground,
  parseHouse,
  PERSONAL_DEFAULTS,
  resolveSettings,
  SETTINGS_VERSION,
  type PageBackground,
} from '../settings/index.js';
import { WALL_ATTRIBUTE } from '../look/attributes.js';
import { BACKGROUND_ATTRIBUTE, paintRoot, wallKeepsOwn } from '../look/background.js';
import {
  backgroundOf,
  backgroundStyle,
  layerCss,
  paint,
  styleText,
} from '../look/background-layer.js';
import type { Look } from '../look/css.js';
import type { RootElement } from '../look/tabs.js';

const LOOK: Look = { palette: 'linen', shape: 'soft', pills: 'round' };
const bg = (more: Partial<PageBackground>): PageBackground => ({ ...BACKGROUND_DEFAULTS, ...more });

describe('the page’s background setting (1.19, #155)', () => {
  it('is plain until the house chooses one: a version 3 house reads plain, and nothing changes on upgrade', () => {
    expect(HOUSE_DEFAULTS.background).toEqual({
      type: 'plain',
      colors: ['#dbe5d8'],
      image: '',
      dim: 40,
      blur: false,
    });
    const upgraded = parseHouse({ version: 3, palette: 'volt' });
    expect(upgraded.background).toEqual(BACKGROUND_DEFAULTS);
    expect(upgraded.version).toBe(SETTINGS_VERSION);
    expect(SETTINGS_VERSION).toBe(5);
    expect(drawsNothing(upgraded.background)).toBe(true);
    expect(resolveSettings(upgraded, PERSONAL_DEFAULTS).background).toEqual(BACKGROUND_DEFAULTS);
  });

  it('keeps what is well formed, field by field', () => {
    expect(
      parseBackground({
        type: 'image',
        colors: ['#1D4ED8', '#60a5fa', '#000000'],
        image: '/local/backgrounds/dunes.jpg',
        dim: 60,
        blur: true,
      }),
    ).toEqual({
      type: 'image',
      colors: ['#1d4ed8', '#60a5fa'],
      image: '/local/backgrounds/dunes.jpg',
      dim: 60,
      blur: true,
    });
    expect(parseHouse({ background: { type: 'gradient' } }).background).toEqual(
      bg({ type: 'gradient' }),
    );
    // a colour that is not a hex is dropped, the rest kept; none left: the default's
    expect(parseBackground({ type: 'color', colors: ['red', '#abcdef'] }).colors).toEqual([
      '#abcdef',
    ]);
    expect(parseBackground({ type: 'color', colors: ['red', '#abc'] }).colors).toEqual(['#dbe5d8']);
  });

  it('takes the default for anything missing, broken or unknown', () => {
    expect(parseBackground(undefined)).toEqual(BACKGROUND_DEFAULTS);
    expect(parseBackground('image')).toEqual(BACKGROUND_DEFAULTS);
    expect(
      parseBackground({
        type: 'photo',
        colors: '#ffffff',
        image: 'javascript:alert(1)',
        dim: 85,
        blur: 'yes',
      }),
    ).toEqual(BACKGROUND_DEFAULTS);
    // the dim on its 5 % steps, 0 to 80
    for (const dim of [42, -5, 90, '40', null, Number.NaN])
      expect(parseBackground({ dim }).dim).toBe(40);
    for (const dim of [0, 5, 80]) expect(parseBackground({ dim }).dim).toBe(dim);
  });

  it('draws nothing plain, nor a picture without an address', () => {
    expect(drawsNothing(bg({ type: 'plain' }))).toBe(true);
    expect(drawsNothing(bg({ type: 'image' }))).toBe(true);
    expect(drawsNothing(bg({ type: 'image', image: '/local/a.jpg' }))).toBe(false);
    expect(drawsNothing(bg({ type: 'gradient' }))).toBe(false);
    expect(drawsNothing(bg({ type: 'color' }))).toBe(false);
  });
});

describe('a picture’s address, before it reaches CSS', () => {
  it('takes a path of Home Assistant’s or an http(s) address, the space around it dropped', () => {
    for (const address of [
      '/local/backgrounds/dunes.jpg',
      '/local/fondos/montaña.jpg',
      '/local/a%20b.jpg',
      '/api/image/serve/abc123/original',
      '/',
      'https://example.com/a.jpg?w=1920&h=1080#top',
      'http://10.0.0.5:8123/local/x.png',
      'HTTPS://example.com/X.PNG',
      'https://[2001:db8::1]/a.jpg',
      'https://example.com/~me/a+b,c=d!$*.webp',
      // an at sign in the path is the path's
      '/local/icons/sun@2x.png',
      'https://example.com/a@2x.jpg?by=me@example.com',
    ])
      expect(imageAddress(address), address).toBe(address);
    expect(imageAddress('  /local/x.jpg \n')).toBe('/local/x.jpg');
  });

  it('refuses whatever could end the CSS string or declaration it is written into', () => {
    for (const address of [
      '/local/a".jpg',
      "/local/a'.jpg",
      '/local/a).jpg',
      '/local/a(.jpg',
      '/local/a b.jpg',
      '/local/a\tb.jpg',
      '/local/a\nb.jpg',
      '/local/a b.jpg',
      '/local/a b.jpg',
      '/local/a\\b.jpg',
      '/local/a;b.jpg',
      '/local/a{b}.jpg',
      '/local/<b>.jpg',
      '/local/a`b.jpg',
      '/local/a\u0000b.jpg',
      '/local/a\u007fb.jpg',
      '/local/x.jpg") ; background: red; x:url("',
      // an invisible character: a zero-width space, a joiner, a direction mark or override, a byte-order mark, a soft
      // hyphen
      '/local/a\u200bb.jpg',
      'https://example.com/a\u200d.jpg',
      '/local/a\u200eb.jpg',
      '/local/\u202egpj.exe',
      '/local/a\ufeff.jpg',
      'https://exam\u00adple.com/a.jpg',
    ])
      expect(imageAddress(address), JSON.stringify(address)).toBeUndefined();
  });

  it('refuses a name or a password before the host, which a browser will not send for a picture', () => {
    for (const address of [
      'https://user:pass@example.com/a.jpg',
      'https://user@example.com/a.jpg',
      'http://:secret@10.0.0.5:8123/local/x.png',
      'https://user@example.com',
      'https://example.com@ha.example/a.jpg',
    ])
      expect(imageAddress(address), address).toBeUndefined();
  });

  it('refuses every scheme but http and https, a host-less address, a path of another host and anything not text', () => {
    for (const address of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:image/png;base64,iVBORw0KGgo=',
      'data:image/svg+xml,<svg/>',
      'blob:https://example.com/0f1e',
      'file:///etc/passwd',
      'ftp://example.com/a.jpg',
      'vbscript:x',
      '//example.com/a.jpg',
      '/\\example.com/a.jpg',
      'https://',
      'https:///a.jpg',
      'local/a.jpg',
      'a.jpg',
      '',
      '   ',
      `/local/${'a'.repeat(2048)}.jpg`,
    ])
      expect(imageAddress(address), address.slice(0, 60)).toBeUndefined();
    for (const value of [undefined, null, 7, ['/local/a.jpg'], { image: '/local/a.jpg' }])
      expect(imageAddress(value)).toBeUndefined();
  });
});

describe('the layer’s values (1.19, #155)', () => {
  const linen = derivePalette(seedOf('linen'));

  it('draws nothing plain, a picture without an address, nor one whose address was never checked', () => {
    expect(backgroundStyle(bg({ type: 'plain' }), LOOK, false)).toBeUndefined();
    expect(backgroundStyle(bg({ type: 'image' }), LOOK, false)).toBeUndefined();
    // an object that never went through the parse: the address is checked where it is written
    const forged = { ...bg({ type: 'image' }), image: '/local/x.jpg"),url("https://example.com/' };
    expect(backgroundStyle(forged, LOOK, false)).toBeUndefined();
  });

  it('gives the gradient nothing of its own: the palette’s mesh over the page, in its mode', () => {
    expect(backgroundStyle(bg({ type: 'gradient' }), LOOK, true)).toEqual({
      type: 'gradient',
      blur: false,
      ink: false,
      vars: {},
    });
  });

  it('keeps a pale colour in light mode with the palette’s ink, and takes it to the dark page’s lightness in dark mode', () => {
    const sage = bg({ type: 'color', colors: ['#dbe5d8'] });
    expect(backgroundStyle(sage, LOOK, false)).toEqual({
      type: 'color',
      blur: false,
      ink: false,
      vars: { '--fluvy-bg-1': '#dbe5d8' },
    });
    expect(backgroundStyle(sage, LOOK, true)?.vars).toEqual({
      '--fluvy-bg-1': onDarkPage('#dbe5d8', linen.dark.surface.page),
    });
  });

  it('gives the words on the page the light ink on a deep colour in light mode, and keeps a deep colour in dark mode', () => {
    const blue = bg({ type: 'color', colors: ['#1d4ed8', '#60a5fa'] });
    expect(backgroundStyle(blue, LOOK, false)).toEqual({
      type: 'color',
      blur: false,
      ink: true,
      vars: {
        '--fluvy-bg-1': '#1d4ed8',
        '--fluvy-bg-2': '#60a5fa',
        '--fluvy-page-ink': '#ffffff',
        '--fluvy-page-ink-2': 'rgb(255 255 255 / 0.84)',
      },
    });
    expect(backgroundStyle(blue, LOOK, true)).toEqual({
      type: 'color',
      blur: false,
      ink: false,
      vars: { '--fluvy-bg-1': '#1d4ed8', '--fluvy-bg-2': '#60a5fa' },
    });
  });

  it('writes a picture into a quoted url() with its dim, out of focus where asked', () => {
    const picture = bg({ type: 'image', image: '/local/backgrounds/dunes.jpg', blur: true });
    const style = backgroundStyle(picture, LOOK, false)!;
    expect(style).toEqual({
      type: 'image',
      blur: true,
      ink: false,
      vars: { '--fluvy-bg-image': 'url("/local/backgrounds/dunes.jpg")', '--fluvy-bg-dim': '40%' },
    });
    expect(styleText(style)).toBe(
      '--fluvy-bg-image:url("/local/backgrounds/dunes.jpg");--fluvy-bg-dim:40%',
    );
  });

  it('is never drawn with `background-attachment: fixed`', () => {
    const css = layerCss((mark) => `.x${mark} .layer`);
    expect(css).not.toMatch(/attachment|fixed/);
    expect(css).toContain('.x[fluvy-bg="image"] .layer::after');
    expect(css).toContain('.x[fluvy-bg-blur] .layer::before');
  });
});

/** A dashboard's root as Home Assistant keeps it: its panel, its views (the first shown), its raw configuration. */
function root(
  config: Record<string, unknown> = {},
  strategy?: Record<string, unknown>,
  panelUrl = 'fluvy-home',
): RootElement {
  const element = document.createElement('div') as unknown as RootElement;
  Object.assign(element, {
    hass: { panelUrl },
    lovelace: { config: { views: [{}], ...config }, rawConfig: strategy ? { strategy } : {} },
    _curView: 0,
  });
  return element;
}
const IMAGE = bg({ type: 'image', image: '/local/dunes.jpg' });

describe('the background a dashboard’s root wears', () => {
  it('is none where the dashboard does not wear the look, or the house’s draws nothing', () => {
    expect(backgroundOf(root(), undefined)).toBeUndefined();
    expect(backgroundOf(root(), BACKGROUND_DEFAULTS)).toBeUndefined();
    expect(backgroundOf(root(), IMAGE)).toBe(IMAGE);
  });

  it('is none where the view or the dashboard has one in Home Assistant’s own key: Home Assistant draws it, as before', () => {
    expect(backgroundOf(root({ views: [{ background: '#000' }] }), IMAGE)).toBeUndefined();
    expect(backgroundOf(root({ background: { image: '/local/x.jpg' } }), IMAGE)).toBeUndefined();
  });

  it('is the dashboard’s own over the house’s, its own plain too; a strategy not of ours says nothing', () => {
    const blue = { type: 'color', colors: ['#1d4ed8'] };
    expect(backgroundOf(root({}, { type: 'custom:fluvy-home', background: blue }), IMAGE)).toEqual(
      bg({ type: 'color', colors: ['#1d4ed8'] }),
    );
    expect(
      backgroundOf(root({}, { type: 'custom:fluvy-wall', background: { type: 'plain' } }), IMAGE),
    ).toBeUndefined();
    expect(backgroundOf(root({}, { type: 'custom:other', background: blue }), IMAGE)).toBe(IMAGE);
  });

  it('is none in a panel of Home Assistant’s own that draws a root (its Energy), the dashboards’ panel kept', () => {
    for (const [panel, worn] of [
      ['ha-panel-energy', false],
      ['ha-panel-home', false],
      ['ha-panel-lovelace', true],
    ] as const) {
      const host = document.createElement(panel);
      const shadow = host.attachShadow({ mode: 'open' });
      const element = root();
      shadow.append(element as unknown as Node);
      expect(backgroundOf(element, IMAGE) !== undefined, panel).toBe(worn);
    }
  });

  it('gives way on a wall to the wall’s own choice, its mesh or plain; the dashboard’s comes through where the wall lets it', () => {
    expect(wallKeepsOwn(document, 'plain')).toBe(false);
    document.documentElement.setAttribute(WALL_ATTRIBUTE, '');
    expect(wallKeepsOwn(document, 'plain')).toBe(true);
    expect(wallKeepsOwn(document, 'wall')).toBe(true);
    expect(wallKeepsOwn(document, 'dashboard')).toBe(false);
    document.documentElement.removeAttribute(WALL_ATTRIBUTE);
  });
});

describe('a root wearing its background', () => {
  it('carries its type, its marks and its checked values, and gives them all back when it wears none', () => {
    const element = root();
    paint(
      element,
      bg({ type: 'image', image: '/local/dunes.jpg', blur: true, dim: 20 }),
      LOOK,
      false,
    );
    expect(element.getAttribute(BACKGROUND_ATTRIBUTE)).toBe('image');
    expect(element.hasAttribute('fluvy-bg-blur')).toBe(true);
    expect(element.style.getPropertyValue('--fluvy-bg-image')).toBe('url("/local/dunes.jpg")');
    expect(element.style.getPropertyValue('--fluvy-bg-dim')).toBe('20%');
    paint(element, bg({ type: 'color', colors: ['#1d4ed8'] }), LOOK, false);
    expect(element.getAttribute(BACKGROUND_ATTRIBUTE)).toBe('color');
    expect(element.hasAttribute('fluvy-bg-blur')).toBe(false);
    expect(element.hasAttribute('fluvy-bg-ink')).toBe(true);
    expect(element.style.getPropertyValue('--fluvy-bg-image')).toBe('');
    expect(element.style.getPropertyValue('--fluvy-page-ink')).toBe('#ffffff');
    paint(element, undefined, LOOK, false);
    expect(element.hasAttribute(BACKGROUND_ATTRIBUTE)).toBe(false);
    expect(element.hasAttribute('fluvy-bg-ink')).toBe(false);
    expect(element.getAttribute('style') ?? '').toBe('');
  });

  it('blurs nothing on a device that draws Lite (#165): the picture in focus, its header told to stand solid', () => {
    const element = root();
    const picture = bg({ type: 'image', image: '/local/dunes.jpg', blur: true, dim: 20 });
    paint(element, picture, LOOK, false, true);
    expect(element.getAttribute(BACKGROUND_ATTRIBUTE)).toBe('image');
    expect(element.hasAttribute('fluvy-bg-blur')).toBe(false);
    expect(element.hasAttribute('fluvy-bg-still')).toBe(true);
    // Full again: the blur the house chose comes back
    paint(element, picture, LOOK, false);
    expect(element.hasAttribute('fluvy-bg-blur')).toBe(true);
    expect(element.hasAttribute('fluvy-bg-still')).toBe(false);
    // a page that wears none carries no mark of it
    paint(element, undefined, LOOK, false, true);
    expect(element.hasAttribute('fluvy-bg-still')).toBe(false);
  });

  it('is put on through the lazy layer, and a plain root that never wore one is left as it is', async () => {
    const plain = root();
    paintRoot(plain, undefined, LOOK, false);
    expect(plain.hasAttributes()).toBe(false);
    const element = root();
    paintRoot(element, bg({ type: 'gradient' }), LOOK, false);
    await expect.poll(() => element.getAttribute(BACKGROUND_ATTRIBUTE)).toBe('gradient');
    paintRoot(element, undefined, LOOK, false);
    await expect.poll(() => element.hasAttribute(BACKGROUND_ATTRIBUTE)).toBe(false);
    // a plain house, a dashboard that says its own: the layer draws the dashboard's
    const own = root({}, { type: 'custom:fluvy-home', background: { type: 'gradient' } });
    paintRoot(own, BACKGROUND_DEFAULTS, LOOK, false);
    await expect.poll(() => own.getAttribute(BACKGROUND_ATTRIBUTE)).toBe('gradient');
  });
});
