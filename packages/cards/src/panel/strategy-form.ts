// the panel's words first: the form says the Dashboards tab's own
import './english.js';
import {
  fireEvent,
  type HaFormSchemaItem,
  type HomeAssistant,
  localize,
  strings,
} from '@fluvy/core';
import { glyph } from '@fluvy/ui';
import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { pretty } from '../shared/mode-words.js';
import {
  HOME_TEMPLATE,
  optionalViews,
  templateOf,
  type Template,
  type TemplateOption,
} from '../strategy/templates.js';

const say = strings('panel');

type Config = Readonly<Record<string, unknown>>;
type Choice = Extract<TemplateOption, { kind: 'choice' }>;
type Views = Extract<TemplateOption, { kind: 'views' }>;

/** How many options the form offers: the dashboard's most used; the rest are the panel's. */
const MOST = 4;
/** The form's field for the views shown: no key of a dashboard's, which names the ones it hides. */
const VIEWS = 'views';

/**
 * The options the form offers for a dashboard as it stands: the views it shows, where its template has views to
 * leave out, then the first choices its template has that can act (a photo's own while the rooms may be photos) and
 * are not the panel's alone.
 */
function offered(template: Template, config: Config): (Views | Choice)[] {
  const views = optionalViews(template).length
    ? template.options.filter((option): option is Views => option.kind === 'views')
    : [];
  const choices = template.options.filter(
    (option): option is Choice =>
      option.kind === 'choice' && !option.panelOnly && option.when?.(config) !== false,
  );
  return [...views, ...choices].slice(0, MOST);
}

/**
 * What a choice's key holds where it is none of the choice's values (#202: a value of another version, a figure of the
 * person's own), as its field and the Dashboards tab's chips say it: a figure in the choice's words where its values
 * are figures ("15 s", written as `15` or `'15'`), a word tidied, anything else as it is written. None where the key
 * holds nothing or one of the choice's values (`4` or `'4'` for 4).
 */
export function ownValue(
  option: Choice,
  raw: unknown,
  say: (label: Choice['label'], count?: number) => string,
): { readonly value: string; readonly label: string } | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const value = typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
  if (option.values.some((known) => String(known.value) === value)) return undefined;
  const [first] = option.values;
  const figure = Number(value);
  return {
    value,
    label:
      typeof first?.value === 'number' && Number.isFinite(figure)
        ? say(first.label, figure)
        : typeof raw === 'string'
          ? pretty(raw)
          : value,
  };
}

/**
 * What Home Assistant's pencil opens on an automatic dashboard (#188). Its "Edit dashboard" dialog asks a strategy
 * for an editor (`getConfigElement`, Home Assistant's own hook) and shows the raw YAML of one that has none, which is
 * all a person met there. This is that editor: a first row that leads to Customise in Fluvy's panel — a link Home
 * Assistant follows itself, closing its dialog — then the dashboard's most used options in Home Assistant's own form,
 * each written as the panel writes it (a choice at its default is no key; `hide` names the views left out). Everything
 * else the configuration holds stays as it is, and so does a field left as it was: a value the form does not offer is
 * shown as it is written and kept (#202).
 */
export class FluvyStrategyForm extends LitElement {
  static override properties = {
    hass: { attribute: false },
    config: { state: true },
  };

  declare hass: HomeAssistant | undefined;
  declare config: Config | undefined;

  static override styles = css`
    :host {
      display: block;
    }
    /* the way into Customise: a row in the dialog's own inks, on the theme's card radius */
    a {
      display: flex;
      align-items: center;
      gap: 16px;
      box-sizing: border-box;
      min-height: 64px;
      margin-bottom: 24px;
      padding: 8px 16px;
      border: 1px solid var(--divider-color, var(--fluvy-border));
      border-radius: var(--ha-card-border-radius, var(--fluvy-radius-card, 12px));
      color: var(--primary-text-color, var(--fluvy-text));
      text-decoration: none;
    }
    a:hover {
      border-color: var(--primary-color, var(--fluvy-accent));
    }
    a:focus-visible {
      outline: 2px solid var(--primary-color, var(--fluvy-accent));
      outline-offset: 2px;
    }
    svg {
      flex: 0 0 auto;
      width: 24px;
      height: 24px;
      color: var(--secondary-text-color, var(--fluvy-text-secondary));
    }
    .words {
      display: grid;
      flex: 1 1 auto;
      min-width: 0;
    }
    .title {
      font-size: 16px;
      font-weight: 500;
      line-height: 24px;
    }
    .sub {
      color: var(--secondary-text-color, var(--fluvy-text-secondary));
      font-size: 14px;
      line-height: 20px;
    }
  `;

  /** The configuration Home Assistant's dialog holds: the strategy's, whatever it says. */
  setConfig(config: Config): void {
    this.config = config;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Home Assistant's form is its editors': pulled in as a card's editor pulls it, and drawn once it is defined
    void import('../shared/rows-editor.js')
      .then((editor) => editor.ensureEditorElements())
      .then(() => this.requestUpdate());
  }

  private template(): Template {
    return templateOf(this.config?.['type']) ?? HOME_TEMPLATE;
  }

  private schema(config: Config): HaFormSchemaItem[] {
    const template = this.template();
    return offered(template, config).map((option) =>
      option.kind === 'views'
        ? {
            name: VIEWS,
            selector: {
              select: {
                multiple: true,
                options: optionalViews(template).map((view) => ({
                  value: view.key,
                  label: localize(this.hass, view.title),
                })),
              },
            },
          }
        : {
            name: option.key,
            selector: {
              select: {
                mode: 'dropdown',
                options: this.values(option, config[option.key]),
              },
            },
          },
    );
  }

  /** A choice's values in their words, what the dashboard holds first where it is none of them (#202). */
  private values(option: Choice, raw: unknown): { value: string; label: string }[] {
    const own = ownValue(option, raw, this.words);
    return [
      ...(own ? [own] : []),
      ...option.values.map((known) => ({
        value: String(known.value),
        label: this.words(known.label, typeof known.value === 'number' ? known.value : undefined),
      })),
    ];
  }

  /** A choice's value in the panel's words, given its figure (`{count} s`). */
  private readonly words = (label: Choice['label'], count?: number): string =>
    say(this.hass, label, count === undefined ? undefined : { count });

  /**
   * What the form shows: the views not hidden, and each choice as the dashboard has it (a value it does not offer as
   * it is written, #202), its default where it has none.
   */
  private data(config: Config): Record<string, unknown> {
    const template = this.template();
    const hidden = new Set(Array.isArray(config['hide']) ? config['hide'] : []);
    return Object.fromEntries(
      offered(template, config).map((option) =>
        option.kind === 'views'
          ? [
              VIEWS,
              optionalViews(template)
                .map((view) => view.key)
                .filter((key) => !hidden.has(key)),
            ]
          : [option.key, this.chosen(option, config[option.key])],
      ),
    );
  }

  /** A choice as the dashboard has it: a value it does not offer as it is written (#202), else its own or the default. */
  private chosen(option: Choice, raw: unknown): string {
    return (
      ownValue(option, raw, this.words)?.value ??
      String(
        (option.values.find((known) => String(known.value) === String(raw)) ?? option.values[0])
          ?.value,
      )
    );
  }

  private readonly label = (field: HaFormSchemaItem): string => {
    const option = this.template().options.find(
      (known) => known.key === field.name || (known.kind === 'views' && field.name === VIEWS),
    );
    return option ? say(this.hass, option.label) : '';
  };

  private readonly changed = (event: CustomEvent<{ value: Record<string, unknown> }>): void => {
    event.stopPropagation();
    const config = this.config;
    if (!config) return;
    const { value } = event.detail;
    const template = this.template();
    const was = this.data(config);
    const next: Record<string, unknown> = { ...config };
    for (const option of offered(template, config)) {
      // a field left as the form showed it is left as the dashboard wrote it (a value the form does not offer stays)
      const name = option.kind === 'views' ? VIEWS : option.key;
      if (JSON.stringify(value[name]) === JSON.stringify(was[name])) continue;
      if (option.kind === 'views') {
        const shown: unknown = value[VIEWS];
        const kept = new Set(Array.isArray(shown) ? shown : []);
        const optional = optionalViews(template).map((view) => view.key);
        // what `hide` names besides (a view of another version) stays as it was written
        const hide = [
          ...(Array.isArray(config['hide']) ? config['hide'] : []).filter(
            (key) => !optional.includes(key as string),
          ),
          ...optional.filter((key) => !kept.has(key)),
        ];
        if (hide.length) next['hide'] = hide;
        else delete next['hide'];
      } else {
        const [fallback] = option.values;
        const picked = option.values.find((known) => String(known.value) === value[option.key]);
        // the first value is the default: it is never written
        if (!picked || picked === fallback) delete next[option.key];
        else next[option.key] = picked.value;
      }
    }
    this.config = next;
    fireEvent(this, 'config-changed', { config: next });
  };

  protected override render(): TemplateResult | typeof nothing {
    const { hass, config } = this;
    if (!hass || !config) return nothing;
    // the dashboard the dialog was opened on is the page's: Customise opens on it by its url path
    const path = hass.panelUrl ? `/${encodeURIComponent(hass.panelUrl)}` : '';
    return html`<a href="/fluvy/dashboard${path}">
        ${glyph('sliders')}
        <span class="words"
          ><span class="title">${say(hass, 'dashboard.customise')}</span
          ><span class="sub">${say(hass, 'dashboard.customise_sub')}</span></span
        >
        ${glyph('chevron')}
      </a>
      ${
        customElements.get('ha-form')
          ? html`<ha-form
              .hass=${hass}
              .data=${this.data(config)}
              .schema=${this.schema(config)}
              .computeLabel=${this.label}
              @value-changed=${this.changed}
            ></ha-form>`
          : nothing
      }`;
  }
}

if (!customElements.get('fluvy-strategy-form'))
  customElements.define('fluvy-strategy-form', FluvyStrategyForm);

/** The form Home Assistant's "Edit dashboard" dialog draws for one of Fluvy's automatic dashboards. */
export const strategyForm = (): HTMLElement => document.createElement('fluvy-strategy-form');
