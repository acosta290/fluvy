import '@fluvy/cards';
import {
  ensureLanguage,
  lookRule,
  resolveLanguage,
  type HomeAssistant,
  type Look,
  type LovelaceCard,
} from '@fluvy/core';
import {
  isPaletteName,
  isPillName,
  isShapeName,
  type CustomBase,
  type FillStyle,
  type PillName,
  type PaletteCharacter,
} from '@fluvy/tokens/runtime';
import { textWidth } from '@fluvy/ui';
import { pinClock } from './clock.js';
import { createHass, type StateSeed } from './hass.js';
import { mountActivity, type ActivityMoment } from './activity.js';
import { mountHistory, type HistoryMoment } from './history.js';
import { mountPanel, PANEL_WS, type PanelState } from './panel.js';
import { NOW, SHEETS } from './scenes.js';
import { mountSwipe, SWIPE_STATES } from './swipe.js';

/**
 * ?sheet=home            which design sheet to mount (default: all)
 * ?mode=dark             Home Assistant's dark mode + the dark token block
 * ?width=392             frame width (the column a dashboard section gives its cards; content = width − 32)
 * ?lang=es               UI language
 * ?theme=off             drop the theme tokens: the cards must fall back to their own
 * ?palette=volt          a preset, applied by the live palette engine (the one the bundle runs)
 * ?shape=round           soft | round | crisp
 * ?accent=%23ff4a1a      a custom palette instead: &character=vivid &base=cool &fill=solid &highlight=%23e2ff3d
 * ?compare=linen,volt    the sheet once per palette, side by side (each column scoped to its palette)
 * ?panel=appearance      fluvy's settings panel (appearance | scope | dashboard | preferences | about)
 * &state=pending,guest     …at a moment of its own (see `PanelState` in panel.ts)
 * ?history=1             Fluvy's History page on a made-up house (&moment=week|month|states|many|empty|loading|sources|dates)
 * ?activity=1            Fluvy's Activity page on a made-up house (&live=0 without live entries,
 *                        &at=2026-09-17T21:47 the clock set to that moment, still running,
 *                        &card=1 its timeline on a card,
 *                        &moment=detail|burst|dates|sources|lights|week|nomatch|fresh|drop|loading|empty)
 * ?swipe=1               a phone with tabs on a stand-in for hui-root, the swipe between views on it
 *                        (&pref=off the gesture turned off by this person, &dir=rtl a right-to-left page)
 */
const params = new URLSearchParams(location.search);
const dark = params.get('mode') === 'dark';
const width = Number(params.get('width') ?? 360);
const only = params.get('sheet');
const language = params.get('lang') ?? 'en';

document.documentElement.dataset['mode'] = dark ? 'dark' : 'light';
document.documentElement.lang = language;
// the language's words before anything is drawn: a screenshot never catches the English fallback
await ensureLanguage(resolveLanguage(language));
if (params.get('theme') === 'off') {
  delete document.documentElement.dataset['palette'];
  document.documentElement.style.setProperty('--fluvy-theme', 'initial');
} // 'initial' beats the stylesheet's :root value; '' would only drop the inline one

/** The look the URL asks for, or null to keep the generated lab tokens (Linen, Soft). */
function requestedLook(): Look | null {
  const palette = params.get('palette');
  const shape = params.get('shape');
  const pills = params.get('pills');
  const accent = params.get('accent');
  if (!palette && !shape && !pills && !accent) return null;
  const custom = accent
    ? {
        character: (params.get('character') ?? 'vivid') as PaletteCharacter,
        base: (params.get('base') ?? 'neutral') as CustomBase,
        accent,
        fill: (params.get('fill') ?? 'tint') as FillStyle,
        ...(params.get('highlight') ? { highlight: params.get('highlight') as string } : {}),
      }
    : null;
  return {
    palette: custom ?? (isPaletteName(palette) ? palette : 'linen'),
    shape: isShapeName(shape) ? shape : 'soft',
    pills: isPillName(pills) ? pills : 'round',
  };
}
const look = requestedLook();
if (look) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(lookRule(look, dark ? 'dark' : 'light', ':root', true));
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  document.documentElement.dataset['look'] = '1';
}

const activity = params.get('activity') === '1';
const history = params.get('history') === '1';
const swipe = params.get('swipe') === '1';
// the person's preference: the Activity page's timeline on a card
if (params.get('card') === '1') document.documentElement.setAttribute('fluvy-activity-card', '');
// the page's clock starts at `at` and runs on (screenshots of "today" that do not change with the day)
const at = params.get('at');
if (at) pinClock(at);
const panelTab = params.get('panel');
const panelStates = (params.get('state') ?? '').split(',').filter(Boolean) as PanelState[];
// the panel stands alone: no sheet frames beside it
const selected =
  panelTab || activity || history || swipe
    ? []
    : Object.entries(SHEETS).filter(([name]) => !only || only === name);
const states = new Map<string, StateSeed>();
for (const [, sheet] of selected) for (const seed of sheet.states) states.set(seed[0], seed);
if (swipe) for (const seed of SWIPE_STATES) states.set(seed[0], seed);

const mock = createHass([...states.values()], {
  dark,
  language,
  now: NOW,
  history: Object.assign({}, ...selected.map(([, s]) => s.history ?? {})) as Record<
    string,
    readonly number[]
  >,
  ws: Object.assign({}, ...selected.map(([, s]) => s.ws ?? {}), panelTab ? PANEL_WS : {}) as Record<
    string,
    (m: Record<string, unknown>) => unknown
  >,
  api: (method, path) => {
    for (const [, s] of selected) {
      const answer = s.api?.(method, path);
      if (answer !== undefined) return answer;
    }
    return [];
  },
});
const cards: LovelaceCard[] = [];
mock.subscribe((hass: HomeAssistant) => {
  for (const card of cards) card.hass = hass;
});

const stage = document.getElementById('stage') as HTMLElement;
if (panelTab) mountPanel(stage, mock.hass(), panelTab, dark, panelStates);
if (history)
  mountHistory(
    stage,
    mock.hass(),
    language,
    params.get('live') !== '0',
    (params.get('moment') ?? undefined) as HistoryMoment | undefined,
  );
if (activity)
  mountActivity(
    stage,
    mock.hass(),
    language,
    params.get('live') !== '0',
    (params.get('moment') ?? undefined) as ActivityMoment | undefined,
  );
if (swipe)
  mountSwipe(stage, mock, {
    language,
    enabled: params.get('pref') !== 'off',
    rtl: params.get('dir') === 'rtl',
  });
const compare = (params.get('compare') ?? '').split(',').filter(isPaletteName);
const shape = params.get('shape');
/** Where the frames go: the stage, or one column per compared palette with its look scoped to it. */
const columns = compare.length
  ? compare.map((palette) => {
      const column = document.createElement('div');
      column.className = 'pg-look';
      column.dataset['look'] = palette;
      const label = document.createElement('p');
      label.className = 'pg-look__name';
      label.textContent = palette;
      column.append(label);
      stage.append(column);
      return column;
    })
  : [stage];
if (compare.length) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(
    compare
      .map((palette) =>
        lookRule(
          {
            palette,
            shape: isShapeName(shape) ? shape : 'soft',
            pills: isPillName(params.get('pills')) ? (params.get('pills') as PillName) : 'round',
          },
          dark ? 'dark' : 'light',
          `[data-look="${palette}"]`,
        ),
      )
      .join(''),
  );
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}
for (const column of columns)
  for (const [name, sheet] of selected) {
    for (const frame of sheet.frames) {
      const el = document.createElement('section');
      el.className = 'pg-frame';
      el.dataset[frame.measure === false ? 'stress' : 'frame'] = `${name}/${frame.title}`;
      el.style.width = `${frame.width ?? width}px`;
      for (const { cols, ...config } of frame.cards) {
        const tag = String(config.type).replace(/^custom:/, '');
        const card = document.createElement(tag) as LovelaceCard;
        if (cols) card.dataset['cols'] = String(cols);
        try {
          card.setConfig(config);
        } catch (error) {
          card.textContent = String(error);
        }
        card.hass = mock.hass();
        cards.push(card);
        el.append(card);
      }
      column.append(el);
    }
  }

// the mock and the shared text measurer, for the interaction tests
Object.assign(window, { fluvyMock: mock, fluvyTextWidth: textWidth });

// Home Assistant's <ha-icon> is not here: a stub draws a neutral disc so an `mdi:` reference has a visible box
if (!customElements.get('ha-icon')) {
  customElements.define(
    'ha-icon',
    class extends HTMLElement {
      connectedCallback(): void {
        if (!this.shadowRoot)
          this.attachShadow({ mode: 'open' }).innerHTML =
            '<style>:host{display:inline-flex;width:20px;height:20px}svg{width:100%;height:100%}</style><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><circle cx="12" cy="12" r="8"/><path d="M8 12h8"/></svg>';
      }
    },
  );
}
void document.fonts.ready.then(() =>
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.documentElement.dataset['ready'] = '1';
    }),
  ),
);
