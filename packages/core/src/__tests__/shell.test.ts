import { afterEach, describe, expect, it } from 'vitest';
import { startShell, type ShellEnv, type ShellHandle } from '../shell/index.js';
import { SHEETS } from '../shell/registry.js';

/* A page in miniature: roots with light children, elements with open shadow roots, Lit-like classes. */

class FakeSheet {
  css = '';
  replaceSync(text: string): void {
    this.css = text;
  }
}

class FakeRoot {
  adoptedStyleSheets: unknown[] = [];
  readonly children: FakeElement[] = [];
  constructor(private readonly marks: string[] = []) {}
  querySelectorAll(): FakeElement[] {
    const out: FakeElement[] = [];
    const walk = (list: FakeElement[]): void => {
      for (const el of list) {
        out.push(el);
        walk(el.children);
      }
    };
    walk(this.children);
    return out;
  }
  querySelector(selector: string): object | null {
    return this.marks.includes(selector) ? {} : null;
  }
  add(...elements: FakeElement[]): this {
    this.children.push(...elements);
    return this;
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  constructor(
    readonly localName: string,
    readonly shadowRoot: FakeRoot | null = null,
  ) {}
}

function page() {
  const style = new Map<string, string>();
  const attributes = new Set<string>();
  const input = new FakeElement('ha-input', new FakeRoot(['wa-input']));
  const app = new FakeElement('home-assistant', new FakeRoot().add(input));
  const document = Object.assign(new FakeRoot().add(app), {
    documentElement: {
      style: { getPropertyValue: (name: string) => style.get(name) ?? '' },
      hasAttribute: (name: string) => attributes.has(name),
    },
  });
  const classes = new Map<string, { elementStyles: unknown[] }>([
    ['ha-input', { elementStyles: ['theirs'] }],
    ['home-assistant', { elementStyles: [] }],
  ]);
  let observed: (() => void) | undefined;
  let disconnected = false;
  const env = {
    document,
    customElements: {
      get: (tag: string) => classes.get(tag),
      whenDefined: (tag: string) => (classes.has(tag) ? Promise.resolve() : new Promise(() => {})),
    },
    createSheet: () => new FakeSheet(),
    MutationObserver: class {
      constructor(callback: () => void) {
        observed = callback;
      }
      observe(): void {}
      disconnect(): void {
        disconnected = true;
      }
    },
  } as unknown as ShellEnv;
  const theme = (on: boolean): void => {
    if (on) style.set('--fluvy-theme', '1');
    else style.delete('--fluvy-theme');
    observed?.();
  };
  /** The look engine covering the whole app (`<html fluvy-look>`) instead of the theme's inline sentinel. */
  const look = (on: boolean): void => {
    if (on) attributes.add('fluvy-look');
    else attributes.delete('fluvy-look');
    observed?.();
  };
  return { env, document, input, classes, theme, look, isDisconnected: () => disconnected };
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
const sheetOf = (handle: ShellHandle, id: string) =>
  handle.report().sheets.find((s) => s.id === id)!;

let running: ShellHandle | undefined;
afterEach(() => {
  running?.stop();
  running = undefined;
});

describe('shell registry', () => {
  it('names every sheet once, targets the document or an element tag, and carries css', () => {
    expect(new Set(SHEETS.map((s) => s.id)).size).toBe(SHEETS.length);
    for (const sheet of SHEETS) {
      expect(
        sheet.target === 'document' || /^[a-z][a-z0-9._]*-[a-z0-9._-]*$/.test(sheet.target),
        sheet.target,
      ).toBe(true);
      expect(sheet.css.trim().length).toBeGreaterThan(0);
      expect(sheet.css).not.toMatch(/undefined|\[object/);
    }
  });
});

describe('shell lifecycle', () => {
  it("attaches every sheet once, empty while the fluvy theme is not the page's theme", async () => {
    const { env, document, input, classes } = page();
    running = startShell(env)!;
    await settle();
    expect(document.adoptedStyleSheets).toHaveLength(1);
    expect((document.adoptedStyleSheets[0] as FakeSheet).css).toBe('');
    const inputClass = classes.get('ha-input')!.elementStyles;
    expect(inputClass).toHaveLength(2);
    expect(inputClass[0]).toBe('theirs'); // ours goes last: it wins at equal specificity
    expect(input.shadowRoot!.adoptedStyleSheets).toContain(inputClass[1]); // the live instance got it too
    expect(running.report().active).toBe(false);
  });

  it('fills the sheets when the theme arrives and empties them when it leaves', async () => {
    const { env, document, classes, theme } = page();
    running = startShell(env)!;
    await settle();
    theme(true);
    const pageSheet = document.adoptedStyleSheets[0] as FakeSheet;
    const inputSheet = classes.get('ha-input')!.elementStyles[1] as FakeSheet;
    expect(pageSheet.css).toBe(SHEETS.find((s) => s.id === 'page')!.css);
    expect(inputSheet.css).toBe(SHEETS.find((s) => s.id === 'input')!.css);
    theme(false);
    expect(pageSheet.css).toBe('');
    expect(inputSheet.css).toBe('');
  });

  it('also fills them while the look engine covers the whole app, without any theme', async () => {
    const { env, document, look } = page();
    running = startShell(env)!;
    await settle();
    look(true);
    const pageSheet = document.adoptedStyleSheets[0] as FakeSheet;
    expect(pageSheet.css).toBe(SHEETS.find((s) => s.id === 'page')!.css);
    expect(running.report().active).toBe(true);
    look(false);
    expect(pageSheet.css).toBe('');
  });

  it('reports what it styles and whether Home Assistant still draws the probed parts', async () => {
    const { env, theme } = page();
    running = startShell(env)!;
    await settle();
    theme(true);
    expect(running.report().active).toBe(true);
    expect(sheetOf(running, 'input')).toMatchObject({ attached: true, instances: 1, probe: true });
    expect(sheetOf(running, 'frame')).toMatchObject({ attached: true, instances: 1, probe: false }); // no home-assistant-main in this page
    expect(sheetOf(running, 'sidebar')).toMatchObject({
      attached: false,
      instances: 0,
      probe: null,
    }); // not defined here
  });

  it('starts once, and stop() empties the sheets and lets go of the observer', async () => {
    const { env, document, theme, isDisconnected } = page();
    running = startShell(env)!;
    expect(startShell(env)).toBe(running);
    await settle();
    theme(true);
    running.stop();
    expect((document.adoptedStyleSheets[0] as FakeSheet).css).toBe('');
    expect(isDisconnected()).toBe(true);
    running = startShell(env)!;
    expect(running).toBeDefined();
  });
});
