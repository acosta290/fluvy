import { contrastRatio, onDarkPage, type Hex } from '@fluvy/tokens/runtime';
import {
  drawsNothing,
  imageAddress,
  parseBackground,
  type BackgroundType,
  type PageBackground,
} from '../settings/background.js';
import { attachToElementClass, browserEnv } from '../shell/index.js';
import { BACKGROUND_ATTRIBUTE } from './background.js';
import { paletteOf, type Look } from './css.js';
import type { RootElement } from './tabs.js';

/*
 * The page's background (1.19, Discussion #155), fetched the first time a dashboard wears one: what a root is marked
 * with, and the sheet that draws it. Home Assistant's own layer under the view (`hui-view-background`) takes it, held
 * still — fixed, a layer of its own, so a scroll moves the page over it and paints nothing again (never
 * `background-attachment: fixed`, which paints the page anew at every step of a scroll) — from beside the sidebar to
 * the window's edges, under the header, a subview's too. A view or a dashboard with a background in Home Assistant's
 * own key keeps it (`backgroundOf` gives it none). A colour that is deep (white reads on it better than the
 * palette's ink) gives the words on the page — the greeting, a heading, the header on the page's colour — the light
 * ink in light mode, and stays as it is in dark mode; a pale one keeps the palette's ink, and in dark mode is taken to
 * the dark page's own lightness (`onDarkPage`). A picture is taken towards the page's colour by its dim, in either
 * mode, and out of focus if asked; the header on the page's colour lets it through, frosted.
 */

/** On `hui-root`: the picture is out of focus. */
const BLUR_ATTRIBUTE = 'fluvy-bg-blur';
/** On `hui-root`: the device draws Lite (#165), so nothing over the background is blurred: its header stands solid. */
const STILL_ATTRIBUTE = 'fluvy-bg-still';
/** On `hui-root`: the words on the page take the light ink. */
const INK_ATTRIBUTE = 'fluvy-bg-ink';
/** What a root carries of its background, every value checked before it is written. */
const VARS = [
  '--fluvy-bg-1',
  '--fluvy-bg-2',
  '--fluvy-bg-image',
  '--fluvy-bg-dim',
  '--fluvy-page-ink',
  '--fluvy-page-ink-2',
] as const;
type Var = (typeof VARS)[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A strategy's own background, read once a configuration (null: it says none). */
const owns = new WeakMap<object, PageBackground | null>();

/** What a dashboard of ours says of its own background (its strategy's `background`); undefined where it says none. */
function ownOf(root: RootElement): PageBackground | undefined {
  const strategy = root.lovelace?.rawConfig?.strategy;
  if (!isRecord(strategy)) return undefined;
  let own = owns.get(strategy);
  if (own === undefined) {
    const ours =
      typeof strategy['type'] === 'string' && strategy['type'].startsWith('custom:fluvy-');
    own = ours && isRecord(strategy['background']) ? parseBackground(strategy['background']) : null;
    owns.set(strategy, own);
  }
  return own ?? undefined;
}

/**
 * The background a dashboard's root wears now, given the house's where its dashboard wears the look (undefined where
 * it does not): none in a panel of Home Assistant's own that draws a root (its Energy, its Home), nor where the view or
 * the dashboard has a background in Home Assistant's own key (Home Assistant draws it, as before); else the
 * dashboard's own, else the house's — none where that draws nothing.
 */
export function backgroundOf(
  root: RootElement,
  house: PageBackground | undefined,
): PageBackground | undefined {
  if (!house) return undefined;
  const host = (root.getRootNode() as Partial<ShadowRoot>).host;
  if (host && host.localName !== 'ha-panel-lovelace' && host.localName.startsWith('ha-panel-'))
    return undefined;
  const config = root.lovelace?.config;
  const index = root._curView;
  const view = typeof index === 'number' ? config?.views?.[index] : undefined;
  if (view?.background || config?.background) return undefined;
  const chosen = ownOf(root) ?? house;
  return drawsNothing(chosen) ? undefined : chosen;
}

/** The light ink, as a filled tile's words are white; its quiet line at 84 %. */
const LIGHT_INK = '#ffffff';
const LIGHT_INK_2 = 'rgb(255 255 255 / 0.84)';

/** What an element wears of a background: its type, whether its picture is out of focus, the light ink, its values. */
export interface BackgroundStyle {
  readonly type: Exclude<BackgroundType, 'plain'>;
  readonly blur: boolean;
  readonly ink: boolean;
  readonly vars: Readonly<Partial<Record<Var, string>>>;
}

/** A background as a look in a mode wears it; undefined where it draws nothing. */
export function backgroundStyle(
  background: PageBackground,
  look: Look,
  dark: boolean,
): BackgroundStyle | undefined {
  const type = background.type;
  if (drawsNothing(background) || type === 'plain') return undefined;
  const vars: Partial<Record<Var, string>> = {};
  let ink = false;
  if (type === 'color') {
    const palette = paletteOf(look.palette);
    const [first = '#000000', second] = background.colors as readonly Hex[];
    const deep = contrastRatio(LIGHT_INK, first) > contrastRatio(palette.light.text.primary, first);
    const shown = (color: Hex): Hex =>
      dark && !deep ? onDarkPage(color, palette.dark.surface.page) : color;
    vars['--fluvy-bg-1'] = shown(first);
    if (second) vars['--fluvy-bg-2'] = shown(second);
    ink = deep && !dark;
    if (ink) {
      vars['--fluvy-page-ink'] = LIGHT_INK;
      vars['--fluvy-page-ink-2'] = LIGHT_INK_2;
    }
  } else if (type === 'image') {
    // checked once more where it is written: nothing reaches `url()` that the address check refused
    const address = imageAddress(background.image);
    if (!address) return undefined;
    vars['--fluvy-bg-image'] = `url("${address}")`;
    vars['--fluvy-bg-dim'] = `${background.dim}%`;
  }
  return { type, blur: type === 'image' && background.blur, ink, vars };
}

/** A background's values as a style attribute's text (the panel's preview). */
export const styleText = (style: BackgroundStyle): string =>
  Object.entries(style.vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(';');

/** The palette's gradient: three stains in the page's own hue over it (the mesh, as the design drew it). */
const MESH =
  'radial-gradient(120% 80% at 10% 0%,var(--fluvy-mesh-1) 0%,transparent 60%),radial-gradient(90% 70% at 100% 20%,var(--fluvy-mesh-2) 0%,transparent 60%),radial-gradient(100% 80% at 40% 110%,var(--fluvy-mesh-3) 0%,transparent 60%),var(--fluvy-page)';

/**
 * A layer's rules, `at` naming the layer under a mark of what carries it (a root, the panel's preview): the gradient,
 * the colour or two, the picture over the page's colour with its dim over it, and out of focus by 3 % of the smaller
 * side of what holds it (the window, or the preview), drawn past its edges so they stay sharp.
 */
export function layerCss(at: (mark: string) => string): string {
  const image = at('[fluvy-bg="image"]');
  return `${at('[fluvy-bg="gradient"]')}{background:${MESH}}
${at('[fluvy-bg="color"]')}{background:linear-gradient(160deg,var(--fluvy-bg-1),var(--fluvy-bg-2,var(--fluvy-bg-1)))}
${image}{background:var(--fluvy-page)}
${image}::before,${image}::after{content:"";position:absolute;inset:0}
${image}::before{background:var(--fluvy-bg-image) center/cover no-repeat}
${image}::after{background:color-mix(in srgb,var(--fluvy-page) var(--fluvy-bg-dim),transparent)}
${at(`[${BLUR_ATTRIBUTE}]`)}::before{inset:-6cqmin;filter:blur(3cqmin)}`;
}

/**
 * `hui-root`'s sheet: Home Assistant's layer under the view held still beside the sidebar, the background on it; the
 * header on the page's colour frosted over it (a colour's header is the colour itself), its words in the light ink
 * where the page asks for it (pills keep theirs: they stand on their own fill).
 */
const rootCss = `:host([${BACKGROUND_ATTRIBUTE}]) hui-view-background{position:fixed;inset:0;inset-inline-start:var(--ha-sidebar-width,0px);width:auto;height:auto;overflow:hidden;will-change:transform}
${layerCss((mark) => `:host(${mark}) hui-view-background`)}
:host([${BACKGROUND_ATTRIBUTE}][fluvy-header-page]){--app-header-background-color:color-mix(in srgb,var(--fluvy-page) 72%,transparent);--app-header-backdrop-filter:blur(20px)}
:host([${BACKGROUND_ATTRIBUTE}][${STILL_ATTRIBUTE}][fluvy-header-page]){--app-header-background-color:var(--fluvy-page);--app-header-backdrop-filter:none}
:host([${BACKGROUND_ATTRIBUTE}="color"][fluvy-header-page]){--app-header-background-color:var(--fluvy-bg-1);--app-header-backdrop-filter:none}
:host([${INK_ATTRIBUTE}][fluvy-header-page]) .header{--app-header-text-color:var(--fluvy-page-ink)}
:host([${INK_ATTRIBUTE}][fluvy-header-page]:not([fluvy-tabs="pills"])) .header{--fluvy-text:var(--fluvy-page-ink);--fluvy-text-secondary:var(--fluvy-page-ink-2)}`;

let attached = false;

/** The sheet, in every root's styles (from the first root that wears a background on). */
function attach(): void {
  const env = browserEnv();
  if (attached || !env) return;
  attached = true;
  const sheet = env.createSheet();
  sheet.replaceSync(rootCss);
  void attachToElementClass('hui-root', sheet, env);
}

/** What each root wears now, as its values' key: a root is written only when it changes. */
const worn = new WeakMap<Element, string>();

/**
 * Puts the background a root wears on it (its marks and its values), given the house's where its dashboard wears the
 * look (`backgroundOf`), or takes the one it wears off. On a device that draws Lite (`still`, #165) nothing is blurred:
 * the picture stands in focus and the header over it solid, the house's choice and a dashboard's own alike.
 */
export function paint(
  root: RootElement,
  house: PageBackground | undefined,
  look: Look,
  dark: boolean,
  still = false,
): void {
  const background = backgroundOf(root, house);
  const style = background && backgroundStyle(background, look, dark);
  const key = style ? `${JSON.stringify(style)}${still ? ' still' : ''}` : '';
  if ((worn.get(root) ?? '') === key) return;
  worn.set(root, key);
  if (style) {
    attach();
    root.setAttribute(BACKGROUND_ATTRIBUTE, style.type);
  } else root.removeAttribute(BACKGROUND_ATTRIBUTE);
  root.toggleAttribute(BLUR_ATTRIBUTE, !still && (style?.blur ?? false));
  root.toggleAttribute(STILL_ATTRIBUTE, still && style !== undefined);
  root.toggleAttribute(INK_ATTRIBUTE, style?.ink ?? false);
  for (const name of VARS) {
    const value = style?.vars[name];
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  }
}
