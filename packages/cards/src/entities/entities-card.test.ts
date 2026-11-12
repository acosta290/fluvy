// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HeadFit } from '../energy/head.js';
import { drawEditor, type FormStub } from '../shared/fixtures/editor.js';
import { FluvyEntitiesCard, type EntitiesCardConfig } from './entities-card.js';

if (!customElements.get('fluvy-entities-card'))
  customElements.define('fluvy-entities-card', FluvyEntitiesCard);

const hass = {
  states: {
    'lock.front_door': {
      entity_id: 'lock.front_door',
      state: 'locked',
      attributes: { friendly_name: 'Front door' },
      last_changed: '',
      last_updated: '',
    },
  },
  entities: {},
  devices: {},
  areas: {},
  language: 'en',
  locale: { language: 'en' },
  config: { unit_system: { temperature: '°C' } },
} as unknown as HomeAssistant;

async function mount(
  config: Omit<EntitiesCardConfig, 'type'>,
  house: HomeAssistant = hass,
): Promise<ShadowRoot> {
  const card = document.createElement('fluvy-entities-card') as FluvyEntitiesCard;
  card.setConfig({ type: 'custom:fluvy-entities-card', ...config });
  card.hass = house;
  document.body.append(card);
  await card.updateComplete;
  return card.shadowRoot as ShadowRoot;
}

describe('the entities card’s "N more" row (#78)', () => {
  it('ends the rows with the house’s fold row, how many more, the chevron to where they are', async () => {
    const root = await mount({
      title: 'Security',
      rows: ['lock.front_door'],
      more: 4,
      more_path: '/fluvy-auto/home-security',
    });
    const rows = root.querySelectorAll('.fv-row');
    expect(rows.length).toBe(2);
    const more = rows[1] as HTMLElement;
    expect(more.querySelector('.fv-row__title')?.textContent).toBe('4 more');
    expect(more.querySelector('.fv-row__chevron')).not.toBeNull();
    expect(more.getAttribute('role')).toBe('button');
  });

  it('is a card of its own with the row alone, its height counted with the row', async () => {
    const root = await mount({ more: 9, more_path: '/fluvy-auto/climate-humidity' });
    expect(root.querySelector('.fv-empty')).toBeNull();
    expect(root.querySelectorAll('.fv-row').length).toBe(1);
    const alone = { type: 'custom:fluvy-entities-card', more: 9, more_path: '/x' };
    expect(FluvyEntitiesCard.layoutHeight(alone)).toBe(24 + 60);
    expect(FluvyEntitiesCard.layoutHeight({ ...alone, title: 'Security', rows: ['lock.a'] })).toBe(
      92 + 2 * 60,
    );
    // without where to go, there is no row
    expect(
      FluvyEntitiesCard.layoutHeight({ ...alone, more_path: '', title: 'T', rows: ['lock.a'] }),
    ).toBe(92 + 60);
  });
});

/*
 * #96: a select's row ends in its value, which opens Fluvy's dropdown (the helpers card's), offering the row's options
 * in its order and words and choosing with `select_option`; a row with a tap of its own keeps it.
 */
describe('a select’s row', () => {
  afterEach(() => document.body.replaceChildren());

  const OVEN = Array.from({ length: 30 }, (_, i) => `mode_${i + 1}`);
  const state = (entity_id: string, value: string, options: readonly string[]): HassEntity =>
    ({
      entity_id,
      state: value,
      attributes: { friendly_name: entity_id.split('.')[1], options },
      last_changed: '',
      last_updated: '',
    }) as unknown as HassEntity;
  const house = () => {
    const callService = vi.fn(() => Promise.resolve());
    const states = {
      'select.oven': state('select.oven', 'mode_3', OVEN),
      'input_select.zone': state('input_select.zone', 'Kitchen', ['Kitchen', 'Office', 'Attic']),
      'select.ghost': state('select.ghost', 'unavailable', ['grill', 'steam']),
    };
    return {
      callService,
      hass: {
        ...hass,
        states,
        callService,
        formatEntityState: (s: HassEntity, value = s.state) => value.replace('mode_', 'Mode '),
      } as unknown as HomeAssistant,
    };
  };
  type Menu = HTMLElement & { options: readonly { value: string; label: string }[]; value: string };
  const parts = (root: ShadowRoot, index = 0) => {
    const row = root.querySelectorAll<HTMLElement>('.fv-row')[index]!;
    const button = row.querySelector<HTMLButtonElement>('.in-value');
    return { row, button, menu: button?.nextElementSibling as Menu | null | undefined };
  };

  it('ends in its value, which opens the dropdown, for a select and an input_select alike', async () => {
    const { hass: house_ } = house();
    const root = await mount({ rows: ['select.oven', 'input_select.zone'] }, house_);
    for (const [index, value] of [
      [0, 'Mode 3'],
      [1, 'Kitchen'],
    ] as const) {
      const { row, button, menu } = parts(root, index);
      expect(button?.getAttribute('aria-haspopup')).toBe('listbox');
      expect(button?.querySelector('.in-value__text')?.textContent).toBe(value);
      expect(button?.querySelector('svg')).not.toBeNull();
      expect(menu?.localName).toBe('fluvy-select');
      expect(menu?.hasAttribute('anchored')).toBe(true);
      // the value is the row's button: the row is none of its own
      expect(row.getAttribute('role')).toBeNull();
    }
    expect(parts(root).menu?.options).toHaveLength(30);
  });

  it('chooses with its own domain’s select_option, the value said at once', async () => {
    const { hass: house_, callService } = house();
    const root = await mount({ rows: ['select.oven', 'input_select.zone'] }, house_);
    const card = root.host as FluvyEntitiesCard;
    parts(root).menu!.dispatchEvent(
      new CustomEvent('fluvy-change', { detail: { value: 'mode_9' } }),
    );
    parts(root, 1).menu!.dispatchEvent(
      new CustomEvent('fluvy-change', { detail: { value: 'Attic' } }),
    );
    expect(callService.mock.calls).toEqual([
      ['select', 'select_option', { option: 'mode_9' }, { entity_id: 'select.oven' }],
      ['input_select', 'select_option', { option: 'Attic' }, { entity_id: 'input_select.zone' }],
    ]);
    await card.updateComplete;
    expect(parts(root).button?.textContent?.trim()).toBe('Mode 9');
    expect(parts(root, 1).button?.textContent?.trim()).toBe('Attic');
    // the option already chosen sends nothing
    parts(root).menu!.dispatchEvent(
      new CustomEvent('fluvy-change', { detail: { value: 'mode_9' } }),
    );
    expect(callService).toHaveBeenCalledTimes(2);
  });

  it('offers the row’s own options in its order, in its words', async () => {
    const { hass: house_ } = house();
    const root = await mount(
      {
        rows: [
          {
            entity: 'select.oven',
            options: ['mode_9', 'mode_3', 'nope'],
            labels: { mode_3: 'Fan oven' },
          },
        ],
      },
      house_,
    );
    const { button, menu } = parts(root);
    expect(button?.textContent?.trim()).toBe('Fan oven');
    expect(menu?.options).toEqual([
      { value: 'mode_9', label: 'Mode 9' },
      { value: 'mode_3', label: 'Fan oven' },
    ]);
    expect(menu?.value).toBe('mode_3');
  });

  it('keeps a tap of its own: its value in its words, the row its button', async () => {
    const { hass: house_ } = house();
    const root = await mount(
      {
        rows: [
          {
            entity: 'select.oven',
            labels: { mode_3: 'Fan oven' },
            tap_action: { action: 'more-info' },
          },
        ],
      },
      house_,
    );
    const { row, button } = parts(root);
    expect(button).toBeNull();
    expect(root.querySelector('fluvy-select')).toBeNull();
    expect(row.querySelector('.fv-row__value')?.textContent?.trim()).toBe('Fan oven');
    expect(row.getAttribute('role')).toBe('button');
    const opened: string[] = [];
    root.host.addEventListener('hass-more-info', (event) =>
      opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
    );
    row.click();
    expect(opened).toEqual(['select.oven']);
  });

  it('out of reach, says "—" on a button that does nothing, opens its details from the row, keeps its rows of 60', async () => {
    const { hass: house_ } = house();
    const root = await mount({ title: 'Oven', rows: ['select.ghost', 'select.oven'] }, house_);
    const { row, button, menu } = parts(root);
    expect(row.classList.contains('is-unavailable')).toBe(true);
    expect(button?.textContent?.trim()).toBe('—');
    expect(button?.disabled).toBe(true);
    // the list, not fetched yet, says it too
    expect(menu?.hasAttribute('disabled')).toBe(true);
    // its details, as before it had a dropdown; a row that can be read is no button of its own
    const opened: string[] = [];
    root.host.addEventListener('hass-more-info', (event) =>
      opened.push((event as CustomEvent<{ entityId: string }>).detail.entityId),
    );
    row.click();
    expect(opened).toEqual(['select.ghost']);
    expect(parts(root, 1).row.getAttribute('role')).toBeNull();
    const config = { type: 'custom:fluvy-entities-card', title: 'Oven' };
    expect(
      FluvyEntitiesCard.layoutHeight({ ...config, rows: ['select.ghost', 'select.oven'] }),
    ).toBe(FluvyEntitiesCard.layoutHeight({ ...config, rows: ['switch.a', 'switch.b'] }));
  });

  it('shows a select’s row its options and their words in the editor, its words alone beside a tap of its own', async () => {
    const { hass: house_ } = house();
    const editor = await FluvyEntitiesCard.getConfigElement();
    Object.assign(editor, { hass: { ...house_, localize: (key: string) => key } });
    const drawn = await drawEditor(editor, {
      type: 'custom:fluvy-entities-card',
      rows: [
        'select.oven',
        { entity: 'input_select.zone', tap_action: { action: 'more-info' } },
        'switch.a',
      ],
    });
    const forms = [...drawn.shadowRoot!.querySelectorAll<FormStub>('.item ha-form')];
    const names = (form: FormStub | undefined): string[] =>
      (form?.schema ?? [])
        .flatMap((item) => (item.schema ? item.schema : [item]))
        .map((item) => item.name);
    const [oven, zone, plain] = forms.map(names);
    expect(oven).toEqual(expect.arrayContaining(['options', 'labels']));
    expect(zone).toContain('labels');
    expect(zone).not.toContain('options');
    expect(plain).not.toContain('options');
    expect(plain).not.toContain('labels');
    const options = forms[0]?.schema.find((item) => item.name === 'options')?.selector?.[
      'select'
    ] as {
      options: { value: string; label: string }[];
    };
    expect(options.options.slice(0, 2)).toEqual([
      { value: 'mode_1', label: 'Mode 1' },
      { value: 'mode_2', label: 'Mode 2' },
    ]);
  });
});

describe('a list in parts, and rows on a condition (#157)', () => {
  const state = (entity_id: string, value: string, name: string, attributes = {}) => ({
    [entity_id]: {
      entity_id,
      state: value,
      attributes: { friendly_name: name, ...attributes },
      last_changed: '',
      last_updated: '',
    },
  });
  const kitchen = (washer = 'off'): HomeAssistant =>
    ({
      ...hass,
      states: {
        ...hass.states,
        ...state('switch.light', 'on', 'Kitchen light'),
        ...state('switch.washer', washer, 'Washing machine'),
        ...state('switch.pump', 'unavailable', 'Garden pump'),
        ...state('binary_sensor.motion', 'off', 'Hall motion', { device_class: 'motion' }),
      },
    }) as HomeAssistant;
  /** What the list draws, in its order: a label as its words, a hairline alone as `-`, a row as its name. */
  const drawn = (root: ShadowRoot): string[] =>
    [...root.querySelectorAll('.fv-rows > *')].map((node) =>
      node.classList.contains('fv-divider')
        ? '-'
        : (node
            .querySelector('.fv-label, .fv-row__title, .fv-empty-state__text')
            ?.textContent?.trim() ?? ''),
    );
  const badge = (root: ShadowRoot): string =>
    root.querySelector('.fv-badge')?.textContent?.trim() ?? '';
  const height = (config: Omit<EntitiesCardConfig, 'type'>): number =>
    FluvyEntitiesCard.layoutHeight({ type: 'custom:fluvy-entities-card', ...config });
  const ROWS = [
    { type: 'section', label: 'Switches' },
    'switch.light',
    { entity: 'switch.washer', show_when: { state: 'on' } },
    { entity: 'switch.pump', show_when: { state_not: 'unavailable' } },
    { type: 'section', label: 'Sensors', line: true },
    { entity: 'binary_sensor.motion', show_when: { state: 'on' } },
    { type: 'divider' },
    'lock.front_door',
  ] as const;

  it('draws what Home Assistant’s entities card writes: a section’s label and a divider among the rows', async () => {
    const root = await mount(
      {
        title: 'Kitchen',
        entities: [
          { type: 'section', label: 'Switches' },
          'switch.light',
          'switch.washer',
          { type: 'divider' },
          'lock.front_door',
        ],
      },
      kitchen(),
    );
    expect(drawn(root)).toEqual([
      'Switches',
      'Kitchen light',
      'Washing machine',
      '-',
      'Front door',
    ]);
    expect(root.querySelector('.fv-divider')?.getAttribute('role')).toBe('separator');
  });

  it('shows a row only while its condition holds, a section only with a row under it, a divider only between rows', async () => {
    const root = await mount({ title: 'Kitchen', show_count: true, rows: ROWS }, kitchen());
    // the washer is off, the pump out of reach, nothing moves: the light under its label, then the door; the
    // Sensors label has no row to stand over, and the divider no label to stand under
    expect(drawn(root)).toEqual(['Switches', 'Kitchen light', '-', 'Front door']);
    // the head counts the rows that show
    expect(badge(root)).toBe('1 on');
    const card = root.host as FluvyEntitiesCard;
    card.hass = kitchen('on');
    await card.updateComplete;
    expect(drawn(root)).toEqual([
      'Switches',
      'Kitchen light',
      'Washing machine',
      '-',
      'Front door',
    ]);
    expect(badge(root)).toBe('2 on');
  });

  it('is its empty panel with no row showing, in its own words, and steps aside where asked', async () => {
    const config = {
      title: 'Kitchen',
      show_count: true,
      rows: ['switch.light', 'switch.washer'],
      show_rows_when: { state: 'unavailable' },
    };
    const root = await mount({ ...config, empty_text: 'All answering' }, kitchen());
    expect(drawn(root)).toEqual(['All answering']);
    expect(badge(root)).toBe('');
    const hidden = await mount({ ...config, hide_empty: true }, kitchen());
    expect((hidden.host as FluvyEntitiesCard).hidden).toBe(true);
  });

  it('declares every row and the sections between them, the first label taking the rows’ 8 too', () => {
    const rows = ['switch.light', 'switch.washer'];
    const plain = height({ title: 'Kitchen', rows });
    expect(height({ title: 'Kitchen', rows: [{ section: 'A' }, ...rows] })).toBe(plain + 28);
    expect(
      height({ title: 'Kitchen', rows: ['switch.light', { section: 'B' }, 'switch.washer'] }),
    ).toBe(plain + 28);
    expect(
      height({ title: 'Kitchen', rows: ['switch.light', { type: 'divider' }, 'switch.washer'] }),
    ).toBe(plain + 16);
    // with no head, and under auto-entities' key
    expect(height({ entities: [{ section: 'A' }, ...rows] })).toBe(height({ entities: rows }) + 28);
    // whatever a condition says now
    expect(height({ title: 'Kitchen', rows, show_rows_when: { state: 'never' } })).toBe(plain);
  });

  it('watches what its conditions read', async () => {
    const root = await mount(
      {
        rows: [
          { entity: 'switch.light', show_when: { entity: 'input_boolean.guests', state: 'on' } },
        ],
        show_rows_when: { entity: 'sensor.sun', above: 0 },
      },
      kitchen(),
    );
    const watched = (root.host as unknown as { watched(): readonly string[] }).watched();
    expect(watched).toEqual(
      expect.arrayContaining(['switch.light', 'input_boolean.guests', 'sensor.sun']),
    );
  });
});

/*
 * A row in a column too narrow for all it says: what ends it is never cut and never leaves it, its line is said
 * shorter or left out, and its name alone ends in an ellipsis, never cut to nothing. Decided by measure: here every
 * letter is 8 px at the name's and the value's size, 7 in the prose's and the line's, 6 at the smallest.
 */
describe('a row in a narrow column', () => {
  afterEach(() => document.body.replaceChildren());

  const AGO = new Date(Date.now() - 55 * 86_400_000).toISOString();
  const state = (entity_id: string, value: string, name: string, attributes = {}) => ({
    [entity_id]: {
      entity_id,
      state: value,
      attributes: { friendly_name: name, ...attributes },
      last_changed: AGO,
      last_updated: AGO,
    },
  });
  /** A kitchen whose states read as `words` says them (Home Assistant's, in the person's language). */
  const kitchen = (words: Record<string, string> = {}): HomeAssistant =>
    ({
      ...hass,
      states: {
        ...state('switch.light', 'on', 'Kitchen light'),
        ...state('switch.pump', 'unavailable', 'Garden pump'),
        ...state('binary_sensor.window', 'on', 'Kitchen window', { device_class: 'window' }),
        ...state('binary_sensor.motion', 'off', 'Hall motion', { device_class: 'motion' }),
        ...state('sensor.temperature', '21.6', 'Hall temperature', {
          unit_of_measurement: '°C',
          device_class: 'temperature',
        }),
        ...state('lock.door', 'locked', 'Front door'),
        ...state('media_player.tv', 'playing', 'TV'),
      },
      formatEntityState: (entity: HassEntity) => words[entity.state] ?? entity.state,
    }) as unknown as HomeAssistant;

  async function narrow(
    config: Omit<EntitiesCardConfig, 'type'>,
    width: number,
    house: HomeAssistant = kitchen(),
  ): Promise<ShadowRoot> {
    const card = document.createElement('fluvy-entities-card') as FluvyEntitiesCard;
    vi.spyOn((card as unknown as { head: HeadFit }).head.ruler, 'width').mockImplementation(
      (cls, text) =>
        text.length * (cls.endsWith('--xs') ? 6 : /--s$|--text|__sub/.test(cls) ? 7 : 8),
    );
    card.width = width;
    card.setConfig({ type: 'custom:fluvy-entities-card', ...config });
    card.hass = house;
    document.body.append(card);
    await card.updateComplete;
    return card.shadowRoot as ShadowRoot;
  }

  /** Each row as it is drawn: its name, its line, what ends it, and how it stands. */
  const drawn = (root: ShadowRoot) =>
    [...root.querySelectorAll<HTMLElement>('.fv-rows > .fv-row')].map((row) => {
      const value = row.querySelector<HTMLElement>('.fv-row__value');
      return {
        name: row.querySelector('.fv-row__title')?.textContent?.trim(),
        line: row.querySelector('.fv-row__sub')?.textContent?.trim() ?? '',
        value: value?.textContent?.trim() ?? '',
        bare: row.classList.contains('fv-row--bare'),
        stack: row.classList.contains('fv-row--stack'),
        wrap: value?.style.width ?? '',
        size: /fv-row__value--(s|xs)\b/.exec(value?.className ?? '')?.[1] ?? '',
        label: row.getAttribute('aria-label') ?? '',
      };
    });
  const ROWS = [
    'switch.light',
    'switch.pump',
    'binary_sensor.window',
    'binary_sensor.motion',
    'sensor.temperature',
    'lock.door',
  ];

  it('at a section’s width keeps every circle, every line whole and every value on its line', async () => {
    const rows = drawn(await narrow({ title: 'Kitchen', rows: ROWS }, 360));
    expect(rows.map((row) => row.bare || row.stack || row.wrap !== '' || row.size !== '')).toEqual(
      ROWS.map(() => false),
    );
    expect(rows.map((row) => row.line)).toEqual([
      '55 days ago',
      'Unavailable',
      '55 days ago',
      '55 days ago',
      '55 days ago',
      '55 days ago',
    ]);
    expect(rows.every((row) => row.label === '')).toBe(true);
  });

  it('at half a section gives the circles to the names and says every age in one form, the figure alone where a switch leaves no more', async () => {
    // 112 of content: a switch's 56 leaves the words 44 — "55 d ago" (56) would be cut, "55 d" (28) holds
    const rows = drawn(await narrow({ title: 'Kitchen', rows: ROWS }, 152));
    expect(rows.every((row) => row.bare)).toBe(true);
    expect(rows.filter((row) => row.line).map((row) => row.line)).toEqual([
      '55 d',
      '55 d',
      '55 d',
      '55 d',
      '55 d',
    ]);
    // the age left out of sight is read whole, the value after it
    expect(rows[0]!.label).toBe('Kitchen light · 55 days ago');
    expect(rows[2]!.label).toBe('Kitchen window · 55 days ago · On');
  });

  it('leaves out a state’s word no row has room for, and reads it in the row’s label', async () => {
    // the pump out of reach: beside its chevron's 44 the words have 56, "Unavailable" (77) does not hold
    const [, pump] = drawn(await narrow({ title: 'Kitchen', rows: ROWS }, 152));
    expect(pump).toMatchObject({ name: 'Garden pump', line: '', stack: false });
    expect(pump!.label).toBe('Garden pump · Unavailable');
    // …and says it where it holds
    const [, wide] = drawn(await narrow({ title: 'Kitchen', rows: ROWS }, 211));
    expect(wide!.line).toBe('Unavailable');
    expect(wide!.label).toBe('');
  });

  it('lets the name give way beside a value, down to two letters and the ellipsis, before the value moves', async () => {
    // 100 for the words and the value: "Locked" (48) leaves 52, "21.6 °C" (56) 44: on their line, the names cut
    const rows = drawn(await narrow({ title: 'Kitchen', rows: ROWS }, 152));
    expect(rows[4]).toMatchObject({ value: '21.6 °C', stack: false, wrap: '' });
    expect(rows[5]).toMatchObject({ value: 'Locked', stack: false, wrap: '' });
  });

  it('gives a state in words its two lines before the name is cut short, in any script', async () => {
    // "Not detected" (96) on one line would leave "Hall motion" 4; "Not" / "detected" (64) leaves it 36… under its
    // 40: at 152 it goes under; at 172 (120 to share) the two lines leave 56
    const en = kitchen({ off: 'Not detected' });
    expect(drawn(await narrow({ rows: ['binary_sensor.motion'] }, 172, en))[0]).toMatchObject({
      value: 'Not detected',
      stack: false,
      wrap: '64px',
    });
    const ru = kitchen({ off: 'Не найдено' });
    expect(drawn(await narrow({ rows: ['binary_sensor.motion'] }, 172, ru))[0]).toMatchObject({
      value: 'Не найдено',
      stack: false,
      wrap: '56px',
    });
    // a figure and its unit stay on one line
    expect(drawn(await narrow({ rows: ['sensor.temperature'] }, 172))[0]).toMatchObject({
      value: '21.6 °C',
      wrap: '',
    });
  });

  it('puts a value under the words where it would cut the name to nothing or leave the row, a compact row’s too', async () => {
    const ru = kitchen({ off: 'Не обнаружено', on: 'Открыто' });
    for (const variant of ['rows', 'compact'] as const) {
      const rows = drawn(
        await narrow({ variant, rows: ['binary_sensor.window', 'binary_sensor.motion'] }, 152, ru),
      );
      // "Открыто" (56) leaves "Kitchen window" 44: beside it; "Не" / "обнаружено" (80) would leave 20: under
      expect(rows[0]).toMatchObject({ value: 'Открыто', stack: false });
      expect(rows[1]).toMatchObject({ name: 'Hall motion', value: 'Не обнаружено', stack: true });
    }
    // under the words the name has the row; its age keeps the list's form, the figure the window's row holds
    const [, motion] = drawn(
      await narrow({ rows: ['binary_sensor.window', 'binary_sensor.motion'] }, 152, ru),
    );
    expect(motion!.line).toBe('55 d');
  });

  it('draws a word the row would not hold in the smaller sizes, measured: 14, then 12', async () => {
    const word = async (playing: string) =>
      drawn(await narrow({ rows: ['media_player.tv'] }, 152, kitchen({ playing })))[0];
    // 112 of content: 13 letters hold at 16 (104); 15 at 14 (105); 17 at 12 (102)
    expect(await word('Заблокировано')).toMatchObject({ stack: true, size: '' });
    expect(await word('Воспроизведение')).toMatchObject({ stack: true, size: 's' });
    expect(await word('Разблокированными')).toMatchObject({ stack: true, size: 'xs' });
    // a short name keeps its line beside a value that leaves it whole
    expect(await word('Играет')).toMatchObject({ stack: false, size: '' });
  });

  it('keeps an area’s name as a name, which may end in its ellipsis beside a switch', async () => {
    const house = {
      ...kitchen(),
      entities: { 'switch.light': { entity_id: 'switch.light', area_id: 'kitchen' } },
      areas: { kitchen: { area_id: 'kitchen', name: 'Kitchen and dining room' } },
    } as unknown as HomeAssistant;
    const root = await narrow({ rows: ['switch.light'] }, 152, house);
    const [light] = drawn(root);
    expect(light).toMatchObject({ line: 'Kitchen and dining room', label: '' });
    expect(root.querySelector('.fv-row__sub')?.hasAttribute('data-name')).toBe(true);
  });

  it('declares its rows of 60 and 48 whatever its column: the height a row under its words adds is the live card’s', () => {
    const config = { type: 'custom:fluvy-entities-card', title: 'Kitchen', rows: ROWS };
    expect(FluvyEntitiesCard.layoutHeight(config)).toBe(92 + 6 * 60);
    expect(FluvyEntitiesCard.layoutHeight({ ...config, variant: 'compact' })).toBe(92 + 6 * 48);
  });
});
