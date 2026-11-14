import { describe, expect, it } from 'vitest';
import {
  deviceOf,
  isAddress,
  isIcon,
  isViewPath,
  parseSidebar,
  parseWidth,
  presentationOf,
  WIDTH_DEFAULTS,
  widthCss,
} from './config.js';

const CLOCK = { type: 'custom:fluvy-clock-card' };

describe('a dashboard’s sidebar as its configuration writes it', () => {
  it('asks for none where the key holds no object', () => {
    for (const raw of [undefined, null, false, true, 'panel', 3, [CLOCK]])
      expect(parseSidebar(raw)).toBeUndefined();
  });

  it('takes its defaults where it says nothing: at the start, a panel, 280 on a tablet and 320 on a desktop, none on a phone', () => {
    expect(parseSidebar({})).toEqual({
      position: 'start',
      width: WIDTH_DEFAULTS,
      phone: 'none',
      style: 'panel',
      collapsible: false,
      header: [],
      menu: undefined,
      cards: [],
      footer: [],
      views: undefined,
      subviews: true,
      users: undefined,
      hideTabs: false,
      opacity: undefined,
    });
  });

  it('reads every field on its own, a word it does not know as the default', () => {
    const spec = parseSidebar({
      position: 'right',
      phone: 'drawer',
      style: 'glass',
      collapsible: true,
      header: { cards: [CLOCK, 'no card', { entity: 'light.a' }] },
      cards: [CLOCK],
      footer: [CLOCK],
      views: ['home', 'li ghts', 7, 'home'],
      subviews: false,
      users: ['a1', '', 3],
      hide_tabs: true,
      card_opacity: 72.4,
    });
    expect(spec).toMatchObject({
      // the older words for a side
      position: 'end',
      phone: 'drawer',
      style: 'panel',
      collapsible: true,
      // only what is a card: an object that names its type
      header: [CLOCK],
      cards: [CLOCK],
      footer: [CLOCK],
      views: ['home'],
      subviews: false,
      users: ['a1'],
      hideTabs: true,
      opacity: 72,
    });
    expect(parseSidebar({ position: 'left' })?.position).toBe('start');
    expect(parseSidebar({ position: 'middle' })?.position).toBe('start');
  });

  it('holds a width to what a sidebar can be: px or a share, 0 for none, never a word', () => {
    expect(parseWidth(300)).toEqual({ unit: 'px', value: 300 });
    expect(parseWidth('300px')).toEqual({ unit: 'px', value: 300 });
    expect(parseWidth(' 24% ')).toEqual({ unit: '%', value: 24 });
    expect(parseWidth(0)).toEqual({ unit: 'px', value: 0 });
    expect(parseWidth('0%')).toEqual({ unit: 'px', value: 0 });
    // held: 160 to 560 px, 10 to 50 %
    expect(parseWidth(40)).toEqual({ unit: 'px', value: 160 });
    expect(parseWidth(4000)).toEqual({ unit: 'px', value: 560 });
    expect(parseWidth('90%')).toEqual({ unit: '%', value: 50 });
    for (const raw of ['wide', '20em', 'calc(100% - 4px)', '300px; color: red', -3, null, {}])
      expect(parseWidth(raw)).toBeUndefined();
  });

  it('takes one width for a tablet and a desktop, or each device’s own', () => {
    expect(parseSidebar({ width: 300 })?.width).toEqual({
      phone: { unit: 'px', value: 0 },
      tablet: { unit: 'px', value: 300 },
      desktop: { unit: 'px', value: 300 },
    });
    expect(parseSidebar({ width: { phone: 240, desktop: '30%' } })?.width).toEqual({
      phone: { unit: 'px', value: 240 },
      tablet: WIDTH_DEFAULTS.tablet,
      desktop: { unit: '%', value: 30 },
    });
    // a width that cannot be read is the default, never none
    expect(parseSidebar({ width: 'wide' })?.width).toEqual(WIDTH_DEFAULTS);
    expect(parseSidebar({ width: 0 })?.width.desktop.value).toBe(0);
  });

  it('writes a width as CSS from its figures alone', () => {
    expect(widthCss({ unit: 'px', value: 300 })).toBe('300px');
    expect(widthCss({ unit: '%', value: 24 })).toBe('clamp(160px, 24%, 560px)');
  });

  it('lists the dashboard’s views, or the pages written: each needs its words, and an address or an action', () => {
    expect(parseSidebar({ menu: { items: 'views' } })?.menu).toEqual({
      items: 'views',
      pinned: false,
    });
    expect(parseSidebar({ menu: 'views' })?.menu?.items).toBe('views');
    expect(parseSidebar({ menu: true })?.menu?.items).toBe('views');
    expect(parseSidebar({ menu: { pinned: true } })?.menu).toEqual({
      items: 'views',
      pinned: true,
    });
    expect(parseSidebar({ menu: false })?.menu).toBeUndefined();
    const toggle = { action: 'perform-action', perform_action: 'light.turn_off' };
    expect(
      parseSidebar({
        menu: {
          items: [
            { title: ' Home ', icon: 'mdi:home', path: '/tablet/main' },
            { title: 'Lights', icon: 'not an icon', path: 'lights' },
            { title: 'All off', icon: 'fluvy:power', tap_action: toggle },
            { icon: 'fluvy:power', tap_action: toggle },
            { title: 'Elsewhere', path: 'https://example.com/' },
            { title: 'Other host', path: '//example.com/x' },
            { title: 'Script', path: 'javascript:alert(1)' },
            { title: 'Nowhere' },
            { path: '/tablet/nameless' },
            'home',
          ],
        },
      })?.menu?.items,
    ).toEqual([
      { title: 'Home', icon: 'mdi:home', path: '/tablet/main' },
      { title: 'Lights', path: 'lights' },
      { title: 'All off', icon: 'fluvy:power', tap_action: toggle },
    ]);
    // pages of which none can be read: no menu
    expect(parseSidebar({ menu: { items: [{ title: 'Nowhere' }] } })?.menu).toBeUndefined();
  });

  it('knows an address, a view’s path and an icon from anything else', () => {
    expect(['/a', '/a/b?c=1#d', '/'].every(isAddress)).toBe(true);
    expect(['a', '//a', '/a b', '/a\\b', 'http://a', '', 3].some(isAddress)).toBe(false);
    expect(['home', 'living-room', 'sala_1', 'büro', '2'].every(isViewPath)).toBe(true);
    expect(['', 'a/b', 'a b', '/a', 'a"]', 4].some(isViewPath)).toBe(false);
    expect(['mdi:home', 'fluvy:cloud-sun'].every(isIcon)).toBe(true);
    expect(['home', 'mdi:', 'mdi:a b', 'url(x)', 5].some(isIcon)).toBe(false);
  });

  it('stands beside the views where the device has a width, and on a phone as the dashboard asks', () => {
    expect([599, 600, 1279, 1280].map(deviceOf)).toEqual(['phone', 'tablet', 'tablet', 'desktop']);
    const spec = parseSidebar({})!;
    expect(presentationOf(spec, 'desktop')).toBe('beside');
    expect(presentationOf(spec, 'tablet')).toBe('beside');
    expect(presentationOf(spec, 'phone')).toBeUndefined();
    expect(presentationOf(parseSidebar({ phone: 'top' })!, 'phone')).toBe('top');
    expect(presentationOf(parseSidebar({ phone: 'drawer' })!, 'phone')).toBe('drawer');
    // a phone given a width of its own stands it beside the views; a tablet given none has none
    expect(presentationOf(parseSidebar({ width: { phone: 200 }, phone: 'top' })!, 'phone')).toBe(
      'beside',
    );
    expect(
      presentationOf(parseSidebar({ width: { tablet: 0 }, phone: 'drawer' })!, 'tablet'),
    ).toBeUndefined();
  });
});
