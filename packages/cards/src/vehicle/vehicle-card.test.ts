// @vitest-environment happy-dom
import type { HaFormSchemaItem, HassEntity, HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../vehicle/english.js';
import { normaliseConfig } from '../shared/config.js';
import type { TextRuler } from '../shared/fit.js';
import { vehicleHeight, vehicleSections } from '../vehicle-family.js';
import {
  carHouse,
  CARS,
  CLIO,
  FUEL_CARS,
  GOLF,
  KIA,
  KUGA,
  NIRO,
  OCTAVIA,
  RENAULT,
  SPORTAGE,
  TESLA,
  XC60,
  type CarFixture,
} from './fixtures.js';
import { carControls, FluvyVehicleCard } from './vehicle-card.js';
import { vehicleEntities } from './roles.js';

if (!customElements.get('fluvy-vehicle-card'))
  customElements.define('fluvy-vehicle-card', FluvyVehicleCard);

const NOW = '2026-11-04T11:47:12Z';
type Mounted = FluvyVehicleCard & { updateComplete: Promise<boolean> };
type Calls = Array<{ domain: string; service: string; target: unknown }>;

/** The house, its calls recorded, with some states changed (its cars that burn fuel beside the electric ones). */
function house(
  changes: Record<string, Partial<HassEntity>> = {},
): HomeAssistant & { calls: Calls } {
  const base = carHouse([...CARS, ...FUEL_CARS]);
  const calls: Calls = [];
  const states = { ...base.states };
  for (const [id, change] of Object.entries(changes))
    states[id] = { ...(states[id] as HassEntity), ...change } as HassEntity;
  return {
    ...base,
    states,
    calls,
    callService: async (domain: string, service: string, _data: unknown, target: unknown) => {
      calls.push({ domain, service, target });
    },
  } as unknown as HomeAssistant & { calls: Calls };
}

async function mount(
  config: Record<string, unknown>,
  hass: HomeAssistant = house(),
  width = 360,
  letter = 0,
): Promise<Mounted> {
  const card = document.createElement('fluvy-vehicle-card') as Mounted;
  // happy-dom lays out no text: where a test needs words measured, each letter is `letter` wide (a pill its words and
  // its sides, on the 4 grid)
  if (letter) {
    const { ruler } = (card as unknown as { head: { ruler: TextRuler } }).head;
    ruler.width = (_: string, text: string) => text.length * letter;
    ruler.pill = (_: string, text: string, pad: number) =>
      Math.ceil((text.length * letter + pad) / 4) * 4;
  }
  card.setConfig({ type: 'custom:fluvy-vehicle-card', _now: NOW, ...config } as LovelaceCardConfig);
  card.hass = hass;
  (card as unknown as { width: number }).width = width;
  document.body.append(card);
  await card.updateComplete;
  await card.updateComplete;
  return card;
}

const root = (card: Mounted): ShadowRoot => card.shadowRoot as ShadowRoot;
const text = (el: Element | null | undefined): string =>
  (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
const words = (card: Mounted): string[] =>
  [...root(card).querySelectorAll('.vh-control__word')].map((el) => text(el));
const labels = (card: Mounted): string[] =>
  [...root(card).querySelectorAll('.vh-control')].map((el) => el.getAttribute('aria-label') ?? '');
/** The card's parts, in order: its anatomy, whatever it says. */
const sections = (card: Mounted): string[] =>
  [...(root(card).querySelector('article')?.children ?? [])].map(
    (el) =>
      `${el.tagName.toLowerCase()}.${[...el.classList]
        .filter((c) => !/^is-|^fv-tone--/.test(c))
        .sort()
        .join('.')}`,
  );
/** The fields a form shows for what it holds: each where its own `when` and its row's hold. */
const fieldsShown = (
  schema: readonly HaFormSchemaItem[],
  data: Readonly<Record<string, unknown>>,
): string[] =>
  schema.flatMap((item) =>
    item.when && !item.when(data, undefined)
      ? []
      : item.schema
        ? fieldsShown(item.schema, data)
        : [item.name],
  );
/** Every entity of a car out of reach. */
const away = (car: typeof TESLA): Record<string, Partial<HassEntity>> =>
  Object.fromEntries(car.seeds.map(([id]) => [id, { state: 'unavailable' }]));

afterEach(() => document.body.replaceChildren());

describe('the vehicle card', () => {
  it('draws a Tesla charging: its charge, range and limit, when it is done, what it does', async () => {
    const card = await mount({ device: TESLA.device });
    const r = root(card);
    expect(text(r.querySelector('.fv-badge'))).toBe('Charging · 7.2 kW');
    expect(text(r.querySelector('.ef-top'))).toContain('64');
    expect(text(r.querySelector('.ef-top__side'))).toBe('Range 320km');
    expect(text(r.querySelector('.en-mark-label.is-mark'))).toBe('Limit');
    // at 11:47 the charge ends at 13:12: "80 % at 13:12 · 1 h 25 min left · +46 km/h"
    expect(text(r.querySelector('.vh-line'))).toBe('80 % at 13:12 · 1 h 25 min left · +46 km/h');
    expect(words(card).slice(0, 3)).toEqual(['Locked', 'Off', 'Charging']);
    expect(text(r.querySelector('.vh-rows'))).toContain('Home');
    expect(text(r.querySelector('.vh-rows'))).toContain('24,318 km');
  });

  it('never lays a cell under 56, and wraps the card’s own list into even rows', async () => {
    // the words are the browser's to measure (`interactions-vehicle.mjs`); here the cells' floor alone decides: a 300
    // card's 260 holds four cells of 65 (five would be 52), the car's own in their order, the rest giving way
    const narrow = await mount({ device: TESLA.device }, house(), 300);
    expect(labels(narrow).map((label) => label.split(' · ')[0])).toEqual([
      'Lock',
      'Climate',
      'Charging',
      'Boot',
    ]);
    // seven of the card's own at 300: two rows of four and three, never a lone one on a row
    const listed = await mount(
      {
        device: TESLA.device,
        controls: ['lock', 'climate', 'trunk', 'frunk', 'windows', 'sentry', 'doors'],
      },
      house(),
      300,
    );
    expect(root(listed).querySelectorAll('.vh-control')).toHaveLength(7);
    expect(
      (root(listed).querySelector('.vh-controls') as HTMLElement).style.getPropertyValue(
        '--vh-cols',
      ),
    ).toBe('4');
  });

  it('lays its rounds out by every word each can say, so no state moves them, out of reach either', async () => {
    // at 7 a letter a 280 card's 240 holds four cells of 60 for a lock that says "Unlocked", three for its "Unlocking"
    const controls = ['lock', 'climate', 'trunk', 'sentry'];
    const columns = async (hass: HomeAssistant): Promise<string> => {
      const card = await mount({ device: TESLA.device, controls }, hass, 280, 7);
      const row = root(card).querySelector<HTMLElement>('.vh-controls');
      document.body.replaceChildren();
      return row?.style.getPropertyValue('--vh-cols') ?? '';
    };
    const locked = await columns(house());
    expect(locked).toBe('2');
    expect(await columns(house({ 'lock.model_y_lock': { state: 'unlocking' } }))).toBe(locked);
    expect(await columns(house(away(TESLA)))).toBe(locked);
  });

  it('says an opening’s name while it is shut, “Open” in the warning’s ink while it is not', async () => {
    const shut = await mount({ device: TESLA.device, controls: ['trunk'] });
    expect(words(shut)).toEqual(['Boot']);
    document.body.replaceChildren();
    const open = await mount(
      { device: TESLA.device, controls: ['trunk'] },
      house({ 'cover.model_y_trunk': { state: 'open' } }),
    );
    expect(words(open)).toEqual(['Open']);
    expect(root(open).querySelector('.vh-control__word.is-warning')).not.toBeNull();
  });

  it('asks before it unlocks, opens the boot or stops a charge; locks at once', async () => {
    const asked: unknown[] = [];
    const listen = (event: Event) => asked.push((event as CustomEvent).detail.config.tap_action);
    document.body.addEventListener('hass-action', listen);
    try {
      const hass = house();
      const card = await mount(
        { device: TESLA.device, controls: ['lock', 'trunk', 'charging'] },
        hass,
      );
      for (const button of root(card).querySelectorAll<HTMLButtonElement>('.vh-control'))
        button.click();
      expect(asked).toEqual([
        expect.objectContaining({
          perform_action: 'lock.unlock',
          confirmation: { text: 'Unlock the car?' },
        }),
        expect.objectContaining({
          perform_action: 'cover.open_cover',
          confirmation: { text: 'Open the boot?' },
        }),
        expect.objectContaining({
          perform_action: 'switch.turn_off',
          confirmation: { text: 'Stop charging?' },
        }),
      ]);
      expect(hass.calls).toEqual([]);
      document.body.replaceChildren();
      const kia = house();
      const unlocked = await mount({ device: KIA.device, controls: ['lock'] }, kia);
      root(unlocked).querySelector<HTMLButtonElement>('.vh-control')?.click();
      expect(kia.calls).toEqual([
        { domain: 'lock', service: 'lock', target: { entity_id: 'lock.ev6_door_lock' } },
      ]);
    } finally {
      document.body.removeEventListener('hass-action', listen);
    }
  });

  it('asks where the card says so, and never where it says not to', async () => {
    const asked: unknown[] = [];
    const listen = (event: Event) => asked.push((event as CustomEvent).detail.config.tap_action);
    document.body.addEventListener('hass-action', listen);
    try {
      const hass = house();
      const card = await mount(
        {
          device: TESLA.device,
          controls: [
            { control: 'climate', confirm: true },
            { control: 'lock', confirm: false },
          ],
        },
        hass,
      );
      for (const button of root(card).querySelectorAll<HTMLButtonElement>('.vh-control'))
        button.click();
      expect(asked).toEqual([
        expect.objectContaining({ perform_action: 'climate.turn_on', confirmation: true }),
      ]);
      expect(hass.calls).toEqual([
        { domain: 'lock', service: 'unlock', target: { entity_id: 'lock.model_y_lock' } },
      ]);
    } finally {
      document.body.removeEventListener('hass-action', listen);
    }
  });

  it('turns a charge switch by its own state, and says where the charge is', async () => {
    const asked: unknown[] = [];
    const listen = (event: Event) => asked.push((event as CustomEvent).detail.config.tap_action);
    document.body.addEventListener('hass-action', listen);
    try {
      // the switch still on while the charge reads complete: a tap stops it, asking first, and the round says Charged
      const full = house({
        'sensor.model_y_charging': { state: 'complete' },
        'sensor.model_y_charger_power': { state: '0' },
      });
      const done = await mount({ device: TESLA.device, controls: ['charging'] }, full);
      root(done).querySelector<HTMLButtonElement>('.vh-control')?.click();
      expect(words(done)).toEqual(['Charged']);
      expect(asked).toEqual([
        expect.objectContaining({
          perform_action: 'switch.turn_off',
          confirmation: { text: 'Stop charging?' },
        }),
      ]);
      expect(full.calls).toEqual([]);
      document.body.replaceChildren();
      // the switch off while the charge still reads charging: a tap turns it on, at once
      const off = house({ 'switch.model_y_charge': { state: 'off' } });
      const charging = await mount({ device: TESLA.device, controls: ['charging'] }, off);
      root(charging).querySelector<HTMLButtonElement>('.vh-control')?.click();
      expect(words(charging)).toEqual(['Charging']);
      expect(off.calls).toEqual([
        { domain: 'switch', service: 'turn_on', target: { entity_id: 'switch.model_y_charge' } },
      ]);
      // still on while the cable is out, the switch can still be turned off: only a start needs the cable
      document.body.replaceChildren();
      const out = await mount(
        { device: TESLA.device, controls: ['charging'] },
        house({
          'sensor.model_y_charging': { state: 'disconnected' },
          'binary_sensor.model_y_charge_cable': { state: 'off' },
          'sensor.model_y_charger_power': { state: '0' },
        }),
      );
      expect(root(out).querySelector('.vh-control')?.getAttribute('aria-disabled')).toBeNull();
    } finally {
      document.body.removeEventListener('hass-action', listen);
    }
  });

  it('keeps the charging round still while the cable is out, and says why', async () => {
    const card = await mount(
      { device: TESLA.device, controls: ['charging'] },
      house({
        'sensor.model_y_charging': { state: 'disconnected' },
        'binary_sensor.model_y_charge_cable': { state: 'off' },
        'switch.model_y_charge': { state: 'off' },
        'sensor.model_y_charger_power': { state: '0' },
        'binary_sensor.model_y_tire_pressure_warning_rear_right': { state: 'off' },
      }),
    );
    const round = root(card).querySelector('.vh-control');
    expect(round?.getAttribute('aria-disabled')).toBe('true');
    expect(round?.getAttribute('title')).toBe('Charging · Unplugged · Not plugged in');
    expect(text(root(card).querySelector('.vh-line'))).toBe('Unplugged · Limit 80 %');
  });

  it('says a window left open, a car that has not reported for a while, its address away from home', async () => {
    const card = await mount({ device: KIA.device });
    const r = root(card);
    expect(text(r.querySelector('.vh-line'))).toBe('Window open');
    expect(text(r.querySelector('.fv-card__sub'))).toBe('Updated 2 h ago');
    document.body.replaceChildren();
    const out = await mount(
      { device: KIA.device },
      house({ 'device_tracker.ev6_location': { state: 'not_home' } }),
    );
    expect(text(root(out).querySelector('.fv-card__sub'))).toBe(
      'Carrer de Mallorca 401 · Updated 2 h ago',
    );
  });

  it('says a cold cabin while the climate is off, and its temperature under the climate’s round', async () => {
    const card = await mount(
      { device: TESLA.device },
      house({
        'sensor.model_y_inside_temperature': { state: '2' },
        'sensor.model_y_charging': { state: 'disconnected' },
        'binary_sensor.model_y_charge_cable': { state: 'off' },
        'sensor.model_y_charger_power': { state: '0' },
        'binary_sensor.model_y_tire_pressure_warning_rear_right': { state: 'off' },
      }),
    );
    expect(text(root(card).querySelector('.vh-line'))).toBe('Cold inside · 2 °C');
    expect(words(card)[1]).toBe('2 °C');
  });

  it('reads Renault’s planned charge and its lock from its sensor (off: locked)', async () => {
    const card = await mount({ device: RENAULT.device });
    expect(text(root(card).querySelector('.fv-badge'))).toBe('Plugged in');
    expect(text(root(card).querySelector('.vh-line'))).toBe('Waiting to charge');
    expect(words(card)[0]).toBe('Locked');
  });

  it('keeps its anatomy out of reach: every part in its place, its controls still, its values dashes (1.9)', async () => {
    const live = await mount({ device: TESLA.device, show_tyres: true });
    const anatomy = sections(live);
    document.body.replaceChildren();
    const gone = await mount({ device: TESLA.device, show_tyres: true }, house(away(TESLA)));
    expect(sections(gone)).toEqual(anatomy);
    expect(text(root(gone).querySelector('.fv-badge'))).toBe('Unavailable');
    expect(new Set(words(gone))).toEqual(new Set(['—']));
    for (const round of root(gone).querySelectorAll('.vh-control'))
      expect(round.hasAttribute('disabled')).toBe(true);
  });

  it('declares its height from its config alone, as its family does', () => {
    const at = (config: Record<string, unknown>) =>
      FluvyVehicleCard.layoutHeight({ type: 'x', ...config } as LovelaceCardConfig);
    expect(at({})).toBe(vehicleHeight({ type: 'x' }));
    expect(at({})).toBe(100 + 140 + 28 + 80 + 16 + 96);
    expect(at({ hero: 'ring' })).toBe(100 + 208 + 28 + 80 + 16 + 96);
    expect(at({ image: '/local/car.png' })).toBe(at({}) + 176);
    expect(at({ image: '/local/car.png', image_position: 'head' })).toBe(at({}));
    expect(at({ show_tyres: true, show_rows: false })).toBe(100 + 140 + 28 + 80 + 112);
    expect(at({ controls: ['lock', 'climate', 'charging', 'trunk', 'frunk', 'windows'] })).toBe(
      at({}) + 64 + 12,
    );
    expect(at({ variant: 'compact' })).toBe(100 + 20 + 28 + 60);
    expect(at({ variant: 'compact', show_status: false })).toBe(100 + 20 + 60);
    expect(at({ show_status: false, show_rows: false })).toBe(100 + 140 + 80);
    expect(at({ variant: 'mini' })).toBe(76);
  });

  it('reads its picture as every card reads one, and draws the car’s glyph where it would not load', async () => {
    const card = await mount({ device: TESLA.device, image: '/local/car.png' });
    const img = root(card).querySelector<HTMLImageElement>('.vh-picture img');
    expect(img?.getAttribute('src')).toBe('http://ha.example/local/car.png');
    img?.dispatchEvent(new Event('error'));
    await card.updateComplete;
    const plate = root(card).querySelector('.vh-picture');
    expect(plate?.classList.contains('is-empty')).toBe(true);
    expect(plate?.querySelector('img')).toBeNull();
    expect(plate?.querySelector('svg')).not.toBeNull();
  });

  it('watches the image entity of the car’s own device with image: auto, and draws its new picture', async () => {
    const base = house();
    const id = 'image.model_y_picture';
    const pictured = (picture: string): HomeAssistant =>
      ({
        ...base,
        entities: { ...base.entities, [id]: { entity_id: id, device_id: TESLA.device } },
        states: {
          ...base.states,
          [id]: { entity_id: id, state: '1', attributes: { entity_picture: picture } },
        },
      }) as unknown as HomeAssistant;
    const card = await mount({ device: TESLA.device, image: 'auto' }, pictured('/api/a.png'));
    expect((card as unknown as { watched(): string[] }).watched()).toContain(id);
    const src = (): string | null | undefined =>
      root(card).querySelector('.vh-picture img')?.getAttribute('src');
    expect(src()).toBe('http://ha.example/api/a.png');
    card.hass = pictured('/api/b.png');
    await card.updateComplete;
    expect(src()).toBe('http://ha.example/api/b.png');
  });

  it('draws its picture at its own size, its height following; the picture alone where nothing else shows (#254)', async () => {
    const at = (config: Record<string, unknown>) =>
      FluvyVehicleCard.layoutHeight({ type: 'x', ...config } as LovelaceCardConfig);
    const image = '/local/car.png';
    expect(at({ image, image_size: '50%' })).toBe(at({}) + 16 + 80);
    expect(at({ image, image_size: '120px' })).toBe(at({}) + 16 + 120);
    expect(at({ image, image_size: 96 })).toBe(at({}) + 16 + 96);
    expect(at({ image, image_size: 'large' })).toBe(at({ image }));
    expect(at({ image, image_size: '50%', image_position: 'head' })).toBe(at({}));
    // the head hidden: its 44 and the 16 under it; the battery hidden, the line 16 under the head
    expect(at({ show_head: false })).toBe(at({}) - 60);
    expect(at({ show_hero: false })).toBe(at({}) - 156 + 8);
    expect(at({ variant: 'compact', show_hero: false })).toBe(at({ variant: 'compact' }) - 36 + 8);
    const alone = {
      image,
      show_head: false,
      show_hero: false,
      show_status: false,
      show_controls: false,
      show_rows: false,
    };
    expect(at(alone)).toBe(40 + 160);
    expect(at({ ...alone, image_size: '50%' })).toBe(40 + 80);
    expect(at({ ...alone, image: '' })).toBe(40);

    const sized = await mount({ device: TESLA.device, image, image_size: '50%' });
    const plate = root(sized).querySelector<HTMLElement>('.vh-picture')?.style;
    expect([plate?.width, plate?.height]).toEqual(['160px', '80px']);
    expect(root(sized).querySelector('.vh-picture .fv-tile__tap')).toBeNull();
    document.body.replaceChildren();
    const tall = await mount({ device: TESLA.device, image, image_size: '120px' });
    expect(root(tall).querySelector<HTMLElement>('.vh-picture')?.style.height).toBe('120px');
    expect(root(tall).querySelector<HTMLElement>('.vh-picture')?.style.width).toBe('320px');
    document.body.replaceChildren();
    // the picture alone is the card's button: its tap opens the battery, as the head's would
    const card = await mount({ device: TESLA.device, ...alone, image_size: '60%' });
    expect(sections(card)).toEqual(['span.vh-picture']);
    const cover = root(card).querySelector<HTMLButtonElement>('.vh-picture > .fv-tile__tap');
    expect(cover?.getAttribute('aria-label')).toBe('Model Y');
    const opened: unknown[] = [];
    const open = (event: Event) => opened.push((event as CustomEvent).detail.entityId);
    window.addEventListener('hass-more-info', open);
    cover?.click();
    window.removeEventListener('hass-more-info', open);
    expect(opened).toEqual(['sensor.model_y_battery_level']);
  });

  it('draws its picture in the head, and a car glyph where none can be shown', async () => {
    const card = await mount({
      device: TESLA.device,
      image: 'javascript:alert(1)',
      image_position: 'head',
    });
    const face = root(card).querySelector('.vh-face');
    expect(face?.classList.contains('is-empty')).toBe(true);
    expect(face?.querySelector('img')).toBeNull();
  });

  it('offers the controls the car has, in their order, where the card names none', () => {
    expect(carControls(vehicleEntities(carHouse(), TESLA.device))).toEqual([
      'lock',
      'climate',
      'charging',
      'trunk',
      'windows',
      'frunk',
      'sentry',
    ]);
    expect(carControls(vehicleEntities(carHouse(), RENAULT.device))).toEqual([
      'lock',
      'climate',
      'charging',
      'trunk',
    ]);
    // a button that vents the windows says nothing of them: no round of windows that would read shut for ever
    const vents: CarFixture = {
      device: 'd-vents',
      name: 'Model 3',
      platform: 'tesla_custom',
      seeds: [
        ['lock.model_3_doors', 'locked'],
        ['button.model_3_vent_windows', 'unknown'],
      ],
    };
    expect(carControls(vehicleEntities(carHouse([vents]), vents.device))).toEqual(['lock']);
  });

  it('draws the strip and the compact card from the same car', async () => {
    const mini = await mount({ device: TESLA.device, variant: 'mini' });
    expect(text(root(mini).querySelector('.fv-row__sub'))).toBe(
      '64 % · 320 km · Charging · 7.2 kW · Home',
    );
    document.body.replaceChildren();
    const compact = await mount({ device: TESLA.device, variant: 'compact' });
    expect(text(root(compact).querySelector('.fv-card__sub'))).toBe('320 km · Home');
    expect(text(root(compact).querySelector('.vh-bar__value'))).toBe('64 %');
    expect(root(compact).querySelector('.vh-control__word')).toBeNull();
  });

  it('says it has found no car, rather than draw an empty one', async () => {
    const card = await mount({ device: 'd-washer' });
    expect(root(card).querySelector('.fv-card--empty')).not.toBeNull();
  });

  it('writes its tyres in the decimals they share: their display precision, else one under 10, none above (#251)', async () => {
    const pressures = async (hass: HomeAssistant, device = TESLA.device): Promise<string[]> => {
      const card = await mount({ device, show_tyres: true }, hass);
      const read = [...root(card).querySelectorAll('.vh-tyre')].map((tyre) => text(tyre));
      document.body.replaceChildren();
      return read;
    };
    // a bar's: 2.0 beside 2.3, never "2"
    expect(
      await pressures(house({ 'sensor.model_y_tire_pressure_front_left': { state: '2' } })),
    ).toEqual(['2.0bar', '—', '—', '2.3bar']);
    // a unit in another script reads as a bar does: by its figures
    expect(
      await pressures(
        house({
          'sensor.model_y_tire_pressure_front_left': {
            state: '2.31',
            attributes: { unit_of_measurement: 'бар' },
          },
        }),
      ),
    ).toEqual(['2.3бар', '—', '—', '2.3bar']);
    // psi whole, but the sensor's own precision where Home Assistant's registry gives one
    expect(
      await pressures(
        house({ 'sensor.ev6_tire_pressure_front_left': { state: '35.5' } }),
        KIA.device,
      ),
    ).toEqual(['36psi', '—', '—', '—']);
    const precise = house({ 'sensor.ev6_tire_pressure_front_left': { state: '35.5' } });
    const entities = precise.entities as unknown as Record<string, Record<string, unknown>>;
    entities['sensor.ev6_tire_pressure_front_left'] = {
      ...entities['sensor.ev6_tire_pressure_front_left'],
      display_precision: 1,
    };
    expect(await pressures(precise, KIA.device)).toEqual(['35.5psi', '—', '—', '—']);
  });

  it('finds a tyre low under its tyre_low: a figure, an entity in its own unit, a template once answered (#251)', async () => {
    const calm = house({
      'binary_sensor.model_y_tire_pressure_warning_rear_right': { state: 'off' },
      'sensor.model_y_charging': { state: 'disconnected' },
      'binary_sensor.model_y_charge_cable': { state: 'off' },
      'sensor.model_y_charger_power': { state: '0' },
    });
    const states = calm.states as Record<string, HassEntity>;
    states['sensor.tyre_threshold'] = {
      entity_id: 'sensor.tyre_threshold',
      state: '36',
      attributes: { unit_of_measurement: 'psi' },
    } as HassEntity;
    const lowOf = async (tyre_low: unknown) => {
      const card = await mount({ device: TESLA.device, show_tyres: true, tyre_low }, calm);
      const read = {
        low: [...root(card).querySelectorAll('.vh-tyre')].map((tyre) =>
          tyre.classList.contains('is-low'),
        ),
        wheels: [...root(card).querySelectorAll('.vh-car rect.is-low')].length,
        line: line(card),
      };
      document.body.replaceChildren();
      return read;
    };
    const rearRight = { low: [false, false, false, true], wheels: 1, line: 'Low tyre pressure' };
    expect(await lowOf(2.5)).toEqual(rearRight);
    expect(await lowOf('2,5')).toEqual(rearRight);
    // 36 psi is 2.48 bar: the rear right's 2.3 is under it, the front left's 2.9 is not
    expect(await lowOf('sensor.tyre_threshold')).toEqual(rearRight);
    // a template Home Assistant has not answered: no tyre is low yet
    expect(await lowOf("{{ states('sensor.tyre_threshold') }}")).toEqual({
      low: [false, false, false, false],
      wheels: 0,
      line: 'Unplugged · Limit 80 %',
    });
  });

  it('lets the car from above give way, then puts each unit under its figure, as its column narrows', async () => {
    // at 8 a letter "2.9" and "bar" side by side are 48 wide: a 360 card holds them beside the car, a 211 in two
    // columns without it, a 172 (half a section) only with the unit under its figure
    const layout = async (width: number): Promise<string[]> => {
      const card = await mount({ device: TESLA.device, show_tyres: true }, house(), width);
      (card as unknown as { head: { ruler: TextRuler } }).head.ruler.width = (
        _: string,
        text: string,
        __?: string,
        unit = '',
      ) => (text.length + unit.length) * 8;
      card.requestUpdate();
      await card.updateComplete;
      const classes = [...(root(card).querySelector('.vh-tyres')?.classList ?? [])];
      document.body.replaceChildren();
      return classes.filter((c) => c.startsWith('is-'));
    };
    expect(await layout(360)).toEqual([]);
    expect(await layout(211)).toEqual(['is-bare']);
    expect(await layout(172)).toEqual(['is-bare', 'is-stacked']);
  });

  it('writes its tyres in the decimals it asks for', async () => {
    const card = await mount({ device: TESLA.device, show_tyres: true, tyre_decimals: '2' });
    expect([...root(card).querySelectorAll('.vh-tyre')].map((tyre) => text(tyre))).toEqual([
      '2.90bar',
      '—',
      '—',
      '2.30bar',
    ]);
  });

  it('says its integration’s tyre warning on its line, the tyres drawn or not', async () => {
    const parked = {
      'sensor.model_y_charging': { state: 'disconnected' },
      'binary_sensor.model_y_charge_cable': { state: 'off' },
      'sensor.model_y_charger_power': { state: '0' },
    };
    const card = await mount({ device: TESLA.device }, house(parked));
    expect(line(card)).toBe('Low tyre pressure');
    expect(root(card).querySelector('.vh-line.is-warning')).not.toBeNull();
    document.body.replaceChildren();
    const fine = await mount(
      { device: TESLA.device },
      house({
        ...parked,
        'binary_sensor.model_y_tire_pressure_warning_rear_right': { state: 'off' },
      }),
    );
    expect(line(fine)).toBe('Unplugged · Limit 80 %');
  });

  it('draws its quick actions at its foot, each acting as a room’s does, the line declared by its config (#251)', async () => {
    const quick = [
      { entity: 'binary_sensor.model_y_status', name: 'GSM', icon: 'mdi:signal' },
      'switch.model_y_sentry_mode',
      'lights',
    ];
    const hass = house();
    const card = await mount({ device: TESLA.device, quick_actions: quick }, hass);
    expect(sections(card).at(-1)).toBe('div.vh-quick');
    // rounds alone stand each in the middle of its share of the column, as the controls over them
    expect(root(card).querySelector('.vh-quick > .lt-bulbs--across')).not.toBeNull();
    const rounds = root(card).querySelectorAll<HTMLElement>('.vh-quick .lt-bulb');
    // a room's set means nothing on a car: its entities' rounds alone
    expect([...rounds].map((round) => round.getAttribute('aria-label'))).toEqual([
      'GSM',
      'Model Y model y sentry mode',
    ]);
    // a sensor opens its details, a switch turns on and off
    rounds[1]?.click();
    expect(hass.calls.map(({ domain, service }) => `${domain}.${service}`)).toEqual([
      'switch.turn_on',
    ]);
    expect((card as unknown as { watched(): string[] }).watched()).toContain(
      'binary_sensor.model_y_status',
    );
    document.body.replaceChildren();
    const said = await mount({
      device: TESLA.device,
      quick_actions: quick,
      show_quick_states: true,
    });
    // saying their states, every cell is a key that fills its share: two in a column of 320, 8 apart, flush with it
    const keys = (of: Mounted): HTMLElement[] => [
      ...root(of).querySelectorAll<HTMLElement>(
        '.vh-quick .lt-bulbs--keys[data-fill-row] > .lt-bulb',
      ),
    ];
    expect(root(said).querySelector('.vh-quick.is-under')).not.toBeNull();
    expect(
      keys(said).map((key) => [key.style.width, key.classList.contains('lt-bulb--under')]),
    ).toEqual([
      ['156px', true],
      ['156px', true],
    ]);
    document.body.replaceChildren();
    // how many is the list's and the width's alone: keys of 64 at the least, pills of 96 beside
    const five = ['a', 'b', 'c', 'd', 'e'].map((id) => `sensor.model_y_${id}`);
    const fit = async (width: number, config: Record<string, unknown> = {}): Promise<string[]> => {
      const drawn = await mount(
        { device: TESLA.device, quick_actions: five, show_quick_states: true, ...config },
        house(),
        width,
      );
      const widths = keys(drawn).map((key) => key.style.width);
      document.body.replaceChildren();
      return widths;
    };
    expect(await fit(392)).toEqual(Array(5).fill('64px'));
    expect(await fit(360)).toEqual(Array(4).fill('74px'));
    expect(await fit(211)).toEqual(Array(2).fill('81px'));
    expect(await fit(152)).toEqual(['112px']);
    expect(await fit(360, { quick_state_position: 'beside' })).toEqual(Array(3).fill('101px'));
    // without states five rounds hold where four keys do
    const bare = await mount({ device: TESLA.device, quick_actions: five }, house(), 360);
    expect(root(bare).querySelectorAll('.vh-quick .lt-bulb')).toHaveLength(5);
    document.body.replaceChildren();
    const strip = await mount({ device: TESLA.device, variant: 'mini', quick_actions: quick });
    expect(root(strip).querySelector('.vh-quick')).toBeNull();
    const at = (config: Record<string, unknown>) =>
      FluvyVehicleCard.layoutHeight({ type: 'x', ...config } as LovelaceCardConfig);
    expect(at({ quick_actions: quick })).toBe(at({}) + 16 + 44);
    expect(at({ quick_actions: quick, show_quick_states: true })).toBe(at({}) + 16 + 64);
    expect(
      at({ quick_actions: quick, show_quick_states: true, quick_state_position: 'beside' }),
    ).toBe(at({}) + 16 + 44);
    expect(at({ quick_actions: [{ entity: 'sensor.x', show_state: true }] })).toBe(at({}) + 80);
    expect(at({ variant: 'compact', quick_actions: quick })).toBe(at({ variant: 'compact' }) + 60);
    expect(at({ variant: 'mini', quick_actions: quick })).toBe(76);
    expect(at({ quick_actions: [] })).toBe(at({}));
  });

  it('says a badge of the person’s own: words, an entity’s state, a template once answered; Unavailable first (#251)', async () => {
    const badgeOf = async (
      config: Record<string, unknown>,
      hass: HomeAssistant = house(),
    ): Promise<{ badge: string | null; strip: string }> => {
      const card = await mount({ device: TESLA.device, ...config }, hass);
      const badge = root(card).querySelector('.fv-badge');
      document.body.replaceChildren();
      const mini = await mount({ device: TESLA.device, variant: 'mini', ...config }, hass);
      const strip = text(root(mini).querySelector('.fv-row__sub'));
      document.body.replaceChildren();
      return { badge: badge ? text(badge) : null, strip };
    };
    expect(await badgeOf({ badge: 'GPS ok · GSM 4/5' })).toEqual({
      badge: 'GPS ok · GSM 4/5',
      strip: '64 % · 320 km · GPS ok · GSM 4/5 · Home',
    });
    expect((await badgeOf({ badge: 'device_tracker.model_y_location' })).badge).toBe('Home');
    // an entity out of reach, or an empty answer: the card says what the car does
    expect(
      (
        await badgeOf(
          { badge: 'device_tracker.model_y_location' },
          house({ 'device_tracker.model_y_location': { state: 'unavailable' } }),
        )
      ).badge,
    ).toBe('Charging · 7.2 kW');
    expect((await badgeOf({ badge: ' ' })).badge).toBe('Charging · 7.2 kW');
    // a template Home Assistant has not answered: no badge yet, rather than the card's for a moment
    expect(await badgeOf({ badge: "{{ 'GPS ok' }}" })).toEqual({
      badge: null,
      strip: '64 % · 320 km · Home',
    });
    expect((await badgeOf({ badge: 'GPS ok' }, house(away(TESLA)))).badge).toBe('Unavailable');
  });

  it('starts and stops an engine named by hand, asking first both ways unless it says not to (#248)', async () => {
    const asked: unknown[] = [];
    const listen = (event: Event) => asked.push((event as CustomEvent).detail.config.tap_action);
    document.body.addEventListener('hass-action', listen);
    const engine = (state: string, domain = 'switch'): HomeAssistant & { calls: Calls } => {
      const hass = house();
      const id = `${domain}.model_y_engine`;
      (hass.states as Record<string, HassEntity>)[id] = {
        entity_id: id,
        state,
        attributes: { friendly_name: 'Model Y Engine' },
      } as HassEntity;
      return hass;
    };
    const roles = (domain = 'switch') => [{ role: 'engine', entity: `${domain}.model_y_engine` }];
    try {
      // named, it stands after the lock where the card names no controls of its own
      const off = await mount({ device: TESLA.device, roles: roles() }, engine('off'));
      expect(words(off).slice(0, 2)).toEqual(['Locked', 'Off']);
      expect(labels(off)[1]).toBe('Engine · Off');
      root(off).querySelectorAll<HTMLButtonElement>('.vh-control')[1]?.click();
      document.body.replaceChildren();
      const running = await mount(
        { device: TESLA.device, roles: roles(), controls: ['engine'] },
        engine('on'),
      );
      expect(words(running)).toEqual(['Running']);
      expect(root(running).querySelector('.vh-control .fv-ico--accent')).not.toBeNull();
      root(running).querySelector<HTMLButtonElement>('.vh-control')?.click();
      document.body.replaceChildren();
      const button = await mount(
        { device: TESLA.device, roles: roles('button'), controls: ['engine'] },
        engine('unknown', 'button'),
      );
      expect(words(button)).toEqual(['Engine']);
      root(button).querySelector<HTMLButtonElement>('.vh-control')?.click();
      expect(asked).toEqual([
        expect.objectContaining({
          perform_action: 'switch.turn_on',
          confirmation: { text: 'Start the engine?' },
        }),
        expect.objectContaining({
          perform_action: 'switch.turn_off',
          confirmation: { text: 'Stop the engine?' },
        }),
        expect.objectContaining({
          perform_action: 'button.press',
          confirmation: { text: 'Start the engine?' },
        }),
      ]);
      document.body.replaceChildren();
      const hass = engine('off');
      const quiet = await mount(
        { device: TESLA.device, roles: roles(), controls: [{ control: 'engine', confirm: false }] },
        hass,
      );
      root(quiet).querySelector<HTMLButtonElement>('.vh-control')?.click();
      expect(hass.calls).toEqual([
        { domain: 'switch', service: 'turn_on', target: { entity_id: 'switch.model_y_engine' } },
      ]);
    } finally {
      document.body.removeEventListener('hass-action', listen);
    }
  });

  it('draws an entity of the person’s own among its controls, in the car’s cell, its name its word (#248)', async () => {
    const hass = house();
    const card = await mount(
      {
        device: TESLA.device,
        controls: [
          'lock',
          { entity: 'switch.model_y_sentry_mode', name: 'Guard', icon: 'mdi:shield-car' },
          'cover.model_y_windows',
          // the editor's own word for one of the person's own
          { control: 'entity', entity: 'switch.model_y_charge', name: 'Charger' },
        ],
      },
      hass,
    );
    expect(labels(card)).toEqual([
      'Lock · Locked',
      'Guard · Off',
      'Model Y model y windows · Closed',
      'Charger · On',
    ]);
    const word = root(card).querySelectorAll('.vh-control__word')[1];
    expect(word?.classList.contains('is-name')).toBe(true);
    expect(word?.hasAttribute('data-name')).toBe(true);
    // a switch turns on and off at once, as a room's quick action does; a cover opens
    const rounds = root(card).querySelectorAll<HTMLButtonElement>('.vh-control');
    rounds[1]?.click();
    rounds[2]?.click();
    expect(hass.calls.map(({ domain, service }) => `${domain}.${service}`)).toEqual([
      'switch.turn_on',
      'cover.open_cover',
    ]);
    expect((card as unknown as { watched(): string[] }).watched()).toContain(
      'switch.model_y_sentry_mode',
    );
  });

  it('asks before an entity of the person’s own acts where it says so, never before its details open', async () => {
    const asked: unknown[] = [];
    const opened: unknown[] = [];
    const listen = (event: Event) => asked.push((event as CustomEvent).detail.config.tap_action);
    const open = (event: Event) => opened.push((event as CustomEvent).detail.entityId);
    document.body.addEventListener('hass-action', listen);
    window.addEventListener('hass-more-info', open);
    try {
      const hass = house();
      const card = await mount(
        {
          device: TESLA.device,
          controls: [
            { entity: 'switch.model_y_sentry_mode', confirm: true },
            { entity: 'sensor.model_y_odometer', confirm: true },
          ],
        },
        hass,
      );
      const rounds = root(card).querySelectorAll<HTMLButtonElement>('.vh-control');
      rounds[0]?.click();
      rounds[1]?.click();
      expect(asked).toEqual([
        expect.objectContaining({ perform_action: 'switch.turn_on', confirmation: true }),
      ]);
      expect(opened).toEqual(['sensor.model_y_odometer']);
      expect(hass.calls).toEqual([]);
    } finally {
      document.body.removeEventListener('hass-action', listen);
      window.removeEventListener('hass-more-info', open);
    }
  });

  it('counts the person’s own controls in its rows, their names never widening a cell', async () => {
    // at 7 a letter a 300 card's 260 holds four cells of 65: a long name is cut, the car's own words decide the row
    const card = await mount(
      {
        device: TESLA.device,
        controls: [
          'lock',
          'climate',
          { entity: 'switch.model_y_sentry_mode', name: 'A name far too long for its cell' },
          'trunk',
          { entity: 'cover.model_y_windows' },
        ],
      },
      house(),
      300,
      7,
    );
    expect(root(card).querySelectorAll('.vh-control')).toHaveLength(5);
    expect(
      (root(card).querySelector('.vh-controls') as HTMLElement).style.getPropertyValue('--vh-cols'),
    ).toBe('3');
  });

  it('reads roles written as a map as the list it means, and the editor shows them so (#251)', async () => {
    const card = await mount({
      device: TESLA.device,
      scan: false,
      roles: { battery: 'sensor.model_y_battery_level', lock: 'lock.model_y_lock', x: 4 },
    });
    expect(gauges(card)[0]?.figure).toBe('64%');
    expect(words(card)).toEqual(['Locked']);
    expect((card as unknown as { config: { roles: unknown } }).config.roles as unknown[]).toEqual([
      { role: 'battery', entity: 'sensor.model_y_battery_level' },
      { role: 'lock', entity: 'lock.model_y_lock' },
    ]);
  });

  it('reads the tyres as an American writes them, keys and roles, where the card names them no other way (#267)', async () => {
    const type = 'custom:fluvy-vehicle-card';
    const read = (config: Record<string, unknown>): Record<string, unknown> =>
      normaliseConfig({ type, ...config }, FluvyVehicleCard.aliases!);
    expect(read({ show_tires: true, tire_low: 2.1, tire_decimals: 1 })).toEqual({
      type,
      show_tyres: true,
      tyre_low: 2.1,
      tyre_decimals: 1,
    });
    // written both ways, the card's own word wins
    expect(read({ show_tyres: false, show_tires: true })).toEqual({ type, show_tyres: false });
    // a wheel's role in a list and in a map
    expect(
      read({
        roles: [
          { role: 'tire_fl', entity: 'sensor.fl' },
          { role: 'lock', entity: 'lock.car' },
        ],
      })['roles'],
    ).toEqual([
      { role: 'tyre_fl', entity: 'sensor.fl' },
      { role: 'lock', entity: 'lock.car' },
    ]);
    expect(read({ roles: { tire_rr: 'sensor.rr' } })['roles']).toEqual([
      { role: 'tyre_rr', entity: 'sensor.rr' },
    ]);
    expect(
      read({
        roles: [
          { role: 'tyre_fl', entity: 'sensor.a' },
          { role: 'tire_fl', entity: 'sensor.b' },
        ],
      })['roles'],
    ).toEqual([{ role: 'tyre_fl', entity: 'sensor.a' }]);
    // a config in the card's own words comes back as it was
    const own = { type, show_tyres: true, roles: [{ role: 'tyre_fl', entity: 'sensor.fl' }] };
    expect(normaliseConfig(own, FluvyVehicleCard.aliases!)).toBe(own);
    // and the card draws what it was asked in American
    const card = await mount({ device: TESLA.device, show_tires: true });
    expect(root(card).querySelectorAll('.vh-tyre')).toHaveLength(4);
  });
});

/** A gauge's label, its figure and its range, and its ruler's tone, in order. */
const gauges = (card: Mounted) =>
  [...root(card).querySelectorAll('.vh-hero')].map((hero) => ({
    label: text(hero.querySelector('.fv-readout__label')),
    figure: text(hero.querySelector('.ef-top > .fv-readout .fv-readout__value')),
    range: text(hero.querySelector('.ef-top__side')),
    tone: (hero.querySelector('fluvy-ruler') as unknown as { tone?: string } | null)?.tone,
    mark: hero.querySelector('.en-mark-label.is-mark') !== null,
  }));
const line = (card: Mounted): string => text(root(card).querySelector('.vh-line'));

describe('a car that burns fuel (#207)', () => {
  it('draws its tank in the battery’s place: its level in the gas tone, its range beside it, no limit', async () => {
    const card = await mount({ device: OCTAVIA.device });
    expect(gauges(card)).toEqual([
      { label: 'Fuel', figure: '41%', range: 'Range 562km', tone: 'gas', mark: false },
    ]);
    expect(line(card)).toBe('AdBlue low · 850 km');
    expect(words(card)).toEqual(['Locked', 'Bonnet']);
    expect(text(root(card).querySelector('.fv-badge'))).toBe('Parked');
    // the card's own colour paints it, as it does a battery
    document.body.replaceChildren();
    const teal = await mount({ device: OCTAVIA.device, color: 'teal' });
    expect(gauges(teal)[0]?.tone).toBe('accent');
  });

  it('says what calls the most: a low tank, then AdBlue, the oil, a service due; at rest its litres and its service', async () => {
    const at = async (
      car: CarFixture,
      changes: Record<string, Partial<HassEntity>> = {},
      config: Record<string, unknown> = {},
    ): Promise<{ line: string; tone: string | undefined }> => {
      const card = await mount({ device: car.device, ...config }, house(changes));
      const seen = { line: line(card), tone: gauges(card)[0]?.tone };
      document.body.replaceChildren();
      return seen;
    };
    expect(await at(SPORTAGE)).toEqual({ line: 'Service in 6,200 km', tone: 'gas' });
    expect(await at(SPORTAGE, { 'binary_sensor.sportage_fuel_low': { state: 'on' } })).toEqual({
      line: 'Low fuel',
      tone: 'warning',
    });
    expect(
      (await at(SPORTAGE, { 'binary_sensor.sportage_oil_warning': { state: 'on' } })).line,
    ).toBe('Check the oil');
    expect((await at(KUGA)).line).toBe('Check the oil');
    expect((await at(GOLF)).line).toBe('Service due');
    // under the card's own range it is low, whatever its level
    expect((await at(SPORTAGE, {}, { low_range: 450 })).line).toBe('Low fuel');
    expect((await at(CLIO, {}, { tank_size: 42 })).line).toBe('29 L in the tank');
    expect((await at(OCTAVIA, { 'binary_sensor.octavia_bonnet': { state: 'on' } })).line).toBe(
      'AdBlue low · 850 km',
    );
    expect(
      (
        await at(OCTAVIA, {
          'binary_sensor.octavia_bonnet': { state: 'on' },
          'sensor.octavia_adblue_range': { state: '3400' },
        })
      ).line,
    ).toBe('Bonnet open');
  });

  it('names what stands open alone where its line cannot say it is open, as a car’s own display does', async () => {
    // 11 a letter: half a section's 112 holds "Bonnet" (66) and "Windows" (77), not "Bonnet open" nor "Window open"
    const at = async (car: CarFixture, width: number, changes = {}): Promise<string> => {
      const card = await mount({ device: car.device }, house(changes), width, 11);
      const said = line(card);
      document.body.replaceChildren();
      return said;
    };
    const bonnet = {
      'binary_sensor.octavia_bonnet': { state: 'on' },
      'sensor.octavia_adblue_range': { state: '3400' },
    };
    expect(await at(OCTAVIA, 360, bonnet)).toBe('Bonnet open');
    expect(await at(OCTAVIA, 152, bonnet)).toBe('Bonnet');
    expect(await at(KIA, 360)).toBe('Window open');
    expect(await at(KIA, 152)).toBe('Windows');
  });

  it('fills its tank from its litres and the card’s tank_size, else says the litres it holds', async () => {
    const litres = await mount({ device: CLIO.device });
    expect(gauges(litres)[0]).toMatchObject({ label: 'Fuel', figure: '29L', range: 'Range 512km' });
    expect(root(litres).querySelector('fluvy-ruler')?.hasAttribute('inactive')).toBe(true);
    document.body.replaceChildren();
    const filled = await mount({ device: CLIO.device, tank_size: 42 });
    expect(gauges(filled)[0]?.figure).toBe('69%');
  });

  it('draws a plug-in hybrid’s battery and its tank, each with its range, the charge’s line under both', async () => {
    const card = await mount({ device: NIRO.device, energy: 'hybrid' });
    expect(gauges(card)).toEqual([
      { label: 'Battery', figure: '64%', range: 'Range 38km', tone: 'accent', mark: true },
      { label: 'Fuel', figure: '54%', range: 'Range 520km', tone: 'gas', mark: false },
    ]);
    expect(line(card)).toBe('Charging to 100 %');
    expect(text(root(card).querySelector('.fv-badge'))).toBe('Charging · 3.3 kW');
    // a hybrid's tank tapped opens its own details
    const covers = [...root(card).querySelectorAll('.vh-hero .fv-tile__tap')];
    expect(covers.map((cover) => cover.getAttribute('aria-label'))).toEqual([
      'Battery · 64 %',
      'Fuel · 54 %',
    ]);
  });

  it('draws a car with a battery as it did, a hybrid’s too, until the card says otherwise', async () => {
    const card = await mount({ device: NIRO.device });
    expect(gauges(card).map((g) => g.label)).toEqual(['Battery']);
    document.body.replaceChildren();
    const fuel = await mount({ device: NIRO.device, energy: 'fuel' });
    expect(gauges(fuel).map((g) => g.label)).toEqual(['Fuel']);
  });

  it('draws a hybrid’s strip as one ring in two halves, its compact card as two bars led by their glyphs', async () => {
    const mini = await mount({ device: NIRO.device, energy: 'hybrid', variant: 'mini' });
    const ring = root(mini).querySelector('.vh-ring--halves');
    expect(ring?.querySelectorAll('.vh-ring__fill')).toHaveLength(2);
    expect(text(root(mini).querySelector('.fv-row__sub'))).toBe(
      '64 % · Fuel 54 % · 558 km · Charging · 3.3 kW · Home',
    );
    document.body.replaceChildren();
    const compact = await mount({ device: NIRO.device, energy: 'hybrid', variant: 'compact' });
    expect(root(compact).querySelectorAll('.vh-bar')).toHaveLength(2);
    expect(root(compact).querySelectorAll('.vh-bar__glyph')).toHaveLength(2);
    expect(text(root(compact).querySelector('.fv-card__sub'))).toBe('558 km · Home');
    document.body.replaceChildren();
    const petrol = await mount({ device: SPORTAGE.device, variant: 'compact' });
    expect(root(petrol).querySelectorAll('.vh-bar__glyph')).toHaveLength(0);
    expect(text(root(petrol).querySelector('.vh-bar__value'))).toBe('47 %');
  });

  it('says its AdBlue, its oil, its litres and its next service in rows of their own', async () => {
    const rows = async (config: Record<string, unknown>) => {
      const card = await mount(config);
      const seen = [...root(card).querySelectorAll('.vh-rows .fv-row')].map((row) => ({
        row: text(row),
        warning: row.querySelector('.fv-ico--warning') !== null,
      }));
      document.body.replaceChildren();
      return seen;
    };
    expect(await rows({ device: OCTAVIA.device, rows: ['adblue', 'service'] })).toEqual([
      { row: 'AdBlue 850 km', warning: true },
      { row: 'Next service 4,200 km · 63 d', warning: false },
    ]);
    expect(
      await rows({
        device: XC60.device,
        energy: 'hybrid',
        rows: ['oil', 'fuel_volume', 'fuel_range', 'service'],
      }),
    ).toEqual([
      { row: 'Oil OK', warning: false },
      { row: 'In the tank 38 L', warning: false },
      { row: 'Fuel range 486 km', warning: false },
      { row: 'Next service 9,300 km · 148 d', warning: false },
    ]);
    expect(await rows({ device: GOLF.device, rows: ['service', 'oil'] })).toEqual([
      { row: 'Next service Due', warning: true },
      { row: 'Oil 70 %', warning: false },
    ]);
  });

  it('reads a service’s date as the days to it, an integration’s drive by its name (CarConnectivity)', async () => {
    const passat: CarFixture = {
      device: 'd-passat',
      name: 'Passat',
      platform: 'mqtt',
      seeds: [
        ['sensor.passat_tank_primary', '58', undefined, { unit_of_measurement: '%' }],
        ['sensor.passat_total_range', '640', undefined, { unit_of_measurement: 'km' }],
        [
          'sensor.passat_adblue_range_primary',
          '4100',
          undefined,
          { unit_of_measurement: 'km', device_class: 'distance' },
        ],
        [
          'sensor.passat_inspection_due_at',
          '2026-12-04T11:47:12+00:00',
          undefined,
          { device_class: 'timestamp' },
        ],
        [
          'sensor.passat_inspection_due_after',
          '2500',
          undefined,
          { unit_of_measurement: 'km', device_class: 'distance' },
        ],
      ],
    };
    const card = await mount(
      { device: passat.device, rows: ['adblue', 'service'] },
      carHouse([passat]),
    );
    expect(gauges(card)[0]).toMatchObject({ label: 'Fuel', figure: '58%', range: 'Range 640km' });
    expect([...root(card).querySelectorAll('.vh-rows .fv-row')].map((row) => text(row))).toEqual([
      'AdBlue 4,100 km',
      'Next service 2,500 km · 30 d',
    ]);
    expect(line(card)).toBe('Service in 2,500 km');
  });

  it('keeps its anatomy out of reach: its tank still, its values dashes', async () => {
    const live = await mount({ device: KUGA.device });
    const anatomy = sections(live);
    document.body.replaceChildren();
    const gone = await mount({ device: KUGA.device }, house(away(KUGA)));
    expect(sections(gone)).toEqual(anatomy);
    expect(text(root(gone).querySelector('.fv-badge'))).toBe('Unavailable');
    expect(gauges(gone)[0]).toMatchObject({ label: 'Fuel', figure: '—', tone: 'off' });
  });

  it('declares a hybrid’s second gauge in its height, from its config alone', () => {
    const at = (config: Record<string, unknown>) =>
      FluvyVehicleCard.layoutHeight({ type: 'x', ...config } as LovelaceCardConfig);
    expect(at({ energy: 'fuel' })).toBe(at({}));
    expect(at({ energy: 'auto', hero: 'ring' })).toBe(at({ hero: 'ring' }));
    expect(at({ energy: 'hybrid' })).toBe(at({}) + 16 + 140);
    expect(at({ energy: 'hybrid', hero: 'ring' })).toBe(at({ energy: 'hybrid' }));
    expect(at({ energy: 'hybrid', variant: 'compact' })).toBe(at({ variant: 'compact' }) + 28);
    expect(at({ energy: 'hybrid', variant: 'mini' })).toBe(76);
  });
});

describe('the controls in the editor (#248)', () => {
  it('reads an entity of the person’s own as the picker’s own word, and writes it back as its entity', async () => {
    const { lists } = await import('./vehicle-editor.js');
    const controls = lists.find((list) => list.key === 'controls');
    const read = (raw: unknown) => controls?.read?.(raw);
    const write = (item: Record<string, unknown>) => controls?.write?.(item);
    expect(read('lock')).toEqual({ control: 'lock' });
    expect(read('switch.haval_engine')).toEqual({
      control: 'entity',
      entity: 'switch.haval_engine',
    });
    expect(read({ entity: 'switch.haval_engine', name: 'Engine' })).toEqual({
      control: 'entity',
      entity: 'switch.haval_engine',
      name: 'Engine',
    });
    expect(
      write({ control: 'entity', entity: 'switch.haval_engine', name: '', confirm: true }),
    ).toEqual({ entity: 'switch.haval_engine', confirm: true });
    // picked, before its entity is: kept in the list
    expect(write({ control: 'entity' })).toEqual({ control: 'entity' });
    expect(write({ control: 'trunk', name: 'Tailgate', icon: '' })).toEqual({
      control: 'trunk',
      name: 'Tailgate',
    });
    const fields = (item: Record<string, unknown>) =>
      JSON.stringify(controls?.schemaOf?.(item)).match(/"name":"\w+"/g);
    expect(fields({ control: 'entity' })).toContain('"name":"entity"');
    expect(fields({ control: 'lock' })).not.toContain('"name":"entity"');
  });
});

describe('the battery and the tank as a liquid (#256)', () => {
  const water = (card: Mounted): HTMLElement[] => [
    ...root(card).querySelectorAll<HTMLElement>('.vh-liquid > .fc-water'),
  ];
  const tones = (card: Mounted): string[] =>
    water(card).map((el) => [...el.classList].find((name) => name.startsWith('fv-tone--')) ?? '');

  it('draws the water in the marked ruler’s room, the value row over it as it was, at the ruler’s height', async () => {
    const ruler = await mount({ device: TESLA.device });
    const row = text(root(ruler).querySelector('.ef-top'));
    document.body.replaceChildren();
    const card = await mount({ device: TESLA.device, hero: 'liquid' });
    const r = root(card);
    expect(text(r.querySelector('.ef-top'))).toBe(row);
    expect(r.querySelector('.vh-hero fluvy-ruler')).toBeNull();
    const [band] = water(card);
    expect(band?.style.width).toBe('320px');
    expect(band?.style.height).toBe('64px');
    // the drawing alone: the row says the figure
    expect(band?.querySelector('.fc-reading')).toBeNull();
    // its tap is the battery's, as the ruler's
    expect(r.querySelector('.vh-hero > .fv-tile__tap')?.getAttribute('aria-label')).toBe(
      'Battery · 64 %',
    );
    const at = (config: Record<string, unknown>) =>
      FluvyVehicleCard.layoutHeight({ type: 'x', ...config } as LovelaceCardConfig);
    expect(at({ hero: 'liquid' })).toBe(at({}));
    expect(at({ hero: 'liquid', energy: 'hybrid' })).toBe(at({ energy: 'hybrid' }));
  });

  it('wears the ruler’s tones: the card’s colour, the gas tone for a tank, the warning’s when low, none out of reach', async () => {
    expect(tones(await mount({ device: TESLA.device, hero: 'liquid' }))).toEqual([
      'fv-tone--accent',
    ]);
    document.body.replaceChildren();
    expect(tones(await mount({ device: CLIO.device, hero: 'liquid', tank_size: 42 }))).toEqual([
      'fv-tone--gas',
    ]);
    document.body.replaceChildren();
    // a tank running low: the water, the range's figure and the line say so together
    const low = await mount(
      { device: SPORTAGE.device, hero: 'liquid' },
      house({ 'binary_sensor.sportage_fuel_low': { state: 'on' } }),
    );
    expect(tones(low)).toEqual(['fv-tone--warning']);
    expect(root(low).querySelector('.vh-hero')?.classList.contains('is-low')).toBe(true);
    expect(text(root(low).querySelector('.vh-line'))).toBe('Low fuel');
    document.body.replaceChildren();
    // out of reach: the band keeps its room, empty, the row a dash
    const gone = await mount({ device: TESLA.device, hero: 'liquid' }, house(away(TESLA)));
    expect(tones(gone)).toEqual(['fv-tone--neutral']);
    expect(water(gone)[0]?.querySelector('.fc-wave')).toBeNull();
    expect(water(gone)[0]?.style.height).toBe('64px');
    expect(text(root(gone).querySelector('.ef-top'))).toContain('—');
  });

  it('draws both of a hybrid’s gauges as liquids, a lone gauge’s ring as it was, the compact card’s bars', async () => {
    const hybrid = await mount({ device: NIRO.device, energy: 'hybrid', hero: 'liquid' });
    expect(tones(hybrid)).toEqual(['fv-tone--accent', 'fv-tone--gas']);
    expect(root(hybrid).querySelector('fluvy-ruler')).toBeNull();
    document.body.replaceChildren();
    const ring = await mount({ device: TESLA.device, hero: 'ring' });
    expect(root(ring).querySelector('fluvy-dial')).not.toBeNull();
    expect(water(ring)).toHaveLength(0);
    document.body.replaceChildren();
    const compact = await mount({ device: TESLA.device, hero: 'liquid', variant: 'compact' });
    expect(water(compact)).toHaveLength(0);
    expect(root(compact).querySelector('.vh-bar')).not.toBeNull();
  });

  it('lets bubbles rise while the battery charges, as fast as it fills; none at rest, and still where motion is off', async () => {
    // 64 % to its limit of 80 % in 1 h 25 min: the tank's quicker waves, six bubbles
    const charging = await mount({ device: TESLA.device, hero: 'liquid' });
    const [band] = water(charging);
    expect(band?.classList.contains('fc-water--tank')).toBe(true);
    expect(band?.classList.contains('is-still')).toBe(false);
    expect(band?.querySelectorAll('.fc-bubble')).toHaveLength(6);
    document.body.replaceChildren();
    // a fast charger fills it briskly: twice the bubbles
    const fast = await mount(
      { device: TESLA.device, hero: 'liquid' },
      house({ 'sensor.model_y_time_to_full_charge': { state: '2026-11-04T12:07:12+00:00' } }),
    );
    expect(water(fast)[0]?.querySelectorAll('.fc-bubble')).toHaveLength(12);
    document.body.replaceChildren();
    // a car that does not say when it is full fills at a home charger's pace
    const unsaid = await mount(
      { device: TESLA.device, hero: 'liquid' },
      house({ 'sensor.model_y_time_to_full_charge': { state: 'unknown' } }),
    );
    expect(water(unsaid)[0]?.querySelectorAll('.fc-bubble')).toHaveLength(6);
    document.body.replaceChildren();
    // not charging: the liquid's two slow waves, no bubble
    const parked = await mount(
      { device: TESLA.device, hero: 'liquid' },
      house({
        'sensor.model_y_charging': { state: 'disconnected' },
        'binary_sensor.model_y_charge_cable': { state: 'off' },
        'sensor.model_y_charger_power': { state: '0' },
      }),
    );
    expect(water(parked)[0]?.classList.contains('fc-water--tank')).toBe(false);
    expect(water(parked)[0]?.querySelectorAll('.fc-bubble')).toHaveLength(0);
    document.body.replaceChildren();
    // the card's own `animate: false`: its first frame, whatever the house says
    const still = await mount({ device: TESLA.device, hero: 'liquid', animate: false });
    expect(water(still)[0]?.classList.contains('is-still')).toBe(true);
    document.body.replaceChildren();
    // a hybrid's tank never bubbles, its battery does while it charges
    const hybrid = await mount({ device: NIRO.device, energy: 'hybrid', hero: 'liquid' });
    expect(water(hybrid).map((el) => el.querySelectorAll('.fc-bubble').length > 0)).toEqual([
      true,
      false,
    ]);
  });

  it('marks the charge limit as a hairline across the water at its level, none where it is hidden or the brim', async () => {
    const card = await mount({ device: TESLA.device, hero: 'liquid' });
    const mark = root(card).querySelector<HTMLElement>('.vh-liquid__limit');
    // 80 % of a 64 band: 13 from its top (12.8)
    expect(mark?.style.top).toBe('13px');
    expect(text(mark)).toBe('');
    document.body.replaceChildren();
    const hidden = await mount({ device: TESLA.device, hero: 'liquid', show_limit: false });
    expect(root(hidden).querySelector('.vh-liquid__limit')).toBeNull();
    document.body.replaceChildren();
    const brim = await mount(
      { device: TESLA.device, hero: 'liquid' },
      house({ 'number.model_y_charge_limit': { state: '100' } }),
    );
    expect(root(brim).querySelector('.vh-liquid__limit')).toBeNull();
    document.body.replaceChildren();
    // a tank has no limit
    const tank = await mount({ device: SPORTAGE.device, hero: 'liquid' });
    expect(root(tank).querySelector('.vh-liquid__limit')).toBeNull();
  });

  it('offers the liquid in the editor, a hybrid’s rulers or liquids, and its motion while it is one', async () => {
    const { choices, getConfigForm, defaults } = await import('./vehicle-editor.js');
    const looks = (config: Record<string, unknown>) =>
      choices({ type: 'x', ...config } as LovelaceCardConfig, undefined)['hero']?.map(
        (option) => option.value,
      );
    // a lone gauge keeps the form's own three; a hybrid's two gauges are never rings
    expect(looks({})).toBeUndefined();
    expect(JSON.stringify(getConfigForm().schema)).toContain('"value":"liquid"');
    expect(looks({ energy: 'hybrid' })).toEqual(['ruler', 'liquid']);
    const shown = (data: Record<string, unknown>) =>
      fieldsShown(getConfigForm().schema, { ...defaults({ type: 'x' }, undefined), ...data });
    expect(shown({})).toContain('hero');
    expect(shown({ energy: 'hybrid' })).toContain('hero');
    expect(shown({})).not.toContain('animate');
    expect(shown({ hero: 'liquid' })).toContain('animate');
    expect(shown({ hero: 'liquid', show_hero: false })).not.toContain('animate');
    expect(shown({ hero: 'liquid', variant: 'compact' })).not.toContain('hero');
  });
});

describe('the card’s parts in an order of its own (#266)', () => {
  const at = (config: Record<string, unknown>) =>
    FluvyVehicleCard.layoutHeight({ type: 'x', ...config } as LovelaceCardConfig);
  const parts = (config: Record<string, unknown>) =>
    vehicleSections({ type: 'x', ...config } as LovelaceCardConfig);

  it('draws all of them as they stand where it names none', () => {
    expect(parts({})).toEqual(['head', 'hero', 'controls', 'rows']);
    expect(
      parts({
        image: '/local/car.png',
        show_tyres: true,
        map: 'auto',
        quick_actions: ['sensor.x'],
      }),
    ).toEqual(['head', 'image', 'hero', 'controls', 'rows', 'tyres', 'map', 'quick_actions']);
    expect(parts({ show_head: false, show_controls: false, rows: [] })).toEqual(['hero']);
    // the battery's line alone still stands in its place
    expect(parts({ show_hero: false })).toContain('hero');
    expect(parts({ show_hero: false, show_status: false })).not.toContain('hero');
    // the compact card has no picture, rows, tyres or map
    expect(
      parts({ variant: 'compact', image: '/local/car.png', show_tyres: true, map: 'auto' }),
    ).toEqual(['head', 'hero', 'controls']);
  });

  it('draws the parts it names, in their order, each once, the rest left out; a name it does not know dropped', () => {
    expect(parts({ sections: ['controls', 'hero', 'head'] })).toEqual(['controls', 'hero', 'head']);
    expect(parts({ sections: ['head', 'head', 'rows', 'fuel', 'constructor', 7] })).toEqual([
      'head',
      'rows',
    ]);
    // an empty list names none: all of them as they stand
    expect(parts({ sections: [] })).toEqual(['head', 'hero', 'controls', 'rows']);
    // (only names it does not know: nothing to draw)
    expect(parts({ sections: ['fuel'] })).toEqual([]);
    // an explicit `show_…: false` still hides a part it names; naming the tyres asks for them
    expect(parts({ sections: ['head', 'hero', 'controls'], show_head: false })).toEqual([
      'hero',
      'controls',
    ]);
    expect(parts({ sections: ['head', 'tyres'] })).toEqual(['head', 'tyres']);
    expect(parts({ sections: ['head', 'tyres'], show_tyres: false })).toEqual(['head']);
    // a part with nothing to draw is not drawn for being named: no picture, no map, no quick action
    expect(parts({ sections: ['image', 'map', 'quick_actions', 'hero'] })).toEqual(['hero']);
    expect(parts({ sections: ['image'], image: '/x.png', image_position: 'head' })).toEqual([]);
    expect(parts({ sections: ['map', 'hero'], map: [] })).toEqual(['hero']);
    expect(parts({ sections: ['rows', 'tyres', 'map', 'head'], variant: 'compact' })).toEqual([
      'head',
    ]);
  });

  it('declares its height by the parts it draws, whatever their order', () => {
    expect(at({ sections: ['head', 'hero', 'controls', 'rows'] })).toBe(at({}));
    expect(at({ sections: ['rows', 'controls', 'hero', 'head'] })).toBe(at({}));
    expect(at({ sections: ['head', 'hero'] })).toBe(40 + 44 + 16 + 140 + 8 + 20);
    expect(at({ sections: ['hero', 'head'], show_status: false })).toBe(40 + 44 + 16 + 140);
    expect(at({ sections: ['hero'], show_hero: false })).toBe(40 + 20);
    expect(at({ sections: ['head', 'tyres'] })).toBe(40 + 44 + 16 + 96);
    expect(at({ sections: ['controls'] })).toBe(40 + 64);
    expect(at({ sections: [] })).toBe(at({}));
    expect(at({ sections: ['fuel'] })).toBe(40);
    expect(at({ sections: ['hero', 'head'], energy: 'hybrid', hero: 'liquid' })).toBe(
      40 + 44 + 16 + 140 + 16 + 140 + 8 + 20,
    );
    expect(at({ sections: ['controls', 'hero', 'head'], variant: 'compact' })).toBe(
      at({ variant: 'compact' }),
    );
    // the strip has no parts
    expect(at({ sections: ['head'], variant: 'mini' })).toBe(76);
  });

  it('draws them in that order: the line under the battery wherever it stands, a head that is not first as a part', async () => {
    const card = await mount({
      device: TESLA.device,
      sections: ['controls', 'hero', 'tyres', 'head'],
    });
    expect(sections(card)).toEqual([
      'div.vh-controls',
      'div.vh-hero',
      'p.vh-line',
      'div.vh-tyres',
      'div.fv-card__head.fv-card__head--hold.fv-card__head--tap',
    ]);
    document.body.replaceChildren();
    // the line alone where the battery is hidden; rows named alone
    const line = await mount({
      device: TESLA.device,
      sections: ['rows', 'hero'],
      show_hero: false,
    });
    expect(sections(line)).toEqual(['div.vh-rows', 'p.vh-line']);
    document.body.replaceChildren();
    // out of reach, the same anatomy
    const config = { device: TESLA.device, sections: ['hero', 'controls', 'head'] };
    const anatomy = sections(await mount(config));
    document.body.replaceChildren();
    expect(sections(await mount(config, house(away(TESLA))))).toEqual(anatomy);
  });

  it('draws only the compact card’s parts of them, and none on the strip', async () => {
    const compact = await mount({
      device: TESLA.device,
      variant: 'compact',
      sections: ['controls', 'rows', 'tyres', 'hero', 'head'],
    });
    expect(sections(compact)).toEqual([
      'div.vh-controls.vh-controls--bare',
      'div.vh-hero',
      'p.vh-line',
      'div.fv-card__head.fv-card__head--hold.fv-card__head--tap',
    ]);
    document.body.replaceChildren();
    const strip = await mount({ device: TESLA.device, variant: 'mini', sections: ['rows'] });
    expect(root(strip).querySelector('.vh-card--mini')).not.toBeNull();
    expect(root(strip).querySelector('.fv-row__title')).not.toBeNull();
  });

  it('says where it is in the head once its rows are not drawn, and keeps the picture the card’s button without a head', async () => {
    // no row says the place: the head does
    const card = await mount({ device: TESLA.device, sections: ['head', 'hero'] });
    expect(text(root(card).querySelector('.fv-card__sub'))).toBe('Home');
    document.body.replaceChildren();
    const pictured = await mount({
      device: TESLA.device,
      image: 'data:image/svg+xml,%3Csvg%2F%3E',
      sections: ['hero', 'image'],
    });
    expect(sections(pictured)).toEqual(['div.vh-hero', 'p.vh-line', 'span.vh-picture']);
    expect(root(pictured).querySelector('.vh-picture > .fv-tile__tap')).not.toBeNull();
  });

  it('offers the parts it can draw in the editor, in today’s order by default, a part’s switch while it has no list', async () => {
    const { choices, getConfigForm, defaults } = await import('./vehicle-editor.js');
    const offered = (config: Record<string, unknown>) =>
      choices({ type: 'x', ...config } as LovelaceCardConfig, undefined)['sections']?.map(
        (option) => option.value,
      );
    expect(offered({})).toEqual(['head', 'hero', 'controls', 'rows', 'tyres']);
    expect(offered({ image: '/x.png', map: 'auto', quick_actions: ['sensor.x'] })).toEqual([
      'head',
      'image',
      'hero',
      'controls',
      'rows',
      'tyres',
      'map',
      'quick_actions',
    ]);
    expect(offered({ image: '/x.png', image_position: 'head', variant: 'compact' })).toEqual([
      'head',
      'hero',
      'controls',
    ]);
    // every part is named: none is its key
    for (const option of choices({ type: 'x', image: '/x.png', map: 'auto' }, undefined)[
      'sections'
    ] ?? [])
      expect(option.label).not.toMatch(/[._]/);
    // what it shows where the config names none: what the card draws, in its order
    expect(defaults({ type: 'x', show_tyres: true }, undefined)['sections']).toEqual([
      'head',
      'hero',
      'controls',
      'rows',
      'tyres',
    ]);
    const shown = (data: Record<string, unknown>) =>
      fieldsShown(getConfigForm().schema, { ...defaults({ type: 'x' }, undefined), ...data });
    expect(shown({})).toContain('sections');
    expect(shown({ variant: 'mini' })).not.toContain('sections');
    for (const name of ['show_head', 'show_hero', 'show_controls', 'show_rows', 'show_tyres']) {
      expect(shown({}), name).toContain(name);
      expect(shown({ sections: ['head', 'hero'] }), name).not.toContain(name);
    }
    // a part its switch hides can be shown again while a list is set (the tyres' is off by default: the list asks)
    expect(shown({ sections: ['head', 'hero'], show_head: false })).toContain('show_head');
    expect(shown({ sections: ['head', 'hero'], show_head: false })).not.toContain('show_hero');
    // a list that is the one drawn without it changes nothing: the switches stay
    expect(shown({ sections: ['head', 'hero', 'controls', 'rows'] })).toContain('show_head');
    // what acts on a part follows the list: the battery's look, its taps, the tyres' decimals
    expect(shown({ sections: ['head', 'controls'] })).not.toContain('hero');
    expect(shown({ sections: ['head', 'controls'] })).not.toContain('hero_tap_action');
    expect(shown({ sections: ['head', 'tyres'] })).toContain('tyre_decimals');
  });
});

/** A ResizeObserver a test tells: what changed size, every observer watching it is told. */
class Sizes {
  static made: Sizes[] = [];
  readonly watched = new Set<Element>();
  constructor(readonly told: () => void) {
    Sizes.made.push(this);
  }
  observe(target: Element): void {
    this.watched.add(target);
  }
  unobserve(target: Element): void {
    this.watched.delete(target);
  }
  disconnect(): void {
    this.watched.clear();
  }
  static change(target: Element): void {
    for (const one of Sizes.made) if (one.watched.has(target)) one.told();
  }
}

/** Home Assistant's map card as its helpers make it: what it was last told. */
class MapStub extends HTMLElement {
  static made: MapStub[] = [];
  config: LovelaceCardConfig | undefined;
  layout: string | undefined;
  hass: unknown;
  constructor() {
    super();
    MapStub.made.push(this);
  }
  setConfig(config: LovelaceCardConfig): void {
    this.config = config;
  }
}
if (!customElements.get('vehicle-map-stub')) customElements.define('vehicle-map-stub', MapStub);

/**
 * Home Assistant's map card in its own shape (`hui-map-card`): a root of its own, drawn a moment after it is connected
 * (as Lit draws, settling `updateComplete` then), holding `#root` with its `ha-map` (a root of its own again: the zoom
 * keys, the tiles' attribution) and its own keys (`#buttons`).
 */
class ShapedMap extends MapStub {
  readonly updateComplete: Promise<void>;
  private connected = (): void => undefined;
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.updateComplete = new Promise<void>((resolve) => {
      this.connected = resolve;
    }).then(() => this.draw());
  }
  connectedCallback(): void {
    this.connected();
  }
  /** Its map drawn again: a new `ha-map`, whose root holds nothing of anyone else's. */
  draw(): void {
    const root = this.shadowRoot as ShadowRoot;
    root.innerHTML = '<ha-card id="card"><div id="root"><div id="buttons"></div></div></ha-card>';
    const map = document.createElement('ha-map');
    map.attachShadow({ mode: 'open' }).innerHTML =
      '<div id="map"><div class="maplibregl-ctrl-group"></div><details class="maplibregl-ctrl-attrib"></details></div>';
    root.querySelector('#root')?.prepend(map);
  }
}
if (!customElements.get('vehicle-shaped-map'))
  customElements.define('vehicle-shaped-map', ShapedMap);

describe('the mini map (#266)', () => {
  /** A car's tracker saying where it is. */
  const placed = (id: string, state = 'home'): Record<string, Partial<HassEntity>> => ({
    [id]: {
      state,
      attributes: { friendly_name: 'Location', latitude: 52.2053, longitude: 0.1218 },
    },
  });
  const TRACKER = 'device_tracker.model_y_location';
  const plate = (card: Mounted): HTMLElement =>
    root(card).querySelector<HTMLElement>('.vh-map') as HTMLElement;
  /** The plate laid out, and Home Assistant's map made on it. */
  const laidOut = async (card: Mounted): Promise<void> => {
    const box = plate(card);
    Object.defineProperty(box, 'clientWidth', { value: 320, configurable: true });
    Object.defineProperty(box, 'clientHeight', { value: 160, configurable: true });
    Sizes.change(box);
    for (let i = 0; i < 3; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await card.updateComplete;
    }
  };
  const pill = (card: Mounted): string => text(root(card).querySelector('.vh-map__pill'));

  beforeEach(() => {
    Sizes.made = [];
    MapStub.made = [];
    vi.stubGlobal('ResizeObserver', Sizes);
    window.loadCardHelpers = () =>
      Promise.resolve({
        createCardElement: (config: LovelaceCardConfig) => {
          const element = document.createElement('vehicle-map-stub') as MapStub;
          element.setConfig(config);
          return element;
        },
      });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.loadCardHelpers;
  });

  it('draws no map until the card names one, and declares its plate by its size', async () => {
    const card = await mount({ device: TESLA.device }, house(placed(TRACKER)));
    expect(root(card).querySelector('.vh-map')).toBeNull();
    expect(MapStub.made).toHaveLength(0);
    const at = (config: Record<string, unknown>) =>
      FluvyVehicleCard.layoutHeight({ type: 'x', ...config } as LovelaceCardConfig);
    expect(at({ map: 'auto' })).toBe(at({}) + 16 + 160);
    expect(at({ map: ['auto', 'person.ona'] })).toBe(at({}) + 16 + 160);
    expect(at({ map: 'auto', map_size: '120px' })).toBe(at({}) + 16 + 120);
    expect(at({ map: 'auto', map_size: '50%' })).toBe(at({}) + 16 + 80);
    expect(at({ map: '' })).toBe(at({}));
    expect(at({ map: [] })).toBe(at({}));
    expect(at({ map: 'auto', variant: 'compact' })).toBe(at({ variant: 'compact' }));
    // its other keys never change it
    expect(
      at({ map: 'auto', map_zoom: 16, hours_to_show: 6, show_address: false, map_theme: 'dark' }),
    ).toBe(at({ map: 'auto' }));
  });

  it('makes Home Assistant’s own map of the car’s tracker once its plate has a box, after the tyres and before the small icons', async () => {
    const card = await mount(
      { device: TESLA.device, map: 'auto', show_tyres: true, quick_actions: [TRACKER] },
      house(placed(TRACKER)),
    );
    expect(sections(card).slice(-3)).toEqual(['div.vh-tyres', 'div.vh-map', 'div.vh-quick']);
    expect(plate(card).style.width).toBe('320px');
    expect(plate(card).style.height).toBe('160px');
    // no box yet (folded in an Expander): no map, the plate keeps its place
    expect(MapStub.made).toHaveLength(0);
    await laidOut(card);
    expect(MapStub.made).toHaveLength(1);
    const map = MapStub.made[0] as MapStub;
    expect(map.config).toEqual({
      type: 'map',
      entities: [TRACKER],
      auto_fit: true,
      theme_mode: 'light',
    });
    expect(map.layout).toBe('grid');
    expect(map.hass).toBeDefined();
    expect(plate(card).contains(map)).toBe(true);
    expect(plate(card).classList.contains('is-empty')).toBe(false);
  });

  it('asks it for the trackers, the zoom, the trail and the mode the card names', async () => {
    const dark = { ...house(placed(TRACKER)), themes: { darkMode: true, themes: {} } };
    const card = await mount(
      {
        device: TESLA.device,
        map: ['auto', 'person.ona', { entity: 'device_tracker.ev6_location', label_mode: 'icon' }],
        map_zoom: 31,
        hours_to_show: 6,
      },
      dark as unknown as HomeAssistant,
    );
    await laidOut(card);
    // the car's first, an entry of Home Assistant's own kept as it is, the zoom held to 20, the card's own mode
    expect(MapStub.made[0]?.config).toEqual({
      type: 'map',
      entities: [
        TRACKER,
        'person.ona',
        { entity: 'device_tracker.ev6_location', label_mode: 'icon' },
      ],
      hours_to_show: 6,
      default_zoom: 20,
      auto_fit: true,
      theme_mode: 'dark',
    });
    document.body.replaceChildren();
    MapStub.made = [];
    // always light, whatever the card's mode; what is no entity is left out
    const light = await mount(
      { device: TESLA.device, map: ['auto', 'nonsense', { name: 'x' }, 7], map_theme: 'light' },
      dark as unknown as HomeAssistant,
    );
    await laidOut(light);
    expect(MapStub.made[0]?.config).toEqual({
      type: 'map',
      entities: [TRACKER],
      auto_fit: true,
      theme_mode: 'light',
    });
  });

  it('tells its map again when what it asks of it changes, and the house as it hears of it', async () => {
    const hass = house(placed(TRACKER));
    const card = await mount({ device: TESLA.device, map: 'auto' }, hass);
    await laidOut(card);
    const map = MapStub.made[0] as MapStub;
    card.setConfig({
      type: 'custom:fluvy-vehicle-card',
      _now: NOW,
      device: TESLA.device,
      map: 'auto',
      map_zoom: 12,
    } as LovelaceCardConfig);
    await card.updateComplete;
    expect(map.config).toMatchObject({ default_zoom: 12 });
    const next = house(placed(TRACKER, 'not_home'));
    card.hass = next;
    await card.updateComplete;
    expect(map.hass).toBe(next);
    expect(MapStub.made).toHaveLength(1);
  });

  it('says where it is in a pill over its foot: its address away from home, else its place; the head no longer does', async () => {
    // at home: the place's word, in the pill alone
    const home = await mount({ device: KIA.device, map: 'auto', rows: [] }, house(), 360, 7);
    expect(pill(home)).toBe('Home');
    // (its last report is two hours old: the head still says so)
    expect(text(root(home).querySelector('.fv-card__sub'))).toBe('Updated 2 h ago');
    document.body.replaceChildren();
    // away: its address, whole
    const away = house({ 'device_tracker.ev6_location': { state: 'not_home' } });
    const card = await mount({ device: KIA.device, map: 'auto', rows: [] }, away, 360, 7);
    expect(pill(card)).toBe('Carrer de Mallorca 401');
    expect(text(root(card).querySelector('.fv-card__sub'))).not.toContain('Mallorca');
    const button = root(card).querySelector<HTMLButtonElement>('button.vh-map__where');
    expect(button?.getAttribute('aria-label')).toBe('Location · Carrer de Mallorca 401');
    // it opens the tracker's details
    const opened: unknown[] = [];
    const open = (event: Event) => opened.push((event as CustomEvent).detail.entityId);
    window.addEventListener('hass-more-info', open);
    button?.click();
    window.removeEventListener('hass-more-info', open);
    expect(opened).toEqual(['device_tracker.ev6_location']);
    document.body.replaceChildren();
    // without the pill, the head says it as before
    const plain = await mount(
      { device: KIA.device, map: 'auto', rows: [], show_address: false },
      away,
    );
    expect(root(plain).querySelector('.vh-map__where')).toBeNull();
    expect(text(root(plain).querySelector('.fv-card__sub'))).toContain('Carrer de Mallorca 401');
  });

  it('fits the address by its leading parts, then the place’s word, then the pin alone: never cut', async () => {
    const address = (state: string): HomeAssistant =>
      house({
        ...placed('device_tracker.ev6_location', 'not_home'),
        'sensor.ev6_geocoded_location': { state },
      });
    const long = '14 Station Road, Cambridge CB1 2JB, United Kingdom';
    // at 7 a letter, a pill is its words, its pin's 22 and its sides' 24 on the 4 grid; it stands 8 in and ends 8 short
    // of Home Assistant's folded attribution (its 24 "i", 10 from the plate's end): the plate's width less 50, whether
    // the map is drawn or not
    const said = async (width: number): Promise<string> => {
      const card = await mount({ device: KIA.device, map: 'auto' }, address(long), width, 7);
      const words = pill(card);
      // whatever it shows, a reader hears the whole address
      expect(root(card).querySelector('.vh-map__where')?.getAttribute('aria-label')).toBe(
        `Location · ${long}`,
      );
      // and it says the same once Home Assistant's map lands on the plate
      await laidOut(card);
      expect(plate(card).classList.contains('is-empty')).toBe(false);
      expect(pill(card)).toBe(words);
      document.body.replaceChildren();
      return words;
    };
    // (a plate of 460: 410 for a pill of 396; 360: 310 for 284; 320: 270 for 152; 180: 130 for 104; 120: 70)
    expect(await said(500)).toBe(long);
    expect(await said(400)).toBe('14 Station Road, Cambridge CB1 2JB');
    expect(await said(360)).toBe('14 Station Road');
    expect(await said(220)).toBe('Not home');
    expect(await said(160)).toBe('');
  });

  it('stands still where it is asked to: no finger moves it, the plate one button that opens the tracker', async () => {
    const card = await mount(
      { device: TESLA.device, map: 'auto', map_interactive: false },
      house(placed(TRACKER)),
    );
    expect(plate(card).classList.contains('is-still')).toBe(true);
    const cover = root(card).querySelector<HTMLButtonElement>('.vh-map > .fv-tile__tap');
    expect(cover?.getAttribute('aria-label')).toBe('Location · Home');
    const opened: unknown[] = [];
    const open = (event: Event) => opened.push((event as CustomEvent).detail.entityId);
    window.addEventListener('hass-more-info', open);
    cover?.click();
    window.removeEventListener('hass-more-info', open);
    expect(opened).toEqual([TRACKER]);
    document.body.replaceChildren();
    // a map a finger moves has no button over it
    const live = await mount({ device: TESLA.device, map: 'auto' }, house(placed(TRACKER)));
    expect(plate(live).classList.contains('is-still')).toBe(false);
    expect(root(live).querySelector('.vh-map > .fv-tile__tap')).toBeNull();
  });

  describe('Home Assistant’s own keys on its plate', () => {
    /** Home Assistant's map card in its own shape, as its helpers make it (`ShapedMap`). */
    const shaped = (): void => {
      window.loadCardHelpers = () =>
        Promise.resolve({
          createCardElement: (config: LovelaceCardConfig) => {
            const element = document.createElement('vehicle-shaped-map') as ShapedMap;
            element.setConfig(config);
            return element;
          },
        });
    };
    /** The map card's root and its map's, as Home Assistant's map card holds them now. */
    const roots = (): Array<ShadowRoot | null | undefined> => {
      const card = MapStub.made[0]?.shadowRoot;
      return [card, card?.querySelector('ha-map')?.shadowRoot];
    };
    /** What a root wears of sheets: each one's rules as one text. */
    const worn = (at: ShadowRoot | null | undefined): string[] =>
      [...(at?.adoptedStyleSheets ?? [])].map((sheet) =>
        [...sheet.cssRules].map((rule) => rule.cssText).join(' '),
      );
    const settled = async (card: Mounted): Promise<void> => {
      for (let i = 0; i < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await card.updateComplete;
      }
    };
    const still = (card: Mounted, interactive: boolean): void =>
      card.setConfig({
        type: 'custom:fluvy-vehicle-card',
        _now: NOW,
        device: TESLA.device,
        map: 'auto',
        ...(interactive ? {} : { map_interactive: false }),
      } as LovelaceCardConfig);

    it('hides its fit key where a finger moves the map, its zoom keys too where it stands still, and never the attribution', async () => {
      shaped();
      const card = await mount({ device: TESLA.device, map: 'auto' }, house(placed(TRACKER)));
      await laidOut(card);
      // both roots wear one sheet, the same: the fit key, its zoom keys kept
      const [own, map] = roots();
      expect(map).toBeDefined();
      for (const at of [own, map]) {
        expect(worn(at)).toHaveLength(1);
        expect(worn(at)[0]).toContain('#root > #buttons');
        expect(worn(at)[0]).not.toContain('maplibregl');
      }
      expect(own?.adoptedStyleSheets[0]).toBe(map?.adoptedStyleSheets[0]);
      // a still map: its zoom keys go too, in MapLibre's shape and Leaflet's; the other sheet leaves
      still(card, false);
      await card.updateComplete;
      for (const at of roots()) {
        expect(worn(at)).toHaveLength(1);
        for (const key of ['#root > #buttons', '.maplibregl-ctrl-group', '.leaflet-control-zoom'])
          expect(worn(at)[0]).toContain(key);
      }
      // moving again: its zoom keys come back
      still(card, true);
      await card.updateComplete;
      for (const at of roots()) expect(worn(at)[0]).not.toContain('maplibregl');
      // the tiles' attribution is in no sheet of ours, ever
      expect(roots().flatMap(worn).join(' ')).not.toMatch(/attrib/);
    });

    it('reaches a root drawn late: as the map card has drawn, and a map drawn again on the card’s next update', async () => {
      shaped();
      const card = await mount(
        { device: TESLA.device, map: 'auto', map_interactive: false },
        house(placed(TRACKER)),
      );
      await laidOut(card);
      const made = MapStub.made[0] as ShapedMap;
      // drawn after it landed on the plate: its map's root wears the sheet all the same
      expect(worn(roots()[1])).toHaveLength(1);
      // its map drawn again (an error shown and gone): bare until the card's next update, which reaches it
      made.draw();
      expect(worn(roots()[1])).toHaveLength(0);
      card.hass = house(placed(TRACKER, 'not_home'));
      await card.updateComplete;
      expect(worn(roots()[1])).toHaveLength(1);
      expect(worn(roots()[0])).toHaveLength(1);
    });

    it('reaches a map card defined late, as Home Assistant’s helpers make one before its chunk lands', async () => {
      window.loadCardHelpers = () =>
        Promise.resolve({
          createCardElement: (config: LovelaceCardConfig) => {
            const element = document.createElement('vehicle-late-map') as ShapedMap;
            (element as unknown as { config: LovelaceCardConfig }).config = config;
            return element;
          },
        });
      const card = await mount(
        { device: TESLA.device, map: 'auto', map_interactive: false },
        house(placed(TRACKER)),
      );
      await laidOut(card);
      const element = plate(card).querySelector('vehicle-late-map') as ShapedMap;
      expect(element.shadowRoot).toBeNull();
      customElements.define('vehicle-late-map', class extends ShapedMap {});
      await settled(card);
      const [own, map] = [
        element.shadowRoot,
        element.shadowRoot?.querySelector('ha-map')?.shadowRoot,
      ];
      expect(worn(own)).toHaveLength(1);
      expect(worn(map)).toHaveLength(1);
    });

    it('throws nothing where Home Assistant draws its map otherwise: no roots of its own, or its map with none', async () => {
      // no root at all (the stub the other tests make): nothing to wear a sheet, nothing thrown
      const bare = await mount(
        { device: TESLA.device, map: 'auto', map_interactive: false },
        house(placed(TRACKER)),
      );
      await laidOut(bare);
      expect(MapStub.made).toHaveLength(1);
      expect(plate(bare).classList.contains('is-empty')).toBe(false);
      document.body.replaceChildren();
      MapStub.made = [];
      // a root, and a map in it with none of its own: the card's root wears it, the map is left as it is
      shaped();
      const card = await mount(
        { device: TESLA.device, map: 'auto', map_interactive: false },
        house(placed(TRACKER)),
      );
      await laidOut(card);
      const own = MapStub.made[0]?.shadowRoot as ShadowRoot;
      own.querySelector('ha-map')?.replaceWith(document.createElement('ha-map'));
      card.hass = house(placed(TRACKER, 'not_home'));
      await card.updateComplete;
      expect(worn(own)).toHaveLength(1);
      expect(roots()[1]).toBeNull();
    });
  });

  it('keeps its plate, empty, where no map can be drawn: no coordinates, out of reach, no tracker, no card helpers', async () => {
    const empty = async (
      config: Record<string, unknown>,
      hass: HomeAssistant,
    ): Promise<{ said: string; button: boolean }> => {
      const card = await mount({ map: 'auto', ...config }, hass);
      await laidOut(card);
      const box = plate(card);
      expect(box.classList.contains('is-empty')).toBe(true);
      expect(box.style.height).toBe('160px');
      expect(box.querySelector('.vh-map__view > svg')).not.toBeNull();
      const out = {
        said: pill(card),
        button: root(card).querySelector('button.vh-map__where') !== null,
      };
      document.body.replaceChildren();
      return out;
    };
    // a tracker that says a place and no coordinates
    expect(await empty({ device: TESLA.device }, house())).toEqual({ said: 'Home', button: true });
    // out of reach: the pill says so
    expect(await empty({ device: TESLA.device }, house(away(TESLA)))).toEqual({
      said: 'Unavailable',
      button: true,
    });
    // a car with no tracker: a dash, and nothing to open
    expect(await empty({ device: OCTAVIA.device }, house())).toEqual({ said: '—', button: false });
    expect(MapStub.made).toHaveLength(0);
    // Home Assistant's card helpers are not there (a page of ours alone)
    delete window.loadCardHelpers;
    expect(await empty({ device: TESLA.device }, house(placed(TRACKER)))).toEqual({
      said: 'Home',
      button: true,
    });
  });

  it('offers the map’s own keys in the editor once a map is named, and its picker for ids alone', async () => {
    const { choices, getConfigForm, defaults } = await import('./vehicle-editor.js');
    const shown = (data: Record<string, unknown>) =>
      fieldsShown(getConfigForm().schema, {
        ...defaults({ type: 'x', ...data }, undefined),
        ...data,
      });
    const own = [
      'map_size',
      'map_zoom',
      'map_theme',
      'hours_to_show',
      'show_address',
      'map_interactive',
    ];
    expect(shown({})).toContain('map');
    for (const name of own) {
      expect(shown({}), name).not.toContain(name);
      expect(shown({ map: 'auto' }), name).toContain(name);
      expect(shown({ map: 'auto', variant: 'compact' }), name).not.toContain(name);
      // named, and left out of the card's parts: nothing to act on
      expect(shown({ map: 'auto', sections: ['head', 'hero'] }), name).not.toContain(name);
    }
    expect(shown({ variant: 'compact' })).not.toContain('map');
    // a list that holds an entry of Home Assistant's own stays YAML's
    expect(shown({ map: [{ entity: TRACKER, label_mode: 'icon' }] })).not.toContain('map');
    // the car's own tracker first, then the house's trackers and people
    const offered = choices({ type: 'x' }, house())['map']?.map((option) => option.value) ?? [];
    expect(offered[0]).toBe('auto');
    expect(offered).toContain(TRACKER);
    expect(offered.every((id) => id === 'auto' || /^(device_tracker|person)\./.test(id))).toBe(
      true,
    );
  });
});
