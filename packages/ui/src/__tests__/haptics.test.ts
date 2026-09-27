import { afterEach, describe, expect, it } from 'vitest';
import { haptic, setHaptics } from '../haptics.js';

const felt = (target: EventTarget): string[] => {
  const kinds: string[] = [];
  target.addEventListener('haptic', (event) => kinds.push(String((event as CustomEvent).detail)));
  return kinds;
};

describe('haptics', () => {
  afterEach(() => setHaptics(true));

  it('buzzes through the one event the companion apps listen to', () => {
    const target = new EventTarget();
    const kinds = felt(target);
    haptic(target, 'light');
    haptic(target, 'medium');
    expect(kinds).toEqual(['light', 'medium']);
  });

  it('thins a fast drag’s ticks to one per 60 ms, per source', () => {
    const a = new EventTarget();
    const b = new EventTarget();
    const ka = felt(a);
    const kb = felt(b);
    haptic(a, 'selection');
    haptic(a, 'selection');
    haptic(b, 'selection');
    expect(ka).toEqual(['selection']);
    expect(kb).toEqual(['selection']);
  });

  it('stays quiet when the person turned haptics off', () => {
    const target = new EventTarget();
    const kinds = felt(target);
    setHaptics(false);
    haptic(target, 'light');
    haptic(target, 'selection');
    expect(kinds).toEqual([]);
  });
});
