// @vitest-environment happy-dom
import type { HaFormSchemaItem, HomeAssistant, LovelaceCardConfig } from '@fluvy/core';
import { afterEach, describe, expect, it } from 'vitest';
import { familiesDefined } from '../index.js';
import {
  cardForm,
  drawEditor,
  listTitles,
  nextConfig,
  shownNames,
} from '../shared/fixtures/editor.js';
import { visibleFields } from '../shared/form.js';
import type { FluvyRowsEditor } from '../shared/rows-editor.js';
import { defaults, getConfigForm } from './swipe-editor.js';

// the Swipe card's chunk lands before its editor is asked for
await familiesDefined;

/*
 * The swipe card's editor: Fluvy's form, and its cards in Home Assistant's stack editor under it, one list (the
 * Expander's editor, whose stack editor it shares), defined here the way Home Assistant defines it.
 */

const TYPE = 'custom:fluvy-swipe-card';
const CARDS: LovelaceCardConfig[] = [
  { type: 'custom:fluvy-camera-card', entity: 'camera.driveway' },
  { type: 'custom:fluvy-camera-card', entity: 'camera.garden' },
];
const HOUSE = { language: 'en', states: {} } as unknown as HomeAssistant;

/** Home Assistant's stack editor, as the swipe card's speaks to it. */
class StackEditor extends HTMLElement {
  hass: HomeAssistant | undefined;
  lovelace: unknown;
  config: LovelaceCardConfig | undefined;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = '<ha-form></ha-form><div id="editor"></div>';
  }

  setConfig(config: LovelaceCardConfig): void {
    if (!Array.isArray(config['cards'])) throw new Error('Expected an array of cards');
    this.config = config;
  }

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

window.loadCardHelpers = () =>
  Promise.resolve({
    createCardElement: () => {
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

const element = customElements.get('fluvy-swipe-card') as unknown as {
  getConfigElement(): Promise<HTMLElement>;
};

async function edited(
  config: Record<string, unknown>,
): Promise<{ editor: FluvyRowsEditor; stack: () => StackEditor | null }> {
  const editor = (await element.getConfigElement()) as FluvyRowsEditor & { lovelace?: unknown };
  editor.hass = HOUSE;
  editor.lovelace = { views: [] };
  await drawEditor(editor, { type: TYPE, ...config });
  await editor.updateComplete;
  return {
    editor,
    stack: () => editor.shadowRoot!.querySelector<StackEditor>('hui-stack-card-editor'),
  };
}

/** The fields the form shows for `data`, as Home Assistant's form draws them. */
const shown = (data: Record<string, unknown>): string[] =>
  shownNames(visibleFields(getConfigForm().schema as HaFormSchemaItem[], data));

afterEach(() => {
  document.body.replaceChildren();
});

describe('the swipe card’s editor', () => {
  it('edits its cards in Home Assistant’s stack editor, one list under the form, whose code field leaves', async () => {
    const { editor, stack } = await edited({ cards: CARDS });
    expect(editor.localName).toBe('fluvy-swipe-editor');
    expect(listTitles(editor)).toEqual(['Cards']);
    expect(editor.shadowRoot!.querySelector('.list .list__helper')?.textContent).toBe(
      'One a page, in this order',
    );
    expect(stack()?.config).toEqual({ type: 'vertical-stack', cards: CARDS });
    expect(stack()?.lovelace).toEqual({ views: [] });
    expect(shownNames(cardForm(editor).schema)).not.toContain('cards');
    // no head's list: it has none
    expect(editor.shadowRoot!.querySelector('.list .more')).toBeNull();
  });

  it('writes what the stack editor changes into cards', async () => {
    const { editor, stack } = await edited({ cards: CARDS, loop: true });
    const written = nextConfig(editor);
    stack()?.change({ cards: [CARDS[1]] });
    expect(await written).toEqual({ type: TYPE, loop: true, cards: [CARDS[1]] });
  });

  it('shows what turns a page only with two cards to turn between', () => {
    const turning = ['columns', 'gap', 'start', 'show_indicators', 'loop', 'remember', 'autoplay'];
    for (const name of turning) {
      expect(shown({ cards: CARDS }), name).toContain(name);
      expect(shown({ cards: CARDS.slice(0, 1) }), name).not.toContain(name);
    }
  });

  it('shows a wash, an opacity and a border on its surface alone', () => {
    for (const name of ['card_color', 'card_opacity', 'card_border']) {
      expect(shown({ cards: CARDS }), name).toContain(name);
      expect(shown({ cards: CARDS, style: 'plain' }), name).not.toContain(name);
    }
    expect(shown({ cards: CARDS, style: 'plain' })).toContain('color');
  });

  it('shows the blur of what shows through on a see-through surface alone (#213)', () => {
    expect(shown({ cards: CARDS, card_opacity: 60 })).toContain('card_blur');
    expect(shown({ cards: CARDS, card_opacity: 100 })).not.toContain('card_blur');
    expect(shown({ cards: CARDS, card_opacity: 60, style: 'plain' })).not.toContain('card_blur');
  });

  it('shows what the card does where the config says nothing', () => {
    expect(defaults({ type: TYPE }, HOUSE)).toEqual({
      style: 'card',
      columns: '1',
      gap: 40,
      show_indicators: true,
      loop: false,
      start: 1,
      remember: 'session',
      autoplay: 0,
    });
    expect(defaults({ type: TYPE, style: 'plain' }, HOUSE)?.['gap']).toBe(16);
  });
});
