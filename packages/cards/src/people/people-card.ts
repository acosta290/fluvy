import {
  formatTime,
  navigate,
  stateText,
  strings,
  type EntityView,
  type FluvyCardConfig,
  type LovelaceConfigForm,
  type LovelaceGridOptions,
} from '@fluvy/core';
import { firstFit, head, round, sheetStyles } from '@fluvy/ui';
import { css, html, nothing, type CSSResultGroup, type TemplateResult } from 'lit';
import { agoShort } from '../helpers/datetime.js';
import { Card, type BaseKey } from '../shared/base.js';
import {
  accentField,
  actionFields,
  boolField,
  editorLabels,
  entitiesField,
  fieldRow,
  iconField,
  selectField,
  textField,
} from '../shared/form.js';
import { configKeys, type AliasSpec } from '../shared/config.js';

const s = strings('people');

export type PeopleLayout = 'grid' | 'rows';

export interface PeopleCardConfig extends FluvyCardConfig {
  title?: string;
  /** `grid` = the sheet's avatar columns; `rows` = the desktop composition's 60 rows (avatar, name, time or zone, state at the right). */
  variant?: PeopleLayout;
  /** Where the map round button goes (default `/map`). */
  map_path?: string;
  /** Under a name: the zone someone is in (default), and the time they arrived (when there is no zone, or the zone is off). */
  show_zone?: boolean;
  show_time?: boolean;
  /** Test hook: an ISO date that freezes "now" (the times in the sub lines). Undocumented. */
  _now?: string;
}

type Presence = 'home' | 'away' | 'off';

interface Person {
  readonly view: EntityView;
  readonly presence: Presence;
  /** "Home", "Away", or the honest "Unavailable" / "Unknown" the entity is reporting. */
  readonly word: string;
  /** The zone the person is in when it is not home, else ''. */
  readonly zone: string;
  /** When the state last changed: the clock time today, a short relative time before that. */
  readonly since: string;
  readonly picture: string;
}

/** Two letters from the name: the face of a person without a picture. */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  return `${[...first][0] ?? '?'}${[...last][0] ?? ''}`.toLocaleUpperCase();
}

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/**
 * Who is home: the count in the head, a round button to the map, and one 44 avatar per person —
 * the picture Home Assistant has, else initials on the accent fill — with the name and where they
 * are. Home keeps the full avatar and lights the presence dot; away dims it. Coordinates are never
 * shown: where a person is, is a zone name or nothing.
 */
export class FluvyPeopleCard extends Card<PeopleCardConfig> {
  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    sheetStyles.ambient,
    css`
      /* the lab fixes the sheet at 360; a dashboard column decides here */
      .am-card {
        width: 100%;
      }
      .am-people {
        grid-template-columns: repeat(var(--am-people, 3), minmax(0, 1fr));
      }
      .am-person {
        width: 100%;
        min-width: 0;
        cursor: pointer;
      }
      .am-person__name,
      .am-person__state {
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .am-person__name {
        transition: color var(--fv-base) var(--fv-ease);
      }
      .am-avatar {
        flex: 0 0 44px;
        transition:
          transform var(--fv-fast) var(--fv-ease),
          opacity var(--fv-slow) var(--fv-ease);
      }
      .am-person:active .am-avatar,
      .fv-row--tap:active .am-avatar {
        transform: scale(0.94);
      }
      .am-avatar__face {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        font-size: 15px;
        font-weight: 600;
        line-height: 20px;
        letter-spacing: 0.02em;
      }
      /* no picture: initials in the icon circle's own terms — accent fill at home, neutral away (a picture dims instead, as the sheet does) */
      .am-avatar.is-initials {
        opacity: 1;
        background: var(--fluvy-page);
        color: var(--fluvy-text-secondary);
      }
      .am-avatar.is-initials.is-home {
        background: var(--fluvy-accent-fill);
        color: var(--fluvy-accent-on-fill);
      }
      /* unavailable / unknown: the dashed ring of the language, no fill, no presence to report */
      .am-avatar.is-off {
        background: none;
        outline: 1px dashed var(--fluvy-unavailable-border);
        outline-offset: -1px;
        color: var(--fluvy-unavailable);
      }
      /* rows (the desktop composition): the state once at the right, quiet when it is not "Home" */
      .fv-row__value--quiet {
        color: var(--fluvy-text-secondary);
      }
      @media (hover: hover) {
        .am-person:hover .am-person__name {
          color: var(--fluvy-accent);
        }
      }
    `,
  ];

  static override properties = { ...Card.properties, broken_: { state: true } };

  /** Pictures that failed to load: those people fall back to initials instead of a broken image. */
  declare broken_: ReadonlySet<string>;

  constructor() {
    super();
    this.broken_ = new Set();
  }

  /** The people have no entity of their own: the head's icon and the card's colour are the base fields it honours. */
  static override base: readonly BaseKey[] = [
    'entities',
    'icon',
    'color',
    'tap_action',
    'hold_action',
  ];
  static override keys = configKeys<PeopleCardConfig>()([
    'title',
    'variant',
    'map_path',
    'show_zone',
    'show_time',
  ]);
  static override aliases: AliasSpec = { keys: [{ from: 'layout', to: 'variant' }] };
  static override getConfigForm(): LovelaceConfigForm {
    return {
      schema: [
        entitiesField('entities', ['person', 'device_tracker'], true),
        fieldRow(textField('title'), iconField()),
        fieldRow(selectField('variant', ['grid', 'rows']), textField('map_path')),
        fieldRow(boolField('show_zone'), boolField('show_time')),
        accentField(),
        actionFields(),
      ],
      ...editorLabels(s, { map_path: 'editor.map_path' }, {}),
    };
  }

  static getStubConfig(_hass: unknown, entities: readonly string[]): PeopleCardConfig {
    return {
      type: 'custom:fluvy-people-card',
      entities: entities.filter((id) => id.startsWith('person.')).slice(0, 3),
    };
  }

  protected override prepare(config: PeopleCardConfig): PeopleCardConfig {
    if (!config.entities?.length) throw new Error('fluvy-people-card: add at least one person');
    return config;
  }

  override getCardSize(): number {
    const count = this.config?.entities?.length ?? 1;
    return this.config?.variant === 'rows' ? 2 + count : 2 + 2 * Math.ceil(count / 3);
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  private now(): Date {
    const frozen = this.config?._now ? new Date(this.config._now) : null;
    return frozen && !Number.isNaN(frozen.getTime()) ? frozen : new Date();
  }

  private person(view: EntityView, now: Date): Person {
    const usable = view.status === 'ok';
    const presence: Presence = !usable ? 'off' : view.state === 'home' ? 'home' : 'away';
    const changed = view.stateObj ? new Date(view.stateObj.last_changed) : null;
    const picture = usable ? (view.attr<string | null>('entity_picture') ?? '') : '';
    return {
      view,
      presence,
      word:
        presence === 'off'
          ? stateText(this.hass, view)
          : this.t(presence === 'home' ? 'person.home' : 'person.away'),
      // a person in a zone reports the zone's own name as its state
      zone: presence === 'away' && view.state !== 'not_home' ? view.state : '',
      since:
        !usable || !changed || Number.isNaN(changed.getTime())
          ? ''
          : sameDay(changed, now)
            ? formatTime(this.hass, changed)
            : agoShort(this.hass, changed, now),
      picture: picture && this.hass ? this.hass.hassUrl(picture) : '',
    };
  }

  private renderAvatar(person: Person): TemplateResult {
    const { view, presence, picture } = person;
    const shown = picture !== '' && !this.broken_.has(picture);
    return html`<span
      class="am-avatar ${presence === 'home' ? 'is-home' : ''} ${shown ? '' : 'is-initials'} ${presence === 'off' ? 'is-off' : ''}"
      data-icon
    >
      ${
        shown
          ? html`<img
              class="am-avatar__face"
              src=${picture}
              alt=""
              draggable="false"
              @error=${() => {
                this.broken_ = new Set([...this.broken_, picture]);
              }}
            />`
          : html`<span class="am-avatar__face" aria-hidden="true">${initials(view.name)}</span>`
      }
      ${presence === 'off' ? nothing : html`<i class="am-avatar__dot"></i>`}
    </span>`;
  }

  /** The sheet: avatar, name, "Home · 18:40" / "Away · School" — the state and its one detail. */
  /** Under a name: the zone, when shown and there is one; else the time, when shown. */
  private detail(person: Person): string {
    const zone = this.config?.show_zone === false ? '' : person.zone;
    return zone || (this.config?.show_time === false ? '' : person.since);
  }

  private renderGrid(people: readonly Person[]): TemplateResult {
    // as many of the sheet's 96 columns (+ 16 gap) as the card holds, never more than there are people to spread over them
    const columns = Math.max(
      2,
      Math.min(4, Math.floor((this.contentWidth + 16) / 112), people.length),
    );
    return html`<div class="am-people fv-cols" data-align="center" style="--am-people:${columns}">
      ${people.map((person) => {
        const detail = this.detail(person);
        const line = detail ? `${person.word} · ${detail}` : person.word;
        return html`<button
          class="am-person"
          data-target
          aria-label=${`${person.view.name} · ${line}`}
          @click=${() => this.tap(person.view.id, { action: 'more-info' })}
        >
          ${this.renderAvatar(person)}
          <span class="am-person__name">${person.view.name}</span>
          <span class="am-person__state">${line}</span>
        </button>`;
      })}
    </div>`;
  }

  /** The desktop composition: the list row with the avatar in the icon column, the state said once at the right. */
  private renderRows(people: readonly Person[]): TemplateResult {
    return html`<div class="am-rows">
      ${people.map((person) => {
        const open = (): void => this.tap(person.view.id, { action: 'more-info' });
        const key = (event: KeyboardEvent): void => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
          }
        };
        const sub = this.detail(person);
        return html`<div
          class="fv-row fv-row--tap"
          role="button"
          tabindex="0"
          @click=${open}
          @keydown=${key}
        >
          ${this.renderAvatar(person)}
          <span class="fv-row__text"
            ><span class="fv-row__title">${person.view.name}</span
            >${sub ? html`<span class="fv-row__sub">${sub}</span>` : nothing}</span
          >
          <span class="fv-row__value ${person.presence === 'home' ? '' : 'fv-row__value--quiet'}"
            >${person.word}</span
          >
        </div>`;
      })}
    </div>`;
  }

  protected renderCard(): TemplateResult {
    const now = this.now();
    const people = (this.config?.entities ?? []).map((id) => this.person(this.entity(id), now));
    const home = people.filter((person) => person.presence === 'home').length;

    // "updated now": how fresh the freshest report is — a tracker reports far more often than its state changes
    let latest = 0;
    for (const { view } of people) {
      const at =
        view.stateObj && view.status === 'ok' ? Date.parse(view.stateObj.last_updated) : NaN;
      if (Number.isFinite(at) && at > latest) latest = at;
    }
    const when =
      latest === 0
        ? ''
        : now.getTime() - latest < 60_000
          ? this.t('common.now').toLocaleLowerCase()
          : agoShort(this.hass, new Date(latest), now);
    const count = s(this.hass, 'count', { home, total: people.length });
    // the head: 44 circle + 12, the titles, 12 + the 44 round; "updated" is the first word to go, the time the second
    const sub = when
      ? firstFit(
          [`${count} · ${s(this.hass, 'updated', { when })}`, `${count} · ${when}`, count],
          this.contentWidth - 112 - 4,
          `500 13px ${getComputedStyle(this).fontFamily}`,
        )
      : count;

    return html`<article class="fv-card am-card" data-card>
      ${head({
        icon: this.config?.icon ?? 'person',
        tone: home > 0 ? 'accent' : 'neutral',
        title: this.config?.title ?? s(this.hass, 'title'),
        sub,
        trailing: round('map', 'quiet', s(this.hass, 'map'), () =>
          navigate(this.config?.map_path ?? '/map'),
        ),
        onIconTap: () => this.tap(),
        onHold: () => this.hold(),
      })}
      ${this.config?.variant === 'rows' ? this.renderRows(people) : this.renderGrid(people)}
    </article>`;
  }
}
