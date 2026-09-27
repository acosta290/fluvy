// @vitest-environment happy-dom
import { html, LitElement } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { ORIGINAL_ACTIVITY, type HomeAssistant } from '@fluvy/core';
import { eventKey, type ActivityEvent } from '@fluvy/core/activity';
import type { FluvyTimeRail, TimeRailDetail } from '@fluvy/ui/time-rail';
import { ActivityIndex, buildModel, dayRange, shiftRange } from './model.js';
import { timeAt } from './rail.js';
import { setTarget } from './sources.js';
import { activityIsOurs, takeOverActivity } from './takeover.js';
import type { FluvyActivity } from './view.js';

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
