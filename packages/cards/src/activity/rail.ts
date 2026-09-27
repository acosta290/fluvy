/** The Activity page's scroll ↔ time map: the anchors, the glide that settles a row under the pinned hour, the foot. */
import { spring } from '@fluvy/ui';

import type { ActivityModel } from './model.js';
import { type Anchor, CHASES, HOUR, HOUR_HEAD } from './shared.js';

import type { FluvyActivity } from './view.js';

export function isCurrent(page: FluvyActivity): boolean {
  return page.range.start <= page.now && page.now < page.range.end;
}

/** The moment at the very top of the timeline: now for a period still going, else its end. */
export function topTime(page: FluvyActivity): number {
  return isCurrent(page) ? page.now : page.range.end;
}

export function listTop(page: FluvyActivity): number {
  const list = page.renderRoot.querySelector<HTMLElement>('.av-list');
  const scroller = page.scroller;
  if (!list || !scroller) return 0;
  return Math.max(
    0,
    Math.round(
      list.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop,
    ),
  );
}

/**
 * The scroll ↔ time map. At the top, the newest moment; each hour header at its hour's end (the quiet part of an
 * hour maps to its header, with its first row under it); each row at its moment (settled under the pinned header).
 * The start of the day is the end of the scroll, where the oldest hour's header is pinned over its rows and the end
 * cap (the foot of the page leaves exactly that room): whatever lies past it — the oldest rows, the quiet stretch
 * before them — maps to that one position. An hour off screen is not laid out (content-visibility): its rows are
 * spread over its estimated height, and a settle measures the row itself.
 */
export function measureMap(page: FluvyActivity): Anchor[] {
  if (page.anchors) return page.anchors;
  const scroller = page.scroller;
  const top = topTime(page);
  const anchors: Anchor[] = [{ s: 0, t: top }];
  if (!scroller) return anchors;
  const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
  const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  const push = (s: number, t: number, row = false): void => {
    const last = anchors[anchors.length - 1]!;
    // nothing past the end of the scroll: the start of the day takes it
    if (s >= max - 0.5) return;
    anchors.push({ s: Math.max(s, last.s), t: Math.min(t, last.t), ...(row ? { row } : {}) });
  };
  page.renderRoot.querySelectorAll<HTMLElement>('.av-section').forEach((node, i) => {
    const section = page.sections[i];
    if (!section?.rows.length) return;
    // an hour's place in the flow: its section's top (under the day's name when a period crosses midnight) — never
    // its header's rect, which is sticky and reports the top of the screen while pinned
    const rect = node.getBoundingClientRect();
    const dayhead = node.querySelector<HTMLElement>('.av-dayhead');
    const head = (dayhead ? dayhead.getBoundingClientRect().bottom : rect.top) - base;
    push(head, Math.min(section.start + HOUR, top));
    const skipped = node.hasAttribute('data-skipped');
    const rows = skipped ? [] : [...node.querySelectorAll<HTMLElement>('.av-row')];
    const slot = (rect.bottom - base - (head + HOUR_HEAD)) / section.rows.length;
    section.rows.forEach((row, k) => {
      const exact = rows[k];
      const y = exact ? exact.getBoundingClientRect().top - base : head + HOUR_HEAD + k * slot;
      push(y - HOUR_HEAD, row.when * 1000, true);
    });
  });
  if (anchors.length > 1 || page.sections.length)
    anchors.push({ s: Math.max(max, anchors[anchors.length - 1]!.s), t: page.range.start });
  page.anchors = anchors;
  return anchors;
}

/** The moment at scroll position `s`. */
export function timeAt(page: FluvyActivity, s: number): number {
  const anchors = measureMap(page);
  if (s <= anchors[0]!.s) return anchors[0]!.t;
  let lo = 0;
  let hi = anchors.length - 1;
  if (s >= anchors[hi]!.s) return anchors[hi]!.t;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (anchors[mid]!.s <= s) lo = mid;
    else hi = mid;
  }
  const a = anchors[lo]!;
  const b = anchors[hi]!;
  return b.s === a.s ? b.t : a.t + ((s - a.s) / (b.s - a.s)) * (b.t - a.t);
}

/**
 * Where the list stands for moment `t`: the row at or before it; older than every row, the start of the day (the
 * end cap, the map's last point) — never back at the top.
 */
export function rowAt(page: FluvyActivity, t: number): Anchor | undefined {
  const anchors = measureMap(page);
  return anchors.find((anchor) => anchor.row && anchor.t <= t) ?? anchors[anchors.length - 1];
}

/**
 * The foot of the page leaves room for the last screen to be the oldest hour: its header pinned at the top, its
 * rows and the end cap under it (a taller hour needs no room). Measured as rows open and close.
 */
export function sizeFoot(page: FluvyActivity): void {
  const sections = page.renderRoot.querySelectorAll<HTMLElement>('.av-section');
  const oldest = sections[sections.length - 1];
  const cap = page.renderRoot.querySelector<HTMLElement>('.av-end');
  const box = page.renderRoot.querySelector<HTMLElement>('.av-page');
  if (!oldest || !cap || !box) return;
  const earlier = page.renderRoot.querySelector<HTMLElement>('.av-earlier');
  const tail = `${Math.ceil(oldest.offsetHeight + cap.offsetHeight + (earlier ? earlier.offsetHeight + 16 : 0))}px`;
  if (box.style.getPropertyValue('--av-tail') === tail) return;
  box.style.setProperty('--av-tail', tail);
  page.anchors = undefined;
}

/** The pinned hour header gets its edge (rows pass under it). */
export function markStuck(page: FluvyActivity, scroller: HTMLElement): void {
  const box = scroller.getBoundingClientRect().top;
  let stuck: HTMLElement | undefined;
  for (const header of page.renderRoot.querySelectorAll<HTMLElement>('.av-hour')) {
    const section = header.parentElement!.getBoundingClientRect();
    if (section.top < box - 1 && section.bottom > box + HOUR_HEAD) {
      stuck = header;
      break;
    }
  }
  if (stuck === page.stuck) return;
  page.stuck?.classList.remove('is-stuck');
  stuck?.classList.add('is-stuck');
  page.stuck = stuck;
}

export function gliding(page: FluvyActivity): boolean {
  return !!page.glider && Math.abs(page.glider.value - page.glideTarget) > 0.5;
}

/**
 * The timeline glides to a place on a spring (a tap on the rail, "N new"); a finger on the rail drags it closely.
 * A glide to a row chases it: the hours it passes are laid out as they come into view and push the row down, so
 * the row is measured again each frame until it sits under the pinned header.
 */
export function glide(page: FluvyActivity, y: number, row?: HTMLElement): void {
  const scroller = page.scroller;
  if (!scroller) return;
  page.chase = row ? { node: row, left: CHASES } : undefined;
  page.glideTarget = clampScroll(page, y);
  page.glider ??= spring(
    scroller.scrollTop,
    (value) => {
      scroller.scrollTop = value;
      follow(page);
    },
    { stiffness: 340, damping: 1, precision: 0.5 },
  );
  if (Math.abs(page.glider.value - scroller.scrollTop) > 2) page.glider.jump(scroller.scrollTop);
  page.glider.set(page.glideTarget);
}

export function clampScroll(page: FluvyActivity, y: number): number {
  const scroller = page.scroller;
  if (!scroller) return 0;
  return Math.round(Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, y)));
}

/** The row a glide is chasing, where it is now: the glide retargets while the layout above it settles. */
export function follow(page: FluvyActivity): void {
  const chase = page.chase;
  if (!chase || !page.glider || !chase.node.isConnected) return;
  const target = clampScroll(page, rowScroll(page, chase.node));
  if (Math.abs(target - page.glideTarget) <= 1 || chase.left <= 0) return;
  chase.left -= 1;
  page.glideTarget = target;
  page.glider.set(target);
}

/** The scroll that puts a row under the pinned hour header. */
export function rowScroll(page: FluvyActivity, node: HTMLElement): number {
  const scroller = page.scroller!;
  return (
    node.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    scroller.scrollTop -
    HOUR_HEAD
  );
}

/** The row at or before moment `t`, and the scroll that settles it (its hour is laid out first if it was not). */
export function settleOn(
  page: FluvyActivity,
  t: number,
): { s: number; t: number; node: HTMLElement } | undefined {
  const node = [...page.renderRoot.querySelectorAll<HTMLElement>('.av-row[data-t]')].find(
    (row) => Number(row.dataset['t']) <= t,
  );
  if (!page.scroller || !node) return undefined;
  const section = node.closest<HTMLElement>('.av-section');
  if (section && section !== page.forced) {
    if (page.forced) page.forced.style.contentVisibility = '';
    section.style.contentVisibility = 'visible';
    page.forced = section;
  }
  return { s: rowScroll(page, node), t: Number(node.dataset['t']), node };
}

/**
 * The rail's histogram: the period's, named by what it counts. While the next period loads, the one on screen holds
 * its place (a day for a day: the same stretches), and the new one crossfades in over it when it comes.
 */
export function histogram(
  page: FluvyActivity,
  model: ActivityModel,
): { density: readonly number[]; key: string } {
  const waiting = (page.loading && !page.events.length) || !!page.exiting;
  const held = page.held;
  if (waiting && held && held.density.length === model.density.length) return held;
  const shown = { density: model.density, key: page.subscribed };
  if (!waiting && model.density.some(Boolean)) page.held = shown;
  return shown;
}
