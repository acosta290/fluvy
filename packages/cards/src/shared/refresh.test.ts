import { afterEach, describe, expect, it, vi } from 'vitest';
import { Refresher } from './refresh.js';

afterEach(() => vi.useRealTimers());

describe('Refresher', () => {
  it('reads a key once while it is fresh, and again once it is not', async () => {
    vi.useFakeTimers();
    const refresher = new Refresher<number>(1000);
    const load = vi.fn(() => Promise.resolve(1));
    expect(refresher.request('a', load, () => {})).toBe('');
    expect(refresher.request('a', load, () => {})).toBeNull();
    vi.advanceTimersByTime(1001);
    expect(refresher.request('a', load, () => {})).toBe('a');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('drops an answer for a key no longer wanted', async () => {
    const answers: string[] = [];
    let settle: (value: string) => void = () => {};
    const refresher = new Refresher<string>();
    refresher.request(
      'old',
      () => new Promise((resolve) => (settle = resolve)),
      (v) => answers.push(v),
    );
    expect(
      refresher.request(
        'new',
        () => Promise.resolve('new'),
        (v) => answers.push(v),
      ),
    ).toBe('old');
    settle('old');
    await Promise.resolve();
    await Promise.resolve();
    expect(answers).toEqual(['new']);
  });
});
