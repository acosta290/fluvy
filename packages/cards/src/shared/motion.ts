import { onItsDevice } from './battery.js';

/** The classes of a binary sensor that say someone is there. */
const MOTION_CLASSES: ReadonlySet<unknown> = new Set(['motion', 'occupancy', 'presence']);

/**
 * The motion sensor of what an entity belongs to: a binary sensor of motion, occupancy or presence on the entity's own
 * device (a camera's person or motion detection: Reolink's, UniFi Protect's, Frigate's), found as a battery is.
 */
export const motionOf = onItsDevice(
  (id, hass) =>
    id.startsWith('binary_sensor.') && MOTION_CLASSES.has(hass.states[id]?.attributes.device_class),
);
