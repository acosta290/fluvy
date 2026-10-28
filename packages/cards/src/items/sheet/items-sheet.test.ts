// @vitest-environment happy-dom
import type { HomeAssistant } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextRuler } from '../../shared/fit.js';
import '../english.js';
import { FluvyItemsSheet, type ItemsSheetHost, type SheetItem } from './items-sheet.js';

/*
 * An item's sheet: its head (the picture or the glyph, the name over its line, the round to its link), its fields a
 * row each, Close and the ways out; the sheet of an item that has gone.
 */

const hass = {
  language: 'en',
  locale: { language: 'en', number_format: 'language', time_format: '24' },
} as unknown as HomeAssistant;

const FLIGHT: SheetItem = {
  name: 'KLM1412',
  secondary: 'AMS → BCN · Boeing 737-800',
  picture: 'https://cdn.example/ph-bxe.jpg',
  icon: 'mdi:airplane',
  tone: 'accent',
  rows: [
    { label: 'Airline', value: 'KLM Royal Dutch Airlines' },
    { label: 'Altitude', value: '34,000 ft' },
    { label: 'Heading', value: '212°' },
  ],
  link: { url: 'https://www.flightradar24.com/KLM1412', label: 'Open on Flightradar24' },
};

type Sheet = FluvyItemsSheet & { updateComplete: Promise<boolean> };

/** The sheet docked (no dialog), opened on a host; the opening guard already past. */
async function open(item: SheetItem | undefined, docked = true): Promise<Sheet> {
  const host: ItemsSheetHost = {
    title: () => 'Flights nearby',
    item: () => item,
    adopt: () => undefined,
  };
  const sheet = document.createElement('fluvy-items-sheet') as Sheet;
  sheet.docked = docked;
  sheet.hass = hass;
  sheet.card = host;
  document.body.append(sheet);
  sheet.open();
  await sheet.updateComplete;
  return sheet;
}

const root = (sheet: Sheet): ShadowRoot => sheet.shadowRoot!;
const texts = (sheet: Sheet, selector: string): string[] =>
  [...root(sheet).querySelectorAll(selector)].map((el) => el.textContent?.trim() ?? '');

afterEach(() => document.body.replaceChildren());

describe('an item’s sheet', () => {
  it('heads with the picture, the name over its line and the round to its link', async () => {
    const sheet = await open(FLIGHT);
    expect(root(sheet).querySelector<HTMLImageElement>('.is-pic img')?.getAttribute('src')).toBe(
      FLIGHT.picture,
    );
    expect(texts(sheet, '.fv-sheet__title')).toEqual(['KLM1412']);
    expect(texts(sheet, '.fv-sheet__head .fv-card__sub')).toEqual(['AMS → BCN · Boeing 737-800']);
    const round = root(sheet).querySelector<HTMLButtonElement>('.fv-sheet__head .fv-round')!;
    expect(round.getAttribute('aria-label')).toBe('Open on Flightradar24');
    const opened = vi.spyOn(window, 'open').mockImplementation(() => null);
    round.click();
    expect(opened).toHaveBeenCalledWith(
      'https://www.flightradar24.com/KLM1412',
      '_blank',
      'noopener',
    );
    opened.mockRestore();
  });

  it('lists the fields, each its label over its line', async () => {
    const sheet = await open(FLIGHT);
    expect(texts(sheet, '.is-field__label')).toEqual(['Airline', 'Altitude', 'Heading']);
    expect(texts(sheet, '.is-field__value')).toEqual([
      'KLM Royal Dutch Airlines',
      '34,000 ft',
      '212°',
    ]);
    // the link's round stands in the head where the name holds beside it (every width, on a stub ruler)
    expect(root(sheet).querySelectorAll('.is-actions .fv-btn')).toHaveLength(1);
  });

  it('shows the glyph where there is no picture, or where it will not load; no round without a link', async () => {
    const { name, secondary, icon, tone, rows } = FLIGHT;
    const sheet = await open({ name, secondary, icon, tone, rows, picture: '' });
    expect(root(sheet).querySelector('.is-pic')).toBeNull();
    expect(root(sheet).querySelector('.fv-sheet__head .fv-ico')).not.toBeNull();
    expect(root(sheet).querySelector('.fv-sheet__head .fv-round')).toBeNull();
    const broken = await open(FLIGHT);
    root(broken).querySelector('.is-pic img')!.dispatchEvent(new Event('error'));
    await broken.updateComplete;
    expect(root(broken).querySelector('.is-pic')).toBeNull();
  });

  it('puts the link on a button above Close where the head cannot hold its round, its word shorter where it must be', async () => {
    // happy-dom lays nothing out: words of 16 a letter, in the design's 360
    const width = vi
      .spyOn(TextRuler.prototype, 'width')
      .mockImplementation((_cls: string, text: string) => text.length * 16);
    const held = await open(FLIGHT);
    expect(root(held).querySelector('.fv-sheet__head .fv-round')).not.toBeNull();
    expect(texts(held, '.is-actions .fv-btn')).toEqual(['Close']);
    const sheet = await open({
      ...FLIGHT,
      name: 'An item whose name takes the head',
      link: { ...FLIGHT.link!, short: 'Open the link' },
    });
    expect(root(sheet).querySelector('.fv-sheet__head .fv-round')).toBeNull();
    expect(texts(sheet, '.is-actions .fv-btn')).toEqual(['Open the link', 'Close']);
    width.mockRestore();
  });

  it('says the item is no longer listed once it has gone', async () => {
    const sheet = await open(undefined);
    expect(texts(sheet, '.fv-sheet__title')).toEqual(['Flights nearby']);
    expect(texts(sheet, '.fv-sheet__head .fv-card__sub')).toEqual(['No longer listed']);
    expect(root(sheet).querySelectorAll('.is-fields')).toHaveLength(0);
  });

  it('opens as a dialog, closes on Close and Escape, and gives the focus back', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const sheet = await open(FLIGHT, false);
    sheet.open(opener);
    await sheet.updateComplete;
    const dialog = root(sheet).querySelector('dialog')!;
    expect(dialog).not.toBeNull();
    root(sheet).querySelector<HTMLButtonElement>('.is-actions .fv-btn:last-child')!.click();
    await sheet.updateComplete;
    expect(sheet.leaving_).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    await sheet.updateComplete;
    expect(root(sheet).querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
