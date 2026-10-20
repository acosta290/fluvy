import type { HomeAssistant } from '@fluvy/core';
import { unitSpan } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { durationParts, durationText, unitGap, unitWord } from '../shared/duration.js';
import type { Figure } from '../shared/value-row.js';

/** A span of time as a readout's words ("2 h 10" + "min"), to measure it by; "—" when it is not known. */
export function durationFigure(
  hass: HomeAssistant | undefined,
  label: string,
  seconds: number | null,
): Figure {
  return { label, ...durationText(hass, seconds) };
}

/**
 * A span of time as a readout: "2 h 10 min" — "2時間10分" — each unit in the readout's unit face on the figure's
 * baseline, the last one in the unit slot, as every readout's unit is.
 */
export function durationReadout(
  hass: HomeAssistant | undefined,
  label: string,
  seconds: number | null,
  size: 'xs' | 's' | 'l' = 's',
): TemplateResult {
  const parts = seconds === null ? null : durationParts(seconds);
  const last = parts?.[parts.length - 1];
  const lead = (parts?.slice(0, -1) ?? []).map((p) => ({
    value: p.value,
    unit: unitWord(hass, p.unit),
  }));
  return html`<div class="fv-readout fv-readout--${size}">
    <p class="fv-readout__label">${label}</p>
    <p class="fv-readout__value">
      <span
        >${lead.map((p) => html`${p.value}${unitSpan(p.unit)}${unitGap(p.unit)}`)}${
          last ? last.value : '—'
        }</span
      >${last ? unitSpan(unitWord(hass, last.unit)) : nothing}
    </p>
  </div>`;
}
