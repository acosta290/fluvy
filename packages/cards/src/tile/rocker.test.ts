// @vitest-environment happy-dom
import { resolveEntity, type HomeAssistant } from '@fluvy/core';
import { switchStylesSheet } from '@fluvy/ui/switch-styles';
import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { plate } from './rocker.js';

/**
 * A tile's wall rocker as its entity makes it (1.20, #177): what switches flips as its toggle would; a cover or a
 * valve travels, so its rocker says where its next tap takes it, stops it on its way, and goes back the way it came
 * from a stop — one tap, one target.
 */
const STAMP = '2026-09-17T19:00:00+00:00';
/** OPEN | CLOSE | SET_POSITION | STOP, and the same without STOP. */
const TRAVELS = 15;
const NO_STOP = 7;

const house = (id: string, state: string, attributes: Record<string, unknown> = {}) =>
  ({
    language: 'en',
    states: {
      [id]: {
        entity_id: id,
        state,
        attributes: { friendly_name: 'Blinds', ...attributes },
        last_changed: STAMP,
        last_updated: STAMP,
      },
    },
    entities: {},
    devices: {},
    areas: {},
  }) as unknown as HomeAssistant;

interface Sent {
  flips: boolean[];
  moves: [service: string, state: string][];
}

/** The rocker of `id` as the tile would draw it now: `shown` the state the card shows (a move just asked). */
function drawn(
  id: string,
  state: string,
  attributes: Record<string, unknown> = {},
  shown = state,
  usable = true,
) {
  const hass = house(id, state, attributes);
  const view = resolveEntity(hass, id);
  const sent: Sent = { flips: [], moves: [] };
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'open' });
  document.body.append(host);
  const lit = usable && !['off', 'closed'].includes(shown);
  render(
    plate(
      root,
      hass,
      view,
      shown,
      lit,
      'light',
      'Blinds',
      usable,
      (next) => sent.flips.push(next),
      (service, to) => sent.moves.push([service, to]),
    ),
    root,
  );
  const rocker = root.querySelector<HTMLElement>('.fv-rocker')!;
  return {
    root,
    rocker,
    sent,
    tap: () => root.querySelector<HTMLElement>('.fv-hit')!.click(),
    is: (cls: string) => rocker.classList.contains(cls),
  };
}

afterEach(() => document.body.replaceChildren());

describe('what switches', () => {
  it('flips as its toggle would, the lower half raised and the bar lit while on', () => {
    const on = drawn('light.porch', 'on');
    expect([on.is('is-on'), on.is('is-down'), on.is('is-moving')]).toEqual([true, true, false]);
    on.tap();
    expect(on.sent).toEqual({ flips: [false], moves: [] });
    const off = drawn('switch.pump', 'off');
    expect([off.is('is-on'), off.is('is-down')]).toEqual([false, false]);
    off.tap();
    expect(off.sent.flips).toEqual([true]);
  });

  it('wears the sheet on the card’s root as it is drawn', () => {
    expect(drawn('light.porch', 'on').root.adoptedStyleSheets).toContain(switchStylesSheet);
  });

  it('out of reach is the off skin, disabled: a cover too', () => {
    for (const id of ['light.porch', 'cover.blinds']) {
      const dead = drawn(id, 'unavailable', { supported_features: TRAVELS }, 'unavailable', false);
      expect([dead.is('is-on'), dead.is('is-down'), dead.is('is-moving')]).toEqual([
        false,
        false,
        false,
      ]);
      expect(dead.rocker.getAttribute('aria-disabled')).toBe('true');
      dead.tap();
      expect(dead.sent).toEqual({ flips: [], moves: [] });
    }
  });
});

describe('a cover', () => {
  const blinds = (state: string, position?: number, shown = state, features = TRAVELS) =>
    drawn(
      'cover.blinds',
      state,
      {
        supported_features: features,
        ...(position === undefined ? {} : { current_position: position }),
      },
      shown,
    );

  it('closed, its upper half is raised and a tap opens it; open, the lower one and a tap closes it', () => {
    const closed = blinds('closed', 0);
    expect([closed.is('is-on'), closed.is('is-down')]).toEqual([false, false]);
    closed.tap();
    expect(closed.sent.moves).toEqual([['open_cover', 'opening']]);
    const open = blinds('open', 100);
    expect([open.is('is-on'), open.is('is-down')]).toEqual([true, true]);
    open.tap();
    expect(open.sent.moves).toEqual([['close_cover', 'closing']]);
    // it flips nothing: its commands are its own
    expect(open.sent.flips).toEqual([]);
  });

  it('on its way its bar breathes, a reader hears what a tap does, and a tap stops it there', () => {
    // the move just asked: Home Assistant still says closed, the card shows it opening
    const opening = blinds('closed', 0, 'opening');
    expect([opening.is('is-on'), opening.is('is-down'), opening.is('is-moving')]).toEqual([
      true,
      true,
      true,
    ]);
    expect(opening.rocker.getAttribute('aria-label')).toBe('Blinds · Stop');
    opening.tap();
    expect(opening.sent.moves).toEqual([['stop_cover', 'open']]);
    const closing = blinds('closing', 60);
    expect([closing.is('is-down'), closing.is('is-moving')]).toEqual([false, true]);
    closing.tap();
    expect(closing.sent.moves).toEqual([['stop_cover', 'open']]);
  });

  it('stopped part of the way, a tap takes it back the way it came', () => {
    // seen closing, then stopped at 40: the next tap opens it
    blinds('closing', 60);
    const stopped = blinds('open', 40);
    expect([stopped.is('is-on'), stopped.is('is-down'), stopped.is('is-moving')]).toEqual([
      true,
      false,
      false,
    ]);
    expect(stopped.rocker.getAttribute('aria-label')).toBe('Blinds');
    stopped.tap();
    expect(stopped.sent.moves).toEqual([['open_cover', 'opening']]);
    // seen opening, then stopped at 40: the next tap closes it
    blinds('opening', 20);
    const up = blinds('open', 40);
    expect(up.is('is-down')).toBe(true);
    up.tap();
    expect(up.sent.moves).toEqual([['close_cover', 'closing']]);
    // fully open it closes, whichever way it came
    blinds('closing', 60);
    const whole = blinds('open', 100);
    whole.tap();
    expect(whole.sent.moves).toEqual([['close_cover', 'closing']]);
  });

  it('one that cannot stop turns back instead', () => {
    const opening = blinds('opening', 30, 'opening', NO_STOP);
    expect(opening.rocker.getAttribute('aria-label')).toBe('Blinds');
    opening.tap();
    expect(opening.sent.moves).toEqual([['close_cover', 'closing']]);
    const closing = blinds('closing', 30, 'closing', NO_STOP);
    closing.tap();
    expect(closing.sent.moves).toEqual([['open_cover', 'opening']]);
  });

  it('a valve travels by its own services', () => {
    const valve = drawn('valve.garden', 'closed', { supported_features: TRAVELS });
    valve.tap();
    const moving = drawn('valve.garden', 'opening', { supported_features: TRAVELS });
    moving.tap();
    expect([...valve.sent.moves, ...moving.sent.moves]).toEqual([
      ['open_valve', 'opening'],
      ['stop_valve', 'open'],
    ]);
  });
});
