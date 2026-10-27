import type { HomeAssistant } from '@fluvy/core';
import { FluvyEnergyCard } from '../../../../packages/cards/src/energy/energy-card.js';
import { FluvyEnergyDevicesCard } from '../../../../packages/cards/src/energy-devices/energy-devices-card.js';
import { FluvyEnergyFlowCard } from '../../../../packages/cards/src/energy-flow/energy-flow-card.js';
import { FluvyEnergyPeriodCard } from '../../../../packages/cards/src/energy-period/energy-period-card.js';
import { FluvyEnergySankeyCard } from '../../../../packages/cards/src/sankey/sankey-card.js';
import { FluvyEnergyScoreCard } from '../../../../packages/cards/src/score/score-card.js';
import type { SheetSpec } from '../scenes.js';
import { sheet as sankey } from './sankey.js';

for (const [tag, element] of [
  ['fluvy-energy-period-card', FluvyEnergyPeriodCard],
  ['fluvy-energy-flow-card', FluvyEnergyFlowCard],
  ['fluvy-energy-sankey-card', FluvyEnergySankeyCard],
  ['fluvy-energy-score-card', FluvyEnergyScoreCard],
  ['fluvy-energy-devices-card', FluvyEnergyDevicesCard],
  ['fluvy-energy-card', FluvyEnergyCard],
] as const)
  if (!customElements.get(tag)) customElements.define(tag, element);

/**
 * The Energy period card and the energy cards following an Energy date picker (`collection_key`): the sankey sheet's
 * house (the flow sheet's Energy dashboard with its devices and its CO₂ signal) on a collection the mock keeps as
 * Home Assistant would, `energy_pg` — today unless the page says `?period=` — one that lands late, as a picker's card
 * loaded after ours does, and one no picker holds, which the strip has Home Assistant's date card make. The strip
 * moves them all; the followers' chips are gone, their subtitle says the span, their figures are the picker's.
 */

/** The mock's moment (the flow sheet's). */
const NOW = '2026-09-17T21:47:12';

const strip = (more: Record<string, unknown> = {}) => ({
  type: 'custom:fluvy-energy-period-card',
  collection_key: 'energy_pg',
  _now: NOW,
  ...more,
});

const followers = (key: string) => [
  {
    type: 'custom:fluvy-energy-flow-card',
    period: 'day',
    badge: 'self_powered',
    collection_key: key,
    _now: NOW,
  },
  { type: 'custom:fluvy-energy-sankey-card', collection_key: key, _now: NOW },
  { type: 'custom:fluvy-energy-score-card', collection_key: key, _now: NOW },
  {
    type: 'custom:fluvy-energy-devices-card',
    title: 'Where it goes',
    collection_key: key,
    _now: NOW,
  },
  { type: 'custom:fluvy-energy-card', variant: 'sources', collection_key: key, _now: NOW },
];

export const sheet: SheetSpec = {
  states: sankey.states,
  ...(sankey.registry ? { registry: sankey.registry } : {}),
  ...(sankey.ws ? { ws: sankey.ws } : {}),
  collections: ['energy_pg', { key: 'energy_late', after: 800 }],

  frames: [
    { title: 'Row', cards: [strip({ show_compare: true })] },
    { title: 'Compact', cards: [strip({ variant: 'compact' })] },
    { title: 'Stacked', cards: [strip({ variant: 'stacked' })] },
    { title: 'Followers', cards: [strip(), ...followers('energy_pg')] },
    {
      title: 'Found late',
      cards: [
        {
          type: 'custom:fluvy-energy-flow-card',
          period: 'day',
          collection_key: 'energy_late',
          _now: NOW,
        },
        { type: 'custom:fluvy-energy-score-card', collection_key: 'energy_late', _now: NOW },
      ],
    },
    // no picker holds this key: the strip has Home Assistant's date card make the collection, hidden inside it
    {
      title: 'Made by Home Assistant',
      cards: [
        strip({ collection_key: 'energy_made', variant: 'stacked' }),
        { type: 'custom:fluvy-energy-score-card', collection_key: 'energy_made', _now: NOW },
      ],
    },
    // a page that is no dashboard (no url to key a picker by): the strip says so at its size, its buttons off
    {
      title: 'Not on a dashboard',
      hass: (hass: HomeAssistant) => ({ ...hass, panelUrl: undefined }) as unknown as HomeAssistant,
      cards: [
        { type: 'custom:fluvy-energy-period-card', show_compare: true, _now: NOW },
        { type: 'custom:fluvy-energy-period-card', variant: 'compact', _now: NOW },
      ],
    },
    // the sheet behind the span's words, drawn open in the card's place
    {
      title: 'The sheet',
      width: 392,
      cards: [strip({ show_compare: true, _sheet: true })],
    },
    {
      title: 'The sheet · custom',
      width: 392,
      cards: [strip({ _sheet: 'custom' })],
    },
    {
      title: 'A phone',
      width: 328,
      cards: [
        strip({ show_compare: true }),
        strip({ variant: 'compact' }),
        strip({ variant: 'stacked' }),
      ],
    },
  ],
};
