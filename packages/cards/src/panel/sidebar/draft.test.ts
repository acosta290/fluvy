import { describe, expect, it } from 'vitest';
import { alike } from '../model.js';
import {
  hasMenu,
  kindOf,
  listOf,
  presetContent,
  rawOf,
  widthOf,
  withContent,
  withKey,
  withList,
  withMenu,
  withWidth,
} from './draft.js';
import { toYaml } from './yaml.js';

const CLOCK = { type: 'custom:fluvy-clock-card' };
const TILE = { type: 'tile', entity: 'light.ceiling' };

describe('a dashboard’s sidebar as the panel edits it', () => {
  it('offers the ready-made sidebar from what the house can draw: the weather only where it has any', () => {
    expect(presetContent('weather.home')).toEqual({
      header: {
        cards: [
          {
            type: 'custom:fluvy-clock-card',
            face: 'digital',
            weather: 'weather.home',
            show_forecast: false,
          },
        ],
      },
      menu: { items: 'views' },
      footer: {
        cards: [
          {
            type: 'custom:fluvy-alerts-card',
            variant: 'banner',
            alerts: [
              { preset: 'hazards' },
              { preset: 'open' },
              { preset: 'unlocked' },
              { preset: 'errors' },
              { preset: 'low_battery' },
            ],
          },
        ],
      },
    });
    expect(presetContent(undefined)['header']).toEqual({
      cards: [{ type: 'custom:fluvy-clock-card', face: 'digital' }],
    });
  });

  it('tells none, the ready-made and a person’s own apart, whatever its place', () => {
    const preset = presetContent('weather.home');
    expect(rawOf(undefined)).toBeUndefined();
    expect(rawOf('panel')).toBeUndefined();
    expect(kindOf(undefined, preset)).toBe('none');
    expect(kindOf(preset, preset)).toBe('preset');
    // where and how it stands is not what it holds
    expect(kindOf({ position: 'end', style: 'card', ...preset }, preset)).toBe('preset');
    expect(kindOf({ ...preset, cards: [TILE] }, preset)).toBe('own');
    expect(kindOf({ menu: { items: 'views' } }, preset)).toBe('own');
    // a person who asked for their own has it, though it still holds the ready-made
    expect(kindOf(preset, preset, true)).toBe('own');
  });

  it('changes what it holds and keeps where it stands', () => {
    const raw = { position: 'end', collapsible: true, cards: [TILE], menu: { items: 'views' } };
    expect(withContent(raw, presetContent(undefined))).toEqual({
      position: 'end',
      collapsible: true,
      ...presetContent(undefined),
    });
    expect(withContent(undefined, { menu: { items: 'views' } })).toEqual({
      menu: { items: 'views' },
    });
  });

  it('never writes a default: a choice that is one takes its key away', () => {
    expect(withKey({}, 'position', 'end', 'start')).toEqual({ position: 'end' });
    expect(withKey({ position: 'end', style: 'card' }, 'position', 'start', 'start')).toEqual({
      style: 'card',
    });
    expect(withKey({ collapsible: true }, 'collapsible', false, false)).toEqual({});
  });

  it('keeps a key where it stood: a list handed back as it was is the table it was', () => {
    const raw = { header: { cards: [{ type: 'clock' }] }, menu: { items: 'views' }, cards: [] };
    const again = withList(raw, 'header', [{ type: 'clock' }]);
    expect(JSON.stringify(again)).toBe(JSON.stringify(raw));
    expect(Object.keys(withKey(raw, 'position', 'end', 'start'))).toEqual([
      'header',
      'menu',
      'cards',
      'position',
    ]);
  });

  it('is the same sidebar whatever order its keys were written in: an editor’s own order is no change to save', () => {
    const saved = {
      header: { cards: [{ type: 'clock', face: 'digital' }] },
      menu: { items: 'views' },
    };
    const handed = {
      menu: { items: 'views' },
      header: { cards: [{ face: 'digital', type: 'clock' }] },
    };
    expect(alike(saved, handed)).toBe(true);
    expect(alike(saved, { ...handed, position: 'end' })).toBe(false);
    // a list's order is its own
    expect(
      alike({ cards: [{ type: 'a' }, { type: 'b' }] }, { cards: [{ type: 'b' }, { type: 'a' }] }),
    ).toBe(false);
    expect(alike(null, null)).toBe(true);
  });

  it('writes a device’s width in px beside the others as they stand, and no width where each is its default', () => {
    const px = (value: number) => ({ unit: 'px', value }) as const;
    expect(widthOf({}, 'tablet')).toEqual(px(280));
    expect(widthOf({}, 'desktop')).toEqual(px(320));
    expect(withWidth({}, 'tablet', px(240))).toEqual({ width: { tablet: 240 } });
    expect(withWidth({ width: { tablet: 240 } }, 'desktop', px(400))).toEqual({
      width: { tablet: 240, desktop: 400 },
    });
    expect(withWidth({ width: { tablet: 240 }, style: 'card' }, 'tablet', px(280))).toEqual({
      style: 'card',
    });
    // a share written by hand stays a share beside the device changed
    const share = { width: { desktop: '24%', phone: 200 } };
    expect(widthOf(share, 'desktop')).toEqual({ unit: '%', value: 24 });
    expect(withWidth(share, 'tablet', px(0))).toEqual({
      width: { phone: 200, tablet: 0, desktop: '24%' },
    });
    // one figure for both devices, then one of them changed: each named
    expect(withWidth({ width: 300 }, 'desktop', px(320))).toEqual({ width: { tablet: 300 } });
  });

  it('writes a share of the screen or of the dashboard with its unit (#249), none in any unit as 0', () => {
    expect(withWidth({}, 'desktop', { unit: 'vw', value: 25 })).toEqual({
      width: { desktop: '25vw' },
    });
    expect(widthOf({ width: { desktop: '25vw' } }, 'desktop')).toEqual({ unit: 'vw', value: 25 });
    expect(withWidth({ width: { desktop: '25vw' } }, 'tablet', { unit: '%', value: 30 })).toEqual({
      width: { tablet: '30%', desktop: '25vw' },
    });
    expect(withWidth({ width: { desktop: '25vw' } }, 'desktop', { unit: 'vw', value: 0 })).toEqual({
      width: { desktop: 0 },
    });
    // back to its default in px: no width at all
    expect(
      withWidth({ width: { desktop: '25vw' } }, 'desktop', { unit: 'px', value: 320 }),
    ).toEqual({});
  });

  it('edits the three lists where the sidebar reads them, an empty one leaving no key', () => {
    const raw = { header: { cards: [CLOCK] }, cards: [TILE], footer: [CLOCK] };
    expect(listOf(raw, 'header')).toEqual([CLOCK]);
    expect(listOf(raw, 'cards')).toEqual([TILE]);
    expect(listOf(raw, 'footer')).toEqual([CLOCK]);
    expect(listOf({}, 'footer')).toEqual([]);
    expect(withList({}, 'header', [CLOCK])).toEqual({ header: { cards: [CLOCK] } });
    expect(withList({}, 'cards', [TILE, CLOCK])).toEqual({ cards: [TILE, CLOCK] });
    expect(withList(raw, 'footer', [])).toEqual({ header: { cards: [CLOCK] }, cards: [TILE] });
    expect(withList(raw, 'cards', [])).toEqual({ header: { cards: [CLOCK] }, footer: [CLOCK] });
  });

  it('turns the menu of pages on and off', () => {
    expect(hasMenu({})).toBe(false);
    expect(hasMenu({ menu: { items: 'views' } })).toBe(true);
    expect(withMenu({ style: 'card' }, true)).toEqual({
      style: 'card',
      menu: { items: 'views' },
    });
    expect(withMenu({ style: 'card', menu: { items: 'views' } }, false)).toEqual({
      style: 'card',
    });
  });

  it('writes a table as YAML a file can take: block style, words plain, what YAML would misread quoted', () => {
    expect(
      toYaml('fluvy_sidebar', {
        position: 'end',
        width: { tablet: 240, desktop: '24%' },
        collapsible: true,
        ...presetContent('weather.home'),
        cards: [],
        views: ['home', '2', 'on'],
        note: 'a: b',
        at: '07:30',
      }),
    ).toBe(
      [
        'fluvy_sidebar:',
        '  position: end',
        '  width:',
        '    tablet: 240',
        '    desktop: "24%"',
        '  collapsible: true',
        '  header:',
        '    cards:',
        '      - type: custom:fluvy-clock-card',
        '        face: digital',
        '        weather: weather.home',
        '        show_forecast: false',
        '  menu:',
        '    items: views',
        '  footer:',
        '    cards:',
        '      - type: custom:fluvy-alerts-card',
        '        variant: banner',
        '        alerts:',
        '          - preset: hazards',
        '          - preset: open',
        '          - preset: unlocked',
        '          - preset: errors',
        '          - preset: low_battery',
        '  cards: []',
        '  views:',
        '    - home',
        '    - "2"',
        '    - "on"',
        '  note: "a: b"',
        '  at: "07:30"',
      ].join('\n'),
    );
  });
});
