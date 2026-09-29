import { isActive, stateText, strings, valueParts, type EntityView } from '@fluvy/core';
import { chips, icon, listRow, type ChipItem, type Tone } from '@fluvy/ui';
import { html, nothing, type TemplateResult } from 'lit';
import { currentTone, toneFor } from '../shared/domain.js';
import {
  contextOf,
  iconOf,
  isUnusable,
  nameOf,
  type HelperHost,
  type HelperRowConfig,
} from './context.js';
import {
  dayText,
  daysUntil,
  parseMomentText,
  presetTime,
  relativeAgo,
  relativeDays,
  timeText,
  type Moment,
} from './datetime.js';

const s = strings('helpers');

/** Below this content width a row's extras stop indenting to the text column. */
const NARROW = 300;

/** Where the entity is, else when it last changed: a row's sub is context or time, never its state again. */
function rowSub(host: HelperHost, view: EntityView, row: HelperRowConfig): string {
  const context = contextOf(host, view, row);
  if (context || row.secondary !== undefined || !view.stateObj) return context;
  const changed = new Date(view.stateObj.last_changed);
  return Number.isNaN(changed.getTime()) ? '' : sentenceCase(relativeAgo(host.hass, changed));
}

const sentenceCase = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** The sheet's list row with a free trailing element — `listRow` only knows switch, value and chevron. */
function row(
  view: EntityView,
  config: HelperRowConfig,
  tone: Tone,
  sub: string,
  trailing: TemplateResult,
): TemplateResult {
  return html`<div class="fv-row ${isUnusable(view) ? 'is-unavailable' : ''}">
    <span class="fv-ico fv-ico--${tone}" data-icon>${icon(iconOf(view, config))}</span>
    <span class="fv-row__text"
      ><span class="fv-row__title">${nameOf(view, config)}</span
      >${sub ? html`<span class="fv-row__sub">${sub}</span>` : nothing}</span
    >
    ${trailing}
  </div>`;
}

/**
 * The sheet's content-sized row button (44 in a row, text + 16 px sides on the 4 grid). `label` is the
 * accessible name: a card holds several "Run" and several "Install", each must say what it acts on.
 * `name`: the words are a name (a select's chosen option) and may end in an ellipsis where the row is narrow.
 */
export function rowButton(
  kind: 'quiet' | 'link',
  text: string,
  label: string,
  onClick: () => void,
  disabled = false,
  name = false,
): TemplateResult {
  return html`<button
    class="fv-btn fv-btn--${kind} in-value"
    data-control
    data-target
    data-fit="32"
    aria-label=${label}
    ?disabled=${disabled}
    @click=${onClick}
  >
    <span class="in-value__text" data-name=${name ? '' : nothing}>${text}</span>
  </button>`;
}

/** An editable value wears the link-button shape; tapping it opens Home Assistant's own editor for the entity. */
const valueButton = (
  host: HelperHost,
  view: EntityView,
  name: string,
  value: string,
): TemplateResult =>
  rowButton(
    'link',
    value,
    `${name} · ${value}`,
    () => host.moreInfo(view.id),
    isUnusable(view),
    true,
  );

/** A value too rich for the card (a select with a long list): the row says where it stands and opens the list. */
export function valueRow(
  host: HelperHost,
  view: EntityView,
  config: HelperRowConfig,
  value: string,
): TemplateResult {
  return row(
    view,
    config,
    currentTone(view, 'neutral'),
    rowSub(host, view, config),
    valueButton(host, view, nameOf(view, config), value),
  );
}

/** `input_boolean` / `switch`: the sheet's list row with its switch. */
export function switchRow(
  host: HelperHost,
  view: EntityView,
  config: HelperRowConfig,
): TemplateResult {
  const unusable = isUnusable(view);
  const on = host.state(view) === 'on';
  return listRow({
    icon: iconOf(view, config),
    tone: unusable ? 'off' : on ? 'accent' : 'neutral',
    title: nameOf(view, config),
    sub: rowSub(host, view, config),
    trailing: 'switch',
    on,
    switchTone: 'accent',
    unavailable: unusable,
    onToggle: (next) => {
      host.expect(view.id, next ? 'on' : 'off');
      host.call(view.domain, next ? 'turn_on' : 'turn_off', {}, view.id);
    },
  });
}

function momentParts(
  host: HelperHost,
  view: EntityView,
  config: HelperRowConfig,
  moment: Moment | null,
): { value: string; sub: string } {
  if (!moment) return { value: '—', sub: contextOf(host, view, config) };
  const custom = config.secondary;
  if (!moment.hasTime)
    return {
      value: dayText(host.hass, moment),
      sub: custom ?? relativeDays(host.hass, daysUntil(moment)),
    };
  if (!moment.hasDate) return { value: timeText(host.hass, moment), sub: custom ?? view.areaName };
  return { value: timeText(host.hass, moment), sub: custom ?? dayText(host.hass, moment) };
}

/**
 * `input_datetime` / `date` / `time` / `datetime`: the value in the link-button shape (Home Assistant's
 * picker opens on tap) and, for a time of day, the owner's quick-set chips under the row.
 */
export function momentRow(
  host: HelperHost,
  view: EntityView,
  config: HelperRowConfig,
): TemplateResult {
  const state = host.state(view); // a quick-set chip is ahead of the report: the value follows the tap
  const moment = view.status === 'ok' ? parseMomentText(state) : null;
  const parts = momentParts(host, view, config, moment);
  const main = row(
    view,
    config,
    currentTone(view, 'neutral'),
    parts.sub,
    valueButton(host, view, nameOf(view, config), parts.value),
  );
  const settable = view.domain === 'input_datetime' || view.domain === 'time';
  if (!moment || moment.hasDate || !settable || !config.presets?.length) return main;

  const items: ChipItem[] = [];
  for (const preset of config.presets) {
    const time = presetTime(preset);
    if (time)
      items.push({
        key: time,
        label: timeText(host.hass, { ...moment, date: new Date(`1970-01-01T${time}Z`) }),
        active: state.slice(0, 5) === time.slice(0, 5),
      });
  }
  if (!items.length) return main;
  // a narrow column gives the chips the whole line rather than breaking the set in two
  return html`${main}
    <div class="in-quick ${host.contentWidth < NARROW ? 'in-quick--flush' : ''}">
      ${chips(items, (time) => {
        if (state.slice(0, 5) === time.slice(0, 5)) return;
        host.expect(view.id, time);
        host.call(
          view.domain,
          view.domain === 'time' ? 'set_value' : 'set_datetime',
          { time },
          view.id,
        );
      })}
    </div>`;
}

/** `input_button` / `button`: a quiet "Run"; the sub says when it last ran (the state of a button is that moment). */
export function buttonRow(
  host: HelperHost,
  view: EntityView,
  config: HelperRowConfig,
): TemplateResult {
  const pressed = view.status === 'ok' ? new Date(view.state) : null;
  const sub =
    config.secondary ??
    (pressed && !Number.isNaN(pressed.getTime())
      ? sentenceCase(relativeAgo(host.hass, pressed))
      : contextOf(host, view, config));
  const name = nameOf(view, config);
  const run = rowButton(
    'quiet',
    s(host.hass, 'run'),
    s(host.hass, 'run_named', { name }),
    () => host.call(view.domain, 'press', {}, view.id),
    isUnusable(view),
  );
  return row(view, config, currentTone(view, 'neutral'), sub, run);
}

/** Anything else (the sheet's Sun row): read-only state stays plain, and the row opens more-info. */
export function plainRow(
  host: HelperHost,
  view: EntityView,
  config: HelperRowConfig,
): TemplateResult {
  const missing = view.status === 'missing';
  const parts = valueParts(host.hass, view);
  return listRow({
    icon: iconOf(view, config),
    tone: currentTone(view, isActive(view) ? toneFor(view) : 'neutral'),
    title: nameOf(view, config),
    sub: rowSub(host, view, config),
    trailing: 'value',
    value:
      view.status !== 'ok'
        ? '—'
        : view.number !== null
          ? `${parts.value}${parts.unit ? ` ${parts.unit}` : ''}`
          : stateText(host.hass, view),
    unavailable: isUnusable(view),
    onTap: missing ? undefined : () => host.moreInfo(view.id),
  });
}
