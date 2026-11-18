import { describe, expect, it } from 'vitest';
import { scalar, toYaml } from './yaml.js';

describe('a configuration as YAML', () => {
  it('writes a card as a person would: type first, lists a step in, an item’s keys under its dash', () => {
    expect(
      toYaml({
        type: 'custom:fluvy-lock-card',
        entity: 'lock.front_door',
        show_rows: false,
        rows: [
          { entity: 'switch.auto_lock', icon: 'clock' },
          'binary_sensor.front_door',
          { type: 'section', label: 'Guests' },
        ],
        favorites: [{ label: 'Night', position: 0, more: { tilt: 0 } }],
        tap_action: { action: 'navigate', navigation_path: '/config/helpers' },
        modes: [],
        states: {},
      }),
    ).toBe(
      [
        'type: custom:fluvy-lock-card',
        'entity: lock.front_door',
        'show_rows: false',
        'rows:',
        '  - entity: switch.auto_lock',
        '    icon: clock',
        '  - binary_sensor.front_door',
        '  - type: section',
        '    label: Guests',
        'favorites:',
        '  - label: Night',
        '    position: 0',
        '    more:',
        '      tilt: 0',
        'tap_action:',
        '  action: navigate',
        '  navigation_path: /config/helpers',
        'modes: []',
        'states: {}',
      ].join('\n'),
    );
  });

  it('says an unset key as a comment: its value on every line of it, or the key alone where it has none', () => {
    expect(
      toYaml(
        {
          type: 'custom:fluvy-cover-card',
          entity: 'cover.blinds',
          name: undefined,
          card_opacity: 100,
          tint: 'on',
          favorites: [{ name: 'Night', position: 0 }, 'cover.awning'],
          hold_action: { action: 'more-info' },
          variant: 'full',
        },
        new Set(['name', 'card_opacity', 'tint', 'favorites', 'hold_action']),
      ),
    ).toBe(
      [
        'type: custom:fluvy-cover-card',
        'entity: cover.blinds',
        '# name:',
        '# card_opacity: 100',
        "# tint: 'on'",
        '# favorites:',
        '#   - name: Night',
        '#     position: 0',
        '#   - cover.awning',
        '# hold_action:',
        '#   action: more-info',
        'variant: full',
      ].join('\n'),
    );
    // a key that is set keeps its line, whatever it holds
    expect(toYaml({ name: undefined, modes: [] })).toBe('name: null\nmodes: []');
  });

  it('leaves a word plain: a name with spaces, an id, a path, a unit’s sign inside it', () => {
    for (const text of [
      'Living room',
      'light.living_room',
      'custom:fluvy-tile-card',
      '/fluvy-home/living',
      'Living room · window',
      'Marta’s flat',
      'mdi:sofa',
      'Écran',
    ])
      expect(scalar(text), text).toBe(text);
  });

  it('quotes what YAML 1.1 reads as something else: a boolean’s word, a number, a time, a ratio, a date', () => {
    for (const text of [
      'on',
      'Off',
      'yes',
      'no',
      'true',
      'null',
      'y',
      '2',
      '16:9',
      '07:00',
      '2026-09-17',
      '03:00 · backup first',
      '4 devices',
      '-5',
      '.5',
      '#C9A063',
    ])
      expect(scalar(text), text).toBe(`'${text}'`);
    // a state's word as a key, as a map by state holds it
    expect(toYaml({ states: { on: 'Tilted', off: 'Closed' } })).toBe(
      "states:\n  'on': Tilted\n  'off': Closed",
    );
  });

  it('quotes a template, a string with a colon or a hash apart, an empty one, and doubles an apostrophe', () => {
    expect(scalar("{{ states('sensor.x') }} °C here")).toBe("'{{ states(''sensor.x'') }} °C here'");
    expect(scalar('Ready: soon')).toBe("'Ready: soon'");
    expect(scalar('Lights #2')).toBe("'Lights #2'");
    expect(scalar('{count} shaded')).toBe("'{count} shaded'");
    expect(scalar('')).toBe("''");
    expect(scalar('ends in a colon:')).toBe("'ends in a colon:'");
    expect(scalar('two\nlines')).toBe('"two\\nlines"');
  });
});
