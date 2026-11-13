import {
  formatNumber,
  formatTime,
  isUsable,
  numberAttr,
  strings,
  valueParts,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  actions,
  addGlyphs,
  clamp,
  head,
  label,
  readout,
  rulerLabels,
  sheetStyles,
  type ActionItem,
  type ChipItem,
  type Tone,
} from '@fluvy/ui';

import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { batteryOf } from '../shared/battery.js';
import { Card, type CardEditor } from '../shared/base.js';

import { iconOf } from '../shared/domain.js';
import {
  actionGap,
  actionsThatFit,
  headSub,
  Hold,
  motionStyles,
  sharedGap,
  shownStateText,
} from '../cover/common.js';
import type { RowStyle } from '../shared/config.js';
import { chipRow } from '../shared/chips.js';
import { modeWord } from '../shared/mode-words.js';
import { HeadFit } from '../energy/head.js';
import { drawnAs } from '../shared/heights.js';
import { statsRow, type StatText } from '../shared/readouts.js';
import {
  MOWER_BITS,
  usual,
  VACUUM_BITS,
  vacuumHeight,
  type Command,
  type RobotBits,
} from '../vacuum-family.js';
import {
  driveProfile,
  ownDrive,
  type DriveProfile,
  type DriveSpeed,
  type DriveStyle,
} from './drive.js';
import type { DriveEndDetail } from './drive/drive-pad.js';
import type { DriveSheetHost } from './drive/drive-sheet.js';

const vacuumStrings = strings('vacuum');
const driveStrings = strings('drive');

/** The Drive command's glyph, in the set's hand: an arrow each way. */
addGlyphs({
  drive:
    '<path d="M12 4v16"/><path d="M4 12h16"/><path d="m9.5 6.5 2.5-2.5 2.5 2.5"/><path d="m17.5 9.5 2.5 2.5-2.5 2.5"/><path d="m14.5 17.5-2.5 2.5-2.5-2.5"/><path d="m6.5 14.5-2.5-2.5 2.5-2.5"/>',
});

/**
 * The drive pad (its ring, its remote control from start to stop, its sheet): a chunk of its own, fetched by the
 * first card that draws a Drive command, so it is here before the command is tapped.
 */
let pad: Promise<unknown> | undefined;
let padHere = false;
const loadPad = (): Promise<unknown> =>
  (pad ??= import('./drive/drive-sheet.js').then(() => {
    padHere = true;
  }));

/** The pad's ring: the remote's 176 where its room holds it, down to the 144 its arrows and its Stop need. */
const RING = 176;
const RING_MIN = 144;
/** How long a refused call keeps the card in its error's tone. */
const FAILED_MS = 3000;

/** `full` (default): the readouts, the battery, the commands and the suction. `compact`: the head and the commands. */
export type VacuumVariant = 'full' | 'compact';

export interface VacuumCardConfig extends FluvyCardConfig {
  subtitle?: string;
  variant?: VacuumVariant;
  show_battery?: boolean;
  /** Sensors the integration exposes beside the robot itself. A column exists only for what is configured. */
  area_entity?: string;
  duration_entity?: string;
  remaining_entity?: string;
  /** The battery sensor. Left out, the card looks for one on the robot's own device. */
  battery_entity?: string;
  /** Suction speeds: chips that fill the row (default) or content-sized chips. */
  suction_style?: RowStyle;
  /** The drive pad (1.20, #178): a Drive command where the robot can be driven by hand. Off by default. */
  show_drive?: boolean;
  /** The robot the pad drives where it is not the card's own (the same robot through another integration). */
  drive_entity?: string;
  /** How far a press moves the robot: `normal` (default), `slow` or `fast`. */
  drive_speed?: DriveSpeed;
  /** Where the pad opens: `card` (default; in its sheet where the card has no room for the ring) or `sheet`. */
  drive_style?: DriveStyle;
  /** A robot's own calls where no integration's are known: `start`, `move` and `stop`, each an action (`drive.ts`). */
  drive?: unknown;
  /** Test hooks: the card held in its drive mode, or its sheet docked in its place (the playground). Undocumented. */
  _drive?: boolean;
  _sheet?: boolean;
}

interface Robot {
  readonly running: string;
  readonly bits: RobotBits;
  /** Command → the service to call and the state to show until Home Assistant answers. */
  readonly services: Readonly<
    Partial<Record<Command, readonly [service: string, expect: string | null]>>
  >;
}

const VACUUM: Robot = {
  running: 'cleaning',
  bits: VACUUM_BITS,
  services: {
    start: ['start', 'cleaning'],
    pause: ['pause', 'paused'],
    stop: ['stop', 'idle'],
    dock: ['return_to_base', 'returning'],
    locate: ['locate', null],
  },
};

/** A lawn mower is the same machine outdoors, with three features of its own. */
const MOWER: Robot = {
  running: 'mowing',
  bits: MOWER_BITS,
  services: {
    start: ['start_mowing', 'mowing'],
    pause: ['pause', 'paused'],
    dock: ['dock', 'returning'],
  },
};

const GAUGE: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0.25, 25],
  [0.5, 50],
  [0.75, 75],
  [1, 100],
];

/**
 * The robot: what it is doing, the numbers the integration exposes (area, elapsed, remaining — only
 * the ones that are configured), the battery as a read-only marker gauge, the command row, and
 * suction as chips. Lawn mowers are served by the same card. Asked for (`show_drive`), a robot that can be driven by
 * hand gains a Drive command: the battery and the suction give their room to the drive pad, the card as tall as it
 * was, until Done (#178); a card with no room for the ring opens it in a sheet.
 */
export class FluvyVacuumCard extends Card<VacuumCardConfig> {
  /** The card's height at a 360 column from its config alone: every part (`vacuumHeight`). */
  static override layoutHeight(config: VacuumCardConfig): number {
    return vacuumHeight(config);
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.devices,
    motionStyles,
    css`
      /* the sheet's 3 × 96 + 2 × 16 at 320, fluid: as many columns as hold every label and figure (\`statsRow\`), a
         shorter last row's one readout across the row */
      .dv-cols {
        grid-template-columns: repeat(var(--dv-cols, 3), minmax(0, 1fr));
      }
      /* the battery, the commands and the suction: a column whose commands step under the other two while the robot
         is driven, so the pad takes the room the two leave, hidden, and the card stays as tall as it was */
      .vc-body {
        position: relative;
        display: flex;
        flex-direction: column;
      }
      .vc-body.is-driving > .vc-part {
        visibility: hidden;
      }
      .vc-body.is-driving > .fv-actions {
        order: 1;
      }
      /* a shorter last row of commands, a row of its own: under the first by the rows' own gap */
      .fv-actions + .fv-actions {
        margin-top: var(--dv-action-gap, 16px);
      }
      /* the pad: over the two parts, 16 under what precedes them as their labels are */
      fluvy-drive-pad {
        position: absolute;
        inset: 16px 0 auto;
      }
    `,
  ];

  static override properties = {
    ...Card.properties,
    driving_: { state: true },
    sheet_: { state: true },
    room_: { state: true },
    failed_: { state: true },
  };
  /** The robot is driven: the pad is drawn, in the card or in its sheet. */
  declare driving_: boolean;
  /** The pad is in the sheet: asked for, or the card has no room for its ring. */
  declare sheet_: boolean;
  /** The room the battery and the suction leave the pad in the card, as last measured; 0 before it is. */
  declare room_: number;
  /** A drive call was refused: the card wears its error's tone for a moment. */
  declare failed_: boolean;

  private readonly suctionHold = new Hold<string | null>(this);
  private readonly head = new HeadFit(this);
  private failedTimer = 0;
  /** The playground's hooks, taken once: the pad's chunk, then the card in its drive mode (or its sheet, docked). */
  private demo = false;

  constructor() {
    super();
    this.driving_ = false;
    this.sheet_ = false;
    this.room_ = 0;
    this.failed_ = false;
  }

  static override editor(): Promise<CardEditor> {
    return import('./vacuum-editor.js');
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): VacuumCardConfig {
    return {
      type: 'custom:fluvy-vacuum-card',
      entity: entities.find((id) => /^(vacuum|lawn_mower)\./.test(id)) ?? '',
    };
  }

  protected override prepare(config: VacuumCardConfig): VacuumCardConfig {
    if (!config.entity) throw new Error('fluvy-vacuum-card: "entity" is required');
    const drive = ownDrive(config.drive);
    if (typeof drive === 'string') throw new Error(`fluvy-vacuum-card: ${drive}`);
    return config;
  }

  override getCardSize(): number {
    return this.config?.variant === 'compact' ? 3 : 6;
  }
  /** The full card needs its ruler's width; the compact one — the head and the commands — half a section at least. */
  override getGridOptions(): LovelaceGridOptions {
    return this.config?.variant === 'compact'
      ? { columns: 6, rows: 'auto', min_columns: 6 }
      : { columns: 12, rows: 'auto', min_columns: 8 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.suctionHold.clear();
    // a card off the page drives no robot: its pad ends remote control as it goes with it
    clearTimeout(this.failedTimer);
    this.driving_ = this.failed_ = false;
  }

  protected override watched(): readonly string[] {
    const c = this.config;
    return [
      c?.entity,
      c?.area_entity,
      c?.duration_entity,
      c?.remaining_entity,
      c?.drive_entity,
      this.batteryId(),
    ].filter((id): id is string => Boolean(id));
  }

  /**
   * The battery sensor: the configured one, or the `battery` sensor on the robot's own device — Home Assistant moved
   * the battery out of the vacuum's attributes into a sensor of its own.
   */
  private batteryId(): string | undefined {
    return this.config?.battery_entity || batteryOf(this.hass, this.config?.entity ?? '');
  }

  private command(view: EntityView, robot: Robot, key: Command | 'drive'): void {
    if (key === 'drive') {
      void this.toggleDrive();
      return;
    }
    const entry = robot.services[key];
    if (!entry) return;
    // a robot sent to work or to its dock is driven no more: remote control ends first, then the command goes
    if (key !== 'locate') this.leaveDrive();
    const [service, expected] = entry;
    if (expected) this.expect(view.id, expected);
    this.call(view.domain, service);
  }

  /* ---------- the drive pad ---------- */

  /**
   * How the card's robot is driven, where the card is asked for its drive pad and a way is known (`driveProfile`):
   * what draws the Drive command.
   */
  private driveWay(): DriveProfile | undefined {
    return this.config?.show_drive ? driveProfile(this.hass, this.config) : undefined;
  }

  /** Whether the robot the pad drives is out of reach: the card's, and the one it names where it is another. */
  private driveStill(view: EntityView): boolean {
    const other = this.config?.drive_entity;
    return !isUsable(view) || (Boolean(other) && !isUsable(this.entity(other)));
  }

  /** The Drive command: into the mode once the pad's chunk is here, and out of it, as Done. */
  private async toggleDrive(): Promise<void> {
    if (this.driving_) {
      this.leaveDrive();
      return;
    }
    await loadPad();
    if (!this.isConnected) return;
    const { variant, drive_style } = this.config ?? {};
    this.sheet_ = variant === 'compact' || drive_style === 'sheet';
    this.room_ = 0;
    this.failed_ = false;
    this.driving_ = true;
  }

  /**
   * Out of the mode: the pad in the card ends remote control now (one in the sheet as the sheet goes); a refused
   * call leaves the card in its error's tone for three seconds.
   */
  private leaveDrive(failed = false): void {
    if (!this.driving_) return;
    this.driving_ = false;
    const root = this.renderRoot as ShadowRoot;
    const pad = root.querySelector('fluvy-drive-pad');
    pad?.end();
    // the focus the pad held goes back to the command it came from
    if (pad && root.activeElement === pad)
      void this.updateComplete.then(() => {
        const drive = driveStrings(this.hass, 'start');
        [...root.querySelectorAll<HTMLElement>('.fv-action')]
          .find((cell) => cell.getAttribute('aria-label') === drive)
          ?.focus();
      });
    if (!failed) return;
    this.failed_ = true;
    clearTimeout(this.failedTimer);
    this.failedTimer = window.setTimeout(() => {
      this.failed_ = false;
    }, FAILED_MS);
  }

  /** Remote control is over by itself (ten seconds without a press, a hidden page, the sheet closed) or was refused. */
  private readonly onDriveEnd = (event: Event): void =>
    this.leaveDrive((event as CustomEvent<DriveEndDetail>).detail.failed);

  /** What the sheet asks of the card: the robot's name, how it is driven, the card's colours. */
  private readonly sheetHost: DriveSheetHost = {
    title: () => this.nameFor(this.entity(), this.config?.name),
    profile: () => (this.config?._sheet ? undefined : this.driveWay()),
    adopt: (root) => this.accents.adopt(root),
  };

  /** The pad's sheet; docked in the card's place for the playground. */
  private renderSheet(docked: boolean): TemplateResult {
    return html`<fluvy-drive-sheet
      ?docked=${docked}
      .hass=${this.hass}
      .card=${this.sheetHost}
      @fluvy-drive-end=${this.onDriveEnd}
    ></fluvy-drive-sheet>`;
  }

  /**
   * The pad's ring in the card: the largest the room and the column hold on the 4 grid, the remote's 176 at most;
   * none where they hold less than its arrows and its Stop need.
   */
  private get ring(): number {
    const size = Math.min(RING, Math.floor(Math.min(this.room_, this.contentWidth) / 4) * 4);
    return size >= RING_MIN ? size : 0;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const config = this.config;
    if ((config?._drive || config?._sheet) && !this.demo) {
      this.demo = true;
      void (config._drive ? this.toggleDrive() : loadPad().then(() => this.requestUpdate()));
    }
    // what the mode reads off the card as it is now drawn, once this update is over: it may draw the card again
    if (this.driving_) void this.updateComplete.then(() => this.settleDrive());
  }

  /** The mode held to the card as it stands: left where the robot went out of reach, else the pad's room measured. */
  private settleDrive(): void {
    if (!this.driving_) return;
    if (this.driveStill(this.entity()) || !this.driveWay()) this.leaveDrive();
    else if (!this.sheet_) this.fitPad();
  }

  /**
   * The room the pad has in the card, measured: what the battery and the suction take, less the 16 over them. A
   * card with no room for the ring (neither part, one alone, a narrow column) opens the pad in its sheet.
   */
  private fitPad(): void {
    const parts = this.renderRoot.querySelectorAll<HTMLElement>('.vc-part');
    this.room_ = Math.max(0, [...parts].reduce((room, part) => room + part.offsetHeight, 0) - 16);
    if (!this.ring) this.sheet_ = true;
  }

  /** A configured sensor's statistic, "—" while it cannot be read; nothing when it is not configured. */
  private column(id: string | undefined, label: string): StatText | null {
    if (!id) return null;
    const parts = valueParts(this.hass, this.entity(id));
    return { label, value: parts.value, unit: parts.unit };
  }

  /**
   * The readouts (the area, the time, the time left) in as many equal columns as hold every label and figure at the
   * size the widest fits (`statsRow`, measured): three in a phone's column, two and one in a 211 column, never cut.
   */
  private renderColumns(stats: readonly StatText[], w: number): TemplateResult {
    const row = statsRow(this.head.ruler, w, stats);
    return html`<div
      class="dv-cols fv-cols ${row.odd ? 'fv-cols--odd' : ''}"
      style="--dv-cols:${row.columns}"
    >
      ${stats.map((stat) => readout({ label: stat.label, value: stat.value, unit: stat.unit ?? '', size: row.size }))}
    </div>`;
  }

  protected renderCard(): TemplateResult | typeof nothing {
    if (this.config?._sheet) return padHere ? this.renderSheet(true) : nothing;
    // out of reach (unavailable, missing; never read: its usual parts) it keeps its anatomy and its size, its controls
    // disabled: only the colours change (1.9)
    const found = this.entity();
    const robot = found.domain === 'lawn_mower' ? MOWER : VACUUM;
    const view = drawnAs(found, usual(robot.bits));
    const name = this.nameFor(view, this.config?.name);
    const unusable = !isUsable(view);
    const compact = this.config?.variant === 'compact';
    const shown = this.stateOf(view);
    const running = shown === robot.running;
    const tone: Tone = unusable
      ? 'off'
      : shown === 'error' || this.failed_
        ? 'warning'
        : running || shown === 'returning'
          ? 'accent'
          : 'neutral';
    const w = this.contentWidth;
    const has = (key: Command | 'suction' | 'battery'): boolean =>
      robot.bits[key] !== 0 && view.supports(robot.bits[key]);

    const columns = [
      this.column(this.config?.area_entity, vacuumStrings(this.hass, 'area')),
      this.column(this.config?.duration_entity, vacuumStrings(this.hass, 'elapsed')),
      this.column(this.config?.remaining_entity, this.t('timer.remaining')),
    ].filter((column): column is StatText => column !== null);

    // the battery: its own sensor where there is one, the legacy attribute otherwise; the gauge is there for a robot
    // that says it has one, at rest while it cannot be read (unknown, out of reach, its sensor gone)
    const batteryId = this.batteryId();
    const sensor = batteryId ? this.entity(batteryId) : undefined;
    const level =
      sensor && sensor.status !== 'missing' ? sensor.number : numberAttr(view, 'battery_level');
    const hasBattery =
      !compact &&
      this.config?.show_battery !== false &&
      (level !== null || sensor !== undefined || has('battery'));
    const battery = level === null || unusable ? null : clamp(Math.round(level), 0, 100);

    // the drive pad: asked for, and the robot's integration (or the config) knows how it is driven
    const profile = this.driveWay();
    if (profile) void loadPad();
    const still = this.driveStill(view);
    const driving = Boolean(profile) && !still && this.driving_;
    const inCard = driving && !this.sheet_;
    // held in its mode for the playground, the pad is drawn and drives nothing, and no sheet opens over the page
    const held = this.config?._drive === true;

    const row: ActionItem[] = [];
    if (has('start') || has('pause')) {
      // while the robot is driven, Done is the row's one filled cell
      const primary = !unusable && !driving;
      row.push(
        running
          ? {
              key: 'pause',
              glyph: 'pause',
              label: this.t('vacuum.pause'),
              primary,
              disabled: unusable || !has('pause'),
            }
          : {
              key: 'start',
              glyph: 'play',
              label: this.t('vacuum.start'),
              primary,
              disabled: unusable || !has('start'),
            },
      );
    }
    if (has('stop'))
      row.push({ key: 'stop', glyph: 'stop', label: this.t('vacuum.stop'), disabled: unusable });
    if (has('dock'))
      row.push({
        key: 'dock',
        glyph: 'dock',
        label: this.t('vacuum.dock'),
        disabled: unusable || shown === 'docked' || shown === 'returning',
      });
    if (has('locate'))
      row.push({
        key: 'locate',
        glyph: 'locate',
        label: this.t('vacuum.locate'),
        disabled: unusable,
      });

    if (profile)
      row.push(
        driving
          ? { key: 'drive', glyph: 'check', label: driveStrings(this.hass, 'done'), primary: true }
          : {
              key: 'drive',
              glyph: 'drive',
              label: driveStrings(this.hass, 'start'),
              disabled: still,
            },
      );

    if (compact) {
      // a compact card keeps the commands that fit: start or pause first, the drive it was asked for, the dock, then
      // stop and locate
      const rank = { start: 0, pause: 0, drive: 1, dock: 2, stop: 3, locate: 4 } as const;
      row.sort((a, b) => rank[a.key as Command | 'drive'] - rank[b.key as Command | 'drive']);
      row.splice(actionsThatFit(this.contentWidth));
    }
    const speeds = has('suction')
      ? ((view.attr<unknown>('fan_speed_list') as unknown[] | undefined) ?? []).filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    const speed = this.suctionHold.read(view.attr<string | null>('fan_speed') ?? null);
    const chipItems: ChipItem[] = speeds.map((item) => ({
      key: item,
      label: modeWord(this.rawHass, view, 'fan_speed', item),
      active: !unusable && item === speed,
    }));

    const started =
      running && view.stateObj
        ? vacuumStrings(this.hass, 'started', {
            time: formatTime(this.hass, new Date(view.stateObj.last_changed)),
          })
        : '';
    const { sub, shorter } = this.subtitle(
      view.areaName && started
        ? `${view.areaName} · ${started}`
        : view.areaName || started.charAt(0).toUpperCase() + started.slice(1),
    );
    const batteryText = `${this.t('vacuum.battery')} · ${battery === null ? '—' : `${formatNumber(this.hass, battery, { digits: 0 })} %`}`;
    // the head fitted to its column: the badge steps aside before the name is cut, then the sub, then the icon
    const fitted = this.head.fit({
      width: w,
      title: name,
      sub: headSub(sub, w),
      shorter,
      badge: { text: shownStateText(this.hass, view, shown), tone },
    });
    // the commands in equal cells, two rows where one would leave a cell under a finger's 44; a last row that holds
    // fewer (five commands: three and two) is a row of its own, its cells sharing the column on a gap both rows land on
    const laid = actionGap(w, row.length);
    const short = row.length % laid.columns;
    const gap = short ? sharedGap(w, [laid.columns, short]).gap : laid.gap;
    const rows = short ? [row.slice(0, -short), row.slice(-short)] : [row];
    const run = (key: string): void => this.command(view, robot, key as Command | 'drive');

    const card = html`<article
      class="fv-card dv-card ${unusable ? 'is-unavailable is-off' : ''}"
      style="--dv-action-gap:${gap}px"
      data-card
    >
      ${head({
        icon: fitted.icon ? iconOf(view, this.config?.icon) : null,
        tone,
        title: name,
        name: true,
        sub: fitted.sub,
        trailing: fitted.badge,
        cut: fitted.cut,
        ...this.headActions(view.id),
      })}
      ${columns.length && !compact ? this.renderColumns(columns, w) : nothing}
      <div class="vc-body ${inCard ? 'is-driving' : ''}">
        ${
          hasBattery
            ? html`<div class="vc-part">
                ${label(batteryText)}
                <div class="dv-gauge">
                  <fluvy-ruler
                    marker
                    ?inactive=${battery === null}
                    .value=${battery ?? 0}
                    .min=${0}
                    .max=${100}
                    .step=${1}
                    .length=${w}
                    .tone=${battery !== null && battery <= 20 ? 'warning' : 'accent'}
                    unit="%"
                    .label=${`${name} · ${this.t('vacuum.battery')}`}
                    .format=${(value: number) => formatNumber(this.hass, value, { digits: 0 })}
                  ></fluvy-ruler>
                </div>
                ${rulerLabels(GAUGE.map(([fraction, value]) => [fraction, formatNumber(this.hass, value, { digits: 0 })] as const))}
              </div>`
            : nothing
        }
        ${row.length ? rows.map((cells) => actions(cells, run, Math.min(cells.length, laid.columns))) : nothing}
        ${
          chipItems.length && !compact
            ? html`<div class="vc-part">
                ${label(this.t('vacuum.suction'))}${chipRow(
                  chipItems,
                  (key) => {
                    if (unusable) return;
                    this.suctionHold.set(key);
                    this.call('vacuum', 'set_fan_speed', { fan_speed: key });
                  },
                  this.config?.suction_style,
                  { ruler: this.head.ruler, width: this.contentWidth },
                )}
              </div>`
            : nothing
        }
        ${
          inCard && this.ring
            ? html`<fluvy-drive-pad
                style="height:${this.room_}px"
                .hass=${this.hass}
                .profile=${held ? undefined : profile}
                .size=${this.ring}
                @fluvy-drive-end=${this.onDriveEnd}
              ></fluvy-drive-pad>`
            : nothing
        }
      </div>
    </article>`;
    // a card with no room for the ring, or asked for it, is driven from its sheet
    return driving && !inCard && !held ? html`${card}${this.renderSheet(false)}` : card;
  }
}
