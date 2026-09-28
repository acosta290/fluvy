import type { SheetSpec } from '../scenes.js';

export const sheet: SheetSpec = {
  states: [
    ['switch.kitchen_light', 'on', { friendly_name: 'Kitchen light' }],
    ['switch.washer', 'off', { friendly_name: 'Washing machine', device_class: 'outlet' }],
    [
      'binary_sensor.kitchen_window',
      'on',
      { friendly_name: 'Kitchen window', device_class: 'window' },
    ],
    ['binary_sensor.motion_hall', 'off', { friendly_name: 'Hall motion', device_class: 'motion' }],
    [
      'sensor.hall_temperature',
      '21.6',
      { friendly_name: 'Hall temperature', unit_of_measurement: '°C', device_class: 'temperature' },
    ],
    ['lock.front_door', 'locked', { friendly_name: 'Front door' }],
    ['switch.ghost', 'unavailable', { friendly_name: 'Garden pump' }],
  ],
  frames: [
    {
      title: 'Entities',
      cards: [
        {
          type: 'custom:fluvy-entities-card',
          title: 'Kitchen',
          subtitle: '7 devices',
          icon: 'grid',
          show_count: true,
          entities: [
            'switch.kitchen_light',
            'switch.washer',
            'binary_sensor.kitchen_window',
            'binary_sensor.motion_hall',
            'sensor.hall_temperature',
            'lock.front_door',
            'switch.ghost',
          ],
        },
      ],
    },
    // 48 px rows, the name alone; a row can wear its own colour, say what its second line would be, and answer its own tap
    {
      title: 'Entities · compact',
      cards: [
        {
          type: 'custom:fluvy-entities-card',
          title: 'Kitchen',
          variant: 'compact',
          rows: [
            { entity: 'switch.kitchen_light', color: 'teal' },
            { entity: 'switch.washer', secondary: 'state' },
            { entity: 'binary_sensor.kitchen_window', tone: 'warning' },
            {
              entity: 'lock.front_door',
              tap_action: { action: 'navigate', navigation_path: '/fluvy-auto/security' },
            },
            'switch.ghost',
          ],
        },
      ],
    },
  ],
};
