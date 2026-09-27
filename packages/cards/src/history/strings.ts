import { strings } from '@fluvy/core';

/** The History view's words (the page's own; its period and its sources are the pages' shared ones). */
export const s = strings('history', 'page');

export type HistoryString = Parameters<typeof s>[1];
