import { localize, sliderStill, strings, type EntityView } from '@fluvy/core';
import { ico, stepper, type RulerChangeDetail } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { iconOf } from '../shared/domain.js';
import {
  drawsRuler,
  numberModel,
  numberText,
  nudge,
  type NumberModel as Model,
} from '../shared/number.js';
import {
  contextOf,
  field,
  fieldContext,
  isUnusable,
  nameOf,
  type HelperHost,
  type HelperRowConfig,
} from './context.js';

const s = strings('helpers');

interface NumberModel extends Model {
  /** Value and stepper only: a counter, `mode: box`, or a range a ruler cannot resolve. */
  readonly boxed: boolean;
}

function model(host: HelperHost, view: EntityView): NumberModel {
  const m = numberModel(view, host.state(view), isUnusable(view), host.preview(view.id));
  return { ...m, boxed: !drawsRuler({ ...m, mode: view.attr<string>('mode') }) };
}

/** Whether this helper is drawn as value + stepper only (what the sheet's compact card holds). */
export const isBoxedNumber = (host: HelperHost, view: EntityView): boolean =>
  model(host, view).boxed;

const text = (host: HelperHost, m: NumberModel, value: number | null = m.value): string =>
  numberText(host.hass, m, value);

/**
 * The figure as it reads beside the stepper: its value and unit, or, where the card asks for figures typed
 * (`number_entry`, #218) and they hold beside the stepper, a button of its words that opens a field in its place
 * (`typedFigure`); a counter's stays words.
 */
function figure(
  host: HelperHost,
  view: EntityView,
  m: NumberModel,
  name: string,
  valueClass: string,
): TemplateResult {
  const typed =
    m.counter || !host.typed
      ? null
      : host.typed.typedFigure({
          root: host.root,
          ruler: host.ruler,
          room: host.contentWidth,
          host,
          hass: host.hass,
          view,
          m,
          name,
          typing: host.typing === view.id,
          onOpen: () => host.setTyping(view.id),
          onClose: () => host.setTyping(null),
        });
  if (typed) return typed;
  const key = `n-${view.id}`;
  return html`<span class=${valueClass}
    ><span data-baseline=${key}>${text(host, m)}</span
    >${view.unit && m.value !== null ? html`<span class="fv-unit" data-baseline=${key}>${view.unit}</span>` : nothing}</span
  >`;
}

function valueAndStepper(
  host: HelperHost,
  view: EntityView,
  m: NumberModel,
  name: string,
  valueClass: string,
): TemplateResult {
  return html`<div class="in-field__control">
    ${figure(host, view, m, name, valueClass)}
    ${stepper((direction) => nudge(host, view, m, direction), {
      disabled: m.unusable,
      decrease: `${name} · ${localize(host.hass, 'common.decrease')}`,
      increase: `${name} · ${localize(host.hass, 'common.increase')}`,
    })}
  </div>`;
}

/** `input_number` / `number` / `counter` inside the card: title and context, the value with its stepper, the ruler under them. */
export function numberBlocks(
  host: HelperHost,
  view: EntityView,
  row: HelperRowConfig,
): TemplateResult[] {
  const m = model(host, view);
  const name = nameOf(host, view, row);
  const blocks = [
    field(
      name,
      fieldContext(host, view, row),
      valueAndStepper(host, view, m, name, 'in-field__value'),
      m.unusable,
    ),
  ];
  // the ruler keeps its place while the helper cannot be read, at rest
  if (m.boxed || m.min === null || m.max === null) return blocks;
  const { min, max } = m;
  blocks.push(
    html`<fluvy-ruler
      class=${m.unusable ? 'is-unavailable' : ''}
      .value=${m.value ?? min}
      .min=${min}
      .max=${max}
      .step=${m.step}
      .length=${host.contentWidth}
      tone="accent"
      ?inactive=${m.value === null}
      ?disabled=${m.unusable}
      .look=${host.sliderStyle}
      ?still=${sliderStill()}
      .unit=${view.unit}
      .label=${`${name} · ${s(host.hass, 'value')}`}
      .format=${(value: number) => text(host, m, value)}
      @fluvy-input=${(event: CustomEvent<RulerChangeDetail>) => host.setPreview(view.id, event.detail.value)}
      @fluvy-change=${(event: CustomEvent<RulerChangeDetail>) => {
        host.setPreview(view.id, null);
        host.expect(view.id, String(event.detail.value));
        host.call(view.domain, 'set_value', { value: event.detail.value }, view.id);
      }}
      @fluvy-cancel=${() => host.setPreview(view.id, null)}
    ></fluvy-ruler>`,
  );
  return blocks;
}

/** The sheet's compact card: one counter (or one boxed number) as a 76 row with no head above it. */
export function compactNumber(
  host: HelperHost,
  view: EntityView,
  row: HelperRowConfig,
): TemplateResult {
  const m = model(host, view);
  const name = nameOf(host, view, row);
  const sub = contextOf(host, view, row);
  return html`<article
    class="fv-card in-compact ${m.unusable ? 'is-unavailable is-off' : ''}"
    data-card
  >
    ${ico(iconOf(view, row.icon), m.unusable ? 'off' : 'accent', { onTap: () => host.moreInfo(view.id), label: name })}
    <div class="fv-row__text">
      <span class="fv-row__title">${name}</span
      >${sub ? html`<span class="fv-row__sub">${sub}</span>` : nothing}
    </div>
    ${valueAndStepper(host, view, m, name, 'in-compact__value')}
  </article>`;
}
