// @vitest-environment happy-dom
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import { cardForm, drawEditor, listTitles, shownNames } from '../shared/fixtures/editor.js';
import { FluvyLockCard } from './lock-card.js';

// the index fetches the lazy families: they land before this file's page goes
afterAll(() => familiesDefined);
afterEach(() => document.body.replaceChildren());

describe('the lock card’s editor', () => {
  const editor = async (config: Record<string, unknown>) =>
    drawEditor(await FluvyLockCard.getConfigElement(), {
      type: 'custom:fluvy-lock-card',
      entity: 'lock.front',
      ...config,
    });

  it('offers its rows on the full card, and none on the compact one, which draws none', async () => {
    const full = await editor({ rows: ['binary_sensor.door'] });
    expect(shownNames(cardForm(full).schema)).toContain('show_rows');
    expect(listTitles(full)).toEqual(['Rows']);
    const compact = await editor({ variant: 'compact', rows: ['binary_sensor.door'] });
    expect(shownNames(cardForm(compact).schema)).not.toContain('show_rows');
    expect(listTitles(compact)).toEqual([]);
  });
});
