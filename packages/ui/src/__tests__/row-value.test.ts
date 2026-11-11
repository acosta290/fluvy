// @vitest-environment happy-dom
import { render } from 'lit';
import { describe, expect, it } from 'vitest';
import { listRow } from '../parts.js';

/*
 * A row's value in words, Home Assistant's state of several words: it may wrap between them where its row is narrow
 * (`fv-row__value--words`), in Latin letters or Cyrillic; one word, or a figure and its unit, stays one value.
 */

/** The value's classes, as a row ends with it. */
const classesOf = (value: string): string[] => {
  const host = document.createElement('div');
  render(listRow({ title: 'Living room motion', trailing: 'value', value }), host);
  return [...(host.querySelector('.fv-row__value')?.classList ?? [])];
};

describe('a row’s value in words', () => {
  it('may wrap between its words in Latin letters or Cyrillic, never a single word or a figure', () => {
    expect(classesOf('Não detectado')).toContain('fv-row__value--words');
    expect(classesOf('Не обнаружено')).toContain('fv-row__value--words');
    expect(classesOf('Обнаружено')).not.toContain('fv-row__value--words');
    expect(classesOf('21,5 °C')).not.toContain('fv-row__value--words');
  });
});
