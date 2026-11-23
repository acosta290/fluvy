// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirmationOf,
  goBack,
  navigate,
  offCall,
  ROUND_TOGGLE,
  runAction,
  SAFE_TOGGLE,
  setDetailsSheets,
  TOGGLE_DOMAINS,
  toggledState,
  toggleService,
  type ActionConfig,
  type DetailsSheetsOpener,
} from '../actions.js';
import { resolveEntity, type EntityView } from '../entity.js';
import type { HomeAssistant } from '../ha/types.js';

const callService = vi.fn(() => Promise.resolve());

/** What an entity is: its state alone (`'locked'`), or its state and its attributes. */
type Stated = string | readonly [state: string, attributes: Record<string, unknown>];

/** A house of states: `{ 'lock.front': 'locked', 'climate.den': ['cool', { supported_features: 128 }] }`. */
const house = (states: Record<string, Stated> = {}): HomeAssistant =>
  ({
    states: Object.fromEntries(
      Object.entries(states).map(([id, stated]) => {
        const [state, attributes] = typeof stated === 'string' ? [stated, {}] : stated;
        return [id, { entity_id: id, state, attributes }];
      }),
    ),
    callService,
  }) as unknown as HomeAssistant;

let card: HTMLElement;
const stops: (() => void)[] = [];

/** What an event says on its way past the body, where Home Assistant and browser_mod listen; taken down after the test. */
function listen(type: string): unknown[] {
  const heard: unknown[] = [];
  const on = (event: Event): void => {
    heard.push((event as CustomEvent).detail);
  };
  document.body.addEventListener(type, on);
  stops.push(() => document.body.removeEventListener(type, on));
  return heard;
}

beforeEach(() => {
  card = document.createElement('div');
  document.body.append(card);
  callService.mockClear();
});

afterEach(() => {
  card.remove();
  for (const stop of stops.splice(0)) stop();
  setDetailsSheets(undefined);
  vi.restoreAllMocks();
});

describe('runAction', () => {
  it('opens the details when nothing else is asked', async () => {
    const details = listen('hass-more-info');

    await runAction(card, house(), undefined, 'light.desk');

    expect(details).toEqual([{ entityId: 'light.desk' }]);
    expect(callService).not.toHaveBeenCalled();
  });

  describe('Fluvy’s own details sheets (#162)', () => {
    it('hands a more-info to whoever opens them: the card, the house, the entity and what the action asks', async () => {
      const dialog = listen('hass-more-info');
      const opener = vi.fn<DetailsSheetsOpener>(() => true);
      setDetailsSheets(opener);
      const hass = house();

      await runAction(card, hass, undefined, 'light.desk');
      await runAction(card, hass, { action: 'more-info', details: 'home-assistant' }, 'light.desk');
      await runAction(card, hass, { action: 'more-info', entity: 'fan.attic', details: 'fluvy' });
      // and whether its last 24 hours show (#243)
      await runAction(card, hass, { action: 'more-info', history: false }, 'media_player.den');

      expect(
        opener.mock.calls.map(([node, home, entity, own]) => [
          node,
          home,
          entity,
          own.details,
          own.history,
        ]),
      ).toEqual([
        [card, hass, 'light.desk', undefined, undefined],
        [card, hass, 'light.desk', 'home-assistant', undefined],
        [card, hass, 'fan.attic', 'fluvy', undefined],
        [card, hass, 'media_player.den', undefined, false],
      ]);
      // taken: Home Assistant's dialog stays shut
      expect(dialog).toEqual([]);
    });

    it('opens Home Assistant’s dialog for what it does not take, and where nobody opens them', async () => {
      const dialog = listen('hass-more-info');
      setDetailsSheets(() => false);
      await runAction(card, house(), undefined, 'sensor.outside');
      setDetailsSheets(undefined);
      await runAction(card, house(), { action: 'more-info' }, 'light.desk');

      expect(dialog).toEqual([{ entityId: 'sensor.outside' }, { entityId: 'light.desk' }]);
    });

    it('asks nobody for a more-info with no entity, nor for any other action', async () => {
      const opener = vi.fn<DetailsSheetsOpener>(() => true);
      setDetailsSheets(opener);

      await runAction(card, house(), { action: 'more-info' });
      await runAction(card, house({ 'light.desk': 'off' }), { action: 'toggle' }, 'light.desk');
      await runAction(card, house(), { action: 'none' }, 'light.desk');

      expect(opener).not.toHaveBeenCalled();
    });

    it('leaves a more-info that must be asked about to Home Assistant, dialog and all', async () => {
      const handed = listen('hass-action');
      const opener = vi.fn<DetailsSheetsOpener>(() => true);
      setDetailsSheets(opener);

      await runAction(card, house(), { action: 'more-info', confirmation: true }, 'light.desk');

      expect(handed).toHaveLength(1);
      expect(opener).not.toHaveBeenCalled();
    });
  });

  it('fire-dom-event: the whole action leaves the card as ll-custom, as Home Assistant sends it', async () => {
    const heard = listen('ll-custom');
    const action: ActionConfig = {
      action: 'fire-dom-event',
      browser_mod: { service: 'browser_mod.popup', data: { title: 'Lights' } },
    };

    await runAction(card, house(), action);

    expect(heard).toEqual([action]);
    expect(callService).not.toHaveBeenCalled();
  });

  it('fire-dom-event crosses shadow roots, as the card sits in one', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const inner = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(inner);
    const heard = listen('ll-custom');

    await runAction(inner, house(), { action: 'fire-dom-event' });

    expect(heard).toHaveLength(1);
    host.remove();
  });

  it('reads call-service, service and service_data: perform-action as it was written before', async () => {
    await runAction(card, house(), {
      action: 'call-service',
      service: 'light.turn_on',
      service_data: { brightness_pct: 40 },
      target: { entity_id: 'light.desk' },
    });

    expect(callService).toHaveBeenCalledExactlyOnceWith(
      'light',
      'turn_on',
      { brightness_pct: 40 },
      { entity_id: 'light.desk' },
    );
  });

  it('a navigation may replace the page it leaves', async () => {
    const replace = vi.spyOn(history, 'replaceState');
    const push = vi.spyOn(history, 'pushState');

    await runAction(card, house(), {
      action: 'navigate',
      navigation_path: '/fluvy-auto/rooms',
      navigation_replace: true,
    });

    expect(replace).toHaveBeenCalledExactlyOnceWith(null, '', '/fluvy-auto/rooms');
    expect(push).not.toHaveBeenCalled();
  });

  describe('an action to be asked about first', () => {
    it('goes to Home Assistant whole, and runs nothing itself', async () => {
      const handed = listen('hass-action');
      const details = listen('hass-more-info');
      const action: ActionConfig = {
        action: 'perform-action',
        perform_action: 'cover.open_cover',
        target: { entity_id: 'cover.garage' },
        confirmation: { text: 'Open the garage?' },
      };

      await runAction(card, house(), action, 'cover.garage');

      expect(handed).toEqual([
        { config: { entity: 'cover.garage', tap_action: action }, action: 'tap' },
      ]);
      expect(callService).not.toHaveBeenCalled();
      expect(details).toEqual([]);
    });

    it('a toggle goes as the service Fluvy would have called', async () => {
      const handed = listen('hass-action');

      await runAction(
        card,
        house({ 'vacuum.robot': 'cleaning' }),
        { action: 'toggle', confirmation: true },
        'vacuum.robot',
      );

      expect(handed).toEqual([
        {
          config: {
            entity: 'vacuum.robot',
            tap_action: {
              action: 'perform-action',
              perform_action: 'vacuum.pause',
              target: { entity_id: 'vacuum.robot' },
              confirmation: true,
            },
          },
          action: 'tap',
        },
      ]);
      expect(callService).not.toHaveBeenCalled();
    });

    it('a cooling unit’s toggle goes as its turn_off, and with its words where it needs them: set to Off (#252)', async () => {
      const handed = listen('hass-action');
      const asked = (attributes: Record<string, unknown>) =>
        runAction(
          card,
          house({ 'climate.den': ['cool', attributes] }),
          { action: 'toggle', confirmation: true },
          'climate.den',
        );

      await asked({ supported_features: 128, hvac_modes: ['off', 'cool'] });
      await asked({ hvac_modes: ['off', 'cool'] });

      const asking = (call: Partial<ActionConfig>) => ({
        config: {
          entity: 'climate.den',
          tap_action: {
            action: 'perform-action',
            ...call,
            target: { entity_id: 'climate.den' },
            confirmation: true,
          },
        },
        action: 'tap',
      });
      expect(handed).toEqual([
        asking({ perform_action: 'climate.turn_off' }),
        asking({ perform_action: 'climate.set_hvac_mode', data: { hvac_mode: 'off' } }),
      ]);
      expect(callService).not.toHaveBeenCalled();
    });

    it('a toggle of nothing asks nothing', async () => {
      const handed = listen('hass-action');

      await runAction(card, house(), { action: 'toggle', confirmation: true });

      expect(handed).toEqual([]);
      expect(callService).not.toHaveBeenCalled();
    });

    it('nothing to do is nothing to ask', async () => {
      const handed = listen('hass-action');

      await runAction(card, house(), { action: 'none', confirmation: true }, 'light.desk');

      expect(handed).toEqual([]);
    });

    it('an answer of "no confirmation" runs here', async () => {
      const handed = listen('hass-action');

      await runAction(
        card,
        house({ 'light.desk': 'on' }),
        { action: 'toggle', confirmation: false },
        'light.desk',
      );

      expect(handed).toEqual([]);
      expect(callService).toHaveBeenCalledExactlyOnceWith(
        'light',
        'turn_off',
        {},
        { entity_id: 'light.desk' },
      );
    });
  });

  describe('a lock (1.23): locking is one tap, unlocking asks first', () => {
    it('a toggle of a locked lock goes to Home Assistant’s dialog, nothing unlocked before its yes', async () => {
      const handed = listen('hass-action');

      await runAction(card, house({ 'lock.front': 'locked' }), { action: 'toggle' }, 'lock.front');

      expect(handed).toEqual([
        {
          config: {
            entity: 'lock.front',
            tap_action: {
              action: 'perform-action',
              perform_action: 'lock.unlock',
              target: { entity_id: 'lock.front' },
              confirmation: true,
            },
          },
          action: 'tap',
        },
      ]);
      expect(callService).not.toHaveBeenCalled();
    });

    it('a toggle of an unlocked, a jammed or an open lock locks it at once', async () => {
      const handed = listen('hass-action');
      for (const state of ['unlocked', 'jammed', 'open'])
        await runAction(card, house({ 'lock.front': state }), { action: 'toggle' }, 'lock.front');

      expect(handed).toEqual([]);
      expect(callService.mock.calls).toEqual(
        Array.from({ length: 3 }, () => ['lock', 'lock', {}, { entity_id: 'lock.front' }]),
      );
    });

    it('its own words ask in their place, and `confirmation: false` unlocks at once', async () => {
      const handed = listen('hass-action');
      const locked = house({ 'lock.front': 'locked' });

      await runAction(
        card,
        locked,
        { action: 'toggle', confirmation: { text: 'Open up?' } },
        'lock.front',
      );
      await runAction(card, locked, { action: 'toggle', confirmation: false }, 'lock.front');

      expect(handed).toHaveLength(1);
      expect(
        (handed[0] as { config: { tap_action: ActionConfig } }).config.tap_action.confirmation,
      ).toEqual({ text: 'Open up?' });
      expect(callService).toHaveBeenCalledExactlyOnceWith(
        'lock',
        'unlock',
        {},
        { entity_id: 'lock.front' },
      );
    });

    it('asks of a toggle alone: a service the person wrote runs as written', async () => {
      const locked = house({ 'lock.front': 'locked' });
      const unlock: ActionConfig = {
        action: 'perform-action',
        perform_action: 'lock.unlock',
        target: { entity_id: 'lock.front' },
      };

      expect(confirmationOf(locked, unlock, 'lock.front')).toBeUndefined();
      expect(confirmationOf(locked, { action: 'more-info' }, 'lock.front')).toBeUndefined();
      expect(confirmationOf(locked, { action: 'toggle' }, undefined)).toBeUndefined();
      expect(confirmationOf(locked, { action: 'toggle' }, 'lock.front')).toBe(true);
    });
  });

  it('what a stray tap may flip, and what a round turns on and off of its own', () => {
    expect([...SAFE_TOGGLE].sort()).toEqual([
      'automation',
      'cover',
      'fan',
      'group',
      'humidifier',
      'input_boolean',
      'light',
      'remote',
      'siren',
      'switch',
      'valve',
    ]);
    expect([...ROUND_TOGGLE].filter((domain) => !SAFE_TOGGLE.has(domain))).toEqual(['lock']);
    // never by a slip: what starts, plays, runs or is pressed
    for (const domain of ['vacuum', 'media_player', 'scene', 'script', 'button', 'input_button'])
      expect(ROUND_TOGGLE.has(domain), domain).toBe(false);
    // every one of them a toggle Fluvy knows how to send
    for (const domain of ROUND_TOGGLE) expect(TOGGLE_DOMAINS.has(domain), domain).toBe(true);
  });

  it('assist is Home Assistant’s to open', async () => {
    const handed = listen('hass-action');
    const action: ActionConfig = { action: 'assist', start_listening: true };

    await runAction(card, house(), action);

    expect(handed).toEqual([{ config: { entity: undefined, tap_action: action }, action: 'tap' }]);
    expect(callService).not.toHaveBeenCalled();
  });
});

describe('navigate, as Home Assistant keeps its history (#88)', () => {
  /** Where the page is, and what its entry says. */
  const at = (url: string, state: unknown = null): void => history.replaceState(state, '', url);
  /** Every `location-changed` the window hears from now on, as its detail. */
  const told = (): unknown[] => {
    const heard: unknown[] = [];
    const on = (event: Event): void => {
      heard.push((event as CustomEvent).detail);
    };
    window.addEventListener('location-changed', on);
    stops.push(() => window.removeEventListener('location-changed', on));
    return heard;
  };

  it('a new page records the one it was opened from (its path, not its query): the back arrow steps back to it', () => {
    at('/dashboard-test/kitchen?edit=1', { from: '/dashboard-test/home' });
    const heard = told();

    navigate('/dashboard-test/fridge');

    expect(location.pathname).toBe('/dashboard-test/fridge');
    expect(history.state).toEqual({ from: '/dashboard-test/kitchen' });
    expect(heard).toEqual([{ replace: false }]);
  });

  it('a replaced page keeps what was behind it, and nothing else of the entry it takes the place of', () => {
    at('/dashboard-test/kitchen', { from: '/dashboard-test/home', dialog: 'more-info' });
    const heard = told();

    navigate('/dashboard-test/fridge', true);

    expect(location.pathname).toBe('/dashboard-test/fridge');
    expect(history.state).toEqual({ from: '/dashboard-test/home' });
    expect(heard).toEqual([{ replace: true }]);
  });

  it('the app’s first entry stays its first when replaced; an entry with nothing behind it keeps nothing', () => {
    at('/dashboard-test/home', { root: true });
    navigate('/dashboard-test/kitchen', true);
    expect(history.state).toEqual({ root: true });

    at('/dashboard-test/home', { root: true, from: '/config' });
    navigate('/dashboard-test/kitchen', true);
    expect(history.state).toEqual({ root: true, from: '/config' });

    at('/dashboard-test/home', { dialog: 'more-info' });
    navigate('/dashboard-test/kitchen', true);
    expect(history.state).toBeNull();
  });

  it('back steps back to the page this one was opened from', () => {
    at('/dashboard-test/fridge', { from: '/dashboard-test/kitchen' });
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    const heard = told();

    goBack('/dashboard-test');

    expect(back).toHaveBeenCalledOnce();
    expect(heard).toEqual([]);
  });

  it('back from a page opened from outside the app goes to the fallback in its place', () => {
    const back = vi.spyOn(history, 'back').mockImplementation(() => undefined);
    at('/history?entity_id=light.desk');

    goBack();

    expect(location.pathname).toBe('/');
    at('/dashboard-test/fridge', { root: true });

    goBack('/dashboard-test');

    expect(location.pathname).toBe('/dashboard-test');
    expect(history.state).toEqual({ root: true });
    expect(back).not.toHaveBeenCalled();
  });
});

describe('a toggle, as Home Assistant’s own cards decide it (#252)', () => {
  /** A climate that turns on and off by itself, and one that only has an Off mode. */
  const OWN_OFF = { supported_features: 128 + 256, hvac_modes: ['off', 'cool', 'heat'] };
  const MODES = { hvac_modes: ['off', 'cool', 'heat'] };

  it.each<[entity: string, stated: Stated, call: readonly unknown[]]>([
    ['cover.blinds', 'closed', ['cover', 'open_cover']],
    ['cover.blinds', 'closing', ['cover', 'open_cover']],
    ['cover.blinds', 'open', ['cover', 'close_cover']],
    ['valve.garden', 'closed', ['valve', 'open_valve']],
    ['valve.garden', 'closing', ['valve', 'open_valve']],
    ['valve.garden', 'open', ['valve', 'close_valve']],
    ['lock.front', 'locked', ['lock', 'unlock']],
    ['lock.front', 'unlocked', ['lock', 'lock']],
    ['vacuum.robot', 'docked', ['vacuum', 'start']],
    ['vacuum.robot', 'cleaning', ['vacuum', 'pause']],
    ['lawn_mower.back', 'mowing', ['lawn_mower', 'pause']],
    ['lawn_mower.back', 'docked', ['lawn_mower', 'start_mowing']],
    ['lawn_mower.back', 'paused', ['lawn_mower', 'start_mowing']],
    ['media_player.tv', 'playing', ['media_player', 'media_play_pause']],
    ['media_player.tv', 'paused', ['media_player', 'media_play_pause']],
    ['media_player.tv', ['off', { supported_features: 128 }], ['media_player', 'turn_on']],
    ['media_player.tv', ['standby', { supported_features: 128 }], ['media_player', 'turn_on']],
    // a player that cannot be woken plays, as it did
    ['media_player.tv', 'off', ['media_player', 'media_play_pause']],
    ['climate.den', ['cool', OWN_OFF], ['climate', 'turn_off']],
    ['climate.den', ['heat', OWN_OFF], ['climate', 'turn_off']],
    ['climate.den', ['dry', OWN_OFF], ['climate', 'turn_off']],
    ['climate.den', ['off', OWN_OFF], ['climate', 'turn_on']],
    ['climate.den', ['heat', MODES], ['climate', 'set_hvac_mode', { hvac_mode: 'off' }]],
    // neither: its own off, for Home Assistant to say why not
    ['climate.den', ['heat', { hvac_modes: ['heat'] }], ['climate', 'turn_off']],
    ['water_heater.tank', ['eco', { supported_features: 8 }], ['water_heater', 'turn_off']],
    ['water_heater.tank', ['off', { supported_features: 8 }], ['water_heater', 'turn_on']],
    [
      'water_heater.tank',
      ['eco', { operation_list: ['off', 'eco'] }],
      ['water_heater', 'set_operation_mode', { operation_mode: 'off' }],
    ],
    ['scene.evening', '2026-09-17T20:00:00+00:00', ['scene', 'turn_on']],
    ['script.goodnight', 'off', ['script', 'turn_on']],
    ['input_button.bell', 'unknown', ['input_button', 'press']],
    ['automation.porch', 'on', ['automation', 'toggle']],
    ['light.desk', 'on', ['light', 'turn_off']],
    ['light.desk', 'off', ['light', 'turn_on']],
    // a state not known comes on, as it did
    ['light.desk', 'unknown', ['light', 'turn_on']],
    ['switch.heater', 'off', ['switch', 'turn_on']],
    ['group.downstairs', 'on', ['homeassistant', 'turn_off']],
    ['group.downstairs', 'off', ['homeassistant', 'turn_on']],
    // what is not off, closed or locked goes off
    ['group.windows', 'open', ['homeassistant', 'turn_off']],
    ['group.doors', 'locked', ['homeassistant', 'turn_on']],
  ])('%s that is %j: %j', (entity, stated, call) => {
    expect(toggleService(house({ [entity]: stated }), entity)).toEqual(call);
  });

  it('a tap on a cooling unit turns it off, not on', async () => {
    await runAction(
      card,
      house({ 'climate.bedroom_ac': ['cool', OWN_OFF] }),
      { action: 'toggle' },
      'climate.bedroom_ac',
    );

    expect(callService).toHaveBeenCalledExactlyOnceWith(
      'climate',
      'turn_off',
      {},
      { entity_id: 'climate.bedroom_ac' },
    );
  });

  it('a unit without its own off goes to its Off mode, its words in the call', async () => {
    await runAction(
      card,
      house({ 'climate.bedroom_ac': ['heat', MODES] }),
      { action: 'toggle' },
      'climate.bedroom_ac',
    );

    expect(callService).toHaveBeenCalledExactlyOnceWith(
      'climate',
      'set_hvac_mode',
      { hvac_mode: 'off' },
      { entity_id: 'climate.bedroom_ac' },
    );
  });

  it('turns a thermostat off as it takes it: its own off, else its Off mode, else not at all', () => {
    const view = (id: string, attributes: Record<string, unknown>): EntityView =>
      resolveEntity(house({ [id]: ['heat', attributes] }), id);

    expect(offCall(view('climate.a', { supported_features: 128 }))).toEqual([
      'climate',
      'turn_off',
    ]);
    expect(offCall(view('climate.a', { hvac_modes: ['off', 'heat'] }))).toEqual([
      'climate',
      'set_hvac_mode',
      { hvac_mode: 'off' },
    ]);
    expect(offCall(view('climate.a', { hvac_modes: ['heat'] }))).toBeUndefined();
    expect(offCall(view('water_heater.a', { supported_features: 8 }))).toEqual([
      'water_heater',
      'turn_off',
    ]);
    expect(offCall(view('water_heater.a', { operation_list: ['off', 'eco'] }))).toEqual([
      'water_heater',
      'set_operation_mode',
      { operation_mode: 'off' },
    ]);
    expect(offCall(view('humidifier.a', {}))).toEqual(['humidifier', 'turn_off']);
    expect(offCall(view('light.a', {}))).toBeUndefined();
  });

  it('the state a toggle reaches, drawn until Home Assistant says it', () => {
    const domains = ['cover', 'valve', 'lock', 'climate'];
    expect(domains.map((domain) => toggledState(domain, true))).toEqual([
      'open',
      'open',
      'unlocked',
      'on',
    ]);
    expect(domains.map((domain) => toggledState(domain, false))).toEqual([
      'closed',
      'closed',
      'locked',
      'off',
    ]);
  });
});
