import { FluvyEnergyCard } from '../../../../packages/cards/src/energy/energy-card.js';
import { FluvyEnergyDevicesCard } from '../../../../packages/cards/src/energy-devices/energy-devices-card.js';
import { FluvyEnergyFlowCard } from '../../../../packages/cards/src/energy-flow/energy-flow-card.js';
import { FluvyEnergySankeyCard } from '../../../../packages/cards/src/sankey/sankey-card.js';
import { FluvyEnergyScoreCard } from '../../../../packages/cards/src/score/score-card.js';
import type { SheetSpec } from '../scenes.js';
import { sheet as sankey } from './sankey.js';

for (const [tag, element] of [
  ['fluvy-energy-flow-card', FluvyEnergyFlowCard],
  ['fluvy-energy-sankey-card', FluvyEnergySankeyCard],
  ['fluvy-energy-score-card', FluvyEnergyScoreCard],
  ['fluvy-energy-devices-card', FluvyEnergyDevicesCard],
  ['fluvy-energy-card', FluvyEnergyCard],
] as const)
  if (!customElements.get(tag)) customElements.define(tag, element);

/**
 * The energy cards following an Energy date picker (`collection_key`): the sankey sheet's house (the flow sheet's
 * Energy dashboard with its devices and its CO₂ signal) on a collection the mock keeps as Home Assistant would,
 * `energy_pg` — today unless the page says `?period=` — and one that lands late, as a picker's card loaded after
 * ours does. The chips are gone; the subtitle says the range; the figures are the picker's.
 */

/** The mock's moment (the flow sheet's). */
const NOW = '2026-09-17T21:47:12';

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
    { title: 'Followers', cards: followers('energy_pg') },
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
  ],
};
