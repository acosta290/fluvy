// @vitest-environment happy-dom
import type { HaFormSchemaItem, HomeAssistant } from '@fluvy/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import { visibleFields } from '../shared/form.js';
import { IDLE_MS } from './drive/session.js';
import { getConfigForm } from './vacuum-editor.js';

// the Vacuum card's family lands with the index: its tag is defined before a card is made
await familiesDefined;

/*
 * The Vacuum card's drive pad (#178) on the card itself: where its Drive command is drawn, what the mode does to the
 * card (its parts kept for their room, the pad over them, Done the row's filled cell), every way out of it and the
 * call each makes, the sheet of a card with no room, and what its editor shows.
 */

const STAMP = '2026-11-13T08:00:00Z';
/* PAUSE 4 · STOP 8 · RETURN_HOME 16 · FAN_SPEED 32 · BATTERY 64 · SEND_COMMAND 256 · LOCATE 512 · START 8192 */
const FEATURES = 4 + 8 + 16 + 32 + 64 + 256 + 512 + 8192;

interface Call {
  readonly action: string;
  readonly data: unknown;
  readonly target: unknown;
}

/** A house with one robot of `platform` in `state`, the actions it offers, and the calls made of it. */
function house(platform: string, id: string, state = 'idle', refuse = '') {
  const calls: Call[] = [];
  const hass = {
    language: 'en',
    locale: { language: 'en', number_format: 'language', time_format: '24' },
    config: { unit_system: { temperature: '°C', length: 'km' } },
    states: {
      [id]: {
        entity_id: id,
        state,
        attributes: {
          friendly_name: 'Robot',
          supported_features: FEATURES,
          battery_level: 80,
          fan_speed: 'quiet',
          fan_speed_list: ['quiet', 'max'],
        },
        last_changed: STAMP,
        last_updated: STAMP,
      },
    },
    entities: { [id]: { entity_id: id, platform } },
    devices: {},
    areas: {},
    services: {
      xiaomi_miio: {
        vacuum_remote_control_start: {},
        vacuum_remote_control_move: {},
        vacuum_remote_control_stop: {},
      },
    },
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    callService: (domain: string, service: string, data: unknown, target: unknown) => {
      calls.push({ action: `${domain}.${service}`, data, target });
      return service === refuse ? Promise.reject(new Error('refused')) : Promise.resolve();
    },
  } as unknown as HomeAssistant;
  return { hass, calls, said: () => calls.map((call) => call.action) };
}

type CardElement = HTMLElement & {
  setConfig(config: Record<string, unknown>): void;
  hass: HomeAssistant;
  width: number;
  updateComplete: Promise<boolean>;
};

let robots = 0;
/** A robot of its own for every case: a profile once found is kept by the robot's id. */
const robot = (): string => `vacuum.drive_${++robots}`;

async function draw(hass: HomeAssistant, config: Record<string, unknown>, width = 360) {
  const card = document.createElement('fluvy-vacuum-card') as CardElement;
  card.setConfig({ type: 'custom:fluvy-vacuum-card', ...config });
  card.hass = hass;
  card.width = width;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const cells = (card: CardElement): HTMLButtonElement[] => [
  ...card.shadowRoot!.querySelectorAll<HTMLButtonElement>('.fv-action'),
];
const labels = (card: CardElement): Array<string | null> =>
  cells(card).map((cell) => cell.getAttribute('aria-label'));
const cell = (card: CardElement, label: string): HTMLButtonElement =>
  cells(card).find((one) => one.getAttribute('aria-label') === label)!;
const pad = (card: CardElement) => card.shadowRoot!.querySelector('fluvy-drive-pad');
const sheet = (card: CardElement) => card.shadowRoot!.querySelector('fluvy-drive-sheet');

/** The card's parts as tall as the design draws them: the battery 112, the suction 88, in a browser that lays out. */
const laidOut = (height = 100): void => {
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
    this: HTMLElement,
  ) {
    return this.classList.contains('vc-part') ? height : 0;
  });
};

/** Into the mode: the Drive command tapped, the pad's chunk landed, the pad drawn. */
async function driven(card: CardElement) {
  cell(card, 'Drive').click();
  await vi.waitFor(() => expect(pad(card)).toBeTruthy());
  await card.updateComplete;
  return pad(card)!;
}

beforeEach(() => laidOut());
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('the Vacuum card’s Drive command', () => {
  it('is drawn where it is asked for and the robot can be driven, last of the row', async () => {
    const id = robot();
    const { hass } = house('xiaomi_miio', id);
    expect(labels(await draw(hass, { entity: id }))).toEqual([
      'Start',
      'Stop',
      'Return to dock',
      'Locate',
    ]);
    expect(labels(await draw(hass, { entity: id, show_drive: true }))).toEqual([
      'Start',
      'Stop',
      'Return to dock',
      'Locate',
      'Drive',
    ]);
    // an integration with no remote control gains no command
    const other = robot();
    expect(
      labels(await draw(house('ecovacs', other).hass, { entity: other, show_drive: true })),
    ).not.toContain('Drive');
  });

  it('stays, still, while the robot is out of reach', async () => {
    const id = robot();
    const card = await draw(house('xiaomi_miio', id).hass, { entity: id, show_drive: true });
    expect(cell(card, 'Drive').disabled).toBe(false);
    card.hass = house('xiaomi_miio', id, 'unavailable').hass;
    await card.updateComplete;
    expect(cell(card, 'Drive').disabled).toBe(true);
  });

  it('keeps its place in a compact card: after Start, before the dock', async () => {
    const id = robot();
    const card = await draw(
      house('xiaomi_miio', id).hass,
      { entity: id, variant: 'compact', show_drive: true },
      172,
    );
    expect(labels(card)).toEqual(['Start', 'Drive']);
  });

  it('refuses a `drive` it cannot read, in words', () => {
    const card = document.createElement('fluvy-vacuum-card') as CardElement;
    expect(() =>
      card.setConfig({
        type: 'custom:fluvy-vacuum-card',
        entity: 'vacuum.x',
        drive: { velocity: 2 },
      }),
    ).toThrow('fluvy-vacuum-card: "drive.move" is required');
  });
});

describe('the Vacuum card driven', () => {
  it('gives the battery’s and the suction’s room to the pad, the parts kept, and starts remote control', async () => {
    const id = robot();
    const { hass, calls } = house('xiaomi_miio', id);
    const card = await draw(hass, { entity: id, show_drive: true });
    const root = card.shadowRoot!;
    const drawn = await driven(card);
    // the parts are there, hidden, for the room they take: the card is as tall as it was
    expect(root.querySelector('.vc-body')!.classList.contains('is-driving')).toBe(true);
    expect(root.querySelectorAll('.vc-body > .vc-part')).toHaveLength(2);
    // two parts of 100 less the 16 over them: the remote's 176 fits
    expect(drawn.size).toBe(176);
    expect(drawn.style.height).toBe('184px');
    expect(calls).toEqual([
      {
        action: 'xiaomi_miio.vacuum_remote_control_start',
        data: {},
        target: { entity_id: [id] },
      },
    ]);
    // Done is the row's one filled cell, where Drive stood
    expect(labels(card)).toEqual(['Start', 'Stop', 'Return to dock', 'Locate', 'Done']);
    expect(cells(card).map((one) => one.classList.contains('fv-action--accent'))).toEqual([
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('moves the robot from an arrow, and stops it from the middle', async () => {
    const id = robot();
    const { hass, calls } = house('xiaomi_miio', id);
    const drawn = await driven(await draw(hass, { entity: id, show_drive: true }));
    await drawn.updateComplete;
    const arrows = [...drawn.shadowRoot!.querySelectorAll<HTMLButtonElement>('.fv-ring__arrow')];
    expect(arrows.map((arrow) => arrow.getAttribute('aria-label'))).toEqual([
      'Forward',
      'Right',
      'Back',
      'Left',
    ]);
    arrows[0]!.click();
    drawn.shadowRoot!.querySelector<HTMLButtonElement>('.fv-ring__mid')!.click();
    expect(calls.slice(1).map((call) => call.data)).toEqual([
      { velocity: 0.19, rotation: 0, duration: 600 },
      { velocity: 0, rotation: 0, duration: 600 },
    ]);
  });

  it('leaves on Done: remote control stops, the card is as it was', async () => {
    const id = robot();
    const { hass, said } = house('xiaomi_miio', id);
    const card = await draw(hass, { entity: id, show_drive: true });
    await driven(card);
    cell(card, 'Done').click();
    await card.updateComplete;
    expect(said()).toEqual([
      'xiaomi_miio.vacuum_remote_control_start',
      'xiaomi_miio.vacuum_remote_control_stop',
    ]);
    expect(pad(card)).toBeNull();
    expect(card.shadowRoot!.querySelector('.is-driving')).toBeNull();
    expect(labels(card).at(-1)).toBe('Drive');
  });

  it('ends remote control before a command that sends the robot to work or home', async () => {
    const id = robot();
    const { hass, said } = house('xiaomi_miio', id);
    const card = await draw(hass, { entity: id, show_drive: true });
    await driven(card);
    cell(card, 'Locate').click();
    expect(pad(card)).toBeTruthy();
    cell(card, 'Return to dock').click();
    await card.updateComplete;
    expect(said()).toEqual([
      'xiaomi_miio.vacuum_remote_control_start',
      'vacuum.locate',
      'xiaomi_miio.vacuum_remote_control_stop',
      'vacuum.return_to_base',
    ]);
    expect(pad(card)).toBeNull();
  });

  it('leaves by itself after ten seconds without a press', async () => {
    vi.useFakeTimers();
    const id = robot();
    const { hass, said } = house('xiaomi_miio', id);
    const card = await draw(hass, { entity: id, show_drive: true });
    await driven(card);
    await vi.advanceTimersByTimeAsync(IDLE_MS);
    await card.updateComplete;
    expect(said().at(-1)).toBe('xiaomi_miio.vacuum_remote_control_stop');
    expect(pad(card)).toBeNull();
    expect(labels(card).at(-1)).toBe('Drive');
  });

  it('stops remote control as the card leaves the page, and as the page is hidden', async () => {
    const id = robot();
    const { hass, said } = house('xiaomi_miio', id);
    const card = await draw(hass, { entity: id, show_drive: true });
    await driven(card);
    // a pad that left the page says nothing: the card knows it left with it
    const heard = vi.fn();
    card.addEventListener('fluvy-drive-end', heard);
    card.remove();
    expect(said().at(-1)).toBe('xiaomi_miio.vacuum_remote_control_stop');
    expect(heard).not.toHaveBeenCalled();
    // back on the page it is at rest: nothing is driven until Drive is tapped again
    document.body.append(card);
    await card.updateComplete;
    expect(pad(card)).toBeNull();
    await driven(card);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    await card.updateComplete;
    expect(said().slice(-2)).toEqual([
      'xiaomi_miio.vacuum_remote_control_start',
      'xiaomi_miio.vacuum_remote_control_stop',
    ]);
    expect(pad(card)).toBeNull();
  });

  it('takes the pad to its sheet where the card’s room for the ring goes, and goes on driving', async () => {
    const id = robot();
    const { hass, said } = house('xiaomi_miio', id);
    const card = await draw(hass, { entity: id, show_drive: true });
    await driven(card);
    // the parts drawn shorter (a font, a narrower column): 20 less its 16 holds no ring
    laidOut(10);
    card.width = 352;
    await vi.waitFor(() =>
      expect(sheet(card)?.shadowRoot?.querySelector('fluvy-drive-pad')).toBeTruthy(),
    );
    expect(pad(card)).toBeNull();
    expect(labels(card).at(-1)).toBe('Done');
    // the pad that left ended its remote control; the sheet's begins its own
    expect(said()).toEqual([
      'xiaomi_miio.vacuum_remote_control_start',
      'xiaomi_miio.vacuum_remote_control_stop',
      'xiaomi_miio.vacuum_remote_control_start',
    ]);
  });

  it('leaves a refused call in the card’s error tone for a moment', async () => {
    vi.useFakeTimers();
    const id = robot();
    const { hass } = house('xiaomi_miio', id, 'idle', 'vacuum_remote_control_start');
    const card = await draw(hass, { entity: id, show_drive: true });
    cell(card, 'Drive').click();
    await vi.waitFor(() =>
      expect(card.shadowRoot!.querySelector('.fv-badge--warning')).toBeTruthy(),
    );
    expect(pad(card)).toBeNull();
    expect(labels(card).at(-1)).toBe('Drive');
    await vi.advanceTimersByTimeAsync(3000);
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('.fv-badge--warning')).toBeNull();
  });

  it('leaves when the robot goes out of reach', async () => {
    const id = robot();
    const card = await draw(house('xiaomi_miio', id).hass, { entity: id, show_drive: true });
    await driven(card);
    card.hass = house('xiaomi_miio', id, 'unavailable').hass;
    await card.updateComplete;
    await card.updateComplete;
    expect(pad(card)).toBeNull();
    expect(cell(card, 'Drive').disabled).toBe(true);
  });
});

describe('the drive pad’s sheet', () => {
  /** The pad inside the card's sheet, once it has opened. */
  const opened = async (card: CardElement) => {
    cell(card, 'Drive').click();
    await vi.waitFor(() =>
      expect(sheet(card)?.shadowRoot?.querySelector('fluvy-drive-pad')).toBeTruthy(),
    );
    return sheet(card)!;
  };

  it('opens for a compact card, drives from it, and Done closes it and stops remote control', async () => {
    vi.useFakeTimers();
    const id = robot();
    const { hass, said } = house('xiaomi_miio', id);
    const card = await draw(hass, { entity: id, variant: 'compact', show_drive: true });
    const open = await opened(card);
    const root = open.shadowRoot!;
    expect(root.querySelector('dialog')).toBeTruthy();
    expect(root.querySelector('.fv-sheet__title')!.textContent).toBe('Robot');
    expect(root.querySelector('.ds-hint')!.textContent).toBe('Hold an arrow to keep moving');
    // the card keeps its shape under the sheet: no pad in it
    expect(pad(card)).toBeNull();
    expect(said()).toEqual(['xiaomi_miio.vacuum_remote_control_start']);
    root.querySelector<HTMLButtonElement>('.ds-actions .fv-btn')!.click();
    // remote control ends at once; the sheet leaves, then the card is at rest
    expect(said().at(-1)).toBe('xiaomi_miio.vacuum_remote_control_stop');
    await vi.advanceTimersByTimeAsync(250);
    await card.updateComplete;
    expect(sheet(card)).toBeNull();
    expect(labels(card)).toContain('Drive');
    expect(said()).toHaveLength(2);
  });

  it('opens where the card has no room for the ring, or is asked for', async () => {
    const id = robot();
    const { hass } = house('xiaomi_miio', id);
    // the suction alone: 100 less its 16 holds no ring
    const narrow = await draw(hass, { entity: id, show_battery: false, show_drive: true });
    await opened(narrow);
    expect(pad(narrow)).toBeNull();
    expect(narrow.shadowRoot!.querySelector('.is-driving')).toBeNull();
    const asked = await draw(hass, { entity: id, show_drive: true, drive_style: 'sheet' });
    await opened(asked);
    expect(pad(asked)).toBeNull();
  });

  it('closes by itself after ten seconds without a press', async () => {
    vi.useFakeTimers();
    const id = robot();
    const { hass, said } = house('xiaomi_miio', id);
    const card = await draw(hass, { entity: id, variant: 'compact', show_drive: true });
    await opened(card);
    await vi.advanceTimersByTimeAsync(IDLE_MS + 250);
    await card.updateComplete;
    expect(said().at(-1)).toBe('xiaomi_miio.vacuum_remote_control_stop');
    expect(sheet(card)).toBeNull();
  });
});

describe('the Vacuum card’s editor', () => {
  const fields = (schema: readonly HaFormSchemaItem[]): HaFormSchemaItem[] =>
    schema.flatMap((item) => (item.schema ? fields(item.schema) : [item]));
  const shown = (data: Record<string, unknown>, hass?: HomeAssistant) =>
    fields(visibleFields(getConfigForm().schema, data, hass));
  const named = (list: readonly HaFormSchemaItem[], name: string) =>
    list.filter((field) => field.name === name);

  it('offers the Drive command’s switch only where the robot can be driven, else a line saying why', () => {
    const id = robot();
    const { hass } = house('xiaomi_miio', id);
    const [can] = named(shown({ entity: id }, hass), 'show_drive');
    expect(can?.selector).toEqual({ boolean: {} });
    const other = robot();
    const cannot = named(shown({ entity: other }, house('ecovacs', other).hass), 'show_drive');
    expect(cannot).toHaveLength(1);
    expect(cannot[0]).toMatchObject({
      type: 'constant',
      value: 'This robot’s integration has no remote control in Home Assistant',
    });
    // a robot's own calls make it one that can be driven
    const drive = { move: { action: 'xiaomi_miio.vacuum_remote_control_move' } };
    expect(
      named(shown({ entity: other, drive }, house('ecovacs', other).hass), 'show_drive')[0]
        ?.selector,
    ).toEqual({ boolean: {} });
  });

  it('offers the pad’s speed once it is on, and where it opens but on a compact card', () => {
    const id = robot();
    const { hass } = house('xiaomi_miio', id);
    const names = (data: Record<string, unknown>) =>
      shown({ entity: id, ...data }, hass).map((field) => field.name);
    expect(names({})).not.toContain('drive_speed');
    expect(names({ show_drive: true })).toEqual(
      expect.arrayContaining(['drive_speed', 'drive_style', 'drive_entity', 'drive']),
    );
    expect(names({ show_drive: true, variant: 'compact' })).toContain('drive_speed');
    expect(names({ show_drive: true, variant: 'compact' })).not.toContain('drive_style');
    // the robot to drive and its own calls are always there: they are what makes a robot one that can be
    expect(names({})).toEqual(expect.arrayContaining(['drive_entity', 'drive']));
  });

  it('names every field of the pad, and says what the two that need it are for', () => {
    const form = getConfigForm();
    const label = (name: string) => form.computeLabel?.({ name }, (key) => key);
    expect(label('show_drive')).toBe('Drive command');
    expect(label('drive_speed')).toBe('Speed');
    expect(label('drive_style')).toBe('The pad opens');
    expect(label('drive_entity')).toBe('Robot to drive');
    expect(label('drive')).toBe('Drive actions');
    expect(form.computeHelper?.({ name: 'drive_entity' }, (key) => key)).toBe(
      'The same robot through another integration; left out, the card’s own',
    );
    expect(form.computeHelper?.({ name: 'show_drive' }, (key) => key)).toBeUndefined();
  });
});
