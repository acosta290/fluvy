import { describe, expect, it } from 'vitest';
import { KIND_WORDS, NOT_AN_APPLIANCE } from '../appliance/words.generated.js';
import { GENERIC, LIGHT_WORDS } from '../strategy/words.generated.js';
import { says, type Rules } from './words.js';

/** A class's regex as the build writes it: its stems as a group; a Latin word between separators, kana and kanji anywhere. */
const substring = (...stems: string[]): RegExp => new RegExp(`(${stems.join('|')})`, 'i');
const word = (latin: string[], cjk: string[]): RegExp =>
  new RegExp(`(?:^|[\\s_.-])(${latin.join('|')})(?:[\\s_.-]|$)|(${cjk.join('|')})`, 'i');

// plain stems, no lookaround: what the matcher decides is what holds, not what a stem guards against
const LIGHT = word(['light', 'lamp', 'spot'], ['照明', '電気', 'ライト']);
const KETTLE = substring('kettle', 'ケトル', '電気ケトル', 'ポット', '電気ポット');
const MICROWAVE = substring('microwave', 'レンジ', '電子レンジ');
const HOB = substring('hob', 'コンロ', 'ガスコンロ', 'ガスレンジ');
const HOOD = substring('hood', 'レンジフード');
const OVEN = substring('oven', 'オーブン');
const TOASTER = substring('toaster', 'トースター', 'オーブントースター');
const DRYER = substring('dryer', '乾燥機');
const NEVER = substring('hair[ _-]?dryer', '布団乾燥機', 'ドライヤー');
const WASHER = substring('washer', '洗濯機');
const DISHWASHER = substring('dish[ _-]?washer', '食洗機');
const FRIDGE = substring('fridge', '冷蔵庫');
const FREEZER = substring('freezer', '冷凍庫');
const WINE = substring('wine', 'ワイン');
const GARDEN = substring('garden', '庭');
const HOME = substring('home', '家庭');

const KINDS: Rules<string> = [
  ['light', LIGHT],
  ['oven', OVEN],
  ['microwave', MICROWAVE],
  ['hob', HOB],
  ['hood', HOOD],
  ['kettle', KETTLE],
  ['toaster', TOASTER],
];

describe('says', () => {
  it('reads the longest of words that overlap, whatever the lists’ order', () => {
    expect(says('電気ケトル', KINDS)).toBe('kettle');
    expect(says('電気ポット', KINDS)).toBe('kettle');
    expect(says('ガスレンジ', KINDS)).toBe('hob');
    expect(says('レンジフード', KINDS)).toBe('hood');
    expect(says('電子レンジ', KINDS)).toBe('microwave');
    expect(says('オーブントースター', KINDS)).toBe('toaster');
    expect(says('オーブン', KINDS)).toBe('oven');
    expect(says('リビングの電気', KINDS)).toBe('light');
    // a longer never-word beats the kind inside it, listed after it
    const dryers: Rules<string> = [
      ['dryer', DRYER],
      ['never', NEVER],
    ];
    expect(says('布団乾燥機', dryers)).toBe('never');
    expect(says('Hair dryer', dryers)).toBe('never');
    expect(says('乾燥機', dryers)).toBe('dryer');
    // in Latin letters too: the dishwasher's word holds the washer's, listed first
    const washers: Rules<string> = [
      ['washer', WASHER],
      ['dishwasher', DISHWASHER],
    ];
    expect(says('Dishwasher', washers)).toBe('dishwasher');
    expect(says('Dish washer', washers)).toBe('dishwasher');
    expect(says('Washer', washers)).toBe('washer');
  });

  it('lets words that stand apart each hold: the first class listed wins', () => {
    expect(
      says('Wine fridge', [
        ['wine', WINE],
        ['fridge', FRIDGE],
      ]),
    ).toBe('wine');
    const cold: Rules<string> = [
      ['fridge', FRIDGE],
      ['freezer', FREEZER],
    ];
    expect(says('Fridge freezer', cold)).toBe('fridge');
    expect(says('Fridge freezer', [...cold].reverse())).toBe('freezer');
    // 庭のライト is outdoors to the place question and a light to the kind question
    const places: Rules<string> = [
      ['outdoor', GARDEN],
      ['home', HOME],
    ];
    expect(says('庭のライト', places)).toBe('outdoor');
    expect(says('庭のライト', KINDS)).toBe('light');
    // a word another holds whole says nothing: 家庭, the household, has no garden in it
    expect(says('家庭の消費電力', places)).toBe('home');
  });

  it('breaks a tie by the order listed, and runs every class, never the first to hit alone', () => {
    const same = /(spot)/i;
    expect(
      says('Spot', [
        ['a', same],
        ['b', same],
      ]),
    ).toBe('a');
    expect(
      says('Spot', [
        ['b', same],
        ['a', same],
      ]),
    ).toBe('b');
    // the last class listed wins by its longer word
    const three: Rules<string> = [
      ['dryer', DRYER],
      ['washer', WASHER],
      ['never', NEVER],
    ];
    expect(says('Hair dryer', three)).toBe('never');
    expect(says('Steckdose Flur', three)).toBeUndefined();
  });

  it('measures the stem, not the separators a word shape consumes, and bounds a Latin word', () => {
    // " spot " read between separators and "spot" as a substring are the same four letters: the order decides
    expect(
      says('a spot', [
        ['sub', /(spot)/],
        ['word', LIGHT],
      ]),
    ).toBe('sub');
    expect(
      says('a spot', [
        ['word', LIGHT],
        ['sub', /(spot)/],
      ]),
    ).toBe('word');
    // the word shape never reads a word inside another
    expect(says('Despot', [['light', LIGHT]])).toBeUndefined();
    expect(says('Flashlight', [['light', LIGHT]])).toBeUndefined();
    expect(says('switch.kitchen_light Kitchen light', [['light', LIGHT]])).toBe('light');
    // a regex without a group counts its whole match
    expect(says('kettle', [['kettle', /kett/]])).toBe('kettle');
    // mixed scripts: Latin letters beside kana, each read as its shape asks
    expect(says('LED テープ', [['light', word(['led'], ['ライト'])], ...KINDS])).toBe('light');
    expect(says('キッチン kettle', KINDS)).toBe('kettle');
    expect(says('kitchen ケトル', KINDS)).toBe('kettle');
  });

  it('reads the generated words by the stem they capture', () => {
    const stem = (match: RegExpExecArray | null): string | undefined =>
      match?.slice(1).find((group) => group !== undefined);
    expect(stem(LIGHT_WORDS.exec('switch.kitchen_light Kitchen light'))).toBe('light');
    expect(stem(LIGHT_WORDS.exec('リビングの電気'))).toBe('電気');
    const kettle = KIND_WORDS.find(([kind]) => kind === 'kettle')![1];
    expect(stem(kettle.exec('電気ケトル'))).toBe('電気ケトル');
    expect(stem(NOT_AN_APPLIANCE.exec('hair dryer'))).toBe('hair dryer');
    expect(stem(GENERIC.exec('温度'))).toBe('温度');
    expect(says('電気ケトル', [['light', LIGHT_WORDS], ...KIND_WORDS])).toBe('kettle');
    expect(says('キッチンの電気', [['light', LIGHT_WORDS], ...KIND_WORDS])).toBe('light');
  });
});
