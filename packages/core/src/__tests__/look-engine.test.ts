// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
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

  it('brings Home Assistant’s chrome up to date only on a page that wears Fluvy', () => {
    const { look } = engine();
    const meta = Object.assign(document.createElement('meta'), {
      name: 'theme-color',
      content: '#03a9f4',
    });
    document.head.append(meta);
    const fireMessage = vi.fn();
    document.body.append(
      Object.assign(document.createElement('home-assistant'), {
        hass: { auth: { external: { fireMessage } } },
      }),
    );
    document.documentElement.removeAttribute('style');
    document.documentElement.style.setProperty('--app-theme-color', '#101010');
    document.documentElement.style.setProperty('--primary-background-color', '#fafafa');
    // another theme, a dashboard that does not wear the look: Home Assistant's chrome, as its theme left it
    look.apply(settings({ scope: 'dashboards' }), false);
    expect(meta.content).toBe('#03a9f4');
    expect(document.documentElement.style.backgroundColor).toBe('');
    expect(fireMessage).not.toHaveBeenCalled();
    // the look covers the whole app
    look.apply(settings({ scope: 'everywhere' }), false);
    expect(meta.content).not.toBe('#03a9f4');
    expect(document.documentElement.style.backgroundColor).not.toBe('');
    expect(fireMessage).toHaveBeenCalledWith({ type: 'theme-update' });
    meta.remove();
    document.body.replaceChildren();
    document.documentElement.removeAttribute('style');
  });

  it('gives Home Assistant’s chrome back on the apply that takes Fluvy off the page, then leaves it', () => {
    const { look } = engine();
    const meta = Object.assign(document.createElement('meta'), {
      name: 'theme-color',
      content: '#03a9f4',
    });
    document.head.append(meta);
    const fireMessage = vi.fn();
    document.body.append(
      Object.assign(document.createElement('home-assistant'), {
        hass: { auth: { external: { fireMessage } } },
      }),
    );
    const style = document.documentElement.style;
    document.documentElement.removeAttribute('style');
    look.apply(settings({ scope: 'everywhere' }), false);
    const ours = { background: style.backgroundColor, color: meta.content };
    // Home Assistant applies another theme and writes the chrome while the look's sheet is still on: ours
    style.setProperty('--app-theme-color', '#ff9800');
    style.setProperty('--primary-background-color', '#fafafa');
    style.backgroundColor = ours.background;
    look.apply(settings({ scope: 'dashboards' }), false);
    expect(meta.content).toBe('#ff9800');
    expect(style.backgroundColor).not.toBe(ours.background);
    expect(style.backgroundColor).not.toBe('');
    expect(fireMessage).toHaveBeenCalledTimes(2);
    // Home Assistant's own theme names no colour for the bar: its first one, as Home Assistant falls back to
    look.apply(settings({ scope: 'everywhere' }), false);
    meta.setAttribute('default-content', '#03a9f4');
    document.documentElement.removeAttribute('style');
    look.apply(settings({ scope: 'dashboards' }), false);
    expect(meta.content).toBe('#03a9f4');
    expect(style.backgroundColor).toBe('');
    // off the page, the chrome stays Home Assistant's
    const calls = fireMessage.mock.calls.length;
    meta.content = '#123456';
    look.apply(settings({ scope: 'dashboards' }), true);
    expect(meta.content).toBe('#123456');
    expect(fireMessage).toHaveBeenCalledTimes(calls);
    meta.remove();
    document.body.replaceChildren();
    document.documentElement.removeAttribute('style');
  });
});
