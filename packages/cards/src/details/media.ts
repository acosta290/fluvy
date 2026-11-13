// the player's words: the media family's, here before the sheet says them
import '../media/english.js';
import { formatNumber, numberAttr, textAttr, type EntityView } from '@fluvy/core';
import { clamp, type DialChangeDetail, type Tone } from '@fluvy/ui';
import { html, type TemplateResult } from 'lit';
import { actionsThatFit, Hold, shownStateText } from '../cover/common.js';
import {
  fitControls,
  isOff,
  isPlaying,
  MEDIA,
  MEDIA_CONTROLS,
  mediaPicture,
  playable,
  playPauseAction,
  powerAction,
  type MediaControl,
} from '../shared/media.js';
import { modeWord } from '../shared/mode-words.js';
import type { DaySpec } from './history.js';
import { keys, listAttr, sheetRows, type Key, type SheetRow } from './parts.js';
import { DetailsSheet, type Status } from './sheet.js';

/** A player's `supported_features` bit for its sound modes. */
const SELECT_SOUND_MODE = 65536;

/** In use: on and doing something, or ready to (a television on its input) — not off, idle or out of reach. */
const inUse = (state: string): boolean =>
  !isOff(state) && !['idle', 'unavailable', 'unknown', ''].includes(state);

/**
 * A player's details: its volume on the dial; under it its switch, the track before, play or pause, the track after
 * and mute, each one it takes; then its source and its sound mode, each a row that opens its options. Its artwork is
 * the head's picture, what plays the head's line. A player with no volume to set is its ring, lit while it plays, and
 * its keys.
 */
export class FluvyDetailsMedia extends DetailsSheet {
  /** The volume the finger set, shown until the player reports it. */
  private readonly volume = new Hold<number | null>(this);
  private readonly input = new Hold<string | null>(this);
  private readonly sound = new Hold<string | null>(this);

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const hold of [this.volume, this.input, this.sound]) hold.clear();
  }

  protected tone(): Tone {
    return 'media';
  }

  protected active(view: EntityView): boolean {
    return isPlaying(this.stateOf(view));
  }

  /** What plays, by whom; else what the player is doing. */
  protected status(view: EntityView): Status {
    const state = this.stateOf(view);
    const title = isOff(state) ? '' : textAttr(view, 'media_title');
    return title
      ? { parts: [title, textAttr(view, 'media_artist')], name: true }
      : { parts: [shownStateText(this.hass, view, state)] };
  }

  protected override picture(view: EntityView): string {
    return isOff(this.stateOf(view)) ? '' : mediaPicture(this.hass, view);
  }

  /** The day is how long it was on: playing, paused, or a television showing its input. */
  protected daySpec(view: EntityView): DaySpec {
    return { kind: 'state', active: inUse, word: shownStateText(this.hass, view, 'on') };
  }

  protected dayLevel(view: EntityView): number {
    return inUse(this.stateOf(view)) ? 1 : 0;
  }

  /**
   * The player's keys, each one it takes: its switch, the track before, play or pause, the track after, mute — as many
   * as the column holds on one row, the rest giving way in the players' own order (`fitControls`), never play.
   */
  private keysOf(view: EntityView, name: string, state: string, unusable: boolean): Key[] {
    const off = isOff(state);
    const muted = view.attr<boolean>('is_volume_muted') === true;
    const playing = isPlaying(state);
    const key = (glyph: string, word: string, disabled: boolean): Omit<Key, 'key'> => ({
      glyph,
      label: `${name} · ${word}`,
      disabled: unusable || disabled,
    });
    const all: Partial<Record<MediaControl, Omit<Key, 'key'>>> = {
      ...(powerAction(view, state)
        ? {
            power: {
              ...key('power', this.t(off ? 'media.power_on' : 'media.power_off'), false),
              on: !off,
              tone: 'media',
            },
          }
        : {}),
      ...(view.supports(MEDIA.PREVIOUS)
        ? { previous: key('prev', this.t('media.previous'), off) }
        : {}),
      ...(playable(view)
        ? {
            play: key(
              playing ? 'pause' : 'play',
              this.t(playing ? 'media.pause' : 'media.play'),
              false,
            ),
          }
        : {}),
      ...(view.supports(MEDIA.NEXT) ? { next: key('next', this.t('media.next'), off) } : {}),
      ...(view.supports(MEDIA.VOLUME_MUTE)
        ? {
            volume: {
              ...key(
                muted ? 'volumeOff' : 'volume',
                this.t(muted ? 'media.unmute' : 'media.mute'),
                off,
              ),
              on: muted,
              tone: 'media',
            },
          }
        : {}),
    };
    return fitControls(
      MEDIA_CONTROLS.filter((control) => all[control]),
      actionsThatFit(this.room),
    ).map((control) => ({ key: control, ...(all[control] as Omit<Key, 'key'>) }));
  }

  private press(view: EntityView, key: string): void {
    const state = this.stateOf(view);
    if (key === 'power') {
      const action = powerAction(view, state);
      if (!action) return;
      this.expect(view.id, action.expect);
      this.call('media_player', action.service);
    } else if (key === 'play') {
      const action = playPauseAction(view, state);
      this.expect(view.id, action.expect);
      this.call('media_player', action.service);
    } else if (key === 'volume')
      this.call('media_player', 'volume_mute', {
        is_volume_muted: view.attr<boolean>('is_volume_muted') !== true,
      });
    else this.call('media_player', key === 'next' ? 'media_next_track' : 'media_previous_track');
  }

  /** Its source and its sound mode, each where the player lists some. */
  private rows(view: EntityView, unusable: boolean): SheetRow[] {
    const sources = view.supports(MEDIA.SELECT_SOURCE) ? listAttr(view.attr('source_list')) : [];
    const sounds = view.supports(SELECT_SOUND_MODE) ? listAttr(view.attr('sound_mode_list')) : [];
    return [
      ...(sources.length
        ? [
            {
              kind: 'choice' as const,
              icon: 'tv' as const,
              title: this.t('media.source'),
              chosen: this.input.read(textAttr(view, 'source') || null),
              options: sources,
              // a source is named by its device or its app: said as it is
              word: (option: string) => option,
              disabled: unusable,
              choose: (option: string) => {
                this.input.set(option);
                this.call('media_player', 'select_source', { source: option });
              },
            },
          ]
        : []),
      ...(sounds.length
        ? [
            {
              kind: 'choice' as const,
              icon: 'speaker' as const,
              title: this.t('sheets.sound_mode'),
              chosen: this.sound.read(textAttr(view, 'sound_mode') || null),
              options: sounds,
              word: (option: string) => modeWord(this.rawHass, view, 'sound_mode', option),
              disabled: unusable,
              choose: (option: string) => {
                this.sound.set(option);
                this.call('media_player', 'select_sound_mode', { sound_mode: option });
              },
            },
          ]
        : []),
    ];
  }

  protected renderBody(view: EntityView, unusable: boolean): TemplateResult {
    const name = this.nameFor(view, undefined);
    const state = this.stateOf(view);
    const sets = view.supports(MEDIA.VOLUME_SET);
    const muted = view.attr<boolean>('is_volume_muted') === true;
    const reported = numberAttr(view, 'volume_level');
    const level = this.volume.read(
      reported === null ? null : Math.round(clamp(reported, 0, 1) * 100),
    );
    const lit = !unusable && !isOff(state) && !muted;
    const words = this.t('media.volume');
    const percent = (value: number): string => formatNumber(this.hass, value, { digits: 0 });
    return html`<div class="dt-hero">
        <fluvy-dial
          .radius=${this.ring}
          .large=${this.large}
          .stepper=${false}
          .tone=${lit ? 'media' : 'neutral'}
          .min=${0}
          .max=${100}
          .step=${1}
          .value=${sets ? (level ?? undefined) : undefined}
          .gauge=${!sets}
          .fill=${sets ? undefined : this.active(view) && !unusable ? 1 : 0}
          .unit=${'%'}
          .sub=${sets ? this.dialWords(muted ? this.t('common.muted') : words) : ''}
          .text=${unusable || (sets && level === null) ? '—' : sets ? undefined : shownStateText(this.hass, view, state)}
          .name=${`${name} · ${words}`}
          min-label=${sets ? percent(0) : ''}
          max-label=${sets ? percent(100) : ''}
          ?disabled=${unusable || (sets && level === null)}
          .format=${percent}
          @fluvy-change=${(event: CustomEvent<DialChangeDetail>) => {
            const value = Math.round(event.detail.value ?? 0);
            this.volume.set(value);
            this.call('media_player', 'volume_set', { volume_level: value / 100 });
          }}
        ></fluvy-dial>
      </div>
      ${keys(this.keysOf(view, name, state, unusable), this.room, (key) => this.press(view, key))}
      ${sheetRows(this.ruler, this.room, this.rows(view, unusable))}`;
  }
}

if (!customElements.get('fluvy-details-media'))
  customElements.define('fluvy-details-media', FluvyDetailsMedia);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-details-media': FluvyDetailsMedia;
  }
}
