import { chips, type ChipItem } from '@fluvy/ui';
import type { TemplateResult } from 'lit';
import type { RowStyle } from './config.js';

/**
 * A card's row of short choices (modes, presets, sources), in the style its config asks: `full` (the default) —
 * equal chips that fill the row — or `chips`, content-sized ones. One call, so every card reads `<x>_style` alike.
 */
export const chipRow = (
  items: readonly ChipItem[],
  onSelect: (key: string) => void,
  style: RowStyle = 'full',
): TemplateResult => chips(items, onSelect, '', style === 'full');
