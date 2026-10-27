import { MAX_SAVED_SERIES, type SavedSeries } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { chosenSet, roomForSet, setIdOf, setOf, withoutSet, withSet } from './series.js';

const SIX = ['#1d4ed8', '#b45309', '#15803d', '#b91c1c', '#7e22ce', '#0f766e'] as const;
const set = (id: string, name = id): SavedSeries => ({ id, name, colours: SIX });

describe('the house’s sets of series colours', () => {
  it('takes an id from a name, apart from the sets it keeps', () => {
    expect(setIdOf('Warm Sand', [])).toBe('warm-sand');
    expect(setIdOf('Warm Sand', [set('warm-sand'), set('warm-sand-2')])).toBe('warm-sand-3');
    expect(setIdOf('·', [])).toBe('set');
    // the palette's own word is no set's
    expect(setIdOf('Palette', [])).toBe('palette-2');
  });

  it('saves a draft only when it is whole, an edited one under its own id', () => {
    expect(setOf({ name: ' Dusk ', colours: SIX }, [])).toEqual({
      id: 'dusk',
      name: 'Dusk',
      colours: SIX,
    });
    expect(setOf({ id: 'sea', name: 'Night sea', colours: SIX }, [set('sea')])?.id).toBe('sea');
    expect(setOf({ name: '', colours: SIX }, [])).toBeUndefined();
    expect(setOf({ name: 'Five', colours: SIX.slice(0, 5) }, [])).toBeUndefined();
  });

  it('keeps twelve, an edited one in its place', () => {
    const full = Array.from({ length: MAX_SAVED_SERIES }, (_, i) => set(`s${i}`));
    expect(roomForSet(full)).toBe(false);
    expect(roomForSet(full, 's3')).toBe(true);
    expect(roomForSet(full.slice(1))).toBe(true);
    const renamed = withSet(full, set('s3', 'Renamed'));
    expect(renamed.map((s) => s.name)[3]).toBe('Renamed');
    expect(renamed).toHaveLength(MAX_SAVED_SERIES);
    expect(withSet([set('a')], set('b')).map((s) => s.id)).toEqual(['a', 'b']);
    expect(withoutSet([set('a'), set('b')], 'a').map((s) => s.id)).toEqual(['b']);
  });

  it('wears the set the charts name while the house keeps it, the palette’s otherwise', () => {
    expect(chosenSet([set('sea')], 'sea')?.id).toBe('sea');
    expect(chosenSet([set('sea')], 'gone')).toBeUndefined();
    expect(chosenSet([set('palette')], 'palette')).toBeUndefined();
  });
});
