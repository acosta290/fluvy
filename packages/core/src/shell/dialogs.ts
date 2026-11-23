import { WALL_ATTRIBUTE } from '../look/attributes.js';
import { ZOOM_VAR } from '../look/zoom.js';
import { walkShadow } from './dom.js';

/** One of Home Assistant's dialogs or sheets open on the page, as it paints itself. */
export interface OpenDialog {
  /** `dialog` or `bottom-sheet`: what an adaptive dialog chose for the screen, or what a dialog is. */
  readonly mode: string;
  /** The element it is drawn in (`ha-adaptive-dialog`, a dialog of its own). */
  readonly in: string;
  /** Its surface's variables, as its surface computes them. */
  readonly raised: string;
  readonly surface: string;
  /** What its surface paints, and where: `x,y width×height`. */
  readonly background: string;
  readonly image: string;
  readonly rect: string;
}

/** Home Assistant's dialogs and sheets open on the page, and the page they are on (#242). */
export interface DialogsReport {
  readonly open: readonly OpenDialog[];
  readonly width: number;
  readonly ratio: number;
  readonly wall: boolean;
  readonly zoom: string;
}

/** Each of Home Assistant's surfaces: its mode, the Web Awesome element in it, and the part that paints it. */
const SURFACES: Readonly<Record<string, readonly [mode: string, inner: string, part: string]>> = {
  'ha-dialog': ['dialog', 'wa-dialog', 'dialog'],
  'ha-bottom-sheet': ['bottom-sheet', 'wa-drawer', 'body'],
};

/**
 * What Home Assistant's open dialogs and sheets paint (#242), read for a report from a device we cannot hold
 * (`__fluvy.shell.dialogs()`, in a chunk of its own): each one's mode, the surface's variables, the colour, image and
 * box its surface part computes; and the page's width, pixel ratio, wall mark and size. Reads only.
 */
export function dialogsOf(doc: Document): DialogsReport {
  const view = doc.defaultView;
  const html = doc.documentElement;
  const open: OpenDialog[] = [];
  walkShadow(doc, (element) => {
    const kind = SURFACES[element.localName];
    if (!kind || !view) return;
    const [mode, inner, part] = kind;
    const surface = element.shadowRoot
      ?.querySelector(inner)
      ?.shadowRoot?.querySelector(`[part~="${part}"]`);
    const box = surface?.getBoundingClientRect();
    // a shut one has no box
    if (!surface || !box?.width) return;
    const style = view.getComputedStyle(surface);
    open.push({
      mode,
      in: (element.getRootNode() as Partial<ShadowRoot>).host?.localName ?? 'document',
      raised: style.getPropertyValue('--wa-color-surface-raised').trim(),
      surface: style.getPropertyValue('--ha-dialog-surface-background').trim(),
      background: style.backgroundColor,
      image: style.backgroundImage,
      rect: `${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}×${Math.round(box.height)}`,
    });
  });
  return {
    open,
    width: view?.innerWidth ?? 0,
    ratio: view?.devicePixelRatio ?? 1,
    wall: html.hasAttribute(WALL_ATTRIBUTE),
    zoom: html.style.getPropertyValue(ZOOM_VAR) || '1',
  };
}
