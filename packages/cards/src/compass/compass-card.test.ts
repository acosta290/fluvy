// @vitest-environment happy-dom
import { ensureLanguage, resolveEntity, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import { TextRuler } from '../shared/fit.js';
import { visibleFields } from '../shared/form.js';
import { compassHeight } from '../weather-family.js';
import {
  bearingOf,
  bezelOf,
  classicLetters,
  degreesOf,
  degreesText,
  directionOf,
  FluvyCompassCard,
  pointOf,
  pointWord,
  type CompassCardConfig,
} from './compass-card.js';
import * as compassEditor from './compass-editor.js';

await familiesDefined;

type Attributes = Record<string, unknown>;

/** A house of `states` (id → state and attributes), in `language`. */
const house = (
  states: Record<string, readonly [string, Attributes?]>,
  language = 'en',
): HomeAssistant =>
  ({
    language,
    locale: { language, number_format: 'language', time_format: '24' },
    states: Object.fromEntries(
      Object.entries(states).map(([id, [state, attributes = {}]]) => [
        id,
        { entity_id: id, state, attributes, last_changed: '', last_updated: '' },
      ]),
    ),
    entities: {},
    devices: {},
    areas: {},
    localize: (key: string) => key,
    formatEntityState: (s: { state: string }) => s.state,
    callWS: async () => ({}),
  }) as unknown as HomeAssistant;

/** A weather station's wind, its 10-minute average, a weather entity, the sun and a car. */
const STATION = house({
  'sensor.wind_speed': ['14.2', { unit_of_measurement: 'km/h', device_class: 'wind_speed' }],
  'sensor.wind_bearing': ['248', { unit_of_measurement: '°', device_class: 'wind_direction' }],
  'sensor.wind_average': ['236', { unit_of_measurement: '°', device_class: 'wind_direction' }],
  'sensor.wind_gust': ['23.8', { unit_of_measurement: 'km/h', device_class: 'wind_speed' }],
  'sensor.wind_letters': ['wsw'],
  'sensor.wind_gone': ['unavailable', { unit_of_measurement: 'km/h', device_class: 'wind_speed' }],
  'sensor.bearing_gone': ['unavailable', { device_class: 'wind_direction' }],
  'weather.home': ['sunny', { wind_speed: 12, wind_speed_unit: 'km/h', wind_bearing: 315 }],
  'weather.terrace': ['cloudy', { wind_speed: 9, wind_speed_unit: 'km/h', wind_bearing: 'ssw' }],
  'sun.sun': ['above_horizon', { azimuth: 291.4, elevation: 12 }],
  'device_tracker.car': ['not_home', { heading: 47 }],
});

type CardElement = FluvyCompassCard & { updateComplete: Promise<boolean> };

async function mount(
  config: Partial<CompassCardConfig>,
  hass: HomeAssistant = STATION,
): Promise<CardElement> {
  const card = document.createElement('fluvy-compass-card') as CardElement;
  card.setConfig({ type: 'custom:fluvy-compass-card', ...config });
  card.hass = hass;
  document.body.append(card);
  await card.updateComplete;
  return card;
}

const text = (card: CardElement, selector: string): string =>
  card.shadowRoot?.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/** The ring's cardinal points: each word, where it is centred from the ring's centre, its size, whether it is turned. */
const placed = (card: CardElement) => {
  const dial = card.shadowRoot?.querySelector('.cp-dial') as HTMLElement | null;
  const centre = parseFloat(dial?.style.width ?? '0') / 2;
  return [...(card.shadowRoot?.querySelectorAll<HTMLElement>('.cp-point') ?? [])].map((t) => ({
    word: t.textContent,
    dx: Math.round(parseFloat(t.style.left) - centre),
    dy: Math.round(parseFloat(t.style.top) - centre),
    size: t.style.fontSize,
    turned: t.hasAttribute('transform') || t.style.rotate !== '',
  }));
};

describe('a bearing as the Compass card reads it', () => {
  it('reads degrees, as a figure or as words, wrapped into one turn', () => {
    expect(bearingOf(248)).toBe(248);
    expect(bearingOf('248')).toBe(248);
    expect(bearingOf(' 12.5 ')).toBe(12.5);
    expect(bearingOf(-10)).toBe(350);
    expect(bearingOf(370)).toBe(10);
    expect(bearingOf(Number.NaN)).toBeNull();
  });

  it('reads the sixteen points in English’s letters, in any case, and nothing else', () => {
    expect(['N', 'NNE', 'ENE', 'E', 'SSW', 'WSW', 'W', 'NNW'].map(bearingOf)).toEqual([
      0, 22.5, 67.5, 90, 202.5, 247.5, 270, 337.5,
    ]);
    expect(bearingOf('wsw')).toBe(247.5);
    expect(bearingOf('Ssw')).toBe(202.5);
    // German's O is East, Spanish's West: a letter of another language is never guessed at
    expect(['O', 'NO', 'SO', 'ONO', 'OSO', 'NORTH', ''].map(bearingOf)).toEqual(
      Array(7).fill(null),
    );
  });

  it('says its point of the sixteen in the page’s language, a point between two as the language joins them', async () => {
    expect(pointOf(248)).toBe(11);
    expect(pointOf(354)).toBe(0);
    const en = STATION;
    expect([0, 1, 3, 5, 11, 15].map((point) => pointWord(en, point))).toEqual([
      'N',
      'NNE',
      'ENE',
      'ESE',
      'WSW',
      'NNW',
    ]);
    for (const code of ['es', 'ja', 'pl'] as const) await ensureLanguage(code);
    // Spanish's W is O; Japanese joins without a space; Polish with a hyphen
    expect(pointWord(house({}, 'es'), 11)).toBe('OSO');
    expect(pointWord(house({}, 'ja'), 1)).toBe('北北東');
    expect(pointWord(house({}, 'pl'), 1)).toBe('Pn-Pn-Wsch');
  });

  it('writes whole degrees: 359.6 is 0°, never 360°', () => {
    expect(degreesOf(359.6)).toBe(0);
    expect(degreesOf(247.5)).toBe(248);
    expect(degreesText(STATION, 359.6)).toBe('0°');
  });

  it('reads the sun’s azimuth, a weather entity’s wind bearing and any attribute named; a state otherwise', () => {
    const view = (id: string) => resolveEntity(STATION, id);
    expect(directionOf(view('sun.sun'))).toBe(291.4);
    expect(directionOf(view('weather.home'))).toBe(315);
    expect(directionOf(view('weather.terrace'))).toBe(202.5);
    expect(directionOf(view('device_tracker.car'), 'heading')).toBe(47);
    expect(directionOf(view('sensor.wind_bearing'))).toBe(248);
    expect(directionOf(view('sensor.wind_letters'))).toBe(247.5);
    expect(directionOf(view('sensor.bearing_gone'))).toBeNull();
    expect(directionOf(view('sensor.nowhere'))).toBeNull();
  });
});

describe('the Compass card', () => {
  it('reads its sensor in the ring, the point and the degrees under it, the second bearing beside the first', async () => {
    const card = await mount({
      entity: 'sensor.wind_speed',
      direction_entity: 'sensor.wind_bearing',
      secondary_direction_entity: 'sensor.wind_average',
    });
    expect(text(card, '.fv-dial__label-in')).toBe('Speed');
    expect(text(card, '.fv-dial__value')).toBe('14.2km/h');
    expect(text(card, '.fv-dial__sub')).toBe('WSW · 248°');
    // the bearing's arrow in the card's colour, lifted, turned to 248°; the second's dot in the secondary ink
    expect(card.shadowRoot?.querySelectorAll('.fv-knob')).toHaveLength(0);
    const arrows = card.shadowRoot?.querySelectorAll('.cp-arrow');
    expect(arrows).toHaveLength(1);
    expect(arrows?.[0]?.classList.contains('is-second')).toBe(false);
    expect(arrows?.[0]?.closest('svg')?.classList.contains('cp-lift')).toBe(true);
    expect((arrows?.[0] as SVGElement).style.rotate).toBe('248deg');
    expect(card.shadowRoot?.querySelector('.cp-dial')?.classList.contains('fv-dial--accent')).toBe(
      true,
    );
    expect(card.shadowRoot?.querySelectorAll('circle.dl-current')).toHaveLength(1);
    // the direction is said once, in the ring: no badge, no line under the name of the card's own
    expect(card.shadowRoot?.querySelector('.fv-badge')).toBeNull();
    expect(text(card, '.fv-card__sub')).toBe('');
  });

  it('reads a weather entity’s wind as its figure, and the bearing itself where there is no figure', async () => {
    const weather = await mount({ direction_entity: 'weather.home' });
    expect(text(weather, '.fv-dial__value')).toBe('12km/h');
    expect(text(weather, '.fv-dial__sub')).toBe('NW · 315°');
    const sun = await mount({ direction_entity: 'sun.sun', label: 'Azimuth' });
    expect(text(sun, '.fv-dial__label-in')).toBe('Azimuth');
    expect(text(sun, '.fv-dial__value')).toBe('291°');
    expect(text(sun, '.fv-dial__sub')).toBe('WNW');
    const car = await mount({
      direction_entity: 'device_tracker.car',
      direction_attribute: 'heading',
    });
    expect(text(car, '.fv-dial__label-in')).toBe('Direction');
    expect(text(car, '.fv-dial__value')).toBe('47°');
    // a sensor alone is the bearing: its degrees in the ring, its class's word over them
    const alone = await mount({ entity: 'sensor.wind_bearing' });
    expect(text(alone, '.fv-dial__label-in')).toBe('Wind direction');
    expect(text(alone, '.fv-dial__value')).toBe('248°');
    expect(text(alone, '.fv-dial__sub')).toBe('WSW');
  });

  it('wears the wind’s glyph for a wind and the sun’s for the sun where it is given none; the person’s otherwise', async () => {
    const cards: CardElement[] = [];
    const headIcon = async (config: Partial<CompassCardConfig>): Promise<string> => {
      const card = await mount(config);
      cards.push(card);
      return card.shadowRoot?.querySelector('[data-icon]')?.innerHTML ?? '';
    };
    const wind = await headIcon({
      entity: 'sensor.wind_speed',
      direction_entity: 'sensor.wind_bearing',
    });
    expect(wind).toContain('M4 10h11');
    expect(await headIcon({ direction_entity: 'weather.home' })).toContain('M4 10h11');
    const sun = await headIcon({ direction_entity: 'sun.sun' });
    expect(sun).not.toContain('M4 10h11');
    expect(sun).toBe(await headIcon({ direction_entity: 'sun.sun', icon: 'fluvy:sun' }));
    expect(
      await headIcon({
        entity: 'sensor.wind_speed',
        direction_entity: 'sensor.wind_bearing',
        icon: 'mdi:compass',
      }),
    ).toContain('ha-icon');
    for (const card of cards) card.remove();
  });

  it('marks the bearing as asked: the arrow, the knob, the ticks lit across its sixteenth, or the dot', async () => {
    const knob = await mount({ direction_entity: 'sensor.wind_bearing', indicator: 'knob' });
    expect(knob.shadowRoot?.querySelectorAll('.fv-knob')).toHaveLength(1);
    expect(knob.shadowRoot?.querySelectorAll('.cp-arrow')).toHaveLength(0);
    // 1.24's ring: 240, 245, 250 and 255, the ticks within 11.25° of 248
    const lit = await mount({
      direction_entity: 'sensor.wind_bearing',
      indicator: 'ticks',
      face: 'ring',
    });
    expect(lit.shadowRoot?.querySelectorAll('.fv-knob, .cp-arrow')).toHaveLength(0);
    expect(lit.shadowRoot?.querySelectorAll('line.tk-on')).toHaveLength(4);
    const dot = await mount({ direction_entity: 'sensor.wind_bearing', indicator: 'dot' });
    expect(dot.shadowRoot?.querySelectorAll('circle.cp-dot')).toHaveLength(1);
    expect(dot.shadowRoot?.querySelectorAll('.fv-knob, .cp-arrow')).toHaveLength(0);
    // a second arrow: its outline alone, flat, in the secondary ink, under the first (on 1.24's ring, its measures)
    const two = await mount({
      direction_entity: 'sensor.wind_bearing',
      secondary_direction_entity: 'sensor.wind_average',
      secondary_indicator: 'arrow',
      face: 'ring',
    });
    const [second, first] = [...(two.shadowRoot?.querySelectorAll('.cp-arrow') ?? [])];
    expect(second?.classList.contains('is-second')).toBe(true);
    expect(second?.closest('svg')?.classList.contains('cp-lift')).toBe(false);
    expect(first?.closest('svg')?.classList.contains('cp-lift')).toBe(true);
    /** An arrow's corners, x and y, as its outline draws them. */
    const corners = (arrow: Element | undefined): number[][] => {
      const xy = (arrow?.getAttribute('d') ?? '').match(/-?[\d.]+/g)!.map(Number);
      return xy.flatMap((v, i) => (i % 2 === 0 ? [[v, xy[i + 1]!]] : []));
    };
    // the ring's own a needle's head, symmetric about its axis, drawn at the top of its 240 box and pointing out: its
    // tip 23 outside the ring of 96, its wings 12 inside it (the open centre's edge) and 8.5 either side, its notch 3
    // into its base; 35 long, as the knob is wide
    expect(corners(first)).toEqual([
      [120, 1],
      [128.5, 36],
      [120, 33],
      [111.5, 36],
    ]);
    // the second's the same head, unnotched, its outline alone
    expect(corners(second)).toEqual([
      [120, 1],
      [128.5, 36],
      [120, 36],
      [111.5, 36],
    ]);
    // pointing in, both: the same head the other way round, its tip at the open centre's edge
    const inward = await mount({
      direction_entity: 'sensor.wind_bearing',
      secondary_direction_entity: 'sensor.wind_average',
      secondary_indicator: 'arrow',
      arrow_points: 'inward',
      face: 'ring',
    });
    const [secondIn, firstIn] = [...(inward.shadowRoot?.querySelectorAll('.cp-arrow') ?? [])];
    expect(corners(firstIn)).toEqual([
      [120, 36],
      [128.5, 1],
      [120, 4],
      [111.5, 1],
    ]);
    expect(corners(secondIn)).toEqual([
      [120, 36],
      [128.5, 1],
      [120, 1],
      [111.5, 1],
    ]);
  });

  it('draws a classic compass’s face by default (#247): a band under its ticks, a hairline, bold bars, large letters outside', async () => {
    const card = await mount({
      direction_entity: 'sensor.wind_bearing',
      secondary_direction_entity: 'sensor.wind_average',
    });
    const root = card.shadowRoot!;
    expect(root.querySelector('.cp-dial')?.classList.contains('is-classic')).toBe(true);
    // R 96 at a 360 column: the band 12 wide, its outer edge 2 past the ring (92 its middle), the hairline 5 inside it
    const band = root.querySelector('circle.cp-band') as SVGCircleElement;
    expect([band.getAttribute('r'), band.style.strokeWidth]).toEqual(['92', '12px']);
    expect(root.querySelector('circle.cp-line')?.getAttribute('r')).toBe('81');
    /** A tick by its bearing: where it starts and ends, from the ring's centre. */
    const ticks = [...root.querySelectorAll('.cp-dial line')].map((l) => {
      const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(l.getAttribute(k)) - 120);
      return {
        bearing: Math.round((((Math.atan2(x2!, -y2!) * 180) / Math.PI + 360) % 360) * 10) / 10,
        from: Math.round(Math.hypot(x1!, y1!)),
        to: Math.round(Math.hypot(x2!, y2!)),
        bar: l.classList.contains('is-bar'),
      };
    });
    // every 7.5°, three to a sixteenth: from the band's outer edge in, the rest short, every 22.5° medium, every 45°
    // across it; the cardinal points' bars from the hairline to 2 past the band
    expect(ticks).toHaveLength(48);
    const at = (bearing: number) => ticks.find((t) => t.bearing === bearing);
    expect(at(0)).toEqual({ bearing: 0, from: 81, to: 100, bar: true });
    expect(at(45)).toEqual({ bearing: 45, from: 87, to: 97, bar: false });
    expect(at(22.5)).toEqual({ bearing: 22.5, from: 91, to: 97, bar: false });
    expect(at(7.5)).toEqual({ bearing: 7.5, from: 94, to: 97, bar: false });
    expect(ticks.filter((t) => t.bar).map((t) => t.bearing)).toEqual([0, 90, 180, 270]);
    // the letters 16 bold outside the band, 5 clear of it, north in the card's ink (`.is-north`), upright
    const letters = placed(card);
    expect(letters.map(({ word, size, turned }) => [word, size, turned])).toEqual([
      ['N', '16px', false],
      ['E', '16px', false],
      ['S', '16px', false],
      ['W', '16px', false],
    ]);
    // north's capitals (12 of 16) centred 5 past the band's 98
    expect(letters[0]).toMatchObject({ dx: 0, dy: -109 });
    expect(root.querySelector('.cp-point.is-north')?.textContent).toBe('N');
    // the arrow rides the band's middle: its tip 23 outside it, its wings 12 inside it
    const corners = (root.querySelector('.cp-arrow')?.getAttribute('d') ?? '')
      .match(/-?[\d.]+/g)!
      .map(Number);
    expect(corners).toEqual([120, 5, 128.5, 40, 120, 37, 111.5, 40]);
    // the second's dot on the band, the tick under it giving way
    const dot = root.querySelector('circle.dl-current')!;
    const [dx, dy] = ['cx', 'cy'].map((k) => Number(dot.getAttribute(k)) - 120);
    expect(Math.round(Math.hypot(dx!, dy!))).toBe(92);
    expect(
      [...root.querySelectorAll('line.is-under')].map((l) => {
        const [x, y] = ['x2', 'y2'].map((k) => Number(l.getAttribute(k)) - 120);
        return Math.round((((Math.atan2(x!, -y!) * 180) / Math.PI + 360) % 360) * 10) / 10;
      }),
    ).toEqual([232.5, 240, 247.5]);
    // lit ticks span the band: the sixteenth one lit arc
    const lit = await mount({ direction_entity: 'sensor.wind_bearing', indicator: 'ticks' });
    const spans = [...lit.shadowRoot!.querySelectorAll('line.tk-on')].map((l) => {
      const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(l.getAttribute(k)) - 120);
      return [Math.round(Math.hypot(x1!, y1!)), Math.round(Math.hypot(x2!, y2!))];
    });
    expect(spans).toEqual([
      [87, 97],
      [87, 97],
      [87, 97],
    ]);
    // without its ticks the band and the hairline stay, the letters with them
    const bare = await mount({ direction_entity: 'sensor.wind_bearing', show_ticks: false });
    expect(bare.shadowRoot!.querySelectorAll('.cp-dial line')).toHaveLength(0);
    expect(bare.shadowRoot!.querySelectorAll('.cp-band, .cp-line')).toHaveLength(2);
    expect(bare.shadowRoot!.querySelectorAll('.cp-point.is-large')).toHaveLength(4);
    // 1.24's ring draws none of it
    const ring = await mount({ direction_entity: 'sensor.wind_bearing', face: 'ring' });
    expect(
      ring.shadowRoot!.querySelectorAll('.cp-band, .cp-line, .is-bar, .is-large'),
    ).toHaveLength(0);
    expect(ring.shadowRoot!.querySelector('.cp-dial')?.classList.contains('is-classic')).toBe(
      false,
    );
  });

  it('steps the classic face’s letters down together where their column does not hold them, else stands them in the band', () => {
    // measured at 700 and 16, 14, 12 and 11 (Inter, the playground's)
    const measured: Record<string, readonly number[]> = {
      N: [12, 11, 10, 9],
      E: [10, 9, 8, 7],
      S: [11, 10, 8, 8],
      W: [17, 15, 12, 11],
      Pn: [21, 19, 16, 15],
      Wsch: [45, 42, 35, 32],
      Pd: [21, 19, 16, 15],
      Zach: [41, 37, 33, 30],
    };
    const widthOf = (word: string, size: number): number =>
      measured[word]![[16, 14, 12, 11].indexOf(size)]!;
    const english = [
      [0, 'N'],
      [90, 'E'],
      [180, 'S'],
      [270, 'W'],
    ] as const;
    const polish = [
      [0, 'Pn'],
      [90, 'Wsch'],
      [180, 'Pd'],
      [270, 'Zach'],
    ] as const;
    const sizes = [16, 14, 12, 11];
    const sizeIn = (
      points: typeof english | typeof polish,
      r: number,
      across: number,
      offset = 0,
    ): number | null =>
      classicLetters(points, bezelOf(r), offset, { across, down: r + 24 }, sizes, widthOf)?.[0]
        ?.size ?? null;
    // a 266 card (R 88, 113 to its column's edge): English at 16, west ending 1 short of the edge
    expect(sizeIn(english, 88, 113)).toBe(16);
    const [, , , west] = classicLetters(
      english,
      bezelOf(88),
      0,
      { across: 113, down: 112 },
      sizes,
      widthOf,
    )!;
    expect([west!.x, Math.round(west!.y)]).toEqual([-103.5, 0]);
    // a phone's section (R 96, 144 to its column's edge): Polish's "Wsch" holds at 12; a desktop's (160) at 16
    expect(sizeIn(polish, 96, 144)).toBe(12);
    expect(sizeIn(polish, 96, 160)).toBe(16);
    // a 266 card: no size holds it outside the band; the letters stand in its place
    expect(sizeIn(polish, 88, 113)).toBeNull();
    // turned a quarter, east and west stand at the top and the bottom, north and south across: "Pn" holds at 12
    expect(sizeIn(polish, 88, 113, 90)).toBe(12);
  });

  it('marks the bearing with a chevron in a ringed circle riding the band, its halo cutting it, pointing as asked', async () => {
    const card = await mount({
      direction_entity: 'sensor.wind_bearing',
      secondary_direction_entity: 'sensor.wind_average',
      indicator: 'chevron',
      secondary_indicator: 'chevron',
    });
    const root = card.shadowRoot!;
    const [second, first] = [...root.querySelectorAll<SVGGElement>('.cp-chevron')];
    // the knob's 36 and its 2 ring on the band's middle (92), drawn at the top and turned to the bearing
    expect(first!.querySelector('circle')?.getAttribute('cy')).toBe('28');
    expect(first!.querySelector('circle')?.getAttribute('r')).toBe('19');
    expect(first!.style.rotate).toBe('248deg');
    expect(first!.closest('svg')?.classList.contains('cp-lift')).toBe(true);
    // pointing out: its point up, 0.22 of the disc deep and 0.4 wide
    expect(first!.querySelector('.cp-vee')?.getAttribute('d')).toBe(
      'M112.8 31.96L120 24.04L127.2 31.96',
    );
    // the second's in the secondary ink, flat
    expect(second!.classList.contains('is-second')).toBe(true);
    expect(second!.closest('svg')?.classList.contains('cp-lift')).toBe(false);
    expect(second!.style.rotate).toBe('236deg');
    // each a halo of the card under it, turned with it: it cuts the band and the ticks, none of which gives way
    expect(
      [...root.querySelectorAll<SVGCircleElement>('circle.cp-halo')].map((h) => [
        h.getAttribute('r'),
        h.style.rotate,
      ]),
    ).toEqual([
      ['26', '236deg'],
      ['26', '248deg'],
    ]);
    expect(root.querySelectorAll('line.is-under')).toHaveLength(0);
    // pointing in: its point toward the centre
    const inward = await mount({
      direction_entity: 'sensor.wind_bearing',
      indicator: 'chevron',
      arrow_points: 'inward',
    });
    expect(inward.shadowRoot!.querySelector('.cp-vee')?.getAttribute('d')).toBe(
      'M112.8 24.04L120 31.96L127.2 24.04',
    );
    // a row's: the chevron alone across its track, 8 wide and 5 deep
    const row = await mount({
      direction_entity: 'sensor.wind_bearing',
      indicator: 'chevron',
      variant: 'row',
    });
    const vee = row.shadowRoot!.querySelector<SVGPathElement>('.cp-ringed .cp-vee')!;
    expect([vee.getAttribute('d'), vee.style.rotate]).toEqual(['M25 5L29 0L33 5', '248deg']);
  });

  it('turns its arrow the short way round, and clears what it covers: the ticks under it, a point it stands on', async () => {
    const card = await mount({ direction_entity: 'sensor.wind_bearing' });
    const root = card.shadowRoot!;
    const angle = (): string => (root.querySelector('.cp-arrow') as SVGElement).style.rotate;
    const under = (of: ShadowRoot = root): number[] => {
      const dial = of.querySelector('.cp-dial svg')!;
      const c = Number(dial.getAttribute('width')) / 2;
      return [...of.querySelectorAll('line.is-under')].map((l) => {
        const [x, y] = [Number(l.getAttribute('x1')) - c, Number(l.getAttribute('y1')) - c];
        return Math.round((((Math.atan2(x, -y) * 180) / Math.PI + 360) % 360) * 10) / 10;
      });
    };
    // at 248° the tick at 247.5 gives way, 240 and 255 stay; no point is covered
    expect(under()).toEqual([247.5]);
    expect(root.querySelectorAll('.cp-point.is-under')).toHaveLength(0);
    // on 1.24's ring, every 5°: 245 and 250
    const ring = await mount({ direction_entity: 'sensor.wind_bearing', face: 'ring' });
    expect(under(ring.shadowRoot!)).toEqual([245, 250]);
    const turnTo = async (state: string): Promise<void> => {
      card.hass = {
        ...STATION,
        states: {
          ...STATION.states,
          'sensor.wind_bearing': { ...STATION.states['sensor.wind_bearing']!, state },
        },
      };
      await card.updateComplete;
    };
    // 248° to 10°: 122° clockwise, through north, never 238° back
    await turnTo('10');
    expect(angle()).toBe('370deg');
    await turnTo('350');
    expect(angle()).toBe('350deg');
    // on west the arrow stands on its letter: the letter gives way; the knob's halo does as much
    await turnTo('270');
    const covered = (): string[] =>
      [...root.querySelectorAll('.cp-point.is-under')].map((t) => t.textContent ?? '');
    expect(covered()).toEqual(['W']);
    const knob = await mount({ direction_entity: 'sensor.wind_bearing', indicator: 'knob' });
    knob.hass = card.hass;
    await knob.updateComplete;
    expect(
      [...knob.shadowRoot!.querySelectorAll('.cp-point.is-under')].map((t) => t.textContent),
    ).toEqual(['W']);
    // the knob cuts the ticks with its halo: none gives way under it
    expect(knob.shadowRoot!.querySelectorAll('line.is-under')).toHaveLength(0);
  });

  it('turns north to `north_offset`, its cardinal points upright in their ticks’ place', async () => {
    const points = async (north_offset?: number) => {
      const card = await mount({
        direction_entity: 'sensor.wind_bearing',
        face: 'ring',
        ...(north_offset === undefined ? {} : { north_offset }),
      });
      return placed(card);
    };
    // R 96 at a 360 column: the points stand at 102, in the ticks' band
    expect((await points()).map(({ word, dx, dy }) => [word, dx, dy])).toEqual([
      ['N', 0, -102],
      ['E', 102, 0],
      ['S', 0, 102],
      ['W', -102, 0],
    ]);
    // a balcony facing east: north on the left, east at the top, every letter upright
    const east = await points(-90);
    expect(east.map(({ word, dx, dy }) => [word, dx, dy])).toEqual([
      ['N', -102, 0],
      ['E', 0, -102],
      ['S', 102, 0],
      ['W', 0, 102],
    ]);
    expect(east.every(({ turned }) => !turned)).toBe(true);
    // −180 to 180: further is held there
    expect((await points(540)).map(({ dx, dy }) => [dx, dy])[0]).toEqual([0, 102]);
  });

  it('keeps its anatomy out of reach: the ring, its points and its readouts, "—" for what cannot be read', async () => {
    const card = await mount({
      entity: 'sensor.wind_gone',
      direction_entity: 'sensor.bearing_gone',
      stats: ['sensor.wind_gone', 'sensor.wind_gust'],
    });
    expect(card.shadowRoot?.querySelector('.fv-card')?.classList.contains('is-unavailable')).toBe(
      true,
    );
    expect(text(card, '.fv-dial__value')).toBe('—');
    expect(text(card, '.fv-dial__sub')).toBe('—');
    expect(card.shadowRoot?.querySelectorAll('.cp-point')).toHaveLength(4);
    // the classic face's band (a step off the page's colour the card stands on) and its hairline
    expect(card.shadowRoot?.querySelectorAll('.cp-band, .cp-line')).toHaveLength(2);
    expect(card.shadowRoot?.querySelectorAll('.fv-knob, .cp-arrow')).toHaveLength(0);
    expect(
      [...(card.shadowRoot?.querySelectorAll('.so-cols .fv-readout__value') ?? [])].map((v) =>
        v.textContent?.replace(/\s+/g, ''),
      ),
    ).toEqual(['—', '23.8km/h']);
    expect(text(card, '.fv-badge')).toBe('Unavailable');
  });

  it('says the band its figure is in: its tone, its words in the badge', async () => {
    const card = await mount({
      entity: 'sensor.wind_gust',
      direction_entity: 'sensor.wind_bearing',
      thresholds: [{ value: 20, tone: 'warning', label: 'Breezy' }],
    });
    // the thresholds' reader is fetched by the first card that names one: the card draws again as it lands
    await new Promise((resolve) => setTimeout(resolve, 50));
    await card.updateComplete;
    expect(text(card, '.fv-badge')).toBe('Breezy');
    expect(card.shadowRoot?.querySelector('.cp-dial')?.classList.contains('fv-dial--warning')).toBe(
      true,
    );
  });

  it('declares its height from its config: the head, the ring, the readouts’ row while one is listed', () => {
    const config = { type: 'custom:fluvy-compass-card', direction_entity: 'sun.sun' };
    expect(compassHeight(config)).toBe(340);
    expect(compassHeight({ ...config, stats: ['sensor.wind_gust'] })).toBe(400);
    expect(compassHeight({ ...config, stats: ['sensor.wind_gust'], show_stats: false })).toBe(340);
    expect(compassHeight({ ...config, stats: [] })).toBe(340);
    // compact: the head, a 104 box, its readouts at the extra-small size (16 and 40); a row, 76 whatever it lists
    expect(compassHeight({ ...config, variant: 'compact' })).toBe(204);
    expect(compassHeight({ ...config, variant: 'compact', stats: ['sensor.wind_gust'] })).toBe(260);
    expect(compassHeight({ ...config, variant: 'row', stats: ['sensor.wind_gust'] })).toBe(76);
  });

  it('compact: the head, a small ring at the start (R 28, a 104 box, a tile’s 20 knob), the figure beside it', async () => {
    const card = await mount({
      variant: 'compact',
      entity: 'sensor.wind_speed',
      direction_entity: 'sensor.wind_bearing',
      stats: ['sensor.wind_gust'],
    });
    const root = card.shadowRoot!;
    expect(root.querySelector('.cp-dial svg')?.getAttribute('width')).toBe('104');
    // the arrow in the tile's knob's place, riding the band's middle (27, a band of 6 whose outer edge is 2 past the
    // ring of 28): its tip 23 × 20/36 past it
    expect(root.querySelector('.cp-arrow')?.getAttribute('d')).toMatch(/^M52 12\.22L/);
    const knob = await mount({
      variant: 'compact',
      direction_entity: 'sensor.wind_bearing',
      indicator: 'knob',
    });
    expect((knob.shadowRoot!.querySelector('.fv-knob') as HTMLElement).style.width).toBe('20px');
    expect(root.querySelector('.so-gauge')?.classList.contains('cp-beside')).toBe(true);
    expect(text(card, '.cp-reading .fv-readout__label')).toBe('Speed');
    expect(text(card, '.cp-reading .fv-readout__value')).toBe('14.2km/h');
    expect(text(card, '.cp-reading .fv-dial__sub')).toBe('WSW · 248°');
    // nothing in the ring's centre; the readouts at the extra-small size
    expect(root.querySelector('.fv-dial__disc')).toBeNull();
    expect(root.querySelector('.so-cols .fv-readout--xs')).not.toBeNull();
    expect(card.getGridOptions()).toMatchObject({ columns: 12, min_columns: 6 });
  });

  it('compact: writes its reading beside the ring or under it by its column alone, live or out of reach alike', async () => {
    // a figure as wide as a page measures it, 8 a letter: "14.2 km/h" holds beside the ring at 266, not at 211
    const ruler = vi
      .spyOn(TextRuler.prototype, 'width')
      .mockImplementation(
        (_cls: string, text: string, _unitCls?: string, unit = '') =>
          (text.length + unit.length) * 8,
      );
    /** Where a compact card `width` wide writes its reading. */
    const where = async (config: Partial<CompassCardConfig>, width: number): Promise<string> => {
      const card = await mount({ variant: 'compact', ...config });
      card.width = width;
      await card.updateComplete;
      const root = card.shadowRoot!;
      card.remove();
      return root.querySelector('.cp-beside')
        ? 'beside'
        : root.querySelector('.cp-under')
          ? 'under'
          : '';
    };
    try {
      const twins = [
        { entity: 'sensor.wind_speed', direction_entity: 'sensor.wind_bearing' },
        { entity: 'sensor.wind_gone', direction_entity: 'sensor.bearing_gone' },
        { entity: 'sensor.wind_never', direction_entity: 'sensor.bearing_never' },
      ];
      for (const [width, at] of [
        [152, 'under'],
        [172, 'under'],
        [211, 'under'],
        [266, 'beside'],
        [360, 'beside'],
      ] as const)
        for (const config of twins)
          expect(await where(config, width), `${config.entity} at ${width}`).toBe(at);
    } finally {
      ruler.mockRestore();
    }
  });

  it('under its ring the reading is as tall whatever it says: a word that leaves keeps its line, the degrees leave theirs', async () => {
    // no word holds its line; the point is 12 a letter, the rest 8
    const ruler = vi
      .spyOn(TextRuler.prototype, 'width')
      .mockImplementation((cls: string, text: string, _unitCls?: string, unit = '') =>
        cls === 'fv-readout__label'
          ? 999
          : (text.length + unit.length) * (cls.includes('cp-point-word') ? 12 : 8),
      );
    const drawn = async (width: number): Promise<ShadowRoot> => {
      const card = await mount({
        variant: 'compact',
        entity: 'sensor.wind_speed',
        direction_entity: 'sensor.wind_bearing',
      });
      card.width = width;
      await card.updateComplete;
      card.remove();
      return card.shadowRoot!;
    };
    try {
      // "WSW · 248°" is 120: past 152's 112, within 172's 132
      const narrow = await drawn(152);
      expect(narrow.querySelector('.cp-under .fv-readout__label')?.textContent?.trim()).toBe('');
      expect(narrow.querySelector('.cp-under .fv-dial__sub')?.textContent?.trim()).toBe('WSW');
      const half = await drawn(172);
      expect(
        half.querySelector('.cp-under .fv-dial__sub')?.textContent?.replace(/\s+/g, ' ').trim(),
      ).toBe('WSW · 248°');
      // beside its ring the reading is centred on it: the word's line closes up
      expect((await drawn(360)).querySelector('.cp-reading .fv-readout__label')).toBeNull();
    } finally {
      ruler.mockRestore();
    }
  });

  it('in a small ring the line under the figure holds the open centre: the degrees leave, then the point; the line keeps its place', async () => {
    // the point's line `letter` a letter, the rest 8
    let letter = 8;
    const ruler = vi
      .spyOn(TextRuler.prototype, 'width')
      .mockImplementation((cls: string, text: string, _unitCls?: string, unit = '') =>
        cls.includes('cp-point-word') ? (text.length + unit.length) * letter : 8,
      );
    /** The line under the figure of a card 211 wide (R 60: its open centre 96, 80 of it for a line), `at` a letter. */
    const line = async (config: Partial<CompassCardConfig>, at: number): Promise<string | null> => {
      letter = at;
      const card = await mount(config);
      card.width = 211;
      await card.updateComplete;
      card.remove();
      const sub = card.shadowRoot!.querySelector('.fv-dial__disc .fv-dial__sub');
      return sub ? (sub.textContent ?? '').replace(/\s+/g, ' ').trim() : null;
    };
    const wind = {
      entity: 'sensor.wind_speed',
      direction_entity: 'sensor.wind_bearing',
      face: 'ring' as const,
    };
    try {
      // "WSW · 248°" at 8 a letter is 80: it holds
      expect(await line(wind, 8)).toBe('WSW · 248°');
      // at 12 the degrees leave (120), the point holds (36)
      expect(await line(wind, 12)).toBe('WSW');
      // at 30 the point alone (90) does not hold: the degrees are said alone
      expect(await line(wind, 30)).toBe('248°');
      // the sun's figure is its degrees: its line stays, empty
      expect(await line({ direction_entity: 'sun.sun', face: 'ring' }, 30)).toBe('');
      // a classic face's line is as wide as its band's open circle (56, 3 clear) holds it 35 from the middle: 79
      const classic = { ...wind, face: 'classic' as const };
      expect(await line(classic, 8)).toBe('WSW');
      expect(await line(classic, 7)).toBe('WSW · 248°');
    } finally {
      ruler.mockRestore();
    }
  });

  it('declares the part of a section `grid_options` asks: in half of one the reading is under the ring', () => {
    const config = {
      type: 'custom:fluvy-compass-card',
      entity: 'sensor.wind_speed',
      direction_entity: 'sensor.wind_bearing',
      grid_options: { columns: 6 },
    };
    const stats = ['sensor.wind_gust', 'sensor.wind_average', 'sensor.wind_speed'];
    // compact: the head, its 104 box, the reading under it (76); its readouts one a row (16 and 40 each)
    expect(compassHeight({ ...config, variant: 'compact' })).toBe(280);
    expect(compassHeight({ ...config, variant: 'compact', stats })).toBe(448);
    expect(compassHeight({ ...config, variant: 'compact', grid_options: { columns: 12 } })).toBe(
      204,
    );
    // the ring: R 40 in a 128 box, the reading under it; at nine columns R 88 holds it in its centre
    expect(compassHeight(config)).toBe(304);
    expect(compassHeight({ ...config, stats: stats.slice(0, 1) })).toBe(364);
    expect(compassHeight({ ...config, grid_options: { columns: 9 } })).toBe(324);
    // the row is the row
    expect(compassHeight({ ...config, variant: 'row' })).toBe(76);
  });

  it('a row: the circle ringed by the bearing, its name over its figure, its point and its degrees', async () => {
    const card = await mount({
      variant: 'row',
      name: 'Wind',
      entity: 'sensor.wind_speed',
      direction_entity: 'sensor.wind_bearing',
      secondary_direction_entity: 'sensor.wind_average',
      stats: ['sensor.wind_gust'],
    });
    const root = card.shadowRoot!;
    expect(root.querySelector('.cp-row')).not.toBeNull();
    expect(root.querySelector('.fv-card__head')).toBeNull();
    expect(text(card, '.fv-row__title')).toBe('Wind');
    expect(text(card, '.fv-row__sub')).toBe('14.2 km/h · WSW · 248°');
    // its track, north's notch, the bearing's arrow in small and the second's dot in the secondary ink; no readouts
    expect(root.querySelector('.cp-ringed circle.cp-track')).not.toBeNull();
    expect(root.querySelector('.cp-ringed path.cp-notch')).not.toBeNull();
    expect(root.querySelector('.cp-ringed .cp-arrow:not(.is-second)')).not.toBeNull();
    expect(root.querySelector('.cp-ringed circle.cp-dot.is-second')).not.toBeNull();
    expect(root.querySelector('.so-cols')).toBeNull();
    // the row is the card's button; it takes half a section
    expect(root.querySelector('.fv-tile__tap')).not.toBeNull();
    expect(card.getGridOptions()).toMatchObject({ columns: 6, min_columns: 6 });
    // the ticks across its sixteenth: an arc on the ring; the bearing as the figure, its degrees and its point
    const sun = await mount({ variant: 'row', direction_entity: 'sun.sun', indicator: 'ticks' });
    expect(sun.shadowRoot?.querySelector('.cp-ringed path.cp-arc')).not.toBeNull();
    expect(text(sun, '.fv-row__sub')).toBe('291° · WNW');
    const gone = await mount({
      variant: 'row',
      entity: 'sensor.wind_gone',
      direction_entity: 'sensor.bearing_gone',
    });
    expect(text(gone, '.fv-row__sub')).toBe('Unavailable');
    expect(gone.shadowRoot?.querySelector('.cp-ringed .cp-arrow')).toBeNull();
    // the knob in small, where it is asked for
    const knob = await mount({ variant: 'row', direction_entity: 'sun.sun', indicator: 'knob' });
    expect(knob.shadowRoot?.querySelector('.cp-ringed circle.cp-mini-knob')).not.toBeNull();
  });

  it('asks for a bearing or a figure, and offers the house’s wind, never its speed as a direction', () => {
    expect(() => new FluvyCompassCard().setConfig({ type: 'custom:fluvy-compass-card' })).toThrow(
      /"entity" or "direction_entity"/,
    );
    const states = {
      'sensor.wind_speed': { attributes: { device_class: 'wind_speed' } },
      'sensor.wind_bearing': { attributes: { device_class: 'wind_direction' } },
    };
    expect(
      FluvyCompassCard.getStubConfig({ states }, ['sensor.wind_speed', 'sensor.wind_bearing']),
    ).toEqual({
      type: 'custom:fluvy-compass-card',
      entity: 'sensor.wind_speed',
      direction_entity: 'sensor.wind_bearing',
    });
    // a speed with no bearing beside it: the sun, never the speed
    expect(FluvyCompassCard.getStubConfig({ states }, ['sensor.wind_speed'])).toEqual({
      type: 'custom:fluvy-compass-card',
      entity: 'sensor.wind_speed',
      direction_entity: 'sun.sun',
    });
    // a weather entity's wind is its own figure
    expect(
      FluvyCompassCard.getStubConfig({ states }, ['weather.home', 'sensor.wind_speed']),
    ).toEqual({ type: 'custom:fluvy-compass-card', direction_entity: 'weather.home' });
  });
});

describe('the Compass card’s editor', () => {
  const shown = (data: Record<string, unknown>): string[] =>
    JSON.stringify(visibleFields(compassEditor.getConfigForm().schema, data))
      .match(/"name":"[a-z_]+"/g)!
      .map((name) => name.slice(8, -1));

  it('offers the arrow first and says it is the bearing’s pointer where none is set; the second’s is the dot', () => {
    const pointer = JSON.stringify(compassEditor.getConfigForm().schema).match(
      /"name":"indicator","selector":\{"select":\{"mode":"dropdown","options":(\[[^\]]*\])/,
    );
    expect(JSON.parse(pointer![1]!).map((o: { value: string }) => o.value)).toEqual([
      'arrow',
      'chevron',
      'knob',
      'ticks',
      'dot',
    ]);
    expect(compassEditor.defaults({ type: 'custom:fluvy-compass-card' }, undefined)).toMatchObject({
      face: 'classic',
      indicator: 'arrow',
      secondary_indicator: 'dot',
      arrow_points: 'outward',
    });
  });

  it('offers the face, Classic or Ring, where the card draws a ring', () => {
    const face = JSON.stringify(compassEditor.getConfigForm().schema).match(
      /"name":"face","selector":\{"select":\{"mode":"dropdown","options":(\[[^\]]*\])/,
    );
    expect(JSON.parse(face![1]!).map((o: { value: string }) => o.value)).toEqual([
      'classic',
      'ring',
    ]);
    expect(shown({ direction_entity: 'sensor.wind_bearing' })).toContain('face');
    expect(shown({ direction_entity: 'sensor.wind_bearing', variant: 'compact' })).toContain(
      'face',
    );
    expect(shown({ direction_entity: 'sensor.wind_bearing', variant: 'row' })).not.toContain(
      'face',
    );
  });

  it('shows which way an arrow points only where one is drawn: the bearing’s, or a second asked for one', () => {
    const bearing = { direction_entity: 'sensor.wind_bearing' };
    const second = { ...bearing, secondary_direction_entity: 'sensor.wind_average' };
    expect(shown(bearing)).toContain('arrow_points');
    expect(shown({ ...bearing, indicator: 'arrow' })).toContain('arrow_points');
    // a chevron points too
    expect(shown({ ...bearing, indicator: 'chevron' })).toContain('arrow_points');
    for (const indicator of ['knob', 'ticks', 'dot'])
      expect(shown({ ...second, indicator })).not.toContain('arrow_points');
    expect(shown({ ...second, indicator: 'knob', secondary_indicator: 'arrow' })).toContain(
      'arrow_points',
    );
    expect(shown({ ...second, indicator: 'dot', secondary_indicator: 'chevron' })).toContain(
      'arrow_points',
    );
    // a second's arrow without a second bearing draws nothing
    expect(shown({ ...bearing, indicator: 'knob', secondary_indicator: 'arrow' })).not.toContain(
      'arrow_points',
    );
  });

  it('shows only what can act: a second pointer with a second bearing, an attribute with its entity', () => {
    const bare = shown({ direction_entity: 'sensor.wind_bearing' });
    expect(bare).toContain('direction_attribute');
    expect(bare).not.toContain('secondary_indicator');
    expect(bare).not.toContain('secondary_direction_attribute');
    expect(shown({ secondary_direction_entity: 'sensor.wind_average' })).toEqual(
      expect.arrayContaining(['secondary_indicator', 'secondary_direction_attribute']),
    );
  });

  it('shows the unit, the decimals and the thresholds where there is a figure to read: a sensor’s, a weather’s wind', () => {
    // the sun, or a sensor alone, is the bearing: the ring reads its degrees
    for (const data of [{ direction_entity: 'sun.sun' }, { entity: 'sensor.wind_bearing' }])
      for (const key of ['unit', 'decimals', 'thresholds']) expect(shown(data)).not.toContain(key);
    expect(shown({ entity: 'sensor.wind_speed', direction_entity: 'sensor.wind_bearing' })).toEqual(
      expect.arrayContaining(['unit', 'decimals', 'thresholds']),
    );
    // a weather entity's wind is in its own unit: its decimals and its thresholds
    for (const data of [{ direction_entity: 'weather.home' }, { entity: 'weather.home' }]) {
      expect(shown(data)).toEqual(expect.arrayContaining(['decimals', 'thresholds']));
      expect(shown(data)).not.toContain('unit');
    }
    const sun = shown({ direction_entity: 'sun.sun' });
    // the label names whatever the ring reads, the bearing too
    expect(sun).toContain('label');
  });

  it('shows the badge while the head shows one, and show_stats while a readout is listed', () => {
    expect(shown({})).toContain('badge');
    expect(shown({ show_badge: false })).not.toContain('badge');
    expect(shown({})).not.toContain('show_stats');
    expect(shown({ stats: ['sensor.wind_gust'] })).toContain('show_stats');
  });

  it('offers its layouts, and hides in a row what a row does not draw: its head, its ring’s letters, its readouts', () => {
    const wind = {
      entity: 'sensor.wind_speed',
      direction_entity: 'sensor.wind_bearing',
      stats: ['sensor.wind_gust'],
    };
    const full = shown(wind);
    const row = shown({ ...wind, variant: 'row' });
    const gone = ['subtitle', 'show_icon', 'show_badge', 'show_ticks', 'show_cardinals', 'label'];
    for (const key of [...gone, 'badge', 'stats', 'show_stats']) {
      expect(full).toContain(key);
      expect(row).not.toContain(key);
    }
    // the bearing, its pointers and its colours act in a row as on the ring
    expect(row).toEqual(
      expect.arrayContaining([
        'variant',
        'name',
        'icon',
        'indicator',
        'north_offset',
        'thresholds',
      ]),
    );
    expect(shown({ ...wind, variant: 'compact' })).toEqual(full);
    expect(compassEditor.defaults?.({ type: 'x' }, undefined)['variant']).toBe('full');
  });
});
