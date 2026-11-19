import { describe, expect, it } from 'vitest';
import {
  checkBudgets,
  checkCounts,
  checkUncounted,
  parseBudgets,
  parseEveryPageKb,
  type Facts,
} from './facts.js';
import { numberOf, wordsOf } from './words.js';

describe('numbers as the docs spell them', () => {
  it('spells the counts the prose uses', () => {
    expect(wordsOf(41)).toBe('forty-one');
    expect(wordsOf(52)).toBe('fifty-two');
    expect(wordsOf(55)).toBe('fifty-five');
    expect(wordsOf(15)).toBe('fifteen');
    expect(wordsOf(5)).toBe('five');
    expect(wordsOf(8)).toBe('eight');
    expect(wordsOf(20)).toBe('twenty');
    expect(wordsOf(100)).toBe('one hundred');
    expect(wordsOf(125)).toBe('one hundred and twenty-five');
  });

  it('refuses what it cannot spell', () => {
    expect(() => wordsOf(-1)).toThrow(RangeError);
    expect(() => wordsOf(1000)).toThrow(RangeError);
    expect(() => wordsOf(1.5)).toThrow(RangeError);
  });

  it('reads them back, capitals and a space or a hyphen alike', () => {
    expect(numberOf('fifty-five')).toBe(55);
    expect(numberOf('Fifty-five')).toBe(55);
    expect(numberOf('FIFTY FIVE')).toBe(55);
    expect(numberOf('forty-one')).toBe(41);
    expect(numberOf('Fifteen')).toBe(15);
    expect(numberOf('five')).toBe(5);
    expect(numberOf('eight')).toBe(8);
    expect(numberOf('twenty')).toBe(20);
    expect(numberOf('52')).toBe(52);
    expect(numberOf('more')).toBeUndefined();
    expect(numberOf('twenty-twenty')).toBeUndefined();
    for (let n = 0; n < 100; n++) expect(numberOf(wordsOf(n))).toBe(n);
  });
});

const FACTS: Facts = {
  palettes: 15,
  tabs: 5,
  everyPageKb: 232,
  budgets: { 'fluvy.js': 2048, core: 237_568, energy: 77_824, lang: 24_576, 'loader.js': 4096 },
};

describe('the library, never counted (#221)', () => {
  it('passes prose that says it without a count', () => {
    const text = [
      'Fluvy brings one design: a theme, a card for every part of the house, the automatic dashboards.',
      '## The cards',
      'in every language Fluvy speaks; two cards of one entity type side by side.',
    ].join('\n');
    expect(checkUncounted('README.md', text)).toEqual([]);
  });

  it('names every count of the cards, the languages or the dashboards, with the file, the line and what to say', () => {
    const text =
      'A calm theme: sixty-eight cards, seven automatic dashboards.\nIn twenty languages.';
    expect(checkUncounted('package.json', text)).toEqual([
      {
        file: 'package.json',
        line: 1,
        text: '"sixty-eight cards" — say it without a count ("every card")',
      },
      {
        file: 'package.json',
        line: 1,
        text: '"seven automatic dashboards" — say it without a count ("the automatic dashboards")',
      },
      {
        file: 'package.json',
        line: 2,
        text: '"twenty languages" — say it without a count ("every language Fluvy speaks")',
      },
    ]);
  });

  it('reads one written in digits, in capitals or as the templates', () => {
    expect(
      checkUncounted(
        'docs/x.md',
        '## Sixty-Eight Cards\n68 cards, 20 languages, Seven templates as rows; seven dashboards Fluvy builds',
      ).map((f) => f.text.split(' — ')[0]),
    ).toEqual([
      '"Sixty-Eight Cards"',
      '"68 cards"',
      '"20 languages"',
      '"Seven templates"',
      '"seven dashboards Fluvy builds"',
    ]);
  });

  it('never takes a handful on a page or under test for the library', () => {
    expect(
      checkUncounted(
        'tools/render/x.mjs',
        'two cards side by side; ten cards on the fixture; in five languages; four more templates build a dashboard each',
      ),
    ).toEqual([]);
  });

  it('reads a source comment as the prose', () => {
    const comment =
      '// sixty-eight cards share one parsed copy; a fixture of two tabs in fifteen palettes';
    expect(checkUncounted('packages/ui/src/x.ts', comment).map((f) => f.text)).toEqual([
      '"sixty-eight cards" — say it without a count ("every card")',
    ]);
  });
});

describe('the counts the code holds', () => {
  it('pass when they say what the code says, whatever the case', () => {
    const text = [
      'Fifteen presets in two lines; fifteen palettes in the gallery.',
      'The five tabs — Appearance, Scope, Dashboards, Wall, Preferences; 15 palettes.',
    ].join('\n');
    expect(checkCounts('README.md', text, FACTS)).toEqual([]);
  });

  it('fail on a stale count, naming the file, the line and the fact', () => {
    const text = 'A calm theme in fourteen palettes.\nSix tabs.';
    expect(checkCounts('docs/settings-panel.md', text, FACTS)).toEqual([
      {
        file: 'docs/settings-panel.md',
        line: 1,
        text: '"fourteen palettes" — the code says fifteen (15) palettes',
      },
      {
        file: 'docs/settings-panel.md',
        line: 2,
        text: '"Six tabs" — the code says five (5) tabs',
      },
    ]);
  });

  it('fail on a stale count written in digits or in capitals', () => {
    expect(
      checkCounts('docs/x.md', '14 presets, Four equal tabs', FACTS).map((f) => f.text),
    ).toEqual([
      '"14 presets" — the code says fifteen (15) palettes',
      '"Four equal tabs" — the code says five (5) tabs',
    ]);
  });

  it('never take two presets tried for the gallery', () => {
    expect(checkCounts('docs/x.md', 'two presets tried; eight palettes saved', FACTS)).toEqual([]);
  });
});

describe('the development guide’s budgets', () => {
  const guide = [
    'fails the build when the initial set goes over **232 KB gzip** or carries a family’s English',
    'fetches `chunks/{energy,lang-*}-<hash>.js` on demand',
    '| Script | Budget (gzip) | What it is |',
    '| --- | --- | --- |',
    '| `fluvy.js` | 2 KB | the entry |',
    '| `core` | 232 KB | what every page loads |',
    '| `energy` | 76 KB | the energy family |',
    '| `lang` | 24 KB | a language |',
    '| `loader.js` | 4 KB | the loader |',
  ].join('\n');

  it('pass when the figure, the list and the table are the build’s', () => {
    expect(checkBudgets('docs/development.md', guide, FACTS)).toEqual([]);
  });

  it('fail on a stale figure, a missing chunk, a stale row or a row for no chunk', () => {
    const stale = guide
      .replace('**232 KB gzip**', '**224 KB gzip**')
      .replace('{energy,lang-*}', '{lang-*}')
      .replace('| `energy` | 76 KB |', '| `energy` | 64 KB |')
      .replace(
        '| `loader.js` | 4 KB | the loader |',
        '| `loader.js` | 4 KB | the loader |\n| `media` | 16 KB | gone |',
      );
    expect(checkBudgets('docs/development.md', stale, FACTS).map((f) => f.text)).toEqual([
      '"over **224 KB gzip**" — finish.mjs says 232 KB',
      '`energy` 64 KB — check.mjs says 77824 B (76 KB)',
      '`media` is in the table but check.mjs budgets no such chunk',
      'the chunk list lacks `energy`',
    ]);
  });

  it('read the budgets as check.mjs and finish.mjs write them', () => {
    expect(
      parseBudgets(
        "const X = 1;\nconst BUDGETS = {\n  'fluvy.js': 2048,\n  // a comment\n  core: 237_568,\n  'history-bars-readings': 8192,\n};\nconst tag = 1;",
      ),
    ).toEqual({ 'fluvy.js': 2048, core: 237_568, 'history-bars-readings': 8192 });
    expect(parseEveryPageKb('// 232 KB since 1.9\nconst BUDGET = 232 * 1024;\n')).toBe(232);
    expect(() => parseEveryPageKb('nothing')).toThrow();
  });
});
