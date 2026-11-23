import {
  actionRuns,
  entityName,
  formatNumber,
  isActiveState,
  isUsable,
  lightDefaults,
  localize,
  playerOff,
  resolveEntity,
  ROUND_TOGGLE,
  stateText,
  textName,
  valueParts,
  type ActionConfig,
  type ActionConfirmation,
  type EntityName,
  type EntityView,
  type HomeAssistant,
} from '@fluvy/core';
import type { Tone } from '@fluvy/ui';
import { css, html, nothing, type TemplateResult } from 'lit';
import { statusToneOf, type Coloured, type LightColours } from './colour.js';
import { GATEWAYS, iconOf, toneFor } from './domain.js';
import type { TextRuler } from './fit.js';
import { DIMMABLE, lampsOf, lightLook, litColour, meanHex } from './light.js';
import { shorterForms } from './secondary.js';
import { levelRound, ROUND, ROUND_GAP, type LevelRound } from './round.js';

/*
 * Rounds (#113, #224): an entity, or one of a room's sets, as a 44 round — lit in its tone with a ring of its level
 * while on, the dashed ring out of reach — whose tap turns it on and off and whose hold opens it, saying its state in a
 * pill where asked (#205). One engine for every card that draws them: a room's quick actions, the Rounds card, a row's
 * rounds (`rounds-row.ts`). Its own chunk with the room's quick actions (`quick-actions`), fetched with the families
 * as the bundle starts.
 */

/** A room's own sets a round may stand for, each by the domain its devices are of. */
const GROUPS = {
  lights: 'light',
  covers: 'cover',
  fans: 'fan',
  media: 'media_player',
} as const;
export type RoundGroup = keyof typeof GROUPS;
export const ROUND_GROUPS = Object.keys(GROUPS) as readonly RoundGroup[];

/** A set's word (its round's name) and glyph (where it holds more than one). */
const LOOKS = {
  lights: ['room.lights', 'bulb'],
  covers: ['room.covers', 'blinds'],
  fans: ['room.fans', 'fan'],
  media: ['room.media', 'speaker'],
} as const;

/** One round: one of a room's sets (`group`), or one entity; its own name, icon, colour, actions and say. */
export interface RoundSpec {
  /** `lights`, `covers` (blinds, curtains, awnings: never a door or a gate), `fans`, `media`; `entity`: its own. */
  group?: RoundGroup | 'entity';
  /** The entity a round of its own acts on. */
  entity?: string;
  name?: EntityName;
  icon?: string;
  tone?: Tone;
  /** Its own colour while on (a Home Assistant colour name or `#rrggbb`). */
  color?: string;
  /** Default: on and off (a set: all of it; blinds: open, close, or stop while they move), where it is safe to. */
  tap_action?: ActionConfig;
  /** Default: its details (a set of several: where the room opens). */
  hold_action?: ActionConfig;
  /** Default: none; where set, a tap waits a moment to tell it from one (#179). */
  double_tap_action?: ActionConfig;
  /** Its state beside or under its glyph (#205); default: its card's. */
  show_state?: boolean;
}

/** A config's entry as a round: a set's word, an entity's id, or an entry; anything else none. */
export function roundEntry(raw: unknown): RoundSpec | null {
  if (typeof raw === 'string')
    return raw.includes('.') ? { group: 'entity', entity: raw } : { group: raw as RoundGroup };
  if (typeof raw !== 'object' || raw === null) return null;
  const entry = raw as RoundSpec;
  return entry.group ? entry : { ...entry, group: 'entity' };
}

/** What the rounds read of their card: its colour and tone, its lights' colours, the states they say and where. */
export interface RoundsLook extends Coloured, LightColours {
  /** Every round says its state (#205), unless its own `show_state` says not. */
  readonly states?: boolean | undefined;
  /** …beside its glyph (as tall as a round), not under it (64 tall). */
  readonly beside?: boolean | undefined;
}

/** What the rounds reach of their card: its house and look, its states as drawn, its calls, its colours, its ruler. */
export interface RoundsHost {
  readonly hass: HomeAssistant | undefined;
  readonly look?: RoundsLook | undefined;
  /** The room's devices and lights as its card counts them, where its rounds stand for its sets; none: entities alone. */
  readonly devices?: readonly string[] | undefined;
  readonly lights?: readonly string[] | undefined;
  /**
   * The domains a round's tap turns on and off where it names no tap, the rest opening their details: what is safe to
   * flip by default (`ROUND_TOGGLE`, a lock asking before it unlocks).
   */
  readonly toggles?: ReadonlySet<string> | undefined;
  /** An entity's name as the card says it (its `names`): the entity's own by default. */
  name?(view: EntityView, own: EntityName | undefined): string;
  /** A state as drawn: the one a tap expects until Home Assistant says it. */
  state(view: EntityView): string;
  expect(entityId: string, state: string): void;
  call(domain: string, service: string, data: Record<string, unknown>): void;
  run(action: ActionConfig, entityId: string | undefined): void;
  /** A tap that waits for a second where a double tap is set (the card's `tapper`). */
  tapper(
    of: unknown,
    at: string,
    tap: (() => void) | undefined,
    double: (() => void) | undefined,
  ): (() => void) | undefined;
  /** A colour as the card's sheet gives it (`data-accent`). */
  accent(colour: unknown): string | undefined;
  /** Where a set of several opens (a room's page), where it opens anywhere. */
  readonly destination?: string | undefined;
  /** The card's ruler: the words and pills it lays out, in the card's own classes. */
  readonly ruler: Pick<TextRuler, 'pill' | 'width'>;
  /** The card's root, which wears the pills' sheet once one is drawn. */
  readonly root: Node | undefined;
}

/** Rounds drawn in the room a card gives them, and what they take of its line: their width and 12 before. */
export interface RoundsBlock {
  readonly taken: number;
  readonly template: TemplateResult | typeof nothing;
}

/** What a room's sets are drawn from: its house, its devices and its lights as the card counts them. */
export type RoundsRoom = Pick<RoundsHost, 'hass' | 'devices' | 'lights'>;

/**
 * A set's entities in a room: its lights (a lamp on a plug among them where the card lists one), else its devices of
 * the set's domain (its blinds, never its doors and gates); none where the rounds stand for no room.
 */
export function membersOf(
  { hass, devices = [], lights = [] }: RoundsRoom,
  group: RoundGroup,
): readonly string[] {
  return group === 'lights'
    ? lights
    : devices.filter(
        (id) =>
          id.startsWith(`${GROUPS[group]}.`) &&
          (group !== 'covers' || !GATEWAYS.has(resolveEntity(hass, id).deviceClass)),
      );
}

/** The entries of a list that can be drawn: an entity's own, a set the room holds; never a word it does not know. */
export const roundsOf = (room: RoundsRoom, entries: readonly unknown[]): RoundSpec[] =>
  entries
    .map(roundEntry)
    .filter(
      (item): item is RoundSpec =>
        item !== null &&
        (item.group === 'entity'
          ? Boolean(item.entity)
          : item.group !== undefined &&
            Object.hasOwn(GROUPS, item.group) &&
            membersOf(room, item.group).length > 0),
    );

/**
 * Where an entity stands, 0–100, where it says: a light's brightness (where it dims), a blind's position, a fan's
 * speed, a player's volume.
 */
function levelIn(view: EntityView): number | undefined {
  const raw =
    view.domain === 'light'
      ? (view.attr<string[]>('supported_color_modes') ?? []).some((mode) => DIMMABLE.has(mode))
        ? (view.attr<number>('brightness') ?? NaN) / 2.55
        : NaN
      : view.domain === 'cover'
        ? view.attr<number>('current_position')
        : view.domain === 'fan'
          ? view.attr<number>('percentage')
          : view.domain === 'media_player'
            ? (view.attr<number>('volume_level') ?? NaN) * 100
            : NaN;
  return typeof raw === 'number' && Number.isFinite(raw)
    ? Math.min(100, Math.max(0, raw))
    : undefined;
}

/** Where an entity stands while on: its level, 100 where it says none. */
const levelOf = (view: EntityView): number => levelIn(view) ?? 100;

/** The domains whose ring is a level a person reads as one: a light's brightness, a blind's position, a fan's speed. */
const LEVELLED: ReadonlySet<string> = new Set(['light', 'cover', 'fan']);

/**
 * What a round says of its state (#205), its forms longest first: the level its ring draws (`level`, where that is
 * one a person reads); else its state as Home Assistant says it, as it is drawn — a reading with its unit in the
 * house's decimals, then a temperature with its degree alone ("21.5 °C", "21.5°") and a large count in short words, a
 * moment as long ago as it was, a word ("Open", "Off") — of the first of a set that is on; "—" where none of it can
 * be read.
 */
function saidOf(
  host: RoundsHost,
  views: readonly EntityView[],
  level: number | undefined,
): readonly string[] {
  const { hass } = host;
  const read = views.filter((view) => view.status === 'ok');
  const view = read.find((one) => isActiveState(one.domain, host.state(one))) ?? read[0];
  if (!view) return ['—'];
  if (level !== undefined) return [`${formatNumber(hass, level, { digits: 0 })} %`];
  if (view.number === null) {
    const words = stateText(hass, view, host.state(view));
    return [words, ...shorterForms(hass, view, words)];
  }
  const { value, unit } = valueParts(hass, view);
  const text = unit ? `${value} ${unit}` : value;
  // a figure keeps its unit in every form: the degree alone, a count's short words with the unit it was written in
  return unit.startsWith('°')
    ? [text, `${value}°`]
    : [text, ...shorterForms(hass, view, text).filter((form) => unit && form.endsWith(` ${unit}`))];
}

/** States a blind moves in: a tap then stops it. */
const MOVING: ReadonlySet<string> = new Set(['opening', 'closing']);

/* the `supported_features` of a blind and a player that say which service each takes */
const COVER_OPEN = 1;
const COVER_CLOSE = 2;
const COVER_STOP = 8;
const COVER_OPEN_TILT = 16;
const COVER_CLOSE_TILT = 32;
const COVER_STOP_TILT = 64;
const MEDIA_PAUSE = 1;
const MEDIA_TURN_ON = 128;
const MEDIA_TURN_OFF = 256;
const MEDIA_STOP = 4096;
const MEDIA_PLAY = 16384;

/** The services a move may be, best first, each with the feature a member needs for it (0: every member takes it). */
type Ways = readonly (readonly [service: string, feature: number])[];

/** A blind stops, closes and opens itself, else (one that only tilts) its slats. */
const STOPS: Ways = [
  ['stop_cover', COVER_STOP],
  ['stop_cover_tilt', COVER_STOP_TILT],
];
const CLOSES: Ways = [
  ['close_cover', COVER_CLOSE],
  ['close_cover_tilt', COVER_CLOSE_TILT],
];
const OPENS: Ways = [
  ['open_cover', COVER_OPEN],
  ['open_cover_tilt', COVER_OPEN_TILT],
];
/** A player that plays pauses, else stops (Home Assistant's own play button), else goes off. */
const PAUSES: Ways = [
  ['media_pause', MEDIA_PAUSE],
  ['media_stop', MEDIA_STOP],
  ['turn_off', MEDIA_TURN_OFF],
];
const PLAYS: Ways = [['media_play', MEDIA_PLAY]];
const WAKES: Ways = [['turn_on', MEDIA_TURN_ON]];

/** One call of a round's: a service of a domain and the members of that domain that take it. */
interface Call {
  readonly domain: string;
  readonly service: string;
  readonly ids: readonly string[];
}

/**
 * The calls that move `views`, one a service in the order of `ways` and a domain (a lamp on a plug among lights is a
 * switch, which a light's call never reaches): each member by the first of them it supports, one that supports none
 * left out (Home Assistant refuses a whole call one of its entities cannot take).
 */
function callsOf(views: readonly EntityView[], ways: Ways): Call[] {
  const way = (view: EntityView): string | undefined =>
    ways.find(([, feature]) => !feature || view.supports(feature))?.[0];
  const domains = [...new Set(views.map((view) => view.domain))];
  return ways
    .flatMap(([service]) =>
      domains.map((domain) => ({
        domain,
        service,
        ids: views
          .filter((view) => view.domain === domain && way(view) === service)
          .map((view) => view.id),
      })),
    )
    .filter((call) => call.ids.length > 0);
}

/** A round's on and off as it would go now: its calls (none: none of its members can), and the state they expect. */
interface Flip {
  readonly calls: readonly Call[];
  readonly expect?: string;
}

/**
 * A round's own on and off, for all of it at once: a set on goes off, a set off comes on; blinds that move stop, else
 * open ones close and closed ones open; players that play pause, else those on play and those off come on — each
 * member by what it takes (a blind that only tilts by its slats, a lamp on a plug as a switch), one call a service
 * and a domain.
 */
export function flipOf(domain: string, views: readonly EntityView[], on: boolean): Flip {
  const usable = views.filter(isUsable);
  if (domain === 'cover') {
    const stops = callsOf(
      usable.filter((view) => MOVING.has(view.state)),
      STOPS,
    );
    if (stops.length) return { calls: stops };
    return on
      ? { calls: callsOf(usable, CLOSES), expect: 'closed' }
      : { calls: callsOf(usable, OPENS), expect: 'open' };
  }
  if (domain === 'media_player') {
    const playing = usable.filter((view) => view.state === 'playing');
    if (playing.length) return { calls: callsOf(playing, PAUSES) };
    // a player off is woken; one in standby too where it can be, else it plays as a player at rest does
    const asleep = (view: EntityView): boolean =>
      view.state === 'off' || (playerOff(view.state) && view.supports(MEDIA_TURN_ON));
    const awake = usable.filter((view) => !asleep(view));
    return awake.length
      ? { calls: callsOf(awake, PLAYS), expect: 'playing' }
      : { calls: callsOf(usable, WAKES) };
  }
  return {
    calls: callsOf(usable, [[on ? 'turn_off' : 'turn_on', 0]]),
    expect: on ? 'off' : 'on',
  };
}

/** Every call of a round's at once, its members drawn as they will be. */
function perform(host: RoundsHost, flip: Flip): void {
  for (const { domain, service, ids } of flip.calls) {
    if (flip.expect) for (const id of ids) host.expect(id, flip.expect);
    host.call(domain, service, { entity_id: [...ids] });
  }
}

/**
 * The rounds Home Assistant's dialog asks about, each by the very action handed to it: its yes hands that action back.
 * An action answered no is Home Assistant's to drop, and the question goes with it.
 */
const asked = new WeakMap<object, () => void>();
/** Whether the window hears the yes Home Assistant fires from its root: from the first question on, once. */
let hearing = false;

/**
 * Home Assistant's yes: its `fire-dom-event` comes back as `ll-custom`, from its root on 2026.9 (it bubbles to the
 * window, never through the card) and from the card that asked on later frontends (which hears it on itself, in the
 * page or drawn anew since); only the action it asked about moves its round, and only once.
 */
export function answered(event: Event): void {
  // any other `ll-custom` (a frontend integration's, a page's) is no question of the rounds'
  const action = (event as CustomEvent<object>).detail;
  const yes = asked.get(action);
  if (!yes) return;
  asked.delete(action);
  yes();
}

/**
 * Asks Home Assistant's own dialog before `yes` runs, in the words `confirmation` says, else `text`: one
 * `fire-dom-event` it hands back once answered yes (`answered`), nothing moving before — what several calls are asked
 * about as one with (a round's members, a card's All off).
 */
export function askFirst(
  host: Pick<RoundsHost, 'run'>,
  confirmation: true | ActionConfirmation,
  text: string,
  yes: () => void,
): void {
  const own = typeof confirmation === 'object' ? confirmation : {};
  const action: ActionConfig = {
    action: 'fire-dom-event',
    confirmation: { ...own, text: own.text ?? text },
  };
  asked.set(action, yes);
  if (!hearing) {
    window.addEventListener('ll-custom', answered);
    hearing = true;
  }
  host.run(action, undefined);
}

/**
 * Runs a round's on and off: every call at once; or, asked first (`confirmation`), once Home Assistant's own dialog
 * has its answer, nothing moving before. One call goes to it whole (its words, where the tap says none, name its
 * service); several are asked about as one (`askFirst`), so every member is (a blind that only tilts beside blinds that
 * close as well), its words where the tap says none Home Assistant's sentence naming the round ("Are you sure you want
 * to run action "Blinds"?"), else the round's name.
 */
function runFlip(
  host: RoundsHost,
  flip: Flip,
  confirmation: ActionConfig['confirmation'],
  name: string,
): void {
  if (!confirmation) return perform(host, flip);
  const [first, ...rest] = flip.calls;
  if (!first) return;
  if (!rest.length)
    return host.run(
      {
        action: 'perform-action',
        perform_action: `${first.domain}.${first.service}`,
        target: { entity_id: [...first.ids] },
        confirmation,
      },
      undefined,
    );
  const key = 'ui.panel.lovelace.cards.actions.action_confirmation';
  const said = host.hass?.localize?.(key, { action: name });
  askFirst(host, confirmation, said && said !== key ? said : name, () => perform(host, flip));
}

/** The domains a round turns on and off itself (`flipOf`), all of a set at once; the rest by the house's toggle. */
const FLIPS: ReadonlySet<string> = new Set([
  'light',
  'switch',
  'fan',
  'cover',
  'media_player',
  'input_boolean',
  'humidifier',
]);

const MORE_INFO: ActionConfig = { action: 'more-info' };
const TOGGLE: ActionConfig = { action: 'toggle' };

/**
 * What a round's tap does, its entity of `domain`: its own, else on and off where its card's rule flips its kind (every
 * set does), else its details.
 */
export const roundTap = (
  host: Pick<RoundsHost, 'toggles'>,
  item: RoundSpec,
  domain: string,
): ActionConfig =>
  item.tap_action ??
  ((item.group && item.group !== 'entity') || (host.toggles ?? ROUND_TOGGLE).has(domain)
    ? TOGGLE
    : MORE_INFO);

/** A round as drawn, and its state's forms where it says it (longest first). */
export type Round = LevelRound & { readonly said?: readonly string[] | undefined };

/**
 * A round as drawn: its name and glyph (its set's, else its entity's), on while any of it is, its ring the level of
 * all of it (an off one at 0: the room's light as a share of all it could give, its blinds' mean position), its colour
 * (a set of lights in what is lit, as the room's lights' row; else its own, else its kind's), its tap (on and off where
 * its card's rule flips its kind — every set, and what `toggles` names — else its details; none where none of it can,
 * and then it is drawn as one that cannot), its hold (its details) and, where it says it (its own `show_state`, else
 * its card's), its state.
 */
export function roundOf(host: RoundsHost, item: RoundSpec): Round {
  const { hass, look } = host;
  const group = item.group === 'entity' ? undefined : item.group;
  const ids = group ? membersOf(host, group) : [item.entity ?? ''];
  const views = ids.map((id) => resolveEntity(hass, id));
  const first = views[0] ?? resolveEntity(hass, undefined);
  // the room's lights (a lamp on a plug among them), or a light of its own
  const light = group ? group === 'lights' : first.domain === 'light';
  const lit = (view: EntityView): boolean =>
    isUsable(view) && isActiveState(view.domain, host.state(view));
  // a set of lights counts each lamp once (a group in the room is its members)
  const lamps = light ? lampsOf(ids, hass).map((id) => resolveEntity(hass, id)) : views;
  const on = views.some(lit);
  const level =
    lamps.reduce((sum, view) => sum + (lit(view) ? levelOf(view) : 0), 0) / lamps.length;
  const glow =
    light && on && (look?.light_colors ?? lightDefaults().colors)
      ? group
        ? meanHex(lamps, look?.light_whites)
        : litColour(first, true, look?.light_whites, hass)
      : undefined;
  const [colour, tone] = light
    ? lightLook(item, look, glow)
    : [item.color, statusToneOf(item, toneFor(first))];
  const single = ids.length === 1 ? ids[0] : undefined;
  // what its actions are for: its own entity, else its one member; a set of several has none
  const own = item.entity ?? single;
  /**
   * An action of the round's, where it can run: a set of several's details are where the room opens, whose page lists
   * them as a group's own dialog lists its members (Home Assistant has no dialog for entities that are no group).
   */
  const runs = (action: ActionConfig): (() => void) | undefined => {
    const run =
      action.action === 'more-info' && !action.entity && !own && host.destination
        ? { ...action, action: 'navigate' as const, navigation_path: host.destination }
        : action;
    return actionRuns(run, own) ? () => host.run(run, own) : undefined;
  };
  const tap = roundTap(host, item, first.domain);
  // its own on and off where its tap toggles it, asked first or not
  const flip =
    tap.action === 'toggle' && !tap.entity && FLIPS.has(first.domain)
      ? flipOf(first.domain, views, on)
      : undefined;
  const name = group
    ? (textName(item.name) ?? localize(hass, LOOKS[group][0]))
    : (host.name?.(first, item.name) ?? entityName(hass, first, item.name));
  const ring = on ? Math.max(1, Math.round(level)) : 0;
  // its state where it says it: the level its ring draws where a person reads one (a set of several lights, blinds or
  // fans; one that says its brightness, position or speed), else Home Assistant's words
  const says = item.show_state ?? look?.states ?? false;
  const levelled =
    on &&
    (lamps.length > 1
      ? group !== 'media'
      : LEVELLED.has(first.domain) && levelIn(first) !== undefined);
  // a reading (never on) that names its own tone or colour wears it, drawn as lit
  const toned =
    says &&
    isUsable(first) &&
    !isActiveState(first.domain, 'on') &&
    Boolean(item.tone ?? item.color);
  return {
    name,
    glyph: item.icon ?? (group && !single ? LOOKS[group][1] : iconOf(first)),
    usable: views.some(isUsable),
    on: on || toned,
    level: ring,
    said: says ? saidOf(host, views, levelled ? ring : undefined) : undefined,
    tone,
    accent: host.accent(colour),
    switches: flip !== undefined,
    // a set none of whose members takes its call reads as it is and takes no tap; two taps its double where set
    onTap: host.tapper(
      item.double_tap_action,
      `quick_${own ?? group}`,
      flip
        ? flip.calls.length > 0
          ? () => runFlip(host, flip, tap.confirmation, name)
          : undefined
        : runs(tap),
      item.double_tap_action && runs(item.double_tap_action),
    ),
    onHold: runs(item.hold_action ?? MORE_INFO),
  };
}

/**
 * The pills a round grows into where it says its state (#205), the rounds' own sheet: adopted by the card that draws
 * one (`wear`), so a house of rounds never pays for it.
 */
const PILLS = css`
  /* the round grown into a pill of its own fill as wide as the card sets it (on the 4 grid, its words never cut), its
     glyph where the round has it and its words 8 after it */
  .lt-bulb--said {
    flex: none;
    justify-content: flex-start;
    gap: 8px;
    padding-left: 12px;
    border-radius: var(--fluvy-radius-pill, 9999px);
  }
  .lt-bulb--said::before {
    border-radius: inherit;
  }
  /* its words set as a value (15/600, tabular figures): the text's ink at rest, the fill's lit, the secondary ink out
     of reach */
  .lt-said {
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--fluvy-text);
  }
  .lt-bulb.is-on .lt-said {
    color: inherit;
  }
  .fv-ico--off .lt-said {
    color: var(--fluvy-text-secondary);
  }
  /* …or under its glyph: a pill 64 tall and as wide as its words with 6 a side (44 the least), its words 4 under the
     glyph in 12/600 on their 16 line; a room's rounds all at the block's top, the glyphs on one line, and on the photo
     the pills' feet on the name pill's, 16 from the foot */
  .lt-bulb.lt-bulb--under {
    flex-direction: column;
    gap: 4px;
    height: 64px;
    padding: 12px 0 0;
  }
  .lt-bulb--under .lt-said {
    font-size: 12px;
    line-height: 16px;
  }
  .rm-quick--under {
    align-items: flex-start;
    height: 64px;
  }
  .rm-hero > .rm-quick--under {
    bottom: 16px;
  }
`;

/** The pills' sheet on the card's root, after its own, once. */
export function wear(root: Node | undefined): void {
  const sheet = PILLS.styleSheet;
  if (root instanceof ShadowRoot && sheet && !root.adoptedStyleSheets.includes(sheet))
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}

/** A state's words beside its glyph, and under it, as the pills' sheet sets them. */
const BESIDE = 'lt-said';
const UNDER = 'lt-bulb--under > lt-said';
/** What a pill adds to its words: beside, the glyph's 12 and 20 and 8 after it, and 16 after them; under, 6 a side. */
const BESIDE_SIDES = 56;
const UNDER_SIDES = 12;

/** A state's pill, on the 4 grid: never narrower than its round, its words under its glyph or beside it. */
export const pillWidth = (host: RoundsHost, text: string, under: boolean): number =>
  Math.max(
    ROUND,
    under ? host.ruler.pill(UNDER, text, UNDER_SIDES) : host.ruler.pill(BESIDE, text, BESIDE_SIDES),
  );

/**
 * The states that hold in `room` (what the rounds leave), each by what its pill adds to its round (`grows`): every
 * one in the longest of its forms they all hold in (one with fewer forms in its shortest), the last ones left out
 * where even their shortest do not hold.
 */
export function statesIn(
  rounds: readonly Round[],
  room: number,
  grows: (text: string) => number,
): (string | undefined)[] {
  const asked = rounds.flatMap((round, index) => (round.said ? [index] : []));
  const forms = Math.max(0, ...rounds.map((round) => round.said?.length ?? 0));
  for (let kept = asked.length; kept > 0; kept--)
    for (let form = 0; form < forms; form++) {
      const states = rounds.map(({ said }, index) =>
        said && asked.indexOf(index) < kept ? said[Math.min(form, said.length - 1)] : undefined,
      );
      if (states.reduce((sum, state) => sum + (state ? grows(state) : 0), 0) <= room) return states;
    }
  return [];
}

/**
 * A round drawn with the state it says (none: a round), its pill as wide as its words need, or `width` (the Rounds
 * card's keys, one width a card).
 */
export const drawRound = (
  host: RoundsHost,
  round: Round,
  text: string | undefined,
  under: boolean,
  width = text ? pillWidth(host, text, under) : 0,
): TemplateResult => levelRound({ ...round, state: text ? { text, width, under } : undefined });

/** How many rounds a line's `room` holds: 44 each, 8 apart, 12 after what is before them. */
export const roundsHeld = (room: number): number =>
  Math.max(0, Math.floor((room - 12 + ROUND_GAP) / (ROUND + ROUND_GAP)));

/** What `count` rounds take of their line (`roundsHeld`'s other way round): 44 each, 8 apart, and the 12 before them. */
export const roundsTaken = (count: number): number => 12 + count * (ROUND + ROUND_GAP) - ROUND_GAP;

/**
 * Rounds on one line in `room` (`roundsHeld`): as many as it holds, in their order;
 * then the states asked for in the room they leave (#205), each round that says one grown into the pill that holds
 * it — under its glyph (as wide as its words, 44 the least), or beside it (`beside`: as tall as a round) — in the
 * longest forms that hold (`statesIn`): a state that does not is left out whole, its round a round again. With a
 * state under its glyph every round stands at the block's top (none drawn: centred, as ever); the block ends its
 * line wherever it stands, its words placed from that end.
 */
export function roundsIn(
  host: RoundsHost,
  items: readonly RoundSpec[],
  room: number,
  under = host.look?.beside !== true,
): RoundsBlock {
  const rounds = items.slice(0, roundsHeld(room)).map((item) => roundOf(host, item));
  if (!rounds.length) return { taken: 0, template: nothing };
  // their words are measured in the pills' sheet, which the card wears from the first state asked for
  if (rounds.some((round) => round.said)) wear(host.root);
  const grows = (text: string): number => pillWidth(host, text, under) - ROUND;
  const taken = roundsTaken(rounds.length);
  const states = statesIn(rounds, room - taken, grows);
  return {
    taken: states.reduce((sum, state) => sum + (state ? grows(state) : 0), taken),
    template: html`<div
      class="lt-bulbs rm-quick ${under && states.some(Boolean) ? 'rm-quick--under' : ''}"
      data-align="end"
    >
      ${rounds.map((round, index) => drawRound(host, round, states[index], under))}
    </div>`,
  };
}
