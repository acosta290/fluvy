import type { LovelaceCardConfig } from '@fluvy/core';
import type { MockOptions, StateSeed } from './hass.js';

/**
 * The playground's content. One module per design sheet in `./sheets/` — same house as the sheets
 * (Marta’s flat, Thursday 17 September 2026, 21:47), so a card can be held against its approved
 * design. Modules are picked up automatically; nothing else has to be edited to add one.
 */
export interface FrameSpec {
  readonly title: string;
  readonly width?: number;
  /** false = a stress frame (deliberate overflow, scrolling rows): rendered for the eye, not audited by the measurer. */
  readonly measure?: boolean;
  readonly cards: ReadonlyArray<LovelaceCardConfig & { cols?: number }>;
}

export interface SheetSpec {
  readonly states: readonly StateSeed[];
  readonly frames: readonly FrameSpec[];
  /** Registries the sheet's cards read (areas, floors, devices, entity entries); merged with every other sheet's. */
  readonly registry?: MockOptions['registry'];
  /** entity id → series returned for `history/history_during_period`. */
  readonly history?: Record<string, readonly number[]>;
  /** WebSocket message type → canned answer (also used for `subscribeMessage`). */
  readonly ws?: Record<string, (message: Record<string, unknown>) => unknown>;
  /** REST answers, e.g. calendar events: (method, path) → body, or undefined to pass. */
  readonly api?: (method: string, path: string) => unknown;
}

export const NOW = new Date(2026, 8, 17, 21, 47, 12);

const modules = import.meta.glob<{ sheet: SheetSpec }>('./sheets/*.ts', { eager: true });

export const SHEETS: Record<string, SheetSpec> = Object.fromEntries(
  Object.entries(modules).map(([path, module]) => [
    path.replace('./sheets/', '').replace('.ts', ''),
    module.sheet,
  ]),
);
