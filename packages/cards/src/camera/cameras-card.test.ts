// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cameraRatio, camerasHeight, plateHeight } from '../devices-family.js';
import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, shownNames } from '../shared/fixtures/editor.js';
import { cameraColumns, FluvyCamerasCard, type CamerasCardConfig } from './cameras-card.js';
import { cameraStatus, fitLines, statusWords, streamLine } from './status.js';

// the devices family lands with the index: the cards' tags are defined before a page needs them
await familiesDefined;

/*
 * The Cameras card (#60): its cameras (listed, handed over as `entities`, or its area's), how many tiles a row, the
 * height it declares at a 360 column, the pictures that stream (`max_live`), each camera's line and its circle.
 */

const STAMP = '2026-10-22T09:00:00Z';
const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) =>
  ({
    entity_id,
    state: value,
    attributes: { friendly_name: entity_id.split('.')[1]!.replace(/_/g, ' '), ...attributes },
    last_changed: STAMP,
    last_updated: STAMP,
  }) as HassEntity;

const STATES = [
  state('camera.driveway', 'idle', { entity_picture: '/api/camera_proxy/camera.driveway' }),
  state('camera.garden', 'idle', { entity_picture: '/api/camera_proxy/camera.garden' }),
  state('camera.terrace', 'recording', { entity_picture: '/api/camera_proxy/camera.terrace' }),
  state('camera.garage', 'streaming', { entity_picture: '/api/camera_proxy/camera.garage' }),
  state('camera.gate', 'unavailable'),
  state('binary_sensor.driveway_motion', 'on', { device_class: 'motion' }),
  state('binary_sensor.garden_person', 'off', { device_class: 'occupancy' }),
  state('binary_sensor.terrace_motion', 'unavailable', { device_class: 'motion' }),
];

const entry = (entity_id: string, device_id: string, area_id: string | null = null) => ({
  entity_id,
  device_id,
  area_id,
});

const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
  config: { time_zone: 'UTC', unit_system: { temperature: '°C', length: 'km' } },
  states: Object.fromEntries(STATES.map((s) => [s.entity_id, s])),
  entities: Object.fromEntries(
    [
      entry('camera.driveway', 'd-drive', 'front'),
      entry('binary_sensor.driveway_motion', 'd-drive', 'front'),
      entry('camera.garden', 'd-garden', 'garden'),
      entry('binary_sensor.garden_person', 'd-garden', 'garden'),
      entry('camera.terrace', 'd-terrace', 'garden'),
      entry('binary_sensor.terrace_motion', 'd-terrace', 'garden'),
      entry('camera.garage', 'd-garage', 'front'),
    ].map((e) => [e.entity_id, e]),
  ),
  devices: {},
  areas: {
    front: { area_id: 'front', name: 'Front', icon: 'mdi:fence' },
    garden: { area_id: 'garden', name: 'Garden' },
  },
  localize: (key: string) => key,
  formatEntityState: (s: { state: string }) => s.state,
  hassUrl: (path: string) => path,
  callWS: () => new Promise(() => undefined),
} as unknown as HomeAssistant;

const FOUR = ['camera.driveway', 'camera.garden', 'camera.terrace', 'camera.garage'];

/** The card's own workings, as these tests read them. */
type Inner = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  config: CamerasCardConfig;
  live_: boolean | undefined;
  updateComplete: Promise<boolean>;
  requestUpdate(): void;
  feeds: { native: number }[];
  tileWidth(n: number): number;
  headFit: { ruler: unknown };
  items(): { entity: string; name?: string }[];
  streaming(items: readonly unknown[]): ReadonlySet<number>;
  watched(): readonly string[];
};

/** The card at `width` on a stub ruler (8 px a glyph): the layout happy-dom has none of. */
async function draw(config: Record<string, unknown>, width = 360): Promise<Inner> {
  const card = document.createElement('fluvy-cameras-card') as Inner;
  Object.assign(card.headFit, {
    ruler: {
      width: (_cls: string, text: string) => text.length * 8,
      pill: (_cls: string, text: string, sides: number) => text.length * 8 + sides,
      clear() {},
    },
  });
  card.setConfig({ type: 'custom:fluvy-cameras-card', ...config });
  card.hass = hass;
  card.width = width;
  document.body.append(card);
  await card.updateComplete;
  await new Promise((resolve) => setTimeout(resolve, 0));
  await card.updateComplete;
  return card;
}

afterEach(() => document.body.replaceChildren());

describe('the Cameras card’s cameras', () => {
  it('are those it lists, the ones handed over as `entities`, else its area’s', async () => {
    const ids = (card: Inner) => card.items().map((item) => item.entity);
    expect(ids(await draw({ cameras: FOUR }))).toEqual(FOUR);
    expect(ids(await draw({ entities: ['camera.garden', { entity: 'camera.gate' }] }))).toEqual([
      'camera.garden',
      'camera.gate',
    ]);
    expect(ids(await draw({ area: 'garden' }))).toEqual(['camera.garden', 'camera.terrace']);
    expect(ids(await draw({ area: 'garden', cameras: ['camera.garage'] }))).toEqual([
      'camera.garage',
    ]);
  });

  it('read an item’s older names as the newer ones', async () => {
    const card = await draw({ cameras: [{ entity: 'camera.garden', label: 'Back' }] });
    expect(card.config.cameras).toEqual([{ entity: 'camera.garden', name: 'Back' }]);
  });

  it('are offered the house’s first four for a new card', () => {
    expect(FluvyCamerasCard.getStubConfig(undefined, ['light.a', ...FOUR, 'camera.gate'])).toEqual({
      type: 'custom:fluvy-cameras-card',
      cameras: FOUR,
    });
  });

  it('are watched with the motion sensors their lines read', async () => {
    const card = await draw({
      cameras: [
        'camera.driveway',
        { entity: 'camera.garage', motion: 'binary_sensor.garden_person' },
        { entity: 'camera.garden', status: 'state' },
      ],
    });
    expect(card.watched()).toEqual([
      'camera.driveway',
      'binary_sensor.driveway_motion',
      'camera.garage',
      'binary_sensor.garden_person',
      'camera.garden',
    ]);
  });
});

describe('the Cameras card’s tiles a row', () => {
  const columns = (config: Partial<CamerasCardConfig>, n: number, widths: readonly number[]) =>
    widths.map((width) => cameraColumns({ type: '', ...config }, n, width));

  it('are one under 320, two from there, up to four on a wide band, never more than the cameras', () => {
    expect(columns({}, 4, [112, 132, 152, 171, 288, 320, 700, 800, 1100])).toEqual([
      1, 1, 1, 1, 1, 2, 2, 3, 4,
    ]);
    expect(columns({}, 1, [320, 1100])).toEqual([1, 1]);
    expect(columns({}, 3, [1100])).toEqual([3]);
  });

  it('are the count asked for, held where a tile would come under 120', () => {
    expect(columns({ columns: 3 }, 4, [320, 424, 500])).toEqual([2, 3, 3]);
    expect(columns({ columns: 1 }, 4, [1100])).toEqual([1]);
    expect(columns({ columns: 4 }, 2, [1100])).toEqual([4]);
  });

  it('are, for the pictures alone, as many of 96 as fit (three from 320), up to six', () => {
    expect(columns({ variant: 'compact' }, 6, [112, 171, 226, 320, 1100])).toEqual([1, 1, 2, 3, 6]);
    expect(columns({ variant: 'compact', columns: 4 }, 6, [320, 171])).toEqual([4, 2]);
  });
});

describe('the Cameras card’s height at a 360 column', () => {
  it('counts its rows of tiles, its list, its pictures alone, or its empty panel', () => {
    const height = (config: Partial<CamerasCardConfig>, inArea?: number) =>
      camerasHeight({ type: 'custom:fluvy-cameras-card', ...config }, inArea);
    const n = (count: number) => FOUR.concat(FOUR).slice(0, count);
    // a tile of 152 at 16:9 is 84 high, and 16 + 44 under it
    expect([1, 2, 3, 4, 5].map((count) => height({ cameras: n(count) }))).toEqual([
      340, 244, 404, 404, 564,
    ]);
    expect(height({ entities: n(3) })).toBe(404);
    expect(height({ cameras: n(5), variant: 'list' })).toBe(400);
    expect(height({ cameras: n(6), variant: 'compact' })).toBe(300);
    expect(height({ cameras: n(4), aspect_ratio: '4:3' })).toBe(468);
    expect(height({ cameras: n(3), columns: 1 })).toBe(852);
    expect(height({ cameras: [] })).toBe(220);
    expect(height({})).toBe(220);
    // an area's cameras: as the house counts them, two where it is not there to say
    expect(height({ area: 'garden' })).toBe(244);
    expect(height({ area: 'garden' }, 3)).toBe(404);
  });

  it('lays as many tiles a row as the card does at its 320', () => {
    for (const variant of ['grid', 'compact'] as const)
      for (const asked of ['auto', 1, 2, 3, 4] as const)
        for (let count = 1; count <= 7; count++) {
          const config = {
            type: 'custom:fluvy-cameras-card',
            variant,
            columns: asked,
            cameras: FOUR.concat(FOUR).slice(0, count),
          };
          const columns = cameraColumns(config, count, 320);
          const gap = variant === 'compact' ? 8 : 16;
          const tile =
            plateHeight((320 - gap * (columns - 1)) / columns, cameraRatio('16:9')) +
            (variant === 'compact' ? 28 : 60);
          const rows = Math.ceil(count / columns);
          expect(camerasHeight(config), `${variant} ${asked} ${count}`).toBe(
            100 + rows * tile + (rows - 1) * gap,
          );
        }
  });
});

describe('the Cameras card’s live pictures', () => {
  it('are the first `max_live` of those asked live, the rest stills; the sheet’s switch says for all', async () => {
    const live = async (config: Record<string, unknown>, session?: boolean) => {
      const card = await draw({ cameras: FOUR, ...config });
      card.live_ = session;
      return [...card.streaming(card.items())];
    };
    expect(await live({})).toEqual([]);
    expect(await live({ camera_view: 'live' })).toEqual([0, 1, 2, 3]);
    expect(await live({ camera_view: 'live', max_live: 2 })).toEqual([0, 1]);
    expect(await live({ camera_view: 'live', max_live: 0 })).toEqual([]);
    expect(
      await live({
        cameras: ['camera.driveway', { entity: 'camera.garden', camera_view: 'live' }],
      }),
    ).toEqual([1]);
    expect(await live({ max_live: 3 }, true)).toEqual([0, 1, 2]);
    expect(await live({ camera_view: 'live' }, false)).toEqual([]);
  });
});

describe('a camera’s line', () => {
  const view = (id: string) => ({
    ...(hass.states[id]
      ? {
          status: ['unavailable', 'unknown'].includes(hass.states[id]!.state)
            ? hass.states[id]!.state
            : 'ok',
        }
      : { status: 'missing' }),
  });
  const line = (id: string, mode: 'auto' | 'motion' | 'state' | 'none', motion?: string) =>
    cameraStatus(
      hass,
      {
        id,
        state: hass.states[id]?.state ?? 'missing',
        ...view(id),
      } as never,
      mode,
      motion,
    );

  it('says what its motion sensor sees, else the camera’s own state, else why it is out of reach', () => {
    expect(line('camera.driveway', 'auto')).toEqual({
      glyph: 'motion',
      text: 'Motion detected',
      motion: true,
    });
    expect(line('camera.garden', 'auto')).toEqual({
      glyph: 'eye',
      text: 'No motion',
      motion: false,
    });
    // a sensor that cannot be read leaves the line to the camera
    expect(line('camera.terrace', 'auto')?.text).toBe('Recording');
    expect(line('camera.garage', 'motion')).toEqual({
      glyph: 'wifi',
      text: 'Streaming',
      motion: false,
    });
    expect(line('camera.driveway', 'state')?.text).toBe('Online');
    expect(line('camera.garage', 'auto', 'binary_sensor.driveway_motion')?.glyph).toBe('motion');
    expect(line('camera.gate', 'auto')).toEqual({ glyph: 'ban', text: 'Offline', motion: false });
    expect(line('camera.gone', 'auto')).toEqual({
      glyph: 'ban',
      text: 'Not found',
      motion: false,
    });
    expect(line('camera.driveway', 'none')).toBeNull();
  });

  it('is given the room of the longest it may say, so the tiles never move when someone walks by', () => {
    const said = line('camera.garden', 'auto');
    expect(statusWords(hass, said, 'binary_sensor.garden_person')).toEqual([
      'Motion detected',
      'No motion',
      'No motion',
    ]);
    expect(statusWords(hass, line('camera.garage', 'auto'), undefined)).toEqual(['Streaming']);
    // a live picture's line keeps the room to say, short, that its stream cannot play
    expect(statusWords(hass, line('camera.garage', 'auto'), undefined, true)).toEqual([
      'Streaming',
      'No stream',
    ]);
  });

  it('keeps its glyph while every line of the set holds whole beside one, then its words, then its glyph alone', () => {
    const width = (text: string) => text.length * 8;
    const motion = { glyph: 'motion', text: 'Motion detected', motion: true } as const;
    const online = { glyph: 'wifi', text: 'Online', motion: false } as const;
    const words = [['Motion detected', 'No motion'], ['Online']];
    const full = (text: string) => ({ glyph: true, text });
    const words_ = (text: string) => ({ glyph: false, text });
    // "Motion detected" is 120, and 22 more with its glyph
    expect([motion, online].map(fitLines(words, 142, width))).toEqual([
      full('Motion detected'),
      full('Online'),
    ]);
    expect([motion, online].map(fitLines(words, 141, width))).toEqual([
      words_('Motion detected'),
      words_('Online'),
    ]);
    expect([motion, online].map(fitLines(words, 119, width))).toEqual([
      { glyph: true, text: null },
      words_('Online'),
    ]);
  });

  it('says its short words where its whole ones would not hold', () => {
    const width = (text: string) => text.length * 8;
    const failed = streamLine(hass);
    // "Stream unavailable" is 144, "No stream" 72
    expect(failed).toEqual({
      glyph: 'ban',
      text: 'Stream unavailable',
      short: 'No stream',
      motion: false,
    });
    const words = [['Online', 'No stream']];
    expect(fitLines(words, 166, width)(failed)).toEqual({
      glyph: true,
      text: 'Stream unavailable',
    });
    expect(fitLines(words, 140, width)(failed)).toEqual({ glyph: true, text: 'No stream' });
    expect(fitLines(words, 80, width)(failed)).toEqual({ glyph: false, text: 'No stream' });
    expect(fitLines(words, 60, width)(failed)).toEqual({ glyph: true, text: null });
  });
});

describe('the Cameras card drawn', () => {
  it('draws a tile a camera: its picture, its circle, its name and its line', async () => {
    const card = await draw({ cameras: FOUR }, 600);
    const tiles = [...card.shadowRoot!.querySelectorAll('.cm-tile')];
    expect(tiles).toHaveLength(4);
    expect(tiles.map((tile) => tile.querySelector('.fv-row__title')?.textContent)).toEqual([
      'driveway',
      'garden',
      'terrace',
      'garage',
    ]);
    expect(tiles.map((tile) => tile.querySelector('.cm-status')?.textContent?.trim())).toEqual([
      'Motion detected',
      'No motion',
      'Recording',
      'Streaming',
    ]);
    // the circles neutral, as the mockup draws them: the line's glyph and words say motion
    const tones = (card: Inner) =>
      [...card.shadowRoot!.querySelectorAll('.cm-under .fv-ico')].map(
        (circle) => /fv-ico--(\w+)/.exec(circle.className)![1],
      );
    expect(tones(card)).toEqual(['neutral', 'neutral', 'neutral', 'neutral']);
    // a camera that asks a tone or a colour wears it while it sees someone; the card's own is the head's
    const asked = await draw(
      {
        tone: 'heat',
        cameras: [
          { entity: 'camera.driveway', tone: 'warning' },
          { entity: 'camera.garden', tone: 'warning' },
        ],
      },
      600,
    );
    expect(tones(asked)).toEqual(['warning', 'neutral']);
    const coloured = await draw({ cameras: [{ entity: 'camera.driveway', color: 'red' }] }, 600);
    expect(tones(coloured)).toEqual(['accent']);
    expect(
      coloured.shadowRoot!.querySelector('.cm-under .fv-ico')!.hasAttribute('data-accent'),
    ).toBe(true);
  });

  it('gives way in order: the lines’ glyphs, then the circles, the glyphs back where they then hold', async () => {
    // "Motion detected" is 120 on the stub ruler, 142 with its glyph; a circle and its gap take 56
    const drawn = async (width: number) => {
      const card = await draw({ cameras: FOUR }, width);
      const tiles = [...card.shadowRoot!.querySelectorAll('.cm-tile')];
      return {
        tile: card.tileWidth(4),
        circles: tiles.every((tile) => tile.querySelector('.cm-under .fv-ico')),
        glyphs: tiles.every((tile) => tile.querySelector('.cm-status svg')),
      };
    };
    expect(await drawn(468)).toEqual({ tile: 206, circles: true, glyphs: true });
    expect(await drawn(420)).toEqual({ tile: 182, circles: true, glyphs: false });
    expect(await drawn(368)).toEqual({ tile: 156, circles: false, glyphs: true });
  });

  it('wears the security camera in its head, as the mockup draws it, unless it is given an icon', async () => {
    const head = (card: Inner) =>
      card.shadowRoot!.querySelector('.fv-card__head .fv-ico svg')!.innerHTML;
    const cctv = head(await draw({ cameras: FOUR }, 600));
    expect(cctv).toContain('matrix(.883 -.469 .469 .883 7.65 13.7)');
    expect(head(await draw({ cameras: FOUR, icon: 'camera' }, 600))).not.toBe(cctv);
  });

  it('levels a row of cameras of their own shapes: every plate takes the row’s tallest', async () => {
    const card = await draw({ cameras: FOUR, aspect_ratio: 'native' });
    // the garden is a portrait doorbell (3:4) beside the driveway's 16:9; the second row is 16:9 throughout
    card.feeds[1]!.native = 3 / 4;
    card.feeds[2]!.native = 16 / 9;
    card.requestUpdate();
    await card.updateComplete;
    const tile = card.tileWidth(4);
    const heights = [...card.shadowRoot!.querySelectorAll<HTMLElement>('.cm-tile .dv-cam')].map(
      (plate) => parseFloat(plate.style.height),
    );
    expect(heights).toEqual([
      plateHeight(tile, 3 / 4),
      plateHeight(tile, 3 / 4),
      plateHeight(tile, 16 / 9),
      plateHeight(tile, 16 / 9),
    ]);
    // a shape asked for is every tile's, whatever a camera's own
    const asked = await draw({ cameras: FOUR, aspect_ratio: '4:3' });
    asked.feeds[1]!.native = 3 / 4;
    asked.requestUpdate();
    await asked.updateComplete;
    expect(
      new Set(
        [...asked.shadowRoot!.querySelectorAll<HTMLElement>('.cm-tile .dv-cam')].map(
          (plate) => plate.style.height,
        ),
      ).size,
    ).toBe(1);
  });

  it('keeps every camera’s tile out of reach, and wears the off skin only when every one is', async () => {
    const some = await draw({ cameras: ['camera.driveway', 'camera.gate'] }, 600);
    expect(some.shadowRoot!.querySelectorAll('.cm-tile')).toHaveLength(2);
    expect(some.shadowRoot!.querySelector('.fv-card')!.classList.contains('is-unavailable')).toBe(
      false,
    );
    expect(some.shadowRoot!.querySelectorAll('.dv-cam.is-off')).toHaveLength(1);
    const all = await draw({ cameras: ['camera.gate', 'camera.gone'] }, 600);
    expect(all.shadowRoot!.querySelector('.fv-card')!.classList.contains('is-unavailable')).toBe(
      true,
    );
  });

  it('opens its sheet from the head’s round, unless its own hold runs', async () => {
    const card = await draw({ cameras: FOUR });
    const round = card.shadowRoot!.querySelector<HTMLElement>('.fv-card__head .fv-round')!;
    round.click();
    // its chunk fetched the first time: the sheet opens once it lands
    await vi.waitFor(() =>
      expect(
        card.shadowRoot!.querySelector('fluvy-cameras-sheet')?.shadowRoot?.querySelector('dialog'),
      ).toBeTruthy(),
    );
    const held = await draw({
      cameras: FOUR,
      hold_action: { action: 'navigate', navigation_path: '/cameras' },
    });
    held.shadowRoot!.querySelector<HTMLElement>('.fv-card__head .fv-round')!.click();
    expect(location.pathname).toBe('/cameras');
    // the round says what it does: the sheet of every camera, or the card's own hold, as every card's round
    const label = (card: Inner) =>
      card.shadowRoot!.querySelector('.fv-card__head .fv-round')!.getAttribute('aria-label');
    expect(label(card)).toBe('All cameras');
    expect(label(held)).toBe('More');
  });

  it('shows the sheet’s switch only where a picture may stream', async () => {
    const switches = async (config: Record<string, unknown>) => {
      const card = await draw({ cameras: FOUR, _sheet: true, ...config });
      const sheet = card.shadowRoot!.querySelector('fluvy-cameras-sheet')!;
      await vi.waitFor(() => expect(sheet.shadowRoot?.querySelector('.cm-row')).toBeTruthy());
      return sheet.shadowRoot!.querySelectorAll('[role="switch"]').length;
    };
    expect(await switches({})).toBe(1);
    expect(await switches({ max_live: 0 })).toBe(0);
  });

  it('says on a live tile’s line that its stream cannot play, and out of reach one word on its plate and line', async () => {
    const card = await draw(
      { cameras: ['camera.driveway', 'camera.gate'], camera_view: 'live' },
      600,
    );
    // the driveway's stream could not play: stills meanwhile, asked for again in a minute
    Object.assign((card.feeds[0] as unknown as { holder: object }).holder, {
      state: 'none',
      retryAt: Date.now() + 60_000,
    });
    card.requestUpdate();
    await card.updateComplete;
    const tiles = [...card.shadowRoot!.querySelectorAll('.cm-tile')];
    expect(tiles.map((tile) => tile.querySelector('.cm-status')?.textContent?.trim())).toEqual([
      'Stream unavailable',
      'Offline',
    ]);
    expect(tiles[1]!.querySelector('.dv-cam__off p')?.textContent).toBe('Offline');
  });
});

describe('the Cameras card’s editor', () => {
  const shown = async (config: Record<string, unknown>): Promise<string[]> =>
    shownNames(
      cardForm(
        await drawEditor(await FluvyCamerasCard.getConfigElement(), {
          type: 'custom:fluvy-cameras-card',
          ...config,
        }),
      ).schema,
    );

  it('offers how many stream at once where some do: the card asked live, or one of its cameras', async () => {
    expect(await shown({ cameras: ['camera.driveway'] })).not.toContain('max_live');
    expect(await shown({ camera_view: 'live', cameras: ['camera.driveway'] })).toContain(
      'max_live',
    );
    expect(
      await shown({
        cameras: [{ entity: 'camera.driveway', camera_view: 'live' }, 'camera.garden'],
      }),
    ).toContain('max_live');
    // the list handed over as `entities` (auto-entities) is the cameras' too
    expect(await shown({ entities: [{ entity: 'camera.garden', camera_view: 'live' }] })).toContain(
      'max_live',
    );
  });
});
