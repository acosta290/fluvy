// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, shownNames } from '../shared/fixtures/editor.js';
import { COMMON_ALIASES, normaliseConfig } from '../shared/config.js';
import { MINUTE } from '../shared/ticker.js';
import { webHeight } from '../web-family.js';
import { serveFrames, untilLoaded } from './fixtures.js';
import { FluvyWebCard, webPlate } from './web-card.js';

// the web page card's chunk lands before a card is drawn
await familiesDefined;

const TYPE = 'custom:fluvy-web-card';
const URL_ = 'https://www.lightningmaps.org/';

const house = (): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: {},
    entities: {},
    devices: {},
    areas: {},
    user: { id: 'u', name: 'Marta', is_admin: true },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
    callService: () => Promise.resolve(),
  }) as unknown as HomeAssistant;

type CardElement = FluvyWebCard & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
};

async function drawn(
  config: Omit<LovelaceCardConfig, 'type'>,
  width = 360,
): Promise<{ card: CardElement; root: ShadowRoot; frame: () => HTMLIFrameElement | null }> {
  const card = document.createElement('fluvy-web-card') as CardElement;
  card.setConfig({ type: TYPE, url: URL_, ...config });
  card.hass = house();
  card.width = width;
  document.body.append(card);
  await card.updateComplete;
  const root = card.shadowRoot!;
  return { card, root, frame: () => root.querySelector<HTMLIFrameElement>('iframe') };
}

/** The plate's rounds by what a reader hears. */
const labels = (root: ShadowRoot): string[] =>
  [...root.querySelectorAll('.dv-cam__actions .fv-round')].map(
    (el) => el.getAttribute('aria-label') ?? '',
  );

/** A dashboard served over https: an http page is kept back there. */
const secure = (): void => {
  vi.stubGlobal('location', { href: 'https://ha.example/lovelace/0', protocol: 'https:' });
};

// every frame is answered with a page of nothing, so its load is real; `hang` holds a page back
const frames = serveFrames();

beforeEach(() => frames.hang(false));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('heights: the plate in its shape, or at its height, under the head or alone', () => {
  it.each([
    [{}, 280],
    [{ variant: 'plate' }, 280],
    [{ variant: 'frame' }, 220],
    [{ variant: 'bare' }, 204],
    [{ aspect_ratio: '4:3' }, 340],
    [{ variant: 'bare', aspect_ratio: '4:3' }, 272],
    [{ aspect_ratio: '21:9' }, 236],
    // Home Assistant's own form of a shape; the view's height is 16:9 where there is no view to fill
    [{ aspect_ratio: '56%' }, 280],
    [{ aspect_ratio: 'fill' }, 280],
    // a height written wins, landed on the 4 grid, never under the plate's floor
    [{ height: 300 }, 400],
    [{ height: 301, aspect_ratio: '1:1' }, 400],
    [{ height: 10 }, 168],
    [{ variant: 'frame', height: 500 }, 540],
    [{ variant: 'bare', height: 100 }, 100],
  ])('%j: %i', (config, height) => {
    const full = { type: TYPE, url: URL_, ...config };
    expect(webHeight(full)).toBe(height);
    expect(FluvyWebCard.layoutHeight(full)).toBe(height);
  });

  it('the plate across a width: the shape, or the height written', () => {
    expect(webPlate({}, 320)).toBe(180);
    expect(webPlate({ aspect_ratio: '1:1' }, 112)).toBe(112);
    expect(webPlate({ height: 90 }, 320)).toBe(92);
    expect(webPlate({ height: 40 }, 320)).toBe(68);
  });

  it.each([
    [{}, 180],
    [{ variant: 'frame' }, 180],
    [{ variant: 'bare' }, 204],
    [{ height: 120 }, 120],
  ])('%j draws its plate at that height on a 360 card', async (config, height) => {
    const { root } = await drawn(config);
    expect(root.querySelector<HTMLElement>('.wb-plate')!.style.height).toBe(`${height}px`);
  });

  it('says its masonry size from its height', async () => {
    expect((await drawn({})).card.getCardSize()).toBe(6);
    expect((await drawn({ variant: 'bare' })).card.getCardSize()).toBe(5);
  });
});

describe('the address', () => {
  it('the stub frames Home Assistant’s own site', () => {
    expect(FluvyWebCard.getStubConfig()).toEqual({
      type: TYPE,
      url: 'https://www.home-assistant.io/',
    });
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'blob:https://x/y', '', undefined])(
    'refuses %j with a readable error',
    (url) => {
      const card = document.createElement('fluvy-web-card') as CardElement;
      expect(() => card.setConfig({ type: TYPE, url })).toThrow(
        '"url" must be an http or https address',
      );
    },
  );

  it('frames the page with no referrer, lazily, titled, with Home Assistant’s permissions policy', async () => {
    const { frame } = await drawn({});
    const el = frame()!;
    expect(el.getAttribute('src')).toBe(URL_);
    expect(el.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(el.getAttribute('loading')).toBe('lazy');
    expect(el.getAttribute('allow')).toBe('fullscreen');
    expect(el.getAttribute('title')).toBe('Web page');
    document.body.replaceChildren();
    const named = await drawn({ title: 'Lightning', allow: 'geolocation' });
    expect(named.frame()!.getAttribute('title')).toBe('Lightning');
    expect(named.frame()!.getAttribute('allow')).toBe('geolocation');
  });

  it('the head says the title and the page’s host; the globe by default', async () => {
    const { root } = await drawn({});
    expect(root.querySelector('.fv-card__title')!.textContent!.trim()).toBe('Web page');
    expect(root.querySelector('.fv-card__sub')!.textContent!.trim()).toBe('www.lightningmaps.org');
    expect(root.querySelector('.fv-card__head .fv-ico svg')).not.toBeNull();
    document.body.replaceChildren();
    const own = await drawn({ title: 'Lightning', subtitle: 'Europe' });
    expect(own.root.querySelector('.fv-card__title')!.textContent!.trim()).toBe('Lightning');
    expect(own.root.querySelector('.fv-card__sub')!.textContent!.trim()).toBe('Europe');
  });
});

describe('Home Assistant’s iframe card pastes in', () => {
  const read = (config: Record<string, unknown>): LovelaceCardConfig =>
    normaliseConfig(
      { type: TYPE, ...config } as LovelaceCardConfig,
      FluvyWebCard.aliases!,
      COMMON_ALIASES,
    );

  it('no background is the bare plate, no sandbox the level off; both let go', () => {
    expect(
      read({
        url: URL_,
        aspect_ratio: '50%',
        title: 'Lightning',
        allow_open_top_navigation: true,
        allow: 'geolocation',
        hide_background: true,
        disable_sandbox: true,
      }),
    ).toEqual({
      type: TYPE,
      url: URL_,
      aspect_ratio: '50%',
      title: 'Lightning',
      allow_open_top_navigation: true,
      allow: 'geolocation',
      variant: 'bare',
      sandbox: 'off',
    });
    expect(read({ url: URL_, hide_background: false, disable_sandbox: false })).toEqual({
      type: TYPE,
      url: URL_,
    });
    // a variant or a level of its own wins
    expect(read({ url: URL_, hide_background: true, variant: 'frame' })['variant']).toBe('frame');
  });
});

describe('the sandbox', () => {
  it.each([
    [
      {},
      'allow-forms allow-popups allow-pointer-lock allow-same-origin allow-scripts allow-modals allow-downloads',
    ],
    [
      { allow_open_top_navigation: true },
      'allow-forms allow-popups allow-pointer-lock allow-same-origin allow-scripts allow-modals allow-downloads allow-top-navigation-by-user-activation',
    ],
    [{ sandbox: 'strict' }, 'allow-forms allow-pointer-lock allow-scripts'],
    [{ sandbox: 'off' }, null],
    [{ sandbox: 'off', allow_open_top_navigation: true }, null],
    // a level it does not know is the standard one
    [
      { sandbox: 'loose' },
      'allow-forms allow-popups allow-pointer-lock allow-same-origin allow-scripts allow-modals allow-downloads',
    ],
  ])('%j writes %j on the frame', async (config, sandbox) => {
    const { frame } = await drawn(config);
    expect(frame()!.getAttribute('sandbox')).toBe(sandbox);
  });
});

describe('the look and the scale', () => {
  it('dark inverts the frame; the page’s own does not; automatic follows the card', async () => {
    expect((await drawn({ look: 'dark' })).frame()!.classList.contains('is-dark')).toBe(true);
    document.body.replaceChildren();
    expect((await drawn({})).frame()!.classList.contains('is-dark')).toBe(false);
    document.body.replaceChildren();
    const auto = await drawn({ look: 'auto' });
    expect(auto.frame()!.classList.contains('is-dark')).toBe(false);
    auto.card.dark = true;
    await auto.card.updateComplete;
    expect(auto.frame()!.classList.contains('is-dark')).toBe(true);
  });

  it.each([
    [{ scale: 0.75 }, 'transform:scale(0.75);width:calc(100% / 0.75);height:calc(100% / 0.75)'],
    [{ scale: 0.5 }, 'transform:scale(0.5);width:calc(100% / 0.5);height:calc(100% / 0.5)'],
    // held to its range; 1 (or none) draws the page as it is
    [{ scale: 0.2 }, 'transform:scale(0.5);width:calc(100% / 0.5);height:calc(100% / 0.5)'],
    [{ scale: 2 }, ''],
    [{ scale: 1 }, ''],
    [{}, ''],
  ])('%j draws the page at that scale', async (config, style) => {
    const { frame } = await drawn(config);
    expect(frame()!.getAttribute('style') ?? '').toBe(style);
  });
});

describe('the rounds at the plate’s bottom end', () => {
  it('open and full screen by default; reload when asked; each left out when asked', async () => {
    expect(labels((await drawn({})).root)).toEqual(['Open in a new tab', 'Full screen']);
    document.body.replaceChildren();
    expect(labels((await drawn({ show_reload: true })).root)).toEqual([
      'Reload',
      'Open in a new tab',
      'Full screen',
    ]);
    document.body.replaceChildren();
    expect(labels((await drawn({ show_open: false, show_fullscreen: false })).root)).toEqual([]);
  });

  it('a narrow plate keeps the full-screen round and gives the others up, the reload first', async () => {
    // a half card of 152: its plate 112 holds one round
    expect(labels((await drawn({ show_reload: true }, 152)).root)).toEqual(['Full screen']);
    document.body.replaceChildren();
    // 172: two
    expect(labels((await drawn({ show_reload: true }, 172)).root)).toEqual([
      'Open in a new tab',
      'Full screen',
    ]);
    document.body.replaceChildren();
    // the bare plate has the whole 172
    expect(labels((await drawn({ show_reload: true, variant: 'bare' }, 172)).root)).toEqual([
      'Reload',
      'Open in a new tab',
      'Full screen',
    ]);
  });

  it('the open round opens the page in a new tab, without a referrer', async () => {
    const open = vi.fn();
    vi.stubGlobal('open', open);
    const { root } = await drawn({});
    root.querySelector<HTMLButtonElement>('.dv-cam__actions .fv-round')!.click();
    expect(open).toHaveBeenCalledWith(URL_, '_blank', 'noopener');
  });

  it('a reload asks for a fresh frame', async () => {
    const { root, frame } = await drawn({ show_reload: true });
    const before = frame();
    root.querySelector<HTMLButtonElement>('.dv-cam__actions .fv-round')!.click();
    await (before as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(frame()).not.toBe(before);
    expect(frame()!.getAttribute('src')).toBe(URL_);
  });
});

describe('loading', () => {
  it('a skeleton covers the plate until the page loads; then the frame shows', async () => {
    const { card, root, frame } = await drawn({});
    expect(root.querySelector('.wb-skeleton')).not.toBeNull();
    expect(frame()!.classList.contains('is-on')).toBe(false);
    await untilLoaded(card);
    await card.updateComplete;
    expect(root.querySelector('.wb-skeleton')).toBeNull();
    expect(frame()!.classList.contains('is-on')).toBe(true);
  });

  it('twenty seconds without a load: the plate says so and offers the tab; a load clears it', async () => {
    frames.hang(true);
    vi.useFakeTimers();
    const { card, root, frame } = await drawn({});
    vi.advanceTimersByTime(19_000);
    await card.updateComplete;
    expect(root.querySelector('.wb-slow')).toBeNull();
    vi.advanceTimersByTime(1_000);
    await card.updateComplete;
    const slow = root.querySelector('.wb-slow')!;
    expect(slow.textContent!.replace(/\s+/g, ' ').trim()).toBe('Still loading · Open in a new tab');
    expect(slow.querySelector('button')).not.toBeNull();
    // the skeleton stays under the words
    expect(root.querySelector('.wb-skeleton')).not.toBeNull();
    frame()!.dispatchEvent(new Event('load'));
    await card.updateComplete;
    expect(root.querySelector('.wb-slow')).toBeNull();
    expect(root.querySelector('.wb-skeleton')).toBeNull();
  });

  it('a config with the same address keeps the loaded frame; a new address loads afresh', async () => {
    const { card, root, frame } = await drawn({});
    await untilLoaded(card);
    await card.updateComplete;
    const loaded = frame();
    card.setConfig({ type: TYPE, url: URL_, title: 'Lightning' });
    await card.updateComplete;
    expect(frame()).toBe(loaded);
    expect(root.querySelector('.wb-skeleton')).toBeNull();
    card.setConfig({ type: TYPE, url: 'https://embed.windy.com/' });
    await card.updateComplete;
    expect(frame()).not.toBe(loaded);
    expect(root.querySelector('.wb-skeleton')).not.toBeNull();
  });
});

describe('refresh', () => {
  it('asks for the page again once per period, and stops when the card leaves the page', async () => {
    vi.useFakeTimers();
    const { card, frame } = await drawn({ refresh: 2 });
    const first = frame();
    vi.advanceTimersByTime(MINUTE);
    await card.updateComplete;
    expect(frame()).toBe(first);
    vi.advanceTimersByTime(MINUTE);
    await card.updateComplete;
    const second = frame();
    expect(second).not.toBe(first);
    expect(card.generation_).toBe(1);
    vi.advanceTimersByTime(2 * MINUTE);
    await card.updateComplete;
    expect(frame()).not.toBe(second);
    expect(card.generation_).toBe(2);
    card.remove();
    vi.advanceTimersByTime(10 * MINUTE);
    expect(card.generation_).toBe(2);
  });

  it('never without a period', async () => {
    vi.useFakeTimers();
    const { card } = await drawn({});
    vi.advanceTimersByTime(60 * MINUTE);
    await card.updateComplete;
    expect(card.generation_).toBe(0);
  });
});

describe('an http page on an https dashboard', () => {
  const PLAIN = 'http://grafana.local:3000/d/abc';

  it('is kept back on the off plate at the secure twin’s size, the globe and why; the open round alive', async () => {
    const live = await drawn({});
    const liveHeight = live.root.querySelector<HTMLElement>('.wb-plate')!.style.height;
    const liveSize = live.card.getCardSize();
    document.body.replaceChildren();
    secure();
    const { card, root, frame } = await drawn({ url: PLAIN, show_reload: true });
    const plate = root.querySelector<HTMLElement>('.wb-plate')!;
    expect(plate.classList.contains('is-off')).toBe(true);
    expect(plate.style.height).toBe(liveHeight);
    expect(card.getCardSize()).toBe(liveSize);
    expect(frame()).toBeNull();
    expect(root.querySelector('.wb-off p')!.textContent!.trim()).toBe('This page needs https');
    expect(root.querySelector('.wb-off .fv-ico--off svg')).not.toBeNull();
    const rounds = [...root.querySelectorAll<HTMLButtonElement>('.dv-cam__actions .fv-round')];
    expect(rounds.map((el) => [el.getAttribute('aria-label'), el.disabled])).toEqual([
      ['Reload', true],
      ['Open in a new tab', false],
      ['Full screen', true],
    ]);
    // the head still says where the page is
    expect(root.querySelector('.fv-card__sub')!.textContent!.trim()).toBe('grafana.local:3000');
  });

  it('is framed on an http dashboard', async () => {
    vi.stubGlobal('location', { href: 'http://ha.local:8123/lovelace/0', protocol: 'http:' });
    const { root, frame } = await drawn({ url: PLAIN });
    expect(root.querySelector('.wb-plate.is-off')).toBeNull();
    expect(frame()!.getAttribute('src')).toBe(PLAIN);
  });
});

describe('the editor shows a field only where it acts', () => {
  const shown = async (config: Record<string, unknown>): Promise<string[]> => {
    const editor = await FluvyWebCard.getConfigElement();
    (editor as HTMLElement & { hass: HomeAssistant }).hass = house();
    const drawnEditor = await drawEditor(editor, { type: TYPE, url: URL_, ...config });
    return shownNames(cardForm(drawnEditor).schema);
  };

  it('the head, its circle and the actions with the plate variant alone; the colours on a card', async () => {
    const plate = await shown({});
    for (const name of [
      'title',
      'icon',
      'show_icon',
      'subtitle',
      'tap_action',
      'hold_action',
      'tone',
      'color',
      'card_color',
    ])
      expect(plate, name).toContain(name);
    const frame = await shown({ variant: 'frame' });
    for (const name of ['title', 'icon', 'show_icon', 'subtitle', 'tap_action', 'hold_action'])
      expect(frame, name).not.toContain(name);
    expect(frame).toContain('color');
    const bare = await shown({ variant: 'bare' });
    for (const name of ['title', 'tone', 'color', 'card_color', 'tap_action'])
      expect(bare, name).not.toContain(name);
    expect(bare).toContain('show_fullscreen');
  });

  it('a height written hides the shape; no sandbox hides top navigation', async () => {
    expect(await shown({})).toContain('aspect_ratio');
    expect(await shown({ height: 300 })).not.toContain('aspect_ratio');
    expect(await shown({ height: 300 })).toContain('height');
    expect(await shown({})).toContain('allow_open_top_navigation');
    expect(await shown({ sandbox: 'off' })).not.toContain('allow_open_top_navigation');
    expect(await shown({ sandbox: 'strict' })).toContain('allow_open_top_navigation');
  });
});
