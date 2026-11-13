import { localize, type EntityView, type HomeAssistant } from '@fluvy/core';
import type { Tone } from '@fluvy/ui';
import { drawRocker, wearSwitchStyles } from '@fluvy/ui/switch-styles';
import type { TemplateResult } from 'lit';

/*
 * A tile's wall rocker (`switch_style: rocker`, 1.20, #177): what the tile draws in its switch's place when asked,
 * fetched with the rocker's drawing and sheet by the first tile asked for one (the `switch-styles` chunk), never by
 * a house of toggles. Anything that switches flips as its toggle would; a cover or a valve travels, so its rocker
 * says where its next tap takes it and stops it on its way.
 */

/** A cover's and a valve's `STOP` feature: what a tap on one on its way asks for. */
const STOP = 8;

/**
 * The way each cover last travelled on this page (`opening`, `closing`): where a tap takes one that stopped part of
 * the way — back the way it came, as Home Assistant's own toggle goes.
 */
const travelled = new Map<string, string>();

/**
 * The rocker of a tile's entity, in the card's root (which wears the sheet). `state`: the entity's as the card shows
 * it (a flip just asked, until Home Assistant answers); `lit`: it is on. `flip` switches what switches, at once under
 * the finger; `move` sends a cover or a valve its command and shows where it is headed.
 *
 * A cover's or a valve's upper half is the raised one while its next tap opens it — closed, closing, or stopped on
 * its way down — and its lower one while it closes it; its bar is lit while it is not closed and breathes while it
 * travels, when a tap stops it there (where it can stop: else it turns back). One tap, one target: two halves of 22
 * would each be half a finger.
 */
export function plate(
  root: Node,
  hass: HomeAssistant | undefined,
  view: EntityView,
  state: string,
  lit: boolean,
  tone: Tone,
  label: string,
  usable: boolean,
  flip: (next: boolean) => void,
  move: (service: string, state: string) => void,
): TemplateResult {
  wearSwitchStyles(root);
  const travels = usable && (view.domain === 'cover' || view.domain === 'valve');
  if (!travels)
    return drawRocker({
      on: lit,
      down: lit,
      tone,
      label,
      disabled: !usable,
      onTap: () => flip(!lit),
    });
  const moving = state === 'opening' || state === 'closing';
  if (moving) travelled.set(view.id, state);
  const stops = moving && view.supports(STOP);
  const opens =
    state === 'closed' ||
    state === 'closing' ||
    (state !== 'opening' &&
      view.attr<number>('current_position') !== 100 &&
      travelled.get(view.id) === 'closing');
  return drawRocker({
    on: lit,
    down: !opens,
    moving,
    tone,
    label: stops ? `${label} · ${localize(hass, 'cover.stop')}` : label,
    disabled: false,
    onTap: () =>
      stops
        ? move(`stop_${view.domain}`, 'open')
        : move(`${opens ? 'open' : 'close'}_${view.domain}`, opens ? 'opening' : 'closing'),
  });
}
