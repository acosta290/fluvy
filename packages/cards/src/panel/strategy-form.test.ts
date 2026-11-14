// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import type { HomeAssistant } from '@fluvy/core';
// Home Assistant's form, as a test's page stands it in
import type { FormStub } from '../shared/fixtures/editor.js';
import '../shared/fixtures/editor.js';
import { defineStrategies, TEMPLATE_IDS } from '../strategy/define.js';
import type { FluvyStrategyForm } from './strategy-form.js';

type Config = Record<string, unknown>;

/** What Home Assistant's "Edit dashboard" dialog asks a strategy for, and what it does with the answer. */
async function editorOf(id: string, config: Config, panelUrl = 'fluvy-auto') {
  defineStrategies();
  const strategy = customElements.get(`ll-strategy-dashboard-fluvy-${id}`) as unknown as {
    getConfigElement(): Promise<FluvyStrategyForm>;
  };
  const form = await strategy.getConfigElement();
  form.hass = { language: 'en', panelUrl } as unknown as HomeAssistant;
  form.setConfig(config);
  const changes: Config[] = [];
  form.addEventListener('config-changed', (event) => {
    const next = (event as CustomEvent<{ config: Config }>).detail.config;
    changes.push(next);
    // the dialog hands what it was told back, as Home Assistant's does
    form.setConfig(next);
  });
  document.body.append(form);
  const settle = async () => {
    for (let round = 0; round < 4; round++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await form.updateComplete;
    }
  };
  await settle();
  const fields = () => form.shadowRoot!.querySelector<FormStub>('ha-form')!;
  const change = async (name: string, value: unknown) => {
    fields().change(name, value);
    await settle();
  };
  return { form, changes, fields, change };
}

afterEach(() => document.body.replaceChildren());

describe('the form Home Assistant’s pencil opens on an automatic dashboard (#188)', () => {
  it('is what every one of the strategies answers, from the panel’s own file', async () => {
    defineStrategies();
    for (const id of TEMPLATE_IDS) {
      const { form } = await editorOf(id, { type: `custom:fluvy-${id}` });
      expect(form.localName, id).toBe('fluvy-strategy-form');
    }
  });

  it('opens with the way into Customise on the dashboard the dialog was opened on', async () => {
    const { form } = await editorOf('home', { type: 'custom:fluvy-home' });
    const link = form.shadowRoot!.querySelector('a')!;
    // a link of the page's own: Home Assistant follows it itself, and closes its dialog
    expect(link.getAttribute('href')).toBe('/fluvy/dashboard/fluvy-auto');
    expect(link.target).toBe('');
    expect(link.querySelector('.title')?.textContent).toBe('Customise');
    expect(link.querySelector('.sub')?.textContent).toBe('Hide, move and tune its views and cards');
    const other = await editorOf('home', { type: 'custom:fluvy-home' }, 'my home');
    expect(other.form.shadowRoot!.querySelector('a')!.getAttribute('href')).toBe(
      '/fluvy/dashboard/my%20home',
    );
  });

  it('offers the dashboard’s most used options, each showing what the dashboard does', async () => {
    const { fields, form } = await editorOf('home', {
      type: 'custom:fluvy-home',
      hide: ['media', 'agenda'],
      tile_size: 'compact',
    });
    expect(fields().schema.map((field) => field.name)).toEqual([
      'views',
      'thermostat_variant',
      'tile_size',
      'tile_switch',
    ]);
    expect(fields().data).toEqual({
      views: ['rooms', 'lights', 'climate', 'energy', 'security', 'sensors'],
      thermostat_variant: 'dial',
      tile_size: 'compact',
      tile_switch: 'show',
    });
    // each field is named as the panel's Dashboards tab names it, its values by their words
    const label = (form as unknown as { label(field: { name: string }): string }).label;
    expect(fields().schema.map((field) => label(field))).toEqual([
      'Views',
      'Thermostats',
      'Lights',
      'Tile switches',
    ]);
    const select = (name: string) =>
      (
        fields().schema.find((field) => field.name === name)!.selector as {
          select: { options: { value: string; label: string }[]; multiple?: boolean };
        }
      ).select;
    expect(select('tile_size').options).toEqual([
      { value: 'large', label: 'Large' },
      { value: 'compact', label: 'Rows' },
    ]);
    expect(select('views').multiple).toBe(true);
    expect(
      select('views')
        .options.map((option) => option.label)
        .slice(0, 2),
    ).toEqual(['Rooms', 'Lights']);
  });

  it('writes a choice as the panel does: its default is no key, and nothing else is touched', async () => {
    const edit = { cards: { 'home/clock': { hidden: true } } };
    const { change, changes } = await editorOf('home', {
      type: 'custom:fluvy-home',
      tile_size: 'compact',
      weather: 'weather.home',
      edit,
    });
    await change('thermostat_variant', 'ruler');
    expect(changes.at(-1)).toEqual({
      type: 'custom:fluvy-home',
      tile_size: 'compact',
      weather: 'weather.home',
      edit,
      thermostat_variant: 'ruler',
    });
    // back at what the dashboard does by itself, the key goes
    await change('tile_size', 'large');
    await change('thermostat_variant', 'dial');
    expect(changes.at(-1)).toEqual({ type: 'custom:fluvy-home', weather: 'weather.home', edit });
  });

  it('writes the views left out as `hide`, and keeps what it names besides', async () => {
    const { change, changes, fields } = await editorOf('home', {
      type: 'custom:fluvy-home',
      hide: ['media', 'a-view-of-another-version'],
    });
    await change(
      'views',
      (fields().data['views'] as string[]).filter((key) => key !== 'energy'),
    );
    expect(changes.at(-1)!['hide']).toEqual(['a-view-of-another-version', 'energy', 'media']);
    await change('views', [
      'rooms',
      'lights',
      'climate',
      'energy',
      'security',
      'media',
      'agenda',
      'sensors',
    ]);
    expect(changes.at(-1)!['hide']).toEqual(['a-view-of-another-version']);
    // every view shown, and nothing else to hide: no key at all
    const plain = await editorOf('home', { type: 'custom:fluvy-home', hide: ['media'] });
    await plain.change('views', [...(plain.fields().data['views'] as string[]), 'media']);
    expect(plain.changes.at(-1)).toEqual({ type: 'custom:fluvy-home' });
  });

  it('offers each template its own: a number is written as a number, a choice that cannot act is left out', async () => {
    const wall = await editorOf('wall', { type: 'custom:fluvy-wall' });
    expect(wall.fields().schema.map((field) => field.name)).toEqual([
      'thermostat_variant',
      'scenes_max',
    ]);
    expect(wall.fields().data['scenes_max']).toBe('4');
    await wall.change('scenes_max', '8');
    expect(wall.changes.at(-1)).toEqual({ type: 'custom:fluvy-wall', scenes_max: 8 });
    // the rooms' dashboard: a photo's own options while its rooms may be photos, the next ones once they are tiles
    const rooms = await editorOf('rooms', { type: 'custom:fluvy-rooms' });
    expect(rooms.fields().schema.map((field) => field.name)).toEqual([
      'room_variant',
      'room_name_position',
      'room_readout_style',
      'room_readout_labels',
    ]);
    await rooms.change('room_variant', 'tile');
    expect(rooms.fields().schema.map((field) => field.name)).toEqual([
      'room_variant',
      'thermostat_variant',
      'tile_size',
      'tile_switch',
    ]);
  });

  it('draws for a configuration it does not know, as the home dashboard’s', async () => {
    const { fields, form } = await editorOf('home', { type: 'custom:something-else', hide: 5 });
    expect(form.shadowRoot!.querySelector('a')).not.toBeNull();
    expect(fields().schema[0]?.name).toBe('views');
    expect((fields().data['views'] as string[]).length).toBe(8);
  });
});
