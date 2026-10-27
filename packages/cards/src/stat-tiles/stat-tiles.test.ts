// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FluvyStatTilesCard,
  statTileColumns,
  type StatTilesCardConfig,
} from './stat-tiles-card.js';

if (!customElements.get('fluvy-stat-tiles-card'))
  customElements.define('fluvy-stat-tiles-card', FluvyStatTilesCard);

/** Four tiles' labels, 40 wide; a figure's width per tile (null: it cannot be read). */
const labels = [40, 40, 40, 40];

describe('stat tiles a row', () => {
  it('measures what is asked automatically: three while every word holds its cell, four as two by two', () => {
    const three = [40, 40, 40];
    expect(statTileColumns('auto', 320, three, [40, 40, 40], 70)).toBe(3);
    expect(statTileColumns('auto', 320, three, [90, 40, 40], 70)).toBe(2);
    expect(statTileColumns('auto', 320, labels, [40, 40, 40, 40], 70)).toBe(2);
  });

  it('never wraps a figure: fewer than asked, down to one a row, where the widest would not hold its cell', () => {
    // a 211 card: a cell of two holds 57 px of words
    expect(statTileColumns(2, 171, labels, [60, 50, 58, 40], 70)).toBe(1);
    expect(statTileColumns(2, 171, labels, [50, 50, 50, 40], 70)).toBe(2);
    expect(statTileColumns(3, 320, labels, [90, 40, 40, 40], 70)).toBe(2);
  });

  it('keeps its rows while a sensor is away: a figure that cannot be read takes the widest of the others', () => {
    const live = statTileColumns('auto', 171, labels, [60, 50, 58, 40], 70);
    expect(statTileColumns('auto', 171, labels, [null, 50, 58, null], 70)).toBe(1);
    expect(statTileColumns('auto', 171, labels, [60, null, null, null], 70)).toBe(live);
  });

  it('lays out a set that cannot be read at all for the stand-in figure', () => {
    expect(statTileColumns(2, 171, labels, [null, null, null, null], 70)).toBe(1);
    expect(statTileColumns(2, 226, labels, [null, null, null, null], 70)).toBe(2);
  });
});

const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) => ({
  entity_id,
  state: value,
  attributes,
  last_changed: '',
  last_updated: '',
});

const callService = vi.fn(async () => undefined);

const house = (): HomeAssistant =>
  ({
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: {
      'sensor.solar': state('sensor.solar', '3200', {
        unit_of_measurement: 'W',
        device_class: 'power',
        friendly_name: 'Solar',
      }),
      'sensor.battery': state('sensor.battery', '64', {
        unit_of_measurement: '%',
        device_class: 'battery',
        friendly_name: 'Battery',
      }),
      'sensor.dead': state('sensor.dead', 'unavailable', { friendly_name: 'Inverter' }),
    },
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    callService,
    callWS: async () => ({}),
  }) as unknown as HomeAssistant;

/** The card drawn with `tiles`, and the details it asks Home Assistant to open. */
async function mount(
  tiles: StatTilesCardConfig['tiles'],
  config: Partial<StatTilesCardConfig> = {},
) {
  const card = document.createElement('fluvy-stat-tiles-card') as FluvyStatTilesCard;
  card.setConfig({ type: 'custom:fluvy-stat-tiles-card', tiles, ...config });
  card.hass = house();
  document.body.append(card);
  await card.updateComplete;
  const opened: string[] = [];
  card.addEventListener('hass-more-info', (event) =>
    opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
  );
  const tile = (index: number) =>
    card.shadowRoot!.querySelectorAll<HTMLElement>('.fv-option')[index]!;
  /** The button laid over a tile, where it has one. */
  const press = (index: number) =>
    tile(index).querySelector<HTMLButtonElement>(':scope > .fv-tile__tap');
  return { card, opened, tile, press };
}

/** A pointer's click (`detail` 1); a keyboard's Enter or Space clicks a button with `detail` 0. */
const click = (target: Element, detail = 1): MouseEvent => {
  const event = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    composed: true,
    detail,
  });
  target.dispatchEvent(event);
  return event;
};

const pointer = (type: string): PointerEvent =>
  new PointerEvent(type, { bubbles: true, composed: true, button: 0, pointerType: 'mouse' });

afterEach(() => {
  vi.useRealTimers();
  callService.mockClear();
  window.dispatchEvent(pointer('pointerup'));
  document.body.replaceChildren();
});

describe('a tap on a stat tile (#71)', () => {
  it('opens its entity’s details by default, whatever the card’s own tap', async () => {
    const { opened, tile, press } = await mount(['sensor.solar', 'sensor.battery'], {
      tap_action: { action: 'navigate', navigation_path: '/energy' },
    });
    expect(tile(0).classList.contains('fv-tile--tap')).toBe(true);
    expect(press(0)?.getAttribute('aria-label')).toBe('Solar · 3.2 kW');
    click(press(1)!);
    expect(opened).toEqual(['sensor.battery']);
  });

  it('runs the tile’s own tap where it has one, and none leaves the tile still', async () => {
    const { opened, tile, press } = await mount([
      {
        entity: 'sensor.solar',
        tap_action: { action: 'perform-action', perform_action: 'script.solar_report' },
      },
      { entity: 'sensor.battery', tap_action: { action: 'none' } },
    ]);
    click(press(0)!);
    expect(callService).toHaveBeenCalledWith('script', 'solar_report', {}, undefined);
    expect(opened).toEqual([]);
    expect(press(1)).toBeNull();
    expect(tile(1).classList.contains('fv-tile--tap')).toBe(false);
  });

  it('holds only where it asks to: the hold runs, and the click that follows never also taps', async () => {
    vi.useFakeTimers();
    const { opened, press } = await mount([
      'sensor.solar',
      {
        entity: 'sensor.battery',
        tap_action: { action: 'perform-action', perform_action: 'script.battery_report' },
        hold_action: { action: 'more-info' },
      },
    ]);
    press(1)!.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(500);
    window.dispatchEvent(pointer('pointerup'));
    expect(click(press(1)!).defaultPrevented).toBe(true);
    expect(opened).toEqual(['sensor.battery']);
    expect(callService).not.toHaveBeenCalled();
    // with no hold of its own, a still press is a tap, and the menu key is the browser's
    press(0)!.dispatchEvent(pointer('pointerdown'));
    vi.advanceTimersByTime(500);
    window.dispatchEvent(pointer('pointerup'));
    click(press(0)!);
    expect(opened).toEqual(['sensor.battery', 'sensor.solar']);
    const menu = new KeyboardEvent('keydown', {
      key: 'ContextMenu',
      bubbles: true,
      cancelable: true,
    });
    press(0)!.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(false);
  });

  it('answers the keyboard: Enter and Space click its button, the menu key holds', async () => {
    const { opened, press } = await mount([
      { entity: 'sensor.solar', hold_action: { action: 'more-info', entity: 'sensor.battery' } },
    ]);
    expect(press(0)?.localName).toBe('button');
    click(press(0)!, 0);
    click(press(0)!, 0);
    const menu = new KeyboardEvent('keydown', {
      key: 'ContextMenu',
      bubbles: true,
      cancelable: true,
    });
    press(0)!.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    expect(opened).toEqual(['sensor.solar', 'sensor.solar', 'sensor.battery']);
  });

  it('is no button where its entity cannot be read, highlighted or not', async () => {
    const { tile, press } = await mount([
      { entity: 'sensor.solar', highlight: true },
      { entity: 'sensor.dead', highlight: true },
      { entity: 'sensor.gone', hold_action: { action: 'more-info' } },
    ]);
    expect(press(0)).not.toBeNull();
    expect(tile(0).classList.contains('is-active')).toBe(true);
    for (const index of [1, 2]) {
      expect(tile(index).classList.contains('is-unavailable')).toBe(true);
      expect(tile(index).classList.contains('fv-tile--tap')).toBe(false);
      expect(press(index)).toBeNull();
    }
  });
});
