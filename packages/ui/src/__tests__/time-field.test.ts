// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import '../controls/time-field.js';
import type { FluvyTimeField, TimeFieldDetail } from '../controls/time-field.js';

async function field(value: number, options: Partial<FluvyTimeField> = {}) {
  const node = document.createElement('fluvy-time-field');
  node.value = value;
  Object.assign(node, options);
  document.body.append(node);
  await node.updateComplete;
  const changes: number[] = [];
  node.addEventListener('fluvy-time', (event) =>
    changes.push((event as CustomEvent<TimeFieldDetail>).detail.value),
  );
  const segments = () => [...node.shadowRoot!.querySelectorAll<HTMLElement>('.tf__seg')];
  const shown = () =>
    segments()
      .map((segment) =>
        segment instanceof HTMLInputElement ? segment.value : segment.textContent?.trim(),
      )
      .join(' ');
  const key = async (segment: number, name: string) => {
    segments()[segment]!.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
    await node.updateComplete;
  };
  const type = async (segment: number, digit: string) => {
    const input = segments()[segment] as HTMLInputElement;
    input.value = `${input.value}${digit}`;
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await node.updateComplete;
  };
  return { node, changes, shown, key, type, segments };
}

describe('the time field', () => {
  afterEach(() => document.body.replaceChildren());

  it('reads the day’s end as 24:00, and steps each segment with the arrows', async () => {
    const { shown, key, changes } = await field(24 * 60, { endOfDay: true });
    expect(shown()).toBe('24 00');
    await key(0, 'ArrowDown');
    expect(shown()).toBe('23 00');
    await key(1, 'ArrowDown');
    expect(shown()).toBe('23 59');
    expect(changes).toEqual([23 * 60, 23 * 60 + 59]);
  });

  it('takes typed digits and moves on once a segment is whole', async () => {
    const { node, type, shown, segments } = await field(0);
    segments()[0]!.focus();
    await type(0, '2');
    await type(0, '1');
    expect(node.shadowRoot!.activeElement).toBe(segments()[1]);
    await type(1, '4');
    await type(1, '7');
    expect(shown()).toBe('21 47');
    expect(node.value).toBe(21 * 60 + 47);
    // a first digit that cannot start two is the whole hour
    segments()[0]!.focus();
    await type(0, '7');
    expect(node.value).toBe(7 * 60 + 47);
  });

  it('keeps a 12-hour house on its clock, the day’s half its own segment', async () => {
    const { node, shown, key } = await field(21 * 60 + 5, {
      hour12: true,
      periods: ['a. m.', 'p. m.'],
    });
    expect(shown()).toBe('09 05 p. m.');
    await key(2, 'a');
    expect(node.value).toBe(9 * 60 + 5);
    expect(shown()).toBe('09 05 a. m.');
  });
});
