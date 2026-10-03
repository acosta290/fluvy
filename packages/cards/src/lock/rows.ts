import {
  formatTime,
  isActive,
  isUsable,
  relativeTime,
  stateText,
  strings,
  TOGGLE_DOMAINS,
  toggleEntity,
  valueParts,
  type ActionConfig,
  type EntityView,
  type FluvyCardConfig,
  type HaFormSchemaItem,
  type HomeAssistant,
} from '@fluvy/core';
import { listRow, type Tone } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { Card } from '../shared/base.js';
import { currentTone, glyphFor, toneFor } from '../shared/domain.js';
import { toneOf } from '../shared/colour.js';
import { type Secondary } from '../shared/config.js';
import { secondaryText } from '../shared/secondary.js';
import { TemplateTexts } from '../shared/templates.js';
import {
  actionField,
  colourFields,
  entityField,
  nameIconFields,
  selectField,
} from '../shared/form.js';

export interface RowConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** What the row says under its name: area, last change, state, none, an attribute, or a template; the area, else the time. */
  secondary?: Secondary;
  tap_action?: ActionConfig;
  tone?: Tone;
  color?: string;
}

/** The fields a row of any list may carry, as its editor shows them. */
export const ROW_KEYS = [
  'entity',
  'name',
  'icon',
  'secondary',
  'tap_action',
  'tone',
  'color',
] as const;

/** A row's form: the entity, its name and icon, what it says, its colours, its tap. */
export const rowSchema = (domains?: readonly string[]): HaFormSchemaItem[] => [
  entityField(domains),
  nameIconFields(),
  selectField('secondary', ['area', 'last-changed', 'state', 'none'], { custom: true }),
  colourFields(),
  actionField(),
];

export interface RowsCardConfig extends FluvyCardConfig {
  /** Entities shown as 60 px rows under the card's own control. */
  rows?: ReadonlyArray<string | RowConfig>;
  show_rows?: boolean;
}

const s = strings('lock');

/** A row switch is only for what is harmless to flip by accident — never a lock, a garage door or a valve. */
const NEVER_A_SWITCH = new Set([
  'lock',
  'cover',
  'valve',
  'scene',
  'script',
  'button',
  'input_button',
  'vacuum',
  'media_player',
]);
/** Domains whose state is worth reading at the end of the row. */
const READ_OUT = new Set([
  'sensor',
  'binary_sensor',
  'lock',
  'cover',
  'valve',
  'person',
  'device_tracker',
  'sun',
  'input_select',
  'select',
  'number',
  'input_number',
  'counter',
  'timer',
]);

/** Within half a day a time of day cannot be misread; after that a bare "21:40" would lie about the day. */
const RECENT_MS = 12 * 3600_000;

function lastChanged(view: EntityView): { date: Date; recent: boolean } | null {
  if (!view.stateObj) return null;
  const date = new Date(view.stateObj.last_changed);
  if (Number.isNaN(date.getTime())) return null;
  return { date, recent: Date.now() - date.getTime() < RECENT_MS };
}

/** A recent change reads as its time ("21:40"), an older one as its age ("2 days ago"). */
export function changedAt(hass: HomeAssistant | undefined, view: EntityView): string {
  const changed = lastChanged(view);
  if (!changed) return '';
  return changed.recent ? formatTime(hass, changed.date) : relativeTime(hass, changed.date);
}

/** Head sub line of a lock or an alarm: "21:40 by Marta", else "Since 21:40", else the age of the state. */
export function changedLine(hass: HomeAssistant | undefined, view: EntityView): string {
  if (view.status !== 'ok') return stateText(hass, view);
  const changed = lastChanged(view);
  if (!changed) return view.areaName;
  const time = changedAt(hass, view);
  const who = view.attr<string | null>('changed_by');
  if (who) return s(hass, 'by', { time, who });
  return changed.recent ? s(hass, 'since', { time }) : time;
}

/**
 * Cards that end in a list of entity rows (lock, alarm, camera). One trailing element per row, chosen
 * by the entity: a switch for what is safe to toggle, the value for what is measured, a chevron for the rest.
 */
export abstract class RowsCard<C extends RowsCardConfig = RowsCardConfig> extends Card<C> {
  private rowList: readonly RowConfig[] = [];
  /** A row's second line when it is a template: rendered by Home Assistant, live. */
  protected readonly texts = new TemplateTexts(this);

  protected override prepare(config: C): C {
    const rows: unknown = config.rows;
    this.rowList = (Array.isArray(rows) ? (rows as ReadonlyArray<string | RowConfig | null>) : [])
      .map((row) => (typeof row === 'string' ? { entity: row } : row))
      .filter((row): row is RowConfig => typeof row?.entity === 'string' && row.entity !== '');
    return config;
  }

  protected get rowCount(): number {
    return this.config?.show_rows === false ? 0 : this.rowList.length;
  }

  protected override watched(): readonly string[] {
    return [this.config?.entity ?? '', ...this.rowList.map((row) => row.entity)];
  }

  /** `events` draws the rows as history (camera detections): neutral circle, the time of day, a chevron. */
  protected renderRows(events = false): TemplateResult | typeof nothing {
    if (!this.rowList.length || this.config?.show_rows === false) return nothing;
    return html`<div class="dv-rows">
      ${this.rowList.map((row) => this.renderRow(row, events))}
    </div>`;
  }

  private renderRow(row: RowConfig, events: boolean): TemplateResult {
    const view = this.entity(row.entity);
    const usable = isUsable(view);
    const canToggle = usable && TOGGLE_DOMAINS.has(view.domain) && !NEVER_A_SWITCH.has(view.domain);
    const trailing = canToggle
      ? 'switch'
      : !events && view.status === 'ok' && (view.number !== null || READ_OUT.has(view.domain))
        ? 'value'
        : 'chevron';
    const state = this.stateOf(view);
    const on = state === view.state ? isActive(view) : state === 'on';
    const tone = toneOf(row, toneFor(view));
    const parts = trailing === 'value' ? valueParts(this.hass, view) : null;
    return listRow({
      icon: row.icon ?? glyphFor(view),
      tone: events ? (usable ? 'neutral' : 'off') : currentTone(view, on ? tone : 'neutral'),
      title: row.name ?? view.name,
      name: true,
      sub:
        events && view.status === 'ok'
          ? changedAt(this.hass, view)
          : secondaryText(
              this.hass,
              view,
              row.secondary ?? 'last-changed',
              trailing === 'value',
              this.texts,
            ),
      trailing,
      on,
      switchTone: tone === 'warning' ? 'accent' : tone,
      value: parts ? `${parts.value}${parts.unit ? ` ${parts.unit}` : ''}` : '',
      valueTone: view.domain === 'binary_sensor' && on && tone === 'warning' ? 'warning' : '',
      unavailable: !usable,
      accent: this.accents.item(row.color),
      onTap: () => this.tap(view.id, row.tap_action),
      onToggle: (next) => {
        if (!this.hass) return;
        this.expect(view.id, next ? 'on' : 'off');
        void toggleEntity(this.hass, view.id);
      },
    });
  }
}
