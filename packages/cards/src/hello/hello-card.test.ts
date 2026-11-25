// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, shownNames, type FormStub } from '../shared/fixtures/editor.js';
import { saidWidths } from '../shared/fixtures/widths.js';
import type { FormLabeler } from '../shared/form.js';
import { FluvyHelloCard, type HelloCardConfig } from './hello-card.js';

// the index fetches the lazy families: they land before this file's page goes
afterAll(() => familiesDefined);
afterEach(() => document.body.replaceChildren());

/**
 * The greeting beyond its words (1.26, #260): without its name, its weather and its date as buttons of their own, a
 * line of quick actions under it; each off until asked, a greeting that asks for none of it drawn as it always was.
 */

const STAMP = '2026-09-17T19:00:00+00:00';
const state = (id: string, value: string, attributes: Record<string, unknown>) => ({
  entity_id: id,
  state: value,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});
const STATES = {
  'person.marta': state('person.marta', 'home', { friendly_name: 'Marta Ruiz', user_id: 'u' }),
  'weather.flat': state('weather.flat', 'cloudy', { friendly_name: 'Flat', temperature: 18 }),
  'light.hall': state('light.hall', 'on', {
    friendly_name: 'Hall',
    supported_color_modes: ['brightness'],
    color_mode: 'brightness',
    brightness: 153,
  }),
  'lock.door': state('lock.door', 'locked', { friendly_name: 'Front door' }),
  'sensor.room': state('sensor.room', '21.4', {
    friendly_name: 'Temperature',
    unit_of_measurement: '°C',
    device_class: 'temperature',
  }),
};

type CardElement = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};

/** A greeting on its evening, its calls kept as Home Assistant hears them, drawn again once its other chunk is here. */
async function mount(config: Omit<HelloCardConfig, 'type'> = {}) {
  const calls: unknown[][] = [];
  const card = document.createElement('fluvy-hello-card') as CardElement;
  card.setConfig({
    type: 'custom:fluvy-hello-card',
    _now: '2026-09-17T21:47:12',
    weather: 'weather.flat',
    ...config,
  });
  card.hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: STATES,
    entities: {},
    devices: {},
    areas: {},
    user: { id: 'u', name: 'Marta Ruiz', is_admin: true },
    localize: (key: string) => key,
    formatEntityState: (entity: { state: string }, said = entity.state) => said,
    hassUrl: (path: string) => path,
    callService: (...args: unknown[]) => {
      calls.push(args.slice(0, 3));
      return Promise.resolve();
    },
  } as unknown as HomeAssistant;
  document.body.append(card);
  await card.updateComplete;
  await import('./more.js');
  await new Promise((resolve) => setTimeout(resolve));
  await card.updateComplete;
  return { card, root: card.shadowRoot!, calls };
}

const words = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const press = (el: Element | undefined | null, kind: 'fvTap' | 'fvHold' = 'fvTap'): void =>
  (el as unknown as Record<string, (() => void) | undefined>)[kind]?.();
const height = (config: Omit<HelloCardConfig, 'type'>): number =>
  FluvyHelloCard.layoutHeight({ type: 'custom:fluvy-hello-card', ...config });

describe('the greeting without its name (`show_name`)', () => {
  it('greets by name unless asked not to; its avatar still says who', async () => {
    const named = await mount();
    expect(words(named.root.querySelector('.hm-hello__title'))).toContain('Good evening, Marta');
    const bare = await mount({ show_name: false });
    expect(bare.root.querySelector('.hm-hello__name')).toBeNull();
    expect(words(bare.root.querySelector('.hm-hello__greet'))).toBe('Good evening');
    expect(bare.root.querySelector('.hm-avatar')?.getAttribute('aria-label')).toBe('Marta Ruiz');
    // with no avatar either, the greeting is the card's button, read as it is said
    const alone = await mount({ show_name: false, show_avatar: false });
    expect(alone.root.querySelector('.hm-avatar')).toBeNull();
    expect(alone.root.querySelector('.fv-tile__tap')?.getAttribute('aria-label')).toBe(
      'Good evening',
    );
  });
});

describe('its weather and its date as buttons of their own', () => {
  const parts = (root: ShadowRoot): HTMLElement[] => [
    ...root.querySelectorAll<HTMLElement>('.hm-hello__meta > span'),
  ];

  it('are words alone until an action is set: nothing to press, nothing to focus', async () => {
    const { root } = await mount();
    expect(parts(root).map((part) => part.className)).toEqual([
      'hm-hello__date hm-hello__date--full',
      'hm-hello__date hm-hello__date--short',
      'hm-hello__weather',
    ]);
    expect(root.querySelector('.hm-hello__meta [role], .hm-hello__meta [tabindex], .hm-hit')).toBe(
      null,
    );
    expect(root.querySelector('.hm-quick')).toBeNull();
  });

  it('the weather answers for its entity, a tap and a hold each where set, in a 44 target of its own', async () => {
    const { card, root, calls } = await mount({
      weather_tap_action: { action: 'more-info' },
      weather_hold_action: {
        action: 'perform-action',
        perform_action: 'weather.get_forecasts',
        target: { entity_id: 'weather.flat' },
      },
    });
    const opened: unknown[] = [];
    card.addEventListener('hass-more-info', (event) =>
      opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
    );
    const weather = root.querySelector<HTMLElement>('.hm-hello__weather')!;
    expect(weather.getAttribute('role')).toBe('button');
    expect(weather.tabIndex).toBe(0);
    expect(weather.querySelector('.hm-hit')?.hasAttribute('data-target')).toBe(true);
    // what a reader hears is what it says
    expect(words(weather)).toBe('18° Cloudy');
    press(weather);
    expect(opened).toEqual(['weather.flat']);
    press(weather, 'fvHold');
    await Promise.resolve();
    expect(calls).toEqual([['weather', 'get_forecasts', {}]]);
    // the date names none: it stays words
    expect(root.querySelector('.hm-hello__date')?.hasAttribute('role')).toBe(false);
  });

  it('the date answers what needs no entity, in both its forms; an action that cannot run makes no button', async () => {
    const { card, root } = await mount({
      date_tap_action: { action: 'fire-dom-event', calendar: 'open' },
      // the details of nothing: no button that does nothing
      weather: undefined,
      weather_tap_action: { action: 'more-info' },
    });
    const fired: unknown[] = [];
    card.addEventListener('ll-custom', (event) => fired.push((event as CustomEvent).detail));
    const dates = [...root.querySelectorAll<HTMLElement>('.hm-hello__date')];
    expect(dates.map((date) => date.getAttribute('role'))).toEqual(['button', 'button']);
    press(dates[0]);
    expect(fired).toEqual([{ action: 'fire-dom-event', calendar: 'open' }]);
    const unset = await mount({ date_tap_action: { action: 'more-info' } });
    expect(unset.root.querySelector('.hm-hello__date')?.hasAttribute('role')).toBe(false);
  });

  it('leaves the avatar the card’s own actions', async () => {
    const { card, root } = await mount({
      person: 'person.marta',
      weather_tap_action: { action: 'navigate', navigation_path: '/weather' },
    });
    const opened: unknown[] = [];
    card.addEventListener('hass-more-info', (event) =>
      opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
    );
    press(root.querySelector('.hm-avatar'));
    expect(opened).toEqual(['person.marta']);
  });
});

describe('quick actions under the greeting (`quick_actions`)', () => {
  const QUICK = ['light.hall', 'lock.door', 'sensor.room'];
  const rounds = (root: ShadowRoot): HTMLElement[] => [
    ...root.querySelectorAll<HTMLElement>('.hm-quick .lt-bulb'),
  ];

  it('declares its height from its config: 60, 60 more with a line of rounds, 80 with their states under them', () => {
    expect(height({})).toBe(60);
    expect(height({ quick_actions: [] })).toBe(60);
    expect(height({ show_quick_states: true })).toBe(60);
    expect(height({ quick_actions: QUICK })).toBe(60 + 16 + 44);
    expect(height({ quick_actions: QUICK, show_quick_states: true })).toBe(60 + 16 + 64);
    expect(
      height({ quick_actions: QUICK, show_quick_states: true, quick_state_position: 'beside' }),
    ).toBe(60 + 16 + 44);
    // one that says its own state under its glyph makes the line taller too
    expect(height({ quick_actions: [{ entity: 'sensor.room', show_state: true }] })).toBe(140);
    // its date, its weather, its avatar and its name never change it
    expect(height({ show_date: false, show_weather: false, show_avatar: false })).toBe(60);
  });

  it('draws a round an entity from the reading edge, in the room its height keeps, each its own switch', async () => {
    const { root, calls } = await mount({ quick_actions: QUICK });
    const line = root.querySelector<HTMLElement>('.hm-quick')!;
    expect(line.style.height).toBe('44px');
    expect(line.style.marginTop).toBe('16px');
    expect(rounds(root).map((round) => round.getAttribute('aria-label'))).toEqual([
      'Hall',
      'Front door',
      'Temperature',
    ]);
    // a lamp that is on is lit, with its ring; a tap turns it off, and it is drawn so at once
    const [hall, door, room] = rounds(root);
    expect(hall?.classList.contains('is-on')).toBe(true);
    expect(hall?.getAttribute('role')).toBe('switch');
    press(hall);
    expect(calls).toEqual([['light', 'turn_off', { entity_id: ['light.hall'] }]]);
    // a reading opens its details: it is no switch
    expect(room?.getAttribute('role')).toBeNull();
    expect(door?.classList.contains('is-on')).toBe(false);
  });

  it('says their states where asked, under their glyphs in a line 20 taller, or beside them', async () => {
    const restore = saidWidths();
    try {
      const under = await mount({ quick_actions: QUICK, show_quick_states: true });
      expect(under.root.querySelector<HTMLElement>('.hm-quick')!.style.height).toBe('64px');
      expect(rounds(under.root).map((round) => words(round.querySelector('.lt-said')))).toEqual([
        '60 %',
        'Locked',
        '21.4 °C',
      ]);
      expect(rounds(under.root).every((round) => round.classList.contains('lt-bulb--under'))).toBe(
        true,
      );
      const beside = await mount({
        quick_actions: QUICK,
        show_quick_states: true,
        quick_state_position: 'beside',
      });
      expect(beside.root.querySelector<HTMLElement>('.hm-quick')!.style.height).toBe('44px');
      expect(beside.root.querySelector('.lt-bulb--under')).toBeNull();
      expect(words(rounds(beside.root)[0]?.querySelector('.lt-said'))).toBe('60 %');
    } finally {
      restore();
    }
  });

  it('takes a list, or says what is wrong: a round written without its dash is no list', () => {
    const card = document.createElement('fluvy-hello-card') as CardElement;
    expect(() =>
      card.setConfig({ type: 'custom:fluvy-hello-card', quick_actions: 'light.hall' }),
    ).toThrow('fluvy-hello-card: "quick_actions" must be a list');
  });

  it('follows its entities: a lamp turned off elsewhere is drawn off', async () => {
    const { card, root } = await mount({ quick_actions: ['light.hall'] });
    card.hass = {
      ...card.hass,
      states: { ...STATES, 'light.hall': state('light.hall', 'off', { friendly_name: 'Hall' }) },
    } as unknown as HomeAssistant;
    await card.updateComplete;
    expect(rounds(root)[0]?.classList.contains('is-on')).toBe(false);
  });
});

describe('the greeting’s editor', () => {
  const form = async (config: Record<string, unknown>) =>
    cardForm(
      await drawEditor(await FluvyHelloCard.getConfigElement(), {
        type: 'custom:fluvy-hello-card',
        ...config,
      }),
    );

  it('offers its name’s switch, and what its quick actions say only once it lists some', async () => {
    const bare = shownNames((await form({})).schema);
    expect(bare).toEqual(expect.arrayContaining(['show_avatar', 'show_name']));
    expect(bare).not.toContain('show_quick_states');
    expect(bare).not.toContain('quick_state_position');
    const listed = shownNames((await form({ quick_actions: ['light.hall'] })).schema);
    expect(listed).toContain('show_quick_states');
    expect(listed).not.toContain('quick_state_position');
    expect(
      shownNames((await form({ quick_actions: ['light.hall'], show_quick_states: true })).schema),
    ).toContain('quick_state_position');
  });

  it('names a part’s action by the part and the action', async () => {
    const editor = await form({});
    const label = (name: string): string | undefined =>
      (editor as FormStub & { computeLabel: FormLabeler }).computeLabel({ name }, (key) => key);
    expect(label('weather_tap_action')).toBe('Weather · Tap action');
    expect(label('date_double_tap_action')).toBe('The date · Double tap action');
    expect(label('show_name')).toBe('Show the name');
    expect(label('weather')).toBe('Weather entity');
  });
});
