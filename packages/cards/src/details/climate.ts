import { formatNumber, type EntityView, type MessageKey } from '@fluvy/core';
import { label, type DialChangeDetail, type IconRef, type Tone } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { Burst, Hold } from '../cover/common.js';
import { chipRow } from '../shared/chips.js';
import { modeWord } from '../shared/mode-words.js';
import {
  chooseMode,
  defaultModes,
  stepTarget,
  targetCall,
  thermostatModel,
  type ThermostatModel,
} from '../thermostat/thermostat-card.js';
import type { DaySpec } from './history.js';
import { keys, listAttr, sheetRows, type SheetRow } from './parts.js';
import { DetailsSheet, type Status } from './sheet.js';

/** A row of options a climate may have beside its modes: where it lists them, where it says the one chosen, its service. */
interface Row {
  readonly title: MessageKey;
  readonly icon: IconRef;
  readonly list: string;
  readonly attribute: string;
  readonly service: string;
}

const ROWS: readonly Row[] = [
  {
    title: 'climate.preset',
    icon: 'sliders',
    list: 'preset_modes',
    attribute: 'preset_mode',
    service: 'set_preset_mode',
  },
  {
    title: 'climate.fan',
    icon: 'fan',
    list: 'fan_modes',
    attribute: 'fan_mode',
    service: 'set_fan_mode',
  },
  {
    title: 'sheets.swing',
    icon: 'swing',
    list: 'swing_modes',
    attribute: 'swing_mode',
    service: 'set_swing_mode',
  },
  {
    title: 'sheets.swing_horizontal',
    icon: 'swap',
    list: 'swing_horizontal_modes',
    attribute: 'swing_horizontal_mode',
    service: 'set_swing_horizontal_mode',
  },
];

const sameTarget = (a: DialChangeDetail | null, b: DialChangeDetail | null): boolean =>
  a?.value === b?.value && a?.low === b?.low && a?.high === b?.high;

/**
 * A thermostat's details — a climate's, a water heater's, a humidifier's, read as the thermostat card reads them: the
 * target on the dial (a low and a high for a range), what it measures as a dot outside the ring and under the figure;
 * one step down and one up under it; its modes as chips, each with its glyph; then its preset, its fan speed and its
 * swing, each a row that opens its options.
 */
export class FluvyDetailsClimate extends DetailsSheet {
  /** The target the keys stepped to, shown until the device reports it; their taps are one call once they stop. */
  private readonly stepped = new Hold<DialChangeDetail | null>(this);
  private readonly burst = new Burst();
  /** The option chosen in each row, shown until the device reports it. */
  private readonly chosen = new Map<string, Hold<string | null>>();
  /** The end of a range the keys step: the one last moved on the dial; until then the low one, the high one while cooling. */
  private rangeEnd: 0 | 1 | null = null;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.burst.flush();
    this.stepped.clear();
    for (const hold of this.chosen.values()) hold.clear();
  }

  /** The thermostat read once for each view of it: a render asks for it from every part of the sheet. */
  private read: { readonly view: EntityView; readonly model: ThermostatModel } | undefined;

  private model(view: EntityView): ThermostatModel {
    if (this.read?.view !== view)
      this.read = {
        view,
        model: thermostatModel(
          { hass: this.hass, rawHass: this.rawHass, state: (shown) => this.stateOf(shown) },
          view,
        ),
      };
    return this.read.model;
  }

  protected tone(view: EntityView): Tone {
    return this.model(view).tone;
  }

  protected active(view: EntityView): boolean {
    return !this.model(view).off;
  }

  /** What it is doing, and the room's humidity where a climate measures it: "Heating · 46 % RH". */
  protected status(view: EntityView): Status {
    const m = this.model(view);
    const humidity = view.attr<number | null>('current_humidity');
    return {
      parts: [
        m.badgeText,
        m.kind === 'climate' && typeof humidity === 'number'
          ? `${formatNumber(this.hass, humidity, { digits: 0 })} % RH`
          : '',
      ],
    };
  }

  /** The day's line is what it measures: the room's temperature, the tank's, the air's humidity. */
  protected daySpec(view: EntityView): DaySpec {
    const m = this.model(view);
    return {
      kind: 'value',
      attribute: m.kind === 'humidifier' ? 'current_humidity' : 'current_temperature',
      unit: m.unit,
      digits: m.unit === '%' ? 0 : 1,
    };
  }

  protected dayLevel(view: EntityView): number | null {
    return this.model(view).current ?? null;
  }

  private setTarget(view: EntityView, m: ThermostatModel, detail: DialChangeDetail): void {
    const call = targetCall(m, detail);
    if (call) this.call(m.kind, call[0], call[1], view.id);
  }

  /** The target as the device reports it, or the one the keys stepped to while it has not. */
  private target(m: ThermostatModel): DialChangeDetail | null {
    const reported: DialChangeDetail | null =
      m.low !== undefined && m.high !== undefined
        ? { low: m.low, high: m.high }
        : m.target !== undefined
          ? { value: m.target }
          : null;
    return this.stepped.read(reported, sameTarget);
  }

  /** One step of the target, or of a range's end, from the keys: shown at once, sent once the taps stop. */
  private step(view: EntityView, direction: 1 | -1): void {
    const m = this.model(view);
    const shown = this.target(m);
    if (!shown || m.off) return;
    const next = stepTarget(shown, direction, m, this.rangeEnd ?? (m.action === 'cooling' ? 1 : 0));
    this.stepped.set(next);
    this.burst.push(() => this.setTarget(view, m, next));
  }

  /** The dial moved: the keys step the end of a range it moved last, and what they stepped to gives way to it. */
  private dialled(shown: DialChangeDetail | null, detail: DialChangeDetail): void {
    if (detail.low !== undefined && detail.high !== undefined)
      this.rangeEnd = detail.high !== shown?.high ? 1 : 0;
    this.stepped.clear();
  }

  /** Its preset, its fan speed and its swing, each where the climate lists some. */
  private rows(view: EntityView, unusable: boolean): SheetRow[] {
    return ROWS.flatMap((row): SheetRow[] => {
      const options = listAttr(view.attr(row.list));
      if (!options.length) return [];
      let hold = this.chosen.get(row.attribute);
      if (!hold) this.chosen.set(row.attribute, (hold = new Hold<string | null>(this)));
      const held = hold;
      return [
        {
          kind: 'choice',
          icon: row.icon,
          title: this.t(row.title),
          chosen: held.read(view.attr<string | null>(row.attribute) ?? null),
          options,
          word: (option) => modeWord(this.rawHass, view, row.attribute, option),
          disabled: unusable,
          choose: (option) => {
            held.set(option);
            this.call('climate', row.service, { [row.attribute]: option }, view.id);
          },
        },
      ];
    });
  }

  protected renderBody(view: EntityView, unusable: boolean): TemplateResult {
    const name = this.nameFor(view, undefined);
    const m = this.model(view);
    const percent = m.unit === '%';
    const digits = m.step < 1 ? 1 : 0;
    const figure = (value: number): string =>
      formatNumber(this.hass, value, { digits, minDigits: digits });
    const edge = (value: number): string =>
      `${formatNumber(this.hass, value, { digits: 0 })}${percent ? ' %' : '°'}`;
    const now =
      m.current === undefined
        ? ''
        : this.t('climate.current', {
            value: percent
              ? `${formatNumber(this.hass, m.current, { digits: 0 })} %`
              : `${formatNumber(this.hass, m.current, { digits: 1 })}°`,
          });
    const shown = this.target(m);
    const idle = unusable || m.off || !shown;
    const target = this.t('climate.target');
    const modes = defaultModes(m.kind === 'climate', m.modes);
    return html`<div class="dt-hero">
        <fluvy-dial
          .radius=${this.ring}
          .large=${this.large}
          .stepper=${false}
          .tone=${idle ? 'neutral' : m.tone}
          .min=${m.min}
          .max=${m.max}
          .step=${m.step}
          .arc=${m.arc}
          .value=${shown?.value}
          .low=${shown?.low}
          .high=${shown?.high}
          .current=${m.current}
          .unit=${m.unit}
          .sub=${this.dialWords(now)}
          .text=${unusable ? '—' : m.off ? this.t('climate.mode.off') : shown ? undefined : '—'}
          .name=${`${name} · ${target}`}
          min-label=${edge(m.min)}
          max-label=${edge(m.max)}
          ?disabled=${idle}
          .format=${figure}
          @fluvy-input=${(event: CustomEvent<DialChangeDetail>) => this.dialled(shown, event.detail)}
          @fluvy-change=${(event: CustomEvent<DialChangeDetail>) => {
            this.dialled(shown, event.detail);
            this.setTarget(view, m, event.detail);
          }}
        ></fluvy-dial>
      </div>
      ${keys(
        [
          {
            key: 'down',
            glyph: 'minus',
            label: `${name} · ${target} · ${this.t('common.decrease')}`,
            step: -1,
            disabled: idle,
          },
          {
            key: 'up',
            glyph: 'plus',
            label: `${name} · ${target} · ${this.t('common.increase')}`,
            step: 1,
            disabled: idle,
          },
        ],
        this.room,
        () => undefined,
        (direction) => this.step(view, direction),
      )}
      ${
        modes.length
          ? html`${label(this.t('climate.mode'))}${chipRow(
              modes.map((mode) => ({
                key: mode.key,
                label: mode.label,
                active: mode.active ?? false,
                unavailable: unusable,
                ...(mode.glyph ? { glyph: mode.glyph } : {}),
                ...(mode.tone ? { tone: mode.tone } : {}),
              })),
              (key) => {
                this.stepped.clear();
                chooseMode(this.controlHost, view, m, key);
              },
              'full',
              { ruler: this.ruler, width: this.room },
            )}`
          : nothing
      }
      ${sheetRows(this.ruler, this.room, m.kind === 'climate' ? this.rows(view, unusable) : [])}`;
  }
}

if (!customElements.get('fluvy-details-climate'))
  customElements.define('fluvy-details-climate', FluvyDetailsClimate);

declare global {
  interface HTMLElementTagNameMap {
    'fluvy-details-climate': FluvyDetailsClimate;
  }
}
