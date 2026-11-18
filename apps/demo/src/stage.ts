import {
  lookRule,
  type HomeAssistant,
  type LovelaceCard,
  type LovelaceCardConfig,
} from '@fluvy/core';
import { parseStatuses, statusesKey, type StatusColours } from '@fluvy/tokens/runtime';
import type { ActivityMoment } from '@fluvy/playground/activity';
import type { HistoryMoment } from '@fluvy/playground/history';
import {
  createHouse,
  mountFrame,
  type HouseOptions,
  type MockHouse,
  type MountedCard,
} from '@fluvy/playground/house';
import type { MemoryLook } from '@fluvy/playground/look-memory';
import { SHEETS, type FrameSpec, type SheetSpec } from '@fluvy/playground/scenes';
import { cardOf, cardOfType, docsOf, layoutKeyOf, wordsOf, type DemoCard } from './catalog.js';
import { familyOf, groupOf, sheetsOf } from './families.js';
import { INSTALL, REPO } from './nav.js';
import type { FluvyDemoExample, FluvyDemoFrame, HeadSpec, ThemeSwatch } from './page.js';
import {
  AUTO_HOME,
  columns,
  frameWidth,
  samePage,
  type DemoState,
  type DemoView,
} from './state.js';
import { t } from './strings.js';

/** The cards' Home Assistant as this page shows it: its mode and language on top of the stand-in's. */
export function withEnvironment(
  hass: HomeAssistant,
  state: Pick<DemoState, 'mode' | 'language'>,
): HomeAssistant {
  return {
    ...hass,
    language: state.language,
    locale: { ...hass.locale, language: state.language },
    themes: { ...hass.themes, darkMode: state.mode === 'dark' },
  };
}

export interface Stage {
  /** Mounts what the state asks for, from nothing. */
  show(state: DemoState): Promise<void>;
  /**
   * The state changed: another page or device is mounted from nothing; a change of mode or language re-skins, re-words
   * and re-measures the cards in place (a page is mounted again); another layout of the card shown is marked; the panel
   * moving between its own tabs is left as it is.
   */
  update(state: DemoState): void;
  /** An entity's name on the stand-in, for a notice. */
  nameOf(entityId: string): string;
  /** The automatic dashboard's view a path of Home Assistant's opens (a room card's), where the dashboard is shown. */
  viewAt(path: string): DemoView | undefined;
}

/** What the stage knows besides the state: the brand mark, the palettes the themes page offers. */
export interface StageOptions {
  readonly mark: string;
  readonly swatches: readonly ThemeSwatch[];
}

/** A house and the cards mounted on it. */
interface Shown {
  readonly house: MockHouse;
  readonly cards: MountedCard[];
}

/** A frame to mount: the sheet it is named by, its spec, and the house it stands in. */
interface Placed {
  readonly sheet: string;
  readonly frame: FrameSpec;
  readonly shown: Shown;
}

/** A card of the catalogue on a frame: its short name, its configuration as a person writes it, and it mounted. */
interface Held {
  readonly short: string;
  readonly config: LovelaceCardConfig;
  readonly card: LovelaceCard;
}

/** The space between two lanes, and a frame's sides (the section's 16 each way). */
const GAP = 24;
const SIDES = 32;

/**
 * The frames the overview and the themes show: the strongest of the design sheets, live, each in its own sheet's house.
 * Named as the playground names them (`<sheet>/<title>`).
 */
const PICKS: readonly (readonly [sheet: string, title: string])[] = [
  ['home', 'Tiles'],
  ['climate', 'Heat'],
  ['media', 'Playing'],
  ['flow', 'The whole house'],
  ['lights', 'Tiles'],
  ['appliances', 'LG · washer spinning'],
  ['chart', 'Chart · Nordpool'],
  ['animated', 'Moving · liquid'],
  ['vehicle', 'Teslemetry · charging at home'],
];

/**
 * The playground's own pages a Web page card shows (`apps/playground/public/web`): as a person's site names them, and
 * where the demo serves them.
 */
const WEB_PAGES = /^\/web\//;
const SERVED = `${import.meta.env.BASE_URL}web/`;

/**
 * A frame whose cards show the playground's own pages at the site's root (`/web/radar.html`, the gallery's: what the
 * docs print), pointed at them where the demo serves them (`/fluvy/web/…`). Its YAML stays the docs'.
 */
const servedHere = (frame: FrameSpec): FrameSpec =>
  frame.cards.some((card) => typeof card['url'] === 'string' && WEB_PAGES.test(card['url']))
    ? {
        ...frame,
        cards: frame.cards.map((card) =>
          typeof card['url'] === 'string'
            ? { ...card, url: card['url'].replace(WEB_PAGES, SERVED) }
            : card,
        ),
      }
    : frame;

/**
 * A frame's card as a person writes it: without the columns its frame gives it, and a page of the playground's at the
 * site's root, as the docs print it, wherever the demo serves it.
 */
const asWritten = (card: FrameSpec['cards'][number]): LovelaceCardConfig =>
  Object.fromEntries(
    Object.entries(card)
      .filter(([key]) => key !== 'cols')
      .map(([key, value]) => [
        key,
        key === 'url' && typeof value === 'string' && value.startsWith(SERVED)
          ? `/web/${value.slice(SERVED.length)}`
          : value,
      ]),
  ) as LovelaceCardConfig;

/**
 * The cards of the catalogue a frame holds (a stand-in of the playground's own is none): what its plate names, and
 * what its "View YAML" shows.
 */
const cardsOf = (frame: FrameSpec, mounted: readonly MountedCard[]): Held[] =>
  frame.cards.flatMap((config, index) => {
    const known = cardOfType(config.type);
    const card = mounted[index]?.card;
    return card && known ? [{ short: known.short, config: asWritten(config), card }] : [];
  });

/** A frame's plate off a card's page: its head names the cards the frame holds, each once, in the frame's order. */
function framePlate(held: readonly Held[]): FluvyDemoFrame {
  const plate = document.createElement('fluvy-demo-frame');
  plate.cards = [...new Set(held.map(({ short }) => short))];
  return plate;
}

/**
 * The demo's stage: a page's head, then its frames in lanes (one per column the device has and the screen holds, each
 * frame to the shortest), or one of the playground's pages. Each frame is mounted as the playground mounts it
 * (`mountFrame`): its own view of the house, its columns, its width up to the lane's, its status colours. A family's
 * sheets each stand in a house of their own, as the playground's `?sheet=<name>` draws it; a card's page stands in the
 * gallery's house (every sheet's entities), and mounts only its own examples.
 */
export function createStage(root: HTMLElement, look: MemoryLook, options: StageOptions): Stage {
  let houses: Shown[] = [];
  let page: MockHouse | undefined;
  let shown: DemoState | undefined;
  let unsubscribe: Array<() => void> = [];
  /** What the page shown redraws when the look or the words change in place (its head, its parts). */
  let refresh: Array<(state: DemoState) => void> = [];
  /** The lanes the frames were laid in, and how many the stage held then. */
  let lanes: HTMLElement | undefined;
  let laid = 0;
  /** The automatic dashboard's views, once its strategy has built them. */
  let autoViews: readonly {
    readonly path: string;
    readonly title: string;
    readonly tab: boolean;
  }[] = [];
  /** A page mounted once something arrives (the automatic dashboard, a page fetched when opened): the latest lands. */
  let ticket = 0;
  /** The frames in status colours of their own: each one's colours, worn in the page's look. */
  const statusSheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, statusSheet];
  const worn = new Map<string, StatusColours>();

  const clear = (): void => {
    for (const stop of unsubscribe) stop();
    unsubscribe = [];
    refresh = [];
    root.replaceChildren();
    root.classList.remove('pg-panel');
    houses = [];
    page = undefined;
    lanes = undefined;
    laid = 0;
    worn.clear();
  };

  const dress = (cards: readonly MountedCard[], hass: HomeAssistant): void => {
    if (!shown) return;
    const environment = withEnvironment(hass, shown);
    for (const { card, view } of cards) card.hass = view(environment);
  };

  /** The frames' own status colours (over the house's) in the look and the mode the page wears now. */
  const restyle = (state: DemoState): void => {
    const own = look.handle.settings().statuses;
    statusSheet.replaceSync(
      [...worn]
        .map(([key, colours]) =>
          lookRule(
            state.look,
            state.mode,
            `[data-statuses="${key}"]`,
            false,
            parseStatuses({ ...own, ...colours }),
          ),
        )
        .join(''),
    );
  };

  /** A house of these sheets, its cards following it. */
  const houseOf = (sheets: readonly SheetSpec[], state: DemoState): Shown => {
    const house: Shown = {
      house: createHouse(sheets, { dark: state.mode === 'dark', language: state.language }),
      cards: [],
    };
    houses.push(house);
    unsubscribe.push(house.house.subscribe((hass) => dress(house.cards, hass)));
    return house;
  };

  /** A part of the page drawn in the state, drawn again when it changes in place. */
  const part = <T extends HTMLElement & { state: DemoState | undefined }>(
    tag: string,
    state: DemoState,
    respec?: (el: T, state: DemoState) => void,
  ): T => {
    const el = document.createElement(tag) as T;
    const draw = (next: DemoState): void => {
      el.state = next;
      respec?.(el, next);
    };
    draw(state);
    refresh.push(draw);
    root.append(el);
    return el;
  };

  const head = (state: DemoState, spec: (state: DemoState) => HeadSpec): void => {
    part<HTMLElement & { state: DemoState | undefined; spec: HeadSpec | undefined }>(
      'fluvy-demo-head',
      state,
      (el, next) => (el.spec = spec(next)),
    );
  };

  /** A section's title over the frames under it. */
  const section = (state: DemoState, words: (state: DemoState) => string): void => {
    const title = document.createElement('h2');
    title.className = 'demo-section';
    const draw = (next: DemoState): void => {
      title.textContent = words(next);
    };
    draw(state);
    refresh.push(draw);
    root.append(title);
  };

  /**
   * How many lanes the stage holds at the device's column: as many as the device has, as the page's width (the stage's
   * less its sides) allows.
   */
  const laneCount = (state: DemoState): number => {
    const style = getComputedStyle(root);
    const width = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const held = Math.floor((width + GAP) / (frameWidth(state) + SIDES + GAP));
    return Number.isFinite(held) ? Math.max(1, Math.min(columns(state), held)) : 1;
  };

  /**
   * The frames in lanes, each to the shortest lane, each on a plate that names the cards it holds and shows their
   * YAML (a frame that holds none of the catalogue's stands bare). With `example`, the plates are a card's page's
   * (each example's own) and fill columns in their order, the browser keeping the columns level as the cards grow.
   */
  const mountLanes = (
    state: DemoState,
    placed: readonly Placed[],
    example?: (index: number) => FluvyDemoExample,
  ): void => {
    const box = document.createElement('div');
    box.className = example ? 'demo-plates' : 'demo-lanes';
    box.style.setProperty('--demo-frame', `${frameWidth(state)}px`);
    root.append(box);
    lanes = box;
    laid = laneCount(state);
    box.style.setProperty('--demo-columns', String(laid));
    const columnsOf = example
      ? [box]
      : Array.from({ length: laid }, () => {
          const lane = document.createElement('div');
          lane.className = 'demo-lane';
          box.append(lane);
          return lane;
        });
    const shortest = (): HTMLElement =>
      columnsOf.reduce((low, lane) => (lane.offsetHeight < low.offsetHeight ? lane : low));
    const plates: (FluvyDemoExample | FluvyDemoFrame)[] = [];
    placed.forEach(({ sheet, frame, shown: house }, index) => {
      const hass = withEnvironment(house.house.hass(), state);
      const { el, cards } = mountFrame(sheet, servedHere(frame), hass, {
        fit: true,
        wearStatuses: (frameEl, own) => {
          const key = statusesKey(parseStatuses(own));
          frameEl.dataset['statuses'] = key;
          worn.set(key, own);
        },
      });
      // a frame of a width of its own stands in the middle of its lane
      if (frame.width !== undefined) el.classList.add('demo-frame--own');
      house.cards.push(...cards);
      const held = cardsOf(frame, cards);
      const plate = example?.(index) ?? (held.length ? framePlate(held) : undefined);
      if (plate) {
        plate.state = state;
        // each card as it stands when it is asked: the house it reads is the one it is drawn on then
        plate.source = () => held.map(({ config, card }) => ({ config, hass: card.hass }));
        plate.append(el);
        plates.push(plate);
      }
      shortest().append(plate ?? el);
    });
    refresh.push((next) => {
      for (const plate of plates) {
        plate.state = next;
        // a card's name is the catalogue's, in a language that lands after the state names it: drawn again then
        plate.requestUpdate();
      }
    });
    restyle(state);
  };

  /** The frames of sheets by name, each sheet in a house of its own; a stress frame (deliberate overflow) left out. */
  const framesOf = (state: DemoState, names: readonly string[]): Placed[] =>
    names.flatMap((name) => {
      const sheet = SHEETS[name];
      if (!sheet) return [];
      const house = houseOf([sheet], state);
      return sheet.frames
        .filter((frame) => frame.measure !== false)
        .map((frame) => ({ sheet: name, frame, shown: house }));
    });

  /** The overview's and the themes' frames: each from its own sheet, in that sheet's house. */
  const picks = (state: DemoState): Placed[] => {
    const byName = new Map<string, Shown>();
    return PICKS.flatMap(([name, title]) => {
      const sheet = SHEETS[name];
      const frame = sheet?.frames.find((candidate) => candidate.title === title);
      if (!sheet || !frame) return [];
      const house = byName.get(name) ?? houseOf([sheet], state);
      byName.set(name, house);
      return [{ sheet: name, frame, shown: house }];
    });
  };

  /* ---------- the pages ---------- */

  const showOverview = (state: DemoState): void => {
    head(state, (next) => ({
      hero: true,
      mark: options.mark,
      title: t(next.language, 'overview.title'),
      lead: t(next.language, 'overview.lead'),
      actions: [
        {
          label: t(next.language, 'overview.install'),
          glyph: 'download',
          accent: true,
          href: INSTALL,
        },
        { label: t(next.language, 'overview.browse'), glyph: 'grid', view: { kind: 'cards' } },
        { label: t(next.language, 'links.github'), glyph: 'code', href: REPO },
      ],
      note: t(next.language, 'banner.text'),
      device: true,
    }));
    section(state, (next) => t(next.language, 'overview.picks'));
    mountLanes(state, picks(state));
  };

  const showIndex = (state: DemoState): void => {
    head(state, (next) => ({
      title: t(next.language, 'nav.cards'),
      lead: t(next.language, 'cards.lead'),
    }));
    part('fluvy-demo-index', state);
  };

  /** A card's page: its name and line, its docs, a chip a layout; then its base and each layout on a plate of its own. */
  const showCard = (state: DemoState, card: DemoCard): void => {
    const group = groupOf(card.short);
    const examples: FluvyDemoExample[] = [];
    head(state, (next) => {
      const words = wordsOf(card);
      const view = next.view.kind === 'card' ? next.view : undefined;
      return {
        crumbs: [
          { label: t(next.language, 'nav.cards'), view: { kind: 'cards' } },
          ...(group ? [{ label: t(next.language, group.label) }] : []),
        ],
        title: words.name,
        lead: words.description,
        actions: [{ label: t(next.language, 'card.docs'), glyph: 'external', href: docsOf(card) }],
        ...(card.examples.length > 1
          ? {
              chips: card.examples.map((example) => ({
                label: example.layout ?? t(next.language, 'card.default'),
                view: {
                  kind: 'card',
                  card: card.short,
                  ...(example.layout ? { layout: example.layout } : {}),
                } as const,
                active: (view?.layout ?? '') === (example.layout ?? ''),
              })),
            }
          : {}),
        device: true,
      };
    });
    const gallery = SHEETS['gallery'];
    if (!gallery) return;
    const house = houseOf([gallery], state);
    const placed = card.examples.flatMap((example) => {
      const frame = gallery.frames.find((candidate) => candidate.title === example.name);
      return frame ? [{ sheet: 'gallery', frame, shown: house }] : [];
    });
    const key = layoutKeyOf(card);
    mountLanes(state, placed, (index) => {
      const example = card.examples[index];
      const plate = document.createElement('fluvy-demo-example');
      plate.card = card.short;
      plate.layout = example?.layout;
      plate.key = key;
      plate.docs = docsOf(card);
      plate.id = `layout-${example?.layout ?? 'default'}`;
      examples.push(plate);
      return plate;
    });
    const mark = (next: DemoState, glide: boolean): void => {
      const layout = next.view.kind === 'card' ? next.view.layout : undefined;
      let target: FluvyDemoExample | undefined;
      for (const plate of examples) {
        plate.marked = layout !== undefined && plate.layout === layout;
        if (plate.marked) target = plate;
      }
      // the layout the link points at, scrolled to once the cards above it have their height
      if (target) {
        const to = target;
        void document.fonts.ready.then(() =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              to.scrollIntoView({
                block: 'start',
                behavior:
                  glide && !matchMedia('(prefers-reduced-motion: reduce)').matches
                    ? 'smooth'
                    : 'instant',
              }),
            ),
          ),
        );
      }
    };
    mark(state, false);
    refresh.push((next) => mark(next, true));
  };

  const showSheets = (state: DemoState, name: string): void => {
    const family = familyOf(name);
    head(state, (next) => ({
      crumbs: [{ label: t(next.language, 'nav.showcase') }],
      title: family ? t(next.language, family.label) : name,
      lead: t(next.language, 'showcase.lead'),
      device: true,
    }));
    mountLanes(state, framesOf(state, sheetsOf(name)));
  };

  /** A view of the automatic dashboard: built by its own strategy from the house of every sheet, a frame a section. */
  const showAuto = async (state: DemoState, path: string): Promise<void> => {
    const mine = ticket;
    const house = houseOf(Object.values(SHEETS), state);
    const { automaticFrames, automaticViews } = await import('@fluvy/playground/automatic');
    const hass = house.house.hass();
    const home = { type: 'custom:fluvy-home' } as const;
    const [views, frames] = await Promise.all([
      automaticViews(hass, home),
      automaticFrames(hass, path, home),
    ]);
    if (mine !== ticket) return;
    autoViews = views;
    const current = views.find((view) => view.path === path) ?? views[0];
    head(state, (next) => ({
      ...(current && !current.tab
        ? {
            crumbs: [
              { label: t(next.language, 'page.auto'), view: { kind: 'auto', view: AUTO_HOME } },
            ],
          }
        : {}),
      title: current && !current.tab ? current.title : t(next.language, 'page.auto'),
      lead: t(next.language, 'auto.lead'),
      chips: views
        .filter((view) => view.tab)
        .map((view) => ({
          label: view.title,
          view: { kind: 'auto', view: view.path } as const,
          active: view.path === current?.path,
        })),
      device: true,
    }));
    mountLanes(
      state,
      frames.map((frame) => ({ sheet: 'auto', frame, shown: house })),
    );
  };

  const showThemes = (state: DemoState): void => {
    head(state, (next) => ({
      title: t(next.language, 'nav.themes'),
      lead: t(next.language, 'themes.lead'),
    }));
    part<HTMLElement & { state: DemoState | undefined; swatches: readonly ThemeSwatch[] }>(
      'fluvy-demo-themes',
      state,
      (el) => (el.swatches = options.swatches),
    );
    section(state, (next) => t(next.language, 'overview.picks'));
    mountLanes(state, picks(state));
  };

  /** The house a page of Home Assistant's stands in, with the page's own answers (the panel's). */
  const pageHass = (state: DemoState, ws?: HouseOptions['ws']): HomeAssistant => {
    page = createHouse([], { dark: state.mode === 'dark', language: state.language, ws });
    return withEnvironment(page.hass(), state);
  };

  /** The settings panel, Activity or History: the whole width, as Home Assistant gives it; each fetched when opened. */
  const showPage = async (state: DemoState): Promise<void> => {
    const mine = ticket;
    const { view } = state;
    root.classList.add('pg-panel');
    if (view.kind === 'panel') {
      const { mountPanel, PANEL_WS } = await import('@fluvy/playground/panel');
      if (mine === ticket)
        mountPanel(root, pageHass(state, PANEL_WS), view.tab, state.mode === 'dark', [], look);
    } else if (view.kind === 'history') {
      const { mountHistory } = await import('@fluvy/playground/history');
      if (mine === ticket)
        mountHistory(
          root,
          pageHass(state),
          state.language,
          false,
          view.moment as HistoryMoment | undefined,
        );
    } else if (view.kind === 'activity') {
      const { mountActivity } = await import('@fluvy/playground/activity');
      if (mine === ticket)
        mountActivity(
          root,
          pageHass(state),
          state.language,
          false,
          view.moment as ActivityMoment | undefined,
        );
    }
  };

  const stage: Stage = {
    async show(state) {
      clear();
      ticket += 1;
      shown = state;
      const { view } = state;
      switch (view.kind) {
        case 'overview':
          showOverview(state);
          return;
        case 'cards':
          showIndex(state);
          return;
        case 'card': {
          const card = cardOf(view.card);
          if (card) showCard(state, card);
          return;
        }
        case 'sheet':
          showSheets(state, view.name);
          return;
        case 'auto':
          return showAuto(state, view.view);
        case 'themes':
          showThemes(state);
          return;
        default:
          return showPage(state);
      }
    },
    update(state) {
      const before = shown;
      // the panel moved to another of its tabs itself: it shows it already, only the address follows
      if (
        before?.view.kind === 'panel' &&
        state.view.kind === 'panel' &&
        before.mode === state.mode &&
        before.language === state.language
      ) {
        shown = state;
        return;
      }
      // another page, a page of Home Assistant's, another device: from nothing (the lanes are filled by height)
      if (
        !before ||
        !samePage(before.view, state.view) ||
        ['panel', 'history', 'activity'].includes(state.view.kind) ||
        columns(before) !== columns(state) ||
        frameWidth(before) !== frameWidth(state)
      ) {
        void stage.show(state);
        return;
      }
      shown = state;
      for (const { house, cards } of houses) dress(cards, house.hass());
      restyle(state);
      for (const draw of refresh) draw(state);
    },
    nameOf: (entityId) => {
      for (const hass of [
        ...houses.map((shownHouse) => shownHouse.house.hass),
        ...(page ? [page.hass] : []),
      ]) {
        const name = hass().states[entityId]?.attributes.friendly_name;
        if (name) return name;
      }
      return entityId;
    },
    viewAt: (path) => {
      if (shown?.view.kind !== 'auto') return undefined;
      const last = path.split('/').filter(Boolean).pop() ?? '';
      return autoViews.some((view) => view.path === last)
        ? { kind: 'auto', view: last }
        : undefined;
    },
  };

  // a window that now holds more lanes, or fewer, lays the frames out again
  new ResizeObserver(() => {
    if (shown && lanes?.isConnected && laneCount(shown) !== laid) void stage.show(shown);
  }).observe(root);

  return stage;
}
