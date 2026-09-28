import {
  isActive,
  stateText,
  strings,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { badge, firstFit, head, listRow, sheetStyles, textWidth, type Tone } from '@fluvy/ui';

import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';

import { agoShort, durationShort } from '../helpers/datetime.js';

import { Card } from '../shared/base.js';

import { glyphFor } from '../shared/domain.js';
import { formLabels, iconToneFields, numberField, titleFields } from '../shared/form.js';

const s = strings('openings');

export interface OpeningsCardConfig extends FluvyCardConfig {
  title?: string;
  subtitle?: string;
  tone?: Tone;
  /** Rows before the "All sensors" row takes over (default 4). */
  max_rows?: number;
  /** Test hook: an ISO date that freezes "now" (the times in the sub lines). Undocumented. */
  _now?: string;
}

/** Device classes whose "on" is something to act on (warning tone), and the ones that read open / closed. */
const OPENING = new Set(['door', 'garage_door', 'window', 'opening', 'garage', 'gate']);
const ALERT = new Set([
  ...OPENING,
  'lock',
  'moisture',
  'problem',
  'safety',
  'smoke',
  'gas',
  'carbon_monoxide',
  'tamper',
]);
const MOTION = new Set(['motion', 'occupancy', 'presence', 'moving', 'vibration', 'sound']);
const HAZARD = new Set(['smoke', 'gas', 'carbon_monoxide']);

/**
 * The house's binary sensors on one card: how many are open in the head, then a row each — the
 * state once at the right, the time in the sub ("14 min" while it is open, "2 h ago" once it is
 * over). Long lists collapse to the first few and an "All sensors" row that opens the rest in place.
 *
 * Home Assistant translates binary states by device class, but only for integrations that register
 * the translation; the four families this card is about (openings, detection, moisture, problems)
 * carry fluvy's own wording so a door never reads "On".
 */
export class FluvyOpeningsCard extends Card<OpeningsCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.ambient,
    css`
      /* the lab fixes the sheet at 360; a dashboard column decides here */
      .am-card {
        width: 100%;
      }
    `,
  ];

  static override properties = { ...Card.properties, expanded_: { state: true } };

  declare expanded_: boolean;

  constructor() {
    super();
    this.expanded_ = false;
  }

  static getConfigForm(): LovelaceConfigForm {
    const shared = formLabels({});
    return {
      schema: [
        {
          name: 'entities',
          required: true,
          selector: { entity: { multiple: true, domain: ['binary_sensor', 'cover', 'lock'] } },
        },
        titleFields(),
        iconToneFields(),
        numberField('max_rows', 1, 20),
      ],
      computeLabel: (schema, localize) =>
        schema.name === 'max_rows'
          ? s({ language: document.documentElement.lang || 'en' }, 'editor.max_rows')
          : shared.computeLabel?.(schema, localize),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): OpeningsCardConfig {
    return {
      type: 'custom:fluvy-openings-card',
      entities: entities.filter((id) => id.startsWith('binary_sensor.')).slice(0, 4),
    };
  }

  protected override prepare(config: OpeningsCardConfig): OpeningsCardConfig {
    if (!config.entities?.length) throw new Error('fluvy-openings-card: add at least one sensor');
    return config;
  }

  private maxRows(): number {
    return Math.min(20, Math.max(1, Math.round(this.config?.max_rows ?? 4)));
  }

  override getCardSize(): number {
    return 2 + Math.min(this.config?.entities?.length ?? 1, this.maxRows() + 1);
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /** Open, wet, smoke, a problem: active AND of a class that is a warning. Motion is an event, not an alert. */
  private alert(view: EntityView): boolean {
    return isActive(view) && ALERT.has(view.domain === 'lock' ? 'lock' : view.deviceClass);
  }

  /** The state, said once, in the words the device class deserves. */
  private valueText(view: EntityView): string {
    if (view.status !== 'ok') return stateText(this.hass, view);
    const on = isActive(view);
    const dc = view.deviceClass;
    if (view.domain === 'lock') return stateText(this.hass, view); // locking, jammed, open: Home Assistant's own words
    if (dc === 'lock') return this.t(on ? 'lock.unlocked' : 'lock.locked');
    if (view.domain === 'cover' || OPENING.has(dc))
      return this.t(on ? 'common.open' : 'common.closed');
    if (MOTION.has(dc)) return s(this.hass, on ? 'detected' : 'clear');
    if (HAZARD.has(dc)) return s(this.hass, on ? 'detected' : 'ok');
    if (dc === 'moisture') return s(this.hass, on ? 'wet' : 'dry');
    if (dc === 'problem' || dc === 'safety' || dc === 'tamper')
      return s(this.hass, on ? 'problem' : 'ok');
    return stateText(this.hass, view);
  }

  /** The sheet's "Openings & motion" where it fits beside the badge, a shorter default where it does not. A configured title is the user's. */
  private heading(badgeText: string): string {
    if (this.config?.title !== undefined) return this.config.title;
    const family = getComputedStyle(this).fontFamily;
    const badgeWidth = Math.ceil((textWidth(badgeText, `600 13px ${family}`) + 28) / 4) * 4;
    const room = this.contentWidth - 56 - 12 - badgeWidth - 4; // 44 circle + 12, the titles, 12 + the badge; 4 px of margin for a fallback face
    return firstFit(
      [s(this.hass, 'title'), s(this.hass, 'title_short')],
      room,
      `600 16px ${family}`,
    );
  }

  /** "14 min" for something still open (a duration), "2 h ago" for something that happened (an event). */
  private when(view: EntityView, ongoing: boolean, now: Date): string {
    const changed =
      view.stateObj && view.status === 'ok' ? new Date(view.stateObj.last_changed) : null;
    if (!changed || Number.isNaN(changed.getTime())) return '';
    return ongoing ? durationShort(this.hass, changed, now) : agoShort(this.hass, changed, now);
  }

  protected renderCard(): TemplateResult {
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    const now = frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
    const views = (this.config?.entities ?? []).map((id) => this.entity(id));
    const alerts = views.filter((view) => this.alert(view));
    const tone = this.config?.tone ?? 'warning';

    const rooms = new Set(views.map((view) => view.areaName).filter(Boolean));
    const countText =
      views.length === 1
        ? s(this.hass, 'sensor_one')
        : s(this.hass, 'sensors', { count: views.length });
    const roomText =
      rooms.size === 0
        ? ''
        : rooms.size === 1
          ? s(this.hass, 'room_one')
          : s(this.hass, 'rooms', { count: rooms.size });

    // "1 open" when everything alerting is an opening; a leak or smoke makes it "1 alert"
    const openOnly = alerts.every(
      (view) =>
        view.domain === 'cover' ||
        view.domain === 'lock' ||
        view.deviceClass === 'lock' ||
        OPENING.has(view.deviceClass),
    );
    const badgeText =
      alerts.length === 0
        ? s(this.hass, 'all_clear')
        : alerts.length === 1
          ? s(this.hass, openOnly ? 'open_one' : 'alert_one')
          : s(this.hass, openOnly ? 'open_many' : 'alert_many', { count: alerts.length });

    const max = this.maxRows();
    const collapsible = views.length > max + 1; // one extra sensor is a row, not a "1 more" row
    const shown = collapsible && !this.expanded_ ? views.slice(0, max) : views;

    return html`<article class="fv-card am-card" data-card>
      ${head({
        icon: this.config?.icon ?? 'door',
        tone: alerts.length > 0 ? tone : 'neutral',
        title: this.heading(badgeText),
        sub: this.config?.subtitle ?? (roomText ? `${countText} · ${roomText}` : countText),
        trailing: badge(badgeText, alerts.length > 0 ? tone : 'neutral'),
      })}
      <div class="am-rows">
        ${shown.map((view) => {
          const warn = this.alert(view);
          const dead = view.status === 'unavailable' || view.status === 'missing';
          return listRow({
            icon: view.deviceClass === 'window' ? 'blinds' : glyphFor(view), // the sheet's window glyph
            tone: dead ? 'off' : warn ? tone : 'neutral', // events (motion) stay neutral: only what needs acting on is filled
            title: view.name,
            sub: dead ? stateText(this.hass, view) : this.when(view, warn, now), // "Unavailable" is said once, where the time would be
            trailing: 'value',
            value: dead ? '—' : this.valueText(view),
            valueTone: warn ? 'warning' : '',
            unavailable: dead,
            onTap: () => this.tap(view.id, { action: 'more-info' }),
          });
        })}
        ${
          collapsible
            ? listRow({
                icon: 'list',
                tone: 'neutral',
                title: s(this.hass, 'all_sensors'),
                sub: this.expanded_
                  ? s(this.hass, 'less')
                  : s(this.hass, 'more', { count: views.length - shown.length }),
                trailing: 'chevron',
                onTap: () => {
                  this.expanded_ = !this.expanded_;
                },
              })
            : nothing
        }
      </div>
    </article>`;
  }
}
