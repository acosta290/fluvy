// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import {
  readDevice,
  SettingsStore,
  type EffectiveSettings,
  type HomeAssistant,
  type LookHandle,
  type SettingsHass,
} from '@fluvy/core';
import { DEMO_ENERGY_SOURCES, DEMO_EXTRAS, DEMO_ROOMS, demoHass } from '@fluvy/demo-home';
// Home Assistant's form, as a test's page stands it in: a card's options are edited in it
import { cardForm } from '../../shared/fixtures/editor.js';
import type { FluvyRowsEditor } from '../../shared/rows-editor.js';
import type { FluvyPanel } from '../panel.js';

type Config = { strategy?: Record<string, unknown>; views?: unknown[] };

/**
 * The demo home with Fluvy's settings in memory and one automatic dashboard (`fluvy-auto`, the home template's): what
 * its configuration says, and every one written.
 */
function fixture(
  admin: boolean,
  strategy: Record<string, unknown>,
  sources: readonly Record<string, unknown>[],
) {
  const data: Record<string, unknown> = { system: null, user: null };
  const layer = (type: string) => (type.includes('system') ? 'system' : 'user');
  const storage = {
    connection: {
      subscribeMessage: async (
        callback: (m: { value: unknown }) => void,
        message: { type: string },
      ) => {
        callback({ value: data[layer(message.type)] });
        return () => undefined;
      },
    },
    callWS: async (message: { type: string; value: unknown }) => {
      data[layer(message.type)] = message.value;
    },
  } as unknown as SettingsHass;
  const store = new SettingsStore(() => storage, undefined);
  const listeners = new Set<(settings: EffectiveSettings) => void>();
  const handle: LookHandle = {
    store,
    settings: () => store.effective,
    preview: () => undefined,
    onChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    settled: () => Promise.resolve(),
    setWall: () => undefined,
    wearDevice: () => void readDevice(),
    stop: () => undefined,
  };
  store.start((settings) => listeners.forEach((listener) => listener(settings)));
  const demo = demoHass({ more: [...DEMO_EXTRAS, ...DEMO_ROOMS], sources });
  const saved: { config: Config } = { config: { strategy } };
  const written: Config[] = [];
  const hass = {
    ...demo,
    states: Object.fromEntries(
      Object.entries(demo.states).map(([entity_id, state]) => [
        entity_id,
        { entity_id, ...state, last_changed: '', last_updated: '' },
      ]),
    ),
    locale: { language: 'en' },
    themes: { darkMode: false },
    user: { id: 'u', name: 'U', is_admin: admin },
    config: { unit_system: { temperature: '°C', length: 'km' }, time_zone: 'Europe/Madrid' },
    callService: async () => undefined,
    panels: {
      'fluvy-auto': {
        component_name: 'lovelace',
        url_path: 'fluvy-auto',
        title: 'Fluvy auto',
        icon: 'fluvy:sun',
      },
    },
    localize: (key: string) => key,
    callWS: async (message: { type: string; url_path?: string | null; config?: Config }) => {
      if (message.type === 'lovelace/config') return saved.config;
      if (message.type === 'lovelace/config/save' && message.config) {
        written.push(message.config);
        saved.config = message.config;
        return undefined;
      }
      if (message.type === 'lovelace/dashboards/list')
        return [
          { id: 'fluvy_auto', url_path: 'fluvy-auto', title: 'Fluvy auto', show_in_sidebar: true },
        ];
      return demo.callWS(message);
    },
    formatEntityState: (s: { state: string }) => s.state,
  } as unknown as HomeAssistant;
  return { handle, hass, written };
}

const HOME = { type: 'custom:fluvy-home' };

async function mount(
  admin = true,
  strategy: Record<string, unknown> = HOME,
  sources: readonly Record<string, unknown>[] = DEMO_ENERGY_SOURCES,
) {
  await import('../define.js');
  const f = fixture(admin, strategy, sources);
  const panel = document.createElement('fluvy-panel') as FluvyPanel;
  panel.handle = f.handle;
  panel.hass = f.hass;
  panel.tab = 'dashboard';
  document.body.append(panel);
  const root = panel.shadowRoot!;
  /** Lets what was asked for land (the dashboards, Customise's file, the dashboard as it is read) and be drawn. */
  const settle = async (rounds = 6) => {
    for (let round = 0; round < rounds; round++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await panel.updateComplete;
    }
  };
  await settle();
  const row = (title: string) =>
    [...root.querySelectorAll<HTMLElement>('.fv-row')].find(
      (r) => r.querySelector('.fv-row__title')?.textContent?.trim() === title,
    );
  const part = (id: string) => root.querySelector<HTMLElement>(`.cz-part[data-part="${id}"]`);
  const parts = () =>
    [...root.querySelectorAll<HTMLElement>('.cz-part')].map((p) => p.dataset['part']);
  /** A part's row unfolded, as a tap on it does. */
  const unfold = async (id: string) => {
    part(id)!.querySelector<HTMLElement>(':scope > .fv-row')!.click();
    await settle(2);
    return part(id)!;
  };
  /** A button of an open row, by what it says to a reader. */
  const act = async (within: Element, label: string) => {
    [...within.querySelectorAll<HTMLButtonElement>('.fv-action')]
      .find((button) => button.getAttribute('aria-label') === label)!
      .click();
    await settle(2);
  };
  const flip = async (within: Element) => {
    within.querySelector<HTMLElement>('.fv-hit')!.click();
    await settle(2);
  };
  /** What the apply bar says ('' when nothing waits: a bar on its way out keeps its last words). */
  const bar = () =>
    root.querySelector('.pn-foot:not(.is-leaving) .pn-bar__text')?.textContent?.trim() ?? '';
  const press = async (text: string) => {
    [...root.querySelectorAll<HTMLButtonElement>('.pn-bar button')]
      .find((button) => button.textContent?.trim() === text)!
      .click();
    await settle();
  };
  const edit = () =>
    (panel.strategyEdits['fluvy-auto']?.['edit'] ?? undefined) as
      Record<string, Record<string, Record<string, unknown>>> | undefined;
  /** Waits for what a file fetched later draws (Customise's own, a card's editor). */
  const until = async (found: () => unknown) => {
    for (let tries = 0; tries < 400 && !found(); tries++) await settle(1);
  };
  /** Opens Customise on the dashboard, as a tap on its row does. */
  const open = async () => {
    row('Customise')!.click();
    await until(() => root.querySelector('.cz-part'));
  };
  return {
    ...f,
    panel,
    root,
    settle,
    until,
    row,
    part,
    parts,
    unfold,
    act,
    flip,
    bar,
    press,
    edit,
    open,
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('Customise (#170)', () => {
  it('opens from a dashboard’s card and lists its views and the open view’s cards', async () => {
    const { root, row, open, parts } = await mount();
    expect(row('Customise')?.querySelector('.fv-row__sub')?.textContent?.trim()).toBe(
      'Hide, move and tune its views and cards',
    );
    expect(root.querySelector('.cz-top')).toBeNull();
    await open();
    expect(root.querySelector('.cz-top')).not.toBeNull();
    const chips = [...root.querySelectorAll('.cz-top .fv-chip')].map((c) => c.textContent?.trim());
    expect(chips.slice(0, 3)).toEqual(['Home', 'Rooms', 'Lights']);
    expect(chips).toEqual(expect.arrayContaining(['Kitchen', 'Bedroom']));
    expect(parts().slice(0, 3)).toEqual(['home/attention', 'home/lights', 'home/appliances']);
    // a part the house has nothing for takes no row
    expect(parts()).toContain('home/vacuum');
    expect(parts()).not.toContain('home/pets');
    // each row says what it is under its name, a list how much of it shows
    const text = (id: string, cls: string) =>
      root.querySelector(`.cz-part[data-part="${id}"] .${cls}`)?.textContent?.trim();
    expect(text('home/lights', 'fv-row__title')).toBe('Lights');
    expect(text('home/lights', 'fv-row__sub')).toMatch(/^\d+ of \d+ shown$/);
    expect(text('home/clock', 'fv-row__title')).toBe('Clock');
    expect(text('home/thermostat', 'fv-row__sub')).toBe('Thermostat');
  });

  it('is an administrator’s: anyone else reads why, and has no way in', async () => {
    const { panel, root, row, settle } = await mount(false);
    const customise = row('Customise')!;
    expect(customise.querySelector('.fv-row__sub')?.textContent?.trim()).toBe(
      'An administrator can hide, move and tune its views and cards',
    );
    expect(customise.classList.contains('fv-row--tap')).toBe(false);
    panel.customise('fluvy-auto');
    await settle(40);
    expect(root.querySelector('.cz-top')).toBeNull();
    expect(row('Customise')).toBeDefined();
    // nor does a link to it: Customise's file is never fetched for them
    panel.route = { prefix: '/fluvy', path: '/dashboard/fluvy-auto' };
    await settle(40);
    expect(root.querySelector('.cz-top')).toBeNull();
    expect(
      (panel as unknown as { customiserLoading?: Promise<void> }).customiserLoading,
    ).toBeUndefined();
  });

  it('hides a card and saves the strategy with the edit laid over what was saved', async () => {
    const before = {
      views: { 'room-gone': { hidden: true } },
      cards: { 'rooms/room:gone': { order: 0 }, 'home/flow': { hidden: true } },
      entities: { 'home/lights': { drop: ['light.nowhere'] } },
    };
    const m = await mount(true, { ...HOME, tile_size: 'compact', edit: before });
    expect(m.row('Customise')?.querySelector('.fv-row__sub')?.textContent?.trim()).toBe(
      'Customised: some of it is yours',
    );
    await m.open();
    expect(m.bar()).toBe('');
    // what was hidden before reads so, and shows again with its switch
    expect(m.part('home/flow')?.classList.contains('is-off')).toBe(true);
    await m.flip(m.part('home/clock')!);
    expect(m.bar()).toBe('Fluvy auto · Customise');
    await m.flip(m.part('home/weather')!);
    await m.flip(m.part('home/flow')!);
    expect(m.bar()).toBe('3 changes');
    await m.press('Save');
    expect(m.written).toEqual([
      {
        strategy: {
          type: 'custom:fluvy-home',
          tile_size: 'compact',
          edit: {
            // what the house no longer has is kept as it was
            views: before.views,
            cards: {
              'rooms/room:gone': { order: 0 },
              'home/clock': { hidden: true },
              'home/weather': { hidden: true },
            },
            entities: before.entities,
          },
        },
      },
    ]);
    expect(m.bar()).toBe('');
    expect(m.part('home/clock')?.classList.contains('is-off')).toBe(true);
  });

  it('discards what was not saved, and a change made back is none', async () => {
    const m = await mount();
    await m.open();
    await m.flip(m.part('home/clock')!);
    await m.flip(m.part('home/clock')!);
    expect(m.bar()).toBe('');
    await m.flip(m.part('home/clock')!);
    await m.press('Discard');
    expect(m.edit()).toBeUndefined();
    expect(m.part('home/clock')?.classList.contains('is-off')).toBe(false);
    expect(m.written).toEqual([]);
  });

  it('moves a card with one place, and puts it back with none', async () => {
    const m = await mount();
    await m.open();
    const order = m.parts();
    const [first, second, third] = order as [string, string, string];
    const row = await m.unfold(third);
    await m.act(row, 'Move up');
    expect(m.parts().slice(0, 3)).toEqual([first, third, second]);
    expect(Object.keys(m.edit()!['cards']!)).toHaveLength(1);
    await m.act(m.part(third)!, 'Move down');
    expect(m.parts()).toEqual(order);
    expect(m.edit()).toBeUndefined();
    // the first cannot go up, the last cannot go down
    const top = await m.unfold(first);
    const up = [...top.querySelectorAll<HTMLButtonElement>('.fv-action')].find(
      (b) => b.getAttribute('aria-label') === 'Move up',
    )!;
    expect(up.disabled).toBe(true);
  });

  it('puts a card at the top or the bottom with one press, kept as one place (#188)', async () => {
    const m = await mount();
    await m.open();
    const order = m.parts() as string[];
    const scenes = 'home/scenes';
    // the scenes close the Home view as the house lays it out: fifteen presses of "up" before
    expect(order.indexOf(scenes)).toBeGreaterThan(8);
    const disabled = (label: string): boolean =>
      [...m.part(scenes)!.querySelectorAll<HTMLButtonElement>('.fv-action')].find(
        (button) => button.getAttribute('aria-label') === label,
      )!.disabled;
    await m.act(await m.unfold(scenes), 'Move to the top');
    expect(m.parts()).toEqual([scenes, ...order.filter((id) => id !== scenes)]);
    expect(m.edit()).toEqual({ cards: { [scenes]: { order: 0 } } });
    expect([disabled('Move to the top'), disabled('Move up')]).toEqual([true, true]);
    expect([disabled('Move down'), disabled('Move to the bottom')]).toEqual([false, false]);
    await m.act(m.part(scenes)!, 'Move to the bottom');
    expect(m.parts().at(-1)).toBe(scenes);
    expect(m.edit()).toEqual({ cards: { [scenes]: { order: -1 } } });
    expect([disabled('Move down'), disabled('Move to the bottom')]).toEqual([true, true]);
  });

  it('reorders the cards, a list’s entities and the tabs where a row is dropped (#188)', async () => {
    const m = await mount();
    await m.open();
    /** A row dropped on another place of its list, as Home Assistant's sorting says it. */
    const drop = async (list: Element, oldIndex: number, newIndex: number) => {
      expect(list.parentElement!.localName).toBe('ha-sortable');
      list.parentElement!.dispatchEvent(
        new CustomEvent('item-moved', { detail: { oldIndex, newIndex }, bubbles: true }),
      );
      await m.settle(2);
    };
    const order = m.parts() as string[];
    const [first, second, third, fourth] = order as [string, string, string, string];
    // every row is held by a handle before its circle
    expect(m.part(first)!.querySelector(':scope > .fv-row > .cz-grip')).not.toBeNull();
    await drop(m.root.querySelector('.cz-parts')!, 3, 1);
    expect(m.parts().slice(0, 4)).toEqual([first, fourth, second, third]);
    expect(m.edit()).toEqual({ cards: { [fourth]: { order: 1 } } });
    // dropped back where the house reads it, nothing is kept
    await drop(m.root.querySelector('.cz-parts')!, 1, 3);
    expect(m.parts()).toEqual(order);
    expect(m.edit()).toBeUndefined();

    // a list's entities: the one dropped first is the only one its order names
    const lights = await m.unfold('home/lights');
    const items = () =>
      [...m.part('home/lights')!.querySelectorAll<HTMLElement>('.cz-item')].map(
        (item) => item.dataset['item'],
      );
    const before = items() as string[];
    // one left out waits at the list's foot, where nothing is dragged: it has no handle
    await m.flip(lights.querySelector(`.cz-item[data-item="${before[0]}"]`)!);
    const left = m.part('home/lights')!.querySelector(`.cz-item[data-item="${before[0]}"]`)!;
    expect(left.classList.contains('is-fixed')).toBe(true);
    expect(left.querySelector('.cz-grip')).toBeNull();
    await drop(m.part('home/lights')!.querySelector('.cz-items')!, 2, 0);
    expect(items().slice(0, 3)).toEqual([before[3], before[1], before[2]]);
    expect(m.edit()!['entities']).toEqual({
      'home/lights': { drop: [before[0]], order: [before[3]] },
    });
    // a drop inside the list never reaches the cards' own
    expect(m.edit()!['cards']).toBeUndefined();

    // the tabs unfold under the open view's place among them, each with its handle and its switch
    m.row('Place among the tabs')!.click();
    await m.settle(2);
    const tabs = () =>
      [...m.root.querySelectorAll<HTMLElement>('.cz-place .cz-item')].map(
        (tab) => tab.dataset['view'],
      );
    expect(tabs().slice(0, 3)).toEqual(['home', 'rooms', 'lights']);
    await drop(m.root.querySelector('.cz-place .cz-items')!, 2, 0);
    expect(tabs().slice(0, 3)).toEqual(['lights', 'home', 'rooms']);
    expect(m.edit()!['views']).toEqual({ lights: { order: 0 } });
    expect(m.root.querySelector('.cz-top .fv-chip')?.textContent?.trim()).toBe('Lights');
    // the view that was open stays open, though another now leads the tabs
    expect(m.root.querySelector('.cz-view .fv-card__title')?.textContent?.trim()).toBe('Home');
    expect(m.parts()[0]).toMatch(/^home\//);
    // the first view the house draws always stays: it has no switch, the others have
    const tab = (id: string) => m.root.querySelector(`.cz-place .cz-item[data-view="${id}"]`)!;
    expect(tab('home').querySelector('.fv-hit')).toBeNull();
    await m.flip(tab('rooms'));
    expect(m.edit()!['views']).toEqual({ lights: { order: 0 }, rooms: { hidden: true } });
    expect(tab('rooms').classList.contains('is-off')).toBe(true);
  });

  it('searches a view of many cards, and moves the one found among them all (#188)', async () => {
    const m = await mount();
    await m.open();
    const order = m.parts() as string[];
    const field = () => m.root.querySelector<HTMLInputElement>('.cz-view .cz-search input');
    const type = async (query: string) => {
      field()!.value = query;
      field()!.dispatchEvent(new Event('input'));
      await m.settle(2);
    };
    // sixteen rows on Home: more than a phone holds on one screen
    expect(order.length).toBeGreaterThan(8);
    expect(field()).not.toBeNull();
    await type('sce');
    expect(m.parts()).toEqual(['home/scenes']);
    // by what a card is as well as by its name, whatever the letters' case
    await type('THERMO');
    expect(m.parts()).toEqual(['home/thermostat']);
    await type('no such card');
    expect(m.parts()).toEqual([]);
    expect(m.root.querySelector('.cz-view .fv-empty-state')?.textContent).toContain(
      'Nothing matches',
    );
    // found, a card goes to the top of the whole view in one press: its buttons count every card
    await type('sce');
    await m.act(await m.unfold('home/scenes'), 'Move to the top');
    expect(m.edit()).toEqual({ cards: { 'home/scenes': { order: 0 } } });
    await type('');
    expect(m.parts()).toEqual(['home/scenes', ...order.filter((id) => id !== 'home/scenes')]);
    // dragged among the rows found, it lands beside the one it was dropped on
    await type('s');
    const found = m.parts() as string[];
    expect(found.length).toBeGreaterThan(2);
    expect(found.length).toBeLessThan(order.length);
    m.root
      .querySelector('.cz-parts')!
      .parentElement!.dispatchEvent(
        new CustomEvent('item-moved', { detail: { oldIndex: 0, newIndex: 1 }, bubbles: true }),
      );
    await m.settle(2);
    expect(m.parts().slice(0, 2)).toEqual([found[1], 'home/scenes']);
    await type('');
    const all = m.parts() as string[];
    expect(all.indexOf('home/scenes')).toBe(all.indexOf(found[1] as string) + 1);
    // a view of a few cards has no field: the Climate view's five
    [...m.root.querySelectorAll<HTMLElement>('.cz-top .fv-chip')]
      .find((chip) => chip.textContent?.trim() === 'Climate')!
      .click();
    await m.settle(2);
    expect(m.parts().length).toBeLessThanOrEqual(8);
    expect(field()).toBeNull();
  });

  it('thins out a list, adds to it what it takes and orders it', async () => {
    const m = await mount();
    await m.open();
    const lights = await m.unfold('home/lights');
    const items = () =>
      [...m.part('home/lights')!.querySelectorAll<HTMLElement>('.cz-item')].map(
        (item) => item.dataset['item'],
      );
    const [first, second] = items() as [string, string];
    await m.flip(lights.querySelector(`.cz-item[data-item="${first}"]`)!);
    expect(m.edit()!['entities']).toEqual({ 'home/lights': { drop: [first] } });
    // one left out waits at the list's foot, switched off; back on, the list is the house's again
    expect(items().at(-1)).toBe(first);
    await m.flip(m.part('home/lights')!.querySelector(`.cz-item[data-item="${first}"]`)!);
    expect(m.edit()).toBeUndefined();
    // Home Assistant's picker hands an entity over: a switch fits the lights' tiles, a camera does not
    const pick = async (value: string) => {
      m.part('home/lights')!
        .querySelector('ha-selector.cz-add')!
        .dispatchEvent(new CustomEvent('value-changed', { detail: { value } }));
      await m.settle(2);
    };
    await pick('camera.front_door');
    expect(m.edit()).toBeUndefined();
    await pick('switch.washing_machine_outlet');
    expect(m.edit()!['entities']).toEqual({
      'home/lights': { add: ['switch.washing_machine_outlet'] },
    });
    expect(items().at(-1)).toBe('switch.washing_machine_outlet');
    // an entity's own row unfolds its buttons: moved up, the list names only what was put first
    m.part('home/lights')!
      .querySelector<HTMLElement>(`.cz-item[data-item="${second}"] .fv-row`)!
      .click();
    await m.settle(2);
    await m.act(
      m.part('home/lights')!.querySelector(`.cz-item[data-item="${second}"]`)!,
      'Move up',
    );
    expect(items().slice(0, 2)).toEqual([second, first]);
    expect(m.edit()!['entities']!['home/lights']).toEqual({
      add: ['switch.washing_machine_outlet'],
      order: [second],
    });
    // one the person added is taken back with its switch
    await m.flip(
      m.part('home/lights')!.querySelector('.cz-item[data-item="switch.washing_machine_outlet"]')!,
    );
    expect(m.edit()!['entities']!['home/lights']).toEqual({ order: [second] });
  });

  it('edits a card’s options in its own form, keeping only what was changed', async () => {
    const m = await mount();
    await m.open();
    const clock = await m.unfold('home/clock');
    await m.act(clock, 'Options');
    await m.until(() => m.root.querySelector('dialog.cz-dialog fluvy-rows-editor'));
    const sheet = m.root.querySelector('dialog.cz-dialog')!;
    expect(sheet.querySelector('.fv-card__title')?.textContent?.trim()).toBe('Clock');
    const editor = sheet.querySelector('fluvy-rows-editor') as FluvyRowsEditor;
    await m.until(() => editor.shadowRoot?.querySelector('ha-form'));
    // the form holds the card as the house builds it
    expect(cardForm(editor).data['face']).toBe('digital');
    cardForm(editor).change('face', 'analog');
    await m.settle(2);
    expect(m.edit()!['cards']).toEqual({ 'home/clock': { options: { face: 'analog' } } });
    expect(m.part('home/clock')?.classList.contains('is-edited')).toBe(true);
    // a second change is laid beside the first
    await editor.updateComplete;
    cardForm(editor).change('show_week', true);
    await m.settle(2);
    expect(m.edit()!['cards']).toEqual({
      'home/clock': { options: { face: 'analog', show_week: true } },
    });
    // back to what the house draws, it is no option
    await editor.updateComplete;
    cardForm(editor).change('face', 'digital');
    await m.settle(2);
    await editor.updateComplete;
    cardForm(editor).change('show_week', false);
    await m.settle(2);
    expect(m.edit()).toBeUndefined();
  });

  it('asks before it resets a card, a view and the whole dashboard', async () => {
    const m = await mount(true, {
      ...HOME,
      edit: {
        views: { climate: { hidden: true } },
        cards: { 'home/clock': { hidden: true }, 'home/flow': { order: 0 } },
        entities: { 'home/lights': { drop: ['switch.patio_light'] } },
      },
    });
    await m.open();
    const lights = await m.unfold('home/lights');
    await m.act(lights, 'Reset');
    // the first tap arms it and says what the second does
    expect(m.edit()).toBeUndefined();
    expect(m.part('home/lights')!.querySelector('.cz-armed')?.textContent).toContain(
      'Tap again to draw this card as the house does',
    );
    await m.act(m.part('home/lights')!, 'Reset');
    expect(m.edit()).toEqual({
      views: { climate: { hidden: true } },
      cards: { 'home/clock': { hidden: true }, 'home/flow': { order: 0 } },
    });
    // the view: every card of it, the other views' kept
    m.row('This view')!.click();
    await m.settle(2);
    expect(m.row('Tap again')).toBeDefined();
    m.row('Tap again')!.click();
    await m.settle(2);
    expect(m.edit()).toEqual({ views: { climate: { hidden: true } } });
    // the dashboard: nothing left of the edit, which leaves its configuration
    m.row('The whole dashboard')!.click();
    await m.settle(2);
    m.row('Tap again')!.click();
    await m.settle(2);
    expect(m.panel.strategyEdits['fluvy-auto']).toEqual({ edit: undefined });
    await m.press('Save');
    expect(m.written).toEqual([{ strategy: { type: 'custom:fluvy-home' } }]);
    expect(m.row('The whole dashboard')).toBeUndefined();
  });

  it('hides a view and places it among the tabs, the first always shown', async () => {
    const m = await mount();
    await m.open();
    expect(m.row('Show this view')?.querySelector('.fv-row__value')?.textContent?.trim()).toBe(
      'Always',
    );
    const chip = (text: string) =>
      [...m.root.querySelectorAll<HTMLElement>('.cz-top .fv-chip')].find(
        (c) => c.textContent?.trim() === text,
      )!;
    chip('Lights').click();
    await m.settle(2);
    expect(m.parts()[0]).toMatch(/^lights\/lights:/);
    await m.flip(m.row('Show this view')!);
    expect(m.edit()).toEqual({ views: { lights: { hidden: true } } });
    await m.flip(m.row('Show this view')!);
    const step = async (label: string) => {
      m.root.querySelector<HTMLButtonElement>(`.cz-steps [aria-label="${label}"]`)!.click();
      await m.settle(2);
    };
    await step('Earlier');
    await step('Earlier');
    // first among the tabs: its chip leads them, with one place
    expect(m.edit()).toEqual({ views: { lights: { order: 0 } } });
    expect(m.root.querySelector('.cz-top .fv-chip')?.textContent?.trim()).toBe('Lights');
    await step('Later');
    await step('Later');
    expect(m.edit()).toBeUndefined();
  });

  /** The sheet "Add a card" opens, and what is tapped and read in it. */
  const adding = async (m: Awaited<ReturnType<typeof mount>>) => {
    m.row('Add a card')!.click();
    await m.settle(2);
    const sheet = () => m.root.querySelector<HTMLElement>('dialog.cz-dialog .cz-sheet');
    const texts = (selector: string) =>
      [...(sheet()?.querySelectorAll(selector) ?? [])].map((node) => node.textContent?.trim());
    const tap = async (selector: string, text: string) => {
      [...sheet()!.querySelectorAll<HTMLElement>(selector)]
        .find((node) => node.textContent?.trim() === text)!
        .click();
      await m.settle(2);
    };
    return {
      sheet,
      /** The ways as chips, the open one first told. */
      ways: () => texts('.fv-chip'),
      way: (name: string) => tap('.fv-chip', name),
      /** The rows offered, by their titles; the views they are listed under. */
      rows: () => texts('.fv-row__title'),
      groups: () => texts('.cz-label'),
      /** A tap on a row, by its title (the first of that name). */
      row: (title: string) => tap('.fv-row__title', title),
      button: (text: string) =>
        [...sheet()!.querySelectorAll<HTMLButtonElement>('.fv-btn')].find(
          (button) => button.textContent?.trim() === text,
        )!,
      search: async (query: string) => {
        const input = sheet()!.querySelector<HTMLInputElement>('.cz-search input')!;
        input.value = query;
        input.dispatchEvent(new Event('input'));
        await m.settle(2);
      },
      /** The sheet has left the page. */
      closed: () => m.until(() => !sheet()),
    };
  };

  it('adds a card of the person’s own to a view as YAML, and takes it out again', async () => {
    const m = await mount();
    await m.open();
    const a = await adding(m);
    // three ways in, the dashboard's own cards first
    expect(a.ways()).toEqual(['This dashboard', 'Fluvy’s cards', 'YAML']);
    await a.way('YAML');
    const yaml = () => a.sheet()!.querySelector('ha-selector.cz-yaml')!;
    // nothing to add until the YAML names a card's type
    expect(a.button('Add').disabled).toBe(true);
    const note = { type: 'markdown', content: 'Bins on Tuesday' };
    yaml().dispatchEvent(new CustomEvent('value-changed', { detail: { value: note } }));
    await m.settle(2);
    a.button('Add').click();
    await a.closed();
    expect(m.edit()).toEqual({ views: { home: { add: [note] } } });
    expect(m.parts().at(-1)).toBe('home/own:0');
    // a card of Home Assistant's own has no form of ours: its row has no Options, its YAML stands under its buttons
    const own = await m.unfold('home/own:0');
    expect(
      [...own.querySelectorAll('.fv-action')].map((button) => button.getAttribute('aria-label')),
    ).toEqual(['Move to the top', 'Move up', 'Move down', 'Move to the bottom', 'Remove']);
    expect(own.querySelector('ha-selector.cz-yaml')).not.toBeNull();
    await m.act(own, 'Remove');
    expect(m.edit()).toBeUndefined();
    // the sheet opens again on the way that was last taken
    const again = await adding(m);
    expect(again.sheet()!.querySelector('ha-selector.cz-yaml')).not.toBeNull();
  });

  it('shows a card of another view on a view as well, or moves it there, and takes it away again (#188)', async () => {
    const m = await mount();
    await m.open();
    const a = await adding(m);
    // the cards of every other view and page, under their views: never this view's own, never a heading
    expect(a.groups().slice(0, 2)).toEqual(['Rooms', 'Lights']);
    expect(a.groups()).toEqual(expect.arrayContaining(['Kitchen', 'Bedroom']));
    expect(a.groups()).not.toContain('Home');
    expect(a.rows()).not.toContain('Ground floor');
    expect([a.button('Show here too').disabled, a.button('Move here').disabled]).toEqual([
      true,
      true,
    ]);
    // what is typed narrows them, by a view's name or a card's, whatever its accents
    await a.search('KÍTCH');
    expect(a.groups()).toEqual(['Rooms', 'Lights', 'Kitchen']);
    expect(a.rows().slice(0, 2)).toEqual(['Kitchen', 'Kitchen']);
    await a.search('nothing like it');
    expect(a.rows()).toEqual([]);
    expect(a.sheet()!.querySelector('.fv-empty-state')?.textContent).toContain('Nothing matches');
    await a.search('kitchen');
    // the room's card, picked by its row: its switch says so, and the buttons can act
    await a.row('Kitchen');
    expect(a.sheet()!.querySelector('.fv-switch')?.getAttribute('aria-checked')).toBe('true');
    a.button('Show here too').click();
    await a.closed();
    const taken = 'home/also:rooms/room:kitchen';
    expect(m.edit()).toEqual({ views: { home: { also: ['rooms/room:kitchen'] } } });
    expect(m.parts().at(-1)).toBe(taken);
    const text = (id: string, cls: string) =>
      m.root.querySelector(`.cz-part[data-part="${id}"] .${cls}`)?.textContent?.trim();
    // its row says what it is and where it comes from, and is taken away, never hidden
    expect([text(taken, 'fv-row__title'), text(taken, 'fv-row__sub')]).toEqual([
      'Kitchen',
      'From Rooms',
    ]);
    expect(m.part(taken)!.querySelector('.fv-hit')).toBeNull();
    const row = await m.unfold(taken);
    expect(
      [...row.querySelectorAll('.fv-action')].map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Move to the top',
      'Move up',
      'Move down',
      'Move to the bottom',
      'Options',
      'Remove',
    ]);
    await m.act(row, 'Move to the top');
    expect(m.parts()[0]).toBe(taken);
    expect(m.edit()!['cards']).toEqual({ [taken]: { order: 0 } });
    // its options here are its own: a name on this view, the room's card on the Rooms view as it was
    await m.act(m.part(taken)!, 'Options');
    await m.until(() => m.root.querySelector('dialog.cz-dialog fluvy-rows-editor'));
    const editor = m.root.querySelector('dialog.cz-dialog fluvy-rows-editor') as FluvyRowsEditor;
    await m.until(() => editor.shadowRoot?.querySelector('ha-form'));
    expect(cardForm(editor).data['area']).toBe('kitchen');
    cardForm(editor).change('name', 'Cook here');
    await m.settle(2);
    expect(m.edit()!['cards']).toEqual({ [taken]: { order: 0, options: { name: 'Cook here' } } });
    expect(text(taken, 'fv-row__sub')).toBe('Edited · From Rooms');
    // the sheet's Reset takes them away again, its place stays
    [...m.root.querySelectorAll<HTMLButtonElement>('dialog.cz-dialog .cz-pair .fv-btn')]
      .find((button) => button.textContent?.trim() === 'Reset')!
      .click();
    await m.settle(2);
    expect(m.edit()!['cards']).toEqual({ [taken]: { order: 0 } });
    [...m.root.querySelectorAll<HTMLButtonElement>('dialog.cz-dialog .cz-pair .fv-btn')]
      .find((button) => button.textContent?.trim() === 'Done')!
      .click();
    await m.until(() => !m.root.querySelector('dialog.cz-dialog'));
    // offered once: what is shown here is not offered again
    const b = await adding(m);
    await b.search('kitchen');
    expect(b.groups()).toEqual(['Lights', 'Kitchen']);
    // moved: shown here, hidden where it was
    await b.row('Kitchen');
    b.button('Move here').click();
    await b.closed();
    expect(m.edit()).toEqual({
      views: { home: { also: ['rooms/room:kitchen', 'lights/lights:kitchen'] } },
      cards: { [taken]: { order: 0 }, 'lights/lights:kitchen': { hidden: true } },
    });
    // taken away, each leaves nothing behind: the one that was moved goes back to its view
    await m.act(await m.unfold('home/also:lights/lights:kitchen'), 'Remove');
    await m.act(await m.unfold(taken), 'Remove');
    expect(m.edit()).toBeUndefined();
  });

  it('makes one of Fluvy’s cards in its own form, drawn as it will be, and adds it once the card takes it (#188)', async () => {
    const m = await mount();
    await m.open();
    const a = await adding(m);
    await a.way('Fluvy’s cards');
    // Fluvy's cards as the card picker names them, without Fluvy's mark; nobody else's
    expect(a.rows().slice(0, 3)).toEqual(['Tile', 'Tiles', 'Light']);
    await a.search('dimmer');
    expect(a.rows()).toEqual(['Light']);
    await a.row('Light');
    await m.until(() => a.sheet()!.querySelector('fluvy-rows-editor'));
    expect(a.sheet()!.querySelector('.fv-card__title')?.textContent?.trim()).toBe('Light');
    expect(a.sheet()!.querySelector('.fv-card__sub')?.textContent?.trim()).toBe('Add a card');
    const editor = a.sheet()!.querySelector('fluvy-rows-editor') as FluvyRowsEditor;
    await m.until(() => editor.shadowRoot?.querySelector('ha-form'));
    // the form opens on what the card suggests for this house, and the card is drawn over it
    const entity = cardForm(editor).data['entity'] as string;
    expect(entity).toMatch(/^light\./);
    expect(a.sheet()!.querySelector('.cz-sheet__card fluvy-light-card')).not.toBeNull();
    // a config the card refuses: its own words in the card's place, and nothing to add
    cardForm(editor).change('entity', '');
    await m.settle(2);
    expect(a.sheet()!.querySelector('.cz-sheet__card')).toBeNull();
    expect(a.sheet()!.querySelector('.cz-armed')?.textContent).toContain('"entity" is required');
    expect(a.button('Add').disabled).toBe(true);
    await editor.updateComplete;
    cardForm(editor).change('entity', entity);
    await m.settle(2);
    await editor.updateComplete;
    cardForm(editor).change('name', 'Reading lamp');
    await m.settle(2);
    // nothing is the dashboard's until it is added
    expect(m.edit()).toBeUndefined();
    a.button('Add').click();
    await a.closed();
    const card = { type: 'custom:fluvy-light-card', entity, name: 'Reading lamp' };
    expect(m.edit()).toEqual({ views: { home: { add: [card] } } });
    expect(m.parts().at(-1)).toBe('home/own:0');
    // one of Fluvy's is tuned in its form afterwards too: what the form says is the card
    await m.act(await m.unfold('home/own:0'), 'Options');
    await m.until(() => m.root.querySelector('dialog.cz-dialog fluvy-rows-editor'));
    const form = m.root.querySelector('dialog.cz-dialog fluvy-rows-editor') as FluvyRowsEditor;
    await m.until(() => form.shadowRoot?.querySelector('ha-form'));
    cardForm(form).change('name', 'Sofa');
    await m.settle(2);
    expect(m.edit()).toEqual({ views: { home: { add: [{ ...card, name: 'Sofa' }] } } });
  });

  it('lists what the Energy dashboard charts and forecasts, each by its card’s own words', async () => {
    // the Energy dashboard links a forecast to the array: tomorrow's production has a card
    const sources = DEMO_ENERGY_SOURCES.map((source) =>
      source['type'] === 'solar'
        ? { ...source, config_entry_solar_forecast: ['forecast'] }
        : source,
    );
    const m = await mount(true, { type: 'custom:fluvy-energy' }, sources);
    await m.open();
    const chip = (text: string) =>
      [...m.root.querySelectorAll<HTMLElement>('.cz-top .fv-chip')].find(
        (c) => c.textContent?.trim() === text,
      )!;
    const text = (id: string, cls: string) =>
      m.root.querySelector(`.cz-part[data-part="${id}"] .${cls}`)?.textContent?.trim();
    chip('Today').click();
    await m.settle(2);
    expect(m.parts()).toEqual([
      'today/period',
      'today/day_flow',
      'today/sankey',
      'today/score',
      'today/day_balance',
      'today/usage',
      'today/usage_water',
      'today/usage_gas',
    ]);
    expect(
      ['period', 'usage', 'usage_water', 'usage_gas'].map((id) =>
        text(`today/${id}`, 'fv-row__title'),
      ),
    ).toEqual(['Period', 'Energy usage', 'Water usage', 'Gas usage']);
    await m.flip(m.part('today/usage_water')!);
    expect(m.edit()).toEqual({ cards: { 'today/usage_water': { hidden: true } } });
    expect(text('today/usage_water', 'fv-row__sub')).toBe('Hidden');
    // the electricity's row is not marked by its neighbour's edit: no id is the head of another's
    expect(text('today/usage', 'fv-row__sub') ?? '').toBe('');
    await m.flip(m.part('today/usage_water')!);
    expect(m.edit()).toBeUndefined();

    chip('Production').click();
    await m.settle(2);
    expect(m.parts().slice(0, 3)).toEqual([
      'production/production',
      'production/tomorrow',
      'production/history',
    ]);
    // today's and tomorrow's read the same meter: what each is stands under its name
    expect(text('production/tomorrow', 'fv-row__title')).toBe(
      text('production/production', 'fv-row__title'),
    );
    expect(text('production/production', 'fv-row__sub')).toBe('Production');
    expect(text('production/tomorrow', 'fv-row__sub')).toBe('Tomorrow · forecast');
    await m.flip(m.part('production/tomorrow')!);
    expect(m.edit()).toEqual({ cards: { 'production/tomorrow': { hidden: true } } });
    expect(text('production/production', 'fv-row__sub')).toBe('Production');
  });

  it('offers the week ahead hidden, and keeps only that a person shows it (#190)', async () => {
    // the array's forecast is Solcast's (its device says so): it holds a week
    const sources = DEMO_ENERGY_SOURCES.map((source) =>
      source['type'] === 'solar' ? { ...source, config_entry_solar_forecast: ['solcast'] } : source,
    );
    const m = await mount(true, { type: 'custom:fluvy-energy' }, sources);
    Object.assign(m.hass.devices ?? {}, {
      solcast: {
        id: 'solcast',
        config_entries: ['solcast'],
        identifiers: [['solcast_solar', 'x']],
      },
    });
    await m.open();
    [...m.root.querySelectorAll<HTMLElement>('.cz-top .fv-chip')]
      .find((c) => c.textContent?.trim() === 'Production')!
      .click();
    await m.settle(2);
    const text = (cls: string) =>
      m.root.querySelector(`.cz-part[data-part="production/ahead"] .${cls}`)?.textContent?.trim();
    const shown = () => m.root.querySelector('.cz-view .fv-card__sub')?.textContent?.trim();
    expect(m.parts().slice(0, 4)).toEqual([
      'production/production',
      'production/tomorrow',
      'production/history',
      'production/ahead',
    ]);
    // a row like any hidden one: what it is, that it is hidden, its switch off; nothing written
    expect(text('fv-row__sub')).toBe('Hidden · Next days · forecast');
    expect(m.part('production/ahead')!.classList.contains('is-off')).toBe(true);
    const count = shown();
    expect(m.edit()).toBeUndefined();
    await m.flip(m.part('production/ahead')!);
    expect(m.edit()).toEqual({ cards: { 'production/ahead': { hidden: false } } });
    expect(text('fv-row__sub')).toBe('Edited · Next days · forecast');
    expect(shown()).not.toBe(count);
    // hidden again, the edit is gone: the dashboard is the house's again
    await m.flip(m.part('production/ahead')!);
    expect(m.edit()).toBeUndefined();
    expect(shown()).toBe(count);
  });

  it('opens on the dashboard its address names', async () => {
    const m = await mount();
    m.panel.route = { prefix: '/fluvy', path: '/dashboard/fluvy-auto' };
    await m.until(() => m.root.querySelector('.cz-part'));
    expect(m.root.querySelector('.cz-top')).not.toBeNull();
    m.root.querySelector<HTMLButtonElement>('.cz-top .fv-round')!.click();
    await m.settle(2);
    expect(m.root.querySelector('.cz-top')).toBeNull();
    expect(m.row('Customise')).toBeDefined();
  });
});
