// @vitest-environment happy-dom
import { render } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toggle } from '../parts.js';

/** A switch drawn into the document: its hit and its track. */
function drawn(on: boolean | 'mixed', onToggle = vi.fn(), disabled = false) {
  const host = document.createElement('div');
  document.body.append(host);
  render(toggle(on, 'light', onToggle, 'Living room', disabled), host);
  return {
    hit: host.querySelector<HTMLElement>('.fv-hit')!,
    track: host.querySelector<HTMLElement>('.fv-switch')!,
    onToggle,
  };
}

afterEach(() => document.body.replaceChildren());

describe('the switch (1.23, #219: a group some of which is on)', () => {
  it('says on, off and mixed to a reader and in its classes', () => {
    expect(drawn(true).track.getAttribute('aria-checked')).toBe('true');
    expect(drawn(true).track.classList.contains('is-on')).toBe(true);
    expect(drawn(false).track.getAttribute('aria-checked')).toBe('false');
    const mixed = drawn('mixed').track;
    expect(mixed.getAttribute('aria-checked')).toBe('mixed');
    expect(mixed.classList.contains('is-mixed')).toBe(true);
    expect(mixed.classList.contains('is-on')).toBe(false);
  });

  it('turns off what is on and on what is off; a mixed one off, as a room’s switch does', () => {
    for (const [on, next] of [
      [true, false],
      [false, true],
      ['mixed', false],
    ] as const) {
      const { hit, onToggle } = drawn(on);
      hit.click();
      expect(onToggle, String(on)).toHaveBeenCalledExactlyOnceWith(next);
    }
  });

  it('a key flips it as a tap; out of reach it does nothing', () => {
    const { track, onToggle } = drawn('mixed');
    track.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(false);
    const dead = drawn('mixed', vi.fn(), true);
    dead.hit.click();
    expect(dead.onToggle).not.toHaveBeenCalled();
    expect(dead.track.getAttribute('aria-disabled')).toBe('true');
  });
});
