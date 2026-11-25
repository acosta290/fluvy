import { runAction, type ActionConfig, type HomeAssistant } from '@fluvy/core';
import type { Choice } from '../../shared/chips.js';
import { askedBy, call, isBag, offers, type DriveCall } from '../drive.js';
import { callOf, ownCall, type Job, type Ways } from './calls.js';
import type { Own, Preset } from './config.js';
import { presetJob } from './selection.js';

/*
 * The card's presets (#265): what each one's chip says, the call it is, and its run. A preset cleans what it names
 * (zones, rooms, areas), goes to its point, or runs an action of the person's own with those numbers; one that names
 * nothing is a full clean. `presets: areas` is one for each of Home Assistant's areas the robot has mapped.
 */

/** Each robot's mapped areas as this page has read them; a robot asked about and not yet answered has none. */
const mapped = new Map<string, readonly string[]>();

/**
 * The areas a robot has mapped to its segments in Home Assistant (its entity's settings, `options.vacuum.
 * area_mapping`: the registry's entry, which anyone may read), asked once a page; `read` is told when they land.
 */
function mappedAreas(hass: HomeAssistant, id: string, read: () => void): readonly string[] {
  const known = mapped.get(id);
  if (known) return known;
  mapped.set(id, []);
  hass
    .callWS<unknown>({ type: 'config/entity_registry/get', entity_id: id })
    .then((entry) => {
      const options = isBag(entry) && isBag(entry['options']) ? entry['options']['vacuum'] : null;
      const areas = isBag(options) && isBag(options['area_mapping']) ? options['area_mapping'] : {};
      mapped.set(id, Object.keys(areas));
      read();
    })
    .catch(() => undefined);
  return [];
}

/** A preset for each area the robot has mapped that the house still has, by the area's name and its icon. */
export function areaPresets(
  hass: HomeAssistant | undefined,
  id: string,
  read: () => void,
): readonly Preset[] {
  if (!hass) return [];
  return mappedAreas(hass, id, read).flatMap((area): Preset[] => {
    const known = hass.areas?.[area];
    if (!known) return [];
    const icon = typeof known.icon === 'string' && known.icon ? known.icon : undefined;
    return [
      {
        name: known.name,
        ...(icon ? { icon } : {}),
        zones: [],
        rooms: [],
        areas: [area],
        repeats: 1,
        onMap: true,
      },
    ];
  });
}

/** What a call of the person's own cannot be said without: the selection, or a point of it. */
const PICKED = ['selection', 'point_x', 'point_y'] as const;

/**
 * The call a preset is at a tap (`own`: its `tap_action`; or what the person wrote for a still press or a double
 * tap): its own, with the numbers of what it names — of what is picked on the map (`picked`) where it names
 * nothing, none while that leaves it a number short; else, at a tap, its integration's for what it names, a preset
 * that names nothing starting the robot. Nothing where the robot has no way for it, nor for an action of the
 * person's own that is no call.
 */
export function presetCall(
  hass: HomeAssistant,
  ways: Ways,
  id: string,
  preset: Preset,
  picked?: Job,
  own: Own | undefined = preset.tap,
): DriveCall | undefined {
  const named = presetJob(preset);
  const names = Object.keys(named).length > 1;
  const written = own?.call;
  if (written) {
    const job = names ? named : picked;
    const asks = askedBy(written.data);
    const short = PICKED.some(
      (name) => asks.has(name) && (name === 'selection' ? !job : !job?.point),
    );
    return short || !offers(hass, written.domain, written.service)
      ? undefined
      : ownCall(hass, written, id, job ?? { repeats: preset.repeats });
  }
  if (own) return undefined;
  if (names) return callOf(ways, named);
  const [domain = ''] = id.split('.');
  const start = domain === 'lawn_mower' ? 'start_mowing' : 'start';
  return offers(hass, domain, start) ? call(domain, start, {}, id) : undefined;
}

/** A call as an action of the card's, so that one asked to ask first goes through Home Assistant's own dialog. */
const asAction = (found: DriveCall, confirmation: Preset['confirmation']): ActionConfig => ({
  action: 'perform-action',
  perform_action: `${found.domain}.${found.service}`,
  data: { ...found.data },
  ...(found.target ? { target: { entity_id: [...found.target] } } : {}),
  ...(confirmation === undefined ? {} : { confirmation }),
});

/**
 * A preset run: its call (`presetCall`), or a card's action of another kind as the person wrote it; asked first where
 * that answer says so, a tap where the preset itself does (`confirmation`). A call Home Assistant refuses says so in
 * its own toast.
 */
export function runPreset(
  node: HTMLElement,
  hass: HomeAssistant,
  id: string,
  preset: Preset,
  found: DriveCall | undefined,
  own: Own | undefined = preset.tap,
): void {
  const asks = own?.confirmation ?? (own === preset.tap ? preset.confirmation : undefined);
  const action = own?.action ?? (found && asAction(found, asks));
  if (action) runAction(node, hass, action, id).catch(() => undefined);
}

/** A call made as it is. */
export const send = (hass: HomeAssistant, found: DriveCall): Promise<unknown> =>
  hass.callService(
    found.domain,
    found.service,
    { ...found.data },
    found.target ? { entity_id: [...found.target] } : undefined,
  );

/** How a preset's chip stands: in its colour, lit while the map shows it, still where it cannot run. */
export interface ChipLook {
  /** The colour's `data-accent`, as the card derives it. */
  readonly accent: (colour: string | undefined) => string | undefined;
  readonly shown: (preset: Preset, index: number) => boolean;
  readonly runs: (preset: Preset, index: number) => boolean;
  /** What a still press does (the preset shown on the map); none where the map does not draw it. */
  readonly hold: (preset: Preset, index: number) => (() => void) | undefined;
  /** The robot is out of reach: every chip in the dashed skin, none taps. */
  readonly still: boolean;
}

/** The presets as chips: each by its name (a name's words may end in an ellipsis), its icon and its colour. */
export const presetChips = (presets: readonly Preset[], look: ChipLook): Choice[] =>
  presets.map((preset, index): Choice => {
    const accent = look.accent(preset.color);
    const hold = look.still ? undefined : look.hold(preset, index);
    return {
      key: String(index),
      label: preset.name,
      name: true,
      ...(preset.icon ? { glyph: preset.icon } : {}),
      ...(accent ? { accent, tone: 'accent' as const } : {}),
      active: !look.still && look.shown(preset, index),
      ...(look.still ? { unavailable: true } : look.runs(preset, index) ? {} : { disabled: true }),
      ...(hold ? { onHold: hold } : {}),
    };
  });
