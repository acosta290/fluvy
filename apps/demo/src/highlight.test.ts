import { describe, expect, it } from 'vitest';
import { toYaml } from '../../../tools/docs/src/yaml.js';
import { CARDS } from './catalog.js';
import { highlightLine, highlightYaml, type YamlPiece } from './highlight.js';

/** A line's pieces as `kind:text`, the spaces left out. */
const pieces = (line: string): string[] =>
  highlightLine(line)
    .filter((piece) => piece.kind !== 'space')
    .map((piece) => `${piece.kind}:${piece.text}`);

const joined = (line: readonly YamlPiece[]): string => line.map((piece) => piece.text).join('');

describe('the YAML panel’s colours', () => {
  it('cuts a key, its colon and its value apart', () => {
    expect(pieces('type: custom:fluvy-tile-card')).toEqual([
      'key:type',
      'punct::',
      'string:custom:fluvy-tile-card',
    ]);
    expect(pieces('entity: light.ceiling')).toEqual([
      'key:entity',
      'punct::',
      'string:light.ceiling',
    ]);
    expect(pieces('rows:')).toEqual(['key:rows', 'punct::']);
  });

  it('tells numbers, booleans and null from words', () => {
    expect(pieces('tilt_angle: 90')).toEqual(['key:tilt_angle', 'punct::', 'number:90']);
    expect(pieces('value: 0.18')).toEqual(['key:value', 'punct::', 'number:0.18']);
    expect(pieces('offset: -5')).toEqual(['key:offset', 'punct::', 'number:-5']);
    expect(pieces('show_count: true')).toEqual(['key:show_count', 'punct::', 'bool:true']);
    expect(pieces('expanded: false')).toEqual(['key:expanded', 'punct::', 'bool:false']);
    expect(pieces('icon: null')).toEqual(['key:icon', 'punct::', 'null:null']);
    expect(pieces('icon: ~')).toEqual(['key:icon', 'punct::', 'null:~']);
    // a word that only looks like one is a word
    expect(pieces('name: Living room 2')).toEqual(['key:name', 'punct::', 'string:Living room 2']);
  });

  it('keeps a quoted string whole, a colon, a hash or a doubled quote inside it', () => {
    expect(pieces("ready_by: '07:00'")).toEqual(['key:ready_by', 'punct::', "string:'07:00'"]);
    expect(pieces("secondary: '{{ states(''sensor.tp'') }} °C here'")).toEqual([
      'key:secondary',
      'punct::',
      "string:'{{ states(''sensor.tp'') }} °C here'",
    ]);
    expect(pieces("color: '#C9A063'")).toEqual(['key:color', 'punct::', "string:'#C9A063'"]);
    expect(pieces('note: "two\\nlines: \\"quoted\\""')).toEqual([
      'key:note',
      'punct::',
      'string:"two\\nlines: \\"quoted\\""',
    ]);
    // a quoted key, as a map by state writes one
    expect(pieces("  'on': Tilted")).toEqual(["key:'on'", 'punct::', 'string:Tilted']);
    // a quoted item of a list is a string, not a key
    expect(pieces("  - 'Ready: soon'")).toEqual(['dash:-', "string:'Ready: soon'"]);
  });

  it('draws a list’s dashes, an item’s first key beside its dash, and the empty list and map', () => {
    expect(pieces('  - entity: switch.auto_lock')).toEqual([
      'dash:-',
      'key:entity',
      'punct::',
      'string:switch.auto_lock',
    ]);
    expect(pieces('  - binary_sensor.front_door')).toEqual([
      'dash:-',
      'string:binary_sensor.front_door',
    ]);
    expect(pieces('  - - nested')).toEqual(['dash:-', 'dash:-', 'string:nested']);
    expect(pieces('  - 12')).toEqual(['dash:-', 'number:12']);
    expect(pieces('modes: []')).toEqual(['key:modes', 'punct::', 'punct:[]']);
    expect(pieces('states: {}')).toEqual(['key:states', 'punct::', 'punct:{}']);
  });

  it('colours a comment, alone or after a value, and never a hash inside a word', () => {
    expect(pieces('# the demo house')).toEqual(['comment:# the demo house']);
    expect(pieces('  # indented')).toEqual(['comment:# indented']);
    expect(pieces('entity: light.desk # yours here')).toEqual([
      'key:entity',
      'punct::',
      'string:light.desk',
      'comment:# yours here',
    ]);
    expect(pieces("size: 'compact' # quoted")).toEqual([
      'key:size',
      'punct::',
      "string:'compact'",
      'comment:# quoted',
    ]);
    expect(pieces('path: /fluvy#top')).toEqual(['key:path', 'punct::', 'string:/fluvy#top']);
  });

  it('gives every line back whole: the pieces join into it, its indentation kept', () => {
    for (const line of [
      '',
      '    ',
      '      - entity: sensor.ef_fridge_power',
      "        icon: '{{ ''mdi:lamp'' }}' # a template",
      'navigation_path: /config/scene/dashboard',
      '- ',
      '-',
      'a:b',
    ])
      expect(joined(highlightLine(line)), JSON.stringify(line)).toBe(line);
  });

  it('reads an unset key as a comment, on every line of it', () => {
    expect(pieces('# card_opacity: 100')).toEqual(['comment:# card_opacity: 100']);
    expect(pieces('# color:')).toEqual(['comment:# color:']);
    expect(pieces('#   action: more-info')).toEqual(['comment:#   action: more-info']);
    expect(pieces("# tint: 'on'")).toEqual(["comment:# tint: 'on'"]);
  });

  it('reads every card’s example as the docs print it: whole, keys where keys are, nothing left unread', () => {
    for (const card of CARDS)
      for (const example of card.examples) {
        const yaml = toYaml(example.config);
        const lines = highlightYaml(yaml);
        expect(lines.map(joined).join('\n'), `${card.short} ${example.layout ?? ''}`).toBe(yaml);
        // every line of the writer's is a key, an item or both: its first piece after the indentation says which
        for (const line of lines) {
          const first = line.find((piece) => piece.kind !== 'space');
          expect(['key', 'dash'], `${card.short}: ${joined(line)}`).toContain(first?.kind);
        }
        expect(lines[0]?.map((piece) => piece.text)).toEqual([
          'type',
          ':',
          ' ',
          example.config.type,
        ]);
      }
  });
});
