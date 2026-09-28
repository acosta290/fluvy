import { addFonts } from '../fonts.js';
import { walkShadow } from './dom.js';
import type { ShellEnv, ShellHandle } from './index.js';

/**
 * Panels that run in a same-origin frame (HACS is the one every installation has, because Fluvy is installed
 * through it) have a document, a font list and a custom-element registry of their own: the page's sheets
 * and fonts never reach them, so they rendered in Roboto with Material tracking. `ha-panel-custom`
 * writes that frame itself (`_createPanel`): the one method is wrapped, and every frame it creates, and
 * the one already on screen when the shell starts, gets Inter and a shell of its own once its document
 * has loaded (its components are defined by then, whichever registry they use). A frame whose document
 * cannot be read (another origin) is left alone.
 */
interface PanelPrototype {
  _createPanel?: (panel: unknown) => void;
  __fluvyFrames?: true;
}

type FrameShell = (env: ShellEnv) => ShellHandle;

/** A frame's document, or null: a cross-origin frame throws on the read. */
function contentDocument(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument;
  } catch {
    return null;
  }
}

/** The environment of a frame's document; the registry is read when used, so a registry the frame's own code installs later is the one the shell sees. */
function frameEnv(frame: HTMLIFrameElement): ShellEnv | undefined {
  const view = frame.contentWindow as (Window & typeof globalThis) | null;
  const document = contentDocument(frame);
  if (!view || !document) return undefined;
  return {
    document,
    get customElements() {
      return view.customElements;
    },
    createSheet: () => new view.CSSStyleSheet(),
    MutationObserver: view.MutationObserver,
  };
}

export class PanelFrames {
  private readonly shells = new Map<HTMLIFrameElement, ShellHandle>();

  constructor(
    private readonly env: ShellEnv,
    private readonly shellFor: FrameShell,
  ) {}

  /** Wraps `ha-panel-custom` once it is defined (it is loaded with the first custom panel); false if Home Assistant reshaped it. */
  async watch(): Promise<boolean> {
    await this.env.customElements.whenDefined('ha-panel-custom');
    const proto = this.env.customElements.get('ha-panel-custom')?.prototype as
      PanelPrototype | undefined;
    const original = proto?._createPanel;
    if (!proto || typeof original !== 'function') return false;
    if (!proto.__fluvyFrames) {
      const attach = (frame: HTMLIFrameElement): void => this.attach(frame);
      proto._createPanel = function (this: Element, panel: unknown): void {
        original.call(this, panel);
        const frame = this.querySelector('iframe');
        if (frame) attach(frame);
      };
      proto.__fluvyFrames = true;
    }
    walkShadow(this.env.document, (element) => {
      const frame =
        element.localName === 'ha-panel-custom' ? element.querySelector('iframe') : null;
      if (frame) this.attach(frame);
    });
    return true;
  }

  attach(frame: HTMLIFrameElement): void {
    this.prune();
    if (this.shells.has(frame)) return;
    const start = (): void => {
      const env = frameEnv(frame);
      if (!env || this.shells.has(frame)) return;
      addFonts(env.document);
      this.shells.set(frame, this.shellFor(env));
    };
    if (frame.contentDocument?.readyState === 'complete') start();
    else frame.addEventListener('load', start, { once: true });
  }

  /** The shells of the frames on the page now (frames that left the page are stopped and forgotten). */
  current(): ShellHandle[] {
    this.prune();
    return [...this.shells.values()];
  }

  stop(): void {
    for (const shell of this.shells.values()) shell.stop();
    this.shells.clear();
  }

  private prune(): void {
    for (const [frame, shell] of this.shells) {
      if (frame.isConnected) continue;
      shell.stop();
      this.shells.delete(frame);
    }
  }
}
