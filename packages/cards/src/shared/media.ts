/**
 * What the media cards (the player, the home's now playing) read from a `media_player` the same way: its features,
 * whether the track moves, where it is, what the play and power rounds do, which rounds a compact row offers, and
 * its picture.
 */
import {
  numberAttr,
  textAttr,
  type EntityView,
  type HaFormSchemaItem,
  type HomeAssistant,
  type MessageKey,
} from '@fluvy/core';
import { editorWord, orderedField } from './form.js';

/** `supported_features` of `media_player` (Home Assistant 2026.9). A control appears only when its bit is set. */
export const MEDIA = {
  PAUSE: 1,
  SEEK: 2,
  VOLUME_SET: 4,
  VOLUME_MUTE: 8,
  PREVIOUS: 16,
  NEXT: 32,
  TURN_ON: 128,
  TURN_OFF: 256,
  VOLUME_STEP: 1024,
  SELECT_SOURCE: 2048,
  STOP: 4096,
  PLAY: 16384,
  SHUFFLE: 32768,
  REPEAT: 262144,
} as const;

/** The track moves: playing, or buffering on its way to it. */
export const isPlaying = (state: string): boolean => state === 'playing' || state === 'buffering';

/** Something is on: playing, buffering or paused. */
export const isActive = (state: string): boolean => isPlaying(state) || state === 'paused';

/** The player is switched off (a television in standby counts). */
export const isOff = (state: string): boolean => state === 'off' || state === 'standby';

/** The play round can do something: play, pause, or wake a player that is off. */
export const playable = (view: EntityView): boolean =>
  view.supports(MEDIA.PLAY) || view.supports(MEDIA.PAUSE) || view.supports(MEDIA.TURN_ON);

/** The player can be switched on or off at all (what a power round is offered for). */
export const hasPower = (view: EntityView): boolean =>
  view.supports(MEDIA.TURN_ON) || view.supports(MEDIA.TURN_OFF);

/** The player has a volume to speak of: it can be set, muted or stepped. */
export const hasVolume = (view: EntityView): boolean =>
  view.supports(MEDIA.VOLUME_SET) ||
  view.supports(MEDIA.VOLUME_MUTE) ||
  view.supports(MEDIA.VOLUME_STEP);

/**
 * Seconds into the track right now: what Home Assistant reported, plus the time since it said so while it says the
 * track plays (never a guess: a press not yet confirmed moves nothing); null without a duration or a position.
 */
export function trackPosition(view: EntityView, duration: number | null): number | null {
  if (duration === null || duration <= 0) return null;
  const reported = numberAttr(view, 'media_position');
  if (reported === null) return null;
  const at = Date.parse(textAttr(view, 'media_position_updated_at'));
  const drift =
    view.state === 'playing' && Number.isFinite(at) ? Math.max(0, (Date.now() - at) / 1000) : 0;
  return Math.min(duration, Math.max(0, reported + drift));
}

/** What the play round does from `state`: wakes a player that is off (when it can), else plays or pauses. */
export function playPauseAction(
  view: EntityView,
  state: string,
): { readonly service: 'turn_on' | 'media_play_pause'; readonly expect: string } {
  if (isOff(state) && view.supports(MEDIA.TURN_ON)) return { service: 'turn_on', expect: 'idle' };
  return { service: 'media_play_pause', expect: isPlaying(state) ? 'paused' : 'playing' };
}

/** What a power round does: the service, and the state to show until Home Assistant confirms it. */
export interface PowerAction {
  readonly service: 'turn_on' | 'turn_off';
  readonly expect: string;
}

/**
 * What the power round does from `state`: switches on a player that is off (when it can), switches off one that
 * is on (when it can); null when the player can do neither right now, and then there is no round.
 */
export function powerAction(view: EntityView, state: string): PowerAction | null {
  if (isOff(state))
    return view.supports(MEDIA.TURN_ON) ? { service: 'turn_on', expect: 'idle' } : null;
  return view.supports(MEDIA.TURN_OFF) ? { service: 'turn_off', expect: 'off' } : null;
}

import { MEDIA_CONTROLS, type MediaControl } from '../media-family.js';

export { MEDIA_CONTROLS, mediaControls, type MediaControl } from '../media-family.js';

/** What gives way first when a row cannot hold every round it was asked for: the skip ahead, the skip back, the
 * volume, then power — never play, the control a compact row is there for. */
const GIVES_WAY: readonly MediaControl[] = ['next', 'previous', 'volume', 'power'];

/**
 * `controls` with as many as `room` holds, in the named order: the rest give way in an order of need (`GIVES_WAY`),
 * as a head's lines do, never in the order they were written.
 */
export function fitControls(
  controls: readonly MediaControl[],
  room: number,
): readonly MediaControl[] {
  const kept = [...controls];
  for (const control of GIVES_WAY) {
    if (kept.length <= room) break;
    const at = kept.indexOf(control);
    if (at >= 0) kept.splice(at, 1);
  }
  return kept.slice(0, Math.max(0, Math.min(kept.length, room)));
}

/** Each round's word, for the editor's chips. */
const CONTROL_WORDS: Readonly<Record<MediaControl, MessageKey>> = {
  power: 'media.power',
  previous: 'media.previous',
  play: 'media.play',
  next: 'media.next',
  volume: 'media.volume',
};

/** The editor's `controls` field: the rounds by their words, dragged into order. */
export const controlsField = (): HaFormSchemaItem =>
  orderedField(
    'controls',
    MEDIA_CONTROLS.map((value) => ({ value, label: editorWord(CONTROL_WORDS[value]) })),
  );

/** The entity's picture as a URL the browser can load (Home Assistant's own paths through its base), or ''. */
export function mediaPicture(hass: HomeAssistant | undefined, view: EntityView): string {
  const raw = textAttr(view, 'entity_picture') || textAttr(view, 'entity_picture_local');
  if (!raw) return '';
  if (/^(https?:|data:|blob:|\/\/)/.test(raw)) return raw;
  return hass?.hassUrl(raw) ?? raw;
}
