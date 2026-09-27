/**
 * What the media cards (the player, the home's now playing) read from a `media_player` the same way: its features,
 * whether the track moves, where it is, what the play round does, and its picture.
 */
import { numberAttr, textAttr, type EntityView, type HomeAssistant } from '@fluvy/core';

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

/** The play round can do something: play, pause, or wake a player that is off. */
export const playable = (view: EntityView): boolean =>
  view.supports(MEDIA.PLAY) || view.supports(MEDIA.PAUSE) || view.supports(MEDIA.TURN_ON);

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
  if ((state === 'off' || state === 'standby') && view.supports(MEDIA.TURN_ON))
    return { service: 'turn_on', expect: 'idle' };
  return { service: 'media_play_pause', expect: isPlaying(state) ? 'paused' : 'playing' };
}

/** The entity's picture as a URL the browser can load (Home Assistant's own paths through its base), or ''. */
export function mediaPicture(hass: HomeAssistant | undefined, view: EntityView): string {
  const raw = textAttr(view, 'entity_picture') || textAttr(view, 'entity_picture_local');
  if (!raw) return '';
  if (/^(https?:|data:|blob:|\/\/)/.test(raw)) return raw;
  return hass?.hassUrl(raw) ?? raw;
}
