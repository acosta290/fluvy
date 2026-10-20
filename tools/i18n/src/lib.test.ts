import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APPLIANCE_OUT, CJK, generate, generateAppliance, OUT, pattern, plain } from './build.js';
import {
  catalogueCodes,
  compare,
  compareIntegration,
  englishParts,
  LOCALES,
  readCatalogue,
  ROOT,
} from './lib.js';

describe('the catalogues on disk', () => {
  it('are the languages the registry names', async () => {
    const registry = await readFile(
      join(ROOT, 'packages', 'core', 'src', 'i18n', 'languages.ts'),
      'utf8',
    );
    const codes =
      /LANGUAGE_CODES = \[([^\]]+)\]/
        .exec(registry)?.[1]
        ?.match(/'([^']+)'/g)
        ?.map((s) => s.slice(1, -1)) ?? [];
    expect([...codes].sort()).toEqual(await catalogueCodes());
  });

  it('mirror English key for key, with the same placeholders and words', async () => {
    const english = await readCatalogue('en');
    for (const code of await catalogueCodes()) {
      if (code === 'en') continue;
      const errors = compare(code, await readCatalogue(code), english, true).filter(
        (p) => p.level === 'error',
      );
      expect(errors.map((p) => `${p.language} ${p.text}`)).toEqual([]);
    }
  });

  it('keep English in parts, core first, each namespace in one of them', async () => {
    const parts = await englishParts();
    expect(parts[0]?.part).toBe('core.json');
    const namespaces = parts.flatMap(({ tables }) => Object.keys(tables));
    expect(namespaces.length).toBe(new Set(namespaces).size);
    expect(Object.keys(await readCatalogue('en'))).toEqual([...namespaces, 'words']);
  });

  it('ship no naming words: every language has them beside its catalogue, as build input', async () => {
    const shipped = [
      ...(await englishParts()).map(({ tables }) => tables),
      ...(await Promise.all(
        (await catalogueCodes())
          .filter((code) => code !== 'en')
          .map(
            async (code) =>
              JSON.parse(await readFile(join(LOCALES, `${code}.json`), 'utf8')) as object,
          ),
      )),
    ];
    for (const tables of shipped) expect(tables).not.toHaveProperty('words');
    for (const code of await catalogueCodes())
      expect(Object.keys((await readCatalogue(code))['words'] ?? {}).length).toBeGreaterThan(0);
  });

  it('have their integration translation, key for key with strings.json', async () => {
    for (const code of await catalogueCodes())
      expect((await compareIntegration(code)).map((p) => p.text)).toEqual([]);
  });

  it('are what the strategy’s generated words were built from', async () => {
    expect(await readFile(OUT, 'utf8')).toBe(await generate());
  });

  it('are what the appliances’ generated words were built from', async () => {
    expect(await readFile(APPLIANCE_OUT, 'utf8')).toBe(await generateAppliance());
  });

  it('give every appliance kind plain stems in every language: a name is read with its accents taken off, kana and kanji as written', async () => {
    for (const code of await catalogueCodes()) {
      const words = (await readCatalogue(code))['words'] as Record<string, readonly string[]>;
      const kinds = Object.entries(words).filter(([category]) => category.startsWith('appliance_'));
      expect(kinds.length, code).toBe(18);
      for (const [category, stems] of kinds)
        for (const stem of stems) {
          expect(stem, `${code} ${category}`).toBe(plain(stem));
          for (const char of stem)
            expect(/[\x20-\x7e]/.test(char) || CJK.test(char), `${code} ${category} ${stem}`).toBe(
              true,
            );
        }
    }
  });
});

describe('the generated patterns', () => {
  it('match a Latin stem in its shape and a kana or kanji stem as a substring, Japanese writing no spaces', () => {
    expect(pattern(['light', 'spot', '照明', 'ライト'], 'word')).toBe(
      '(^|[\\s_.-])(light|spot)([\\s_.-]|$)|(照明|ライト)',
    );
    const light = new RegExp(pattern(['light', 'spot', '照明', 'ライト', '電気'], 'word'), 'i');
    for (const name of [
      'switch.spot Spot',
      'switch.kitchen_light Kitchen light',
      'switch.zhao_ming 照明',
      'switch.ribingu_no_denki リビングの電気',
      'switch.living ライト',
    ])
      expect(light.test(name), name).toBe(true);
    for (const name of ['switch.despot Despot', 'switch.lighthouse Lighthouse', '電子レンジ'])
      expect(light.test(name), name).toBe(false);
    // a whole name says the kind of reading in either script
    const generic = new RegExp(pattern(['temperature', '温度'], 'whole'), 'i');
    expect(generic.test('温度')).toBe(true);
    expect(generic.test('リビング温度')).toBe(false);
    // a place's noise is taken out in either script; a stem may carry a lookaround of its own
    const noise = new RegExp(
      pattern(['sensor', 'センサー', '温度', 'の(?=[温セ])'], 'words'),
      'gi',
    );
    expect('リビングの温度センサー'.replace(noise, ' ').trim()).toBe('リビング');
    expect(
      'Living room sensor'
        .replace(noise, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim(),
    ).toBe('Living room');
    // a substring shape holds both as they are
    expect(pattern(['washer', '洗濯機'], 'substring')).toBe('washer|洗濯機');
  });

  it('read a name plain: accents off, ordinary width, a kana’s voicing mark kept', () => {
    expect(plain('Kühlschrank')).toBe('kuhlschrank');
    expect(plain('Çamaşır makinesi')).toBe('camasir makinesi');
    expect(plain('Heißluftfritteuse')).toBe('heissluftfritteuse');
    expect(plain('ＬＥＤライト')).toBe('ledライト');
    expect(plain('ｶﾞﾚｰｼﾞ')).toBe('ガレージ');
    expect(plain('ガレージ'.normalize('NFD'))).toBe('ガレージ');
    expect(plain('食洗機')).toBe('食洗機');
    expect(plain('ぱぴぷ')).toBe('ぱぴぷ');
  });
});
