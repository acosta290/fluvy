// @vitest-environment happy-dom
import { html, LitElement, type TemplateResult } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ORIGINAL_ACTIVITY, resolveEntity, type HomeAssistant } from '@fluvy/core';
import { eventKey, type ActivityEvent } from '@fluvy/core/activity';
import type { FluvyTimeRail, TimeRailDetail } from '@fluvy/ui/time-rail';
import { ActivityIndex, buildModel, dayRange, shiftRange } from './model.js';
import { timeAt } from './rail.js';
import { setTarget } from './sources.js';
import { takeOverPage } from '../shared/takeover.js';
import { activityIsOurs, takeOverActivity } from './takeover.js';
import type { FluvyActivity } from './view.js';
import { lookOf } from './words.js';

const at = (h: number, m = 0, s = 0): number => new Date(2026, 8, 17, h, m, s).getTime() / 1000;

/** A house of a few things: a light, a door, the alarm, a person, a setting and an automation. */
function house(extra: Partial<HomeAssistant> = {}): HomeAssistant {
  const state = (entity_id: string, value: string, attributes: Record<string, unknown> = {}) => ({
    entity_id,
    state: value,
    attributes: { friendly_name: entity_id.split('.')[1]!.replace(/_/g, ' '), ...attributes },
    last_changed: '',
    last_updated: '',
  });
  return {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    states: {
      'light.kitchen': state('light.kitchen', 'off'),
      'binary_sensor.front_door': state('binary_sensor.front_door', 'off', {
        device_class: 'door',
      }),
      'alarm_control_panel.house': state('alarm_control_panel.house', 'armed_night'),
      'person.marta': state('person.marta', 'home', { user_id: 'u1' }),
      'select.bulb_power_on': state('select.bulb_power_on', 'on'),
      'automation.night': state('automation.night', 'on', { id: '7' }),
    },
    entities: {
      'select.bulb_power_on': { entity_id: 'select.bulb_power_on', entity_category: 'config' },
    },
    devices: {},
    areas: {},
    user: { id: 'u1', name: 'Marta', is_admin: true },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    ...extra,
  } as unknown as HomeAssistant;
}

const DAY: readonly ActivityEvent[] = [
  // newest first, as the stream keeps them
  {
    when: at(21, 31),
    entity_id: 'alarm_control_panel.house',
    state: 'armed_night',
    context_event_type: 'automation_triggered',
    context_entity_id: 'automation.night',
    context_domain: 'automation',
    context_name: 'Night',
  },
  {
    when: at(21, 30),
    entity_id: 'automation.night',
    domain: 'automation',
    name: 'Night',
    message: 'triggered by time',
    source: 'time',
  },
  { when: at(19, 2), entity_id: 'light.kitchen', state: 'off', context_user_id: 'u1' },
  { when: at(18, 30), entity_id: 'binary_sensor.front_door', state: 'on' },
  { when: at(18, 10), entity_id: 'light.kitchen', state: 'on' },
  { when: at(8, 56, 5), entity_id: 'select.bulb_power_on', state: 'on' },
  { when: at(8, 56), name: 'Home Assistant', domain: 'homeassistant', message: 'started' },
  {
    when: at(6, 45),
    entity_id: 'alarm_control_panel.house',
    state: 'disarmed',
    context_user_id: 'u1',
  },
];

describe('the Activity model', () => {
  it('takes a local day, and a day back across the clock change is still a day', () => {
    const day = dayRange(new Date(2026, 9, 25, 15)); // Europe's clocks go back that night
    expect(new Date(day.start).getHours()).toBe(0);
    expect(new Date(day.end).getDate()).toBe(26);
    const back = shiftRange(dayRange(new Date(2026, 9, 26, 12)), -1);
    expect(new Date(back.start).getDate()).toBe(25);
    expect(new Date(back.start).getHours()).toBe(0);
    expect(new Date(back.end).getHours()).toBe(0);
  });

  it('counts each filter, keeps the settings out of the highlights and reads a restart', () => {
    const hass = house();
    const index = new ActivityIndex(() => hass);
    const range = dayRange(new Date(2026, 8, 17));
    const model = buildModel(DAY, index, 'highlights', '', range);
    expect(model.counts.all).toBe(8);
    expect(model.counts.highlights).toBe(7); // the bulb's power-on setting is the system's
    expect(model.counts.system).toBe(2); // the setting and Home Assistant itself
    expect(model.restarts).toBe(1);
    expect(model.automations).toBe(1);
    expect(model.filters.slice(0, 2)).toEqual(['highlights', 'all']);
    expect(model.filters).toContain('security');
    expect(model.filters).not.toContain('climate');
    expect(model.shown.some((event) => event.entity_id === 'select.bulb_power_on')).toBe(false);
  });

  it('finds by name, and a change keeps the state it came from even when the filter hides that entry', () => {
    const hass = house();
    const index = new ActivityIndex(() => hass);
    const range = dayRange(new Date(2026, 8, 17));
    const found = buildModel(DAY, index, 'all', 'KITCHEN', range);
    expect(found.shown.map((event) => event.state)).toEqual(['off', 'on']);
    const alarm = buildModel(DAY, index, 'all', 'alarm', range);
    const row = alarm.sections[0]!.rows[0]!;
    expect(row.kind === 'event' && row.item.from).toBe('disarmed');
    // by the hour, newest first, with how many entries each
    const all = buildModel(DAY, index, 'all', '', range);
    expect(all.sections.map((section) => new Date(section.start).getHours())).toEqual([
      21, 19, 18, 8, 6,
    ]);
    expect(all.density.length).toBe(96);
    expect(all.density.reduce((sum, n) => sum + n, 0)).toBe(8);
  });

  it('counts what the search finds, and keeps offering the day’s filters while it searches', () => {
    const hass = house();
    const index = new ActivityIndex(() => hass);
    const range = dayRange(new Date(2026, 8, 17));
    const found = buildModel(DAY, index, 'all', 'kitchen', range);
    expect(found.total).toBe(8);
    expect(found.counts.all).toBe(2);
    expect(found.counts.security).toBe(0);
    expect(found.filters).toContain('security');
  });
});

describe('an entry’s circle', () => {
  const states = {
    ...house().states,
    'binary_sensor.washer_vibration': {
      entity_id: 'binary_sensor.washer_vibration',
      state: 'off',
      attributes: { friendly_name: 'Washer vibration', device_class: 'vibration' },
      last_changed: '',
      last_updated: '',
    },
    'group.downstairs': {
      entity_id: 'group.downstairs',
      state: 'on',
      attributes: { friendly_name: 'Downstairs', entity_id: ['light.kitchen'] },
      last_changed: '',
      last_updated: '',
    },
  };
  const look = (event: ActivityEvent, extra: Record<string, unknown> = {}) => {
    const hass = house({ states: { ...states, ...extra } } as Partial<HomeAssistant>);
    const page = { hass, index: new ActivityIndex(() => hass) } as unknown as FluvyActivity;
    return lookOf(page, event, resolveEntity(hass, event.entity_id)).glyph;
  };

  it('draws the entity as it stood: Fluvy’s glyph, and Home Assistant’s icon for the state it had', () => {
    expect(look({ when: at(18, 30), entity_id: 'binary_sensor.front_door', state: 'on' })).toBe(
      'doorOpen',
    );
    expect(
      look({ when: at(18, 30), entity_id: 'binary_sensor.washer_vibration', state: 'on' }),
    ).toBe('ha-state:binary_sensor.washer_vibration=on');
  });

  it('draws a group as what it holds, unless it has an icon of its own', () => {
    const event = { when: at(19), entity_id: 'group.downstairs', state: 'off' };
    expect(look(event)).toBe('bulb');
    const own = {
      ...states['group.downstairs'],
      attributes: { ...states['group.downstairs'].attributes, icon: 'mdi:home-floor-0' },
    };
    expect(look(event, { 'group.downstairs': own })).toBe('mdi:home-floor-0');
  });
});

describe('the time rail', () => {
  afterEach(() => document.body.replaceChildren());

  it('is a slider: arrows step a quarter of an hour, Page keys an hour, Home and End the ends', async () => {
    await import('@fluvy/ui/time-rail');
    const rail = document.createElement('fluvy-time-rail') as FluvyTimeRail;
    const range = dayRange(new Date(2026, 8, 17));
    rail.start = range.start;
    rail.end = range.end;
    rail.value = range.start + 12 * 3_600_000;
    rail.label = 'Time of day';
    rail.formatBubble = (time) => new Date(time).toTimeString().slice(0, 5);
    document.body.append(rail);
    await rail.updateComplete;
    const scrubs: TimeRailDetail[] = [];
    rail.addEventListener('fluvy-scrub', (event) =>
      scrubs.push((event as CustomEvent<TimeRailDetail>).detail),
    );
    const key = async (name: string) => {
      rail.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
      await rail.updateComplete;
    };
    expect(rail.getAttribute('role')).toBe('slider');
    expect(rail.getAttribute('aria-valuetext')).toBe('12:00');
    await key('ArrowUp');
    expect(rail.getAttribute('aria-valuetext')).toBe('12:15');
    await key('PageDown');
    expect(rail.getAttribute('aria-valuetext')).toBe('11:15');
    await key('End');
    expect(scrubs.at(-1)).toEqual({ value: range.start, done: true, via: 'key', key: 'End' });
    await key('Home');
    expect(scrubs.at(-1)?.value).toBe(range.end);
    expect(scrubs.every((scrub) => scrub.done)).toBe(true);
  });

  it('hides, whole, what the knob would cover, and lights the part on screen along the axis', async () => {
    await import('@fluvy/ui/time-rail');
    const rail = document.createElement('fluvy-time-rail') as FluvyTimeRail;
    const range = dayRange(new Date(2026, 8, 17));
    rail.start = range.start;
    rail.end = range.end;
    rail.value = range.start + 12 * 3_600_000;
    rail.valueEnd = range.start + 9 * 3_600_000;
    document.body.append(rail);
    (rail as unknown as { height: number }).height = 600;
    await rail.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 50));
    const ticks = [...rail.shadowRoot!.querySelectorAll<SVGLineElement>('line.tick')];
    // the axis runs 22 → 578: noon's tick sits under the knob, midnight's far from it
    const at = (y: number) => ticks.find((tick) => tick.getAttribute('y1') === String(y))!;
    expect(at(300).hasAttribute('data-under')).toBe(true);
    expect(at(578).hasAttribute('data-under')).toBe(false);
    expect(at(578).classList.contains('is-on')).toBe(false);
    // lit: 12:00 down to 09:00 — the ticks between, and the span on the axis past the knob's halo
    expect(at(323).classList.contains('is-on')).toBe(true);
    const span = rail.shadowRoot!.querySelector('.span')!;
    expect(
      Number(span.getAttribute('y2')) - Number(span.getAttribute('y1')),
    ).toBeGreaterThanOrEqual(31);
  });
});

describe('the time rail’s feel', () => {
  afterEach(() => document.body.replaceChildren());

  it('touches when the knob is taken and firmly at an end, and keeps quiet when haptics are off', async () => {
    const { setHaptics } = await import('@fluvy/ui');
    await import('@fluvy/ui/time-rail');
    const rail = document.createElement('fluvy-time-rail') as FluvyTimeRail;
    const range = dayRange(new Date(2026, 8, 17));
    rail.start = range.start;
    rail.end = range.end;
    rail.value = range.start + 12 * 3_600_000;
    document.body.append(rail);
    await rail.updateComplete;
    const felt: string[] = [];
    rail.addEventListener('haptic', (event) => felt.push(String((event as CustomEvent).detail)));
    const press = (type: string, y: number) =>
      rail.dispatchEvent(
        new PointerEvent(type, {
          pointerType: 'mouse',
          button: 0,
          pointerId: 1,
          clientY: y,
          bubbles: true,
        }),
      );
    press('pointerdown', 0);
    press('pointermove', 5000);
    press('pointerup', 5000);
    expect(felt[0]).toBe('light');
    expect(felt).toContain('medium');
    felt.length = 0;
    setHaptics(false);
    press('pointerdown', 0);
    press('pointerup', 0);
    expect(felt).toEqual([]);
    setHaptics(true);
  });
});

describe('the Activity page in place of Home Assistant’s', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('style');
    document.documentElement.removeAttribute(ORIGINAL_ACTIVITY);
    document.body.replaceChildren();
  });

  it('is ours while the page wears Fluvy, and Home Assistant’s again when it does not or the house keeps it', async () => {
    const registry = customElements;
    class Logbook extends LitElement {
      static override properties = { hass: { attribute: false }, narrow: { type: Boolean } };
      declare hass: HomeAssistant | undefined;
      declare narrow: boolean;
      override render() {
        return html`<p class="stock">Home Assistant’s logbook</p>`;
      }
    }
    registry.define('ha-panel-logbook', Logbook);
    const taken = takeOverActivity(registry, document);
    expect(await taken).toBe(true);

    const panel = new Logbook();
    document.body.append(panel);
    await panel.updateComplete;
    expect(activityIsOurs()).toBe(false);
    expect(panel.shadowRoot!.querySelector('.stock')).not.toBeNull();

    // Home Assistant applies the Fluvy theme: its sentinel is on <html>
    document.documentElement.style.setProperty('--fluvy-theme', '1');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await panel.updateComplete;
    expect(activityIsOurs()).toBe(true);
    expect(panel.shadowRoot!.querySelector('fluvy-activity')).not.toBeNull();
    expect(panel.shadowRoot!.querySelector('.stock')).toBeNull();

    // the house keeps Home Assistant's page
    document.documentElement.setAttribute(ORIGINAL_ACTIVITY, '');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await panel.updateComplete;
    expect(panel.shadowRoot!.querySelector('.stock')).not.toBeNull();
  });

  it('gives Home Assistant its page back for the session when ours throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    class Page extends LitElement {
      override render() {
        return html`<p class="stock">Home Assistant’s page</p>`;
      }
    }
    customElements.define('ha-panel-test', Page);
    const view = vi.fn((): TemplateResult => {
      throw new TypeError('no view');
    });
    document.documentElement.style.setProperty('--fluvy-theme', '1');
    const load = (): Promise<unknown> => Promise.resolve();
    expect(
      await takeOverPage({ tag: 'ha-panel-test', ours: 'fluvy-test', kept: 'x', load, view }),
    ).toBe(true);
    const panel = document.body.appendChild(new Page());
    await panel.updateComplete;
    expect(panel.shadowRoot!.querySelector('.stock')).not.toBeNull();
    panel.requestUpdate();
    await panel.updateComplete;
    expect(view).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/^\[fluvy\] fluvy-test stepped aside/);
    warn.mockRestore();
  });

  it('gives Home Assistant its page back when our view’s file cannot come', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    class Page extends LitElement {
      override render() {
        return html`<p class="stock">Home Assistant’s page</p>`;
      }
    }
    customElements.define('ha-panel-offline', Page);
    const view = vi.fn((): TemplateResult => html`<p class="ours">loading</p>`);
    document.documentElement.style.setProperty('--fluvy-theme', '1');
    const load = (): Promise<unknown> => Promise.reject(new TypeError('Failed to fetch'));
    expect(
      await takeOverPage({ tag: 'ha-panel-offline', ours: 'fluvy-offline', kept: 'x', load, view }),
    ).toBe(true);
    const panel = document.body.appendChild(new Page());
    await panel.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await panel.updateComplete;
    expect(panel.shadowRoot!.querySelector('.stock')).not.toBeNull();
    expect(panel.shadowRoot!.querySelector('.ours')).toBeNull();
    expect(String(warn.mock.calls[0]?.[0])).toMatch(
      /^\[fluvy\] fluvy-offline stepped aside: TypeError/,
    );
    warn.mockRestore();
  });
});

/** Home Assistant's logbook stream: the history at once, then whatever `push` sends, live. */
function streaming(events: readonly ActivityEvent[]) {
  const asked: Record<string, unknown>[] = [];
  let live: ((message: { events: ActivityEvent[] }) => void) | undefined;
  const hass = house({
    connection: {
      subscribeMessage: async (
        callback: (message: { events: ActivityEvent[]; partial?: boolean }) => void,
        message: Record<string, unknown>,
      ) => {
        asked.push(message);
        live = callback;
        callback({ events: [...events] });
        return () => undefined;
      },
    },
    callWS: async () => ({}),
  } as unknown as Partial<HomeAssistant>);
  return { hass, asked, push: (event: ActivityEvent) => live?.({ events: [event] }) };
}

type View = HTMLElement & {
  hass: HomeAssistant;
  range: { start: number; end: number };
  updateComplete: Promise<boolean>;
};

describe('the Activity page', () => {
  afterEach(() => document.body.replaceChildren());

  async function mount(events: readonly ActivityEvent[] = DAY) {
    await import('./view.js');
    const stream = streaming(events);
    history.replaceState(null, '', '/logbook');
    const view = document.createElement('fluvy-activity') as View;
    view.hass = stream.hass;
    view.range = dayRange(new Date(2026, 8, 17));
    document.body.append(view);
    const settle = async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await view.updateComplete;
    };
    await settle();
    const root = view.shadowRoot!;
    const names = () =>
      [...root.querySelectorAll('.av-row .av-name')].map((node) => node.textContent);
    const chip = (label: string) =>
      [...root.querySelectorAll<HTMLElement>('.av-filters .fv-chip')].find((node) =>
        node.textContent?.includes(label),
      )!;
    return { ...stream, view, root, settle, names, chip };
  }

  it('reads the day by the hour, the highlights first, who did what', async () => {
    const { root, names, asked } = await mount();
    expect(asked[0]).toMatchObject({ type: 'logbook/event_stream' });
    expect(asked[0]!['entity_ids']).toBeUndefined(); // nothing narrows it: everything
    expect(root.querySelector('.av-day__summary')?.textContent).toContain('8 changes');
    expect(root.querySelector('.av-day__summary')?.textContent).toContain('1 restart');
    const hours = [...root.querySelectorAll('.av-hour')].map((node) =>
      [node.querySelector('.av-hour__time'), node.querySelector('.av-hour__count')]
        .map((part) => part?.textContent?.replace(/\s+/g, ' ').trim())
        .join(' '),
    );
    expect(hours).toEqual([
      '21:00 2 changes',
      '19:00 1 change',
      '18:00 2 changes',
      '08:00 1 change',
      '06:00 1 change',
    ]);
    expect(names()).not.toContain('bulb power on');
    const alarm = [...root.querySelectorAll<HTMLElement>('.av-row')][0]!;
    expect(
      [...alarm.querySelectorAll('.av-change .av-state')].map((node) => node.textContent),
    ).toEqual(['Disarmed', 'Armed night']);
    expect(alarm.querySelector('.av-cause')?.getAttribute('aria-label')).toBe('Night · Automation');
    const light = [...root.querySelectorAll<HTMLElement>('.av-row')].find((row) =>
      row.textContent?.includes('19:02'),
    )!;
    expect(light.querySelector('.av-cause')?.getAttribute('aria-label')).toBe('marta · Person');
  });

  it('filters, searches, and says so when nothing matches', async () => {
    const { root, names, chip, settle } = await mount();
    chip('Everything').click();
    await settle();
    // the setting reporting itself as Home Assistant came back is part of the restart
    expect(names()).toContain('Home Assistant restarted');
    expect(names()).not.toContain('bulb power on');
    chip('Security').click();
    await settle();
    expect(names()).toEqual(['house', 'front door', 'house']);
    const input = root.querySelector<HTMLInputElement>('#av-search')!;
    input.value = 'nothing like this';
    input.dispatchEvent(new InputEvent('input'));
    await settle();
    expect(root.querySelector('.fv-empty-state')?.textContent).toContain('Nothing matches');
    root.querySelector<HTMLElement>('.av-empty__action')!.click();
    await settle();
    expect(input.value).toBe('');
    expect(names().length).toBe(7);
  });

  it('unfolds a row into its detail, and folds it back', async () => {
    const { root, settle } = await mount();
    const row = root.querySelector<HTMLElement>('.av-row')!;
    row.click();
    await settle();
    expect(row.getAttribute('aria-expanded')).toBe('true');
    const facts = [...root.querySelectorAll('.av-fact dt')].map((node) => node.textContent);
    expect(facts).toEqual(['When', 'Change', 'Cause']);
    expect(
      [...root.querySelectorAll('.av-actions button')].map((node) => node.textContent?.trim()),
    ).toEqual(['More info', 'Only this', 'History']);
    row.click();
    await settle();
    // the fold animates away, then goes
    root.querySelector('.av-detail')?.dispatchEvent(new Event('animationend'));
    await settle();
    expect(root.querySelector('.av-detail')).toBeNull();
  });

  it('goes back from "Only this" to the filter and the sources it narrowed, remembering nothing', async () => {
    localStorage.clear();
    const { root, asked, settle, chip, view } = await mount();
    chip('Security').click();
    await settle();
    root.querySelector<HTMLElement>('.av-row')!.click();
    await settle();
    [...root.querySelectorAll<HTMLElement>('.av-actions button')]
      .find((button) => button.textContent?.trim() === 'Only this')!
      .click();
    await settle();
    expect(asked.at(-1)!['entity_ids']).toEqual(['alarm_control_panel.house']);
    // everything of it, and no filters for a single entity
    expect((view as unknown as { filter: string }).filter).toBe('all');
    expect(root.querySelector('.av-filters')).toBeNull();
    expect(localStorage.getItem('logbookPickedValue')).toBeNull();
    const back = root.querySelector<HTMLElement>('.av-narrowed .fv-link')!;
    expect(back.textContent?.trim()).toBe('Back');
    back.click();
    await settle();
    expect(asked.at(-1)!['entity_ids']).toBeUndefined();
    expect(chip('Security').getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.av-narrowed')).toBeNull();
  });

  it('offers no filter that would change nothing (one device’s day)', async () => {
    const { root } = await mount(
      DAY.filter((event) => event.entity_id === 'alarm_control_panel.house'),
    );
    expect(root.querySelectorAll('.av-row').length).toBe(2);
    expect(root.querySelector('.av-filters')).toBeNull();
  });

  it('narrows the day to one device from its detail (Sources, the quick way)', async () => {
    const { root, asked, settle, view } = await mount();
    const day = view.range;
    root.querySelector<HTMLElement>('.av-row')!.click();
    await settle();
    const only = [...root.querySelectorAll<HTMLElement>('.av-actions button')].find(
      (button) => button.textContent?.trim() === 'Only this',
    )!;
    only.click();
    await settle();
    expect(asked.at(-1)!['entity_ids']).toEqual(['alarm_control_panel.house']);
    expect(view.range).toEqual(day);
    expect(location.search).toContain('entity_id=alarm_control_panel.house');
    expect(root.querySelector('.av-narrowed__text')?.textContent).toContain('house');
    root.querySelector<HTMLElement>('.fv-link')!.click();
    await settle();
    expect(asked.at(-1)!['entity_ids']).toBeUndefined();
  });

  it('asks the stream for the chosen day, and only for what the sources cover', async () => {
    const { root, asked, settle, view } = await mount();
    root.querySelector<HTMLElement>('.av-day__prev')!.click();
    await settle();
    const previous = asked.at(-1)!;
    expect(new Date(String(previous['start_time'])).getDate()).toBe(16);
    expect(new Date(String(previous['end_time'])).getDate()).toBe(17);
    expect(location.search).toContain('start_date=');
    setTarget(view as unknown as FluvyActivity, {
      entity_id: ['light.kitchen'],
    });
    await settle();
    expect(asked.at(-1)!['entity_ids']).toEqual(['light.kitchen']);
    expect(location.search).toContain('entity_id=light.kitchen');
  });

  it('drops a new entry in on top, live', async () => {
    const { root, push, settle, names } = await mount();
    const fresh: ActivityEvent = {
      when: at(21, 45),
      entity_id: 'light.kitchen',
      state: 'on',
      context_user_id: 'u1',
    };
    push(fresh);
    await settle();
    expect(names()[0]).toBe('kitchen');
    const top = root.querySelector<HTMLElement>('.av-row')!;
    expect(top.classList.contains('is-fresh')).toBe(true);
    expect(eventKey(fresh)).toContain('light.kitchen');
  });
});

/** Who did each entry (1.25): a run Leo's tap fired, the Node-RED account, Marta (the one reading), a switch by hand. */
const WHO_DAY: readonly ActivityEvent[] = [
  {
    when: at(20, 10),
    entity_id: 'light.kitchen',
    state: 'on',
    context_event_type: 'script_started',
    context_domain: 'script',
    context_entity_id: 'script.movie',
    context_name: 'Movie time',
    context_user_id: 'u2',
  },
  { when: at(19, 30), entity_id: 'binary_sensor.front_door', state: 'on', context_user_id: 'u3' },
  { when: at(19, 2), entity_id: 'light.kitchen', state: 'off', context_user_id: 'u1' },
  { when: at(18, 10), entity_id: 'light.kitchen', state: 'on' },
];

describe('the Activity page, who did it (1.25)', () => {
  afterEach(() => document.body.replaceChildren());

  /** The page on `WHO_DAY`, the house showing who (or not), read by Marta (an administrator, or not). */
  async function mount(who: boolean, admin = true) {
    await import('./view.js');
    // no sources remembered from another test
    localStorage.clear();
    const asked: Record<string, unknown>[] = [];
    const hass = house({
      user: { id: 'u1', name: 'Marta', is_admin: admin },
      hassUrl: (path: string) => `https://ha.example${path}`,
      connection: {
        subscribeMessage: async (
          callback: (message: { events: ActivityEvent[] }) => void,
          message: Record<string, unknown>,
        ) => {
          asked.push(message);
          callback({ events: [...WHO_DAY] });
          return () => undefined;
        },
      },
      callWS: async (message: Record<string, unknown>) => {
        asked.push(message);
        return message['type'] === 'config/auth/list'
          ? [
              { id: 'u1', name: 'Marta', system_generated: false },
              { id: 'u2', name: 'Leo', system_generated: false },
              { id: 'u3', name: 'Node-RED', system_generated: false },
            ]
          : {};
      },
    } as unknown as Partial<HomeAssistant>);
    hass.states['person.leo'] = {
      entity_id: 'person.leo',
      state: 'home',
      attributes: {
        friendly_name: 'Leo',
        user_id: 'u2',
        entity_picture: '/api/image/serve/leo/512x512',
      },
      last_changed: '',
      last_updated: '',
    } as HomeAssistant['states'][string];
    history.replaceState(null, '', '/logbook');
    const view = document.createElement('fluvy-activity') as View & {
      who: boolean;
      person: string;
      filter: string;
    };
    view.hass = hass;
    view.who = who;
    view.range = dayRange(new Date(2026, 8, 17));
    view.filter = 'all';
    document.body.append(view);
    const settle = async () => {
      for (let i = 0; i < 3; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await view.updateComplete;
      }
    };
    await settle();
    const root = view.shadowRoot!;
    const row = (time: string) =>
      [...root.querySelectorAll<HTMLElement>('.av-row')].find((node) =>
        node.querySelector('.av-time')?.textContent?.includes(time),
      )!;
    // each fact's label and what it says (a face's letters are its picture's, unspoken)
    const facts = () =>
      [...root.querySelectorAll('.av-fact')].map((fact) => [
        fact.querySelector('dt')?.textContent,
        (fact.querySelector('.av-link-row__text') ?? fact.querySelector('dd'))?.textContent
          ?.replace(/\s+/g, ' ')
          .trim(),
      ]);
    /** Every fold animates away, then goes. */
    const folded = async () => {
      await settle();
      root
        .querySelectorAll('.av-detail.is-closing')
        .forEach((detail) => detail.dispatchEvent(new Event('animationend')));
      await settle();
    };
    return { view, root, asked, settle, row, facts, folded };
  }

  it('names who did each entry: a run’s person after its name, someone’s own face and name, nobody invented', async () => {
    const { row, asked } = await mount(true);
    expect(asked.filter((message) => message['type'] === 'config/auth/list').length).toBe(1);
    const run = row('20:10').querySelector('.av-cause')!;
    expect(run.getAttribute('aria-label')).toBe('Movie time · Script · By Leo');
    expect(run.querySelector('.av-face img')?.getAttribute('src')).toBe(
      'https://ha.example/api/image/serve/leo/512x512',
    );
    // an account no person stands for (an administrator reads its name), its initial on the card's fill
    const account = row('19:30').querySelector('.av-cause')!;
    expect(account.getAttribute('aria-label')).toBe('Node-RED · Account');
    expect(account.querySelector('.av-face')?.textContent?.trim()).toBe('N');
    expect(account.querySelector('.av-face')?.classList.contains('is-person')).toBe(false);
    // the one reading is "You", their initial on the accent (no picture), in place of the person glyph
    const own = row('19:02').querySelector('.av-cause')!;
    expect(own.getAttribute('aria-label')).toBe('You');
    expect(own.querySelector('svg')).toBeNull();
    expect(own.querySelector('.av-face.is-person')?.textContent?.trim()).toBe('M');
    // a switch pressed by hand carries no user: nobody
    expect(row('18:10').querySelector('.av-cause')).toBeNull();
  });

  it('changes nothing while the house does not show who (the default)', async () => {
    const { row, root, asked } = await mount(false);
    expect(asked.some((message) => message['type'] === 'config/auth/list')).toBe(false);
    expect(root.querySelector('.av-face')).toBeNull();
    expect(root.querySelector('.av-person')).toBeNull();
    expect(row('20:10').querySelector('.av-cause')?.getAttribute('aria-label')).toBe(
      'Movie time · Script',
    );
    expect(row('19:02').querySelector('.av-cause')?.getAttribute('aria-label')).toBe(
      'marta · Person',
    );
    expect(row('19:30').querySelector('.av-cause')).toBeNull();
  });

  it('names no account to someone who is not an administrator, and asks for none', async () => {
    const { row, asked } = await mount(true, false);
    expect(asked.some((message) => message['type'] === 'config/auth/list')).toBe(false);
    expect(row('19:30').querySelector('.av-cause')).toBeNull();
    expect(row('19:02').querySelector('.av-cause')?.getAttribute('aria-label')).toBe('You');
  });

  it('says who after the cause in a run’s detail, a way to their details; a person’s own cause wears their face', async () => {
    const { view, row, facts, settle, folded, root } = await mount(true);
    row('20:10').click();
    await settle();
    expect(facts().map(([label]) => label)).toEqual(['When', 'Change', 'Cause', 'Who']);
    expect(facts().at(-1)).toEqual(['Who', 'Leo· Person']);
    const opened: string[] = [];
    view.addEventListener('hass-more-info', (event) =>
      opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
    );
    root.querySelector<HTMLElement>('.av-fact:last-child button.av-link-row')!.click();
    expect(opened).toEqual(['person.leo']);
    row('20:10').click();
    row('19:02').click();
    await folded();
    // the cause names Marta already: no Who, the cause is her, with her face
    expect(facts().map(([label]) => label)).toEqual(['When', 'Change', 'Cause']);
    expect(facts().at(-1)).toEqual(['Cause', 'You']);
    expect(root.querySelector('.av-fact .av-face.is-person')).not.toBeNull();
    // an account: only named
    row('19:02').click();
    row('19:30').click();
    await folded();
    expect(facts().at(-1)).toEqual(['Who', 'Node-RED· Account']);
    expect(root.querySelector('.av-fact .av-link-row.is-plain')).not.toBeNull();
  });

  it('finds by who did it and narrows to one of them; "Show everything" lets go', async () => {
    const { view, root, settle } = await mount(true);
    const shown = () =>
      [...root.querySelectorAll('.av-row .av-time')].map((node) => node.textContent?.trim());
    const search = async (text: string) => {
      const input = root.querySelector<HTMLInputElement>('#av-search')!;
      input.value = text;
      input.dispatchEvent(new InputEvent('input'));
      await settle();
    };
    await search('leo');
    expect(shown()).toEqual(['20:10']);
    await search('you');
    expect(shown()).toEqual(['19:02']);
    await search('');
    // By person: the one reading first, then the busiest
    const menu = root.querySelector('.av-person + fluvy-select') as HTMLElement & {
      options: { value: string; label: string }[];
    };
    expect(root.querySelector('.av-person')?.getAttribute('aria-label')).toBe('By person');
    expect(menu.options.map((option) => option.label)).toEqual([
      'Everyone',
      'You',
      'Leo',
      'Node-RED',
    ]);
    menu.dispatchEvent(new CustomEvent('fluvy-change', { detail: { value: 'u2' } }));
    await settle();
    expect(view.person).toBe('u2');
    expect(shown()).toEqual(['20:10']);
    expect(root.querySelector('.av-person')?.getAttribute('aria-label')).toBe('By person · Leo');
    expect(root.querySelector('.av-person .av-face img')).not.toBeNull();
    // someone with nothing in the period: nothing matches, and the way out shows everything again
    view.person = 'u9';
    await settle();
    root.querySelector<HTMLElement>('.av-empty__action')!.click();
    await settle();
    expect(view.person).toBe('');
    expect(shown().length).toBe(4);
  });

  it('writes who did each entry into the CSV, only while the house shows who', async () => {
    const { download } = await import('./csv.js');
    const files: Promise<string>[] = [];
    const create = URL.createObjectURL;
    URL.createObjectURL = (blob: Blob) => (files.push(blob.text()), 'blob:fluvy');
    try {
      for (const who of [true, false]) {
        const { view } = await mount(who);
        download(view as unknown as FluvyActivity);
        document.body.replaceChildren();
      }
    } finally {
      URL.createObjectURL = create;
    }
    const [on, off] = (await Promise.all(files)).map((file) =>
      file.split('\n').map((line) => line.split(',')),
    );
    expect(on![0]!.at(-1)).toBe('who');
    expect(on!.slice(1).map((line) => line.at(-1))).toEqual(['Leo', 'Node-RED', 'marta', '']);
    expect(off![0]!.at(-1)).toBe('context_source');
  });
});

/** A long day: six entries an hour, ten minutes apart, over four things (no bursts, no repeats). */
function longDay(): ActivityEvent[] {
  const things = ['light.kitchen', 'binary_sensor.front_door', 'person.marta', 'light.kitchen'];
  const events: ActivityEvent[] = [];
  for (let hour = 23; hour >= 0; hour -= 1)
    for (let minute = 50; minute >= 0; minute -= 10) {
      const n = hour * 6 + minute / 10;
      const entity_id = things[n % 4]!;
      const state = entity_id.startsWith('person')
        ? n % 8 < 4
          ? 'home'
          : 'not_home'
        : n % 2
          ? 'on'
          : 'off';
      events.push({ when: at(hour, minute), entity_id, state });
    }
  return events;
}

/**
 * A browser's layout, as far as the scroll ↔ time map sees it: the list under 300 px of day and tools, a row 72 tall
 * (not the 64 an hour off screen is estimated with), an hour laid out once it has come within half a screen of it
 * (Chrome's margin for content-visibility) or was asked to be, the foot's room under the oldest hour — and each hour's
 * header sticky, as in the page: pinned at the top of the scroll while its hour passes under it.
 */
function layOut(root: ShadowRoot, rowHeight = 72, viewport = 800) {
  const scroller = root.querySelector<HTMLElement>('.av-scroll')!;
  const seen = new Set<Element>();
  const boxes = new Map<Element, { top: number; height: number }>();
  const sectionOf = new Map<Element, Element>();
  let scroll = 0;
  let bottom = 0;
  let oldest = 0;
  const relayout = (): void => {
    boxes.clear();
    let y = 300;
    for (const section of root.querySelectorAll<HTMLElement>('.av-section')) {
      const rows = [...section.querySelectorAll<HTMLElement>('.av-row')];
      const estimate = Number(/auto (\d+)px/.exec(section.getAttribute('style') ?? '')![1]);
      if (
        section.style.contentVisibility === 'visible' ||
        (y < scroll + 1.5 * viewport && y + estimate > scroll - viewport / 2)
      )
        seen.add(section);
      const laid = seen.has(section);
      section.toggleAttribute('data-skipped', !laid);
      const pitch = laid ? rowHeight : (estimate - 40) / rows.length;
      boxes.set(section, { top: y, height: laid ? 40 + rows.length * rowHeight : estimate });
      const header = section.querySelector('.av-hour')!;
      boxes.set(header, { top: y, height: 40 });
      sectionOf.set(header, section);
      rows.forEach((row, k) => boxes.set(row, { top: y + 40 + k * pitch, height: pitch }));
      oldest = y;
      y += boxes.get(section)!.height;
    }
    bottom = y + 40 + 64;
  };
  const height = (): number => Math.max(bottom, oldest + viewport);
  Object.defineProperties(scroller, {
    clientHeight: { get: () => viewport, configurable: true },
    scrollHeight: {
      get: () => {
        relayout();
        return height();
      },
      configurable: true,
    },
    scrollTop: {
      get: () => scroll,
      set: (value: number) => {
        scroll = value;
        relayout();
        scroll = Math.max(0, Math.min(height() - viewport, value));
        relayout();
      },
      configurable: true,
    },
    getBoundingClientRect: {
      value: () => ({ top: 56, bottom: 56 + viewport, left: 0, right: 700, height: viewport }),
      configurable: true,
    },
  });
  relayout();
  for (const node of boxes.keys())
    Object.defineProperty(node, 'getBoundingClientRect', {
      value: () => {
        relayout();
        const box = boxes.get(node) ?? { top: 0, height: 0 };
        let top = 56 + box.top - scroll;
        // sticky: a header pinned at the top of the scroll while its hour is under it
        const section = sectionOf.get(node);
        if (section) {
          const hour = boxes.get(section)!;
          top = Math.min(Math.max(top, 56), 56 + hour.top + hour.height - scroll - box.height);
        }
        return { top, bottom: top + box.height, left: 0, right: 700, height: box.height };
      },
      configurable: true,
    });
  return {
    scroller,
    /** Where a row stands under the top of the scroll. */
    offset: (t: number) =>
      root.querySelector<HTMLElement>(`.av-row[data-t="${t}"]`)!.getBoundingClientRect().top - 56,
    max: () => height() - viewport,
    /** The rows as laid out, newest first: their moment and where they stand in the flow. */
    rows: () =>
      [...root.querySelectorAll<HTMLElement>('.av-row[data-t]')].map((row) => ({
        t: Number(row.dataset['t']),
        top: boxes.get(row)!.top,
      })),
  };
}

describe('the Activity page’s scroll ↔ time map', () => {
  afterEach(async () => {
    const { setMotionPreference } = await import('@fluvy/ui');
    setMotionPreference('system');
    document.body.replaceChildren();
  });

  async function scrollable(rowHeight = 72) {
    const { setMotionPreference } = await import('@fluvy/ui');
    setMotionPreference('reduced');
    await import('./view.js');
    const events = longDay();
    const stream = streaming(events);
    history.replaceState(null, '', '/logbook');
    const view = document.createElement('fluvy-activity') as View;
    view.hass = stream.hass;
    view.range = dayRange(new Date(2026, 8, 17));
    document.body.append(view);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await view.updateComplete;
    const root = view.shadowRoot!;
    const layout = layOut(root, rowHeight);
    (view as unknown as { anchors: unknown }).anchors = undefined;
    const rail = root.querySelector('fluvy-time-rail') as FluvyTimeRail;
    const scrub = (detail: TimeRailDetail) =>
      rail.dispatchEvent(new CustomEvent('fluvy-scrub', { detail, bubbles: true, composed: true }));
    return { view, root, rail, scrub, layout, events };
  }

  it('lands a tap far down on its row, however tall the hours it passes turn out to be', async () => {
    const { rail, scrub, layout } = await scrollable();
    const target = at(3, 20) * 1000;
    scrub({ value: target + 4 * 60_000, done: true, via: 'pointer' });
    expect(layout.offset(target)).toBe(40);
    expect(rail.value).toBe(target);
  });

  it('follows a drag to the row at or before the moment, and settles it on release', async () => {
    const { rail, scrub, layout } = await scrollable();
    const target = at(9, 40) * 1000;
    scrub({ value: target + 60_000, done: false, via: 'pointer' });
    scrub({ value: target + 60_000, done: true, via: 'pointer' });
    expect(layout.offset(target)).toBe(40);
    expect(rail.value).toBe(target);
  });

  it('agrees with the screen on the way up: the knob between the row under the header and the one above it', async () => {
    const { view, rail, scrub, layout } = await scrollable();
    scrub({ value: view.range.start, done: true, via: 'key', key: 'End' });
    const internal = view as unknown as { anchors: unknown; sync(): void };
    // from just above the end of the scroll (which is, by design, the start of the day) to the top
    for (let s = layout.max() - 150; s > 0; s -= 150) {
      layout.scroller.scrollTop = s;
      internal.anchors = undefined; // rebuilt mid-scroll, as a render or an hour laid out does
      internal.sync();
      // the row right under the pinned header, and the one above it (partly under the header)
      const rows = layout.rows();
      const under = rows.findIndex((row) => row.top >= layout.scroller.scrollTop + 40 - 1);
      if (under < 1) continue;
      expect(rail.value).toBeLessThanOrEqual(rows[under - 1]!.t);
      expect(rail.value).toBeGreaterThanOrEqual(rows[under]!.t);
    }
  });

  it('keeps the list under the knob while it is dragged back up', async () => {
    const { view, scrub, layout } = await scrollable(64);
    scrub({ value: view.range.start, done: true, via: 'key', key: 'End' });
    for (const hour of [2, 5, 9, 13, 18, 22]) {
      const value = at(hour, 25) * 1000;
      scrub({ value, done: false, via: 'pointer' });
      // the row at or before the moment sits under the pinned header while the finger moves
      expect(layout.offset(at(hour, 20) * 1000)).toBe(40);
    }
  });

  it('ends on the oldest hour: End pins the oldest row, and the scroll’s end is the start of the day', async () => {
    const { view, rail, scrub, layout } = await scrollable();
    scrub({ value: view.range.start, done: true, via: 'key', key: 'End' });
    expect(layout.scroller.scrollTop).toBe(layout.max());
    expect(rail.value).toBe(at(0, 0) * 1000);
    // the oldest hour's header is pinned at the top, its rows under it (the page never ends blank)
    expect(layout.offset(at(0, 50) * 1000)).toBe(40);
    const timeAtScroll = (s: number): number => timeAt(view as unknown as FluvyActivity, s);
    (view as unknown as { anchors: unknown }).anchors = undefined;
    expect(timeAtScroll(layout.max())).toBe(view.range.start);
  });
});
