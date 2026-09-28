import { isActive, isUsable, type EntityView } from '@fluvy/core';
import type { GlyphName, Tone } from '@fluvy/ui';

/** Default glyph for an entity: device class first, then domain. A config `icon` always wins. */
export function glyphFor(view: EntityView): GlyphName {
  const dc = view.deviceClass;
  switch (view.domain) {
    case 'light':
      return 'bulb';
    case 'switch':
    case 'input_boolean':
      return dc === 'outlet' ? 'plug' : 'power';
    case 'cover':
      return 'blinds';
    case 'valve':
      return 'drop';
    case 'climate':
      return 'thermo';
    case 'water_heater':
      return 'heater';
    case 'humidifier':
      return 'humid';
    case 'fan':
      return 'fan';
    case 'media_player':
      return 'speaker';
    case 'vacuum':
      return 'vacuum';
    case 'lock':
      return view.state === 'locked' ? 'lock' : 'unlock';
    case 'alarm_control_panel':
      return 'shield';
    case 'camera':
      return 'camera';
    case 'person':
    case 'device_tracker':
      return 'person';
    case 'weather':
      return 'cloud';
    case 'scene':
      return 'moon';
    case 'script':
      return 'script';
    case 'automation':
      return 'auto';
    case 'button':
    case 'input_button':
      return 'bolt';
    case 'timer':
      return 'timer';
    case 'counter':
      return 'counter';
    case 'todo':
      return 'list';
    case 'calendar':
      return 'calendar';
    case 'update':
      return 'update';
    case 'sun':
      return 'sun';
    case 'input_number':
    case 'number':
      return 'sliders';
    case 'input_select':
    case 'select':
      return 'list';
    case 'input_text':
    case 'text':
      return 'text';
    case 'input_datetime':
    case 'date':
    case 'time':
    case 'datetime':
      return 'clock';
    case 'binary_sensor':
      if (dc === 'motion' || dc === 'occupancy' || dc === 'presence') return 'motion';
      if (dc === 'door' || dc === 'garage_door' || dc === 'opening' || dc === 'window')
        return 'door';
      if (dc === 'moisture') return 'drop';
      if (dc === 'battery') return 'battery';
      if (dc === 'connectivity') return 'wifi';
      if (dc === 'problem' || dc === 'safety' || dc === 'smoke' || dc === 'gas') return 'warn';
      if (dc === 'lock') return 'lock';
      return 'check';
    case 'sensor':
      if (dc === 'temperature') return 'thermo';
      if (dc === 'humidity') return 'humid';
      if (dc === 'moisture') return 'leaf';
      if (dc === 'battery') return 'battery';
      if (dc === 'power' || dc === 'energy' || dc === 'current' || dc === 'voltage') return 'bolt';
      if (dc === 'monetary') return 'counter';
      if (dc === 'illuminance') return 'sun';
      if (dc === 'water' || dc === 'volume' || dc === 'volume_flow_rate') return 'drop';
      if (dc === 'signal_strength') return 'signal';
      if (dc === 'timestamp' || dc === 'duration') return 'clock';
      return 'trendUp';
    default:
      return 'dots';
  }
}

/** The glyph a measure wears, from what it measures: a chart's head has no entity of its own. */
export const glyphForClass = (domain: string, deviceClass: string): GlyphName =>
  glyphFor({ domain, deviceClass, state: '' } as EntityView);

/** The tone an entity fills with when it is active. Off, unavailable and events stay neutral. */
export function toneFor(view: EntityView): Tone {
  switch (view.domain) {
    case 'light':
      return 'light';
    case 'climate': {
      const action = view.attr<string>('hvac_action');
      if (action === 'cooling' || view.state === 'cool') return 'cool';
      if (view.state === 'dry') return 'dry';
      if (view.state === 'fan_only') return 'fan';
      return 'heat';
    }
    case 'water_heater':
      return 'heat';
    case 'humidifier':
      return 'water';
    case 'fan':
      return 'fan';
    case 'media_player':
      return 'media';
    case 'valve':
      return 'water';
    case 'binary_sensor': {
      const dc = view.deviceClass;
      return dc === 'moisture' ||
        dc === 'problem' ||
        dc === 'safety' ||
        dc === 'smoke' ||
        dc === 'gas' ||
        dc === 'door' ||
        dc === 'window' ||
        dc === 'opening' ||
        dc === 'garage_door'
        ? 'warning'
        : 'accent';
    }
    default:
      return 'accent';
  }
}

/** Tone to draw right now: the active tone, neutral when off, the dashed "off" skin when unusable. */
export function currentTone(view: EntityView, tone: Tone = toneFor(view)): Tone {
  if (view.status === 'unavailable' || view.status === 'missing') return 'off';
  return isActive(view) ? tone : 'neutral';
}

/** How a surface draws an entity's state, the same on every card. */
export interface StateSkin {
  /** The card may draw its state and offer its controls. */
  readonly usable: boolean;
  /** The tone to draw with now (`currentTone`). */
  readonly tone: Tone;
  /** What stands in for a state that cannot be shown ("—"); undefined when the card formats its own. */
  readonly value: string | undefined;
  /** Classes of the surface: the dashed off skin when the entity cannot be reached, nothing otherwise. */
  readonly className: string;
}

/**
 * One rule for the states no card may assume away: `unknown` is a live surface (the entity is there, its value is
 * not) in the neutral tone showing "—"; `unavailable` and `missing` wear the dashed off skin and show "—".
 */
export function stateSkin(view: EntityView, tone: Tone = toneFor(view)): StateSkin {
  const usable = isUsable(view);
  return {
    usable,
    tone: currentTone(view, tone),
    value: view.status === 'ok' ? undefined : '—',
    className: usable ? '' : 'is-unavailable is-off',
  };
}
