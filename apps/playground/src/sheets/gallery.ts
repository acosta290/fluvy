import { drawn, GALLERY, MOMENT } from '../../../../tools/docs/src/gallery.js';
import type { FrameSpec, SheetSpec } from '../scenes.js';
import { sheet as alerts } from './alerts.js';
import { sheet as ambient } from './ambient.js';
import { sheet as appliances } from './appliances.js';
import { sheet as automations } from './automations.js';
import { sheet as balance } from './balance.js';
import { sheet as calendar } from './calendar.js';
import { sheet as cameras } from './cameras.js';
import { sheet as chart } from './chart.js';
import { sheet as climate } from './climate.js';
import { sheet as clocks } from './clocks.js';
import { sheet as devicesMotion } from './devices-motion.js';
import { sheet as devicesSecurity } from './devices-security.js';
import { sheet as energy } from './energy.js';
import { sheet as expander } from './expander.js';
import { sheet as historyBars } from './history-bars.js';
import { sheet as home } from './home.js';
import { sheet as homeExtras } from './home-extras.js';
import { sheet as inputs } from './inputs.js';
import { sheet as items } from './items.js';
import { sheet as lights } from './lights.js';
import { sheet as lists } from './lists.js';
import { sheet as media } from './media.js';
import { sheet as meters } from './meters.js';
import { sheet as period } from './period.js';
import { sheet as printer } from './printer.js';
import { sheet as remote } from './remote.js';
import { sheet as rooms } from './rooms.js';
import { sheet as sankey } from './sankey.js';
import { sheet as slider } from './slider.js';
import { sheet as sliderCard } from './slider-card.js';
import { sheet as solar } from './solar.js';
import { sheet as storage } from './storage.js';
import { sheet as swipe } from './swipe.js';
import { sheet as template } from './template.js';
import { sheet as usage } from './usage.js';
import { sheet as vehicle } from './vehicle.js';
import { sheet as web } from './web.js';

/**
 * The gallery (#199): the documentation's example of every card, and of each of its layouts, drawn from the one spec
 * the docs print (`tools/docs/src/gallery.ts`). A frame an example, named `gallery/<card>` (a layout's
 * `gallery/<card> · <layout>`): `pnpm docs:images` takes each example's picture from its frame, and the measurer holds
 * what the docs show to the same rules as every other sheet.
 *
 * It brings no entity of its own: it stands on the houses of the sheets its examples name entities of, so a card
 * here reads what it reads on its own sheet.
 *   ?sheet=gallery&at=2026-09-17T19:50:00Z
 */

/** The house as one of a sheet's frames shows it, where an example's card stands in a house of that frame's own. */
const viewOf = (sheet: SheetSpec, title: string): NonNullable<FrameSpec['hass']> => {
  const view = sheet.frames.find((frame) => frame.title === title)?.hass;
  if (!view) throw new Error(`gallery: no frame "${title}" with a house of its own`);
  return view;
};

/** The examples drawn in a house of their own, by the card's tag: an Energy dashboard's meters, an integration's words. */
const VIEWS: Readonly<Record<string, NonNullable<FrameSpec['hass']>>> = {
  'fluvy-energy-usage-card': viewOf(usage, 'A day'),
  'fluvy-appliance-card': viewOf(appliances, 'Miele · washer rinsing, named'),
  'fluvy-appliances-card': viewOf(appliances, 'Appliances · rows'),
};

export const sheet: SheetSpec = {
  states: [],
  on: [
    home,
    homeExtras,
    lists,
    inputs,
    template,
    slider,
    sliderCard,
    lights,
    climate,
    items,
    media,
    remote,
    devicesMotion,
    devicesSecurity,
    cameras,
    printer,
    appliances,
    vehicle,
    ambient,
    alerts,
    rooms,
    expander,
    web,
    automations,
    period,
    usage,
    energy,
    balance,
    storage,
    sankey,
    meters,
    solar,
    historyBars,
    chart,
    clocks,
    calendar,
    // last: its own answers to the Energy dashboard's questions are the balance sheet's, which must not come first
    swipe,
  ],
  frames: Object.entries(GALLERY).flatMap(([tag, example]) =>
    drawn(tag, example).map(({ name, config, cols }) => ({
      title: name,
      // a card's own clock held at the pictures' moment (a test's hook, never in the example)
      cards: [{ ...config, _now: MOMENT, ...(cols ? { cols } : {}) }],
      ...(VIEWS[tag] ? { hass: VIEWS[tag] } : {}),
    })),
  ),
};
