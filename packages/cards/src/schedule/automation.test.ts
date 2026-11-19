import { describe, expect, it } from 'vitest';
import { buildAutomation, type Schedule } from '../automations/schedule.js';
import {
  buildHeating,
  checkHeating,
  followedSchedule,
  HeatingError,
  parseHeating,
  type Heating,
} from './automation.js';

const BEDROOM: Heating = {
  id: 'fluvy_b3d7a0c1e2f4',
  alias: 'Heating schedule · Bedroom',
  description: 'Written by Fluvy’s Heating schedule card.',
  schedule: 'schedule.bedroom_heating',
  climate: 'climate.bedroom',
  presets: [
    { key: 'comfort', name: 'Comfort', temperature: 21 },
    { key: 'eco', name: 'Eco', temperature: 18 },
    { key: 'away', name: 'Away', temperature: 16 },
  ],
  base: 'eco',
};

/** A built automation as a person edits it in Home Assistant: any part of it changed, added or taken away. */
interface Step {
  action?: string;
  service?: string;
  target: { entity_id: unknown };
  data: Record<string, unknown>;
}
interface Edited {
  [key: string]: unknown;
  conditions: { state: unknown }[];
  actions: { choose: { sequence: Step[] }[]; default: Step[] }[];
}
const edit = (heating: Heating = BEDROOM): Edited =>
  structuredClone(buildHeating(heating)) as unknown as Edited;

describe('the heating schedule’s automation', () => {
  it('is the shape Fluvy writes: the helper and the start as triggers, on or off as its condition, a branch a preset, the base as its default', () => {
    expect(buildHeating(BEDROOM)).toEqual({
      id: 'fluvy_b3d7a0c1e2f4',
      alias: 'Heating schedule · Bedroom',
      description: 'Written by Fluvy’s Heating schedule card.',
      triggers: [
        { trigger: 'state', entity_id: 'schedule.bedroom_heating' },
        { trigger: 'homeassistant', event: 'start' },
      ],
      conditions: [
        { condition: 'state', entity_id: 'schedule.bedroom_heating', state: ['on', 'off'] },
      ],
      actions: [
        {
          choose: ['comfort', 'eco', 'away'].map((key, i) => ({
            alias: ['Comfort', 'Eco', 'Away'][i],
            conditions: [
              {
                condition: 'state',
                entity_id: 'schedule.bedroom_heating',
                attribute: 'preset',
                state: key,
              },
            ],
            sequence: [
              {
                action: 'climate.set_temperature',
                target: { entity_id: 'climate.bedroom' },
                data: { temperature: [21, 18, 16][i] },
              },
            ],
          })),
          default: [
            {
              alias: 'Eco',
              action: 'climate.set_temperature',
              target: { entity_id: 'climate.bedroom' },
              data: { temperature: 18 },
            },
          ],
        },
      ],
      mode: 'restart',
    });
  });

  it('reads back what it built, round and round', () => {
    const read = parseHeating(buildHeating(BEDROOM));
    expect(read).toEqual(BEDROOM);
    expect(buildHeating(read as Heating)).toEqual(buildHeating(BEDROOM));
  });

  it('sets the thermostat’s own preset where asked, and a range-only unit’s low end with its top as the high', () => {
    const own: Heating = {
      ...BEDROOM,
      presets: [
        { key: 'comfort', name: 'Comfort', mode: 'comfort' },
        { key: 'eco', name: 'Eco', temperature: 18.5, high: 30 },
      ],
    };
    const built = buildHeating(own);
    const [branch, second] = built.actions[0].choose;
    expect(branch?.sequence[0]).toEqual({
      action: 'climate.set_preset_mode',
      target: { entity_id: 'climate.bedroom' },
      data: { preset_mode: 'comfort' },
    });
    expect(second?.sequence[0].data).toEqual({ target_temp_low: 18.5, target_temp_high: 30 });
    expect(parseHeating(built)).toEqual(own);
  });

  it('keeps a preset of the person’s own by its name, whatever its letters', () => {
    const heating: Heating = {
      ...BEDROOM,
      presets: [
        ...BEDROOM.presets,
        { key: 'Nachtabsenkung für Kinder', name: 'Nachtabsenkung für Kinder', temperature: 17 },
      ],
    };
    expect(parseHeating(buildHeating(heating))).toEqual(heating);
  });

  it('refuses to build what it could not read back', () => {
    const problem = (part: Partial<Heating>): unknown => checkHeating({ ...BEDROOM, ...part });
    expect(problem({ id: 'my_automation' })).toBe('bad_id');
    expect(problem({ climate: 'light.bedroom' })).toBe('bad_entities');
    expect(problem({ schedule: 'input_boolean.plan' })).toBe('bad_entities');
    expect(problem({ presets: [] })).toBe('no_presets');
    expect(problem({ base: 'boost' })).toBe('no_base');
    expect(
      problem({ presets: [...BEDROOM.presets, { key: 'eco', name: 'Eco 2', temperature: 17 }] }),
    ).toBe('same_preset');
    expect(
      problem({ presets: [...BEDROOM.presets, { key: 'x', name: 'COMFORT', temperature: 17 }] }),
    ).toBe('same_preset');
    expect(problem({ presets: [{ key: 'eco', name: 'Eco', temperature: Number.NaN }] })).toBe(
      'bad_temperature',
    );
    expect(problem({ presets: [{ key: 'eco', name: 'Eco' }] })).toBe('bad_preset');
    expect(
      problem({ presets: [{ key: '{{ x }}', name: 'Eco', temperature: 18 }], base: '{{ x }}' }),
    ).toBe('bad_preset');
    expect(() => buildHeating({ ...BEDROOM, base: 'boost' })).toThrow(HeatingError);
  });

  it('reads what Home Assistant’s editor leaves as the same: older keys, a list of one, empty metadata, any order', () => {
    const edited = edit();
    edited['trigger'] = [
      { platform: 'homeassistant', event: 'start', metadata: {} },
      { platform: 'state', entity_id: ['schedule.bedroom_heating'] },
    ];
    delete edited['triggers'];
    edited.conditions[0]!.state = ['off', 'on'];
    const step = edited.actions[0]!.default[0]!;
    step.service = String(step.action);
    delete step.action;
    step.target.entity_id = ['climate.bedroom'];
    expect(parseHeating(edited)).toEqual(BEDROOM);
  });

  it('never reads an automation edited past the shape: a template, another step, another mode, a base it never had', () => {
    const templated = edit();
    templated.actions[0]!.default[0]!.data['temperature'] = '{{ states("input_number.eco") }}';
    expect(parseHeating(templated)).toBeUndefined();
    const extra = edit();
    extra.actions[0]!.choose[0]!.sequence.push({
      action: 'light.turn_on',
      target: { entity_id: 'light.x' },
      data: {},
    });
    expect(parseHeating(extra)).toBeUndefined();
    const single = edit();
    single['mode'] = 'single';
    expect(parseHeating(single)).toBeUndefined();
    const base = edit();
    base.actions[0]!.default[0]!.data['temperature'] = 19;
    expect(parseHeating(base)).toBeUndefined();
    const two = edit();
    two.actions[0]!.choose[1]!.sequence[0]!.target.entity_id = 'climate.other';
    expect(parseHeating(two)).toBeUndefined();
    const keys = edit();
    keys['variables'] = { eco: 18 };
    expect(parseHeating(keys)).toBeUndefined();
    expect(parseHeating({ ...edit(), id: '1690000000001' })).toBeUndefined();
  });

  it('is never the automations card’s schedule, nor that one this', () => {
    const lamp: Schedule = {
      id: 'fluvy_a1b2c3d4e5f6',
      alias: 'Good morning',
      targets: ['light.kitchen'],
      days: { kind: 'every' },
      start: { kind: 'time', at: '06:45' },
      then: { verb: 'on' },
    };
    expect(parseHeating(buildAutomation(lamp))).toBeUndefined();
  });

  it('says which helper an automation edited past the shape follows, where it names one', () => {
    const templated = edit();
    templated.actions[0]!.default[0]!.data['temperature'] = '{{ 18 }}';
    expect(followedSchedule(templated)).toBe('schedule.bedroom_heating');
    expect(followedSchedule({ triggers: [{ trigger: 'time', at: '07:00' }] })).toBeUndefined();
    expect(followedSchedule('nothing')).toBeUndefined();
  });
});
