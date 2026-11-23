// the card's own words first: here before it speaks, wherever its module is loaded
import './english.js';
import {
  areaOf,
  formatNumber,
  isUsable,
  itemsOf,
  listedName,
  localize,
  offCall,
  plural,
  type ActionConfig,
  type EntityName,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceGridOptions,
} from '@fluvy/core';
import {
  addGlyphs,
  head,
  options,
  sheetStyles,
  stepper,
  type DialChangeDetail,
  type OptionItem,
  type Tone,
} from '@fluvy/ui';
import { ROOM_GLYPHS, ROOM_ICONS } from '@fluvy/ui/glyph-sets/rooms';
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import { HeadFit } from '../energy/head.js';
import { Card, MORE_INFO, type CardEditor } from '../shared/base.js';
import { chipRow, type Choice } from '../shared/chips.js';
import { statusToneOf } from '../shared/colour.js';
import type { AliasSpec } from '../shared/config.js';
import { iconOf } from '../shared/domain.js';
import { modeWord } from '../shared/mode-words.js';
import {
  roundsRoom,
  roundsRow,
  roundsRowsKeepIcon,
  type RoundsRowSpec,
} from '../shared/rounds-row.js';
import {
  answered,
  askFirst,
  roundsHeld,
  roundsOf,
  type RoundSpec,
  type RoundsHost,
} from '../shared/rounds.js';
import { setpoint, type Doing } from '../thermostat/doing.js';
import { STEPPER_HALVES } from '../shared/value-row.js';
import {
  stepTarget,
  TARGET_SIDES,
  TARGET_VALUE,
  targetCall,
  thermostatModel,
  type ThermostatModel,
} from '../thermostat/thermostat-card.js';
import {
  hasHead,
  houseActions,
  thermostatsHeight,
  TILE,
  TILE_GAP,
  type HouseAction,
} from '../thermostats-family.js';
import { houseThermostats, presetLabel, presetsOffered } from './house.js';

// the rooms' glyphs, drawn as the set's own strokes: an area's icon (`mdi:sofa`) is its room's (`fluvy:living-room`)
addGlyphs(ROOM_GLYPHS);

/** `rows` (default): a list row each. `compact`: the 48 row, its name and its figure. `tiles`: two a row. */
export type ThermostatsVariant = 'rows' | 'compact' | 'tiles';
export const THERMOSTATS_VARIANTS: readonly ThermostatsVariant[] = ['rows', 'compact', 'tiles'];
/** What a row ends in: the room's temperature (`none`, default), or the target between − and + (`stepper`). */
export type ThermostatsControl = 'none' | 'stepper';
export const THERMOSTATS_CONTROLS: readonly ThermostatsControl[] = ['none', 'stepper'];
/** What the card does for every thermostat at once, where asked: All off, and the presets they offer. */
export const HOUSE_ACTIONS: readonly HouseAction[] = ['all_off', 'presets'];

/** One thermostat: its entity, its own name, icon and colour, its own rounds after its own, and its actions. */
export interface ThermostatItem {
  entity: string;
  name?: EntityName;
  icon?: string;
  tone?: Tone;
  color?: string;
  /** Rounds of its own after the one that opens it: a schedule's view, a window's sensor (#230). */
  rounds?: readonly (string | RoundSpec)[];
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

export interface ThermostatsCardConfig extends FluvyCardConfig {
  /** The thermostats, in their order; none, the climates of `area`, else of the house, in the house's order. */
  thermostats?: readonly (string | ThermostatItem)[];
  area?: string;
  /** A head over the list (its title: "Thermostats" where it says how many heat or the average alone). */
  title?: string;
  /** "3 of 5 heating" under the title. */
  show_count?: boolean;
  /** The average of what the rooms measure under the title ("20.4° average"). */
  show_average?: boolean;
  variant?: ThermostatsVariant;
  control?: ThermostatsControl;
  /** The round that opens each one's details (default); its own rounds after it stay. */
  show_round?: boolean;
  /** All off and the presets, in this order, as chips over the list. */
  house_actions?: readonly HouseAction[];
}

/** A thermostat as its row and its tile draw it. */
interface Unit {
  readonly item: ThermostatItem;
  readonly view: EntityView;
  readonly m: ThermostatModel;
  readonly usable: boolean;
  readonly name: string;
  readonly glyph: string;
  /** What it is doing (`doing`), and whether that is anything: heating, cooling, a window open. */
  readonly said: Doing;
  readonly running: boolean;
  /** What the room measures, as a row ends in it ("20.5°"; "—" out of reach); none where it measures nothing. */
  readonly current: string | undefined;
}

/** A tile narrower than this has no room for its figure beside its name's floor: the tiles take one a row. */
const TILE_MIN = 120;
/** An option tile's sides, 12 each. */
const TILE_SIDES = 24;
const ALL_OFF = 'all_off';
/** A filled chip's words, measured in their own classes, and the pill's 8 on each side of them. */
const FILLED_CHIP = 'fv-chips fv-chips--fill > fv-chip > fv-chip__pill';
const FILLED_CHIP_SIDES = 16;
const PRESET = 'preset:';

/**
 * Every thermostat of a house, a room or a list in one card (#230, requested by @xoatrash, with @waphbs's house-card
 * prototype, #219): a row each — its room's glyph in what it is doing's tone, its room's name, what it is doing, its
 * preset and its target, and what the room measures — its rounds at its end, the first opening its details; the target
 * between − and + where asked, a unit's own range and step; as compact rows or as tiles. Over them, where asked, how
 * many heat and the house's average, and All off and the presets for every thermostat at once, each as the unit takes
 * it: never a power change by a preset, never a mode of its own.
 */
export class FluvyThermostatsCard extends Card<ThermostatsCardConfig> {
  /** The card's height at a 360 column from its config alone (`thermostatsHeight`). */
  static override layoutHeight(config: ThermostatsCardConfig): number {
    return thermostatsHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.rooms,
    css`
      /* the house's actions: 16 under the head (12 and the chip's own 4), on the card's top else */
      .ts-actions {
        margin-top: -4px;
      }
      .fv-card__head + .ts-actions {
        margin-top: 12px;
      }
      .ts-actions > .fv-chips {
        margin-top: 0;
      }
      /* the list: its circles 16 under what is above them (a row's own 8; a compact row's rounds and pill, 44 in its
         48, 2; a tile's none) and 20 over the card's foot, its top and foot the card's padding where nothing is above
         it */
      .ts-list {
        --ts-inside: 8px;
        margin: calc(0px - var(--ts-inside)) 0;
      }
      .ts-list--compact {
        --ts-inside: 2px;
      }
      .ts-list--tiles {
        --ts-inside: 0px;
      }
      .ts-list--tiles > .fv-options {
        margin-top: 0;
      }
      .fv-card__head + .ts-list {
        margin-top: calc(16px - var(--ts-inside));
      }
      .ts-actions + .ts-list {
        margin-top: calc(12px - var(--ts-inside));
      }
      .fv-card__head + .fv-empty-state {
        margin-top: 16px;
      }
    `,
  ];

  private readonly head = new HeadFit(this);

  constructor() {
    super();
    // Home Assistant's yes to All off comes back to the card that asked, in the page or not
    this.addEventListener('ll-custom', answered);
  }

  static override editor(): Promise<CardEditor> {
    return import('./thermostats-editor.js');
  }
  /** Home Assistant's own name for a card's list: a card pasted from another reads as its thermostats. */
  static override aliases: AliasSpec = { keys: [{ from: 'entities', to: 'thermostats' }] };

  static getStubConfig(hass: unknown): ThermostatsCardConfig {
    // the reporter's own: every thermostat of the house under a head that says how many heat
    return {
      type: 'custom:fluvy-thermostats-card',
      title: localize(hass as HomeAssistant | undefined, 'thermostats.title'),
      show_count: true,
    };
  }

  private get variant(): ThermostatsVariant {
    const asked = this.config?.variant;
    return asked && THERMOSTATS_VARIANTS.includes(asked) ? asked : 'rows';
  }

  /** The thermostats, in their order: the config's, else its area's or the house's (`houseThermostats`). */
  private items(): ThermostatItem[] {
    const listed = itemsOf<ThermostatItem>(this.config?.thermostats);
    return listed.length
      ? listed
      : houseThermostats(this.hass, this.config?.area).map((entity) => ({ entity }));
  }

  protected override watched(): readonly string[] {
    return this.items().flatMap((item) => [
      item.entity,
      ...itemsOf<{ entity: string }>(item.rounds as unknown[] | undefined).map(
        (round) => round.entity,
      ),
    ]);
  }

  override getCardSize(): number {
    // its height in Home Assistant's rows of 50
    return Math.max(1, Math.ceil(thermostatsHeight(this.config ?? { type: '' }) / 50));
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /** The stepped targets on their way, by thermostat: shown at once, sent once the taps settle. */
  private readonly held = new Map<
    string,
    { readonly target: DialChangeDetail; readonly release: number; readonly send: number }
  >();

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    for (const { release, send } of this.held.values()) {
      clearTimeout(release);
      clearTimeout(send);
    }
    this.held.clear();
  }

  /**
   * One step of a thermostat's target from its row's stepper, on its own grid and inside its own range (a range's low
   * end, its high one while it cools): shown at once, sent after the taps settle (650 ms, as the Thermostat card),
   * released as it reports it or after 5 s.
   */
  private nudge({ view, m }: Unit, direction: 1 | -1): void {
    const kept = this.held.get(view.id);
    const shown: DialChangeDetail =
      kept?.target ??
      (m.low !== undefined && m.high !== undefined
        ? { low: m.low, high: m.high }
        : m.target !== undefined
          ? { value: m.target }
          : {});
    if (shown.value === undefined && shown.low === undefined) return;
    const target = stepTarget(shown, direction, m, m.action === 'cooling' ? 1 : 0);
    clearTimeout(kept?.release);
    clearTimeout(kept?.send);
    this.held.set(view.id, {
      target,
      release: window.setTimeout(() => {
        this.held.delete(view.id);
        this.requestUpdate();
      }, 5000),
      send: window.setTimeout(() => {
        const call = targetCall(m, target);
        if (call) this.call(m.kind, call[0], call[1], view.id);
      }, 650),
    });
    this.requestUpdate();
  }

  /** What the rounds reach of the card: its house, its names, its states as drawn, its calls and its colours. */
  private host(): RoundsHost {
    return {
      hass: this.hass,
      look: this.config,
      name: (view, own) => this.nameFor(view, own),
      state: (view) => this.stateOf(view),
      expect: (id, state) => this.expect(id, state),
      call: (domain, service, data) => this.call(domain, service, data, ''),
      run: (action, entity) => this.tap(entity, action),
      tapper: (of, at, tap, double) => this.tapper(of, at, tap, double),
      accent: (colour) => this.accents.item(colour),
      ruler: this.head.ruler,
      root: this.renderRoot,
    };
  }

  /**
   * A thermostat as its row draws it: its model (`thermostatModel`), its name — its own, else its room's where it is
   * the only one of the card there (`names: area`, the default), else as the card's `names` asks — its room's glyph
   * (the area's icon, a room of Fluvy's set where it is one, `ROOM_ICONS`), else its own; what it is doing (a window
   * open said too) and whether that is anything; what the room measures.
   */
  private units(items: readonly ThermostatItem[]): Unit[] {
    const hass = this.hass;
    const rooms = items.map((item) => areaOf(hass, item.entity));
    return items.map((item, index) => {
      const view = this.entity(item.entity);
      const m = thermostatModel(
        {
          hass,
          rawHass: this.rawHass,
          state: (shown) => this.stateOf(shown),
          ask: { show_window: true },
        },
        view,
      );
      const room = rooms[index];
      const area = room ? hass?.areas?.[room] : undefined;
      const alone = rooms.filter((one) => one === room).length === 1;
      // by its room (`names: area`, the default) where it is the card's only one there, else as Home Assistant says
      const names = this.config?.names;
      const byRoom = names === undefined || names === 'area';
      const name =
        item.name !== undefined
          ? this.nameFor(view, item.name)
          : byRoom && area?.name && alone
            ? area.name
            : listedName(hass, view, byRoom ? undefined : names);
      const usable = isUsable(view);
      const percent = m.unit === '%';
      const current =
        m.current === undefined
          ? usable
            ? undefined
            : '—'
          : usable
            ? percent
              ? `${formatNumber(hass, m.current, { digits: 0 })} %`
              : `${formatNumber(hass, m.current, { digits: 1 })}°`
            : '—';
      const own = area?.icon ? (ROOM_ICONS[area.icon] ?? area.icon) : undefined;
      // off, it says so: at once where it was turned off here, before its integration says it stopped heating
      const said: Doing =
        usable && m.off
          ? { text: this.t('climate.mode.off'), key: 'off', tone: 'neutral' }
          : m.doing;
      return {
        item,
        view,
        m,
        usable,
        name,
        glyph: item.icon ?? own ?? iconOf(view),
        said,
        running: usable && said.tone !== 'neutral' && said.tone !== 'off',
        current,
      };
    });
  }

  /**
   * A thermostat's circle: what it is doing's tone while it does anything (its own colour or tone first, then the
   * card's; never over a warning), quiet while it does nothing, the dashed ring out of reach.
   */
  private look(unit: Unit): { readonly tone: Tone; readonly accent: string | undefined } {
    if (!unit.usable) return { tone: 'off', accent: undefined };
    if (!unit.running) return { tone: 'neutral', accent: undefined };
    const color = unit.item.color ?? this.config?.color;
    return {
      tone: statusToneOf({ tone: unit.item.tone ?? this.config?.tone, color }, unit.said.tone),
      accent: unit.said.tone === 'warning' ? undefined : this.accents.item(color),
    };
  }

  /** What it is set to as its line says it ("21°", "20–24°"), none while off or a window is open. */
  private target(unit: Unit): string {
    return unit.usable && !unit.m.off && unit.said.tone !== 'warning'
      ? setpoint(this.hass, unit.view, this.stateOf(unit.view))
      : '';
  }

  /** Its preset in its words ("Eco"), none where it has none. */
  private preset(unit: Unit): string {
    const preset = unit.m.preset;
    return unit.usable && preset && preset !== 'none' && !unit.m.off
      ? modeWord(this.rawHass, unit.view, 'preset_mode', preset)
      : '';
  }

  /**
   * The head's line: how many heat ("3 of 5 heating"), or cool, else how many are on, else how many there are — of
   * those that can be read — and the house's average ("20.4° average"); each where asked. Its shorter forms keep the
   * count in figures ("3/5 heating").
   */
  private headLine(units: readonly Unit[]): { readonly sub: string; readonly shorter: string[] } {
    const usable = units.filter((unit) => unit.usable);
    const count = usable.length;
    const tone = (one: Tone): number => usable.filter((unit) => unit.said.tone === one).length;
    const [heating, cooling] = [tone('heat'), tone('cool')];
    const on = usable.filter((unit) => !unit.m.off).length;
    const [said, short] = !count
      ? ['', '']
      : heating && !cooling
        ? [
            this.t('thermostats.heating_of', { on: heating, count }),
            this.t('thermostats.heating_of_short', { on: heating, count }),
          ]
        : cooling && !heating
          ? [
              this.t('thermostats.cooling_of', { on: cooling, count }),
              this.t('thermostats.cooling_of_short', { on: cooling, count }),
            ]
          : on
            ? [this.t('common.on_of', { on, count }), this.t('common.on_of_short', { on, count })]
            : [plural(this.hass, 'thermostats.count', count, { count }), ''];
    const read = usable.flatMap((unit) => (unit.m.current === undefined ? [] : [unit.m.current]));
    const average =
      this.config?.show_average === true && read.length
        ? this.t('thermostats.average', {
            value: `${formatNumber(this.hass, read.reduce((a, b) => a + b, 0) / read.length, { digits: 1 })}°`,
          })
        : '';
    const counted = this.config?.show_count === true;
    const line = (first: string): string =>
      [counted ? first : '', average].filter(Boolean).join(' · ');
    return { sub: line(said), shorter: counted && short ? [line(short)] : [] };
  }

  protected override renderCard(): TemplateResult {
    const config = this.config ?? { type: '' };
    const units = this.units(this.items());
    const w = this.contentWidth;
    const running = units.filter((unit) => unit.running);
    // the head's circle lit while any heats (in the heat's tone), cools, or does anything else
    const lead =
      running.find((unit) => unit.said.tone === 'heat') ??
      running.find((unit) => unit.said.tone === 'cool') ??
      running[0];
    const title = config.title || this.t('thermostats.title');
    const line = this.headLine(units);
    const fitted = hasHead(config)
      ? this.head.fit({ width: w, title, sub: line.sub, shorter: line.shorter })
      : undefined;
    return html`<article class="fv-card ts-card" data-card>
      ${
        fitted
          ? head({
              icon: fitted.icon ? (config.icon ?? 'thermo') : null,
              small: fitted.small,
              tone: lead ? statusToneOf(config, lead.said.tone) : 'neutral',
              title,
              sub: fitted.sub,
              cut: fitted.cut,
              // a card of many: its head answers only what its config says
              ...this.headActions(undefined),
            })
          : nothing
      }
      ${
        !units.length
          ? this.head.empty(
              'thermo',
              this.t('thermostats.empty'),
              this.t('lights.no_lights_hint'),
              w,
            )
          : html`${this.renderActions(units, w)}
              <div class="ts-list ts-list--${this.variant}">
                ${this.variant === 'tiles' ? this.renderTiles(units, w) : this.renderRows(units, w)}
              </div>`
      }
    </article>`;
  }

  /**
   * The house's actions (`house_actions`), as chips filling their rows in the config's order: All off, asked about
   * first, which turns off each thermostat that is on as it takes it (`offCall`), held while none is, its glyph alone
   * where its words would not hold a row; and the presets the thermostats that can be read offer between them, each
   * saying how many offer it where some do not ("Eco 3/5"), chosen where every one that is on and offers it is in it,
   * and setting each of those to it — never one that is off, whose power a preset is not to change; held while none is.
   */
  private renderActions(units: readonly Unit[], w: number): TemplateResult | typeof nothing {
    const asked = houseActions(this.config ?? { type: '' });
    if (!asked.length) return nothing;
    const usable = units.filter((unit) => unit.usable);
    const on = usable.filter((unit) => !unit.m.off);
    const offable = on.filter((unit) => offCall(unit.view));
    const presets = presetsOffered(
      this.rawHass,
      usable.map((unit) => unit.view),
    ).map((offered): Choice => {
      const reach = on.filter((unit) => unit.m.presets.includes(offered.key));
      return {
        key: `${PRESET}${offered.key}`,
        label: presetLabel(offered, usable.length),
        active: reach.length > 0 && reach.every((unit) => unit.m.preset === offered.key),
        disabled: !reach.length,
      };
    });
    const allOff = this.t('thermostats.all_off');
    // where not even a chip of its own line holds its words (Polish's "Wyłącz wszystkie" in half a section), its glyph
    // alone, the words its name
    const short = this.head.ruler.width(FILLED_CHIP, allOff) + FILLED_CHIP_SIDES > w;
    const choices = asked.flatMap((one): Choice[] =>
      one === ALL_OFF
        ? [{ key: ALL_OFF, label: allOff, glyph: 'power', short, disabled: !offable.length }]
        : presets,
    );
    if (!choices.length) return nothing;
    const choose = (key: string): void => {
      if (key === ALL_OFF) {
        askFirst(
          this.host(),
          true,
          plural(this.hass, 'thermostats.all_off_ask', offable.length, { count: offable.length }),
          () => {
            for (const { view } of offable) {
              const call = offCall(view);
              if (!call) continue;
              this.expect(view.id, 'off');
              this.call(call[0], call[1], call[2], view.id);
            }
          },
        );
        return;
      }
      const preset = key.slice(PRESET.length);
      for (const unit of on)
        if (unit.m.presets.includes(preset))
          this.call('climate', 'set_preset_mode', { preset_mode: preset }, unit.view.id);
    };
    return html`<div class="ts-actions">
      ${chipRow(choices, choose, 'full', { ruler: this.head.ruler, width: w })}
    </div>`;
  }

  /**
   * The targets between − and + (`control: stepper`), one pill wide enough for every figure any thermostat of the card
   * can show — its ends, a range, Off, a dash — so a step never resizes one and they stand in one column: its
   * figure's room on the 4 grid; none where the card does not ask.
   */
  private pillRoom(units: readonly Unit[]): number {
    const ruler = this.head.ruler;
    const figures = units.flatMap(({ m }) => {
      const ends = [m.min, m.max].map((value) => this.figure(m, value));
      return [...ends, ...(m.canRange ? [`${ends[0]}–${ends[1]}`] : [])];
    });
    const widest = Math.max(
      ...[...figures, this.t('climate.mode.off'), '—'].map((text) =>
        ruler.width(TARGET_VALUE, text),
      ),
    );
    return Math.ceil((widest + TARGET_SIDES) / 4) * 4;
  }

  /** A target as its pill says it: its step's decimals, and its mark ("21.5°", "50 %"). */
  private figure(m: ThermostatModel, value: number): string {
    const digits = m.step < 1 ? 1 : 0;
    const text = formatNumber(this.hass, value, { digits, minDigits: digits });
    return m.unit === '%' ? `${text} %` : `${text}°`;
  }

  /** The target its pill shows: the stepped one on its way, else its own; a range's two ends; Off; a dash. */
  private pillText(unit: Unit): string {
    const { m, view } = unit;
    let held = this.held.get(view.id)?.target;
    // the house has reported what was stepped: the pill reads the entity again
    if (
      held &&
      (held.low !== undefined
        ? held.low === m.low && held.high === m.high
        : held.value === m.target)
    ) {
      const kept = this.held.get(view.id);
      clearTimeout(kept?.release);
      this.held.delete(view.id);
      held = undefined;
    }
    if (!unit.usable) return '—';
    if (m.off) return this.t('climate.mode.off');
    const low = held?.low ?? m.low;
    const high = held?.high ?? m.high;
    if (low !== undefined && high !== undefined)
      return `${this.figure(m, low).replace(/\s?[°%]$/, '')}–${this.figure(m, high)}`;
    const value = held?.value ?? m.target;
    return value === undefined ? '—' : this.figure(m, value);
  }

  /**
   * A row each (`rows`, `compact`): its room's glyph in what it is doing's tone, its name, and its line — what it is
   * doing, its preset, its target ("Heating · Eco · 21°") — then what the room measures and its rounds: the one that
   * opens it (`show_round`), then its own. With the stepper the target is the control at its end, the room's reading
   * leading the line ("20.5° · Heating · Eco"): where any row could not hold it beside its name, every row ends in the
   * room's reading again. The circles give the stepper their room before it goes. Every row keeps as many rounds as the
   * tightest holds, so the figures and the rounds stand in columns. The whole row opens its details; out of reach it
   * takes no tap, its hold still opens them.
   */
  private renderRows(units: readonly Unit[], w: number): TemplateResult[] {
    const host = this.host();
    const compact = this.variant === 'compact';
    const room = this.config?.control === 'stepper' ? this.pillRoom(units) : 0;
    const rows = (stepped: boolean): RoundsRowSpec[] =>
      units.map((unit) => {
        const { item, view, usable } = unit;
        const { tone, accent } = this.look(unit);
        const doing = [unit.said.text, this.preset(unit)];
        const own = roundsOf(host, item.rounds ?? []);
        const press = this.pressOf(item, view.id, MORE_INFO, MORE_INFO);
        const value = stepped
          ? {
              drawn: stepper((direction) => this.nudge(unit, direction), {
                disabled: !usable || unit.m.off || this.pillText(unit) === '—',
                decrease: `${unit.name} · ${this.t('climate.target')} · ${this.t('common.decrease')}`,
                increase: `${unit.name} · ${this.t('climate.target')} · ${this.t('common.increase')}`,
                value: this.pillText(unit),
                width: room,
              }),
              width: STEPPER_HALVES + room,
            }
          : unit.current;
        return {
          icon: unit.glyph,
          tone,
          accent,
          title: unit.name,
          sub: (stepped && usable ? [unit.current, ...doing] : [...doing, this.target(unit)])
            .filter(Boolean)
            .join(' · '),
          value,
          rounds: [
            ...(this.config?.show_round === false
              ? []
              : [{ entity: view.id, group: 'entity' as const }]),
            ...own,
          ],
          onTap: usable ? press.onTap : undefined,
          onHold: press.onHold,
        };
      });
    // the stepper before the circles, which give it their room where the row holds both not
    const stepped = room > 0 ? rows(true) : [];
    const drawn =
      stepped.length && stepped.every((row) => roundsRoom(host, w, row, compact, false) >= 0)
        ? stepped
        : rows(false);
    // the rounds every row holds, and as many on each, so the values and the rounds stand in columns
    const icon = roundsRowsKeepIcon(host, w, drawn, compact);
    const held = Math.min(
      ...drawn.map((row) => roundsHeld(roundsRoom(host, w, row, compact, icon))),
    );
    return drawn.map((row) =>
      roundsRow(host, w, { ...row, rounds: row.rounds.slice(0, held) }, { compact, icon }),
    );
  }

  /**
   * Tiles (`tiles`), two a row where each keeps its 120 (one a row in a narrower column), an odd last one the whole
   * row: its room's glyph, its name, and after it what it is doing where both hold the tile whole, the room's reading
   * as its figure; filled in its tone while it does anything. The tile opens its details, its hold too; out of reach
   * it is the dashed one, "—".
   */
  private renderTiles(units: readonly Unit[], w: number): TemplateResult {
    const two = (w - TILE_GAP) / 2 >= TILE_MIN;
    const inner = (two ? (w - TILE_GAP) / 2 : w) - TILE_SIDES;
    const items = units.map((unit): OptionItem => {
      const { tone, accent } = this.look(unit);
      const word = unit.said.short ?? unit.said.text;
      const holds =
        unit.usable &&
        this.head.ruler.width('fv-option__label', `${unit.name}\u00a0· ${word}`) <= inner;
      return {
        key: unit.view.id,
        label: unit.name,
        name: true,
        band: holds ? word : undefined,
        value: unit.current ?? '—',
        glyph: unit.glyph,
        tone,
        accent,
        active: unit.running,
        unavailable: !unit.usable,
        ...this.pressOf(unit.item, unit.view.id, MORE_INFO, MORE_INFO),
      };
    });
    return options(items, null, TILE_GAP, TILE, two ? 2 : 1);
  }
}
