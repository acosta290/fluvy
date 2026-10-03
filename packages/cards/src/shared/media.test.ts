import { resolveEntity, type HomeAssistant } from '@fluvy/core';
import { describe, expect, it } from 'vitest';
import { fitControls, MEDIA, mediaControls, playPauseAction, powerAction } from './media.js';

const player = (state: string, features: number) =>
  resolveEntity(
    {
      language: 'en',
      states: {
        'media_player.p': {
          entity_id: 'media_player.p',
          state,
          attributes: { friendly_name: 'P', supported_features: features },
          last_changed: '2026-09-17T21:00:00Z',
        },
      },
    } as unknown as HomeAssistant,
    'media_player.p',
  );

describe('the power round', () => {
  it('switches on a player that is off, and off one that is on, when the player can', () => {
    const both = MEDIA.TURN_ON | MEDIA.TURN_OFF;
    expect(powerAction(player('off', both), 'off')).toEqual({ service: 'turn_on', expect: 'idle' });
    expect(powerAction(player('standby', both), 'standby')?.service).toBe('turn_on');
    expect(powerAction(player('playing', both), 'playing')).toEqual({
      service: 'turn_off',
      expect: 'off',
    });
    expect(powerAction(player('idle', both), 'idle')?.service).toBe('turn_off');
  });

  it('is nothing for what the player cannot do right now', () => {
    expect(powerAction(player('off', MEDIA.TURN_OFF), 'off')).toBeNull();
    expect(powerAction(player('playing', MEDIA.TURN_ON), 'playing')).toBeNull();
    expect(powerAction(player('playing', MEDIA.PLAY | MEDIA.PAUSE), 'playing')).toBeNull();
  });

  it('reads the state it is given (the optimistic one), not the entity’s', () => {
    const both = MEDIA.TURN_ON | MEDIA.TURN_OFF;
    expect(powerAction(player('playing', both), 'off')?.service).toBe('turn_on');
    expect(playPauseAction(player('playing', both), 'off').service).toBe('turn_on');
  });
});

describe('the controls asked for', () => {
  it('keep their order, each once, and only names the cards know', () => {
    expect(mediaControls(['volume', 'play', 'shuffle', 'play', 'power'], ['play'])).toEqual([
      'volume',
      'play',
      'power',
    ]);
  });

  it('fall back when the key is left out, and an empty list stays empty', () => {
    expect(mediaControls(undefined, ['play', 'next'])).toEqual(['play', 'next']);
    expect(mediaControls('play', ['play', 'next'])).toEqual(['play', 'next']);
    expect(mediaControls([], ['play', 'next'])).toEqual([]);
  });
});

describe('the controls a narrow row keeps', () => {
  const every = ['power', 'previous', 'play', 'next', 'volume'] as const;
  it('give way in an order of need — next, previous, volume, power — and never play', () => {
    expect(fitControls(every, 5)).toEqual([...every]);
    expect(fitControls(every, 4)).toEqual(['power', 'previous', 'play', 'volume']);
    expect(fitControls(every, 3)).toEqual(['power', 'play', 'volume']);
    expect(fitControls(every, 2)).toEqual(['power', 'play']);
    expect(fitControls(every, 1)).toEqual(['play']);
    expect(fitControls(every, 0)).toEqual([]);
  });
  it('keep the named order of what stays, and the last of a row without play', () => {
    expect(fitControls(['volume', 'play', 'power'], 2)).toEqual(['play', 'power']);
    expect(fitControls(['next', 'power', 'volume'], 1)).toEqual(['power']);
  });
});
