// @vitest-environment happy-dom
import type { HaFormSchemaItem } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { editorLabels, formLabels } from './form.js';

const label = (form: ReturnType<typeof formLabels>, name: string): string | undefined =>
  form.computeLabel?.({ name } as HaFormSchemaItem, (key) => key);

describe('editor labels', () => {
  it('name the shared fields without a card listing them', () => {
    document.documentElement.lang = 'en';
    expect(label(formLabels(), 'title')).toBe('Title');
    expect(label(formLabels(), 'entities')).toBe('Entities');
    expect(label(formLabels(), 'mystery')).toBeUndefined();
  });
  it('let a card give a shared field another word, and its own fields its own', () => {
    document.documentElement.lang = 'en';
    expect(label(formLabels({ title: 'editor.tabs' }), 'title')).toBe('Tabs');
    const own = editorLabels((_hass, key: 'mine') => `own:${key}`, { field: 'mine' });
    expect(label(own, 'field')).toBe('own:mine');
    expect(label(own, 'icon')).toBe('Icon');
  });
});
