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
    // what the templates read (`ls_`: other sheets own the plain names, with other units)
    [
      'climate.ls_living',
      'heat',
      { friendly_name: 'Living room', current_temperature: 22.46, temperature: 21 },
    ],
    [
      'sensor.ls_temperature',
      '22.46',
      {
        friendly_name: 'Living temperature',
        unit_of_measurement: '°C',
        device_class: 'temperature',
      },
    ],
    [
      'sensor.ls_humidity',
      '61',
      { friendly_name: 'Living humidity', unit_of_measurement: '%', device_class: 'humidity' },
    ],
    [
      'binary_sensor.ls_presence',
      'on',
      { friendly_name: 'Living room', device_class: 'occupancy' },
    ],
    [
      'sensor.ls_moisture',
      '42',
      {
        friendly_name: 'Monstera',
        unit_of_measurement: '%',
        device_class: 'moisture',
        days_since_watered: 3.2,
      },
    ],
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
    // a row's second line as a template, rendered by Home Assistant and kept live: a figure rounded, two entities on
    // one line, the person looking; a template Home Assistant refuses says nothing (never its own text); two rows
    // that ask the same template for the same entity share one subscription (the suite counts them)
    {
      title: 'Entities · templates',
      cards: [
        {
          type: 'custom:fluvy-entities-card',
          title: 'Living room',
          icon: 'home',
          rows: [
            {
              entity: 'climate.ls_living',
              name: 'Thermostat',
              secondary:
                "{{ state_attr('climate.ls_living', 'current_temperature') | round(1) }} °C",
            },
            {
              entity: 'binary_sensor.ls_presence',
              secondary:
                "{{ states('sensor.ls_temperature') | round(1) }} °C · {{ states('sensor.ls_humidity') }} %",
            },
            { entity: 'lock.front_door', secondary: 'Checked by {{ user }}' },
            {
              entity: 'switch.kitchen_light',
              secondary: "{{ states('sensor.ls_humidity') | nonsense }}",
            },
            {
              entity: 'climate.ls_living',
              name: 'Heating',
              secondary:
                "{{ state_attr('climate.ls_living', 'current_temperature') | round(1) }} °C",
            },
          ],
        },
      ],
    },
    {
      title: 'Lock · template',
      cards: [
        {
          type: 'custom:fluvy-lock-card',
          entity: 'lock.front_door',
          rows: [
            {
              entity: 'binary_sensor.kitchen_window',
              secondary: "{{ states('sensor.ls_temperature') | round(1) }} °C inside",
            },
          ],
        },
      ],
    },
    {
      title: 'Bars · template',
      cards: [
        {
          type: 'custom:fluvy-bars-card',
          title: 'Plants',
          icon: 'leaf',
          rows: [
            {
              entity: 'sensor.ls_moisture',
              secondary:
                "Watered {{ state_attr('sensor.ls_moisture', 'days_since_watered') | int }} days ago",
            },
          ],
        },
      ],
    },
  ],
};
