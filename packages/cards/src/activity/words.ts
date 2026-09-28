/** The Activity page's words: what an entry is and how it reads — a state, a moment, a cause, a trigger, a name. */
import { html, type TemplateResult } from 'lit';

import {
  dateFormat,
  domainOf,
  resolveEntity,
  stateText,
  type EntityView,
  type KeyOf,
} from '@fluvy/core';
import type { ActivityCause, ActivityEvent } from '@fluvy/core/activity';
import { glyph, type GlyphName } from '@fluvy/ui';

import { currentTone, glyphFor } from '../shared/domain.js';

import { type Look, MINOR, MOMENTS, TRIGGER_KEYS, TRIGGERS } from './shared.js';

import type { FluvyActivity } from './view.js';

type ActivityString = KeyOf<'activity' | 'page'>;

/** Entity ids in a message read as their names. */
export function withNames(page: FluvyActivity, text: string): string {
  const hass = page.hass;
  if (!hass) return text;
  return text.replace(
    /\b[a-z_]+\.[a-z0-9_]+\b/g,
    (id) => hass.states[id]?.attributes.friendly_name ?? id,
  );
}

/** An automation's trigger as Home Assistant words it ("state of Front door"), in the page's language. */
export function triggerWords(page: FluvyActivity, source: string | undefined): string {
  if (!source) return '';
  for (const phrase of TRIGGERS)
    if (source.startsWith(phrase)) {
      const key = TRIGGER_KEYS[phrase];
      const word = page.ha(`ui.components.logbook.${key}`, `trigger.${key}` as ActivityString);
      return withNames(page, source.replace(phrase, word));
    }
  return withNames(page, source);
}

/** An action by its name ("Turn on"), as Home Assistant translates it; else its id. */
export function serviceName(page: FluvyActivity, id: string): string {
  const [domain, service] = id.split('.');
  const key = `component.${domain}.services.${service}.name`;
  const named = page.hass?.localize?.(key);
  if (named && named !== key) return named;
  const services = (page.hass as { services?: Record<string, Record<string, { name?: string }>> })
    ?.services;
  return services?.[domain ?? '']?.[service ?? '']?.name ?? id;
}

export function causeName(page: FluvyActivity, cause: ActivityCause): string {
  return cause.kind === 'service' ? serviceName(page, cause.name) : cause.name;
}

export function causeGlyph(cause: ActivityCause): GlyphName {
  return cause.kind === 'automation'
    ? 'automation'
    : cause.kind === 'script'
      ? 'script'
      : cause.kind === 'person'
        ? 'person'
        : cause.kind === 'service'
          ? 'code'
          : 'nodes';
}

/** Who or what, short: a glyph and a name (the detail says it in full and leads to it). */
export function causeTag(page: FluvyActivity, cause: ActivityCause): TemplateResult {
  const name = causeName(page, cause);
  const full = `${name} · ${page.t(`kind.${cause.kind}` as ActivityString)}`;
  return html`<span class="av-sub__part av-cause" title=${full} aria-label=${full}
    >${glyph(causeGlyph(cause))}${name}</span
  >`;
}

/** The entity as it was: its state at the entry, everything else as it is now. */
export function pastView(view: EntityView, state: string): EntityView {
  return {
    ...view,
    state,
    status: state === 'unavailable' ? 'unavailable' : state === 'unknown' ? 'unknown' : 'ok',
    stateObj: view.stateObj ? { ...view.stateObj, state } : undefined,
    supports: view.supports,
    attr: view.attr,
  };
}

/** A state in words: Home Assistant's translation; an untranslated key (`water_shortage`) read as words; none, a dash. */
export function stateWord(
  page: FluvyActivity,
  view: EntityView | undefined,
  state: string,
): string {
  if (state.trim() === '') return '—';
  const text = view?.stateObj ? stateText(page.hass, pastView(view, state)) : state;
  const words = /^[\p{L}\d]+(_[\p{L}\d]+)+$/u.test(text) ? text.replace(/_/g, ' ') : text;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function isMoment(event: ActivityEvent): boolean {
  const domain = event.entity_id ? domainOf(event.entity_id) : '';
  return domain === 'event' || domain in MOMENTS;
}

export function momentWord(page: FluvyActivity, event: ActivityEvent): string {
  const domain = event.entity_id ? domainOf(event.entity_id) : '';
  if (domain === 'event')
    return page.ha('ui.components.logbook.messages.detected_event_no_type', 'msg.event');
  const key = MOMENTS[domain] ?? 'detected';
  return page.ha(`ui.components.logbook.messages.${key}`, `msg.${key}` as ActivityString);
}

export function nameOf(event: ActivityEvent, view: EntityView | undefined): string {
  if (view?.stateObj) return view.name;
  return event.name ?? view?.name ?? '';
}

export function lookOf(
  page: FluvyActivity,
  event: ActivityEvent,
  view: EntityView | undefined,
): Look {
  const meta = page.index.of(event);
  const domain = event.domain ?? (event.entity_id ? domainOf(event.entity_id) : '');
  // a security sensor (a door, smoke) and a doorbell stand out; other sensors and the system's settings are dots
  const major =
    meta.category !== 'system' &&
    (meta.category === 'security' || view?.deviceClass === 'doorbell' || !MINOR.has(domain));
  if (domain === 'homeassistant') return { glyph: 'ha', tone: 'neutral', major: true };
  if (domain === 'automation') return { glyph: 'automation', tone: 'accent', major };
  if (domain === 'script') return { glyph: 'script', tone: 'accent', major };
  const ref = event.icon ?? view?.stateObj?.attributes.icon;
  const custom = typeof ref === 'string' && ref ? ref : undefined;
  if (view && event.state !== undefined && !isMoment(event)) {
    // a group looks like what it holds (all the lamps: a bulb)
    const members = domain === 'group' ? view.attr<readonly string[]>('entity_id') : undefined;
    const like = members?.[0] ? resolveEntity(page.hass, members[0]) : view;
    const past = pastView(like, event.state);
    return { glyph: custom ?? glyphFor(past), tone: currentTone(past), major };
  }
  // a moment (a button pressed, a doorbell) happened; it is not a state that is on: a neutral circle
  const fallback: GlyphName = domain === 'event' ? 'bell' : view ? glyphFor(view) : 'note';
  return { glyph: custom ?? fallback, tone: 'neutral', major };
}

/** The automation run behind an entry (the same context): what triggered it. */
export function triggerOf(page: FluvyActivity, event: ActivityEvent): string {
  const domain = event.entity_id ? domainOf(event.entity_id) : '';
  if (domain === 'automation') return triggerWords(page, event.source);
  if (!event.context_id) return '';
  const run = page.events.find(
    (other) =>
      other !== event &&
      other.context_id === event.context_id &&
      (other.domain ?? '') === 'automation' &&
      other.source,
  );
  return run ? triggerWords(page, run.source) : '';
}

/**
 * How the period reads: "Today · Friday" over "19 September"; "Last 7 days" over "13 – 19 Sept"; a period a link
 * opened, "Since 16 Sept, 23:47" (or from and to, each whole, on two lines when they must). With one entity asked
 * for, the eyebrow is its name.
 */
/** "17 September" (with its year when it is not page one). */
export function dayMonth(page: FluvyActivity, ms: number, month: 'long' | 'short'): string {
  const date = new Date(ms);
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month };
  if (date.getFullYear() !== new Date(page.now).getFullYear()) options.year = 'numeric';
  return dateFormat(page.language, options).format(date);
}
