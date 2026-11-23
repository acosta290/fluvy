// @vitest-environment happy-dom
import type {
  HassEntity,
  HomeAssistant,
  LovelaceCardConfig,
  LovelaceGridOptions,
} from '@fluvy/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { coverHeight as heightOf, presetsOf, usualFor as usualOf } from '../cover-family.js';
import { familiesDefined } from '../index.js';
import { shownNames } from '../shared/fixtures/editor.js';
import { visibleFields } from '../shared/form.js';
import * as coverEditor from './cover-editor.js';
import { openness } from './slats.js';

/*
 * The Cover card's tilt and numbers (1.22, #203), each off until asked: the tilt as its slats (the window seen from the
 * room, the blind down) over a ruler that sends on release, the slats following the finger; presets as chips under
 * their control; a position counted as it comes down, a cover that reports its numbers turned round, the ruler's
 * ends in the person's own words; and a tilt that a card under about 200 could no longer set, under the commands.
 */

beforeAll(() => familiesDefined);
const callService = vi.fn(() => Promise.resolve());
afterEach(() => {
  document.body.replaceChildren();
  callService.mockClear();
});

const STAMP = '2026-09-17T19:00:00+00:00';
/* cover: OPEN 1 · CLOSE 2 · SET_POSITION 4 · STOP 8 · OPEN_TILT 16 · CLOSE_TILT 32 · STOP_TILT 64 · SET_TILT 128 */
const ALL = 255;
const blind = (attributes: Record<string, unknown> = {}, value = 'open'): HassEntity => ({
  entity_id: 'cover.office',
  state: value,
  attributes: {
    friendly_name: 'Office blind',
    device_class: 'blind',
    supported_features: ALL,
    current_position: 65,
    current_tilt_position: 50,
    ...attributes,
  },
  last_changed: STAMP,
  last_updated: STAMP,
  context: { id: '', parent_id: null, user_id: null },
});
const house = (state: HassEntity): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C' }, time_zone: 'UTC' },
    states: { [state.entity_id]: state },
    entities: {},
    devices: {},
    areas: {},
    themes: { darkMode: false },
    callService,
  }) as unknown as HomeAssistant;

/** A ruler of 8 a letter, a badge its words and its sides: the widths the card is fitted by. */
const RULER = {
  width: (_cls: string, text: string) => text.length * 8,
  pill: (_cls: string, text: string, sides: number) => text.length * 8 + sides,
  clear() {},
};

type Drawn = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  getCardSize(): number;
  getGridOptions(): LovelaceGridOptions;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
};

/** The card drawing `state` at `width`, with `more` of its config. */
const draw = async (
  more: Record<string, unknown> = {},
  state = blind(),
  width = 360,
): Promise<{ card: Drawn; root: ShadowRoot }> => {
  const card = document.createElement('fluvy-cover-card') as Drawn;
  Object.assign((card as unknown as { head: object }).head, { ruler: RULER });
  card.setConfig({ type: 'custom:fluvy-cover-card', entity: state.entity_id, ...more });
  card.hass = house(state);
  card.width = width;
  document.body.append(card);
  await card.updateComplete;
  return { card, root: card.shadowRoot! };
};

const all = (root: ParentNode, selector: string): HTMLElement[] => [
  ...root.querySelectorAll<HTMLElement>(selector),
];
const texts = (root: ParentNode, selector: string): string[] =>
  all(root, selector).map((el) => el.textContent?.trim() ?? '');
/** A readout's figure as it reads: the figure, its unit, the words after it. */
const figure = (root: ParentNode, selector: string): string[] =>
  [...(root.querySelector(`${selector} .fv-readout__value`)?.children ?? [])].map(
    (part) => part.textContent?.trim() ?? '',
  );
type Ruler = HTMLElement & { value: number; origin: number; disabled: boolean; label: string };
/** The position's ruler (vertical) and the slats' (across). */
const rulers = (root: ParentNode): { position: Ruler | null; tilt: Ruler | null } => ({
  position: root.querySelector<Ruler>('fluvy-ruler[vertical]'),
  tilt: root.querySelector<Ruler>('.cv-tilt fluvy-ruler'),
});
/** A ruler let go at `value` (or still under the finger, `input`). */
const slide = async (card: Drawn, ruler: Element, value: number, event = 'fluvy-change') => {
  ruler.dispatchEvent(new CustomEvent(event, { detail: { value } }));
  await card.updateComplete;
};
/** The slats' thickness, as a share of the thickest (5.6), and the light's. */
const picture = (root: ParentNode) => ({
  slat: Number(
    /scaleY\(([\d.]+)\)/.exec(root.querySelector('.cv-slats i')?.getAttribute('style') ?? '')?.[1],
  ),
  light: Number(
    /opacity:([\d.]+)/.exec(
      root.querySelector('.cv-slats__light')?.getAttribute('style') ?? '',
    )?.[1],
  ),
  held: root.querySelector('.cv-slats')?.classList.contains('is-held'),
});
/** The card's height and its usual parts for a config of its keys. */
const coverHeight = (config: Record<string, unknown>, features?: number): number =>
  heightOf({ type: 'custom:fluvy-cover-card', ...config }, features);
const usualFor = (config: Record<string, unknown>): number =>
  usualOf({ type: 'custom:fluvy-cover-card', ...config });
const sent = () => callService.mock.calls.map((call) => (call as unknown[]).slice(0, 3));

describe('the cover’s height (#203), from its config', () => {
  it('stays as it was where nothing is asked', () => {
    expect(coverHeight({})).toBe(328);
    expect(coverHeight({ favorites: [{ position: 50 }] })).toBe(416);
    expect(coverHeight({ variant: 'compact' })).toBe(144);
  });

  it('grows 16 with the slats beside the position, a cover not yet read counted as one that tilts', () => {
    expect(usualFor({ tilt_style: 'slats' }) & 128).toBe(128);
    expect(coverHeight({ tilt_style: 'slats' })).toBe(344);
    expect(coverHeight({ tilt_style: 'slats', show_tilt: false })).toBe(328);
    // the house says it takes no angle: its stepper, if any, in the column as before
    expect(coverHeight({ tilt_style: 'slats' }, 15)).toBe(328);
    expect(coverHeight({ tilt_style: 'slats' }, 1 | 2 | 8 | 16 | 32)).toBe(224);
    // no position: the slats and their ruler over the commands
    expect(coverHeight({ tilt_style: 'slats' }, 240)).toBe(280);
  });

  it('adds a row of 12 and 44 for each control’s presets it can go to, 88 under a name', () => {
    expect(coverHeight({ position_presets: [0, 50, 100] })).toBe(384);
    // the tilt's beside the position stand away from it: under its name, as the favourites do
    expect(coverHeight({ position_presets: [0, 50, 100], tilt_presets: ['0', '100'] })).toBe(472);
    expect(coverHeight({ tilt_presets: [0, 100] }, 15)).toBe(328);
    expect(coverHeight({ position_presets: [] })).toBe(328);
  });

  it('counts the favourites the cover can go to, on one with no position too, their chips’ rows by their words', () => {
    const shade = { name: 'Shade', tilt: 30 };
    const louvres = 1 | 2 | 8 | 16 | 32 | 64 | 128;
    // louvres with no position: their angles, under the readout and stepper, or the slats
    expect(coverHeight({ favorites: [shade] }, louvres)).toBe(224 + 88);
    expect(coverHeight({ favorites: [shade], tilt_style: 'slats' }, louvres)).toBe(280 + 88);
    // the tilt hidden, the favourites still set it
    expect(coverHeight({ favorites: [shade], show_tilt: false }, louvres)).toBe(144 + 88);
    expect(coverHeight({ favorites: [shade], show_favorites: false }, louvres)).toBe(224);
    // a favourite the cover cannot go to is not drawn, nor counted: a position on louvres, an angle on a blind that
    // takes none
    expect(coverHeight({ favorites: [{ name: 'Half', position: 50 }] }, louvres)).toBe(224);
    expect(coverHeight({ favorites: [shade] }, 15)).toBe(328);
    // a cover not yet read: one a favourite tilts is counted as one that tilts
    expect(usualFor({ favorites: [shade] }) & 128).toBe(128);
    expect(coverHeight({ favorites: [shade] })).toBe(328 + 88);
    // three named ones are two rows at 360, as the card lays them out; content-sized, 8 between their rows
    const three = [shade, { name: 'Breeze', tilt: 70 }, { name: 'Open', tilt: 100 }];
    expect(coverHeight({ favorites: three }, louvres)).toBe(224 + 132);
    expect(coverHeight({ favorites: three, favorites_style: 'chips' }, louvres)).toBe(224 + 140);
    // three that say their place alone hold one row
    expect(coverHeight({ favorites: [{ position: 0 }, { position: 100 }, { position: 50 }] })).toBe(
      416,
    );
  });

  it('reads presets as whole percents, each once, in their order', () => {
    expect(presetsOf(['50', 0, 100, 'half', 50.2, 120, -5, null])).toEqual([50, 0, 100]);
    expect(presetsOf('50')).toEqual([]);
  });

  it('opens the slats in proportion, or through level and shut again past 135°', () => {
    expect(openness(50, 0)).toBe(0.5);
    expect(openness(100, 90)).toBe(1);
    expect([0, 25, 50, 100].map((tilt) => openness(tilt, 180))).toEqual([0, 0.5, 1, 0]);
  });
});

describe('the tilt as its slats', () => {
  it('draws as 1.21 did where nothing is asked: the readout and its stepper', async () => {
    const { root } = await draw();
    expect(root.querySelector('.cv-slats, .cv-tilt, .cv-presets, .cv-said')).toBeNull();
    expect(root.querySelector('.dv-cover__tilt .fv-stepper')).not.toBeNull();
    expect(root.querySelector('.dv-cover')?.classList.contains('cv-cover--slats')).toBe(false);
  });

  it('stands under the position: its readout and words, the picture, a ruler that sends on release', async () => {
    const { card, root } = await draw({ tilt_style: 'slats' });
    expect(
      root.querySelector('.dv-cover.cv-cover--slats .dv-cover__side .cv-tilt--side'),
    ).not.toBeNull();
    expect(figure(root, '.cv-tilt')).toEqual(['50', '%', 'Partly open']);
    expect(root.querySelector('.cv-slats')?.getAttribute('aria-hidden')).toBe('true');
    expect(picture(root)).toEqual({ slat: 0.643, light: 0.65, held: false });
    expect(texts(root, '.cv-tilt .fv-ruler-labels span')).toEqual(['Closed', 'Open']);
    const { tilt } = rulers(root);
    expect(tilt?.value).toBe(50);
    // under the finger the slats follow it, nothing sent; let go, one call
    await slide(card, tilt!, 90, 'fluvy-input');
    expect(picture(root)).toMatchObject({ slat: 0.357, held: true });
    expect(callService).not.toHaveBeenCalled();
    await slide(card, tilt!, 90);
    expect(sent()).toEqual([['cover', 'set_cover_tilt_position', { tilt_position: 90 }]]);
    expect(picture(root)).toMatchObject({ slat: 0.357, held: false });
    expect(figure(root, '.cv-tilt')).toEqual(['90', '%', 'Partly open']);
  });

  it('says shut and open in words, dimming the light to 30 % as they shut', async () => {
    const shut = await draw({ tilt_style: 'slats' }, blind({ current_tilt_position: 0 }));
    expect(figure(shut.root, '.cv-tilt')).toEqual(['0', '%', 'Closed']);
    expect(picture(shut.root)).toMatchObject({ slat: 1, light: 0.3 });
    document.body.replaceChildren();
    const open = await draw({ tilt_style: 'slats' }, blind({ current_tilt_position: 100 }));
    expect(figure(open.root, '.cv-tilt')).toEqual(['100', '%', 'Open']);
    expect(picture(open.root)).toMatchObject({ slat: 0.286, light: 1 });
  });

  it('turns the tilt round where the cover reports it so: figure, slats and what is sent', async () => {
    const { card, root } = await draw(
      { tilt_style: 'slats', invert_tilt: true },
      blind({ current_tilt_position: 30 }),
    );
    expect(figure(root, '.cv-tilt')).toEqual(['70', '%', 'Partly open']);
    await slide(card, rulers(root).tilt!, 80);
    expect(sent()).toEqual([['cover', 'set_cover_tilt_position', { tilt_position: 20 }]]);
  });

  it('reads in degrees, open in the middle where the slats turn 180°', async () => {
    const { root } = await draw({ tilt_style: 'slats', tilt_angle: 180 });
    expect(figure(root, '.cv-tilt')).toEqual(['90', '°', 'Open']);
    expect(texts(root, '.cv-tilt .fv-ruler-labels span')).toEqual(['Closed', 'Open', 'Closed']);
  });

  it('keeps the stepper for a cover that only opens and closes its slats', async () => {
    const { root } = await draw(
      { tilt_style: 'slats' },
      blind({ supported_features: 1 | 2 | 4 | 8 | 16 | 32 }),
    );
    expect(root.querySelector('.cv-slats')).toBeNull();
    expect(root.querySelector('.dv-cover__tilt .fv-stepper')).not.toBeNull();
  });

  it('out of reach keeps its anatomy: "—", no light, the ruler still', async () => {
    const gone = blind(
      { current_position: undefined, current_tilt_position: undefined },
      'unavailable',
    );
    const { root } = await draw({ tilt_style: 'slats' }, gone);
    expect(figure(root, '.cv-tilt')).toEqual(['—']);
    expect(picture(root).light).toBe(0);
    expect(rulers(root).tilt?.disabled).toBe(true);
  });

  it('stands over the commands on a cover with no position, and under them where the column is short', async () => {
    const louvres = await draw(
      { tilt_style: 'slats' },
      blind({ supported_features: 251, current_position: undefined }),
    );
    expect(louvres.root.querySelector('.cv-tilt--alone + .fv-actions')).not.toBeNull();
    document.body.replaceChildren();
    const narrow = await draw({ tilt_style: 'slats' }, blind(), 152);
    expect(narrow.root.querySelector('.fv-actions + .cv-tilt--under')).not.toBeNull();
  });
});

describe('a cover counted its own way', () => {
  it('counts the position as the blind comes down: the figure, the word, lit from the top', async () => {
    const { card, root } = await draw({ direction: 'down', position_presets: [0, 100] });
    expect(figure(root, '.dv-cover__side > .fv-readout')).toEqual(['35', '%', 'down']);
    const { position } = rulers(root);
    expect([position?.value, position?.origin]).toEqual([65, 100]);
    // its presets on its own figure: 0 down is open
    expect(texts(root, '.cv-presets .fv-chip')).toEqual(['Open', 'Closed']);
    await slide(card, position!, 80);
    all(root, '.cv-presets .fv-chip')[1]!.click();
    expect(sent()).toEqual([
      ['cover', 'set_cover_position', { position: 80 }],
      ['cover', 'set_cover_position', { position: 0 }],
    ]);
  });

  it('turns round a position reported 100 % closed, both commands live', async () => {
    const { card, root } = await draw({ invert_position: true }, blind({ current_position: 100 }));
    expect(figure(root, '.dv-cover__side > .fv-readout')).toEqual(['0', '%']);
    expect(all(root, '.fv-action').map((button) => button.hasAttribute('disabled'))).toEqual([
      false,
      false,
      false,
    ]);
    await slide(card, rulers(root).position!, 80);
    expect(sent()).toEqual([['cover', 'set_cover_position', { position: 20 }]]);
  });

  it('names the ruler’s ends in the person’s own words', async () => {
    const { root } = await draw({ open_label: 'Up', closed_label: ' Down ' });
    expect(texts(root, '.dv-vlabels span.is-own')).toEqual(['Up', 'Down']);
  });
});

describe('presets', () => {
  it('stand as chips under the commands, the ends in words and the one in force lit', async () => {
    const { root } = await draw({
      tilt_style: 'slats',
      position_presets: [0, 65, 100],
      tilt_presets: ['0', '50', '100'],
    });
    const [position, tilt] = all(root, '.cv-presets');
    expect(texts(position!, '.fv-chip')).toEqual(['Closed', '65 %', 'Open']);
    expect(texts(tilt!, '.fv-chip')).toEqual(['Closed', '50 %', 'Open']);
    expect(texts(root, '.cv-presets .fv-chip.is-active')).toEqual(['65 %', '50 %']);
    // the tilt's stand away from its slats beside the position: under its name
    expect(texts(root, '.cv-presets .fv-label')).toEqual(['Tilt']);
    all(tilt!, '.fv-chip')[2]!.click();
    all(position!, '.fv-chip')[0]!.click();
    expect(sent()).toEqual([
      ['cover', 'set_cover_tilt_position', { tilt_position: 100 }],
      ['cover', 'set_cover_position', { position: 0 }],
    ]);
  });
});

describe('the editor’s Position and tilt', () => {
  const fields = (data: Record<string, unknown>, state = blind()): string[] =>
    shownNames(
      visibleFields(
        coverEditor.getConfigForm().schema,
        {
          type: 'custom:fluvy-cover-card',
          entity: state.entity_id,
          ...data,
        },
        house(state),
      ),
    );
  const POSITION = [
    'direction',
    'invert_position',
    'position_presets',
    'open_label',
    'closed_label',
  ];
  const TILT = ['tilt_style', 'invert_tilt', 'tilt_presets'];

  it('offers each key where the cover can act on it', () => {
    expect(fields({})).toEqual(expect.arrayContaining([...POSITION, ...TILT]));
    // a cover that only opens and closes its slats has no angle for the slats or their presets
    const steps = fields({}, blind({ supported_features: 1 | 2 | 4 | 8 | 16 | 32 }));
    expect(steps).toEqual(expect.arrayContaining(POSITION));
    expect(steps).not.toEqual(expect.arrayContaining(['tilt_style']));
    // the tilt hidden, none of its own; the compact card, none at all
    expect(fields({ show_tilt: false })).not.toEqual(expect.arrayContaining(['tilt_presets']));
    expect(fields({ variant: 'compact' })).not.toEqual(expect.arrayContaining(['direction']));
  });

  it('shows what the card does where nothing is said, and writes none of it', () => {
    expect(coverEditor.defaults!({ type: 'custom:fluvy-cover-card' }, undefined)).toMatchObject({
      tilt_style: 'steps',
      direction: 'up',
      invert_position: false,
      invert_tilt: false,
    });
  });
});

describe('a tilt under about 200 (found on the way)', () => {
  it('stands under the commands with its stepper, where the column cannot hold it', async () => {
    const { root } = await draw({}, blind(), 172);
    expect(root.querySelector('.dv-cover__tilt')).toBeNull();
    expect(root.querySelector('.fv-actions + .dv-value .fv-stepper')).not.toBeNull();
    // at a phone's column it stays in the column, as before
    document.body.replaceChildren();
    const phone = await draw();
    expect(phone.root.querySelector('.dv-value')).toBeNull();
  });

  it('says the position with a glyph where the column cannot hold its label, its words read out', async () => {
    const { root } = await draw({}, blind(), 152);
    const label = root.querySelector('.dv-cover__side > .fv-readout .fv-readout__label--icon');
    expect(label?.querySelector('svg')).not.toBeNull();
    expect(label?.querySelector('.fv-sr')?.textContent).toBe('Position');
    document.body.replaceChildren();
    const phone = await draw();
    expect(texts(phone.root, '.dv-cover__side > .fv-readout .fv-readout__label')).toEqual([
      'Position',
    ]);
  });
});

describe('the horizontal card (#244)', () => {
  type Across = Ruler & { length: number; vertical: boolean };
  /** The horizontal ruler, its ends' words over it and the readout's column. */
  const across = (root: ParentNode) => ({
    ruler: root.querySelector<Across>('.cv-across fluvy-ruler'),
    ends: texts(root, '.cv-across .fv-ruler-labels span'),
    stacked: root.querySelector('.cv-across')?.classList.contains('cv-across--stacked'),
    column: root.querySelector<HTMLElement>('.cv-across')?.style.getPropertyValue('--cv-column'),
  });
  const LOUVRES = 1 | 2 | 8 | 16 | 32 | 64 | 128;

  it('declares its height from its config: the row, the tilt under the commands, presets, favourites', () => {
    expect(coverHeight({ variant: 'horizontal' })).toBe(228);
    expect(coverHeight({ variant: 'horizontal' }, ALL)).toBe(228 + 80);
    expect(coverHeight({ variant: 'horizontal', show_tilt: false }, ALL)).toBe(228);
    expect(coverHeight({ variant: 'horizontal', tilt_style: 'slats' })).toBe(228 + 136);
    // the tilt's presets under the tilt itself, with no name over them
    expect(
      coverHeight(
        { variant: 'horizontal', position_presets: [0, 100], tilt_presets: [0, 100] },
        ALL,
      ),
    ).toBe(228 + 56 + 80 + 56);
    expect(coverHeight({ variant: 'horizontal', favorites: [{ position: 50 }] })).toBe(228 + 88);
    // a cover with no position draws as the full card does
    expect(coverHeight({ variant: 'horizontal' }, LOUVRES)).toBe(coverHeight({}, LOUVRES));
    // the card as it was is untouched
    expect(coverHeight({})).toBe(328);
  });

  it('lays its readout beside the ruler, the ends’ words over it and the tilt under the commands', async () => {
    const { card, root } = await draw({ variant: 'horizontal' });
    const row = across(root);
    // "Position" at 8 a letter: a 64 column, 24 to the ruler, which takes the rest of the 320
    expect([row.stacked, row.column, row.ruler?.vertical, row.ruler?.length]).toEqual([
      false,
      '64px',
      false,
      232,
    ]);
    expect(row.ends).toEqual(['Closed', 'Open']);
    expect(figure(root, '.cv-across > .fv-readout')).toEqual(['65', '%']);
    expect(root.querySelector('fluvy-ruler[vertical], .dv-cover')).toBeNull();
    expect(root.querySelector('.fv-card.cv-card--across .cv-across + .fv-actions')).not.toBeNull();
    expect(root.querySelector('.fv-actions + .dv-value .fv-stepper')).not.toBeNull();
    expect(card.getGridOptions()).toMatchObject({ columns: 12, min_columns: 6 });
    expect(card.getCardSize()).toBe(6);
    await slide(card, row.ruler!, 30);
    expect(sent()).toEqual([['cover', 'set_cover_position', { position: 30 }]]);
  });

  it('stands its slats under the commands, its position’s presets after them', async () => {
    const { root } = await draw({
      variant: 'horizontal',
      tilt_style: 'slats',
      position_presets: [0, 100],
    });
    expect(root.querySelector('.fv-actions + .cv-presets + .cv-tilt--under')).not.toBeNull();
    expect(texts(root, '.cv-presets .fv-label')).toEqual([]);
  });

  it('stands the readout over the ruler in a narrow column, the ends in figures where words do not hold', async () => {
    const { root } = await draw({ variant: 'horizontal' }, blind(), 152);
    expect([across(root).stacked, across(root).ruler?.length]).toEqual([true, 112]);
    expect(across(root).ends).toEqual(['Closed', 'Open']);
    document.body.replaceChildren();
    // the person's own words where 112 holds them 8 apart (32 and 64); else their figures, counted as the card counts
    const own = await draw(
      { variant: 'horizontal', open_label: 'Fully up', closed_label: 'Shut', direction: 'down' },
      blind(),
      152,
    );
    expect(across(own.root).ends).toEqual(['Shut', 'Fully up']);
    document.body.replaceChildren();
    const longer = await draw(
      {
        variant: 'horizontal',
        open_label: 'Fully open',
        closed_label: 'Closed',
        direction: 'down',
      },
      blind(),
      152,
    );
    expect(across(longer.root).ends).toEqual(['100 %', '0 %']);
  });

  it('counts down from the open end, the word after the figure where its column holds it', async () => {
    const { card, root } = await draw({ variant: 'horizontal', direction: 'down' });
    const { ruler } = across(root);
    expect([ruler?.value, ruler?.origin]).toEqual([65, 100]);
    expect(figure(root, '.cv-across > .fv-readout')).toEqual(['35', '%', 'down']);
    // the fine scale up, the ends say its figures as the card counts them
    ruler!.dispatchEvent(
      new CustomEvent('fluvy-window', { detail: { min: 60, max: 70, fine: true, marks: [] } }),
    );
    await card.updateComplete;
    expect(across(root).ends).toEqual(['40 %', '30 %']);
  });

  it('keeps its anatomy and its size out of reach', async () => {
    const gone = blind(
      { current_position: undefined, current_tilt_position: undefined },
      'unavailable',
    );
    const { root } = await draw({ variant: 'horizontal' }, gone);
    expect(figure(root, '.cv-across > .fv-readout')).toEqual(['—']);
    expect(across(root).ruler?.disabled).toBe(true);
    expect(across(root).ends).toEqual(['Closed', 'Open']);
    expect(root.querySelector('.fv-actions + .dv-value .fv-stepper')).not.toBeNull();
  });

  it('is offered by the editor, with the position’s and the tilt’s keys', () => {
    const options = (items: readonly unknown[]): string[] =>
      items.flatMap((item) => {
        const field = item as {
          name?: string;
          schema?: readonly unknown[];
          selector?: { select?: { options: { value: string }[] } };
        };
        return field.name === 'variant'
          ? (field.selector?.select?.options.map((option) => option.value) ?? [])
          : options(field.schema ?? []);
      });
    expect(options(coverEditor.getConfigForm().schema)).toEqual(['full', 'compact', 'horizontal']);
    const shown = shownNames(
      visibleFields(
        coverEditor.getConfigForm().schema,
        { type: 'custom:fluvy-cover-card', entity: 'cover.office', variant: 'horizontal' },
        house(blind()),
      ),
    );
    expect(shown).toEqual(expect.arrayContaining(['direction', 'tilt_style', 'slider_style']));
  });
});
