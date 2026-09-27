import type { HomeAssistant, LovelaceCard } from '@fluvy/core';

/**
 * The preview's own little house: a few real cards on made-up entities, so the look is judged on the
 * product itself. Its `hass` is the real one with these states on top and every call a no-op (a tap in
 * the preview changes nothing at home).
 */
const STATES = (names: PreviewNames) => ({
  'light.fluvy_preview_living': {
    entity_id: 'light.fluvy_preview_living',
    state: 'on',
    attributes: {
      friendly_name: names.living,
      brightness: 178,
      supported_color_modes: ['brightness'],
      color_mode: 'brightness',
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    context: { id: 'fluvy-preview', user_id: null, parent_id: null },
  },
  'switch.fluvy_preview_kitchen': {
    entity_id: 'switch.fluvy_preview_kitchen',
    state: 'off',
    attributes: { friendly_name: names.kitchen },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    context: { id: 'fluvy-preview', user_id: null, parent_id: null },
  },
  'cover.fluvy_preview_blinds': {
    entity_id: 'cover.fluvy_preview_blinds',
    state: 'open',
    attributes: {
      friendly_name: names.blinds,
      current_position: 40,
      device_class: 'blind',
      supported_features: 15,
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    context: { id: 'fluvy-preview', user_id: null, parent_id: null },
  },
  'sensor.fluvy_preview_temperature': {
    entity_id: 'sensor.fluvy_preview_temperature',
    state: '21.4',
    attributes: {
      friendly_name: names.temperature,
      device_class: 'temperature',
      unit_of_measurement: '°C',
      state_class: 'measurement',
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    context: { id: 'fluvy-preview', user_id: null, parent_id: null },
  },
  // a house without meters of its own sees the energy flow on these: the sun covering most, the grid the rest, the
  // battery charging
  ...power('sensor.fluvy_preview_solar', names.solar, 2140),
  ...power('sensor.fluvy_preview_grid', names.grid, 380),
  ...power('sensor.fluvy_preview_battery', names.battery, -620),
  'sensor.fluvy_preview_battery_level': {
    entity_id: 'sensor.fluvy_preview_battery_level',
    state: '64',
    attributes: {
      friendly_name: names.battery,
      device_class: 'battery',
      unit_of_measurement: '%',
      state_class: 'measurement',
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    context: { id: 'fluvy-preview', user_id: null, parent_id: null },
  },
  'climate.fluvy_preview_bedroom': {
    entity_id: 'climate.fluvy_preview_bedroom',
    state: 'heat',
    attributes: {
      friendly_name: names.bedroom,
      hvac_modes: ['off', 'heat', 'cool', 'auto'],
      hvac_action: 'heating',
      temperature: 21.5,
      current_temperature: 20.8,
      min_temp: 7,
      max_temp: 35,
      target_temp_step: 0.5,
      supported_features: 1,
    },
    last_changed: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    context: { id: 'fluvy-preview', user_id: null, parent_id: null },
  },
});

/** A power meter of the preview, in watts. */
function power(id: string, name: string, watts: number) {
  return {
    [id]: {
      entity_id: id,
      state: String(watts),
      attributes: {
        friendly_name: name,
        device_class: 'power',
        unit_of_measurement: 'W',
        state_class: 'measurement',
      },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
      context: { id: 'fluvy-preview', user_id: null, parent_id: null },
    },
  };
}

export interface PreviewNames {
  readonly living: string;
  readonly kitchen: string;
  readonly bedroom: string;
  readonly blinds: string;
  readonly temperature: string;
  readonly solar: string;
  readonly grid: string;
  readonly battery: string;
}

/** The meters an energy flow is drawn on (the card's own keys). */
export type EnergyMeters = Readonly<Record<string, string | boolean>>;

/** The preview's own meters, for a house without any. */
const SIMULATED: EnergyMeters = {
  solar_power: 'sensor.fluvy_preview_solar',
  grid_power: 'sensor.fluvy_preview_grid',
  battery_power: 'sensor.fluvy_preview_battery',
  battery_level: 'sensor.fluvy_preview_battery_level',
};

/** The preview's entities. */
const ENTITY = {
  living: 'light.fluvy_preview_living',
  kitchen: 'switch.fluvy_preview_kitchen',
  blinds: 'cover.fluvy_preview_blinds',
  temperature: 'sensor.fluvy_preview_temperature',
  bedroom: 'climate.fluvy_preview_bedroom',
} as const;

export type TileEntity = Exclude<keyof typeof ENTITY, 'bedroom'>;

/** The preview's cards, each made once for its config; `update` hands every one the latest `hass`. */
export class PreviewHouse {
  private readonly made = new Map<string, LovelaceCard>();
  private preview: HomeAssistant | undefined;
  // made once: the same state objects every update, so the cards redraw only for the look
  private readonly states: ReturnType<typeof STATES>;

  constructor(names: PreviewNames) {
    this.states = STATES(names);
  }

  private card(config: Record<string, unknown>): LovelaceCard {
    const key = JSON.stringify(config);
    let card = this.made.get(key);
    if (!card) {
      card = document.createElement(String(config['type']).replace(/^custom:/, '')) as LovelaceCard;
      card.setConfig(config as never);
      card.setAttribute('preview', '');
      // the preview is part of the page: it does not rise in again each time a tab opens
      card.setAttribute('still', '');
      if (this.preview) card.hass = this.preview;
      this.made.set(key, card);
    }
    return card;
  }

  /** A tile of the house: large (a dashboard's six columns) or a compact row. */
  tile(entity: TileEntity, size: 'large' | 'compact' = 'large'): LovelaceCard {
    return this.card({
      type: 'custom:fluvy-tile-card',
      entity: ENTITY[entity],
      ...(size === 'compact' ? { size } : {}),
      grid_options: { columns: 6 },
    });
  }

  thermostat(variant: string): LovelaceCard {
    return this.card({ type: 'custom:fluvy-thermostat-card', entity: ENTITY.bedroom, variant });
  }

  /**
   * The energy flow in one of its styles, on the house's own meters when it has them (a flow is worth seeing on
   * the real one), else on the preview's.
   */
  energy(style: string, meters: EnergyMeters | null): LovelaceCard {
    return this.card({
      type: 'custom:fluvy-energy-flow-card',
      ...(meters ?? SIMULATED),
      ...(style === 'ribbons' ? {} : { flow_style: style }),
    });
  }

  /** The greeting: its avatar is "you", in the look's highlight where it has one. */
  hello(): LovelaceCard {
    return this.card({ type: 'custom:fluvy-hello-card' });
  }

  update(hass: HomeAssistant): void {
    this.preview = {
      ...hass,
      states: { ...hass.states, ...this.states },
      callService: async () => undefined,
    } as unknown as HomeAssistant;
    for (const card of this.made.values()) card.hass = this.preview;
  }
}
