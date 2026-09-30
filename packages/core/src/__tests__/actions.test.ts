// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { runAction, type ActionConfig } from '../actions.js';
import type { HomeAssistant } from '../ha/types.js';

const hass = { states: {}, callService: vi.fn() } as unknown as HomeAssistant;

describe('runAction', () => {
  it('fire-dom-event: the whole action leaves the card as ll-custom, as Home Assistant sends it', async () => {
    const card = document.createElement('div');
    document.body.append(card);
    const heard: unknown[] = [];
    document.body.addEventListener('ll-custom', (event) =>
      heard.push((event as CustomEvent).detail),
    );
    const action: ActionConfig = {
      action: 'fire-dom-event',
      browser_mod: { service: 'browser_mod.popup', data: { title: 'Lights' } },
    };

    await runAction(card, hass, action);

    expect(heard).toEqual([action]);
    expect(hass.callService).not.toHaveBeenCalled();
    card.remove();
  });

  it('fire-dom-event crosses shadow roots, as the card sits in one', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const card = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(card);
    const heard = vi.fn();
    document.body.addEventListener('ll-custom', heard);

    await runAction(card, hass, { action: 'fire-dom-event' });

    expect(heard).toHaveBeenCalledOnce();
    host.remove();
  });
});
