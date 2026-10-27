// @vitest-environment happy-dom
import { LANGUAGE_CODES, type HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { FluvyDates, PickerString } from './date-picker.js';

/** A page that opens the picker, as far as its words go: it hands the picker its own `t`. */
interface Owner extends HTMLElement {
  hass: HomeAssistant | undefined;
  readonly t: (key: PickerString) => string;
}

/** Every word the picker says: drawn once with the end after the start, once before it (the reason under Show). */
async function saidByThePicker(): Promise<ReadonlySet<PickerString>> {
  await import('./date-picker.js');
  const said = new Set<PickerString>();
  const picker = document.createElement('fluvy-date-picker') as FluvyDates;
  picker.t = (key) => {
    said.add(key);
    return key;
  };
  document.body.append(picker);
  await picker.updateComplete;
  // one day, its end before its start
  picker.fromTime = 10 * 60;
  picker.toTime = 5 * 60;
  await picker.updateComplete;
  return said;
}

/** The pages that open it, each built as Home Assistant builds it (never connected: only its words are asked). */
const OWNERS: Record<string, () => Promise<Owner>> = {
  activity: async () => {
    await import('../activity/view.js');
    return document.createElement('fluvy-activity') as Owner;
  },
  history: async () => {
    await import('../history/view.js');
    return document.createElement('fluvy-history') as Owner;
  },
};

describe('the date picker’s words', () => {
  afterEach(() => document.body.replaceChildren());

  it('says what it says', async () => {
    const said = [...(await saidByThePicker())];
    for (const key of ['preset.today', 'month_prev', 'from', 'to', 'apply', 'end_before_start'])
      expect(said).toContain(key);
  });

  // since 1.8.0 the History page said "from" and "to": the two were the Activity page's own words, which the History
  // page does not look in. A word no table of the page holds comes back as its key.
  it.each(Object.keys(OWNERS))('are all found by the %s page, in every language', async (name) => {
    const said = await saidByThePicker();
    const owner = await OWNERS[name]!();
    for (const language of LANGUAGE_CODES) {
      owner.hass = { language } as HomeAssistant;
      for (const key of said) expect(owner.t(key), `${language}: ${key}`).not.toBe(key);
    }
  });
});

describe('the date grid in whole days (the Energy period card’s custom span)', () => {
  afterEach(() => document.body.replaceChildren());

  it('offers no hours and no presets, and a picked day comes back whole', async () => {
    await import('./date-picker.js');
    const picker = document.createElement('fluvy-date-picker') as FluvyDates;
    picker.wholeDays = true;
    picker.noPresets = true;
    const day = new Date(2026, 8, 14);
    const next = new Date(2026, 8, 15);
    picker.range = { start: day.getTime(), end: next.getTime() };
    picker.now = new Date(2026, 8, 17, 21, 47).getTime();
    document.body.append(picker);
    await picker.updateComplete;
    const root = picker.shadowRoot!;
    expect(root.querySelector('.ad-times')).toBeNull();
    expect(root.querySelector('.ad-presets')).toBeNull();
    // hours set before do not count: the first day from its midnight, the last to the next
    picker.fromTime = 10 * 60;
    picker.toTime = 5 * 60;
    await picker.updateComplete;
    const picked: unknown[] = [];
    picker.addEventListener('fluvy-dates', (event) =>
      picked.push((event as CustomEvent<{ range: unknown }>).detail.range),
    );
    root.querySelector<HTMLButtonElement>('.ad-apply .fv-btn')!.click();
    expect(picked).toEqual([{ start: day.getTime(), end: next.getTime() }]);
  });
});
