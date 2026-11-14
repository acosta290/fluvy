import Sortable from 'sortablejs';

/** What Home Assistant's own `ha-sortable` draws while a row is dragged, where its user asks for no style of its own. */
const STYLE = `
  .sortable-fallback { display: none !important; }
  .sortable-ghost {
    box-shadow: 0 0 0 2px var(--primary-color);
    background: rgba(var(--rgb-primary-color), 0.25);
    border-radius: var(--ha-border-radius-sm);
    opacity: 0.4;
  }
  .sortable-drag {
    border-radius: var(--ha-border-radius-sm);
    opacity: 1;
    background: var(--card-background-color);
    box-shadow: 0px 4px 8px 3px #00000026;
    cursor: grabbing;
  }
`;

/**
 * Home Assistant's `ha-sortable` as the playground stands it in (`src/components/ha-sortable.ts`, 20260826.7): the
 * same library on the same options, so a row dragged here is dragged as it is at home. Its first child is the list;
 * `handle-selector` is what a row is held by and `draggable-selector` what moves; `item-moved` says where a row was
 * dropped, and the row is put back where it was lifted from, so the page that draws the list moves it itself.
 */
class SortableStandIn extends HTMLElement {
  /** What its user asks of the library besides (a list that stands still: `animation: 0`). */
  options: Sortable.Options | undefined;
  private sortable: Sortable | undefined;

  connectedCallback(): void {
    // once its list and its options are there, as Home Assistant's makes it after its first update
    queueMicrotask(() => {
      if (!this.isConnected || this.sortable) return;
      const list = this.children[0] as HTMLElement | undefined;
      if (!list) return;
      if (!this.hasAttribute('no-style'))
        this.append(Object.assign(document.createElement('style'), { textContent: STYLE }));
      const handle = this.getAttribute('handle-selector');
      const draggable = this.getAttribute('draggable-selector');
      this.sortable = new Sortable(list, {
        scroll: true,
        forceAutoScrollFallback: true,
        scrollSpeed: 20,
        animation: 150,
        ...this.options,
        ...(handle ? { handle } : {}),
        ...(draggable ? { draggable } : {}),
        // a comment keeps the place a row is lifted from, and the row goes back there once it is dropped: its page
        // draws the new order
        onChoose: ({ item }) => {
          const placeholder = document.createComment('sort-placeholder');
          placeholders.set(item, placeholder);
          item.after(placeholder);
        },
        onUpdate: ({ oldIndex, newIndex }) =>
          this.dispatchEvent(
            new CustomEvent('item-moved', {
              detail: { oldIndex, newIndex },
              bubbles: true,
              composed: true,
            }),
          ),
        onEnd: ({ item }) => {
          placeholders.get(item)?.replaceWith(item);
          placeholders.delete(item);
        },
      });
    });
  }

  disconnectedCallback(): void {
    this.sortable?.destroy();
    this.sortable = undefined;
  }
}

/** Where each lifted row stood. */
const placeholders = new WeakMap<HTMLElement, Comment>();

/** Defines the stand-in where Home Assistant's own is not there (always, in the playground). */
export function defineSortableStub(): void {
  if (!customElements.get('ha-sortable')) customElements.define('ha-sortable', SortableStandIn);
}
