import {
  actionRuns,
  failedToLoad,
  FluvyCard,
  isEntityId,
  type ActionConfig,
  type EntityView,
  type FluvyCardConfig,
  type HomeAssistant,
  type LovelaceCardConfig,
  type LovelaceConfigForm,
} from '@fluvy/core';
import { baseStyles, fitPills, pressCover } from '@fluvy/ui';
import { css, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult } from 'lit';
import type { ShowIcon } from '../energy/head.js';
import { loadChartEngine } from './chart-load.js';
import { COMMON_ALIASES, normaliseConfig, type AliasSpec, type KnownKeys } from './config.js';
import { FontsSettled } from './fonts.js';
import type { EditorChoices, EditorDefaults, RowsListSpec } from './rows-editor.js';
import { ownLine, type OwnLine } from './secondary.js';
import { isTemplate, TemplateTexts } from './templates.js';

/**
 * What a card with a head honours of its circle: whether it shows (`HeadFit` reads it through `Card.showIcon`), and
 * what it answers (#179) — none of it until one is set, the circle then a button of its own.
 */
export interface HeadConfig {
  show_icon?: ShowIcon;
  icon_tap_action?: ActionConfig;
  icon_hold_action?: ActionConfig;
  icon_double_tap_action?: ActionConfig;
}

/** The base card's fields every editor may show; a card names the ones it honours. */
export type BaseKey = KnownKeys<FluvyCardConfig & HeadConfig>;

/**
 * What a card that draws no surface wears (a greeting, a heading): its words stand on the page, so they take the ink
 * the page's background asks for (1.19, #155: the light ink on a deep colour, `--fluvy-page-ink`), else the look's.
 */
export const onPageStyles = css`
  :host {
    --fv-page-text: var(--fluvy-text);
    --fv-page-text-secondary: var(--fluvy-text-secondary);
  }
  :host > * {
    --fluvy-text: var(--fluvy-page-ink, var(--fv-page-text));
    --fluvy-text-secondary: var(--fluvy-page-ink-2, var(--fv-page-text-secondary));
    color: var(--fluvy-text);
  }
`;

/** What a card answers (#179): a tap, a still press, two taps. */
export const ACTIONS_BASE: readonly BaseKey[] = ['tap_action', 'hold_action', 'double_tap_action'];

/** What a card's circle answers besides, where it has one (#179). */
export const ICON_ACTIONS_BASE: readonly BaseKey[] = [
  'icon_tap_action',
  'icon_hold_action',
  'icon_double_tap_action',
];

/** What a card of one entity honours of the base: the entity, its name and icon, its actions, its tone and colour. */
export const ENTITY_BASE: readonly BaseKey[] = [
  'entity',
  'name',
  'icon',
  ...ACTIONS_BASE,
  'tone',
  'color',
  'card_color',
  'card_opacity',
  'card_border',
  'unavailable',
];

/** The same for a card of one entity with a head: whether its circle shows too, and what it answers. */
export const HEAD_BASE: readonly BaseKey[] = [...ENTITY_BASE, 'show_icon', ...ICON_ACTIONS_BASE];

/** What a card with a slider honours of the base besides (1.18, #144): the style its sliders are drawn in, and the words under a bar or a liquid. */
export const SLIDER_BASE: readonly BaseKey[] = ['slider_style', 'slider_words'];

/** What a surface answers: its tap (waiting for a second where a double tap is set) and its hold, each where it runs. */
export interface Press {
  readonly onTap?: (() => void) | undefined;
  readonly onHold?: (() => void) | undefined;
}

/** What a head's circle answers of its own (#179), each where it can run, and what a reader hears for it. */
export interface IconActions {
  readonly onIconTap?: (() => void) | undefined;
  readonly onIconHold?: (() => void) | undefined;
  readonly iconLabel: (name: string) => string;
}

/** A head's actions (`head()`'s): the card's tap and hold, its circle's, each where it can run, and `label`. */
export interface HeadActions extends Press, Partial<IconActions> {
  readonly label?: string | undefined;
}

/** What a tap and a hold run where nothing else is said: the details. */
export const MORE_INFO: ActionConfig = { action: 'more-info' };

/**
 * What a control drawn by a module of its own needs from the card that draws it: the state to draw (the expected one
 * while a change is in flight), and the card's optimistic state and calls, protected on the card itself.
 */
export interface ControlHost {
  state(view: EntityView): string;
  expect(entityId: string, state: string): void;
  call(domain: string, service: string, data: Record<string, unknown>, entityId: string): void;
}

/** What a card's editor shows: the contract's parts (see `Card`), all but the older names, which the card reads itself. */
export interface CardEditor {
  readonly base: readonly BaseKey[];
  readonly keys: readonly string[];
  readonly lists?: readonly RowsListSpec[];
  readonly defaults?: EditorDefaults | undefined;
  readonly choices?: EditorChoices | undefined;
  /** The fields of the card's visual editor; every card has one. */
  getConfigForm(): LovelaceConfigForm;
}

/**
 * What every card in this package shares on top of the core base class: the fluvy stylesheets, the pill-fitting pass
 * (badges and chips sized from their laid-out text, on the 4 px grid), and the editors' contract.
 *
 * The contract: a card declares what its editor shows — `base` (the base fields it honours), `keys` (its own, checked
 * against its config's interface by `configKeys`), `lists` (the lists edited item by item), `defaults` (what it does
 * for a key left out), `choices` (a select's options as its entity has them) and `aliases` (the older names it still
 * reads) — and the base builds the editor from its `getConfigForm()`. `editors.test.ts` holds every card to it: what
 * the form and the lists show is exactly `base ∪ keys`, and no older name is ever shown. A card's aliases are read on
 * `setConfig` — its own first, then the names every card shares (`COMMON_ALIASES`) — so the card itself only ever
 * sees the newer names. A card every page carries keeps the rest in a module of its own (`<name>-editor.ts`, which
 * its `editor()` fetches with the visual editor), so a dashboard never loads its editor; a card of a family fetched
 * on demand declares it on its class.
 */
export abstract class Card<C extends FluvyCardConfig = FluvyCardConfig> extends FluvyCard<C> {
  static override styles: CSSResultGroup = [...baseStyles];

  static base: readonly BaseKey[] = ENTITY_BASE;
  static keys: readonly string[] = [];
  static lists: readonly RowsListSpec[] = [];
  static defaults: EditorDefaults | undefined = undefined;
  static choices: EditorChoices | undefined = undefined;
  static aliases: AliasSpec | undefined = undefined;

  /** The fields of the card's visual editor; every card has one. */
  static getConfigForm(): LovelaceConfigForm {
    return { schema: [] };
  }

  /** The card's editor: its class, or the module of a card every page carries (fetched the first time it is edited). */
  static editor(): Promise<CardEditor> {
    return Promise.resolve(this);
  }

  /**
   * The visual editor: the card's form, its lists item by item, its defaults shown, its older names read. The
   * editor is fetched the first time a card is edited (Home Assistant awaits this, and says what failed in the
   * editor's place): a dashboard never loads it. A page left open through an update cannot fetch it any more, and
   * asks the server which build it serves.
   */
  static async getConfigElement(): Promise<HTMLElement> {
    // a chart card's Chart section is the chart engine's: it lands with the bundle, so this waits on nothing in practice
    const [{ listsEditor }, editor] = await Promise.all([
      import('./rows-editor.js'),
      this.editor(),
      loadChartEngine(),
    ]).catch((error: unknown) => {
      failedToLoad(error);
      throw error;
    });
    return listsEditor(
      editor.getConfigForm(),
      editor.lists ?? [],
      editor.defaults,
      [...(this.aliases ? [this.aliases] : []), COMMON_ALIASES],
      editor.choices,
    );
  }

  override setConfig(config: LovelaceCardConfig): void {
    const { aliases } = this.constructor as typeof Card;
    super.setConfig(
      aliases
        ? normaliseConfig(config, aliases, COMMON_ALIASES)
        : normaliseConfig(config, COMMON_ALIASES),
    );
  }

  /** The card as a control of a module of its own sees it (a select's dropdown, a helper's control). */
  protected readonly controlHost: ControlHost = {
    state: (view) => this.stateOf(view),
    expect: (id, state) => this.expect(id, state),
    call: (domain, service, data, id) => this.call(domain, service, data, id),
  };

  constructor() {
    super();
    // A pill fitted before the web font lands is fitted again once it has: a frame after the font set says so
    // (the face is usable for layout only then), and once more at 1.2 s as a safety net. Fitting in the
    // `loadingdone` handler itself measured the fallback face still, which left a tab row 8 px too wide
    // until the safety net ran.
    new FontsSettled(this, () => {
      if (this.isConnected) fitPills(this.renderRoot, true);
    });
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    fitPills(this.renderRoot);
  }

  /** The templates among the card's own texts (`ownText`), rendered by Home Assistant: made by the first one asked. */
  private ownTexts: TemplateTexts | undefined;
  /** The entities the card's own texts named in its last render: a change of one draws it again, as a watched one's. */
  private readonly ownNamed = new Set<string>();

  protected override shouldUpdate(changed: PropertyValues): boolean {
    if (super.shouldUpdate(changed)) return true;
    const before = (changed.get('hass') as HomeAssistant | undefined)?.states;
    return [...this.ownNamed].some((id) => before?.[id] !== this.hass?.states[id]);
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    this.ownNamed.clear(); // the render names them again
  }

  /**
   * A text of the card's own that may be live (Discussion #156): words, an entity's state or a template, as `ownLine`
   * reads them, a template with the card's entity as `entity` — held as a blank line until Home Assistant answers, or
   * nothing where `held` is false (a badge); an entity it names is watched while it does. Undefined where the config
   * says none.
   */
  protected ownText(own: unknown, held = true): OwnLine | undefined {
    if (isTemplate(own)) this.ownTexts ??= new TemplateTexts(this);
    if (isEntityId(own)) this.ownNamed.add(own);
    return ownLine(this.hass, own, this.ownTexts, this.config?.entity, held);
  }

  /**
   * The head's line as `HeadFit.fit` takes it: the card's own `subtitle` (`ownText`), else `line` and its `shorter`
   * forms.
   */
  protected subtitle(
    line: string,
    shorter: readonly string[] = [],
  ): { readonly sub: string; readonly shorter: readonly string[] } {
    const own = this.ownText((this.config as { subtitle?: unknown } | undefined)?.subtitle);
    return own ? { sub: own.text, shorter: own.shorter } : { sub: line, shorter };
  }

  /** Whether the head's circle shows (`show_icon`); a value it does not know is `auto`, as none is. */
  get showIcon(): ShowIcon {
    return (this.config as HeadConfig | undefined)?.show_icon ?? 'auto';
  }

  /** An action as a surface runs it for `entityId`, where it can (`actionRuns`): none where it is unset. */
  protected runner(
    action: ActionConfig | null | undefined,
    entityId: string | undefined,
  ): (() => void) | undefined {
    return action && actionRuns(action, entityId) ? () => this.tap(entityId, action) : undefined;
  }

  /**
   * What a surface answers from `own`'s actions (the card's config, an item's), run for `entityId`: its tap and its
   * hold — where it names none, `tap` and `hold`: its details by default, `null` nothing, a tap what the card does of
   * its own (a scene runs) — and its double tap (none), the tap waiting for a second where that is set (`tapper`, by
   * the part and the entity it runs for, else by the double itself); each where it can run, so a surface is never a
   * button that does nothing. `part` reads a part's own instead (`icon_`: its circle's).
   */
  protected pressOf(
    own: object | undefined,
    entityId: string | undefined,
    tap: ActionConfig | (() => void) | null = MORE_INFO,
    hold: ActionConfig | null = MORE_INFO,
    part = '',
  ): Press {
    const action = (kind: string): ActionConfig | undefined =>
      (own as Readonly<Record<string, ActionConfig | undefined>> | undefined)?.[
        `${part}${kind}_action`
      ];
    const double = action('double_tap');
    const first = action('tap') ?? tap;
    return {
      onTap: this.tapper(
        entityId ? part + entityId : double,
        typeof first === 'function' ? first : this.runner(first, entityId),
        this.runner(double, entityId),
      ),
      onHold: this.runner(action('hold') ?? hold, entityId),
    };
  }

  /**
   * The head's tap, hold and double tap (the head is the card's button) from the card's actions, and its circle's
   * (`icon_*_action`, #179), run for `entityId` — the card's entity by default (`pressOf`). One that cannot run is left
   * out (`none`; more-info or a toggle with no entity to act on, as a card of many has none), so a head is never a
   * button that does nothing. `label`: what a reader hears for the head's button where its title says less.
   */
  protected headActions(
    entityId: string | undefined = this.config?.entity,
    label?: string,
  ): HeadActions {
    return { ...this.pressOf(this.config, entityId), ...this.iconActions(entityId), label };
  }

  /** What the head's circle answers of its own (`icon_*_action`, #179), run for `entityId`: nothing until set. */
  protected iconActions(entityId: string | undefined): IconActions {
    const { onTap, onHold } = this.pressOf(this.config, entityId, null, null, 'icon_');
    return {
      onIconTap: onTap,
      onIconHold: onHold,
      iconLabel: (name) => this.t('common.icon_of', { name }),
    };
  }

  /**
   * A readout alone where its control would be (none asked for, or a column too narrow for even its halves) is the
   * card's tap and hold: a button laid over its row (`pressCover`), named by what it says. None where neither runs.
   */
  protected readoutTap(
    entityId: string | undefined,
    label: string,
  ): TemplateResult | typeof nothing {
    const { onTap, onHold } = this.headActions(entityId);
    return onTap || onHold ? pressCover(label.trim(), onTap, onHold) : nothing;
  }
}
