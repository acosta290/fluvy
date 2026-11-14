// @vitest-environment happy-dom
import type { HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { familiesDefined } from '../index.js';
import {
  cardForm,
  drawEditor,
  listTitles,
  nextConfig,
  shownNames,
} from '../shared/fixtures/editor.js';
import type { FluvyExpanderEditor } from './expander-editor.js';

// the Expander card's chunk lands before its editor is asked for
await familiesDefined;

/*
 * The expander's editor where Home Assistant's stack editor is to be had (the page of this file defines it the way
 * Home Assistant does: its card helpers build a stack, whose class's `getConfigElement` defines the editor): the
 * cards are edited there, and in the form's code field where it refuses them.
 */

const TYPE = 'custom:fluvy-expander-card';
const CARDS: LovelaceCardConfig[] = [
  { type: 'custom:fluvy-light-card', entity: 'light.terrace' },
  { type: 'entities', entities: ['switch.lawn'] },
];
const HOUSE = { language: 'en', states: {} } as unknown as HomeAssistant;

/** Home Assistant's stack editor, as the expander's speaks to it. */
class StackEditor extends HTMLElement {
  hass: HomeAssistant | undefined;
  lovelace: unknown;
  config: LovelaceCardConfig | undefined;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = '<ha-form></ha-form><div id="editor"></div>';
  }

  /** A stack's config, checked as Home Assistant's struct checks it: its cards are a list. */
  setConfig(config: LovelaceCardConfig): void {
    if (!Array.isArray(config['cards']) || config['cards'].some((card) => card === null))
      throw new Error('Expected an array of cards');
    this.config = config;
  }

  /** The person changes the stack in it: its whole config, as the stack editor says it. */
  change(config: Record<string, unknown>): void {
    this.dispatchEvent(
      new CustomEvent('config-changed', {
        detail: { config: { ...this.config, ...config } },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

/** How often the helpers were asked for a stack. */
const built = vi.fn();
window.loadCardHelpers = () =>
  Promise.resolve({
    createCardElement: (config: LovelaceCardConfig) => {
      built(config);
      if (!customElements.get('hui-vertical-stack-card'))
        customElements.define(
          'hui-vertical-stack-card',
          class extends HTMLElement {
            static getConfigElement(): Promise<HTMLElement> {
              if (!customElements.get('hui-stack-card-editor'))
                customElements.define('hui-stack-card-editor', StackEditor);
              return Promise.resolve(document.createElement('hui-stack-card-editor'));
            }
          },
        );
      return document.createElement('hui-vertical-stack-card');
    },
  });

const element = customElements.get('fluvy-expander-card') as unknown as {
  getConfigElement(): Promise<HTMLElement>;
};

async function edited(
  config: Record<string, unknown>,
): Promise<{ editor: FluvyExpanderEditor; stack: () => StackEditor | null }> {
  const editor = (await element.getConfigElement()) as FluvyExpanderEditor;
  editor.hass = HOUSE;
  editor.lovelace = { views: [] };
  await drawEditor(editor, { type: TYPE, ...config });
  await editor.updateComplete;
  return {
    editor,
    stack: () => editor.shadowRoot!.querySelector<StackEditor>('hui-stack-card-editor'),
  };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the expander’s editor with Home Assistant’s stack editor', () => {
  it('asks Home Assistant for it once, as a stack’s own editor', async () => {
    await edited({ cards: CARDS });
    await edited({ cards: CARDS });
    expect(built).toHaveBeenCalledTimes(1);
    expect(built).toHaveBeenCalledWith({ type: 'vertical-stack', cards: [] });
  });

  it('is the base’s editor, and takes the dashboard so Home Assistant hands it over', async () => {
    const { editor } = await edited({ cards: CARDS });
    expect(editor.localName).toBe('fluvy-expander-editor');
    // Home Assistant sets `lovelace` only on an editor that has the property
    expect('lovelace' in editor).toBe(true);
    expect('lovelace' in document.createElement('fluvy-expander-editor')).toBe(true);
  });

  it('edits the cards in it, under the form, which lets its code field go', async () => {
    const { editor, stack } = await edited({ title: 'Garden', cards: CARDS });
    expect(stack()).not.toBeNull();
    expect(listTitles(editor)).toEqual(['Cards in the head', 'Cards']);
    expect(shownNames(cardForm(editor).schema)).not.toContain('cards');
    expect(shownNames(cardForm(editor).schema)).not.toContain('head_cards');
    expect(stack()?.config).toEqual({ type: 'vertical-stack', title: 'Garden', cards: CARDS });
    expect(stack()?.hass).toBe(HOUSE);
    expect(stack()?.lovelace).toEqual({ views: [] });
  });

  it('hands it a list where the config has none yet', async () => {
    const { stack } = await edited({});
    expect(stack()?.config).toEqual({ type: 'vertical-stack', cards: [] });
  });

  it('writes what it changes into cards, and nothing of a stack’s own', async () => {
    const { editor, stack } = await edited({ title: 'Garden', columns: 2, cards: CARDS });
    const outside = vi.fn();
    document.body.addEventListener('config-changed', outside);
    const written = nextConfig(editor);
    stack()?.change({ cards: [CARDS[1]] });
    expect(await written).toEqual({ type: TYPE, title: 'Garden', columns: 2, cards: [CARDS[1]] });
    // one event leaves the editor: its own, with the card's config; the stack editor's stops there
    expect(outside).toHaveBeenCalledTimes(1);
    expect(outside.mock.calls[0]?.[0].target).toBe(editor);
    document.body.removeEventListener('config-changed', outside);
    // and the stack editor holds what was written
    await editor.updateComplete;
    expect(stack()?.config?.['cards']).toEqual([CARDS[1]]);
  });

  it('keeps the head’s title as the stack editor’s own Title field would write it', async () => {
    const { editor, stack } = await edited({ title: 'Garden', cards: CARDS });
    const renamed = nextConfig(editor);
    stack()?.change({ title: 'Back garden' });
    expect((await renamed)['title']).toBe('Back garden');
    await editor.updateComplete;
    const cleared = nextConfig(editor);
    stack()?.change({ title: '' });
    expect('title' in (await cleared)).toBe(false);
  });

  it('leaves that Title field out of its place: the form holds the title', async () => {
    const { stack } = await edited({ cards: CARDS });
    const sheets = stack()?.shadowRoot?.adoptedStyleSheets ?? [];
    expect(sheets).toHaveLength(1);
    expect(sheets[0]?.cssRules[0]?.cssText.replaceAll(' ', '')).toContain('ha-form{display:none');
  });

  it('keeps the form’s own changes beside the cards', async () => {
    const { editor } = await edited({ cards: CARDS });
    const written = nextConfig(editor);
    cardForm(editor).change('title', 'Garden');
    expect(await written).toEqual({ type: TYPE, cards: CARDS, title: 'Garden' });
  });

  it('gives the cards back to the code field where the stack editor refuses them, until they are mended', async () => {
    const { editor, stack } = await edited({ cards: [null] });
    expect(stack()).toBeNull();
    // the head's list is another: its stack editor took it
    expect(listTitles(editor)).toEqual(['Cards in the head']);
    expect(shownNames(cardForm(editor).schema)).toContain('cards');
    expect(shownNames(cardForm(editor).schema)).not.toContain('head_cards');

    const written = nextConfig(editor);
    cardForm(editor).change('cards', CARDS);
    expect((await written)['cards']).toEqual(CARDS);
    await editor.updateComplete;
    expect(stack()?.config?.['cards']).toEqual(CARDS);
    expect(shownNames(cardForm(editor).schema)).not.toContain('cards');
  });
});

describe('the cards of its head, in a stack editor of their own (#186)', () => {
  const CLOCK: LovelaceCardConfig = { type: 'custom:fluvy-clock-card', face: 'digital' };
  const stacks = (editor: FluvyExpanderEditor): StackEditor[] => [
    ...editor.shadowRoot!.querySelectorAll<StackEditor>('hui-stack-card-editor'),
  ];
  const add = (editor: FluvyExpanderEditor): HTMLButtonElement | null =>
    editor.shadowRoot!.querySelector<HTMLButtonElement>('.list .more button');

  it('keeps its card picker behind a button until a head of cards is asked for', async () => {
    const { editor } = await edited({ title: 'Garden', cards: CARDS });
    // one stack editor in the page, the cards'; the head's list says what it is for, and offers to add
    expect(stacks(editor)).toHaveLength(1);
    expect(stacks(editor)[0]?.config?.['cards']).toEqual(CARDS);
    expect(editor.shadowRoot!.querySelector('.list .list__helper')?.textContent).toBe(
      'They take the place of the title and stay while it is folded',
    );
    expect(add(editor)?.textContent?.trim()).toBe('Add');

    add(editor)?.click();
    await editor.updateComplete;
    expect(add(editor)).toBeNull();
    expect(stacks(editor)).toHaveLength(2);
    expect(stacks(editor)[0]?.config).toEqual({
      type: 'vertical-stack',
      title: 'Garden',
      cards: [],
    });
    // asked for, it has changed nothing yet
    expect(editor.config).toEqual({ type: TYPE, title: 'Garden', cards: CARDS });
  });

  it('writes what its stack editor changes into head_cards, and takes the key away with the last card', async () => {
    const { editor } = await edited({ title: 'Garden', cards: CARDS });
    add(editor)?.click();
    await editor.updateComplete;
    const [head] = stacks(editor);
    const written = nextConfig(editor);
    head?.change({ cards: [CLOCK] });
    expect(await written).toEqual({
      type: TYPE,
      title: 'Garden',
      cards: CARDS,
      head_cards: [CLOCK],
    });
    await editor.updateComplete;
    expect(stacks(editor).map((stack) => stack.config?.['cards'])).toEqual([[CLOCK], CARDS]);

    const emptied = nextConfig(editor);
    stacks(editor)[0]?.change({ cards: [] });
    expect(await emptied).toEqual({ type: TYPE, title: 'Garden', cards: CARDS });
  });

  it('opens on its stack editor where the config has cards for a head, each list in its own', async () => {
    const { editor } = await edited({ head_cards: [CLOCK], cards: CARDS });
    expect(add(editor)).toBeNull();
    expect(listTitles(editor)).toEqual(['Cards in the head', 'Cards']);
    expect(stacks(editor).map((stack) => stack.config?.['cards'])).toEqual([[CLOCK], CARDS]);
    // what the cards' own changes leaves the head's alone
    const written = nextConfig(editor);
    stacks(editor)[1]?.change({ cards: [CARDS[0]] });
    expect(await written).toEqual({ type: TYPE, head_cards: [CLOCK], cards: [CARDS[0]] });
    // each leaves its own Title field out
    for (const stack of stacks(editor))
      expect(stack.shadowRoot?.adoptedStyleSheets).toHaveLength(1);
  });

  it('gives the head’s cards back to their code field where the stack editor refuses them', async () => {
    const { editor } = await edited({ head_cards: [null], cards: CARDS });
    expect(listTitles(editor)).toEqual(['Cards']);
    expect(shownNames(cardForm(editor).schema)).toContain('head_cards');
    expect(shownNames(cardForm(editor).schema)).not.toContain('cards');
  });
});
