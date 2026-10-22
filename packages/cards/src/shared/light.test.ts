import { WHITE, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';

import {
  bulbHex,
  COLOURED,
  hexOf,
  lampsOf,
  lightLook,
  litColour,
  meanHex,
  memberIds,
  withMembers,
} from './light.js';

type View = Parameters<typeof bulbHex>[0];
const view = (attributes: Record<string, unknown>, state = 'on', id = 'light.lamp'): View =>
  ({ id, state, attr: <T>(key: string) => attributes[key] as T }) as unknown as View;

const RED = { color_mode: 'hs', rgb_color: [255, 0, 0], brightness: 255 };
/** A white at 2700 K as Home Assistant reports it: its colour beside its temperature. */
const WARM = { color_mode: 'color_temp', rgb_color: [255, 167, 87], brightness: 255 };
/** Daylight (6500 K) and a cool white (8000 K), as Home Assistant reports them. */
const DAYLIGHT = { color_mode: 'color_temp', rgb_color: [255, 254, 250], brightness: 255 };
const COOL = { color_mode: 'color_temp', rgb_color: [221, 230, 255], brightness: 255 };

describe('a bulb’s colour', () => {
  it('writes a triplet as a hex, each channel rounded and kept, a white channel left out', () => {
    expect(hexOf([255, 128, 0])).toBe('#ff8000');
    expect(hexOf([255.4, 127.6, -3, 200])).toBe('#ff8000');
    expect(hexOf([300, 0, 0])).toBe('#ff0000');
  });

  it('is what a lit bulb glows in a colour mode, and nothing for an off one or one that says no colour', () => {
    expect(bulbHex(view({ color_mode: 'hs', rgb_color: [255, 128, 0] }), true)).toBe('#ff8000');
    expect(bulbHex(view({ color_mode: 'hs', rgb_color: [255, 128, 0] }), false)).toBeUndefined();
    expect(bulbHex(view({ color_mode: 'rgb' }), true)).toBeUndefined();
    expect([...COLOURED]).toContain('xy');
  });

  it('shows a white by its warmth (the default since 1.10, #58): Home Assistant’s colour for it, marked a white', () => {
    expect(bulbHex(view(WARM), true)).toBe(`${WHITE}#ffa757`);
    expect(bulbHex(view(WARM), true, 'temperature')).toBe(`${WHITE}#ffa757`);
    // every white as Home Assistant gives it, daylight and a cool one too: the whites' scale draws each by its warmth
    expect(bulbHex(view({ ...WARM, rgb_color: [255, 206, 166] }), true)).toBe(`${WHITE}#ffcea6`);
    expect(bulbHex(view(DAYLIGHT), true)).toBe(`${WHITE}#fffefa`);
    expect(bulbHex(view(COOL), true)).toBe(`${WHITE}#dde6ff`);
  });

  it('a white as the palette’s light where the card asks (`palette`), and a light without a colour as the palette’s', () => {
    expect(bulbHex(view(WARM), true, 'palette')).toBeUndefined();
    expect(bulbHex(view(COOL), true, 'palette')).toBeUndefined();
    // a white Home Assistant gives no colour for, one that only dims, one that only switches: nothing of their own
    expect(
      bulbHex(view({ color_mode: 'color_temp', color_temp_kelvin: 2700 }), true),
    ).toBeUndefined();
    expect(bulbHex(view({ color_mode: 'brightness', brightness: 200 }), true)).toBeUndefined();
    expect(bulbHex(view({ color_mode: 'onoff' }), true)).toBeUndefined();
  });
});

describe('lights glowing together', () => {
  it('take their lit members’ colours by brightness, whites by their temperature (a mixed-mode group)', () => {
    const red = view(RED, 'on', 'light.red');
    const white = view(WARM, 'on', 'light.white');
    const off = view({ color_mode: 'hs', rgb_color: [0, 0, 255] }, 'off', 'light.off');
    // the warm white counts as much as the red: an orange between them
    expect(meanHex([red, white, off])).toBe('#ff542c');
    const blue = view({ color_mode: 'rgb', rgb_color: [0, 0, 255], brightness: 85 }, 'on', 'b');
    // three parts red to one part blue
    expect(meanHex([red, blue])).toBe('#bf0040');
    // whites alone: a white, by the scale
    expect(meanHex([white, off])).toBe(`${WHITE}#ffa757`);
    expect(meanHex([white, view(COOL, 'on', 'light.cool')])).toBe(`${WHITE}#eec7ab`);
    expect(meanHex([off])).toBeUndefined();
  });

  it('where whites are the palette’s, a white adds none: one red bulb among whites glows red', () => {
    const red = view(RED, 'on', 'light.red');
    const white = view(WARM, 'on', 'light.white');
    expect(meanHex([red, white], 'palette')).toBe('#ff0000');
    expect(meanHex([white], 'palette')).toBeUndefined();
  });

  it('a group is its members (`entity_id`), as the house has them, watched with it', () => {
    const MEMBERS = ['light.red', 'light.white', 'light.off'];
    // Home Assistant's own for the group: the most common mode among the members, the plain mean of their colours
    const GROUP = { color_mode: 'color_temp', rgb_color: [255, 160, 44], entity_id: MEMBERS };
    const states: Record<string, readonly [string, Record<string, unknown>]> = {
      'light.red': ['on', RED],
      'light.white': ['on', WARM],
      'light.off': ['off', RED],
      'light.group': ['on', GROUP],
    };
    const house = {
      states: Object.fromEntries(
        Object.entries(states).map(([entity_id, [state, attributes]]) => [
          entity_id,
          { entity_id, state, attributes },
        ]),
      ),
    } as unknown as HomeAssistant;
    const group = view(GROUP, 'on', 'light.group');
    expect(memberIds(group)).toEqual(MEMBERS);
    expect(memberIds(view(RED))).toEqual([]);
    expect(withMembers(['light.group', 'light.red'], house)).toEqual([
      'light.group',
      ...MEMBERS,
      'light.red',
    ]);
    expect(litColour(group, true, undefined, house)).toBe('#ff542c');
    expect(litColour(group, true, 'palette', house)).toBe('#ff0000');
    // a group beside its members: each lamp once, the group as its members
    expect(lampsOf(['light.group', 'light.red', 'light.white'], house)).toEqual(MEMBERS);
    expect(lampsOf(['light.red', 'light.lamp'], house)).toEqual(['light.red', 'light.lamp']);
    // its members off (the group's own word not yet in): nothing of its own, the palette's light
    const dark = view({ entity_id: ['light.off'] }, 'on', 'light.dark');
    expect(litColour(dark, true, undefined, house)).toBeUndefined();
  });

  it('a light flipped on shows the colour it last glowed until Home Assistant says, and forgets it once it has none', () => {
    const lamp = view(RED, 'on', 'light.flip');
    expect(litColour(lamp, true, undefined, undefined)).toBe('#ff0000');
    // switched off, then on by the finger: Home Assistant still says off, so the colour it last glowed
    const waking = view({}, 'off', 'light.flip');
    expect(litColour(waking, false, undefined, undefined)).toBeUndefined();
    expect(litColour(waking, true, undefined, undefined)).toBe('#ff0000');
    // lit white with whites as the palette's: nothing of its own, and nothing remembered for the next flip
    expect(litColour(view(WARM, 'on', 'light.flip'), true, 'palette', undefined)).toBeUndefined();
    expect(litColour(waking, true, 'palette', undefined)).toBeUndefined();
  });

  it('two cards of one lamp, one with the palette’s whites, never borrow each other’s white while a flip waits', () => {
    const lit = view(WARM, 'on', 'light.shared');
    // the room lights card draws it by its warmth, a tile with the palette's whites draws none of its own
    expect(litColour(lit, true, undefined, undefined)).toBe(`${WHITE}#ffa757`);
    expect(litColour(lit, true, 'palette', undefined)).toBeUndefined();
    // switched off, then on by a finger on either card: each shows what it drew, not the other's
    const waking = view({}, 'off', 'light.shared');
    expect(litColour(waking, true, 'palette', undefined)).toBeUndefined();
    expect(litColour(waking, true, 'temperature', undefined)).toBe(`${WHITE}#ffa757`);
    expect(litColour(waking, true, undefined, undefined)).toBe(`${WHITE}#ffa757`);
  });
});

describe('one rule for every light drawn (#58)', () => {
  const BULB = '#ffa757';

  it('its own colour, else its own tone, else its bulb’s', () => {
    expect(lightLook({ color: 'teal' }, undefined, BULB)).toEqual(['teal', 'accent']);
    expect(lightLook({ tone: 'heat' }, undefined, BULB)).toEqual([undefined, 'heat']);
    // a bulb's colour is drawn in the lit light, which its family redefines
    expect(lightLook({}, undefined, BULB)).toEqual([BULB, 'light']);
  });

  it('the bulb’s before the card’s colour and tone; theirs before the palette’s light', () => {
    const card = { color: 'purple', tone: 'heat' } as const;
    expect(lightLook({}, card, BULB)).toEqual([BULB, 'light']);
    // no bulb's colour: the card's, which the card's accent carries to the lit light, before its tone
    expect(lightLook({}, card, undefined)).toEqual([undefined, 'light']);
    expect(lightLook({}, { tone: 'heat' }, undefined)).toEqual([undefined, 'heat']);
    expect(lightLook({}, {}, undefined)).toEqual([undefined, 'light']);
    expect(lightLook({ tone: 'cool' }, card, BULB)[1]).toBe('cool');
  });
});
