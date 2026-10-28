import { lookRule, type HomeAssistant } from '@fluvy/core';
import { parseStatuses, statusesKey, type StatusColours } from '@fluvy/tokens/runtime';
import { mountActivity, type ActivityMoment } from '@fluvy/playground/activity';
import { mountHistory, type HistoryMoment } from '@fluvy/playground/history';
import { createHouse, mountFrame, type MockHouse, type MountedCard } from '@fluvy/playground/house';
import type { MemoryLook } from '@fluvy/playground/look-memory';
import { mountPanel, PANEL_WS } from '@fluvy/playground/panel';
import { SHEETS } from '@fluvy/playground/scenes';
import { sheetsOf } from './families.js';
import { columns, frameWidth, sameView, type DemoState } from './state.js';

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
  show(state: DemoState): void;
  /**
   * The state changed: another view or device is mounted from nothing; a change of mode or language re-skins,
   * re-words and re-measures the cards in place (a page is mounted again); the panel moving between its own tabs is
   * left as it is.
   */
  update(state: DemoState): void;
  /** An entity's name on the stand-in, for a notice. */
  nameOf(entityId: string): string;
}

/** A sheet's house and the cards mounted on it. */
interface Shown {
  readonly house: MockHouse;
  readonly cards: MountedCard[];
}

/**
 * The demo's stage: the playground's sheets as frames, or one of its pages, on the stand-in Home Assistant. Each sheet
 * stands in a house of its own, as the playground's `?sheet=<name>` draws it (a family's sheets never meet on an
 * entity id), and every frame is mounted as the playground mounts it (`mountFrame`): its own view of the house, its
 * columns, its width up to the lane's, its status colours.
 */
export function createStage(root: HTMLElement, look: MemoryLook): Stage {
  let sheets: Shown[] = [];
  let house: MockHouse | undefined;
  let shown: DemoState | undefined;
  let unsubscribe: Array<() => void> = [];
  /** The frames in status colours of their own: each one's colours, worn in the page's look. */
  const statusSheet = new CSSStyleSheet();
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, statusSheet];
  const worn = new Map<string, StatusColours>();

  const clear = (): void => {
    for (const stop of unsubscribe) stop();
    unsubscribe = [];
    root.replaceChildren();
    root.classList.remove('pg-panel');
    sheets = [];
    house = undefined;
    worn.clear();
  };

  const dress = (cards: readonly MountedCard[], hass: HomeAssistant): void => {
    if (!shown) return;
    const environment = withEnvironment(hass, shown);
    for (const { card, view } of cards) card.hass = view(environment);
  };

  /** The frames' own status colours (over the house's) in the look and the mode the page wears now. */
  const restyle = (state: DemoState): void => {
    const houses = look.handle.settings().statuses;
    statusSheet.replaceSync(
      [...worn]
        .map(([key, own]) =>
          lookRule(
            state.look,
            state.mode,
            `[data-statuses="${key}"]`,
            false,
            parseStatuses({ ...houses, ...own }),
          ),
        )
        .join(''),
    );
  };

  const showSheets = (state: DemoState): void => {
    root.style.setProperty('--demo-frame', `${frameWidth(state)}px`);
    // as many columns as the device has; each frame goes to the shortest one, so nothing is left hanging
    const lanes = Array.from({ length: columns(state) }, () => {
      const lane = document.createElement('div');
      lane.className = 'demo-lane';
      root.append(lane);
      return lane;
    });
    const shortest = (): HTMLElement =>
      lanes.reduce((low, lane) => (lane.offsetHeight < low.offsetHeight ? lane : low));
    for (const name of sheetsOf(state.view.kind === 'sheet' ? state.view.name : 'home')) {
      const sheet = SHEETS[name];
      if (!sheet) continue;
      const shownSheet: Shown = {
        house: createHouse([sheet], { dark: state.mode === 'dark', language: state.language }),
        cards: [],
      };
      sheets.push(shownSheet);
      unsubscribe.push(shownSheet.house.subscribe((hass) => dress(shownSheet.cards, hass)));
      const hass = withEnvironment(shownSheet.house.hass(), state);
      for (const frame of sheet.frames) {
        // a stress frame (deliberate overflow) is the measurer's, not a visitor's
        if (frame.measure === false) continue;
        const { el, cards } = mountFrame(name, frame, hass, {
          fit: true,
          wearStatuses: (frameEl, own) => {
            const key = statusesKey(parseStatuses(own));
            frameEl.dataset['statuses'] = key;
            worn.set(key, own);
          },
        });
        // a frame of a width of its own stands in the middle of its lane
        if (frame.width !== undefined) el.classList.add('demo-frame--own');
        shownSheet.cards.push(...cards);
        shortest().append(el);
      }
    }
    restyle(state);
  };

  const showPage = (state: DemoState): void => {
    const { view } = state;
    house = createHouse([], {
      dark: state.mode === 'dark',
      language: state.language,
      ws: view.kind === 'panel' ? PANEL_WS : undefined,
    });
    const hass = withEnvironment(house.hass(), state);
    if (view.kind === 'panel') mountPanel(root, hass, view.tab, state.mode === 'dark', [], look);
    else if (view.kind === 'history')
      mountHistory(root, hass, state.language, false, view.moment as HistoryMoment | undefined);
    else if (view.kind === 'activity')
      mountActivity(root, hass, state.language, false, view.moment as ActivityMoment | undefined);
  };

  return {
    show(state) {
      clear();
      shown = state;
      if (state.view.kind === 'sheet') showSheets(state);
      else showPage(state);
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
      // a page, another view or another device: from nothing (the lanes are filled by height)
      if (
        !before ||
        !sameView(before.view, state.view) ||
        state.view.kind !== 'sheet' ||
        columns(before) !== columns(state) ||
        frameWidth(before) !== frameWidth(state)
      ) {
        this.show(state);
        return;
      }
      shown = state;
      for (const { house: sheetHouse, cards } of sheets) dress(cards, sheetHouse.hass());
      restyle(state);
    },
    nameOf: (entityId) => {
      for (const { hass } of [...sheets.map((sheet) => sheet.house), ...(house ? [house] : [])]) {
        const name = hass().states[entityId]?.attributes.friendly_name;
        if (name) return name;
      }
      return entityId;
    },
  };
}
