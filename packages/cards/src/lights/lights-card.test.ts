// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import type { HeadFit } from '../energy/head.js';
import { FluvyEntitiesCard } from '../entities/entities-card.js';
import { FluvyLockCard } from '../lock/lock-card.js';
import { FluvyRoomCard } from '../room/room-card.js';
import type { CardEditor } from '../shared/base.js';
import {
  cardForm,
  drawEditor,
  nextConfig,
  shownNames,
  type FormStub,
} from '../shared/fixtures/editor.js';
import type { FormLabeler } from '../shared/form.js';
import { FluvyTilesCard } from '../tiles/tiles-card.js';
import { FluvyLightsCard, lightsHeight, type LightsCardConfig } from './lights-card.js';

// the index fetches the lazy families: they land before this file's page goes
afterAll(() => familiesDefined);
afterEach(() => document.body.replaceChildren());

/**
 * #58: the room lights card in its lights' colours whatever its style — a white by its temperature (the default) or as
 * the palette's light, the card's colour and tone after its bulbs' — its tiles saying their level as its line does, and
 * its editor offering only what acts in the style chosen.
 */

const STAMP = '2026-10-21T19:00:00+00:00';
const state = (id: string, value: string, attributes: Record<string, unknown>) => ({
  entity_id: id,
  state: value,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});
/** A Hue Play as Home Assistant reports it in colour temperature (the reporter's lamps): its colour beside it. */
const PLAY = { supported_color_modes: ['color_temp', 'xy'] };
const STATES = {
  'light.desk': state('light.desk', 'on', {
    friendly_name: 'Desk',
    ...PLAY,
    color_mode: 'color_temp',
    brightness: 61,
    color_temp_kelvin: 2732,
    rgb_color: [255, 167, 87],
  }),
  'light.floor': state('light.floor', 'on', {
    friendly_name: 'Floor lamp',
    ...PLAY,
    color_mode: 'xy',
    brightness: 255,
    rgb_color: [255, 0, 0],
  }),
  'light.shelf': state('light.shelf', 'on', {
    friendly_name: 'Shelf',
    supported_color_modes: ['onoff'],
    color_mode: 'onoff',
  }),
  'light.sconce': state('light.sconce', 'off', { friendly_name: 'Sconce', ...PLAY }),
};
const LIGHTS = Object.keys(STATES);

const house = (extra: Record<string, ReturnType<typeof state>> = {}): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: { ...STATES, ...extra },
    entities: {},
    devices: {},
    areas: {},
    user: { id: 'u', is_admin: true },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
    callService: () => Promise.resolve(),
  }) as unknown as HomeAssistant;

type CardElement = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};

async function mount(
  config: Record<string, unknown>,
  extra: Record<string, ReturnType<typeof state>> = {},
): Promise<ShadowRoot> {
  const card = document.createElement('fluvy-lights-card') as CardElement;
  card.setConfig({ type: 'custom:fluvy-lights-card', lights: LIGHTS, ...config });
  card.hass = house(extra);
  document.body.append(card);
  await card.updateComplete;
  return card.shadowRoot!;
}

/** What each light's control wears in the style asked: its colour (`data-accent`) and its tone. */
const worn = (root: ShadowRoot, selector: string): (readonly [string, string])[] =>
  [...root.querySelectorAll<HTMLElement>(selector)].map((el) => [
    el.dataset['accent'] ?? '',
    [...el.classList].find((c) => /^fv-(tile|ico|tone)--(?!tap|inner|compact)/.test(c)) ?? '',
  ]);

describe('the room lights in their bulbs’ colours, in every style (#58)', () => {
  const SELECTORS = { row: '.lt-bulb', chips: '.fv-chip', tiles: '.fv-tile' } as const;

  it('a white in its warmth, a colour bulb in its colour, one that only switches and an off one in the palette’s', async () => {
    for (const [variant, selector] of Object.entries(SELECTORS)) {
      const accents = worn(await mount({ variant }), selector).map(([accent]) => accent);
      expect(accents, variant).toEqual(['white #ffa757', '#ff0000', '', '']);
    }
  });

  it('a white as the palette’s light where the card asks (`light_whites: palette`)', async () => {
    for (const [variant, selector] of Object.entries(SELECTORS)) {
      const accents = worn(await mount({ variant, light_whites: 'palette' }), selector);
      expect(
        accents.map(([accent]) => accent),
        variant,
      ).toEqual(['', '#ff0000', '', '']);
    }
  });

  it('its tiles take the card’s tone and colour where a lamp shows none of its own, as its rounds and chips do', async () => {
    const heat = worn(
      await mount({ variant: 'tiles', tone: 'heat', light_colors: false }),
      '.fv-tile',
    );
    expect(heat.slice(0, 3)).toEqual([
      ['', 'fv-tile--heat'],
      ['', 'fv-tile--heat'],
      ['', 'fv-tile--heat'],
    ]);
    const rounds = worn(await mount({ tone: 'heat', light_colors: false }), '.lt-bulb');
    expect(rounds[0]).toEqual(['', 'fv-ico--heat']);
    // the bulb's colour first (each tile given its lamp's, in the accent), then the card's (in the lit light it redefines)
    const purple = worn(
      await mount({ variant: 'tiles', color: 'purple', tone: 'heat' }),
      '.fv-tile',
    );
    expect(purple.slice(0, 3)).toEqual([
      ['white #ffa757', 'fv-tile--accent'],
      ['#ff0000', 'fv-tile--accent'],
      ['', 'fv-tile--light'],
    ]);
  });

  it('its tiles say their level only where the card shows levels (`show_level`)', async () => {
    const line = async (config: Record<string, unknown>): Promise<string> =>
      (await mount({ variant: 'tiles', ...config }))
        .querySelector('.fv-tile__state')!
        .textContent!.trim();
    expect(await line({})).toBe('On · 24 %');
    expect(await line({ show_level: false })).toBe('On');
  });

  it('its tiles take a name in two lines where asked, each a line taller, from the config alone (#100)', async () => {
    const tiles = (await mount({ variant: 'tiles', name_lines: 2 })).querySelectorAll('.fv-tile');
    expect([...tiles].every((tile) => tile.classList.contains('fv-tile--lines'))).toBe(true);
    const config: LightsCardConfig = {
      type: 'custom:fluvy-lights-card',
      variant: 'tiles',
      lights: ['light.a', 'light.b'],
    };
    expect(
      FluvyLightsCard.layoutHeight({ ...config, name_lines: 2 }) -
        FluvyLightsCard.layoutHeight(config),
    ).toBe(12);
    // the rounds and the chips have no tile to make taller
    expect(FluvyLightsCard.layoutHeight({ ...config, variant: 'row', name_lines: 2 })).toBe(
      FluvyLightsCard.layoutHeight({ ...config, variant: 'row' }),
    );
  });
});

describe('an area’s lamps on plugs, by their names, where the card asks (1.23, #219)', () => {
  /** A workshop: a light, a lamp and a door light on relays, and a kettle on its plug. */
  const workshop = (): HomeAssistant => {
    const seeds = {
      'light.workshop': state('light.workshop', 'on', { friendly_name: 'Workshop ceiling' }),
      'switch.workshop_lamp': state('switch.workshop_lamp', 'on', { friendly_name: '工作室 电灯' }),
      'switch.relay_door': state('switch.relay_door', 'off', { friendly_name: 'Door light' }),
      'switch.kettle': state('switch.kettle', 'off', { friendly_name: 'Kettle' }),
    };
    return {
      ...house(seeds),
      entities: Object.fromEntries(
        Object.keys(seeds).map((id) => [id, { entity_id: id, area_id: 'workshop' }]),
      ),
      areas: { workshop: { area_id: 'workshop', name: 'Workshop', picture: null } },
    } as unknown as HomeAssistant;
  };
  const names = async (config: Record<string, unknown>): Promise<string[]> => {
    const card = document.createElement('fluvy-lights-card') as CardElement;
    card.setConfig({ type: 'custom:fluvy-lights-card', area: 'workshop', ...config });
    card.hass = workshop();
    document.body.append(card);
    await card.updateComplete;
    // the rule's chunk lands, and the card is drawn again
    await import('../shared/lamps.js');
    await new Promise((resolve) => setTimeout(resolve));
    await card.updateComplete;
    return [...card.shadowRoot!.querySelectorAll('.lt-bulb')].map(
      (round) => round.getAttribute('aria-label') ?? '',
    );
  };

  it('counts the lamps among the area’s lights, never the kettle; not unless asked', async () => {
    expect(await names({})).toEqual(['Workshop ceiling']);
    expect(await names({ lamp_switches: true })).toEqual([
      'Door light',
      'Workshop ceiling',
      '工作室 电灯',
    ]);
    // a list of its own is the card's: the area's lamps are not added to it
    expect(await names({ lamp_switches: true, lights: ['light.workshop'] })).toEqual([
      'Workshop ceiling',
    ]);
  });
});

describe('a lamp on a plug, switched in its own domain (#170)', () => {
  /**
   * A room of a light and a lamp on a plug (a switch the house counts as a light), both off: its card and each call it
   * makes, as Home Assistant hears it (domain, service, data).
   */
  async function room(config: Record<string, unknown> = {}) {
    const calls: unknown[][] = [];
    const card = document.createElement('fluvy-lights-card') as CardElement & {
      sheetHost: { pick(data: Record<string, unknown>): void };
    };
    card.setConfig({
      type: 'custom:fluvy-lights-card',
      lights: ['light.sconce', 'switch.lamp'],
      ...config,
    });
    card.hass = {
      ...house({ 'switch.lamp': state('switch.lamp', 'off', { friendly_name: 'Lamp' }) }),
      callService: (...args: unknown[]) => {
        calls.push(args.slice(0, 3));
        return Promise.resolve();
      },
    } as unknown as HomeAssistant;
    document.body.append(card);
    await card.updateComplete;
    return { card, root: card.shadowRoot!, calls };
  }
  const tap = (el: Element | undefined | null): void =>
    (el as unknown as { fvTap(): void }).fvTap();

  it('the room’s tap turns the light on as a light and the plug as a switch', async () => {
    const { root, calls } = await room();
    tap(root.querySelector('.lt-room'));
    expect(calls).toEqual([
      ['light', 'turn_on', { entity_id: ['light.sconce'] }],
      ['switch', 'turn_on', { entity_id: ['switch.lamp'] }],
    ]);
  });

  it('the plug’s own round and chip switch it as a switch', async () => {
    const { root, calls } = await room();
    tap(root.querySelectorAll('.lt-bulb')[1]);
    const chips = await room({ variant: 'chips' });
    chips.root.querySelectorAll<HTMLElement>('.fv-chip')[1]!.click();
    expect([...calls, ...chips.calls]).toEqual([
      ['switch', 'turn_on', { entity_id: ['switch.lamp'] }],
      ['switch', 'turn_on', { entity_id: ['switch.lamp'] }],
    ]);
  });

  it('a level is the light’s alone: the plug beside it just comes on, and both go off at 0', async () => {
    const { root, calls } = await room({ show_brightness: true });
    const ruler = root.querySelector('fluvy-ruler')!;
    const slide = (value: number): boolean =>
      ruler.dispatchEvent(new CustomEvent('fluvy-change', { detail: { value } }));
    slide(40);
    slide(0);
    expect(calls).toEqual([
      ['light', 'turn_on', { entity_id: ['light.sconce'], brightness_pct: 40 }],
      ['switch', 'turn_on', { entity_id: ['switch.lamp'] }],
      ['light', 'turn_off', { entity_id: ['light.sconce'] }],
      ['switch', 'turn_off', { entity_id: ['switch.lamp'] }],
    ]);
  });

  it('a colour is the light’s alone: the plug beside it just comes on', async () => {
    const { card, calls } = await room({ show_color: true });
    card.sheetHost.pick({ hs_color: [30, 80] });
    expect(calls).toEqual([
      ['light', 'turn_on', { entity_id: ['light.sconce'], hs_color: [30, 80] }],
      ['switch', 'turn_on', { entity_id: ['switch.lamp'] }],
    ]);
  });
});

describe('the colour round (#137)', () => {
  const ROUND = '.fv-round.lt-colour';

  it('is off by default: a card that does not ask draws no round, its head and its height as before', async () => {
    for (const variant of ['row', 'chips', 'tiles']) {
      const root = await mount({ variant });
      expect(root.querySelector(ROUND), variant).toBeNull();
      expect(root.querySelector('.lt-trail, .lt-colour-row, fluvy-lights-colour-sheet')).toBeNull();
    }
    const config: LightsCardConfig = {
      type: 'custom:fluvy-lights-card',
      lights: ['light.a', 'light.b', 'light.c', 'light.d'],
    };
    expect(FluvyLightsCard.layoutHeight(config)).toBe(84);
    expect(FluvyLightsCard.layoutHeight({ ...config, show_color: false })).toBe(84);
    // asked for, the round takes a fourth light's room beside the name: four lights go to their own line
    expect(FluvyLightsCard.layoutHeight({ ...config, show_color: true })).toBe(
      20 + 44 + 16 + 44 + 20,
    );
    expect(
      FluvyLightsCard.layoutHeight({
        ...config,
        lights: config.lights!.slice(0, 3),
        show_color: true,
      }),
    ).toBe(84);
    // a room of whites draws none, whatever is asked: the house says so
    expect(
      lightsHeight(
        { ...config, show_color: true },
        { area: undefined, nameOf: () => undefined, admin: false, colour: false },
      ),
    ).toBe(84);
  });

  it('stands in the head before the lights’ rounds, or before the switch, named for a reader', async () => {
    const row = await mount({ show_color: true });
    const trail = row.querySelector('.fv-card__head .lt-trail')!;
    expect(trail.firstElementChild?.matches(ROUND)).toBe(true);
    expect(trail.lastElementChild?.matches('.lt-bulbs')).toBe(true);
    expect(trail.querySelector(ROUND)?.getAttribute('aria-label')).toBe('Lights · Colour');
    for (const variant of ['chips', 'tiles']) {
      const head = (await mount({ variant, show_color: true })).querySelector('.fv-card__head')!;
      const round = head.querySelector(ROUND)!;
      expect(round, variant).not.toBeNull();
      expect(round.nextElementSibling?.matches('.fv-hit'), variant).toBe(true);
    }
  });

  it('shows only where a light of the room takes a colour; out of reach it stays, disabled', async () => {
    expect(
      (await mount({ show_color: true, lights: ['light.shelf'] })).querySelector(ROUND),
    ).toBeNull();
    expect(
      (await mount({ show_color: true, lights: ['light.desk', 'light.shelf'] })).querySelector(
        ROUND,
      ),
    ).not.toBeNull();
    // an unavailable bulb keeps its colour modes: the round stays where it stands, disabled; one the house has never read has none
    const lost = await mount(
      { show_color: true, lights: ['light.lost'] },
      { 'light.lost': state('light.lost', 'unavailable', { friendly_name: 'Lost', ...PLAY }) },
    );
    expect(lost.querySelector<HTMLButtonElement>(ROUND)?.disabled).toBe(true);
    expect(
      (await mount({ show_color: true, lights: ['light.gone'] })).querySelector(ROUND),
    ).toBeNull();
  });

  it('opens Home Assistant’s details of the card’s one light where asked, else the sheet', async () => {
    const card = document.createElement('fluvy-lights-card') as CardElement;
    card.setConfig({
      type: 'custom:fluvy-lights-card',
      lights: ['light.floor'],
      show_color: true,
      color_action: 'more-info',
    });
    card.hass = house();
    document.body.append(card);
    await card.updateComplete;
    const opened: string[] = [];
    card.addEventListener('hass-more-info', (e) =>
      opened.push((e as CustomEvent<{ entityId: string }>).detail.entityId),
    );
    card.shadowRoot!.querySelector<HTMLElement>(ROUND)!.click();
    expect(opened).toEqual(['light.floor']);
  });
});

describe('the room’s switch, where only some lights are on (1.23, #219)', () => {
  const roomSwitch = (root: ShadowRoot): HTMLElement =>
    root.querySelector<HTMLElement>('.fv-card__head [role="switch"]')!;

  it('is off by default: the switch is on while any light is, as before', async () => {
    for (const variant of ['chips', 'tiles']) {
      const root = await mount({ variant });
      expect(roomSwitch(root).getAttribute('aria-checked'), variant).toBe('true');
      expect(roomSwitch(root).classList.contains('is-mixed')).toBe(false);
    }
  });

  it('asked, says so: neither on nor off while some are, on while every one is, off while none is', async () => {
    const root = await mount({ variant: 'chips', show_mixed: true });
    expect(roomSwitch(root).getAttribute('aria-checked')).toBe('mixed');
    expect(roomSwitch(root).classList.contains('is-mixed')).toBe(true);
    const all = await mount({ variant: 'tiles', show_mixed: true, lights: LIGHTS.slice(0, 3) });
    expect(roomSwitch(all).getAttribute('aria-checked')).toBe('true');
    const none = await mount({ variant: 'tiles', show_mixed: true, lights: ['light.sconce'] });
    expect(roomSwitch(none).getAttribute('aria-checked')).toBe('false');
  });
});

describe('the lights in rows, and what ends the head (1.26, #261)', () => {
  const badge = (root: ShadowRoot): HTMLElement | null =>
    root.querySelector<HTMLElement>('.fv-card__head .fv-badge');
  const words = (el: Element | null | undefined): string => el?.textContent?.trim() ?? '';
  const line = (root: ShadowRoot): string => words(root.querySelector('.fv-card__sub'));
  const roomSwitch = (root: ShadowRoot): Element | null =>
    root.querySelector('.fv-card__head [role="switch"]');
  const rowsOf = (root: ShadowRoot): HTMLElement[] => [
    ...root.querySelectorAll<HTMLElement>('.fv-rows > .fv-row'),
  ];
  /** Each row as it is drawn: its name, its line, its lamp's colour, its circle's tone, what ends it. */
  const drawn = (root: ShadowRoot) =>
    rowsOf(root).map((row) => ({
      name: words(row.querySelector('.fv-row__title')),
      line: words(row.querySelector('.fv-row__sub')),
      accent: row.dataset['accent'] ?? '',
      tone: /fv-ico--(\w+)/.exec(row.querySelector('.fv-ico')?.className ?? '')?.[1] ?? '',
      // its circle and its words, and nothing after them
      parts: row.childElementCount,
    }));
  /** A card whose calls are kept as Home Assistant hears them, on a house that says a state as it is drawn. */
  async function calling(config: Record<string, unknown>) {
    const calls: unknown[][] = [];
    const card = document.createElement('fluvy-lights-card') as CardElement;
    card.setConfig({ type: 'custom:fluvy-lights-card', lights: LIGHTS, ...config });
    card.hass = {
      ...house({ 'light.gone': state('light.gone', 'unavailable', { friendly_name: 'Garden' }) }),
      formatEntityState: (entity: { state: string }, said = entity.state) => said,
      callService: (...args: unknown[]) => {
        calls.push(args.slice(0, 3));
        return Promise.resolve();
      },
    } as unknown as HomeAssistant;
    document.body.append(card);
    await card.updateComplete;
    return { card, root: card.shadowRoot!, calls };
  }
  const press = (el: Element | undefined | null, kind: 'fvTap' | 'fvHold' = 'fvTap'): void =>
    (el as unknown as Record<string, (() => void) | undefined>)[kind]?.();

  it('draws a row a light, as a list does: its name over its state and level, its circle in its lamp’s colour, nothing at its end', async () => {
    const root = await mount({ variant: 'rows' });
    expect(drawn(root)).toEqual([
      { name: 'Desk', line: 'On · 24 %', accent: 'white #ffa757', tone: 'light', parts: 2 },
      { name: 'Floor lamp', line: 'On · 100 %', accent: '#ff0000', tone: 'light', parts: 2 },
      // one that only switches says no level, an off one wears no colour
      { name: 'Shelf', line: 'On', accent: '', tone: 'light', parts: 2 },
      { name: 'Sconce', line: 'Off', accent: '', tone: 'neutral', parts: 2 },
    ]);
    // no chips, no tiles, no rounds: the rows alone
    expect(root.querySelector('.fv-chip, .fv-tile, .lt-bulb')).toBeNull();
    const still = await mount({ variant: 'rows', show_level: false });
    expect(drawn(still).map((row) => row.line)).toEqual(['On', 'On', 'On', 'Off']);
  });

  it('a tap on a row is its light’s switch, drawn at once; a hold its details; out of reach it takes no tap', async () => {
    const { card, root, calls } = await calling({
      variant: 'rows',
      lights: ['light.desk', 'light.sconce', 'light.gone'],
    });
    const opened: unknown[] = [];
    card.addEventListener('hass-more-info', (event) =>
      opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
    );
    const [desk, sconce, gone] = rowsOf(root);
    press(sconce);
    press(desk);
    expect(calls).toEqual([
      ['light', 'turn_on', { entity_id: ['light.sconce'] }],
      ['light', 'turn_off', { entity_id: ['light.desk'] }],
    ]);
    // each is drawn as the finger left it until Home Assistant agrees
    await card.updateComplete;
    expect(drawn(root).map((row) => row.line)).toEqual(['Off', 'On', 'Unavailable']);
    press(sconce, 'fvHold');
    expect(opened).toEqual(['light.sconce']);
    // out of reach: the dashed ring, no switch of its own, its details still a hold away
    expect(gone?.classList.contains('is-unavailable')).toBe(true);
    expect(drawn(root)[2]?.tone).toBe('off');
    press(gone);
    expect(calls).toHaveLength(2);
    press(gone, 'fvHold');
    expect(opened).toEqual(['light.sconce', 'light.gone']);
  });

  it('ends its head in a badge of how many are on, the line saying the rest; the head is still the whole room', async () => {
    const { root, calls } = await calling({ variant: 'rows' });
    expect(words(badge(root))).toBe('3 on');
    expect(badge(root)?.classList.contains('fv-badge--light')).toBe(true);
    expect(line(root)).toBe('4 lights · 62 %');
    expect(roomSwitch(root)).toBeNull();
    root.querySelector<HTMLElement>('.fv-card__tap')!.click();
    expect(calls).toEqual([['light', 'turn_off', { entity_id: LIGHTS }]]);
  });

  it('says "On" where the card counts none, "Off" in the neutral tone, and nothing out of reach', async () => {
    expect(words(badge(await mount({ variant: 'rows', show_count: false })))).toBe('On');
    const off = await mount({ variant: 'rows', lights: ['light.sconce'] });
    expect(words(badge(off))).toBe('Off');
    expect(badge(off)?.classList.contains('fv-badge--neutral')).toBe(true);
    expect(line(off)).toBe('1 light');
    const gone = { 'light.gone': state('light.gone', 'unavailable', { friendly_name: 'Garden' }) };
    const dead = await mount({ variant: 'rows', lights: ['light.gone'] }, gone);
    expect(badge(dead)).toBeNull();
    expect(line(dead)).toBe('Unavailable');
    // …and keeps its anatomy: its row, its circle the dashed ring
    expect(drawn(dead).map((row) => row.tone)).toEqual(['off']);
  });

  it('takes the room’s switch, or nothing, where asked; chips and tiles keep their switch, and take the badge', async () => {
    const switched = await mount({ variant: 'rows', control: 'switch' });
    expect(roomSwitch(switched)).not.toBeNull();
    expect(badge(switched)).toBeNull();
    expect(line(switched)).toBe('3 of 4 on · 62 %');
    const bare = await mount({ variant: 'rows', control: 'none' });
    expect(roomSwitch(bare) ?? badge(bare)).toBeNull();
    expect(line(bare)).toBe('3 of 4 on · 62 %');
    for (const variant of ['chips', 'tiles']) {
      // a card that says nothing draws as it did
      const untouched = await mount({ variant });
      expect(roomSwitch(untouched), variant).not.toBeNull();
      expect(badge(untouched), variant).toBeNull();
      expect(line(untouched), variant).toBe('3 of 4 on · 62 %');
      const badged = await mount({ variant, control: 'badge' });
      expect(words(badge(badged)), variant).toBe('3 on');
      expect(roomSwitch(badged), variant).toBeNull();
    }
    // the rounds stand at the head's end themselves: nothing to say
    const rounds = await mount({ control: 'badge' });
    expect(badge(rounds)).toBeNull();
    expect(rounds.querySelectorAll('.lt-bulb')).toHaveLength(4);
  });

  it('in half a column gives every circle to the names together, and its badge’s count to the line', async () => {
    const card = document.createElement('fluvy-lights-card') as CardElement & { width: number };
    const { ruler } = (card as unknown as { head: HeadFit }).head;
    vi.spyOn(ruler, 'width').mockImplementation((_cls, text) => text.length * 8);
    vi.spyOn(ruler, 'pill').mockImplementation(
      (_cls, text, pad) => Math.ceil((text.length * 8 + pad) / 4) * 4,
    );
    card.width = 172;
    card.setConfig({ type: 'custom:fluvy-lights-card', variant: 'rows', lights: LIGHTS });
    card.hass = house();
    document.body.append(card);
    await card.updateComplete;
    const root = card.shadowRoot!;
    // "Floor lamp" would end before it had begun beside a circle: none keeps one
    expect(rowsOf(root).every((row) => row.classList.contains('fv-row--bare'))).toBe(true);
    expect(drawn(root).map((row) => row.line)).toEqual(['On · 24 %', 'On · 100 %', 'On', 'Off']);
    expect(badge(root)).toBeNull();
    expect(line(root)).toBe('3 of 4 on');
  });

  it('declares its height from its config: 92 and 60 a light, 80 more with the room’s ruler', () => {
    const config: LightsCardConfig = {
      type: 'custom:fluvy-lights-card',
      variant: 'rows',
      lights: ['light.a', 'light.b'],
    };
    expect(FluvyLightsCard.layoutHeight(config)).toBe(92 + 2 * 60);
    expect(FluvyLightsCard.layoutHeight({ ...config, show_brightness: true })).toBe(
      92 + 80 + 2 * 60,
    );
    // what ends the head never changes it, nor the colour round, which stands in the head
    for (const control of ['switch', 'badge', 'none'] as const)
      expect(FluvyLightsCard.layoutHeight({ ...config, control, show_color: true })).toBe(
        92 + 2 * 60,
      );
    // a room's lights as the house lists them, three where it is not there to say
    const room: LightsCardConfig = {
      type: 'custom:fluvy-lights-card',
      variant: 'rows',
      area: 'kitchen',
    };
    expect(FluvyLightsCard.layoutHeight(room)).toBe(92 + 3 * 60);
    expect(
      lightsHeight(room, {
        area: ['light.a', 'light.b', 'light.c', 'light.d'],
        nameOf: () => undefined,
        admin: true,
      }),
    ).toBe(92 + 4 * 60);
    // every other style keeps its height, whatever ends its head
    for (const variant of ['row', 'chips', 'tiles'] as const)
      expect(FluvyLightsCard.layoutHeight({ ...config, variant, control: 'badge' })).toBe(
        FluvyLightsCard.layoutHeight({ ...config, variant }),
      );
  });

  it('its editor offers what ends the head but beside the rounds, the switch’s options only where it ends the head', async () => {
    const editor = await FluvyLightsCard.getConfigElement();
    (editor as HTMLElement & { hass: HomeAssistant }).hass = house();
    const form = async (config: Record<string, unknown>) =>
      cardForm(
        await drawEditor(editor, { type: 'custom:fluvy-lights-card', lights: LIGHTS, ...config }),
      );
    const shown = async (config: Record<string, unknown>): Promise<string[]> =>
      shownNames((await form(config)).schema);
    expect(await shown({})).not.toContain('control');
    for (const variant of ['chips', 'tiles']) {
      expect(await shown({ variant })).toEqual(expect.arrayContaining(['control', 'show_mixed']));
      expect(await shown({ variant, control: 'badge' })).not.toContain('show_mixed');
    }
    const rows = await shown({ variant: 'rows' });
    expect(rows).toContain('control');
    // the rows have no tile to wash, to name in two lines or to end in a rocker, and their badge is no switch
    for (const name of ['show_mixed', 'tint', 'name_lines', 'switch_style'])
      expect(rows, name).not.toContain(name);
    expect(await shown({ variant: 'rows', control: 'switch' })).toContain('show_mixed');
    // the rounds are called rounds, so "Row" never stands beside "Rows"
    const { schema } = await form({});
    const variant = JSON.stringify(schema).match(/"name":"variant".*?"options":(\[.*?\])/)?.[1];
    expect(JSON.parse(variant ?? '[]')).toEqual([
      { value: 'row', label: 'Rounds' },
      { value: 'chips', label: 'Chips' },
      { value: 'tiles', label: 'Tiles' },
      { value: 'rows', label: 'Rows' },
    ]);
  });
});

describe('the room lights card’s editor (#58)', () => {
  const shown = async (config: Record<string, unknown>): Promise<string[]> => {
    // the editor reads the house: which lights take a colour (#137)
    const editor = await FluvyLightsCard.getConfigElement();
    (editor as HTMLElement & { hass: HomeAssistant }).hass = house();
    return shownNames(
      cardForm(
        await drawEditor(editor, { type: 'custom:fluvy-lights-card', lights: LIGHTS, ...config }),
      ).schema,
    );
  };

  it('offers the colour at rest in tiles alone: the rounds and the chips have no surface to wash', async () => {
    expect(await shown({ variant: 'tiles' })).toContain('tint');
    expect(await shown({})).not.toContain('tint');
    expect(await shown({ variant: 'chips' })).not.toContain('tint');
  });

  it('offers how whites show beside the bulbs’ colours, while they show', async () => {
    const names = await shown({});
    expect(names.slice(names.indexOf('light_colors'), names.indexOf('light_colors') + 2)).toEqual([
      'light_colors',
      'light_whites',
    ]);
    expect(await shown({ light_colors: false })).not.toContain('light_whites');
  });

  it('offers the colour round where a light takes a colour, and what it opens only while it is on (#137)', async () => {
    const off = await shown({});
    expect(off).toContain('show_color');
    expect(off).not.toContain('color_control');
    expect(off).not.toContain('color_action');
    const on = await shown({ show_color: true });
    expect(on).toContain('color_control');
    // the details are one light's: a card of several keeps the sheet
    expect(on).not.toContain('color_action');
    expect(await shown({ show_color: true, lights: ['light.floor'] })).toContain('color_action');
    expect(
      await shown({ show_color: true, lights: ['light.floor'], color_action: 'more-info' }),
    ).not.toContain('color_control');
    // a room of whites alone has no colour to open
    expect(await shown({ lights: ['light.shelf'] })).not.toContain('show_color');
  });

  it('hands its sheet the line as the head gives way, whole: the level goes, then the words, never cut', async () => {
    const root = await mount({ show_color: true });
    const card = root.host as unknown as {
      head: { ruler: unknown };
      sheetHost: { line(width: number): string };
    };
    // seven pixels a character: the sheet's switch and its gap leave the line the width less 68
    Object.assign(card.head, { ruler: { width: (_cls: string, text: string) => text.length * 7 } });
    expect(card.sheetHost.line(360)).toBe('3 of 4 on · 62 %');
    expect(card.sheetHost.line(170)).toBe('3 of 4 on');
    expect(card.sheetHost.line(120)).toBe('3/4 on');
    expect(card.sheetHost.line(90)).toBe('3/4');
  });
});

describe('a light’s own colour in a list: none chosen by default, its bulb’s (#58)', () => {
  /** An item's colour field in a card's first list, through its rows. */
  const colourOf = async (card: { editor(): Promise<CardEditor> }) =>
    ((await card.editor()).lists ?? [])[0]!.schema
      .flatMap((item) => item.schema ?? [item])
      .find((item) => item.name === 'color')!;

  it('says none chosen where the item wears its bulb’s, else the card’s: lights, tiles, a room’s tiles, rows', async () => {
    for (const card of [FluvyLightsCard, FluvyTilesCard, FluvyRoomCard, FluvyEntitiesCard])
      expect((await colourOf(card)).selector?.['ui_color'], card.name).toEqual({
        include_none: false,
        include_state: false,
      });
    // a lock's rows have no bulb: none chosen either, the row wearing the card's colour until one is
    const lock = await colourOf(FluvyLockCard);
    expect(lock.selector?.['ui_color']).toEqual({ include_none: false, include_state: false });
    expect(lock.helper).toBe('editor.item_color_card_helper');
  });

  it('says what the light wears while none is chosen, and writes none', async () => {
    const editor = await drawEditor(await FluvyLightsCard.getConfigElement(), {
      type: 'custom:fluvy-lights-card',
      lights: ['light.desk'],
    });
    // the card's form, how its lights are named over them, then the light's own
    const item = editor.shadowRoot!.querySelectorAll<FormStub & { computeHelper: FormLabeler }>(
      'ha-form',
    )[2]!;
    const field = await colourOf(FluvyLightsCard);
    expect(item.computeHelper(field, (key: string) => key)).toBe(
      'Empty: the light’s bulb colour where the card shows bulbs’ colours, else the card’s',
    );
    expect(item.data).toEqual({ entity: 'light.desk' });
    const written = nextConfig(editor);
    item.change('name', 'Desk lamp');
    expect(await written).toEqual({
      type: 'custom:fluvy-lights-card',
      lights: [{ entity: 'light.desk', name: 'Desk lamp' }],
    });
  });
});
