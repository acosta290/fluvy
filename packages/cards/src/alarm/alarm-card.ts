import {
  haptic,
  resolveEntity,
  stateText,
  strings,
  type EntityView,
  type HassEntity,
  type HomeAssistant,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import {
  badge,
  head,
  label,
  optionColumns,
  options,
  sheetStyles,
  type GlyphName,
  type OptionItem,
  type Tone,
} from '@fluvy/ui';

import { css, html, type CSSResultGroup, type PropertyValues, type TemplateResult } from 'lit';

import { changedLine, RowsCard, type RowsCardConfig } from '../lock/rows.js';

import { Card } from '../shared/base.js';

import { glyphFor } from '../shared/domain.js';

import { entitiesField, entityField, formLabels, nameIconFields } from '../shared/form.js';

import './keypad.js';
import type { FluvyKeypad, KeypadAction } from './keypad.js';
import type { RowsListSpec } from '../shared/rows-editor.js';

const s = strings('alarm');

export type AlarmCardConfig = RowsCardConfig;

type SKey = Parameters<typeof s>[1];
type ModeKey =
  'disarm' | 'arm_home' | 'arm_away' | 'arm_night' | 'arm_vacation' | 'arm_custom_bypass';

interface Mode {
  readonly key: ModeKey;
  /** The state the panel reports once this mode is in force. */
  readonly state: string;
  readonly service: string;
  /** `supported_features` bit; 0 for disarm, which every panel can do. */
  readonly bit: number;
  readonly glyph: GlyphName;
  readonly tile: SKey;
  readonly value: SKey;
}

const DISARM: Mode = {
  key: 'disarm',
  state: 'disarmed',
  service: 'alarm_disarm',
  bit: 0,
  glyph: 'unlock',
  tile: 'disarmed',
  value: 'v_off',
};
const MODES: readonly Mode[] = [
  DISARM,
  {
    key: 'arm_home',
    state: 'armed_home',
    service: 'alarm_arm_home',
    bit: 1,
    glyph: 'home',
    tile: 'home',
    value: 'v_perimeter',
  },
  {
    key: 'arm_away',
    state: 'armed_away',
    service: 'alarm_arm_away',
    bit: 2,
    glyph: 'away',
    tile: 'away',
    value: 'v_all',
  },
  {
    key: 'arm_night',
    state: 'armed_night',
    service: 'alarm_arm_night',
    bit: 4,
    glyph: 'moon',
    tile: 'night',
    value: 'v_night',
  },
  {
    key: 'arm_vacation',
    state: 'armed_vacation',
    service: 'alarm_arm_vacation',
    bit: 32,
    glyph: 'map',
    tile: 'vacation',
    value: 'v_extended',
  },
  {
    key: 'arm_custom_bypass',
    state: 'armed_custom_bypass',
    service: 'alarm_arm_custom_bypass',
    bit: 16,
    glyph: 'shield',
    tile: 'custom',
    value: 'v_bypass',
  },
];

/** A panel that reports no features at all still arms home and away — the two every integration has. */
const DEFAULT_FEATURES = 1 | 2;
/** How long the chosen tile stays lit while the panel has not answered yet. */
const PENDING_MS = 4000;

/**
 * The card picker shows a live preview built from `getStubConfig`. A home without an alarm panel would
 * get no preview at all (only the description), so the stub names this placeholder, which the card draws
 * as a disarmed panel arming home, away and night until an entity is chosen.
 */
const PREVIEW_ENTITY = 'alarm_control_panel.fluvy_preview';

function previewState(hass: HomeAssistant): HassEntity {
  const now = new Date().toISOString();
  return {
    entity_id: PREVIEW_ENTITY,
    state: 'disarmed',
    last_changed: now,
    last_updated: now,
    attributes: {
      friendly_name: s(hass, 'preview'),
      supported_features: 1 | 2 | 4,
      code_format: null,
    },
  };
}

/**
 * The alarm panel: state in the head, the modes the panel really supports as option tiles, sensors
 * as rows. Arming without a code is one tap. Disarming never is: it goes through the sheet — the
 * keypad when the panel wants a code, a confirmation when it does not. The card never pretends:
 * the badge shows what the panel reports, only the chosen tile lights up while it answers.
 */
export class FluvyAlarmCard extends RowsCard<AlarmCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.devices,
    css`
      .dv-card {
        width: auto;
      }
      .fv-options {
        row-gap: 4px;
      }
      /* a tile too narrow for "Perimeter" keeps the glyph and the mode, and gives the empty line back */
      .is-compact .fv-option__value {
        display: none;
      }
    `,
  ];

  static override properties = { ...Card.properties, pending_: { state: true } };

  /** The mode the user just chose, lit until the panel's state moves (or a few seconds pass). */
  declare pending_: ModeKey | '';

  private pendingTimer = 0;

  constructor() {
    super();
    this.pending_ = '';
  }

  static override lists: readonly RowsListSpec[] = [
    { key: 'rows', title: 'editor.rows', schema: [entityField(), nameIconFields()] },
  ];
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [entityField(['alarm_control_panel']), nameIconFields(), entitiesField('rows')],
      ...formLabels({
        rows: 'editor.entities',
      }),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): AlarmCardConfig {
    return {
      type: 'custom:fluvy-alarm-card',
      entity: entities.find((id) => id.startsWith('alarm_control_panel.')) ?? PREVIEW_ENTITY,
    };
  }

  protected override entity(id: string | undefined = this.config?.entity): EntityView {
    const hass = this.hass;
    if (id !== PREVIEW_ENTITY || !hass || hass.states[id]) return super.entity(id);
    return resolveEntity({ ...hass, states: { ...hass.states, [id]: previewState(hass) } }, id);
  }

  protected override prepare(config: AlarmCardConfig): AlarmCardConfig {
    if (!config.entity) throw new Error('fluvy-alarm-card: "entity" is required');
    return super.prepare(config);
  }

  override getCardSize(): number {
    return 4 + this.rowCount;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearPending();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    const previous = changed.get('hass') as HomeAssistant | undefined;
    const id = this.config?.entity ?? '';
    if (this.pending_ && previous && previous.states[id]?.state !== this.hass?.states[id]?.state)
      this.clearPending(); // the panel answered
  }

  /* ---------- model ---------- */

  private modes(view: EntityView): Mode[] {
    const features = view.attr<number | null>('supported_features') || DEFAULT_FEATURES;
    return MODES.filter((mode) => mode.bit === 0 || (features & mode.bit) !== 0);
  }

  /** Disarming always carries the code when the panel has one; arming only when the panel says so. */
  private needsCode(view: EntityView, key: ModeKey): boolean {
    if (!view.attr<string | null>('code_format')) return false;
    return key === 'disarm' || view.attr<boolean | null>('code_arm_required') !== false;
  }

  private actionLabel(key: ModeKey): string {
    switch (key) {
      case 'disarm':
        return this.t('alarm.disarm');
      case 'arm_home':
        return this.t('alarm.arm_home');
      case 'arm_away':
        return this.t('alarm.arm_away');
      case 'arm_night':
        return this.t('alarm.arm_night');
      case 'arm_vacation':
        return s(this.hass, 'arm_vacation');
      case 'arm_custom_bypass':
        return s(this.hass, 'arm_custom');
    }
  }

  /** The tile to light: the user's choice while it is pending, else the mode in force, else the one the panel is heading to or came from. */
  private activeState(view: EntityView): string {
    const state = view.state;
    if (state === 'arming') return view.attr<string | null>('next_state') ?? '';
    if (state === 'pending' || state === 'triggered')
      return view.attr<string | null>('previous_state') ?? '';
    return state;
  }

  /** The quiet button beside the sheet's main action: the other thing one does with a code in hand. */
  private alternative(view: EntityView, chosen: Mode, modes: readonly Mode[]): Mode | undefined {
    const arms = modes.filter(
      (mode) => mode.bit !== 0 && mode.key !== chosen.key && mode.state !== view.state,
    );
    if (chosen.key !== 'disarm' && view.state !== 'disarmed') return DISARM;
    return arms.find((mode) => mode.key === 'arm_away') ?? arms[0];
  }

  /* ---------- actions ---------- */

  private clearPending(): void {
    clearTimeout(this.pendingTimer);
    this.pendingTimer = 0;
    if (this.pending_) this.pending_ = '';
  }

  private choose(view: EntityView, key: string): void {
    const modes = this.modes(view);
    const mode = modes.find((m) => m.key === key);
    if (!mode || view.status !== 'ok' || view.state === mode.state) return;
    const coded = this.needsCode(view, mode.key);
    if (coded && view.attr<string | null>('code_format') !== 'number') {
      this.tap(view.id, { action: 'more-info' });
      return;
    } // letters belong in Home Assistant's own dialog, which has a text field
    if (!coded && mode.key !== 'disarm') {
      haptic(this, 'light');
      void this.send(mode).then((done) => haptic(this, done ? 'success' : 'failure'));
      return;
    }
    const action = (m: Mode): KeypadAction => ({
      key: m.key,
      label: this.actionLabel(m.key),
      code: this.needsCode(view, m.key),
    });
    const other = coded ? this.alternative(view, mode, modes) : undefined;
    this.keypad?.open({
      title: this.actionLabel(mode.key),
      sub: `${this.config?.name ?? view.name} · ${stateText(this.hass, view).toLocaleLowerCase(this.hass?.language)}`,
      primary: action(mode),
      secondary: other ? action(other) : undefined,
      run: (chosen, code) => this.send(modes.find((m) => m.key === chosen) ?? mode, code),
    });
  }

  /** No optimistic state here: a wrong code must never read "Disarmed", not even for a second. */
  private async send(mode: Mode, code?: string): Promise<boolean> {
    const id = this.config?.entity;
    if (!this.hass || !id) return false;
    this.clearPending();
    this.pending_ = mode.key;
    this.pendingTimer = window.setTimeout(() => this.clearPending(), PENDING_MS);
    try {
      await this.hass.callService('alarm_control_panel', mode.service, code ? { code } : {}, {
        entity_id: id,
      });
      return true;
    } catch {
      this.clearPending(); // Home Assistant says why in its own toast
      return false;
    }
  }

  private get keypad(): FluvyKeypad | null {
    return this.renderRoot.querySelector('fluvy-keypad');
  }

  /* ---------- render ---------- */

  /** The gap that leaves every option tile a whole multiple of 4 px wide in this column. */
  private tileGap(width: number, columns: number): number {
    for (const gap of [4, 8, 12, 16])
      if ((width - (columns - 1) * gap) % (4 * columns) === 0) return gap;
    return 4;
  }

  protected renderCard(): TemplateResult {
    const view = this.entity();
    const name = this.config?.name ?? view.name;
    if (view.status === 'missing')
      return this.renderEmpty(`${name} · ${stateText(this.hass, view)}`);

    const unusable = view.status === 'unavailable';
    const state = view.state;
    const alerting = state === 'triggered' || state === 'arming' || state === 'pending';
    const tone: Tone = unusable
      ? 'off'
      : alerting
        ? 'warning'
        : state.startsWith('armed_')
          ? 'accent'
          : 'neutral';
    const modes = this.modes(view);
    const lit = this.pending_
      ? MODES.find((mode) => mode.key === this.pending_)?.state
      : this.activeState(view);

    const columns = optionColumns(modes.length);
    const gap = this.tileGap(this.contentWidth, columns);
    const compact = (this.contentWidth - (columns - 1) * gap) / columns < 104;
    const tiles: OptionItem[] = modes.map((mode) => ({
      key: mode.key,
      label: s(this.hass, mode.tile),
      value: compact ? '' : s(this.hass, mode.value),
      glyph: mode.glyph,
      tone: mode.bit === 0 ? 'neutral' : alerting && !this.pending_ ? 'warning' : 'accent',
      active: !unusable && lit === mode.state,
    }));

    return html`<article
        class="fv-card dv-card ${unusable ? 'is-unavailable' : ''} ${compact ? 'is-compact' : ''}"
        data-card
      >
        ${head({
          icon: this.config?.icon ?? glyphFor(view),
          tone,
          title: name,
          sub: changedLine(this.hass, view),
          trailing: badge(
            state.startsWith('armed_') ? s(this.hass, 'armed') : stateText(this.hass, view),
            tone,
          ),
          onIconTap: () => this.tap(view.id, { action: 'more-info' }),
          iconLabel: name,
        })}
        ${label(s(this.hass, 'mode'))}
        ${options(tiles, unusable ? null : (key) => this.choose(view, key), gap, compact ? 64 : 84, columns)}
        ${this.renderRows()}
      </article>
      <fluvy-keypad .hass=${this.hass}></fluvy-keypad>`;
  }
}
