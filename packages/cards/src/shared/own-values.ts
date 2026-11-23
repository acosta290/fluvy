import { isEntityId, type EntityView } from '@fluvy/core';
import { isTemplate } from './templates.js';
import { scaleNamed, toBase } from './units.js';

/*
 * A figure of the card's own that may be live (1.22's thresholds, #204; a bar's range and its limits, #253): a number,
 * an entity's reading in the unit it is compared in, or a template's answer, read the same way wherever a card takes
 * one (`Card.ownFigure`, `thresholds.ts`).
 */

/** What a card's own values are read with: the house's entities, a template's answers. */
export interface OwnHost {
  entity(id: string): EntityView;
  /** A template's answer: undefined until Home Assistant has given one, '' where it failed. */
  template(text: string): string | undefined;
}

/**
 * A value of the card's own as read now: none where it says none or cannot be read; `pending` while a template's
 * answer is to come.
 */
export interface Own<T> {
  readonly value?: T | undefined;
  readonly pending: boolean;
}

/** A figure as words write it ("230", "-0.5", "1e3"); anything else ("230 V", '') is not one. */
const FIGURE = /^\s*[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i;
const figureOf = (text: string): number | undefined =>
  FIGURE.test(text) ? Number(text) : undefined;

/**
 * A reading of `from` in `to`: as it is where they are one unit or either says none, else converted where they are of
 * one family (kW to W, m³ to L), else none.
 */
function inUnit(value: number, from: string, to: string): number | undefined {
  if (!from.trim() || !to.trim() || from.trim() === to.trim()) return value;
  const named = scaleNamed(from, to);
  if (named) return value * named.divisor;
  const reading = toBase(value, from);
  const base = toBase(1, to);
  return reading.unit === base.unit ? reading.value / base.value : undefined;
}

/**
 * A figure of the card's own in `unit`: a number as it is, an entity's reading converted from its unit, a template's
 * answer (pending until Home Assistant gives one), or words that are a figure ("20", as the editor's field writes it).
 */
export function readFigure(raw: unknown, unit: string, host: OwnHost): Own<number> {
  if (typeof raw === 'number')
    return { value: Number.isFinite(raw) ? raw : undefined, pending: false };
  if (typeof raw !== 'string') return { pending: false };
  if (isTemplate(raw)) {
    const answer = host.template(raw);
    return {
      value: answer === undefined ? undefined : figureOf(answer),
      pending: answer === undefined,
    };
  }
  if (!isEntityId(raw)) return { value: figureOf(raw), pending: false };
  const view = host.entity(raw);
  return {
    value: view.number === null ? undefined : inUnit(view.number, view.unit, unit),
    pending: false,
  };
}
