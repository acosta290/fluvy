// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { baseStyles } from '@fluvy/ui';
import { LookEngine } from '../look/engine.js';
import {
  HOUSE_DEFAULTS,
  PERSONAL_DEFAULTS,
  resolveSettings,
  type EffectiveSettings,
} from '../settings/index.js';

const settings = (patch: Partial<EffectiveSettings>): EffectiveSettings => ({
  ...resolveSettings(HOUSE_DEFAULTS, PERSONAL_DEFAULTS),
  ...patch,
});

function engine() {
  const stored = new Map<string, string>();
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
  } as Storage;
  document.adoptedStyleSheets = [];
  document.documentElement.removeAttribute('fluvy-look');
  const look = new LookEngine(document, () => new CSSStyleSheet(), storage);
  const page = () => document.adoptedStyleSheets.at(-1) as CSSStyleSheet;
  const text = (sheet: CSSStyleSheet) => [...sheet.cssRules].map((rule) => rule.cssText).join('');
  return { look, page, text, stored };
}

describe('the look engine', () => {
  it('covers the whole app in the everywhere scope, winning over an inline theme', () => {
    const { look, page, text, stored } = engine();
    look.apply(
      settings({ look: { palette: 'volt', shape: 'round', pills: 'round' }, scope: 'everywhere' }),
      false,
    );
    const css = text(page());
    expect(css).toContain(':root');
    expect(css).toMatch(/--primary-color: ?#5a6ff0 ?!important/);
    expect(css).toMatch(/--fluvy-radius-card: ?28px ?!important/);
    expect(document.documentElement.hasAttribute('fluvy-look')).toBe(true);
    expect(text(look.panelSheet)).toBe('');
    // the loader's cache for the next page load
    expect(JSON.parse(stored.get('fluvy:look') ?? '{}').css).toContain(
      '--primary-color:#5a6ff0 !important',
    );
  });

  it('dresses only the marked dashboards in the dashboards scope', () => {
    const { look, page, text } = engine();
    look.apply(
      settings({ look: { palette: 'blaze', shape: 'soft', pills: 'round' }, scope: 'dashboards' }),
      false,
    );
    expect(text(page())).toBe('');
    expect(document.documentElement.hasAttribute('fluvy-look')).toBe(false);
    expect(text(look.panelSheet)).toContain(':host([fluvy-look])');
    expect(text(look.panelSheet)).not.toContain('!important');
  });

  it('follows the mode, and does nothing again for the same look', () => {
    const { look, page, text } = engine();
    const volt = settings({
      look: { palette: 'volt', shape: 'soft', pills: 'round' },
      scope: 'everywhere',
    });
    look.apply(volt, false);
    const light = text(page());
    look.apply(volt, true);
    const dark = text(page());
    expect(dark).not.toBe(light);
    const sheet = page();
    look.apply(volt, true);
    expect(page()).toBe(sheet);
    expect(text(page())).toBe(dark);
  });

  it("turns the cards' own tokens into the look, both modes, never with the sentinel", () => {
    const { look } = engine();
    look.apply(
      settings({ look: { palette: 'noir', shape: 'crisp', pills: 'round' }, scope: 'dashboards' }),
      false,
    );
    const fallback = [...(baseStyles[0]?.styleSheet?.cssRules ?? [])]
      .map((rule) => rule.cssText)
      .join('');
    expect(fallback).toContain(':host([no-theme])');
    expect(fallback).toContain(':host([no-theme][dark])');
    expect(fallback).toMatch(/--fluvy-radius-card: ?14px/);
    expect(fallback).not.toContain('--fluvy-theme');
    expect(fallback).not.toContain('--primary-color');
  });
});
