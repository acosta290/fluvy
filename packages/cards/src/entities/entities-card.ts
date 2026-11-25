import {
  isActive,
  isUsable,
  lightDefaults,
  localize,
  navigate,
  SAFE_TOGGLE,
  stateText,
  toggleEntity,
  valueParts,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceGridOptions,
} from '@fluvy/core';

import { head, listRow, wordsClass, type Tone } from '@fluvy/ui';

import {
  css,
  html,
  nothing,
  type CSSResultGroup,
  type PropertyValues,
  type TemplateResult,
} from 'lit';

import { Card, type CardEditor } from '../shared/base.js';

import { currentTone, iconOf, toneFor } from '../shared/domain.js';
import { chosenLabel, dropdown, dropdownEnd, SELECTS } from '../shared/dropdown.js';
import type { RowConfig } from '../lock/rows.js';
import { ITEM_ALIASES, type AliasSpec } from '../shared/config.js';
import { statusToneOf, toneOf, type LightColours } from '../shared/colour.js';
import { headless, noBadge, noLine } from '../shared/head-lines.js';
import { lightLook, litColour, withMembers } from '../shared/light.js';
import { stateLook } from '../shared/state-tint.js';
import {
  buttonWidth,
  fitValue,
  rowEndStyles,
  rowsKeepIcon,
  rowStacks,
  valueFitStyles,
  wrapsInWords,
  type ValueFit,
} from '../shared/row-end.js';
import { rowLine, type RowLine } from '../shared/secondary.js';
import { sinceIds } from '../shared/since.js';
import { TemplateTexts } from '../shared/templates.js';
import { EMPTY, entryCount, HEAD, ROW_COMPACT, ROW, sectionsHeight } from '../shared/heights.js';
import {
  conditionIds,
  drawnOf,
  emptyPanel,
  isRow,
  itemsOf,
  listOf,
  withSections,
  type ConditionalRow,
  type ConditionalRows,
  type EmptyList,
  type SectionEntry,
} from '../shared/lists.js';
import { HeadFit, SWITCH_SLOT } from '../energy/head.js';
import { numberControls, numbersLanding, numberText } from '../shared/number.js';
import type { NumberEnd } from '../shared/number-controls.js';

/**
 * How a number (an `input_number`, a `number`, a `counter`) ends its row (#218): its value, as any row's (the default),
 * its value between − and +, or its value as a button that opens a field to type one (never a counter's).
 */
export type NumberControl = 'value' | 'stepper' | 'entry';

/**
 * How a row whose end is its value says its state (#234): in words (`text`, the default), or as the icon its state
 * names (`icon`) — a row's own, else the card's, for the state as Home Assistant writes it.
 */
export interface StateIcons {
  state_display?: 'text' | 'icon';
  /** A state's icon (`ok: mdi:check-circle-outline`); a state left out keeps its words. */
  state_icons?: Readonly<Record<string, string>>;
  /** A state's icon's colour (`warning: warning`): a tone's name, a colour, or `none`; the row's own, else the card's. */
  state_colors?: Readonly<Record<string, string>>;
}

/**
 * A row of the card: the rows every list shares (`RowConfig`), shown while its condition holds (`show_when`, #157),
 * a number's as it asks (`number_control`, the card's where it says none), its state as it asks (`StateIcons`).
 */
export type EntityRowConfig = RowConfig &
  ConditionalRow &
  StateIcons & { number_control?: NumberControl };

/** `show_rows_when`: one condition for every row that names none; the state as an icon for every row that says none. */
export interface EntitiesCardConfig
  extends FluvyCardConfig, EmptyList, ConditionalRows, LightColours, StateIcons {
  title?: string;
  subtitle?: string;
  /** The entities, with a section's label or a hairline between them where the list is in parts (`SectionEntry`). */
  rows?: ReadonlyArray<string | EntityRowConfig | SectionEntry>;
  /** Show "3 on" / "All off" in the head. */
  show_count?: boolean;
  /** `rows` (default): 60 px rows with a second line. `compact`: 48 px rows, the name alone. */
  variant?: 'rows' | 'compact';
  /** How the numbers' rows end (#218): `value` (the default), `stepper` or `entry`; a row's own wins. */
  number_control?: NumberControl;
  /**
   * How many more the list has elsewhere: a last row, "{count} more", that opens `more_path` (the automatic
   * dashboards end a capped list with it, #78). Both or none.
   */
  more?: number;
  more_path?: string;
}

/** The "N more" row a card ends with: how many, and where they are; none without both. */
const moreOf = (config: EntitiesCardConfig | undefined): { count: number; path: string } | null => {
  const count = Math.floor(Number(config?.more));
  const path = config?.more_path;
  return count >= 1 && typeof path === 'string' && path ? { count, path } : null;
};

/** The domains whose row ends in their state (a sensor's too, and any number's), where nothing else ends it. */
export const READ_OUT: ReadonlySet<string> = new Set([
  'binary_sensor',
  'person',
  'sun',
  'weather',
  'input_select',
  'select',
  'lock',
  'vacuum',
  'media_player',
]);

/** The width of a state said as its icon (#234): its 20 glyph at the row's end. */
const STATE_ICON = 20;

/** The tones of the status words a state's icon wears with no colour of its own (#234). */
const STATUS_TONES: Readonly<Record<string, Tone>> = {
  ok: 'ok',
  good: 'ok',
  normal: 'ok',
  warning: 'warning',
  critical: 'danger',
  error: 'danger',
};

/**
 * The icon a row says `state` with (#234): the row's, else the card's, where the row (else the card) asks for its state
 * as an icon; none where it asks for words, or names no icon for the state, which then keeps its words.
 */
export function stateIconOf(
  row: StateIcons,
  card: StateIcons | undefined,
  state: string,
): string | undefined {
  if ((row.state_display ?? card?.state_display) !== 'icon') return undefined;
  const icon = row.state_icons?.[state] ?? card?.state_icons?.[state];
  return typeof icon === 'string' && icon ? icon : undefined;
}

/**
 * The tone a state's icon wears (#234): the one the row (else the card) gives the state (`state_colors`: a tone, a
 * colour, `none`); else a status word's (ok, warning, critical), or `usual` (a window open, the warning's).
 */
export const stateIconTone = (
  accents: Parameters<typeof stateLook>[0],
  row: StateIcons,
  card: StateIcons | undefined,
  state: string,
  usual: Tone,
): ReturnType<typeof stateLook> => {
  const own = row.state_colors?.[state] ?? card?.state_colors?.[state];
  return stateLook(
    accents,
    own ? { state_colors: { [state]: own } } : undefined,
    state,
    STATUS_TONES[state] ?? usual,
  );
};

/** Whether a row (or the card, for the rows that say none) sets its number in place (#218). */
const setsNumber = (own: NumberControl | undefined): boolean =>
  own === 'stepper' || own === 'entry';

/**
 * Whether the card draws its head: it has a title, and its head holds more than that title hidden (#259): its circle,
 * its line, or its count (`show_count`, its badge). A head left with nothing in it is none, as with no title.
 */
const headed = (config: EntitiesCardConfig | undefined): boolean =>
  Boolean(config?.title) &&
  !headless(config, noLine(config, true) && noBadge(config, !config?.show_count));

/**
 * A card of 60 px rows: icon circle, title / sub, and ONE trailing element chosen by the entity —
 * a switch for what can be toggled, the value for what is measured, a chevron for the rest.
 * State is said once: the trailing element carries it, the sub line carries context (area or time).
 * A list in parts carries a section's label or a hairline between its rows, and a row may show only while a
 * condition holds (#157): the head counts the rows that show, and with none showing the card is its empty panel.
 */
export class FluvyEntitiesCard extends Card<EntitiesCardConfig> {
  /**
   * The card's height at a 360 column, for the automatic dashboard's columns: its rows of 60 (48 compact), which a
   * section's column always holds. In a column so narrow that a row's state goes under its words (`fitValue`: half
   * a section, a long word), the live card is that state's lines taller (20 each, 4 over them) and its grid follows
   * it (`rows: auto`); no config can say which states those are.
   */
  static override layoutHeight(config: EntitiesCardConfig): number {
    const n = entryCount(config, ['rows', 'entities']) + (moreOf(config) ? 1 : 0);
    // nothing to list: the panel under the head, or alone in the card (20 + 120 + 20)
    if (!n) return (headed(config) ? HEAD : 40) + EMPTY;
    // the head and 8 over the rows (20 + 44 + 8 + … + 20), else the rows alone, 8 into the padding at each end;
    // every row counted, whatever its condition says now, and the sections between them (a first one's label takes
    // the rows' 8 too)
    return (
      (headed(config) ? 92 : 24) +
      (config.variant === 'compact' ? ROW_COMPACT : ROW) * n +
      sectionsHeight(config.rows ?? config.entities, 28)
    );
  }

  static override styles: CSSResultGroup = [
    ...(Card.styles as CSSResultGroup[]),
    rowEndStyles,
    valueFitStyles,
    css`
      .fv-rows {
        margin-top: 8px;
      }
      .fv-rows--bare {
        margin-top: -8px;
        margin-bottom: -8px;
      }
    `,
  ];

  static override properties = { ...Card.properties, typing_: { state: true } };

  /** The row (by its place) whose number's figure is being typed (`number_control: entry`, #218). */
  declare typing_: number | null;

  constructor() {
    super();
    this.typing_ = null;
  }

  static override editor(): Promise<CardEditor> {
    return import('./entities-editor.js');
  }
  static override aliases: AliasSpec = { items: { rows: ITEM_ALIASES } };
  /** A row's second line when it is a template: rendered by Home Assistant, live. */
  private readonly texts = new TemplateTexts(this);
  /** Fits the head to its column (measured in the card's own classes, again when a font lands). */
  private readonly head = new HeadFit(this);

  static getStubConfig(
    hass: HomeAssistant | undefined,
    entities: readonly string[],
  ): EntitiesCardConfig {
    return {
      type: 'custom:fluvy-entities-card',
      title: localize(hass, 'entities.devices'),
      entities: entities.slice(0, 4),
    };
  }

  private rows(): EntityRowConfig[] {
    return itemsOf(this.config?.rows ?? this.config?.entities);
  }

  protected override prepare(config: EntitiesCardConfig): EntitiesCardConfig {
    listOf(config, 'rows', ['entities']);
    return config;
  }

  /**
   * The rows' entities (a light group's members too), what the rows' last change is read from (`since`), and what
   * their conditions read.
   */
  protected override watched(): readonly string[] {
    const rows = this.rows();
    return [
      ...withMembers(
        rows.map((r) => r.entity),
        this.hass,
      ),
      ...sinceIds(rows),
      ...conditionIds(rows, this.config?.show_rows_when),
    ];
  }

  override getCardSize(): number {
    return 1 + this.rows().length + (moreOf(this.config) ? 1 : 0);
  }

  /** A card whose numbers are set in their rows (#218) draws its first frame once their controls are here. */
  protected override wearing(): Promise<void> | undefined {
    return super.wearing() ?? (this.setsNumbers() ? numbersLanding() : undefined);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // a figure's field just opened: the keypad comes up on the figure, chosen whole
    if (changed.has('typing_') && this.typing_ !== null)
      numberControls(this)?.focusEntry(this.renderRoot);
  }

  /** Whether the card or a row asks for a number set in place (#218). */
  private setsNumbers(): boolean {
    return (
      setsNumber(this.config?.number_control) ||
      this.rows().some((row) => setsNumber(row.number_control))
    );
  }

  /**
   * The numbers' controls at their rows' ends (#218), by the rows' places (`rowEnds`): none where nothing asks for one,
   * or while their chunk is on its way.
   */
  private numberEnds(
    rows: readonly EntityRowConfig[],
    views: readonly EntityView[],
  ): readonly (NumberEnd | null)[] {
    const controls = this.setsNumbers() ? numberControls(this) : null;
    return controls
      ? controls.rowEnds(
          this.head.ruler,
          this.contentWidth,
          this.hass,
          rows.map((row, i) => {
            const view = views[i] as EntityView;
            return {
              view,
              asked: row.number_control ?? this.config?.number_control,
              name: this.nameFor(view, row.name),
              shown: this.stateOf(view),
            };
          }),
        )
      : [];
  }

  override getGridOptions(): LovelaceGridOptions {
    return { columns: 12, rows: 'auto', min_columns: 6 };
  }

  /**
   * Where a row's end stands in the card's column, and the room its words have (`ValueFit`). A switch and a chevron
   * keep their own width at the row's end and never move: the name gives way beside them. A dropdown goes under the
   * words where even without the circle it would not hold beside them (`rowStacks`), a compact row's too. A value's
   * words are weighed by `fitValue`: on one line, on two, or under the words.
   */
  private fit(
    row: {
      readonly trailing: 'switch' | 'value' | 'chevron' | 'menu' | 'number';
      readonly title: string;
      readonly value: string;
      readonly end: number | undefined;
      readonly lines: RowLine;
    },
    keep: boolean,
    compact: boolean,
  ): ValueFit {
    const { ruler } = this.head;
    const width = this.contentWidth;
    const base = this.head.rowRoom(width, '', { icon: keep, compact });
    const [, short, least] = row.lines.forms;
    if (row.trailing === 'menu') {
      const stack =
        !keep && rowStacks(ruler, width, dropdownEnd(row.title, row.value, compact ? '' : short));
      return { stack, room: stack ? width : base - (row.end ?? 0) };
    }
    if (row.end !== undefined) return { stack: false, room: base - row.end };
    return fitValue(ruler, {
      row: width,
      base,
      name: row.title,
      value: row.value,
      cls: `fv-row__value ${wordsClass(row.value)}`.trim(),
      least: compact ? 0 : ruler.width('fv-row__sub', least),
      // a state in words; a figure and its unit stay on one line
      wraps: wrapsInWords(row.value),
    });
  }

  protected renderCard(): TemplateResult {
    // the rows whose condition holds, and the sections over them: what is counted, fitted and drawn
    const drawn = drawnOf<EntityRowConfig>(
      this.hass,
      this.config?.rows ?? this.config?.entities,
      this.config?.show_rows_when,
    );
    const rows = drawn.filter(isRow<EntityRowConfig>);
    const views = rows.map((row) => this.entity(row.entity));
    const active = views.filter((v) => isActive(v)).length;
    const tone = toneOf(this.config, 'accent');
    const compact = this.config?.variant === 'compact';
    const title = headed(this.config) ? this.config?.title : undefined;
    // a lit light's row may wear its bulb's colour (`light_colors`, the house's where the card says none)
    const glows = this.config?.light_colors ?? lightDefaults().colors;
    const more = moreOf(this.config);
    const panel = emptyPanel(this, !rows.length && !more, 'grid', 'common.no_entities');
    // the count gives way to the title, then the circle does, as every head's do (`HeadFit`); an empty list's panel
    // says what a count of nothing would
    const fitted = title
      ? this.head.fit({
          width: this.contentWidth,
          title,
          sub: this.config?.subtitle ?? '',
          badge:
            this.config?.show_count && !panel
              ? {
                  text:
                    active > 0
                      ? `${active} ${this.t('common.on').toLowerCase()}`
                      : this.t('common.off'),
                  tone: active > 0 ? tone : 'neutral',
                }
              : null,
        })
      : null;
    const header =
      title && fitted
        ? head({
            icon: fitted.icon ? (this.config?.icon ?? 'grid') : null,
            tone,
            title,
            sub: fitted.sub,
            trailing: fitted.badge,
            // a card of many: its head answers only what its config says (a page to open, #179)
            ...this.headActions(),
          })
        : nothing;

    // what ends each row (its switch, its value's words, its chevron, a select's dropdown, a number's control) is
    // decided before the rows are drawn: a column too narrow for a name beside its end gives every row's circle to the
    // names, as every list does
    const numbers = this.numberEnds(rows, views);
    const laid = rows.map((row, i) => {
      const view = views[i] as EntityView;
      const usable = isUsable(view);
      // a select's value opens its dropdown (#96), unless the row names a tap of its own
      const menu = SELECTS.has(view.domain) && !row.tap_action;
      // a row switch is for what is safe to flip by accident: never a lock, and not the things that are not on/off
      const canToggle = usable && SAFE_TOGGLE.has(view.domain);
      const measured = view.domain === 'sensor' || view.number !== null;
      const title = this.nameFor(view, row.name);
      // a number set in the row (#218)
      const number = numbers[i] ?? null;
      const trailing: 'switch' | 'value' | 'chevron' | 'menu' | 'number' = menu
        ? 'menu'
        : number
          ? 'number'
          : canToggle
            ? 'switch'
            : usable && (measured || READ_OUT.has(view.domain))
              ? 'value'
              : 'chevron';
      const parts = valueParts(this.hass, view);
      // a select says its option in the row's words (`labels`); a number set in the row, its figure
      const value =
        trailing === 'switch' || trailing === 'chevron'
          ? ''
          : number
            ? `${numberText(this.hass, number.m)}${view.unit ? ` ${view.unit}` : ''}`
            : SELECTS.has(view.domain)
              ? chosenLabel(this.hass, view, row, this.stateOf(view))
              : view.number !== null
                ? `${parts.value}${parts.unit ? ` ${parts.unit}` : ''}`
                : stateText(this.hass, view);
      // a value said as its state's icon (#234), where the row asks for one and names one for the state
      const glyph =
        trailing === 'value' ? stateIconOf(row, this.config, this.stateOf(view)) : undefined;
      // the end's own width where it is not a value's words: a switch's 56, a chevron's 44, a dropdown's button, a
      // number's control, a state's icon
      const end =
        trailing === 'switch'
          ? SWITCH_SLOT
          : trailing === 'chevron'
            ? 44
            : menu
              ? buttonWidth(this.head.ruler, value, true)
              : glyph
                ? STATE_ICON
                : number?.width;
      // the row's line in its forms: whole, short, and the least it says
      const lines = rowLine(
        this.hass,
        view,
        row.secondary,
        trailing === 'value' || menu,
        this.texts,
        row.since,
      );
      return { view, usable, trailing, title, value, end, lines, number, glyph };
    });
    // the "N more" row says it in words where they hold beside its chevron, else as "+N"
    const moreWords = more ? this.t('common.more_count', { count: more.count }) : '';
    const moreTitle =
      more &&
      this.head.rowRoom(this.contentWidth, '', { icon: false, end: 44 }) <
        this.head.ruler.width('fv-row__title', moreWords)
        ? `+${more.count}`
        : moreWords;
    const keep =
      this.head.rowsKeepIcon(
        this.contentWidth,
        [
          ...laid.map(({ title, value, end, lines }) => ({
            title,
            value,
            // the line's short form (a time's "32 d ago"), so a passing minute never moves the circles
            sub: compact ? '' : lines.forms[1],
            ...(end === undefined ? {} : { end }),
          })),
          ...(more ? [{ title: moreTitle, value: '', end: 44 }] : []),
        ],
        compact,
      ) &&
      // …and a dropdown's value holds within its cap beside its name (the rows' rule for a button)
      rowsKeepIcon(
        this.head.ruler,
        this.contentWidth,
        laid.flatMap(({ trailing, title, value }) =>
          trailing === 'menu' ? [dropdownEnd(title, value)] : [],
        ),
      );
    // where each row's end stands and the room its words have, by measure (`fit`): nothing but a name is ever cut
    const width = this.contentWidth;
    const fits = laid.map((p) => this.fit(p, keep, compact));
    const lineWidth = (text: string): number => this.head.ruler.width('fv-row__sub', text);
    /** The first of a row's line's forms its room holds, from `from` on: 3 where none does. */
    const formOf = (index: number, from: number): number => {
      const at = laid[index]!.lines.forms.findIndex(
        (form, i) => i >= from && lineWidth(form) <= fits[index]!.room,
      );
      return at < 0 ? 3 : at;
    };
    // an age is said in one form down the list, the longest every row of an age holds ("32 days ago", "32 d ago",
    // "32 d"): one form a list, as the lock's, the alarm's and the camera's rows say theirs
    const ages = Math.min(2, Math.max(0, ...laid.map((p, i) => (p.lines.age ? formOf(i, 0) : 0))));
    /**
     * The line a row says: the longest of its forms its room holds (an age's from the list's form on). Where none
     * does, a name ends in its ellipsis, as names may; anything else is left out rather than cut, and read in the
     * row's label.
     */
    const line = (index: number): string => {
      const { lines } = laid[index]!;
      if (compact) return '';
      const at = formOf(index, lines.age ? ages : 0);
      return at < 3 ? lines.forms[at]! : lines.name ? lines.forms[0] : '';
    };

    return html`<article
      class="fv-card"
      data-card
      aria-label=${title ? nothing : (this.config?.title ?? nothing)}
    >
      ${header}
      <div class="fv-rows ${title ? '' : 'fv-rows--bare'}">
        ${panel}
        ${withSections(drawn, (row, i) => {
          const { view, usable, trailing, title, value, number, glyph } = laid[i]!;
          const state = this.stateOf(view);
          const on =
            state === view.state ? isActive(view) : !['off', 'closed', 'locked'].includes(state);
          const warn = view.domain === 'binary_sensor' && on && toneFor(view) === 'warning';
          // a light's row wears what the rule every light follows says (`lightLook`); any other its own colour, else
          // its kind's tone (a warning stays one)
          const [colour, rowTone] =
            view.domain === 'light'
              ? lightLook(
                  row,
                  this.config,
                  glows ? litColour(view, on, this.config?.light_whites, this.hass) : undefined,
                )
              : ([row.color, statusToneOf(row, toneFor(view))] as const);
          // a state said as its icon wears its state's tone (#234), a warning's where it says none
          const look = glyph
            ? stateIconTone(this.accents, row, this.config, state, warn ? 'warning' : 'neutral')
            : undefined;
          const fit = fits[i]!;
          const sub = line(i);
          const whole = laid[i]!.lines.forms[0];
          const menu = trailing === 'menu';
          // a row whose end sets its entity (a dropdown, a number's control) is no button of its own: its end is
          const control = menu || number !== null;
          return listRow({
            icon: keep ? iconOf(view, row.icon) : null,
            tone: currentTone(view, on ? rowTone : 'neutral'),
            title,
            name: true,
            sub,
            stack: fit.stack,
            // a template's line is the owner's words and an area's the house's: names, that may end in their ellipsis
            subName: laid[i]!.lines.name,
            // a line said short or left out is read whole
            ...(!compact && !menu && whole && sub !== whole
              ? { label: [title, whole, value].filter(Boolean).join(' · ') }
              : {}),
            valueWidth: fit.width,
            valueSize: fit.size,
            trailing:
              trailing === 'number'
                ? numberControls(this)!.rowEnd({
                    root: this.renderRoot,
                    host: this.controlHost,
                    hass: this.hass,
                    view,
                    name: title,
                    end: number!,
                    typing: this.typing_ === i,
                    onOpen: () => {
                      this.typing_ = i;
                    },
                    onClose: () => {
                      this.typing_ = null;
                    },
                  })
                : menu
                  ? dropdown({
                      host: this.controlHost,
                      hass: this.hass,
                      view,
                      row,
                      name: title,
                      value,
                      stack: fit.stack,
                      ruler: this.head.ruler,
                      width,
                    })
                  : trailing,
            on,
            compact,
            accent: this.accents.item(colour),
            switchTone: rowTone === 'warning' ? 'accent' : rowTone,
            value,
            valueIcon: glyph,
            valueInk:
              look && look.tone !== 'neutral'
                ? this.accents.ink(look.accent ?? look.tone)
                : undefined,
            valueTone: warn ? 'warning' : '',
            unavailable: !usable,
            // out of reach, a row whose end sets its entity opens its details
            ...(control && usable ? {} : this.pressOf(row, view.id)),
            onToggle: (next) => {
              if (!this.hass) return;
              this.expect(
                view.id,
                next
                  ? view.domain === 'cover' || view.domain === 'valve'
                    ? 'open'
                    : view.domain === 'lock'
                      ? 'unlocked'
                      : 'on'
                  : view.domain === 'cover' || view.domain === 'valve'
                    ? 'closed'
                    : view.domain === 'lock'
                      ? 'locked'
                      : 'off',
              );
              void toggleEntity(this.hass, view.id);
            },
          });
        })}
        ${
          more
            ? // the house's fold row: the list's glyph, how many more, the chevron to where they are
              listRow({
                icon: keep ? 'list' : null,
                tone: 'neutral',
                title: moreTitle,
                trailing: 'chevron',
                compact,
                label: moreWords,
                onTap: () => navigate(more.path),
              })
            : nothing
        }
      </div>
    </article>`;
  }
}
