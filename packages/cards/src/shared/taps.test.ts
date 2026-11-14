// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';

// the index defines the cards, and fetches the lazy families: they land before this file's page goes
afterAll(() => familiesDefined);

/**
 * Double tap and the circle's own actions (#179), as Home Assistant has them: a surface with a double tap waits its
 * 250 ms for a second tap and runs one or the other, never both; one without runs its tap at once, as before; a hold
 * is a hold, whatever came before it. A circle with actions of its own is a button of its own, beside the surface it
 * stands on, and the keyboard reaches it.
 */

const STAMP = '2026-11-13T09:00:00+00:00';
const state = (id: string, value: string, attributes: Record<string, unknown> = {}) => ({
  entity_id: id,
  state: value,
  attributes,
  last_changed: STAMP,
  last_updated: STAMP,
});

const STATES = {
  'light.desk': state('light.desk', 'on', {
    friendly_name: 'Desk lamp',
    brightness: 128,
    supported_color_modes: ['brightness'],
  }),
  'switch.kettle': state('switch.kettle', 'off', { friendly_name: 'Kettle' }),
  'sensor.office': state('sensor.office', '21.5', {
    friendly_name: 'Office',
    unit_of_measurement: '°C',
    device_class: 'temperature',
  }),
};

/** The house, with the calls and the details it is asked for kept. */
function house() {
  const calls: string[] = [];
  const hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: STATES,
    entities: {},
    devices: {},
    areas: {},
    user: { id: 'u', is_admin: true },
    themes: { darkMode: false },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    hassUrl: (path: string) => path,
    callService: (domain: string, service: string) => (
      calls.push(`${domain}.${service}`),
      Promise.resolve()
    ),
  } as unknown as HomeAssistant;
  return { hass, calls };
}

type CardElement = HTMLElement & {
  setConfig(config: LovelaceCardConfig): void;
  hass: HomeAssistant;
  updateComplete: Promise<boolean>;
};

/** A card drawn in the house; what it opens (more-info) and calls are said, in order, in `heard`. */
async function drawn(config: LovelaceCardConfig) {
  const { hass, calls } = house();
  const card = document.createElement(String(config.type).replace('custom:', '')) as CardElement;
  card.setConfig(config);
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  const heard = calls;
  card.addEventListener('hass-more-info', (event) =>
    heard.push(`details ${(event as CustomEvent<{ entityId: string }>).detail.entityId}`),
  );
  card.addEventListener('ll-custom', () => heard.push('dom event'));
  return { card, root: card.shadowRoot!, heard };
}

const pointer = (type: string, init: PointerEventInit = {}): PointerEvent =>
  new PointerEvent(type, {
    bubbles: true,
    composed: true,
    button: 0,
    pointerType: 'touch',
    clientX: 10,
    clientY: 10,
    ...init,
  });

/** A finger's tap: down, up and the click that follows. */
function tap(el: Element): void {
  el.dispatchEvent(pointer('pointerdown'));
  window.dispatchEvent(pointer('pointerup'));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
}

/** A finger's still press of 500 ms, and the click the browser sends after it. */
function hold(el: Element): void {
  el.dispatchEvent(pointer('pointerdown'));
  vi.advanceTimersByTime(500);
  window.dispatchEvent(pointer('pointerup'));
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 1 }));
}

/** A key on an element; a button's Enter and Space are its click (`detail` 0). */
function key(el: Element, name: string, shiftKey = false): void {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true }));
  if (el.localName === 'button' && (name === 'Enter' || name === ' '))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, detail: 0 }));
}

const TOGGLE = { action: 'toggle' } as const;
const FIRE = { action: 'fire-dom-event' } as const;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  window.dispatchEvent(pointer('pointerup'));
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('a tap where no double tap is set', () => {
  it('runs at once, as before', async () => {
    const { root, heard } = await drawn({
      type: 'custom:fluvy-tile-card',
      entity: 'switch.kettle',
      size: 'compact',
    });
    tap(root.querySelector('.fv-tile__tap')!);
    expect(heard).toEqual(['switch.turn_on']);
  });
});

describe('a double tap (#179)', () => {
  const TILE = {
    type: 'custom:fluvy-tile-card',
    entity: 'switch.kettle',
    size: 'compact',
    double_tap_action: FIRE,
  };

  it('waits 250 ms for a second tap: one tap is the tap, after the wait', async () => {
    const { root, heard } = await drawn(TILE);
    tap(root.querySelector('.fv-tile__tap')!);
    expect(heard).toEqual([]);
    vi.advanceTimersByTime(249);
    expect(heard).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(heard).toEqual(['switch.turn_on']);
  });

  it('two taps inside them are the double tap, never the tap too', async () => {
    const { root, heard } = await drawn(TILE);
    const surface = root.querySelector('.fv-tile__tap')!;
    tap(surface);
    vi.advanceTimersByTime(180);
    tap(surface);
    vi.advanceTimersByTime(1000);
    expect(heard).toEqual(['dom event']);
  });

  it('two taps further apart are two taps', async () => {
    const { root, heard } = await drawn(TILE);
    const surface = root.querySelector('.fv-tile__tap')!;
    tap(surface);
    vi.advanceTimersByTime(300);
    tap(surface);
    vi.advanceTimersByTime(300);
    expect(heard).toEqual(['switch.turn_on', 'switch.turn_on']);
  });

  it('a hold after a double tap is the hold, and nothing else', async () => {
    const { root, heard } = await drawn(TILE);
    const surface = root.querySelector('.fv-tile__tap')!;
    tap(surface);
    tap(surface);
    hold(surface);
    vi.advanceTimersByTime(1000);
    expect(heard).toEqual(['dom event', 'details switch.kettle']);
  });

  it('keeps each surface to its own: a tap on one and one on the other are two taps', async () => {
    const { root, heard } = await drawn({
      type: 'custom:fluvy-tiles-card',
      size: 'compact',
      tiles: [
        { entity: 'switch.kettle', double_tap_action: FIRE },
        { entity: 'light.desk', double_tap_action: FIRE },
      ],
    });
    const [kettle, desk] = root.querySelectorAll('.fv-tile__tap');
    tap(kettle!);
    tap(desk!);
    vi.advanceTimersByTime(300);
    expect(heard).toEqual(['switch.turn_on', 'light.turn_off']);
  });

  it('keeps two rows of one entity to their own: a tap on each is two taps, two on one its double', async () => {
    const { root, heard } = await drawn({
      type: 'custom:fluvy-entities-card',
      rows: [
        { entity: 'sensor.office', double_tap_action: { action: 'fire-dom-event' } },
        {
          entity: 'sensor.office',
          name: 'Office desk',
          double_tap_action: { action: 'fire-dom-event' },
        },
      ],
    });
    const [first, second] = root.querySelectorAll('.fv-row--tap');
    tap(first!);
    tap(second!);
    vi.advanceTimersByTime(300);
    expect(heard).toEqual(['details sensor.office', 'details sensor.office']);
    tap(second!);
    tap(second!);
    expect(heard.at(-1)).toBe('dom event');
  });

  it('keeps two tiles of one entity to their own', async () => {
    const { root, heard } = await drawn({
      type: 'custom:fluvy-tiles-card',
      size: 'compact',
      tiles: [
        { entity: 'switch.kettle', double_tap_action: { action: 'fire-dom-event' } },
        {
          entity: 'switch.kettle',
          name: 'Kettle too',
          double_tap_action: { action: 'fire-dom-event' },
        },
      ],
    });
    const [one, other] = root.querySelectorAll('.fv-tile__tap');
    tap(one!);
    tap(other!);
    vi.advanceTimersByTime(300);
    expect(heard).toEqual(['switch.turn_on', 'switch.turn_on']);
  });

  it('runs a large tile’s tap as its double and its hold: a toggle flips its switch at once, in every style', async () => {
    for (const switch_style of [undefined, 'rocker']) {
      for (const by of ['tap', 'double tap']) {
        const { card, root, heard } = await drawn({
          type: 'custom:fluvy-tile-card',
          entity: 'switch.kettle',
          ...(switch_style ? { switch_style } : {}),
          ...(by === 'tap' ? { tap_action: TOGGLE } : { double_tap_action: TOGGLE }),
        });
        // the rocker's drawing lands with its chunk
        await vi.dynamicImportSettled();
        await card.updateComplete;
        const surface = root.querySelector('.fv-tile__tap')!;
        tap(surface);
        if (by === 'double tap') tap(surface);
        await card.updateComplete;
        const label = `${switch_style ?? 'toggle'}, ${by}`;
        expect(heard, label).toEqual(['switch.turn_on']);
        // the switch says what was asked before Home Assistant answers
        const flipped = root.querySelector('[role="switch"]');
        expect(flipped?.getAttribute('aria-checked'), label).toBe('true');
        document.body.replaceChildren();
      }
    }
  });

  it('a tap still waiting is let go when the card leaves the page', async () => {
    const { card, root, heard } = await drawn(TILE);
    tap(root.querySelector('.fv-tile__tap')!);
    card.remove();
    vi.advanceTimersByTime(1000);
    expect(heard).toEqual([]);
  });

  it('makes a surface whose tap does nothing a button still', async () => {
    const { root, heard } = await drawn({ ...TILE, tap_action: { action: 'none' } });
    const surface = root.querySelector('.fv-tile__tap')!;
    tap(surface);
    vi.advanceTimersByTime(300);
    expect(heard).toEqual([]);
    tap(surface);
    tap(surface);
    expect(heard).toEqual(['dom event']);
  });

  it('answers the keyboard as the pointer: Enter twice inside the wait is the double, once the tap', async () => {
    const { root, heard } = await drawn(TILE);
    const surface = root.querySelector('.fv-tile__tap')!;
    key(surface, 'Enter');
    vi.advanceTimersByTime(300);
    key(surface, ' ');
    key(surface, 'Enter');
    vi.advanceTimersByTime(300);
    // the menu key and Shift+F10 hold, at once
    key(surface, 'ContextMenu');
    key(surface, 'F10', true);
    expect(heard).toEqual([
      'switch.turn_on',
      'dom event',
      'details switch.kettle',
      'details switch.kettle',
    ]);
  });

  it('on a head: the card’s tap waits for its double', async () => {
    const { root, heard } = await drawn({
      type: 'custom:fluvy-light-card',
      entity: 'light.desk',
      tap_action: TOGGLE,
      double_tap_action: FIRE,
    });
    const head = root.querySelector<HTMLButtonElement>('.fv-card__tap')!;
    head.click();
    vi.advanceTimersByTime(300);
    head.click();
    head.click();
    expect(heard).toEqual(['light.turn_off', 'dom event']);
  });

  it('on a row: a row of a list waits for its own, and holds', async () => {
    const { root, heard } = await drawn({
      type: 'custom:fluvy-entities-card',
      rows: [{ entity: 'sensor.office', double_tap_action: FIRE, hold_action: TOGGLE }],
    });
    const row = root.querySelector('.fv-row--tap')!;
    tap(row);
    vi.advanceTimersByTime(300);
    tap(row);
    tap(row);
    hold(row);
    key(row, 'ContextMenu');
    expect(heard).toEqual([
      'details sensor.office',
      'dom event',
      'homeassistant.turn_on',
      'homeassistant.turn_on',
    ]);
  });

  it('on a tab: its tap waits for its double, and its hold is its own (`action` still reads as its tap)', async () => {
    const { root, heard } = await drawn({
      type: 'custom:fluvy-chips-card',
      chips: [
        {
          name: 'Kettle',
          action: { action: 'more-info', entity: 'switch.kettle' },
          hold_action: TOGGLE,
          entity: 'switch.kettle',
          double_tap_action: FIRE,
        },
      ],
    });
    const chip = root.querySelector('.fv-chip')!;
    tap(chip);
    vi.advanceTimersByTime(300);
    tap(chip);
    tap(chip);
    hold(chip);
    expect(heard).toEqual(['details switch.kettle', 'dom event', 'switch.turn_on']);
  });
});

describe('a circle’s own actions (#179)', () => {
  it('make a tile’s circle a button of its own, in every size, labelled, beside the tile’s', async () => {
    for (const size of ['large', 'compact', 'mini']) {
      const { root, heard } = await drawn({
        type: 'custom:fluvy-tile-card',
        entity: 'sensor.office',
        size,
        icon_tap_action: FIRE,
        icon_hold_action: TOGGLE,
      });
      const circle = root.querySelector<HTMLButtonElement>('.fv-ico--tap')!;
      expect(circle.localName, size).toBe('button');
      expect(circle.getAttribute('aria-label')).toBe('Office icon');
      expect(circle.closest('.fv-tile__tap')).toBeNull();
      tap(circle);
      hold(circle);
      key(circle, 'Enter');
      expect(heard, size).toEqual(['dom event', 'homeassistant.turn_on', 'dom event']);
      document.body.replaceChildren();
    }
  });

  it('leave the circle as the tile draws it until one is set: its switch where it is one', async () => {
    const plain = await drawn({ type: 'custom:fluvy-tile-card', entity: 'light.desk' });
    expect(plain.root.querySelector('.fv-tile__head > .fv-ico')!.localName).toBe('span');
    document.body.replaceChildren();
    const narrow = await drawn({
      type: 'custom:fluvy-tile-card',
      entity: 'light.desk',
      show_switch: false,
    });
    const flips = narrow.root.querySelector('.fv-tile__head > .fv-ico')!;
    expect(flips.getAttribute('role')).toBe('switch');
    tap(flips);
    expect(narrow.heard).toEqual(['light.turn_off']);
    document.body.replaceChildren();
    // one of its own takes the place of the flip: a button, no switch
    const own = await drawn({
      type: 'custom:fluvy-tile-card',
      entity: 'light.desk',
      show_switch: false,
      icon_tap_action: FIRE,
    });
    const circle = own.root.querySelector('.fv-tile__head > .fv-ico')!;
    expect(circle.getAttribute('role')).toBeNull();
    tap(circle);
    expect(own.heard).toEqual(['dom event']);
  });

  it('make a head’s circle a button over the head’s, whose press never reaches the head', async () => {
    const { root, heard } = await drawn({
      type: 'custom:fluvy-light-card',
      entity: 'light.desk',
      icon_tap_action: FIRE,
      icon_double_tap_action: TOGGLE,
    });
    const circle = root.querySelector<HTMLButtonElement>('.fv-card__head > .fv-ico--tap')!;
    expect(circle.getAttribute('aria-label')).toBe('Desk lamp icon');
    expect(circle.tabIndex).toBe(0);
    tap(circle);
    vi.advanceTimersByTime(300);
    tap(circle);
    tap(circle);
    // a still press on it is never the head's hold: without a hold of its own, it is its tap
    hold(circle);
    vi.advanceTimersByTime(300);
    expect(heard).toEqual(['dom event', 'light.turn_off', 'dom event']);
    // the head is still the card's button: its details
    root.querySelector<HTMLButtonElement>('.fv-card__tap')!.click();
    expect(heard.at(-1)).toBe('details light.desk');
  });

  it('leave a head’s circle a circle while none is set', async () => {
    const { root } = await drawn({ type: 'custom:fluvy-light-card', entity: 'light.desk' });
    expect(root.querySelector('.fv-card__head > .fv-ico')!.localName).toBe('span');
  });
});
