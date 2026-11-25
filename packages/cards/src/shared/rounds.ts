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
import type { Own } from './own-values.js';
import { shorterForms } from './secondary.js';
import { levelRound, ROUND, ROUND_GAP, type LevelRound } from './round.js';
import type { GaugeStyle } from './round-gauge.js';
import type { Band, ThresholdItem } from './thresholds.js';

/*
 * Rounds (#113, #224): an entity, or one of a room's sets, as a 44 round — lit in its tone with a ring of its level
 * while on, the dashed ring out of reach — whose tap turns it on and off and whose hold opens it, saying its state in a
 * pill or a key where asked (#205), its reading drawn on it as a gauge where it names one (#257, `round-gauge.ts`).
 * One engine for every card that draws them: a room's quick actions, the Rounds card, a row's rounds
 * (`rounds-row.ts`), a line of them across a card (`roundsAcross`). Its own chunk with the room's quick actions
 * (`quick-actions`), fetched with the families as the bundle starts.
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
  /**
   * Its reading drawn on it as a gauge (1.26, #257): an arc round its edge, an arc from zero, a sector, a flood; none
   * by default. An entity's round alone: a set has no one reading.
   */
  gauge?: GaugeStyle;
  /**
   * The gauge's range, each a number, an entity or a template: the entity's own `min` and `max` by default, 0 to 100
   * for a share (a percentage, a battery, a humidity); from zero, `min` is `max` below it. None known, its track alone.
   */
  min?: number | string;
  max?: number | string;
  /** The decimals its reading is said and shown in, 0 to 3; default: the entity's own. */
  decimals?: number;
  /** An attribute its reading is read from, in its state's place (`current_temperature`, `battery_level`). */
  attribute?: string;
  /** The gauge's thresholds: its reading's band colours it, its icon is the round's and its label is said. */
  thresholds?: readonly ThresholdItem[];
}

/** What a round's gauge asks of its card (every `Card`): a figure of its own, a reading's band, another draw. */
export interface GaugeCard {
  ownFigure(raw: unknown, unit: string, entityId?: string): Own<number>;
  band(own: object | undefined, view: EntityView, reading?: number | null): Band | undefined;
  requestUpdate(): void;
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
  /** The card's root, which wears the rounds' sheet once a state is said, and the gauges' once one is drawn. */
  readonly root: Node | undefined;
  /**
   * The card itself, where its rounds may draw a gauge (1.26, #257): a range that names an entity or a template, and
   * thresholds, are read through it; none, a gauge reads its range's numbers alone.
   */
  readonly card?: GaugeCard | undefined;
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
  const forms = figureForms(value, unit);
  // a figure keeps its unit in every form: the degree alone, a count's short words with the unit it was written in
  return forms.length > 1
    ? forms
    : [
        ...forms,
        ...shorterForms(hass, view, forms[0] ?? '').filter(
          (form) => unit && form.endsWith(` ${unit}`),
        ),
      ];
}

/**
 * A figure and its unit in the forms a round says them in, longest first: whole, then a temperature's or an angle's
 * with its degree alone ("21.5°") — never a rate's, whose unit says more ("0.4 °C/h").
 */
export const figureForms = (figure: string, unit: string): string[] =>
  !unit
    ? [figure]
    : /^°[CF]?$/.test(unit)
      ? [`${figure} ${unit}`, `${figure}°`]
      : [`${figure} ${unit}`];

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

/**
 * A round as drawn, its state's forms where it says it (longest first), and what a reader hears of its state where it
 * draws a gauge (its reading and its band's name), said or not.
 */
export type Round = LevelRound & {
  readonly said?: readonly string[] | undefined;
  readonly heard?: string | undefined;
};

/**
 * What draws a round's gauge (`round-gauge.ts`, a chunk of its own, 1.26, #257), once the first card whose rounds
 * name one has fetched it; `null` where it cannot be fetched: its rounds then stay rounds.
 */
let gauges: typeof import('./round-gauge.js') | null | undefined;
let fetchingGauges: Promise<void> | undefined;

/** The gauges' fetch, the first frame of a card that names one waiting on it (`Card.wearing`); none once it is over. */
export const gaugesLanding = (): Promise<void> | undefined =>
  gauges === undefined
    ? (fetchingGauges ??= import('./round-gauge.js').then(
        (module) => {
          gauges = module;
        },
        () => {
          gauges = null;
        },
      ))
    : undefined;

/**
 * The gauge an entity's round names, as read now: none where it names none (or a style there is none of), where the
 * entity is out of reach (its dashed ring says so), or while the gauges are on their way — its card, where it gave
 * itself, draws again as they land (one named after its first frame: an editor's).
 */
function gaugeOf(host: RoundsHost, item: RoundSpec, view: EntityView) {
  if (!item.gauge || !isUsable(view)) return undefined;
  if (!gauges) {
    void gaugesLanding()?.then(() => host.card?.requestUpdate());
    return undefined;
  }
  if (!gauges.GAUGES.includes(item.gauge)) return undefined;
  gauges.wearGauge(host.root);
  return gauges.readGauge(host, item, view);
}

/**
 * A round as drawn: its name and glyph (its set's, else its entity's), on while any of it is, its ring the level of
 * all of it (an off one at 0: the room's light as a share of all it could give, its blinds' mean position), its colour
 * (a set of lights in what is lit, as the room's lights' row; else its own, else its kind's), its tap (on and off where
 * its card's rule flips its kind — every set, and what `toggles` names — else its details; none where none of it can,
 * and then it is drawn as one that cannot), its hold (its details) and, where it says it (its own `show_state`, else
 * its card's), its state; and its gauge where it names one (#257), whose band's tone, colour and icon are the round's
 * and whose reading a reader always hears.
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
    return actionRuns(run, own, hass) ? () => host.run(run, own) : undefined;
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
  // its gauge, an entity's alone: its band's tone and colour are the round's, its icon the round's glyph
  const gauge = group ? undefined : gaugeOf(host, item, first);
  const band = gauge?.band;
  const worn = band?.tone ?? tone;
  const accent = band ? band.accent : host.accent(colour);
  // a reading (never on) that names its own tone or colour wears it, drawn as lit; with a gauge, its gauge wears it
  const toned =
    says &&
    !gauge &&
    isUsable(first) &&
    !isActiveState(first.domain, 'on') &&
    Boolean(item.tone ?? item.color);
  const states =
    says || gauge ? (gauge?.said ?? saidOf(host, views, levelled ? ring : undefined)) : undefined;
  return {
    name,
    glyph: band?.icon ?? item.icon ?? (group && !single ? LOOKS[group][1] : iconOf(first)),
    usable: views.some(isUsable),
    on: on || toned,
    level: ring,
    said: says ? states : undefined,
    heard: gauge && [states?.[0], band?.label].filter(Boolean).join(', '),
    gauge: gauge && item.gauge && gauges?.drawGauge(item.gauge, gauge.fraction, worn, accent),
    tone: worn,
    accent,
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
 * What a round grows into where it says its state (#205), the rounds' own sheet: a pill, its words beside its glyph,
 * or a key, its words under it. Adopted by the card that draws one (`wear`), so a house of rounds never pays for it.
 */
const PILLS = css`
  /* the round grown into a pill of its own fill as wide as the card sets it (on the 4 grid), its glyph where the
     round has it and its words 8 after it */
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
  /* a state's word its key cannot hold ends in an ellipsis (\`keyStates\`); a figure is never cut */
  .lt-bulb > .lt-said {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .lt-bulb.is-on .lt-said {
    color: inherit;
  }
  .fv-ico--off .lt-said {
    color: var(--fluvy-text-secondary);
  }
  /* …or under its glyph, a key: 64 tall at a tappable's radius, its glyph 12 from its top on the rounds' glyph line,
     its words 4 under it in 12/600 on their 16 line and 12 from its foot — and 12 from each of its sides, 8 where
     their line is tight (the card sets its width; the radius leaves the words a straight side). A room's rounds all at
     the block's top, the glyphs on one line, and on the photo the keys' feet on the name pill's, 16 from the foot */
  .lt-bulb.lt-bulb--under {
    flex-direction: column;
    gap: 4px;
    height: 64px;
    padding: 12px 8px 0;
    border-radius: var(--fluvy-radius-control);
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
  /* rounds across a line (\`roundsAcross\`): each in the middle of its share of it, as a row of controls (and of
     its line's height, where the line keeps a key's for a state past what it holds); where one says its state, every
     cell a key 8 from the next, the first and the last flush with the line's ends — a pill's glyph and words in its
     middle, 8 from its sides at the least */
  .lt-bulbs--across {
    flex: 1 1 auto;
    align-items: center;
    justify-content: space-around;
    gap: 0;
  }
  .lt-bulbs--keys {
    flex: 1 1 auto;
  }
  .lt-bulbs--keys > .lt-bulb--said:not(.lt-bulb--under) {
    justify-content: center;
    padding: 0 8px;
  }
  /* a key of the line with no word (it says none, or its figure does not fit) holds its glyph in its middle, never
     over an empty foot */
  .lt-bulbs--keys > .lt-bulb--bare.lt-bulb--under {
    justify-content: center;
    padding-top: 0;
  }
  .lt-bulbs--keys > .lt-bulb--bare > .lt-said {
    display: none;
  }
`;

/** The rounds' sheet on the card's root, after its own, once. */
export function wear(root: Node | undefined): void {
  const sheet = PILLS.styleSheet;
  if (root instanceof ShadowRoot && sheet && !root.adoptedStyleSheets.includes(sheet))
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}

/** A state's words beside its glyph, and under it, as the rounds' sheet sets them. */
const BESIDE = 'lt-said';
const UNDER = 'lt-bulb--under > lt-said';
/** What a pill adds to its words: the glyph's 12 and 20 and 8 after it, and 16 after them. */
const BESIDE_SIDES = 56;
/**
 * What a key keeps clear beside its words, widest first: 12 a side, then 8 where their line is tight (the owner's
 * review of 1.25: no word against an edge).
 */
const KEY_SIDES = [24, 16] as const;
/** A key's least width where the card sets it: as wide as it is tall, never a sliver. */
export const KEY = 64;
/** …and a pill's, its words beside its glyph: the glyph and its 8, the 12 a side, and words a little over a round's. */
export const KEY_BESIDE = 96;
/** What stands before a pill's words where the card centres both in it: its glyph and the 8 after it. */
const GLYPH = 28;

/**
 * A state's pill or key, on the 4 grid: never narrower than its round, its words beside its glyph or under it with
 * `sides` clear beside them in all (a key's 12 a side where none is said).
 */
export const pillWidth = (
  host: RoundsHost,
  text: string,
  under: boolean,
  sides: number = under ? KEY_SIDES[0] : BESIDE_SIDES,
): number => Math.max(ROUND, host.ruler.pill(under ? UNDER : BESIDE, text, sides));

/** A state's key where the card sets its keys' width: its words 12 from each side, 64 the least. */
export const keyWidth = (host: RoundsHost, text: string): number =>
  Math.max(KEY, pillWidth(host, text, true));

/** Each round's state in its `form`-th form (one with fewer forms in its shortest); none where it says none. */
const formed = (rounds: readonly Round[], form: number): (string | undefined)[] =>
  rounds.map(({ said }) => said?.[Math.min(form, said.length - 1)]);

/** How many forms the round with the most says its state in. */
const formsOf = (rounds: readonly Round[]): number =>
  Math.max(0, ...rounds.map((round) => round.said?.length ?? 0));

/**
 * The states that hold in `room` (what the rounds leave) and what each keeps clear beside its words (`sides`), by what
 * it adds to its round: every one in the longest of its forms they all hold in (one with fewer forms in its
 * shortest), a key's words 12 from each of its sides, else 8; the last ones left out where even their shortest do not
 * hold.
 */
export function statesIn(
  host: RoundsHost,
  rounds: readonly Round[],
  room: number,
  under: boolean,
): { readonly states: (string | undefined)[]; readonly sides: number } {
  const asked = rounds.flatMap((round, index) => (round.said ? [index] : []));
  const forms = formsOf(rounds);
  for (let kept = asked.length; kept > 0; kept--)
    for (const sides of under ? KEY_SIDES : [BESIDE_SIDES])
      for (let form = 0; form < forms; form++) {
        const states = formed(rounds, form).map((state, index) =>
          asked.indexOf(index) < kept ? state : undefined,
        );
        const grown = states.reduce(
          (sum, state) => sum + (state ? pillWidth(host, state, under, sides) - ROUND : 0),
          0,
        );
        if (grown <= room) return { states, sides };
      }
  return { states: [], sides: 0 };
}

/**
 * The states of keys the card sets `key` wide, each round's (none: it says none), their words under their glyphs, or
 * beside them in a pill — the ladder a key's words go down (the owner's review of 1.25): every one in the longest of
 * its forms they all hold in 12 from each side of their keys, else 8; else each in its own longest that holds; else a
 * word ends in an ellipsis 8 from the sides (its key cuts it), and a figure is never cut: its key shows its glyph
 * alone (''), its state still said to a reader.
 */
export function keyStates(
  host: RoundsHost,
  rounds: readonly Round[],
  key: number,
  under = true,
): (string | undefined)[] {
  const room = key - (under ? 0 : GLYPH);
  const holds = (text: string, sides: number): boolean =>
    host.ruler.width(under ? UNDER : BESIDE, text) <= room - sides;
  const forms = formsOf(rounds);
  for (const sides of KEY_SIDES)
    for (let form = 0; form < forms; form++) {
      const states = formed(rounds, form);
      if (states.every((state) => state === undefined || holds(state, sides))) return states;
    }
  return rounds.map(
    ({ said }) =>
      said &&
      (KEY_SIDES.map((sides) => said.find((text) => holds(text, sides))).find(Boolean) ??
        (said.some((text) => /\d/.test(text)) ? '' : said[0])),
  );
}

/**
 * What a reader hears for a round: its name, and its state whole where it is asked to say it, drawn or not; a
 * gauge's reading always, and its band's name ("Drift, −0.24 °C/h, Cooling").
 */
export const spoken = ({ name, said, heard }: Round): string => {
  const state = heard ?? said?.[0];
  return state ? `${name}, ${state}` : name;
};

/**
 * A round drawn with the state it says (none: a round; '': its key or its pill with its glyph alone), as wide as its
 * words need, or `width` (keys the card sets: the Rounds card's, one width a card; the Vehicle card's, its cells').
 */
export const drawRound = (
  host: RoundsHost,
  round: Round,
  text: string | undefined,
  under: boolean,
  width = text ? pillWidth(host, text, under) : 0,
): TemplateResult =>
  levelRound({
    ...round,
    label: spoken(round),
    state: text === undefined ? undefined : { text, width, under },
  });

/** How many rounds a line's `room` holds: 44 each, 8 apart, 12 after what is before them. */
export const roundsHeld = (room: number): number =>
  Math.max(0, Math.floor((room - 12 + ROUND_GAP) / (ROUND + ROUND_GAP)));

/** What `count` rounds take of their line (`roundsHeld`'s other way round): 44 each, 8 apart, and the 12 before them. */
export const roundsTaken = (count: number): number => 12 + count * (ROUND + ROUND_GAP) - ROUND_GAP;

/**
 * Rounds on one line in `room` (`roundsHeld`): as many as it holds, in their order;
 * then the states asked for in the room they leave (#205), each round that says one grown into what holds it — a
 * key, its words under its glyph (as wide as its words and their sides, 44 the least), or a pill, its words beside it
 * (`beside`: as tall as a round) — in the longest forms that hold (`statesIn`): a state that does not is left out
 * whole, its round a round again. With a state under its glyph every round stands at the block's top (none drawn:
 * centred, as ever); the block ends its line wherever it stands, its words placed from that end.
 */
export function roundsIn(
  host: RoundsHost,
  items: readonly RoundSpec[],
  room: number,
  under = host.look?.beside !== true,
): RoundsBlock {
  const rounds = items.slice(0, roundsHeld(room)).map((item) => roundOf(host, item));
  if (!rounds.length) return { taken: 0, template: nothing };
  // their words are measured in the rounds' sheet, which the card wears from the first state asked for
  if (rounds.some((round) => round.said)) wear(host.root);
  const taken = roundsTaken(rounds.length);
  const { states, sides } = statesIn(host, rounds, room - taken, under);
  const widths = states.map((state) => (state ? pillWidth(host, state, under, sides) : ROUND));
  return {
    taken: widths.reduce((sum, width) => sum + width - ROUND, taken),
    template: html`<div
      class="lt-bulbs rm-quick ${under && states.some(Boolean) ? 'rm-quick--under' : ''}"
      data-align="end"
    >
      ${rounds.map((round, index) => drawRound(host, round, states[index], under, widths[index]))}
    </div>`,
  };
}

/**
 * Rounds across a line `width` wide (the Vehicle card's foot, the greeting's quick actions; the owner's reviews of
 * 1.25 and 1.26): equal cells, as many as hold — by the list and the width alone, never by what the rounds read —
 * those that do not giving way from the end. None asked to say its state, each round stands in the middle of its
 * share of the line, as a row of controls does; one asked, every cell is a key 8 from the next (a pill, its words
 * beside its glyph: `beside`), the first and the last flush with the line's ends, 64 wide at the least (a pill 96),
 * its words down the keys' ladder (`keyStates`). The keys are for a line that draws one that says its state: where
 * the first to ask stands past the keys the line holds, the rounds before it are rounds, never keys with no word.
 */
export function roundsAcross(
  host: RoundsHost,
  items: readonly RoundSpec[],
  width: number,
  under = host.look?.beside !== true,
): TemplateResult | typeof nothing {
  const held = (least: number): number =>
    Math.min(items.length, Math.max(1, Math.floor((width + ROUND_GAP) / (least + ROUND_GAP))));
  const first = items.findIndex((item) => item.show_state ?? host.look?.states ?? false);
  const cells = held(under ? KEY : KEY_BESIDE);
  const keys = first >= 0 && first < cells;
  const count = keys ? cells : Math.min(held(ROUND), first < 0 ? items.length : first);
  const rounds = items.slice(0, count).map((item) => roundOf(host, item));
  if (!count) return nothing;
  wear(host.root);
  if (!keys)
    return html`<div class="lt-bulbs lt-bulbs--across" data-align="center">
      ${rounds.map((round) => drawRound(host, round, undefined, under))}
    </div>`;
  const key = Math.floor((width - (count - 1) * ROUND_GAP) / count);
  const states = keyStates(host, rounds, key, under);
  return html`<div class="lt-bulbs lt-bulbs--keys" data-fill-row>
    ${rounds.map((round, index) => drawRound(host, round, states[index] ?? '', under, key))}
  </div>`;
}
