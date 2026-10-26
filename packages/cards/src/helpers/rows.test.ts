import type { EntityView, HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import type { TextRuler } from '../shared/fit.js';
import type { HelperHost, HelperRowConfig } from './context.js';
import { momentValue, rowsKeepIcon, rowStacks, valueCap } from './rows.js';

/** A ruler that lays every glyph 8 px wide; a pill adds its sides on the 4 grid, as `fitPills` does. */
const ruler = {
  width: (_cls: string, text: string) => text.length * 8,
  pill: (_cls: string, text: string, sides: number) => Math.ceil((text.length * 8 + sides) / 4) * 4,
} as unknown as TextRuler;

describe('a helpers or updates row whose end is never cut', () => {
  it('gives its circle first, then puts its end under its name (de "Installieren" at 211)', () => {
    // 171 − 68 − 128 ("Installieren" and its 32) leaves no room: the circles go; bare, 171 − 12 − 128 leaves 31,
    // under "Vacuum" (48): Install goes under the name
    const install = { name: 'Vacuum', button: 'Installieren' };
    expect(rowsKeepIcon(ruler, 171, [install])).toBe(false);
    expect(rowStacks(ruler, 171, install)).toBe(true);
    // "Run" (56) leaves 103 beside it: the row keeps its line
    expect(rowStacks(ruler, 171, { name: 'Vacuum', button: 'Run' })).toBe(false);
  });

  it('reads the line under the name too: a state in words goes under a sub it would squeeze', () => {
    // "Above horizon" (104) leaves 55 bare: "Sun" (24) holds, "Sets at 20:12" (104, held to 96) does not
    const sun = { name: 'Sun', end: 104 };
    expect(rowStacks(ruler, 171, sun)).toBe(false);
    expect(rowStacks(ruler, 171, { ...sun, sub: 'Sets at 20:12 · rises 07:48' })).toBe(true);
  });
});

/*
 * A value's pill is capped by the sheet (`styles.ts`): 68 % of the row less the circle's room, less the one gap once
 * the row gave its circle, on the 4 grid. A date takes the form that holds within it.
 */
describe("a value's pill and its cap", () => {
  it('mirrors the sheet: 68 % of the row less 68, less 12 once the row is bare, down to the 4 grid', () => {
    expect([171, 211, 266, 320].map((width) => valueCap(width, false))).toEqual([48, 72, 112, 148]);
    expect([171, 211, 266, 320].map((width) => valueCap(width, true))).toEqual([
      104, 128, 168, 204,
    ]);
  });

  const hass = {
    language: 'pt-BR',
    locale: { language: 'pt-BR', number_format: 'language', time_format: '24' },
  } as unknown as HomeAssistant;
  const host = (contentWidth: number, bare: boolean): HelperHost =>
    ({
      hass,
      contentWidth,
      ruler,
      bare,
      texts: { resolve: (text: string) => text },
      state: (view: EntityView) => view.state,
    }) as unknown as HelperHost;
  const helper = (state: string, name: string): EntityView =>
    ({ id: 'input_datetime.x', domain: 'input_datetime', status: 'ok', state, name }) as EntityView;
  const config: HelperRowConfig = { entity: 'input_datetime.x', secondary: 'Soon' };
  /** "10 de nov." is a pill of 112 (ten glyphs and the sides), "10/11" one of 72. */
  const date = (name: string) => helper('2026-11-10', name);
  const end = (width: number, name: string) => ({
    name,
    button: momentValue(host(width, true), date(name), config),
    sub: 'Soon',
    capped: true,
  });

  it("names the month where the pill holds it: a bare row's 168 at 266", () => {
    expect(momentValue(host(266, true), date('Holiday start'), config)).toBe('10 de nov.');
    expect(rowStacks(ruler, 266, end(266, 'Holiday start'))).toBe(false);
  });

  it('takes the figures where the name would not hold at 171 (the cap is 104), the row keeping its line', () => {
    expect(momentValue(host(171, true), date('Trip'), config)).toBe('10/11');
    expect(rowStacks(ruler, 171, end(171, 'Trip'))).toBe(false);
  });

  it('stacks the figures under a name that has no room beside them either', () => {
    // 171 − 12 − 72 leaves 87 beside "10/11", under the 96 "Holiday start" (104) is held to: the row stacks
    expect(momentValue(host(171, true), date('Holiday start'), config)).toBe('10/11');
    expect(rowStacks(ruler, 171, end(171, 'Holiday start'))).toBe(true);
  });

  it('stacks where even the figures run over the cap (100: a cap of 56), the pill uncapped under the name', () => {
    expect(momentValue(host(100, true), date('Trip'), config)).toBe('10/11');
    expect(rowStacks(ruler, 100, end(100, 'Trip'))).toBe(true);
  });

  it('weighs the cap for the circles too: a short name keeps its circle beside the figures at 211', () => {
    // with its circle the cap is 72 at 211: the month's name (112) runs over it, the figures (72) hold, and beside
    // them "Trip" (32) keeps its room (211 − 68 − 72 = 71); at 171 the cap is 48 and the circles go
    const trip = (width: number) => ({
      name: 'Trip',
      button: momentValue(host(width, false), date('Trip'), config),
      capped: true,
    });
    expect(trip(211).button).toBe('10/11');
    expect(rowsKeepIcon(ruler, 211, [trip(211)])).toBe(true);
    expect(rowsKeepIcon(ruler, 171, [trip(171)])).toBe(false);
  });

  it('leaves a time as it is', () => {
    expect(momentValue(host(171, true), helper('06:45:00', 'Wake-up'), config)).toBe('06:45');
    expect(momentValue(host(100, false), helper('06:45:00', 'Wake-up'), config)).toBe('06:45');
  });
});
