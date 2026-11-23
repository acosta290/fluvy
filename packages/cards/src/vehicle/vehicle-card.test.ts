// @vitest-environment happy-dom
import type { HassEntity, HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import '../vehicle/english.js';
import type { TextRuler } from '../shared/fit.js';
import { vehicleHeight } from '../vehicle-family.js';
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
  // happy-dom lays out no text: where a test needs words measured, each letter is `letter` wide
  if (letter)
    (card as unknown as { head: { ruler: TextRuler } }).head.ruler.width = (
      _: string,
      text: string,
    ) => text.length * letter;
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
    expect(root(said).querySelector('.vh-quick.is-under .rm-quick--under')).not.toBeNull();
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
