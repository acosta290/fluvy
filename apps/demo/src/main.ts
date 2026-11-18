// every part of English first: the playground's sheets define the families' cards themselves
import '@fluvy/playground/english';
import '@fluvy/cards';
import { type EffectiveSettings, ensureLanguage, type Look, lookKey, paletteOf } from '@fluvy/core';
import { PALETTE_NAMES } from '@fluvy/tokens/runtime';
import { pinClock } from '@fluvy/playground/clock';
import { defineIconStubs } from '@fluvy/playground/ha-icons';
import { createMemoryLook } from '@fluvy/playground/look-memory';
import mark from '../../../custom_components/fluvy/brand/icon.png';
import { installBridges } from './bridges.js';
import { cardOfType, wordsOf } from './catalog.js';
import { GO } from './nav.js';
import './page.js';
import type { YamlAsk } from './page.js';
import { FluvyDemoShell, type PaletteDot } from './shell.js';
import { createStage } from './stage.js';
import {
  chartsParam,
  parseState,
  parseView,
  sameView,
  serialize,
  type DemoCharts,
  type DemoLanguage,
  type DemoState,
  type DemoView,
} from './state.js';
import { t } from './strings.js';
import { FluvyDemoYaml } from './yaml-sheet.js';

/**
 * The public demo: the cards, the playground's sheets and pages on the stand-in Home Assistant, with Fluvy's own
 * settings machinery running the look — the settings live in memory, the live engine paints the page, and the settings
 * panel shown here edits the same settings. The URL says what is shown (the playground's parameters and the demo's
 * own): opening a page pushes it onto the history, so back and forward move between pages; a change of the look
 * updates the address in place.
 */
const base = import.meta.env.BASE_URL;
let state: DemoState = parseState(new URLSearchParams(location.search), window.innerWidth);
pinClock(state.at);
await ensureLanguage(state.language);
document.documentElement.lang = state.language;
// the demo lays each page out as it opens: back and forward open it at its top, as a new page
history.scrollRestoration = 'manual';

const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.href = mark;
document.head.append(favicon);

const look = createMemoryLook(document, state.mode === 'dark');
const { store } = look.handle;
// the house wears the look everywhere (the whole page, as Home Assistant would) and draws its charts as the link
// says, in the visitor's language
void store.saveHouse({
  scope: 'everywhere',
  ...state.look,
  charts: state.charts.settings,
  chartSets: state.charts.sets,
});
void store.savePersonal({ language: state.language });

const dots = (): PaletteDot[] =>
  PALETTE_NAMES.map((name) => {
    const palette = paletteOf(name);
    return { name, title: palette.title, ink: palette[state.mode].accent.ink };
  });

const shell = new FluvyDemoShell();
shell.mark = mark;
shell.palettes = dots();
shell.state = state;
const stageEl = document.getElementById('stage') as HTMLElement;
shell.append(stageEl);
document.getElementById('shell')?.replaceWith(shell);
// the page stands in the chrome's slot: laid out once the chrome is drawn, before its frames are laid in lanes
await shell.updateComplete;

const yaml = new FluvyDemoYaml();
yaml.language = state.language;
document.body.append(yaml);

// Home Assistant's icons for an `mdi:` reference and a state, as the playground draws them
defineIconStubs();
const stage = createStage(stageEl, look, {
  mark,
  swatches: PALETTE_NAMES.map((name) => ({ name, title: paletteOf(name).title })),
});

const addressOf = (next: DemoState): string => {
  const query = serialize(next).toString();
  return query ? `${base}?${query}` : base;
};
const syncUrl = (): void => history.replaceState(null, '', addressOf(state));

/**
 * A change from the chrome, the page or the panel: the settings machinery applies the look, the stage the rest;
 * `again` mounts the page from nothing (the panel asked for another of its tabs from outside it).
 */
function apply(patch: Partial<DemoState>, again = false): void {
  const next: DemoState = { ...state, ...patch };
  const lookChanged = lookKey(next.look) !== lookKey(state.look);
  const chartsChanged = chartsParam(next.charts) !== chartsParam(state.charts);
  const modeChanged = next.mode !== state.mode;
  const languageChanged = next.language !== state.language;
  state = next;
  if (lookChanged) void store.saveHouse({ ...state.look });
  if (chartsChanged)
    void store.saveHouse({ charts: state.charts.settings, chartSets: state.charts.sets });
  if (modeChanged) {
    look.setDark(state.mode === 'dark');
    shell.palettes = dots();
  }
  if (languageChanged) {
    document.documentElement.lang = state.language;
    yaml.language = state.language;
    void store.savePersonal({ language: state.language });
    // the cards' names in the menu are the catalogue's, in the language once it has landed
    void ensureLanguage(state.language).then(() => {
      shell.requestUpdate();
      stage.update(state);
    });
  }
  if (again) void stage.show(state);
  else stage.update(state);
  shell.state = state;
}

/** Whether a page is another tab of the settings panel shown, which the panel itself would not draw. */
const otherTab = (view: DemoView): boolean =>
  view.kind === 'panel' && state.view.kind === 'panel' && !sameView(view, state.view);

/** Opens a page: onto the history, at the top of the window (a card's layout scrolls itself into view). */
function open(view: DemoView): void {
  if (sameView(view, state.view)) return;
  apply({ view }, otherTab(view));
  history.pushState(null, '', addressOf(state));
  if (view.kind !== 'card' || !view.layout) window.scrollTo({ top: 0, behavior: 'instant' });
}

// the chrome and the page's own parts (a device field, the themes) change the look
document.addEventListener('demo-change', (event) => {
  apply((event as CustomEvent<Partial<DemoState>>).detail);
  syncUrl();
});
document.addEventListener(GO, (event) => open((event as CustomEvent<DemoView>).detail));

// back and forward: the page the address names, in the look the visitor wears now
window.addEventListener('popstate', () => {
  const view = parseView(new URLSearchParams(location.search));
  apply({ view }, otherTab(view));
  syncUrl();
  window.scrollTo({ top: 0, behavior: 'instant' });
});

/** What reads a card's YAML (the cards' editors ride with it): fetched for the first "View YAML", or once the page rests. */
const cardYaml = (): Promise<typeof import('./card-yaml.js')> => import('./card-yaml.js');

// "View YAML": the YAML of each card of the plate, as the docs print it, under the card's name (the last one asked)
let asked = 0;
document.addEventListener('demo-yaml', (event) => {
  const { cards, layout, opener } = (event as CustomEvent<YamlAsk>).detail;
  const mine = (asked += 1);
  void cardYaml()
    .then(({ yamlOf }) => yamlOf(cards))
    .then((read) => {
      if (mine !== asked || !read.length) return;
      const named = read.map(({ type, all, minimal }) => {
        const card = cardOfType(type);
        return { name: card ? wordsOf(card).name : type, all, minimal };
      });
      const [first] = named;
      yaml.open(
        {
          // a plate of several kinds of card is headed "Cards", each YAML under its own card's name
          title:
            first && named.every(({ name }) => name === first.name)
              ? first.name
              : t(state.language, 'nav.cards'),
          ...(layout === undefined ? {} : { layout }),
          cards: named,
        },
        opener,
      );
    });
});

// the settings panel changes the same settings: the chrome follows
look.handle.onChange((settings: EffectiveSettings) => {
  const patch: { look?: Look; charts?: DemoCharts; language?: DemoLanguage } = {};
  if (lookKey(settings.look) !== lookKey(state.look)) patch.look = settings.look;
  const charts: DemoCharts = { settings: settings.charts, sets: settings.chartSets };
  if (chartsParam(charts) !== chartsParam(state.charts)) patch.charts = charts;
  if (settings.language !== 'auto' && settings.language !== state.language)
    patch.language = settings.language;
  if (Object.keys(patch).length) {
    apply(patch);
    syncUrl();
  }
});

/** The address of Home Assistant's own a page of the demo stands for. */
const OWN_PATHS: Partial<Record<DemoView['kind'], string>> = {
  history: 'history',
  activity: 'logbook',
};

installBridges({
  moreInfo: (entityId) =>
    shell.say(t(state.language, 'notice.more_info', { entity: stage.nameOf(entityId) })),
  panelTab: (tab) => {
    apply({ view: { kind: 'panel', tab } });
  },
  navigate: (path) => {
    // History and Activity write their own address as they open, as at home: nothing to say
    if (path.split('/')[1] === OWN_PATHS[state.view.kind]) return;
    // a room of the automatic dashboard opens its view here, over the address the card wrote; any other page is Home
    // Assistant's
    const view = stage.viewAt(path);
    if (!view) {
      shell.say(t(state.language, 'notice.navigate', { path }));
      return;
    }
    syncUrl();
    open(view);
  },
  restoreUrl: syncUrl,
});

syncUrl();
if (state.path) shell.say(t(state.language, 'notice.navigate', { path: state.path }));

// the same readiness the playground declares, once the first page has mounted (a page of Home Assistant's and the
// automatic dashboard are fetched first): the tools that screenshot it work here
await stage.show(state);
void document.fonts.ready.then(() =>
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      document.documentElement.dataset['ready'] = '1';
      // the first "View YAML" opens at once: what reads it lands while the visitor looks at the page
      void cardYaml();
    }),
  ),
);
