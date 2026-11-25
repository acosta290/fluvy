import { describe, expect, it } from 'vitest';
import { buttonService, commandFor, isKey, isLetter, KEY_GLYPHS, KEYS } from './keys.js';

describe('the remote’s keys and the integrations’ commands (#143)', () => {
  it('every key has a glyph or its letter, and only the table’s names are keys', () => {
    for (const key of KEYS) expect(isLetter(key) || Boolean(KEY_GLYPHS[key]), key).toBe(true);
    expect(KEYS.filter(isLetter)).toEqual(['a', 'b', 'x', 'y']);
    // the Xbox button wears the console's mark, from the logos' chunk
    expect(KEY_GLYPHS.nexus).toBe('app:xbox');
    expect(isKey('home')).toBe(true);
    expect(isKey('HOME')).toBe(false);
    expect(isKey(3)).toBe(false);
  });

  it('Android TV Remote takes Android key names without their prefix', () => {
    expect(commandFor('androidtv_remote', 'ok')).toBe('DPAD_CENTER');
    expect(commandFor('androidtv_remote', 'back')).toBe('BACK');
    expect(commandFor('androidtv_remote', 'mute')).toBe('VOLUME_MUTE');
    expect(commandFor('androidtv_remote', 'play_pause')).toBe('MEDIA_PLAY_PAUSE');
  });

  it('Apple TV takes pyatv’s names: the Siri remote’s back is menu, its TV button home; no subtitles key', () => {
    expect(commandFor('apple_tv', 'back')).toBe('menu');
    expect(commandFor('apple_tv', 'home')).toBe('home');
    expect(commandFor('apple_tv', 'ok')).toBe('select');
    expect(commandFor('apple_tv', 'rewind')).toBe('skip_backward');
    expect(commandFor('apple_tv', 'captions')).toBeUndefined();
  });

  it('Roku takes rokuecp’s names: reverse and forward, the options button as info', () => {
    expect(commandFor('roku', 'rewind')).toBe('reverse');
    expect(commandFor('roku', 'forward')).toBe('forward');
    expect(commandFor('roku', 'menu')).toBe('info');
    expect(commandFor('roku', 'mute')).toBe('volume_mute');
  });

  it('LG webOS takes aiowebostv’s buttons on the player itself', () => {
    expect(commandFor('webostv', 'captions')).toBe('CC');
    expect(commandFor('webostv', 'ok')).toBe('ENTER');
    expect(buttonService('webostv')).toBe(true);
    expect(buttonService('samsungtv')).toBe(false);
  });

  it('Samsung takes KEY_ codes, Fire TV python-androidtv’s names', () => {
    expect(commandFor('samsungtv', 'volume_up')).toBe('KEY_VOLUP');
    expect(commandFor('samsungtv', 'back')).toBe('KEY_RETURN');
    expect(commandFor('androidtv', 'ok')).toBe('CENTER');
    expect(commandFor('androidtv', 'forward')).toBe('FAST_FORWARD');
  });

  it('the Xbox takes its controller’s buttons and Home Assistant’s own commands, none of another’s (#255)', () => {
    expect(commandFor('xbox', 'up')).toBe('Up');
    expect(commandFor('xbox', 'ok')).toBe('A');
    expect(commandFor('xbox', 'back')).toBe('B');
    expect(commandFor('xbox', 'home')).toBe('GoHome');
    expect(commandFor('xbox', 'guide')).toBe('ShowGuide');
    // any other word the console types as text: a key it has no command for is none
    for (const key of ['captions', 'power', 'mute', 'rewind', 'channel_up', 'assistant'] as const)
      expect(commandFor('xbox', key), key).toBeUndefined();
    expect(
      ['a', 'b', 'x', 'y', 'view', 'nexus'].map((key) => commandFor('xbox', key as never)),
    ).toEqual(['A', 'B', 'X', 'Y', 'View', 'Nexus']);
  });

  it('a game controller’s keys on Android TV Remote are Android’s gamepad codes; Apple TV has none', () => {
    expect(commandFor('androidtv_remote', 'a')).toBe('BUTTON_A');
    expect(commandFor('androidtv_remote', 'y')).toBe('BUTTON_Y');
    expect(commandFor('androidtv_remote', 'view')).toBe('BUTTON_SELECT');
    expect(commandFor('androidtv_remote', 'nexus')).toBe('BUTTON_MODE');
    expect(commandFor('apple_tv', 'a')).toBeUndefined();
    expect(commandFor('roku', 'nexus')).toBeUndefined();
  });

  it('an integration the table does not know is sent Android TV Remote’s names', () => {
    expect(commandFor('philips_js', 'home')).toBe('HOME');
    expect(commandFor(undefined, 'up')).toBe('DPAD_UP');
  });
});
