import { describe, expect, it } from 'vitest';
import { menuShown } from './page-menu.js';

describe('our pages’ menu button', () => {
  it('shows where Home Assistant shows its own: on a phone, and beside a hidden sidebar (#173)', () => {
    expect(menuShown(true, { dockedSidebar: 'docked' })).toBe(true);
    expect(menuShown(false, { dockedSidebar: 'always_hidden' })).toBe(true);
    expect(menuShown(false, { dockedSidebar: 'docked' })).toBe(false);
    expect(menuShown(false, { dockedSidebar: 'auto' })).toBe(false);
    expect(menuShown(false, undefined)).toBe(false);
  });
});
