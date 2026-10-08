import type { HomeAssistant } from '@fluvy/core';

/*
 * A 3D printer's entities, found on its device. Every printer integration hangs its entities on one device —
 * OctoPrint and PrusaLink (Home Assistant's own), Bambu Lab and Moonraker (Klipper, from HACS) — each with its own
 * words. A role is known by the entity's translation key (the integration's name for it), else by the end of its id
 * (OctoPrint names most of its sensors without one), else, for a camera or a picture, by its domain. A role the card
 * names by hand (`roles`) wins. The system's own buttons (shut down, reboot, an emergency stop) are never a role. A
 * Bambu Lab printer's filament unit (AMS) is a device of its own, reached through the printer: its trays are read
 * there.
 */

export type PrinterRole =
  | 'status'
  | 'printing'
  | 'progress'
  | 'remaining'
  | 'finish'
  | 'start'
  | 'file'
  | 'stage'
  | 'error'
  | 'elapsed'
  | 'filament'
  | 'nozzle'
  | 'nozzle_target'
  | 'bed'
  | 'bed_target'
  | 'chamber'
  | 'layer'
  | 'layers'
  | 'speed'
  | 'camera'
  | 'preview'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'light';

export const PRINTER_ROLES: readonly PrinterRole[] = [
  'status',
  'printing',
  'progress',
  'remaining',
  'finish',
  'start',
  'file',
  'stage',
  'error',
  'elapsed',
  'filament',
  'nozzle',
  'nozzle_target',
  'bed',
  'bed_target',
  'chamber',
  'layer',
  'layers',
  'speed',
  'camera',
  'preview',
  'pause',
  'resume',
  'stop',
  'light',
];

/** The integrations the card knows by name (a device of another one still works through its ids and `roles`). */
export const PRINTER_PLATFORMS = ['octoprint', 'prusalink', 'bambu_lab', 'moonraker'] as const;

/** What a role may be: the domains its entity lives in. */
const DOMAINS: Readonly<Record<PrinterRole, readonly string[]>> = {
  status: ['sensor'],
  printing: ['binary_sensor'],
  progress: ['sensor'],
  remaining: ['sensor'],
  finish: ['sensor'],
  start: ['sensor'],
  file: ['sensor'],
  stage: ['sensor'],
  error: ['binary_sensor', 'sensor'],
  elapsed: ['sensor'],
  filament: ['sensor'],
  nozzle: ['sensor'],
  nozzle_target: ['sensor', 'number'],
  bed: ['sensor'],
  bed_target: ['sensor', 'number'],
  chamber: ['sensor'],
  layer: ['sensor'],
  layers: ['sensor'],
  speed: ['sensor', 'select'],
  camera: ['camera', 'image'],
  preview: ['camera', 'image'],
  pause: ['button'],
  resume: ['button'],
  stop: ['button'],
  light: ['light', 'switch'],
};

/** Each integration's translation keys, by role (Home Assistant's `hass.entities[…].translation_key`). */
const KEYS: Readonly<Record<string, PrinterRole>> = {
  // OctoPrint
  status: 'status',
  file_name: 'file',
  // PrusaLink
  printer_state: 'status',
  progress: 'progress',
  filename: 'file',
  print_start: 'start',
  print_finish: 'finish',
  nozzle_temperature: 'nozzle',
  nozzle_target_temperature: 'nozzle_target',
  heatbed_temperature: 'bed',
  heatbed_target_temperature: 'bed_target',
  print_speed: 'speed',
  material: 'filament',
  job_preview: 'preview',
  pause_job: 'pause',
  resume_job: 'resume',
  continue_job: 'resume',
  cancel_job: 'stop',
  // Bambu Lab
  print_status: 'status',
  print_progress: 'progress',
  remaining_time: 'remaining',
  start_time: 'start',
  end_time: 'finish',
  current_layer: 'layer',
  total_layers: 'layers',
  nozzle_temp: 'nozzle',
  target_nozzle_temp: 'nozzle_target',
  bed_temp: 'bed',
  target_bed_temp: 'bed_target',
  chamber_temp: 'chamber',
  subtask_name: 'file',
  gcode_file: 'file',
  stage: 'stage',
  current_stage: 'stage',
  print_error: 'error',
  hms: 'error',
  active_tray: 'filament',
  speed_profile: 'speed',
  cover_image: 'preview',
  chamber_light: 'light',
  pause: 'pause',
  resume: 'resume',
  stop: 'stop',
  // Moonraker
  current_print_state: 'status',
  print_eta: 'finish',
  print_time_left: 'remaining',
  print_duration: 'elapsed',
  extruder_temperature: 'nozzle',
  extruder_target: 'nozzle_target',
  bed_temperature: 'bed',
  bed_target: 'bed_target',
  total_layer: 'layers',
  pause_print: 'pause',
  resume_print: 'resume',
  cancel_print: 'stop',
  thumbnail: 'preview',
};

/** The end of an entity's id, for what an integration names without a translation key (OctoPrint's sensors). */
const SUFFIXES: ReadonlyArray<readonly [RegExp, PrinterRole]> = [
  [/_current_state$/, 'status'],
  [/_(job_percentage|print_progress|progress)$/, 'progress'],
  [/_(estimated_finish_time|print_finish|print_eta|end_time)$/, 'finish'],
  [/_(time_remaining|remaining_time|print_time_left)$/, 'remaining'],
  [/_(start_time|print_start)$/, 'start'],
  [/_(current_file|file_?name|subtask_name|gcode_file)$/, 'file'],
  [/_current_stage$/, 'stage'],
  [/_(print_error|hms_errors?)$/, 'error'],
  [/_print_duration$/, 'elapsed'],
  [/_(active_tray|material)$/, 'filament'],
  // a target before its reading: "…_target_bed_temp" ends as a reading's id does
  [
    /_target_tool0_temp$|_target_nozzle_temp$|_(nozzle|extruder)_target(_temperature)?$/,
    'nozzle_target',
  ],
  [/_target_bed_temp$|_(heat)?bed_target(_temperature)?$/, 'bed_target'],
  [/_actual_tool0_temp$|_(nozzle|extruder)_temp(erature)?$/, 'nozzle'],
  [/_actual_bed_temp$|_(heat)?bed_temp(erature)?$/, 'bed'],
  [/_chamber_temp(erature)?$/, 'chamber'],
  [/_current_layer$/, 'layer'],
  [/_total_layers?(_count)?$/, 'layers'],
  [/_print_speed$|_speed_profile$/, 'speed'],
  [/_printing$/, 'printing'],
  [/_pause(_job|_print)?$/, 'pause'],
  [/_(resume|continue)(_job|_print)?$/, 'resume'],
  [/_(stop|cancel)(_job|_print)?$/, 'stop'],
  [/_(chamber_)?light$/, 'light'],
  [/_(job_preview|cover_image|thumbnail)$/, 'preview'],
];

/** Never a role: the integration's own system buttons and anything that would stop a printer dead. */
const NEVER = /shutdown|shut_down|reboot|restart|emergency|firmware|system/;

/** An entity of the device as the registry and the states say it. */
interface Candidate {
  readonly id: string;
  readonly domain: string;
  readonly key: string | undefined;
}

/** The role an entity plays on a printer, or none. */
export function roleOf(candidate: Candidate): PrinterRole | undefined {
  if (NEVER.test(candidate.id) || (candidate.key && NEVER.test(candidate.key))) return undefined;
  const fits = (role: PrinterRole | undefined): role is PrinterRole =>
    role !== undefined && DOMAINS[role].includes(candidate.domain);
  const keyed = candidate.key ? KEYS[candidate.key] : undefined;
  if (fits(keyed)) return keyed;
  const object = candidate.id.slice(candidate.id.indexOf('.'));
  for (const [pattern, role] of SUFFIXES) if (pattern.test(object) && fits(role)) return role;
  // a printer's camera, else its picture: what the device shows is its camera, what an image entity holds its job's
  if (candidate.domain === 'camera') return 'camera';
  if (candidate.domain === 'image') return 'preview';
  return undefined;
}

export type PrinterEntities = Partial<Record<PrinterRole, string>>;

/** The device the card is about: the one it names, else the device of the entity it names. */
export function printerDevice(
  hass: HomeAssistant | undefined,
  device: string | undefined,
  entity: string | undefined,
): string | undefined {
  if (device) return device;
  return entity ? hass?.entities?.[entity]?.device_id : undefined;
}

/**
 * Every role the printer's device fills, the first entity of each (a device rarely has two; a printer with two nozzles
 * shows its first), then the roles named by hand over them. Hidden entities are left out of the search.
 */
export function printerEntities(
  hass: HomeAssistant | undefined,
  device: string | undefined,
  named: ReadonlyArray<{ readonly role: string; readonly entity: string }> = [],
  entity?: string,
): PrinterEntities {
  const found: PrinterEntities = {};
  const registry = hass?.entities ?? {};
  if (device)
    for (const entry of Object.values(registry)) {
      if (entry.device_id !== device || entry.hidden) continue;
      const domain = entry.entity_id.slice(0, entry.entity_id.indexOf('.'));
      const role = roleOf({ id: entry.entity_id, domain, key: entry.translation_key });
      if (role && !found[role]) found[role] = entry.entity_id;
    }
  // the entity the card names is its status when it plays no other part
  if (entity && !Object.values(found).includes(entity)) {
    const domain = entity.slice(0, entity.indexOf('.'));
    const role =
      roleOf({ id: entity, domain, key: registry[entity]?.translation_key }) ??
      (domain === 'sensor' ? 'status' : undefined);
    if (role) found[role] = entity;
  }
  for (const { role, entity: id } of named)
    if ((PRINTER_ROLES as readonly string[]).includes(role) && id) found[role as PrinterRole] = id;
  return found;
}

/**
 * The printers of a house: the devices of a printer integration that say what they are doing (a status, a progress),
 * once each — not the filament unit hung on one, which has trays and no job.
 */
export function printerDevices(hass: Pick<HomeAssistant, 'entities'> | undefined): string[] {
  const devices = new Set<string>();
  for (const entry of Object.values(hass?.entities ?? {})) {
    if (
      !entry.device_id ||
      !(PRINTER_PLATFORMS as readonly string[]).includes(entry.platform ?? '')
    )
      continue;
    const domain = entry.entity_id.slice(0, entry.entity_id.indexOf('.'));
    const role = roleOf({ id: entry.entity_id, domain, key: entry.translation_key });
    if (role === 'status' || role === 'progress' || role === 'printing')
      devices.add(entry.device_id);
  }
  return [...devices];
}

/** A filament unit's tray: Bambu Lab's AMS slots ("tray_1" … "tray_4") and the spool outside it. */
const TRAY = /^(tray_\d+|external_spool)$/;

/**
 * The filament a printer can pick from, in order: the trays of the units reached through it (each AMS, then the
 * spool outside), as sensors whose attributes say the filament's type and colour.
 */
export function printerTrays(
  hass: Pick<HomeAssistant, 'entities' | 'devices'> | undefined,
  device: string | undefined,
): string[] {
  if (!device || !hass) return [];
  const units = new Set(
    Object.values(hass.devices ?? {})
      .filter((entry) => entry.via_device_id === device)
      .map((entry) => entry.id),
  );
  units.add(device);
  return Object.values(hass.entities ?? {})
    .filter(
      (entry) =>
        entry.device_id !== undefined &&
        units.has(entry.device_id) &&
        !entry.hidden &&
        entry.entity_id.startsWith('sensor.') &&
        TRAY.test(entry.translation_key ?? ''),
    )
    .map((entry) => entry.entity_id)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
