// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { WALL_ATTRIBUTE } from '../look/attributes.js';
import { writeDevice } from '../settings/device.js';
import { startWall } from '../wall/start.js';

const ui = async () => {
  throw new Error('no pieces in this test');
};

describe('the wall\u2019s switch', () => {
  afterEach(() => {
    document.documentElement.removeAttribute(WALL_ATTRIBUTE);
    localStorage.clear();
  });

  it('takes the loader\u2019s mark off a page whose device is not a wall, and answers off', () => {
    document.documentElement.setAttribute(WALL_ATTRIBUTE, '');
    writeDevice({ wall: false });
    const wall = startWall({ look: undefined, ui });
    expect(document.documentElement.hasAttribute(WALL_ATTRIBUTE)).toBe(false);
    expect(wall.on()).toBe(false);
    expect(wall.phase()).toBe('off');
    expect(wall.loaded()).toBe(false);
  });

  it('keeps the mark on a wall device (the controller, when it loads, owns it from there)', () => {
    document.documentElement.setAttribute(WALL_ATTRIBUTE, '');
    writeDevice({ wall: true });
    startWall({ look: undefined, ui }); // no look: the controller is not fetched, the mark stays
    expect(document.documentElement.hasAttribute(WALL_ATTRIBUTE)).toBe(true);
  });
});
