import { describe, expect, it } from 'vitest';
import {
  compact,
  itemsOf,
  moved,
  toItem,
  withList,
  withoutUntouchedDefaults,
  type RowsListSpec,
} from './rows-editor.js';

const rows: RowsListSpec = {
  key: 'rows',
  alias: 'entities',
  title: 'editor.rows',
  schema: [{ name: 'entity', selector: { entity: {} } }],
};
const chips: RowsListSpec = {
  key: 'chips',
  idKey: 'label',
  title: 'editor.rows',
  schema: [{ name: 'label', selector: { text: {} } }],
};

describe('rows editor lists', () => {
  it('reads bare ids and objects, drops entries without an id', () => {
    expect(toItem('sensor.a', 'entity')).toEqual({ entity: 'sensor.a' });
    expect(toItem({ entity: 'sensor.b', tone: 'solar' }, 'entity')).toEqual({
      entity: 'sensor.b',
      tone: 'solar',
    });
    expect(toItem('', 'entity')).toBeNull();
    expect(toItem({ name: 'no id' }, 'entity')).toBeNull();
  });

  it('writes an entity with nothing else back as its bare id, and drops empty fields', () => {
    expect(compact({ entity: 'sensor.a', name: '', icon: undefined }, 'entity')).toBe('sensor.a');
    expect(compact({ entity: 'sensor.a', name: 'Sun' }, 'entity')).toEqual({
      entity: 'sensor.a',
      name: 'Sun',
    });
    expect(compact({ label: 'Home' }, 'label')).toEqual({ label: 'Home' }); // a chip stays an object
  });

  it('reads the list under its key, or under the alias while the key is empty', () => {
    expect(itemsOf({ type: 't', entities: ['sensor.a'] }, rows)).toEqual([{ entity: 'sensor.a' }]);
    expect(itemsOf({ type: 't', rows: ['sensor.b'], entities: ['sensor.a'] }, rows)).toEqual([
      { entity: 'sensor.b' },
    ]);
    expect(itemsOf({ type: 't', chips: [{ label: 'Home' }, 'Energy'] }, chips)).toEqual([
      { label: 'Home' },
      { label: 'Energy' },
    ]);
  });

  it('writes the list under its own key and drops the alias', () => {
    expect(
      withList({ type: 't', entities: ['sensor.a'], title: 'x' }, rows, ['sensor.a', 'sensor.b']),
    ).toEqual({ type: 't', title: 'x', rows: ['sensor.a', 'sensor.b'] });
  });

  it('moves one entry and keeps the others in order', () => {
    expect(moved(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moved(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moved(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('editor defaults', () => {
  it('writes back what the user set, never a default that was only shown', () => {
    const config = { type: 't', variant: 'dial' };
    const defaults = { variant: 'dial', fan_style: 'full', show_fan: true, modes: ['off', 'heat'] };
    expect(
      withoutUntouchedDefaults(
        { variant: 'dial', fan_style: 'full', show_fan: true, modes: ['off', 'heat'] },
        config,
        defaults,
      ),
    ).toEqual({ variant: 'dial' });
    expect(
      withoutUntouchedDefaults(
        { variant: 'dial', fan_style: 'chips', show_fan: false, modes: ['off'] },
        config,
        defaults,
      ),
    ).toEqual({ variant: 'dial', fan_style: 'chips', show_fan: false, modes: ['off'] });
    expect(withoutUntouchedDefaults({ title: 'x' }, config, defaults)).toEqual({ title: 'x' });
  });
});
