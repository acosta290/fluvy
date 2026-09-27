import {
  formatNumber,
  stateText,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
  type MessageKey,
} from '@fluvy/core';

import { glyph, sheetStyles } from '@fluvy/ui';
import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { keyed } from 'lit/directives/keyed.js';

import { dateLine } from '../helpers/datetime.js';

import { Card } from '../shared/base.js';

import { FontsSettled } from '../shared/fonts.js';

import { entityField, fieldRow, formLabels, textField } from '../shared/form.js';

import { s as weatherWord } from '../weather/strings.js';

import { overflows } from './fit.js';

import { s } from './strings.js';
import { conditionGlyph, isCondition, isNight } from '../shared/weather.js';

export interface HelloCardConfig extends FluvyCardConfig {
  /** Who is greeted. Falls back to the first word of the signed-in user's name. */
  name?: string;
  /** Person entity: its picture fills the avatar, and tapping the avatar opens its more-info. */
  person?: string;
  /** Weather entity: condition glyph + temperature + condition at the right of the date. */
  weather?: string;
  /** Test hook — freezes "now" at this ISO instant. Not part of the documented config. */
  _now?: string;
}

/**
 * English greets the evening until 22:00 and only then says "night" (a farewell before that). Spanish
 * has no evening: "buenas tardes" runs from lunch to about 20:00 and "buenas noches" greets from then on.
 */
function greetingKey(hour: number, language: string): MessageKey {
  if (language === 'es') {
    if (hour >= 5 && hour < 13) return 'greeting.morning';
    if (hour >= 13 && hour < 20) return 'greeting.afternoon';
    return 'greeting.night';
  }
  if (hour >= 5 && hour < 12) return 'greeting.morning';
  if (hour >= 12 && hour < 18) return 'greeting.afternoon';
  if (hour >= 18 && hour < 22) return 'greeting.evening';
  return 'greeting.night'; // 22:00 – 04:59
}

/** Up to two initials of a display name; an empty name gives none (the gradient disc stands alone). */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word][0]?.toLocaleUpperCase() ?? '')
    .join('');
}

/** Dates come lower-case in Spanish ("jueves, 17 de septiembre"); a line of its own starts with a capital. */
const sentence = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/**
 * The greeting at the top of a dashboard: "Good evening, Marta", the date, the weather of the
 * moment and a 44 avatar. It is not a card surface — no box, no hairline: it sits on the page as
 * the sheet draws it. One timer aligned to the hour re-renders it; nothing runs per second.
 *
 * The block never clips what it says: after each render `fit()` steps the greeting from 28 to 22
 * when the name is long, the date from "Thursday, September 17" to "Thu, Sep 17" when the weather
 * needs the room, and in the narrowest columns the weather to glyph + degrees. Ellipsis is only the
 * last resort.
 */
export class FluvyHelloCard extends Card<HelloCardConfig> {
  static override still = true;

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.home,
    css`
      /* the sheet stacks the block under a status bar; on a dashboard the view's own gap does the spacing */
      .hm-hello {
        margin-top: 0;
        animation: fv-enter 420ms var(--fv-ease-out) both;
        animation-delay: var(--fv-enter-delay, 0ms);
      }
      .hm-hello__title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hm-hello__meta {
        gap: 12px;
        white-space: nowrap;
      }
      .hm-hello__date {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hm-hello__date--short,
      .is-short .hm-hello__date--full {
        display: none;
      }
      .is-short .hm-hello__date--short {
        display: block;
      }
      .hm-hello__weather {
        flex: 0 0 auto;
        max-width: 100%;
        min-width: 0;
      }
      .hm-hello__condition {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .is-compact .hm-hello__word {
        display: none;
      }

      /* the fit measures right after it flips a tier: nothing here may be mid-transition (reduced motion gives
         every property a 1 ms one, and a measurement taken inside it reads the previous size) */
      .hm-hello,
      .hm-hello * {
        transition-property: none;
      }

      /* a long name takes the 22 tier (the wall greeting of the language) and the block closes to 52 */
      .is-small.hm-hello {
        height: 52px;
      }
      .is-small .hm-hello__title {
        font-size: 22px;
        line-height: 28px;
        letter-spacing: -0.01em;
      }

      .hm-avatar {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        font-size: 15px;
        font-weight: 600;
        line-height: 20px;
        color: var(
          --fluvy-on-mark,
          color-mix(
            in srgb,
            var(--fluvy-on-primary) var(--fluvy-solid, 0%),
            var(--fluvy-text-on-accent)
          )
        );
      }
      .hm-avatar__img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: cover;
        opacity: 0;
        transition: opacity var(--fv-slow) var(--fv-ease);
      }
      .hm-avatar__img.is-loaded {
        opacity: 1;
      }
      /* the sheet's 2 px ring is an inset shadow; over a picture it has to be drawn above it */
      .hm-avatar::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        box-shadow: inset 0 0 0 2px var(--fluvy-card);
        pointer-events: none;
      }
    `,
  ];

  constructor() {
    super();
    // the size tier is fitted to laid-out text: fitted again once a web font is in use
    new FontsSettled(this);
  }

  static getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        textField('name'),
        fieldRow(
          entityField(['person'], 'person', false),
          entityField(['weather'], 'weather', false),
        ),
      ],
      ...formLabels({ name: 'editor.name', person: 'editor.entity', weather: 'editor.weather' }),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): HelloCardConfig {
    const person = entities.find((id) => id.startsWith('person.'));
    const weather = entities.find((id) => id.startsWith('weather.'));
    return {
      type: 'custom:fluvy-hello-card',
      ...(person ? { person } : {}),
      ...(weather ? { weather } : {}),
    };
  }

  override getCardSize(): number {
    return 2;
  }
  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  protected override watched(): readonly string[] {
    const ids = ['sun.sun'];
    if (this.config?.weather) ids.push(this.config.weather);
    if (this.config?.person) ids.push(this.config.person);
    return ids;
  }

  /* ---------- the hour tick ---------- */

  private hourTimer: number | undefined;

  override connectedCallback(): void {
    super.connectedCallback();
    this.scheduleHour();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.hourTimer);
    this.hourTimer = undefined;
  }

  /** One timer, aligned to the next whole hour: the greeting and the date can only change there. */
  private scheduleHour(): void {
    clearTimeout(this.hourTimer);
    const now = new Date();
    const next = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours() + 1,
      0,
      0,
      500,
    );
    this.hourTimer = window.setTimeout(() => {
      this.requestUpdate();
      this.scheduleHour();
    }, next.getTime() - now.getTime());
  }

  /* ---------- fit ---------- */

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.fit();
  }

  /**
   * Chooses the tiers from the laid-out text, the way `fitPills` sizes a badge: the classes live on
   * the section outside Lit's bindings, so nothing re-renders and nothing is painted in between.
   */
  private fit(): void {
    const block = this.renderRoot.querySelector<HTMLElement>('.hm-hello');
    const title = block?.querySelector<HTMLElement>('.hm-hello__title');
    const date = block?.querySelector<HTMLElement>('.hm-hello__date--full');
    const short = block?.querySelector<HTMLElement>('.hm-hello__date--short');
    if (!block || !title || !date || !short) return;
    block.classList.remove('is-small', 'is-short', 'is-compact');
    block.classList.toggle('is-small', overflows(title));
    // the date gives way in steps: the short form first, then the weather drops its word and keeps glyph + degrees
    if (overflows(date)) block.classList.add('is-short');
    if (overflows(short)) block.classList.add('is-compact');
  }

  /* ---------- content ---------- */

  private now(): Date {
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    return frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
  }

  /** The configured name, else the first name of the configured person (the avatar's), else the signed-in user's. */
  private who(): string {
    const configured = this.config?.name?.trim();
    if (configured) return configured;
    const person = this.config?.person ? this.entity(this.config.person) : null;
    const named =
      person && person.status !== 'missing' ? person.name : (this.hass?.user?.name ?? '');
    return named.trim().split(/\s+/)[0] ?? '';
  }

  /** Condition glyph + "18° Clear". An unreachable weather entity says so; it never shows a number it does not have. */
  private weather(view: EntityView): TemplateResult {
    if (view.status !== 'ok') {
      return html`<span class="hm-hello__weather"
        >${glyph('ban')}<span class="hm-hello__condition">${stateText(this.hass, view)}</span></span
      >`;
    }
    const night = isNight(this.hass, view.state);
    const known = isCondition(view.state) ? view.state : null;
    const icon = conditionGlyph(view.state, night, night ? 'moon' : 'cloud');
    // a clear sky after dark is "Clear" beside its moon, whatever the integration calls it
    const word = known
      ? weatherWord(this.hass, known === 'sunny' && night ? 'clear-night' : known)
      : stateText(this.hass, view);
    const temperature = view.attr<number | null>('temperature');
    const degrees =
      typeof temperature === 'number' && Number.isFinite(temperature)
        ? `${formatNumber(this.hass, temperature, { digits: 0 })}°`
        : '';
    return html`<span class="hm-hello__weather"
      >${glyph(icon)}<span class="hm-hello__condition"
        >${degrees}<span class="hm-hello__word">${degrees ? ' ' : ''}${word}</span></span
      ></span
    >`;
  }

  private avatar(name: string): TemplateResult {
    const id = this.config?.person;
    const person = id ? this.entity(id) : null;
    const path = person?.attr<string | null>('entity_picture');
    const picture = path && this.hass ? this.hass.hassUrl(path) : '';
    const label =
      person && person.status !== 'missing' ? person.name : name || s(this.hass, 'profile');
    const loaded = (event: Event): void =>
      (event.currentTarget as HTMLElement).classList.add('is-loaded');
    // a picture that fails to load leaves the gradient disc of the sheet, never a broken image
    const body = picture
      ? keyed(
          picture,
          html`<img
            class="hm-avatar__img"
            src=${picture}
            alt=""
            draggable="false"
            @load=${loaded}
          />`,
        )
      : html`<span data-align="center"
          >${initialsOf(person && person.status !== 'missing' ? person.name : name)}</span
        >`;

    if (!id)
      return html`<span class="hm-avatar" data-icon role="img" aria-label=${label}>${body}</span>`;
    return html`<button
      class="hm-avatar fv-ico--tap"
      data-icon
      data-target
      aria-label=${label}
      @click=${() => this.tap(id, { action: 'more-info' })}
    >
      ${body}
    </button>`;
  }

  protected renderCard(): TemplateResult {
    const now = this.now();
    const name = this.who();
    const greeting = this.t(
      greetingKey(now.getHours(), (this.hass?.language ?? 'en').split('-')[0] ?? 'en'),
    );
    const weatherId = this.config?.weather;

    return html`<section class="hm-hello">
      <div class="hm-hello__text">
        <h1 class="hm-hello__title">
          ${name ? s(this.hass, 'greeting', { greeting, name }) : greeting}
        </h1>
        <p class="hm-hello__meta">
          <span class="hm-hello__date hm-hello__date--full"
            >${sentence(dateLine(this.hass, now, 'full'))}</span
          >
          <span class="hm-hello__date hm-hello__date--short"
            >${sentence(dateLine(this.hass, now, 'short'))}</span
          >
          ${weatherId ? this.weather(this.entity(weatherId)) : nothing}
        </p>
      </div>
      ${this.avatar(name)}
    </section>`;
  }
}
