import { FluvyPrinterCard } from '../../../../packages/cards/src/printer/printer-card.js';
import type { StateSeed } from '../hass.js';
import type { SheetSpec } from '../scenes.js';

if (!customElements.get('fluvy-printer-card'))
  customElements.define('fluvy-printer-card', FluvyPrinterCard);

/*
 * Issue #27's printers, one of each integration, as their registries and states say them: a Bambu Lab P1S printing
 * (its translation keys, a camera, the job's cover, a chamber light, its AMS's four trays on a device of their own), a
 * Prusa MK4 paused (PrusaLink, a job preview), an Ender 3 on OctoPrint printing (its sensors known by their ids, a 4:3
 * webcam, its system buttons left out), a Voron on Moonraker at rest, an A1 mini that failed (and says why), an X1
 * Carbon heating up, a Prusa MINI that has finished, and an MK4 that dropped off the network.
 */

/** The mock's moment: the time left is counted from it. */
const NOW = '2026-09-17T21:47:12';
const at = (minutes: number): string => new Date(Date.parse(NOW) + minutes * 60_000).toISOString();

type Attributes = Record<string, unknown>;
const temp = (name: string): Attributes => ({
  friendly_name: name,
  unit_of_measurement: '°C',
  device_class: 'temperature',
  state_class: 'measurement',
});
const percent = (name: string): Attributes => ({ friendly_name: name, unit_of_measurement: '%' });
const stamp = (name: string): Attributes => ({ friendly_name: name, device_class: 'timestamp' });

/** The P1S's camera: the build plate under the chamber light, the part half printed. */
const CAMERA = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <defs><radialGradient id="l" cx="0.5" cy="0.1" r="0.9"><stop offset="0" stop-color="#5a5348"/><stop offset="1" stop-color="#1c1a17"/></radialGradient></defs>
    <rect width="640" height="360" fill="url(#l)"/>
    <path d="M70 300 L570 300 L520 230 L120 230 Z" fill="#3b3a36"/>
    <path d="M120 230 L520 230 L520 222 L120 222 Z" fill="#4a4843"/>
    <path d="M250 262 L390 262 L382 200 L258 200 Z" fill="#e0662f"/>
    <path d="M270 200 L370 200 L362 168 L278 168 Z" fill="#c9562a"/>
    <rect x="296" y="96" width="48" height="40" rx="6" fill="#2a2926"/>
    <path d="M314 136 L326 136 L320 150 Z" fill="#8a8579"/>
    <rect x="40" y="88" width="560" height="10" rx="5" fill="#2f2d29"/>
  </svg>`,
)}`;

/** OctoPrint's webcam, a 4:3 USB camera over an open frame. */
const WEBCAM = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
    <rect width="640" height="480" fill="#2b2c2e"/>
    <rect x="60" y="60" width="16" height="380" fill="#55585c"/>
    <rect x="564" y="60" width="16" height="380" fill="#55585c"/>
    <rect x="60" y="150" width="520" height="14" fill="#6b6e72"/>
    <rect x="280" y="134" width="80" height="54" rx="6" fill="#1d1e20"/>
    <path d="M314 188 L326 188 L320 204 Z" fill="#9a9488"/>
    <path d="M110 400 L530 400 L500 360 L140 360 Z" fill="#3c3d40"/>
    <path d="M270 360 L370 360 L366 318 L274 318 Z" fill="#3f7fd9"/>
  </svg>`,
)}`;

/** A job's cover as the slicer renders it: the part on a light ground. */
const COVER = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#ece8e1"/>
    <path d="M136 330 L376 330 L346 384 L166 384 Z" fill="#d95f2b"/>
    <path d="M176 330 L196 238 L316 238 L346 330 Z" fill="#e8763f"/>
    <rect x="232" y="176" width="56" height="62" rx="8" fill="#c9562a"/>
    <path d="M150 384 L362 384" stroke="#b7b0a4" stroke-width="6"/>
  </svg>`,
)}`;

const P1S: readonly StateSeed[] = [
  [
    'sensor.p1s_print_status',
    'running',
    { friendly_name: 'P1S Print status', device_class: 'enum' },
  ],
  ['sensor.p1s_print_progress', '62', percent('P1S Print progress')],
  [
    'sensor.p1s_remaining_time',
    '72',
    { friendly_name: 'P1S Remaining time', unit_of_measurement: 'min', device_class: 'duration' },
  ],
  ['sensor.p1s_end_time', at(72), stamp('P1S End time')],
  ['sensor.p1s_start_time', at(-95), stamp('P1S Start time')],
  [
    'sensor.p1s_current_stage',
    'printing',
    { friendly_name: 'P1S Current stage', device_class: 'enum' },
  ],
  [
    'sensor.p1s_active_tray',
    'Bambu PLA Basic',
    { friendly_name: 'P1S Active tray', type: 'PLA', color: '#E8763FFF' },
  ],
  ['sensor.p1s_current_layer', '112', { friendly_name: 'P1S Current layer' }],
  ['sensor.p1s_total_layer_count', '240', { friendly_name: 'P1S Total layer count' }],
  ['sensor.p1s_nozzle_temperature', '220', temp('P1S Nozzle temperature')],
  ['sensor.p1s_nozzle_target_temperature', '220', temp('P1S Nozzle target temperature')],
  ['sensor.p1s_bed_temperature', '60', temp('P1S Bed temperature')],
  ['sensor.p1s_target_bed_temperature', '60', temp('P1S Target bed temperature')],
  ['sensor.p1s_chamber_temperature', '32', temp('P1S Chamber temperature')],
  ['sensor.p1s_task_name', 'Benchy.gcode', { friendly_name: 'P1S Task name' }],
  [
    'sensor.p1s_speed_profile',
    'standard',
    { friendly_name: 'P1S Speed profile', device_class: 'enum' },
  ],
  ['camera.p1s_camera', 'idle', { friendly_name: 'P1S Camera', entity_picture: CAMERA }],
  ['image.p1s_cover_image', at(-60), { friendly_name: 'P1S Cover image', entity_picture: COVER }],
  ['light.p1s_chamber_light', 'on', { friendly_name: 'P1S Chamber light' }],
  ['sensor.p1s_aux_fan', '40', percent('P1S Aux fan')],
  ['button.p1s_pause_printing', 'unknown', { friendly_name: 'P1S Pause printing' }],
  ['button.p1s_resume_printing', 'unknown', { friendly_name: 'P1S Resume printing' }],
  ['button.p1s_stop_printing', 'unknown', { friendly_name: 'P1S Stop printing' }],
];

/** The P1S's AMS: four trays, the first printing, the last empty. */
const tray = (n: number, name: string, type: string, color: string, extra: Attributes = {}) =>
  [
    `sensor.p1s_ams_tray_${n}`,
    name,
    {
      friendly_name: `AMS Tray ${n}`,
      type,
      color,
      remain: 80,
      active: false,
      empty: false,
      ...extra,
    },
  ] as const satisfies StateSeed;
const AMS: readonly StateSeed[] = [
  tray(1, 'Bambu PLA Basic', 'PLA', '#E8763FFF', { active: true }),
  tray(2, 'Bambu PETG HF', 'PETG', '#1F1F1FFF'),
  tray(3, 'Bambu PLA Matte', 'PLA', '#F4F1EAFF'),
  tray(4, '', '', '00000000', { empty: true }),
];

/** An X1 Carbon heating up for its job: the stage says what it does, the heaters both their figures. */
const X1C: readonly StateSeed[] = [
  [
    'sensor.x1c_print_status',
    'prepare',
    { friendly_name: 'X1C Print status', device_class: 'enum' },
  ],
  [
    'sensor.x1c_current_stage',
    'heatbed_preheating',
    { friendly_name: 'X1C Current stage', device_class: 'enum' },
  ],
  ['sensor.x1c_print_progress', '0', percent('X1C Print progress')],
  [
    'sensor.x1c_remaining_time',
    '184',
    { friendly_name: 'X1C Remaining time', unit_of_measurement: 'min', device_class: 'duration' },
  ],
  ['sensor.x1c_nozzle_temperature', '142', temp('X1C Nozzle temperature')],
  ['sensor.x1c_nozzle_target_temperature', '220', temp('X1C Nozzle target temperature')],
  ['sensor.x1c_bed_temperature', '45', temp('X1C Bed temperature')],
  ['sensor.x1c_target_bed_temperature', '60', temp('X1C Target bed temperature')],
  ['sensor.x1c_chamber_temperature', '28', temp('X1C Chamber temperature')],
  ['sensor.x1c_task_name', 'Gridfinity_bins_6x4.gcode', { friendly_name: 'X1C Task name' }],
  ['sensor.x1c_aux_fan', '60', percent('X1C Aux fan')],
  [
    'sensor.x1c_print_weight',
    '182',
    { friendly_name: 'X1C Print weight', unit_of_measurement: 'g' },
  ],
  ['button.x1c_pause_printing', 'unknown', { friendly_name: 'X1C Pause printing' }],
  ['button.x1c_stop_printing', 'unknown', { friendly_name: 'X1C Stop printing' }],
];

/** A Prusa MINI that finished half an hour ago: its finish time is when, never now; its filament by name. */
const MINI: readonly StateSeed[] = [
  ['sensor.mini', 'finished', { friendly_name: 'MINI', device_class: 'enum' }],
  ['sensor.mini_progress', '100', percent('MINI Progress')],
  ['sensor.mini_print_finish', at(-30), stamp('MINI Print finish')],
  ['sensor.mini_filename', 'Cable_clip.bgcode', { friendly_name: 'MINI Filename' }],
  ['sensor.mini_material', 'PETG', { friendly_name: 'MINI Material' }],
  ['sensor.mini_nozzle_temperature', '38', temp('MINI Nozzle temperature')],
  ['sensor.mini_heatbed_temperature', '41', temp('MINI Heatbed temperature')],
];

const MK4: readonly StateSeed[] = [
  ['sensor.mk4', 'paused', { friendly_name: 'MK4', device_class: 'enum' }],
  ['sensor.mk4_progress', '41', percent('MK4 Progress')],
  ['sensor.mk4_print_finish', at(126), stamp('MK4 Print finish')],
  ['sensor.mk4_filename', 'Planter_v3.bgcode', { friendly_name: 'MK4 Filename' }],
  ['sensor.mk4_nozzle_temperature', '170', temp('MK4 Nozzle temperature')],
  ['sensor.mk4_nozzle_target_temperature', '0', temp('MK4 Nozzle target')],
  ['sensor.mk4_heatbed_temperature', '52', temp('MK4 Heatbed temperature')],
  ['sensor.mk4_heatbed_target_temperature', '60', temp('MK4 Heatbed target')],
  ['sensor.mk4_print_speed', '100', percent('MK4 Print speed')],
  ['camera.mk4_preview', 'idle', { friendly_name: 'MK4 Preview', entity_picture: COVER }],
  ['button.mk4_pause_job', 'unknown', { friendly_name: 'MK4 Pause job' }],
  ['button.mk4_resume_job', 'unknown', { friendly_name: 'MK4 Resume job' }],
  ['button.mk4_cancel_job', 'unknown', { friendly_name: 'MK4 Cancel job' }],
];

const ENDER: readonly StateSeed[] = [
  ['sensor.octoprint_current_state', 'printing', { friendly_name: 'OctoPrint Current State' }],
  ['sensor.octoprint_job_percentage', '18', percent('OctoPrint Job Percentage')],
  ['sensor.octoprint_estimated_finish_time', at(214), stamp('OctoPrint Estimated Finish Time')],
  ['sensor.octoprint_actual_tool0_temp', '205', temp('OctoPrint actual tool0 temp')],
  ['sensor.octoprint_target_tool0_temp', '205', temp('OctoPrint target tool0 temp')],
  ['sensor.octoprint_actual_bed_temp', '60', temp('OctoPrint actual bed temp')],
  ['sensor.octoprint_target_bed_temp', '60', temp('OctoPrint target bed temp')],
  [
    'sensor.octoprint_current_file',
    'bracket_v2.gcode',
    { friendly_name: 'OctoPrint Current File' },
  ],
  ['binary_sensor.octoprint_printing', 'on', { friendly_name: 'OctoPrint Printing' }],
  [
    'camera.octoprint_webcam',
    'idle',
    { friendly_name: 'OctoPrint Webcam', entity_picture: WEBCAM },
  ],
  ['button.octoprint_pause_job', 'unknown', { friendly_name: 'OctoPrint Pause Job' }],
  ['button.octoprint_resume_job', 'unknown', { friendly_name: 'OctoPrint Resume Job' }],
  ['button.octoprint_stop_job', 'unknown', { friendly_name: 'OctoPrint Stop Job' }],
  ['button.octoprint_shutdown_system', 'unknown', { friendly_name: 'OctoPrint Shutdown System' }],
];

const VORON: readonly StateSeed[] = [
  ['sensor.voron_current_print_state', 'standby', { friendly_name: 'Voron Current print state' }],
  ['sensor.voron_extruder_temperature', '27', temp('Voron Extruder temperature')],
  ['sensor.voron_extruder_target', '0', temp('Voron Extruder target')],
  ['sensor.voron_bed_temperature', '26', temp('Voron Bed temperature')],
  ['sensor.voron_bed_target', '0', temp('Voron Bed target')],
  ['button.voron_emergency_stop', 'unknown', { friendly_name: 'Voron Emergency stop' }],
];

const A1: readonly StateSeed[] = [
  [
    'sensor.a1_print_status',
    'failed',
    { friendly_name: 'A1 mini Print status', device_class: 'enum' },
  ],
  ['sensor.a1_print_progress', '7', percent('A1 mini Print progress')],
  ['sensor.a1_nozzle_temperature', '180', temp('A1 mini Nozzle temperature')],
  ['sensor.a1_bed_temperature', '45', temp('A1 mini Bed temperature')],
  ['sensor.a1_task_name', 'Hook.gcode', { friendly_name: 'A1 mini Task name' }],
  [
    'binary_sensor.a1_print_error',
    'on',
    {
      friendly_name: 'A1 mini Print error',
      device_class: 'problem',
      error_code: '07008011',
      description: 'Filament ran out. Load new filament and resume.',
    },
  ],
];

const GONE: readonly StateSeed[] = [
  ['sensor.mk4_garage', 'unavailable', { friendly_name: 'Garage MK4', device_class: 'enum' }],
  ['sensor.mk4_garage_nozzle_temperature', 'unavailable', temp('Garage MK4 Nozzle temperature')],
];

/** Each printer's registry: its device, and the integration's own name for each entity. */
const entries = (
  device: string,
  platform: string,
  seeds: readonly StateSeed[],
  keys: Readonly<Record<string, string>> = {},
) =>
  seeds.map(([id]) => [
    id,
    {
      entity_id: id,
      device_id: device,
      platform,
      labels: [],
      ...(keys[id] ? { translation_key: keys[id] } : {}),
    },
  ]);

const device = (id: string, name: string, model: string, via: string | null = null) => [
  id,
  {
    id,
    name,
    name_by_user: null,
    model,
    manufacturer: '',
    area_id: null,
    labels: [],
    via_device_id: via,
  },
];

export const sheet: SheetSpec = {
  states: [...P1S, ...AMS, ...X1C, ...MINI, ...MK4, ...ENDER, ...VORON, ...A1, ...GONE],
  registry: {
    entities: Object.fromEntries([
      ...entries('d-p1s', 'bambu_lab', P1S, {
        'sensor.p1s_print_status': 'print_status',
        'sensor.p1s_print_progress': 'print_progress',
        'sensor.p1s_remaining_time': 'remaining_time',
        'sensor.p1s_end_time': 'end_time',
        'sensor.p1s_start_time': 'start_time',
        'sensor.p1s_current_stage': 'stage',
        'sensor.p1s_active_tray': 'active_tray',
        'sensor.p1s_current_layer': 'current_layer',
        'sensor.p1s_total_layer_count': 'total_layers',
        'sensor.p1s_nozzle_temperature': 'nozzle_temp',
        'sensor.p1s_nozzle_target_temperature': 'target_nozzle_temp',
        'sensor.p1s_bed_temperature': 'bed_temp',
        'sensor.p1s_target_bed_temperature': 'target_bed_temp',
        'sensor.p1s_chamber_temperature': 'chamber_temp',
        'sensor.p1s_task_name': 'subtask_name',
        'sensor.p1s_speed_profile': 'speed_profile',
        'camera.p1s_camera': 'camera',
        'image.p1s_cover_image': 'cover_image',
        'light.p1s_chamber_light': 'chamber_light',
        'sensor.p1s_aux_fan': 'aux_fan',
        'button.p1s_pause_printing': 'pause',
        'button.p1s_resume_printing': 'resume',
        'button.p1s_stop_printing': 'stop',
      }),
      // the AMS is a device of its own, reached through the printer
      ...entries('d-p1s-ams', 'bambu_lab', AMS, {
        'sensor.p1s_ams_tray_1': 'tray_1',
        'sensor.p1s_ams_tray_2': 'tray_2',
        'sensor.p1s_ams_tray_3': 'tray_3',
        'sensor.p1s_ams_tray_4': 'tray_4',
      }),
      ...entries('d-x1c', 'bambu_lab', X1C, {
        'sensor.x1c_print_status': 'print_status',
        'sensor.x1c_current_stage': 'stage',
        'sensor.x1c_print_progress': 'print_progress',
        'sensor.x1c_remaining_time': 'remaining_time',
        'sensor.x1c_nozzle_temperature': 'nozzle_temp',
        'sensor.x1c_nozzle_target_temperature': 'target_nozzle_temp',
        'sensor.x1c_bed_temperature': 'bed_temp',
        'sensor.x1c_target_bed_temperature': 'target_bed_temp',
        'sensor.x1c_chamber_temperature': 'chamber_temp',
        'sensor.x1c_task_name': 'subtask_name',
        'sensor.x1c_aux_fan': 'aux_fan',
        'sensor.x1c_print_weight': 'print_weight',
        'button.x1c_pause_printing': 'pause',
        'button.x1c_stop_printing': 'stop',
      }),
      ...entries('d-mini', 'prusalink', MINI, {
        'sensor.mini': 'printer_state',
        'sensor.mini_progress': 'progress',
        'sensor.mini_print_finish': 'print_finish',
        'sensor.mini_filename': 'filename',
        'sensor.mini_material': 'material',
        'sensor.mini_nozzle_temperature': 'nozzle_temperature',
        'sensor.mini_heatbed_temperature': 'heatbed_temperature',
      }),
      ...entries('d-mk4', 'prusalink', MK4, {
        'sensor.mk4': 'printer_state',
        'sensor.mk4_progress': 'progress',
        'sensor.mk4_print_finish': 'print_finish',
        'sensor.mk4_filename': 'filename',
        'sensor.mk4_nozzle_temperature': 'nozzle_temperature',
        'sensor.mk4_nozzle_target_temperature': 'nozzle_target_temperature',
        'sensor.mk4_heatbed_temperature': 'heatbed_temperature',
        'sensor.mk4_heatbed_target_temperature': 'heatbed_target_temperature',
        'sensor.mk4_print_speed': 'print_speed',
        'camera.mk4_preview': 'job_preview',
        'button.mk4_pause_job': 'pause_job',
        'button.mk4_resume_job': 'resume_job',
        'button.mk4_cancel_job': 'cancel_job',
      }),
      // OctoPrint names its state and its file; the rest only by their ids
      ...entries('d-ender', 'octoprint', ENDER, {
        'sensor.octoprint_current_state': 'status',
        'sensor.octoprint_current_file': 'file_name',
      }),
      ...entries('d-voron', 'moonraker', VORON, {
        'sensor.voron_current_print_state': 'current_print_state',
        'sensor.voron_extruder_temperature': 'extruder_temperature',
        'sensor.voron_extruder_target': 'extruder_target',
        'sensor.voron_bed_temperature': 'bed_temperature',
        'sensor.voron_bed_target': 'bed_target',
        'button.voron_emergency_stop': 'emergency_stop',
      }),
      ...entries('d-a1', 'bambu_lab', A1, {
        'sensor.a1_print_status': 'print_status',
        'sensor.a1_print_progress': 'print_progress',
        'sensor.a1_nozzle_temperature': 'nozzle_temp',
        'sensor.a1_bed_temperature': 'bed_temp',
        'sensor.a1_task_name': 'subtask_name',
        'binary_sensor.a1_print_error': 'print_error',
      }),
      ...entries('d-gone', 'prusalink', GONE, {
        'sensor.mk4_garage': 'printer_state',
        'sensor.mk4_garage_nozzle_temperature': 'nozzle_temperature',
      }),
    ]),
    devices: Object.fromEntries([
      device('d-p1s', 'P1S', 'P1S'),
      device('d-p1s-ams', 'AMS', 'AMS', 'd-p1s'),
      device('d-x1c', 'Bambu Lab X1 Carbon (workshop bench)', 'X1 Carbon'),
      device('d-mini', 'Prusa MINI', 'MINI'),
      device('d-mk4', 'Prusa MK4', 'MK4'),
      device('d-ender', 'Ender 3', 'OctoPrint'),
      device('d-voron', 'Voron 2.4', 'Klipper'),
      device('d-a1', 'A1 mini', 'A1 mini'),
      device('d-gone', 'Garage MK4', 'MK4'),
    ]),
  },
  frames: [
    {
      title: 'Bambu Lab · printing',
      cards: [{ type: 'custom:fluvy-printer-card', device: 'd-p1s', _now: NOW }],
    },
    {
      title: 'PrusaLink · paused',
      cards: [{ type: 'custom:fluvy-printer-card', device: 'd-mk4', _now: NOW }],
    },
    {
      title: 'OctoPrint · printing, by its ids',
      cards: [
        { type: 'custom:fluvy-printer-card', entity: 'sensor.octoprint_current_state', _now: NOW },
      ],
    },
    {
      title: 'OctoPrint · its webcam in 4:3',
      cards: [
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-ender',
          aspect_ratio: '4:3',
          fit_mode: 'contain',
          _now: NOW,
        },
      ],
    },
    {
      title: 'Moonraker · at rest',
      cards: [{ type: 'custom:fluvy-printer-card', device: 'd-voron', _now: NOW }],
    },
    {
      title: 'Failed · and offline',
      cards: [
        { type: 'custom:fluvy-printer-card', device: 'd-a1', _now: NOW },
        { type: 'custom:fluvy-printer-card', device: 'd-gone', _now: NOW },
      ],
    },
    {
      title: 'Heating up · a long name',
      cards: [{ type: 'custom:fluvy-printer-card', device: 'd-x1c', _now: NOW }],
    },
    {
      title: 'Finished · its filament by name',
      cards: [
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-mini',
          readouts: ['nozzle', 'bed', 'filament'],
          _now: NOW,
        },
      ],
    },
    {
      title: 'More readouts · a fan and the print’s weight',
      cards: [
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-x1c',
          name: 'X1 Carbon',
          show_controls: false,
          readouts: ['nozzle', 'bed', 'chamber'],
          sensors: [
            { entity: 'sensor.x1c_aux_fan', name: 'Fan' },
            { entity: 'sensor.x1c_print_weight', name: 'Weight' },
          ],
          _now: NOW,
        },
      ],
    },
    // a card's own colour is the accent's, never a status's: a failed and a paused print keep the warning
    {
      title: 'A colour of its own · failed and paused',
      cards: [
        { type: 'custom:fluvy-printer-card', device: 'd-a1', color: 'teal', _now: NOW },
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-mk4',
          color: 'teal',
          variant: 'compact',
          _now: NOW,
        },
      ],
    },
    // another day's moments: finished two days ago (by the calendar), ready tomorrow (its weekday)
    {
      title: 'Days · finished before, ready tomorrow',
      cards: [
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-mini',
          variant: 'compact',
          _now: '2026-09-19T21:47:12',
        },
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-x1c',
          name: 'X1 Carbon',
          variant: 'compact',
          _now: '2026-09-17T23:30:00',
        },
      ],
    },
    // the days by the calendar where the hours would say otherwise: 23 h after a job finished last night is yesterday,
    // 35 h after it, the next morning but one, is two days ago
    {
      title: 'Days · by the calendar, not the hours',
      cards: [
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-mini',
          variant: 'compact',
          _now: '2026-09-18T20:00:00',
        },
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-mini',
          variant: 'compact',
          _now: '2026-09-19T08:00:00',
        },
      ],
    },
    // the house's calendar, not the browser's: a job finished at 21:17 here is 07:17 the next morning in Auckland, and
    // half past midnight here is the same Auckland morning; a profile on the server's zone reads the house's day
    {
      title: 'Days · on the house’s calendar',
      hass: (hass) =>
        ({
          ...hass,
          config: { ...hass.config, time_zone: 'Pacific/Auckland' },
          locale: { ...hass.locale, time_zone: 'server' },
        }) as typeof hass,
      cards: [
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-mini',
          variant: 'compact',
          _now: '2026-09-18T00:30:00',
        },
      ],
    },
    {
      title: 'Its own words · a row without buttons',
      cards: [
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-p1s',
          variant: 'compact',
          readouts: ['nozzle'],
          sensors: ['sensor.p1s_aux_fan'],
          _now: NOW,
        },
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-p1s',
          variant: 'row',
          show_controls: false,
          _now: NOW,
        },
      ],
    },
    {
      title: 'Half a column · trays and readouts',
      width: 180,
      cards: [{ type: 'custom:fluvy-printer-card', device: 'd-p1s', show_image: false, _now: NOW }],
    },
    {
      title: 'Compact',
      cards: [
        { type: 'custom:fluvy-printer-card', device: 'd-p1s', variant: 'compact', _now: NOW },
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-mk4',
          variant: 'compact',
          readouts: ['nozzle', 'bed', 'speed'],
          _now: NOW,
        },
      ],
    },
    {
      title: 'Rows',
      cards: [
        { type: 'custom:fluvy-printer-card', device: 'd-p1s', variant: 'row', _now: NOW },
        { type: 'custom:fluvy-printer-card', device: 'd-mk4', variant: 'row', _now: NOW },
        { type: 'custom:fluvy-printer-card', device: 'd-voron', variant: 'row', _now: NOW },
        { type: 'custom:fluvy-printer-card', device: 'd-x1c', variant: 'row', _now: NOW },
        { type: 'custom:fluvy-printer-card', device: 'd-a1', variant: 'row', _now: NOW },
      ],
    },
    // a state word too long for the row beside its circle (German's 100 px "Fehlgeschlagen" at half a column): the
    // round, then the circle give way, the row itself the button; the state is never cut
    {
      title: 'Row · a long state word',
      width: 176,
      hass: (hass) =>
        ({
          ...hass,
          formatEntityState: (stateObj, state) =>
            stateObj.entity_id === 'sensor.a1_print_status'
              ? 'Fehlgeschlagen'
              : (hass.formatEntityState?.(stateObj, state) ?? stateObj.state),
        }) as typeof hass,
      cards: [{ type: 'custom:fluvy-printer-card', device: 'd-a1', variant: 'row', _now: NOW }],
    },
    {
      title: 'Without the picture and the buttons',
      cards: [
        {
          type: 'custom:fluvy-printer-card',
          device: 'd-p1s',
          name: 'Workshop',
          show_image: false,
          show_controls: false,
          readouts: ['nozzle', 'bed', 'layer', 'speed'],
          _now: NOW,
        },
      ],
    },
  ],
};
