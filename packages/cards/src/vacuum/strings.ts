import { strings } from '@fluvy/core';

/**
 * The vacuum card's own labels. Battery, Suction, Start, Pause, Stop, Return to dock, Locate and
 * Remaining come from the shared table; the two readout labels and the head's time line live here.
 * Readout labels stay short: three of them share a 260 px column on a narrow dashboard.
 */
export const vacuumStrings = strings('vacuum');
