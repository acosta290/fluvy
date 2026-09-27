import { stateText, type EntityView, type HomeAssistant } from '@fluvy/core';
import type { IconRef } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { glyphFor } from '../shared/domain.js';

export interface HelperRowConfig {
  entity: string;
  name?: string;
  icon?: string;
  /** The line under the title: context or time, never the entity's domain. Defaults to its area; '' hides it. */
  secondary?: string;
  /** Quick-set chips under a time-only helper, as "HH:MM" (the sheet's Wake-up row). */
  presets?: readonly string[];
}

/**
 * What a control needs from the card that draws it. The card's own helpers are protected, so the
 * controls (one module per kind of helper) receive this narrow view of it instead of the element.
 */
export interface HelperHost {
  readonly hass: HomeAssistant | undefined;
  /** Width of the card's content column: rulers are drawn to it. */
  readonly contentWidth: number;
  /** The state to draw: the expected one while a change is in flight. */
  state(view: EntityView): string;
  expect(entityId: string, state: string): void;
  call(domain: string, service: string, data: Record<string, unknown>, entityId: string): void;
  moreInfo(entityId: string): void;
  /** Value under the finger while a ruler drag is in flight. */
  preview(entityId: string): number | undefined;
  setPreview(entityId: string, value: number | null): void;
  /** Whether the text field of this entity has the focus (its value is the user's, not the state's). */
  editing(entityId: string): boolean;
  refresh(): void;
}

export const isUnusable = (view: EntityView): boolean =>
  view.status === 'unavailable' || view.status === 'missing';

export const nameOf = (view: EntityView, row: HelperRowConfig): string => row.name ?? view.name;

export const iconOf = (view: EntityView, row: HelperRowConfig): IconRef | string =>
  row.icon ?? view.attr<string>('icon') ?? glyphFor(view);

/** The context line: what the owner wrote, else why the entity cannot be used, else where it is. */
export function contextOf(host: HelperHost, view: EntityView, row: HelperRowConfig): string {
  if (row.secondary !== undefined) return row.secondary;
  if (view.status !== 'ok') return stateText(host.hass, view);
  return view.areaName;
}

/** The sheet's field head: title and context on the left, the control (if it sits on the title's line) on the right. */
export function field(
  title: string,
  sub: string,
  control: TemplateResult | typeof nothing,
  unusable: boolean,
): TemplateResult {
  return html`<div
    class="in-field ${control === nothing ? 'in-field--top' : ''} ${unusable ? 'is-unavailable' : ''}"
  >
    <div class="in-field__text">
      <span class="fv-row__title">${title}</span
      >${sub ? html`<span class="fv-row__sub">${sub}</span>` : nothing}
    </div>
    ${control}
  </div>`;
}
