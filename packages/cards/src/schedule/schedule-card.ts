import {
  haptic,
  isTimeZone,
  isUsable,
  numberAttr,
  strings,
  wallClock,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { head, ico, icon, pressCover, toggle, type Tone } from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';
import { newScheduleId, SCHEDULE_ID } from '../automations/schedule.js';
import { automationEntity, automationIds, AutomationStore } from '../automations/store.js';
import { HeadFit, SWITCH_SLOT } from '../energy/head.js';
import { scheduleHeight } from '../schedule-family.js';
import { Card, type CardEditor, type HeadConfig } from '../shared/base.js';
import { toneOf } from '../shared/colour.js';
import { firstWeekday, WEEKDAYS, type FirstWeekday, type Weekday } from '../shared/dates.js';
import type { Segment } from '../shared/fit.js';
import { Ticker } from '../shared/ticker.js';
import { degrees, doing } from '../thermostat/doing.js';
import {
  buildHeating,
  followedSchedule,
  parseHeating,
  type Heating,
  type Preset,
} from './automation.js';
import {
  clockOf,
  dayWord,
  hours,
  lineStyles,
  needle,
  nowAt,
  swatch,
  toneClass,
  track,
} from './lines.js';
import { DAYS, nextChange, sameWeek, type HelperItem, type Week } from './plan.js';
import { presetLooks, type PresetConfig, type PresetLook } from './presets.js';
import type { FluvyHeatingSheet, HeatingDraft, HeatingRequest } from './sheet/heating-sheet.js';
import { PlanStore } from './store.js';

const s = strings('schedule');

export const SCHEDULE_VARIANTS = ['week', 'today', 'row'] as const;
export type ScheduleVariant = (typeof SCHEDULE_VARIANTS)[number];

export interface ScheduleCardConfig extends FluvyCardConfig, HeadConfig {
  /** The schedule helper (`schedule.*`); found by the automation that ties it to the thermostat when left out. */
  schedule?: string;
  /**
   * `week` (default): a line a day. `today`: today's alone, taller, its blocks saying their times. `row`: one 76 row,
   * the room over the preset in force, its target and the next change, the switch at its end.
   */
  variant?: ScheduleVariant;
  /** The head: the room, what the thermostat is doing, the preset in force and the schedule's switch (default). */
  show_head?: boolean;
  /** The presets' legend under the hours (default). */
  show_presets?: boolean;
  /** The schedule's switch in the head (default). */
  show_switch?: boolean;
  /** The day the week starts on: the house's (`language`, default: the person's profile, then the language), or one. */
  first_weekday?: FirstWeekday;
  /** A preset's own name, icon, tone and colour on this card. */
  presets?: readonly PresetConfig[];
  /** Test hook: an ISO date that freezes "now" (the line it is on, its marker). Undocumented. */
  _now?: string;
}

/** What ties the card's thermostat to its week: the helper, the automation that applies it, the plan it holds. */
interface Tie {
  /** The schedule helper's entity. */
  readonly schedule: string | undefined;
  /** The automation entity that applies it, and its config's id. */
  readonly automation: string | undefined;
  readonly configId: string | undefined;
  /** The plan as read (an administrator's): its presets, its base. */
  readonly heating: Heating | undefined;
  /** Its automation, read, is not Fluvy's shape any more: edited in Home Assistant, it is Home Assistant's. */
  readonly foreign: boolean;
  /** Home Assistant's first answers are on their way. */
  readonly waiting: boolean;
}

/** A legend chip's sides (`fitPills` rounds it up to the 4 grid), its swatch with its gap, and the room between two. */
const CHIP_SIDES = 2 * 10;
const SWATCH = 12 + 6;
const LEGEND_GAP = 8;

/** The icon a new helper wears in Home Assistant's list of helpers. */
const HELPER_ICON = 'mdi:calendar-clock';

/** A config read strictly as a heating schedule, once per config object. */
const parsed = new WeakMap<object, Heating | undefined>();
function heatingOf(config: object | undefined): Heating | undefined {
  if (!config) return undefined;
  if (!parsed.has(config)) parsed.set(config, parseHeating(config));
  return parsed.get(config);
}

/** Whether two plans write one automation. */
const samePlan = (a: Heating, b: Heating): boolean =>
  JSON.stringify(buildHeating(a)) === JSON.stringify(buildHeating(b));

/** The presets a week's blocks name, in the order they first come: what a guest knows of the plan. */
const presetsNamed = (week: Week): Preset[] => {
  const keys: string[] = [];
  for (const day of DAYS)
    for (const block of week[day])
      if (block.preset !== undefined && !keys.includes(block.preset)) keys.push(block.preset);
  return keys.map((key) => ({ key, name: key }));
};

/**
 * A room's heating week on Home Assistant's own schedule helper (#229): its head says what the thermostat is doing, the
 * preset in force and its target, how warm the room is now, and switches the schedule on and off (its automation);
 * under it a line a day (or today's alone) of the blocks in their presets' colours, the gaps the base preset's, a
 * marker at the time it is now, the hours under them and the presets with their temperatures; or one row that says
 * the preset in force, its target and the next change, its switch at its end. A tap opens the sheet that edits it (an
 * administrator's; anyone else's reads it). The week runs in Home Assistant, every browser closed: the helper holds
 * the times, an automation Fluvy writes (`automation.ts`) sets the thermostat by them.
 */
export class FluvyScheduleCard extends Card<ScheduleCardConfig> {
  static override layoutHeight(config: ScheduleCardConfig): number {
    return scheduleHeight(config);
  }

  static override editor(): Promise<CardEditor> {
    return import('./schedule-editor.js');
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): ScheduleCardConfig {
    return {
      type: 'custom:fluvy-schedule-card',
      entity: entities.find((id) => id.startsWith('climate.')) ?? '',
    };
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    lineStyles,
    css`
      .sc-body {
        margin-top: 16px;
      }
      .sc-head-off + .sc-body {
        margin-top: 0;
      }
      /* the week: a line a day, the day's short word in a column beside its line of 24, 8 apart; today's on the
         accent's wash (4 round it, 8 past its ends), the needle through them all */
      .sc-today {
        position: relative;
        border-radius: 16px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .sc-week {
        position: relative;
        display: grid;
        row-gap: 8px;
        border-radius: 12px;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .sc-week:focus-visible,
      .sc-today:focus-visible {
        outline: 2px solid var(--fluvy-accent);
        outline-offset: 4px;
      }
      .sc-line {
        display: grid;
        grid-template-columns: var(--sc-days) minmax(0, 1fr);
        column-gap: 8px;
        align-items: center;
      }
      .sc-line.is-today {
        --sc-band: var(--fluvy-accent-wash, var(--fluvy-accent-fill));
        --knob-halo: var(--sc-band);
        border-radius: 12px;
        background: var(--sc-band);
        box-shadow:
          -4px 0 0 4px var(--sc-band),
          4px 0 0 4px var(--sc-band);
      }
      .sc-day {
        margin: 0;
        height: 24px;
        font-size: 13px;
        font-weight: 500;
        line-height: 24px;
        color: var(--fluvy-text-secondary);
        white-space: nowrap;
      }
      .sc-day.is-today {
        font-weight: 600;
        color: var(--fluvy-text);
      }
      /* the presets: one centred line of the house's chips, each its swatch, its name and its temperature, the one in
         force in its tone; those past the line say how many */
      .sc-legend {
        display: flex;
        justify-content: center;
        gap: 8px;
        height: 28px;
        margin-top: 16px;
        white-space: nowrap;
      }
      .sc-chip {
        display: inline-flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 6px;
        box-sizing: border-box;
        height: 28px;
        margin: 0;
        padding: 0 10px;
        border-radius: var(--fluvy-radius-pill, 9999px);
        background: var(--fluvy-inset, var(--fluvy-page));
        font-size: 13px;
        font-weight: 600;
        line-height: 20px;
        color: var(--fluvy-text-secondary);
      }
      .sc-chip.is-active {
        background: var(--tone-fill);
        color: var(--tone-on);
        box-shadow: inset 0 0 0 1px var(--tone-border);
      }
      .sc-chip__value {
        font-weight: 500;
        font-variant-numeric: tabular-nums;
      }
      /* the preset in force, in the head's line and the row's: in its tone's ink */
      .sc-in-force {
        color: var(--tone-ink);
      }
      .sc-empty {
        box-sizing: border-box;
        min-height: 0;
        justify-content: flex-start;
        padding-bottom: 0;
      }
      .sc-empty .fv-btn {
        margin-top: 8px;
      }
      .sc-empty--line {
        gap: 8px;
      }
      .sc-empty--line .fv-btn {
        margin-top: 0;
      }
      /* the first answers on their way: the room kept, blank */
      .sc-wait > * {
        visibility: hidden;
      }
      .is-off .sc-block,
      .is-off .sc-swatch {
        opacity: 0.5;
      }
      /* out of reach the card is the page's fill, as a chip is: its edge says where it stands */
      .is-off .sc-chip:not(.is-active) {
        box-shadow: inset 0 0 0 1px var(--fluvy-unavailable-border);
      }
      /* the row: the house's (76, 16 in, half a section; the printer's, the compass's), the room's circle, its name
         over its line, the switch at its end; the row is the card's button (a cover over it), its circle and its
         switch raised beside it */
      .sc-row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        height: 76px;
        padding: 16px;
      }
      /* held by another card's surface (the Expander's), the row stands out by its own padding */
      :host:has(> .sc-row) {
        --fv-pad: 16px;
      }
      .sc-row .fv-row__text {
        flex: 1 1 auto;
        min-width: 0;
      }
      .sc-row > :is(.fv-ico--tap, .fv-hit) {
        position: relative;
        z-index: 1;
      }
      .sc-row > .fv-tile__tap {
        border-radius: inherit;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    sheetReady_: { state: true },
  };

  /** The sheet's chunk has landed: the sheet element is in the card. */
  declare sheetReady_: boolean;

  private readonly headFit = new HeadFit(this);
  private automations: AutomationStore | undefined;
  private plans: PlanStore | undefined;
  private unsubscribe: (() => void)[] = [];
  /** A plan just written whose automation is to be run once it stands on (its id): the time it is now takes effect. */
  private applying: string | undefined;

  constructor() {
    super();
    this.sheetReady_ = false;
    // the marker of the time it is now moves with the clock
    new Ticker(this, () => true);
  }

  protected override prepare(config: ScheduleCardConfig): ScheduleCardConfig {
    if (!config.entity) throw new Error('fluvy-schedule-card: "entity" is required');
    return config;
  }

  override getCardSize(): number {
    return Math.ceil(scheduleHeight(this.config ?? { type: '' }) / 50);
  }

  /** The week and today's line take a section, half a section their floor; the row half a section, as the house's rows. */
  override getGridOptions(): LovelaceGridOptions {
    return { columns: this.config?.variant === 'row' ? 6 : 12, rows: 'auto', min_columns: 6 };
  }

  /* ---------- the house ---------- */

  private get admin(): boolean {
    return this.hass?.user?.is_admin === true;
  }

  private now(): Date {
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    return frozen && Number.isFinite(frozen.getTime()) ? frozen : new Date();
  }

  /** The time it is in the house's own zone (where its helper runs): the day, and the minute of it. */
  private clock(): { readonly day: Weekday; readonly minute: number } {
    const zone = this.hass?.config?.time_zone;
    const wall = wallClock(
      this.now(),
      typeof zone === 'string' && isTimeZone(zone) ? zone : undefined,
    );
    const day = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
    return { day: WEEKDAYS[day] as Weekday, minute: wall.hour * 60 + wall.minute };
  }

  /** The week's days from the one it starts on. */
  private days(): readonly Weekday[] {
    const first = firstWeekday(this.hass, this.config?.first_weekday);
    return WEEKDAYS.map((_, index) => WEEKDAYS[(first + index) % 7] as Weekday);
  }

  /** The room's name: the card's, else the thermostat's area, else its own. */
  private room(view: EntityView): string {
    const own = this.config?.name;
    return own !== undefined ? this.nameFor(view, own) : view.areaName || view.name;
  }

  protected override watched(): readonly string[] {
    const tie = this.lastTie;
    return [
      ...(this.config?.entity ? [this.config.entity] : []),
      ...(tie?.schedule ? [tie.schedule] : this.config?.schedule ? [this.config.schedule] : []),
      ...(tie?.automation ? [tie.automation] : []),
    ];
  }

  /** The house gained or lost an automation (a plan saved): what ties the week may change with it. */
  protected override shouldUpdate(changed: PropertyValues): boolean {
    if (super.shouldUpdate(changed)) return true;
    const before = automationIds(changed.get('hass') as HomeAssistant | undefined);
    const now = automationIds(this.hass);
    return before.length !== now.length || before.some((id, i) => id !== now[i]);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const hass = this.hass;
    if (!hass) return;
    if (changed.has('hass')) {
      const automations = AutomationStore.for(hass);
      const plans = PlanStore.for(hass);
      if (automations !== this.automations || plans !== this.plans) {
        this.release();
        this.automations = automations;
        this.plans = plans;
        if (this.isConnected) this.listen();
      }
    }
    this.ask(changed.has('hass'));
    this.apply();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.automations && !this.unsubscribe.length) this.listen();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.release();
  }

  private listen(): void {
    const redraw = (): void => this.requestUpdate();
    this.unsubscribe = [
      ...(this.automations ? [this.automations.subscribe(redraw)] : []),
      ...(this.plans ? [this.plans.subscribe(redraw)] : []),
    ];
  }

  private release(): void {
    for (const leave of this.unsubscribe) leave();
    this.unsubscribe = [];
  }

  /**
   * What is worth asking Home Assistant now, each store asking only what it has not: the stores say when. What relates
   * to the card's anchor is asked with a new house (`house`) alone: the store asks again where the house's automations
   * changed, and an answer that redraws the card is no new house — two views of one house that differ in them (a card
   * and its twin out of reach) would otherwise ask by turns for ever.
   */
  private ask(house: boolean): void {
    const hass = this.hass;
    const config = this.config;
    const automations = this.automations;
    const plans = this.plans;
    if (!hass || !config?.entity || !automations || !plans) return;
    const anchor = config.schedule ?? config.entity;
    if (house) void automations.loadRelated([anchor], automationIds(hass));
    const ours = this.ours(anchor);
    if (this.admin)
      void automations.load(ours.map((id) => String(hass.states[id]?.attributes['id'])));
    else for (const id of ours) void plans.loadNamed(id);
    const schedule = this.tie().schedule;
    if (schedule) void plans.load(schedule);
  }

  /** Fluvy's automations Home Assistant relates to that entity (by their `fluvy_` ids). */
  private ours(anchor: string): readonly string[] {
    const hass = this.hass;
    const related = this.automations?.related(anchor);
    return [...(related ?? [])].filter((id) =>
      SCHEDULE_ID.test(String(hass?.states[id]?.attributes['id'] ?? '')),
    );
  }

  private lastTie: Tie | undefined;

  /**
   * The helper and the automation of the card's thermostat: the automation Home Assistant relates to the helper the
   * card names (else to the thermostat) that sets that thermostat by a helper — read as Fluvy's shape by an
   * administrator (a `fluvy_` one on a helper in another shape is one edited by hand), known by what it names for
   * anyone else.
   */
  private tie(): Tie {
    const hass = this.hass;
    const config = this.config;
    const automations = this.automations;
    const asked = config?.schedule;
    const none: Tie = {
      schedule: asked,
      automation: undefined,
      configId: undefined,
      heating: undefined,
      foreign: false,
      waiting: false,
    };
    if (!hass || !config?.entity || !automations)
      return (this.lastTie = { ...none, waiting: true });
    const anchor = asked ?? config.entity;
    const settled = automations.relatedSettled([anchor]);
    const ours = this.ours(anchor);
    const idOf = (automation: string): string => String(hass.states[automation]?.attributes['id']);
    if (this.admin) {
      for (const automation of ours) {
        const configId = idOf(automation);
        const heating = heatingOf(automations.config(configId));
        if (heating && heating.climate === config.entity && (!asked || heating.schedule === asked))
          return (this.lastTie = {
            schedule: heating.schedule,
            automation,
            configId,
            heating,
            foreign: false,
            waiting: false,
          });
      }
      for (const automation of ours) {
        const configId = idOf(automation);
        const read = automations.config(configId);
        const followed = read && !heatingOf(read) ? followedSchedule(read) : undefined;
        if (followed && (!asked || followed === asked))
          return (this.lastTie = {
            schedule: followed,
            automation,
            configId,
            heating: undefined,
            foreign: true,
            waiting: false,
          });
      }
      const reading = ours.some(
        (automation) =>
          automations.config(idOf(automation)) === undefined &&
          automations.error(idOf(automation)) === undefined,
      );
      return (this.lastTie = { ...none, waiting: !settled || reading });
    }
    const plans = this.plans;
    for (const automation of ours) {
      const named = plans?.entitiesOf(automation);
      const followed = named?.find(
        (entity) => entity.startsWith('schedule.') && (!asked || entity === asked),
      );
      if (followed)
        return (this.lastTie = {
          schedule: followed,
          automation,
          configId: idOf(automation),
          heating: undefined,
          foreign: false,
          waiting: false,
        });
    }
    const reading = ours.some((automation) => plans?.entitiesOf(automation) === undefined);
    return (this.lastTie = { ...none, waiting: !settled || reading });
  }

  /* ---------- acting ---------- */

  /** Switches the schedule's automation; switched on, it runs once so the time it is now takes effect at once. */
  private flip(automation: string, next: boolean): void {
    haptic(this, 'selection');
    this.expect(automation, next ? 'on' : 'off');
    this.call('automation', next ? 'turn_on' : 'turn_off', {}, automation);
    if (next) this.call('automation', 'trigger', { skip_condition: false }, automation);
  }

  /** A plan just written runs once, as soon as its automation stands and is on. */
  private apply(): void {
    const hass = this.hass;
    if (!this.applying || !hass) return;
    const entity = automationEntity(hass, this.applying);
    if (!entity) return;
    this.applying = undefined;
    if (entity.state === 'on')
      this.call('automation', 'trigger', { skip_condition: false }, entity.entity_id);
  }

  /** A helper's name for the room that no schedule of the house has yet ("Bedroom heating", "Bedroom heating 2"). */
  private helperName(room: string): string {
    const taken = new Set(
      Object.values(this.hass?.states ?? {})
        .filter((entity) => entity.entity_id.startsWith('schedule.'))
        .map((entity) => String(entity.attributes['friendly_name'] ?? '').toLocaleLowerCase()),
    );
    const name = s(this.hass, 'helper', { name: room });
    for (let n = 1; ; n++) {
      const candidate = n === 1 ? name : `${name} ${n}`;
      if (!taken.has(candidate.toLocaleLowerCase())) return candidate;
    }
  }

  /**
   * Writes the plan: the helper (made, where the thermostat has none yet, named after the room) and the automation,
   * each only where it changed. Home Assistant is read again first: where the helper's week is no longer the one the
   * sheet opened on (`opened`), or the plan's automation is no longer the one it read, nothing is written and the
   * sheet is told so (`changed`), so a change made there meanwhile is never undone. Where the automation is refused,
   * the helper goes back to what it was (one just made is deleted) and the sheet says so: the card stays as it was.
   */
  private async write(
    tie: Tie,
    id: string,
    draft: HeatingDraft,
    opened: Week | undefined,
  ): Promise<'changed' | undefined> {
    const plans = this.plans;
    const automations = this.automations;
    const config = this.config;
    if (!plans || !automations || !config?.entity) throw new Error('not ready');
    const view = this.entity();
    const room = this.room(view);
    let item: HelperItem | undefined = tie.schedule ? plans.helper(tie.schedule) : undefined;
    if (tie.schedule && opened) {
      item = await plans.reread(tie.schedule);
      if (!item || !sameWeek(item.week, opened)) return 'changed';
    }
    const read = tie.configId ? heatingOf(automations.config(tie.configId)) : undefined;
    if (tie.heating && (!read || !samePlan(read, tie.heating))) return 'changed';
    let schedule = tie.schedule;
    const before = item?.week;
    let made: HelperItem | undefined;
    if (!item || !schedule) {
      const name = this.helperName(room);
      const created = await plans.create(name, HELPER_ICON, draft.week);
      made = item = created.item;
      schedule = created.entity;
    } else if (!sameWeek(item.week, draft.week)) item = await plans.update(item, draft.week);
    try {
      const heating: Heating = {
        id,
        alias: tie.heating?.alias ?? s(this.hass, 'alias', { name: room }),
        description:
          tie.heating?.description ??
          s(this.hass, 'description', { climate: view.name, schedule: item.name }),
        schedule,
        climate: config.entity,
        presets: draft.presets,
        base: draft.base,
      };
      const built = buildHeating(heating);
      const same = tie.heating && samePlan(tie.heating, heating);
      if (!same) {
        await automations.saveShape(id, built, (raw) => {
          const read = parseHeating(raw);
          return read ? buildHeating(read) : undefined;
        });
      }
      if (!same || made || !sameWeek(before ?? draft.week, draft.week)) this.applying = id;
    } catch (error) {
      if (made) await plans.remove(made.id).catch(() => undefined);
      else if (before && item && !sameWeek(before, draft.week))
        await plans.update(item, before).catch(() => undefined);
      throw error;
    }
    this.requestUpdate();
    return undefined;
  }

  /** The sheet, its chunk fetched the first time: a dashboard that only shows the week never pays for it. */
  private async sheet(): Promise<FluvyHeatingSheet | undefined> {
    if (!this.sheetReady_) {
      await import('./sheet/heating-sheet.js');
      this.sheetReady_ = true;
    }
    await this.updateComplete;
    return this.renderRoot.querySelector<FluvyHeatingSheet>('fluvy-heating-sheet') ?? undefined;
  }

  /** The thermostat's range as its sheet sets it: its bounds, its step, whether it keeps only a range, its own presets. */
  private unit(view: EntityView): HeatingRequest['unit'] {
    const fahrenheit = this.hass?.config?.unit_system?.temperature === '°F';
    const features = Number(view.attr<unknown>('supported_features') ?? 0);
    const modes = view.attr<unknown>('preset_modes');
    return {
      min: numberAttr(view, 'min_temp') ?? (fahrenheit ? 45 : 7),
      max: numberAttr(view, 'max_temp') ?? (fahrenheit ? 95 : 35),
      step: numberAttr(view, 'target_temp_step') ?? (fahrenheit ? 1 : 0.5),
      unit: fahrenheit ? '°F' : '°C',
      range: (features & 1) === 0 && (features & 2) !== 0,
      modes: Array.isArray(modes) ? modes.filter((m): m is string => typeof m === 'string') : [],
    };
  }

  /**
   * Opens the sheet on a day (the one tapped, else today): to edit the plan, to make one, or to read it; again on the
   * plan as it is now where Home Assistant changed it since (`opener`: what had opened it, the focus's way back).
   */
  private async openSheet(day?: Weekday, opener?: HTMLElement): Promise<void> {
    const openedBy =
      opener ?? ((this.renderRoot as ShadowRoot).activeElement as HTMLElement | null);
    const tie = this.tie();
    const view = this.entity();
    const plans = this.plans;
    const week = tie.schedule ? plans?.week(tie.schedule) : undefined;
    // not while the card still reads which plan is the thermostat's: a sheet opened then would offer to make a second
    // helper and automation beside the one it has not found yet
    if (
      tie.waiting ||
      (tie.schedule !== undefined && !week && !(plans?.settled(tie.schedule) ?? false))
    )
      return;
    const editable =
      this.admin &&
      !tie.foreign &&
      (!tie.schedule || !week || Boolean(plans?.helper(tie.schedule)));
    const readOnly: HeatingRequest['readOnly'] = !this.admin
      ? 'guest'
      : tie.foreign
        ? 'foreign'
        : editable
          ? undefined
          : 'yaml';
    const id = tie.configId && !tie.foreign ? tie.configId : newScheduleId();
    const sheet = await this.sheet();
    sheet?.open(
      {
        room: this.room(view),
        climate: view.id,
        ...(week ? { week } : {}),
        ...(tie.heating
          ? { presets: tie.heating.presets, base: tie.heating.base }
          : week
            ? { presets: presetsNamed(week) }
            : {}),
        ...(readOnly ? { readOnly } : {}),
        ...(tie.foreign && tie.configId ? { configId: tie.configId } : {}),
        day: day ?? this.clock().day,
        days: this.days(),
        unit: this.unit(view),
        looks: (presets) => presetLooks(this.hass, this.config?.presets, presets),
        save: (draft) => this.write(tie, id, draft, week),
        reload: (shown) => void this.openSheet(shown, openedBy ?? this),
      },
      openedBy ?? this,
    );
  }

  /* ---------- render ---------- */

  /** Whether a preset's temperature has a tenth: the legend and the head then write every one with its tenth. */
  private get tenths(): boolean {
    return (this.lastTie?.heating?.presets ?? []).some(
      (preset) => preset.temperature !== undefined && preset.temperature % 1 !== 0,
    );
  }

  /** The preset in force now: the block's on the helper while it is on, else the base; none while the schedule is off. */
  private active(tie: Tie, on: boolean): string | undefined {
    const hass = this.hass;
    const helper = tie.schedule ? hass?.states[tie.schedule] : undefined;
    if (!on || !helper) return undefined;
    const named = helper.attributes['preset'];
    if (helper.state === 'on' && typeof named === 'string') return named;
    return tie.heating?.base;
  }

  /** What the thermostat is set to, as the legend writes the presets: a tenth only where one of them has one. */
  private target(view: EntityView): string {
    const set = numberAttr(view, 'temperature') ?? numberAttr(view, 'target_temp_low');
    return degrees(this.hass, set, set !== null && (set % 1 !== 0 || this.tenths) ? 0.5 : 1);
  }

  /** The room's circle: the preset in force's glyph and tone while the schedule is on, else the calendar's neutral. */
  private circle(
    usable: boolean,
    on: boolean,
    active: PresetLook | undefined,
  ): { readonly icon: string; readonly tone: Tone } {
    const config = this.config as ScheduleCardConfig;
    return {
      icon: config.icon ?? (on && active ? active.icon : 'calendar'),
      tone: !usable ? 'off' : (config.tone ?? (on && active ? active.tone : 'neutral')),
    };
  }

  /** The schedule's switch (its automation's): anyone may switch it; out of reach, it stands disabled. */
  private renderSwitch(automation: EntityView | undefined, on: boolean): TemplateResult {
    return toggle(
      on,
      toneOf(this.config, 'accent'),
      (next) => this.flip(automation?.id ?? '', next),
      s(this.hass, 'card'),
      !automation || !isUsable(automation),
    );
  }

  /**
   * A line with the preset in force (`part`: its name, in the head with its target) in its tone's ink, where the line
   * says it whole as one of its parts; the line as it is otherwise.
   */
  private inTone(
    line: string,
    part: string,
    look: PresetLook | undefined,
  ): string | TemplateResult {
    const parts = line.split(' · ');
    const at = look && part ? parts.indexOf(part) : -1;
    if (!look || at < 0) return line;
    const before = parts
      .slice(0, at)
      .map((each) => `${each} · `)
      .join('');
    const after = parts
      .slice(at + 1)
      .map((each) => ` · ${each}`)
      .join('');
    return html`${before}<span
        class="sc-in-force ${toneClass(look)}"
        data-accent=${(look.color && this.accents.item(look.color)) || nothing}
        >${part}</span
      >${after}`;
  }

  private renderHead(view: EntityView, tie: Tie, active: PresetLook | undefined): TemplateResult {
    const hass = this.hass;
    const config = this.config as ScheduleCardConfig;
    const usable = isUsable(view);
    const automation = tie.automation ? this.entity(tie.automation) : undefined;
    const on = automation ? this.stateOf(automation) === 'on' : false;
    const switchable = Boolean(automation) && config.show_switch !== false;
    const title = this.room(view);
    const said = doing({ hass, rawHass: this.rawHass }, view, this.stateOf(view), 'neutral');
    const target = this.target(view);
    const current = numberAttr(view, 'current_temperature');
    const inForce = automation && !on ? '' : [active?.name, target].filter(Boolean).join(' ');
    const segments = usable
      ? [
          said.text,
          automation && !on ? s(hass, 'paused') : inForce,
          current === null ? '' : this.t('climate.current', { value: degrees(hass, current, 0.1) }),
        ].filter(Boolean)
      : [said.text];
    const fitted = this.headFit.fit({
      width: this.contentWidth,
      title,
      sub: segments.join(' · '),
      // a word that would not hold even alone takes Fluvy's shorter one, else the line goes: a state is never cut
      shorter: [...(said.short ? [said.short] : []), ''],
      trailing: switchable ? SWITCH_SLOT : 0,
    });
    const circle = this.circle(usable, on, active);
    return head({
      icon: fitted.icon ? circle.icon : null,
      small: fitted.small,
      tone: circle.tone,
      title,
      name: true,
      sub: this.inTone(fitted.sub, inForce, active),
      cut: fitted.cut,
      trailing: switchable ? this.renderSwitch(automation, on) : nothing,
      // a tap opens the sheet where the config says nothing; a hold, the thermostat's details
      ...this.pressOf(config, config.entity, () => void this.openSheet()),
      ...this.iconActions(config.entity),
    });
  }

  /**
   * The row (`variant: row`): the house's (76, 16 in, half a section; the printer's, the compass's), the room's circle,
   * its name over the preset in force, its target and the next change ("Comfort · 21° · Eco at 22:30"), the schedule's
   * switch at its end. Narrow, it gives way in order: the next change, then the preset's name — the figure stays whole
   * — then the circle, where the name would end before it had begun (under 96, or under the name itself) or what the
   * line keeps (the figure, a state's word) would not hold beside it, then the switch, the circle back where that holds
   * it; the name takes an ellipsis, as names may. The row is the card's button: a tap opens the sheet (to read it, for anyone but an
   * administrator), a hold the thermostat's details.
   */
  private renderRow(
    view: EntityView,
    tie: Tie,
    week: Week | undefined,
    waiting: boolean,
    looks: ReadonlyMap<string, PresetLook>,
    active: PresetLook | undefined,
  ): TemplateResult {
    const hass = this.hass;
    const config = this.config as ScheduleCardConfig;
    const usable = isUsable(view);
    const automation = tie.automation ? this.entity(tie.automation) : undefined;
    const on = automation ? this.stateOf(automation) === 'on' : false;
    const name = this.room(view);
    const target = this.target(view);
    const said = doing({ hass, rawHass: this.rawHass }, view, this.stateOf(view), 'neutral');
    // each with the shorter words a half section's row takes, where they would not hold it ("Schedule off", "Off")
    const segments: Segment[] = !usable
      ? [{ text: said.text, ...(said.short ? { short: said.short } : {}) }]
      : waiting
        ? []
        : !week
          ? [{ text: s(hass, tie.schedule ? 'not_found' : 'empty'), short: s(hass, 'none') }]
          : automation && !on
            ? [
                { text: s(hass, 'paused'), short: s(hass, 'paused_short') },
                { text: target, optional: true },
              ]
            : [
                { text: active?.name ?? '', optional: true },
                { text: target },
                { text: on ? this.nextWords(week, tie, looks, active?.key) : '', optional: true },
              ];
    const words = segments.filter((segment) => segment.text);
    // what the line keeps whole: its first words that are not to leave (their shorter form, where one has one)
    const firm = this.headFit.ruler.width(
      'fv-row__sub',
      words
        .filter((segment) => !segment.optional)
        .map((segment) => segment.short ?? segment.text)
        .join(' · '),
    );
    const needs = Math.max(this.headFit.rowNameRoom(name), firm);
    // the row's words: its column less its 16 sides (the card's are 20), the circle's 56 and the switch's while drawn
    const width = this.contentWidth + 8;
    let withCircle = true;
    let withSwitch = Boolean(automation) && config.show_switch !== false;
    const room = (): number => width - (withCircle ? 56 : 0) - (withSwitch ? SWITCH_SLOT + 12 : 0);
    if (room() < needs) withCircle = false;
    if (room() < needs) {
      withSwitch = false;
      withCircle = room() - 56 >= needs;
    }
    const line = this.headFit.fitRowSegments(words, room());
    const look = this.circle(usable, on, active);
    const icons = this.iconActions(config.entity);
    // a tap opens the sheet where the config says nothing; a hold, the thermostat's details
    const { onTap, onHold } = this.pressOf(config, config.entity, () => void this.openSheet());
    return html`<article class="fv-card sc-row ${usable ? '' : 'is-unavailable is-off'}" data-card>
      ${
        withCircle
          ? ico(look.icon, look.tone, {
              onTap: icons.onIconTap,
              onHold: icons.onIconHold,
              label: icons.iconLabel?.(name),
            })
          : nothing
      }
      <span class="fv-row__text"
        ><span class="fv-row__title" data-name>${name}</span
        ><span class="fv-row__sub">${this.inTone(line, active?.name ?? '', active)}</span></span
      >
      ${withSwitch ? this.renderSwitch(automation, on) : nothing}
      ${onTap || onHold ? pressCover(`${name} · ${line}`, onTap, onHold) : nothing}
      ${this.renderSheet()}
    </article>`;
  }

  /**
   * The next change in words ("Eco at 22:30", another day's with its weekday: "Comfort Mon at 06:30"): when the
   * preset in force changes and to what, as the plan reads its blocks (a preset it has not is the base's); none where
   * the week never changes it, or where it changes to the gaps' and the base is not known (a guest's).
   */
  private nextWords(
    week: Week,
    tie: Tie,
    looks: ReadonlyMap<string, PresetLook>,
    active: string | undefined,
  ): string {
    const hass = this.hass;
    const heating = tie.heating;
    const known = new Set(heating?.presets.map((preset) => preset.key));
    const now = this.clock();
    const change = nextChange(week, now.day, now.minute, (preset) =>
      !heating ? preset : preset !== undefined && known.has(preset) ? preset : heating.base,
    );
    const to = change?.preset === undefined ? undefined : looks.get(change.preset);
    // none where Home Assistant still says the preset it changes to (the helper a moment behind the clock)
    if (!change || !to || to.key === active) return '';
    const time = clockOf(hass, change.minute);
    if (!change.days) return s(hass, 'next', { preset: to.name, time });
    const day = DAYS[(DAYS.indexOf(now.day) + change.days) % 7] as Weekday;
    return s(hass, 'next_on', { preset: to.name, day: dayWord(hass, day), time });
  }

  /** A day's line: its blocks in their presets' tones, their times where they hold, the knob on today's. */
  private renderTrack(
    blocks: Week[keyof Week],
    looks: ReadonlyMap<string, PresetLook>,
    base: PresetLook | undefined,
    width: number,
    now: number | undefined,
    today: boolean,
    tall: boolean,
  ): TemplateResult {
    const cls = tall ? 'sc-time sc-time--tall' : 'sc-time';
    return track({
      hass: this.hass,
      blocks,
      looks,
      base,
      width,
      tall,
      needle: now,
      knob: today,
      measure: (text) => this.headFit.ruler.width(cls, text),
      accent: (color) => this.accents.item(color),
    });
  }

  /**
   * The legend: the presets in the plan's order as the house's chips, each its swatch, its name and its temperature,
   * the one in force in its tone; as many as its line holds, the rest said by their count ("+2"), never a word cut.
   */
  private renderLegend(
    looks: readonly PresetLook[],
    presets: readonly Preset[],
    base: string | undefined,
    active: string | undefined,
  ): TemplateResult {
    const hass = this.hass;
    const step = this.tenths ? 0.5 : 1;
    const items = looks.map((look, index) => {
      const preset = presets[index];
      const value =
        preset?.temperature !== undefined ? degrees(hass, preset.temperature, step) : '';
      return { look, value };
    });
    const room = this.contentWidth;
    const ruler = this.headFit.ruler;
    // a chip as it is set, on the 4 grid: its sides, its swatch, and its name with its figure after it in the
    // figure's own (tabular) digits, measured as one line, as the chip sets them (the space between them alone at a
    // line's start would count for nothing, and two names of 26 with their figures took 4 past a 288 card in Chinese)
    const chip = (content: number): number => Math.ceil((CHIP_SIDES + content) / 4) * 4;
    const width = ({ look, value }: (typeof items)[number]): number =>
      chip(
        SWATCH +
          ruler.width(
            'sc-chip > sc-chip__name',
            value ? `${look.name} ` : look.name,
            'sc-chip__value',
            value,
          ),
      );
    const more = (count: number): number =>
      count ? LEGEND_GAP + chip(ruler.width('sc-chip', `+${count}`)) : 0;
    /** How many of the items hold the line beside the count of the rest. */
    const holding = (each: readonly (typeof items)[number][]): number => {
      let shown = each.length;
      for (; shown > 0; shown--) {
        const used = each
          .slice(0, shown)
          .reduce((sum, item, index) => sum + width(item) + (index ? LEGEND_GAP : 0), 0);
        if (used + more(each.length - shown) <= room) break;
      }
      return shown;
    };
    // where the figures leave presets out, the names alone, if that says more of them
    const bare = items.map((item) => ({ ...item, value: '' }));
    const named = holding(items) < items.length && holding(bare) > holding(items);
    const said = named ? bare : items;
    const shown = holding(said);
    const rest = items.length - shown;
    const accent = (color: string): string | undefined => this.accents.item(color);
    return html`<div class="sc-legend">
      ${said.slice(0, shown).map(({ look, value }) => {
        const on = look.key === active;
        return html`<span
          class="sc-chip ${on ? `is-active ${toneClass(look)}` : ''}"
          data-fit=${CHIP_SIDES}
          data-accent=${(on && look.color && accent(look.color)) || nothing}
          >${swatch(look, look.key === base, accent)}<span class="sc-chip__name"
            >${look.name}${value ? html` <span class="sc-chip__value">${value}</span>` : nothing}</span
          ></span
        >`;
      })}
      ${rest ? html`<span class="sc-chip" data-fit=${CHIP_SIDES}>+${rest}</span>` : nothing}
    </div>`;
  }

  /** What stands in the lines' place where there is no week to draw: why, and for an administrator the way to make one. */
  private renderNoWeek(height: number, tall: boolean, found: boolean): TemplateResult {
    const hass = this.hass;
    const width = this.contentWidth;
    const ruler = this.headFit.ruler;
    // the panel's own 16 on each side, and a button's
    const inner = width - 32;
    const said = s(hass, found ? 'not_found' : 'empty');
    // a word wider than the panel's line ("verwarmingsschema" at 211) would break inside it: the shorter words
    const text = said.split(' ').every((word) => ruler.width('fv-empty-state__text', word) <= inner)
      ? said
      : s(hass, 'empty_short');
    const create = this.admin;
    const full = s(hass, 'create');
    // the button content-sized on the 4 grid, its words and its 16 on each side, so it stands on whole pixels
    // whatever its words measure (Chinese's 新增暖氣排程 came to 92.016)
    const label = ruler.pill('fv-btn', full, 32) <= inner ? full : s(hass, 'create_short');
    const button = create
      ? html`<button
          class="fv-btn fv-btn--accent"
          data-fit="32"
          data-control
          data-target
          @click=${(event: Event) => {
            event.stopPropagation();
            void this.openSheet();
          }}
        >
          ${label}
        </button>`
      : nothing;
    // its lines (one, or two where the words wrap), 20 each: what the panel's content is as tall as
    const lines = (cls: string, words: string): number =>
      ruler.width(cls, words) <= inner ? 1 : 2;
    /** The panel, its content set on the 4 grid from its top (centred, it would fall on half a pixel). */
    const panel = (cls: string, content: number, body: TemplateResult): TemplateResult => {
      const top = Math.max(0, Math.floor((height - content) / 2 / 4) * 4);
      return html`<div
        class="fv-empty-state sc-empty ${cls}"
        style="height:${height}px;padding-top:${top}px"
        role="status"
      >
        ${body}
      </div>`;
    };
    if (!tall) {
      // a line's room (today's): its words where they hold one line beside nothing else, the button alone otherwise
      const words = lines('fv-empty-state__text', text) === 1 || !create;
      const guest = s(hass, 'empty_guest');
      return panel(
        'sc-empty--line',
        (words ? 20 : 0) + (create ? (words ? 8 : 0) + 48 : 8 + 20),
        html`${words ? html`<span class="fv-empty-state__text">${text}</span>` : nothing}
        ${create ? button : html`<span class="fv-empty-state__hint">${guest}</span>`}`,
      );
    }
    const hint = s(hass, create ? 'empty_hint' : 'empty_guest');
    const fits = ruler.width('fv-empty-state__hint', hint) <= inner * 1.8;
    const content =
      44 +
      8 +
      20 * lines('fv-empty-state__text', text) +
      (fits ? 8 + 20 * lines('fv-empty-state__hint', hint) : 0) +
      (create ? 16 + 48 : 0);
    return panel(
      '',
      content,
      html`<span class="fv-empty-state__ring">${icon('calendar')}</span>
        <span class="fv-empty-state__text">${text}</span>
        ${fits ? html`<span class="fv-empty-state__hint">${hint}</span>` : nothing} ${button}`,
    );
  }

  protected renderCard(): TemplateResult {
    const config = this.config as ScheduleCardConfig;
    const hass = this.hass;
    const view = this.entity();
    const tie = this.tie();
    const plans = this.plans;
    const week = tie.schedule ? plans?.week(tie.schedule) : undefined;
    const waiting =
      tie.waiting ||
      (tie.schedule !== undefined && !week && !(plans?.settled(tie.schedule) ?? false));
    const automation = tie.automation ? this.entity(tie.automation) : undefined;
    const on = automation ? this.stateOf(automation) === 'on' : false;
    const presets = tie.heating?.presets ?? (week ? presetsNamed(week) : []);
    const looks = presetLooks(hass, config.presets, presets);
    const byKey = new Map(looks.map((look) => [look.key, look]));
    const activeKey = this.active(tie, on);
    const active = activeKey === undefined ? undefined : byKey.get(activeKey);
    if (config.variant === 'row') return this.renderRow(view, tie, week, waiting, byKey, active);
    const base = tie.heating ? byKey.get(tie.heating.base) : undefined;
    const today = this.clock();
    const tall = config.variant === 'today';
    const showHead = config.show_head !== false;
    const legend = config.show_presets !== false;
    const usable = isUsable(view);

    // the lines' column: the days' words, the widest of the seven as the week sets them (today's in its weight), on
    // the 4 grid, so the lines and the hours under them start on it
    const days = this.days();
    const words = days.map((day) => dayWord(hass, day));
    const label = tall
      ? 0
      : Math.ceil(
          Math.max(...words.map((word) => this.headFit.ruler.width('sc-day is-today', word))) / 4,
        ) * 4;
    const inset = tall ? 0 : label + 8;
    const width = Math.max(0, this.contentWidth - inset);
    const region = scheduleHeight(config) - 40 - (showHead ? 60 : 0);
    // the time it is now: the knob on today's line, the needle from it (through the week) to its bubble in the hours
    const now = nowAt(today.minute, width, tall);
    const clock = {
      x: now,
      text: clockOf(hass, today.minute),
      measure: (text: string) => this.headFit.ruler.width('sc-clock', text),
    };
    const lines = tall
      ? html`<div
          class="sc-today"
          role="button"
          tabindex="0"
          aria-label=${s(hass, 'card')}
          @click=${() => void this.openSheet(today.day)}
          @keydown=${(event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              void this.openSheet(today.day);
            }
          }}
        >
          ${this.renderTrack(week?.[today.day] ?? [], byKey, base, width, now, true, true)}
          ${needle(now, 16)}
        </div>`
      : html`<div
          class="sc-week"
          style="--sc-days:${label}px"
          role="button"
          tabindex="0"
          aria-label=${s(hass, 'card')}
          @click=${(event: MouseEvent) => this.tapWeek(event, days)}
          @keydown=${(event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              void this.openSheet();
            }
          }}
        >
          ${days.map(
            (day, index) =>
              html`<div
                class="sc-line ${day === today.day ? 'is-today' : ''}"
                style="--sc-row:${index}"
              >
                <p class="sc-day ${day === today.day ? 'is-today' : ''}">${words[index]}</p>
                ${this.renderTrack(
                  week?.[day] ?? [],
                  byKey,
                  base,
                  width,
                  now,
                  day === today.day,
                  false,
                )}
              </div>`,
          )}
          ${needle(inset + now)}
        </div>`;
    const body = waiting
      ? html`<div class="sc-wait" aria-busy="true">
          ${lines}${hours(hass, width, inset)}
          ${legend ? html`<div class="sc-legend"></div>` : nothing}
        </div>`
      : !week
        ? this.renderNoWeek(region, !tall, tie.schedule !== undefined)
        : html`${lines}${hours(hass, width, inset, clock)}
          ${legend ? this.renderLegend(looks, presets, tie.heating?.base, activeKey) : nothing}`;

    return html`<article class="fv-card ${usable ? '' : 'is-unavailable is-off'}" data-card>
      ${showHead ? this.renderHead(view, tie, active) : html`<div class="sc-head-off"></div>`}
      <div class="sc-body">${body}</div>
      ${this.renderSheet()}
    </article>`;
  }

  /** The sheet, in the card once its chunk has landed. */
  private renderSheet(): TemplateResult | typeof nothing {
    return this.sheetReady_
      ? html`<fluvy-heating-sheet
          ?dark=${this.dark}
          ?no-theme=${this.noTheme}
          .hass=${this.hass}
        ></fluvy-heating-sheet>`
      : nothing;
  }

  /** A tap on the week opens the sheet on the day under it (its line, by the pointer's height); Enter on today's. */
  private tapWeek(event: MouseEvent, days: readonly Weekday[]): void {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const row = Math.floor(((event.clientY - box.top) / Math.max(1, box.height)) * 7);
    void this.openSheet(event.detail === 0 ? undefined : days[Math.min(6, Math.max(0, row))]);
  }
}
