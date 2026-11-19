// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { describe, expect, it, vi } from 'vitest';
import { isLampSwitch } from './lamps.js';
import { lampSwitchesOf } from './light.js';

/*
 * A lamp on a plug by its name (#219): the rule the automatic dashboards count a room's lights by, which a card asked
 * for `lamp_switches` reads from its own chunk.
 */

describe('a lamp on a plug, by its name (#219)', () => {
  it('reads a switch whose id or name says a light, in any language', () => {
    expect(isLampSwitch('switch.workshop_lamp', 'Workshop lamp')).toBe(true);
    expect(isLampSwitch('switch.sonoff_1', 'Bedside light')).toBe(true);
    expect(isLampSwitch('switch.relay_2', '工作室 电灯')).toBe(true);
    expect(isLampSwitch('switch.plug_3', 'Stehlampe')).toBe(true);
    // a light's words win over a kind's that stand apart
    expect(isLampSwitch('switch.oven_light', 'Oven light')).toBe(true);
  });

  it('never an appliance on its plug, nor a switch that names no light, nor what is no switch', () => {
    expect(isLampSwitch('switch.kettle', 'Kettle')).toBe(false);
    expect(isLampSwitch('switch.plug', '電気ケトル')).toBe(false);
    expect(isLampSwitch('switch.washer', 'Washing machine')).toBe(false);
    expect(isLampSwitch('switch.fan_plug', 'Desk fan')).toBe(false);
    expect(isLampSwitch('light.workshop_lamp', 'Workshop lamp')).toBe(false);
  });

  it('a card reads none until the rule’s chunk lands, then is drawn again and reads them', async () => {
    const state = (entity_id: string, name: string) =>
      ({ entity_id, state: 'off', attributes: { friendly_name: name } }) as unknown as HassEntity;
    const hass = {
      states: {
        'switch.a': state('switch.a', 'Workshop lamp'),
        'switch.b': state('switch.b', 'Kettle'),
      },
    } as unknown as HomeAssistant;
    const redraw = vi.fn();
    const ids = ['switch.a', 'switch.b'];
    const first = lampSwitchesOf(hass, ids, redraw);
    await vi.waitFor(() => expect(redraw).toHaveBeenCalled());
    expect([first, lampSwitchesOf(hass, ids, redraw)]).toEqual([[], ['switch.a']]);
  });
});
