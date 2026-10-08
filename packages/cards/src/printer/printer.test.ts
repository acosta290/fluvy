import { describe, expect, it } from 'vitest';
import type { HomeAssistant } from '@fluvy/core';
import { printerDevice, printerDevices, printerEntities, printerTrays, roleOf } from './roles.js';
import {
  busy,
  durationSeconds,
  elapsedSeconds,
  finishedAt,
  printerPhase,
  timeLeft,
} from './state.js';

const entry = (
  entity_id: string,
  device_id: string,
  platform: string,
  translation_key?: string,
) => ({
  entity_id,
  device_id,
  platform,
  labels: [],
  ...(translation_key ? { translation_key } : {}),
});

/** A house with one printer of each integration, as their registries name them. */
const hass = {
  entities: Object.fromEntries(
    [
      // OctoPrint: its sensors have no translation key but its status and file
      entry('sensor.octoprint_current_state', 'd-octo', 'octoprint', 'status'),
      entry('sensor.octoprint_job_percentage', 'd-octo', 'octoprint'),
      entry('sensor.octoprint_estimated_finish_time', 'd-octo', 'octoprint'),
      entry('sensor.octoprint_actual_tool0_temp', 'd-octo', 'octoprint'),
      entry('sensor.octoprint_target_tool0_temp', 'd-octo', 'octoprint'),
      entry('sensor.octoprint_actual_bed_temp', 'd-octo', 'octoprint'),
      entry('sensor.octoprint_target_bed_temp', 'd-octo', 'octoprint'),
      entry('sensor.octoprint_current_file', 'd-octo', 'octoprint', 'file_name'),
      entry('binary_sensor.octoprint_printing', 'd-octo', 'octoprint'),
      entry('camera.octoprint_camera', 'd-octo', 'octoprint'),
      entry('button.octoprint_pause_job', 'd-octo', 'octoprint'),
      entry('button.octoprint_resume_job', 'd-octo', 'octoprint'),
      entry('button.octoprint_stop_job', 'd-octo', 'octoprint'),
      entry('button.octoprint_shutdown_system', 'd-octo', 'octoprint'),
      entry('button.octoprint_restart_octoprint', 'd-octo', 'octoprint'),
      // PrusaLink
      entry('sensor.mk4', 'd-prusa', 'prusalink', 'printer_state'),
      entry('sensor.mk4_progress', 'd-prusa', 'prusalink', 'progress'),
      entry('sensor.mk4_print_finish', 'd-prusa', 'prusalink', 'print_finish'),
      entry('sensor.mk4_nozzle_temperature', 'd-prusa', 'prusalink', 'nozzle_temperature'),
      entry('camera.mk4_preview', 'd-prusa', 'prusalink', 'job_preview'),
      entry('button.mk4_cancel_job', 'd-prusa', 'prusalink', 'cancel_job'),
      // Bambu Lab
      entry('sensor.p1s_print_status', 'd-bambu', 'bambu_lab', 'print_status'),
      entry('sensor.p1s_print_progress', 'd-bambu', 'bambu_lab', 'print_progress'),
      entry('sensor.p1s_remaining_time', 'd-bambu', 'bambu_lab', 'remaining_time'),
      entry('sensor.p1s_current_layer', 'd-bambu', 'bambu_lab', 'current_layer'),
      entry('sensor.p1s_total_layer_count', 'd-bambu', 'bambu_lab', 'total_layers'),
      entry('image.p1s_cover_image', 'd-bambu', 'bambu_lab', 'cover_image'),
      entry('camera.p1s_camera', 'd-bambu', 'bambu_lab', 'camera'),
      entry('light.p1s_chamber_light', 'd-bambu', 'bambu_lab', 'chamber_light'),
      entry('sensor.p1s_current_stage', 'd-bambu', 'bambu_lab', 'stage'),
      entry('binary_sensor.p1s_print_error', 'd-bambu', 'bambu_lab', 'print_error'),
      entry('sensor.p1s_active_tray', 'd-bambu', 'bambu_lab', 'active_tray'),
      // its AMS: a device of its own, reached through the printer
      entry('sensor.p1s_ams_tray_2', 'd-ams', 'bambu_lab', 'tray_2'),
      entry('sensor.p1s_ams_tray_1', 'd-ams', 'bambu_lab', 'tray_1'),
      entry('sensor.p1s_ams_humidity', 'd-ams', 'bambu_lab', 'humidity_index'),
      // Moonraker
      entry('sensor.voron_current_print_state', 'd-voron', 'moonraker', 'current_print_state'),
      entry('sensor.voron_print_eta', 'd-voron', 'moonraker', 'print_eta'),
      entry('button.voron_emergency_stop', 'd-voron', 'moonraker', 'emergency_stop'),
      entry('button.voron_cancel_print', 'd-voron', 'moonraker', 'cancel_print'),
      entry('sensor.voron_print_duration', 'd-voron', 'moonraker', 'print_duration'),
      // not a printer
      entry('sensor.kitchen_temperature', 'd-kitchen', 'zha'),
    ].map((e) => [e.entity_id, e]),
  ),
  devices: {
    'd-bambu': { id: 'd-bambu', name: 'P1S', via_device_id: null },
    'd-ams': { id: 'd-ams', name: 'AMS', via_device_id: 'd-bambu' },
  },
  states: {},
} as unknown as HomeAssistant;

describe('a printer’s entities', () => {
  it('finds OctoPrint’s by their ids where it names them without a key, and never its system buttons', () => {
    const found = printerEntities(hass, 'd-octo');
    expect(found).toMatchObject({
      status: 'sensor.octoprint_current_state',
      progress: 'sensor.octoprint_job_percentage',
      finish: 'sensor.octoprint_estimated_finish_time',
      nozzle: 'sensor.octoprint_actual_tool0_temp',
      nozzle_target: 'sensor.octoprint_target_tool0_temp',
      bed: 'sensor.octoprint_actual_bed_temp',
      bed_target: 'sensor.octoprint_target_bed_temp',
      file: 'sensor.octoprint_current_file',
      printing: 'binary_sensor.octoprint_printing',
      camera: 'camera.octoprint_camera',
      pause: 'button.octoprint_pause_job',
      resume: 'button.octoprint_resume_job',
      stop: 'button.octoprint_stop_job',
    });
    expect(Object.values(found)).not.toContain('button.octoprint_shutdown_system');
    expect(Object.values(found)).not.toContain('button.octoprint_restart_octoprint');
  });

  it('finds PrusaLink’s, Bambu Lab’s and Moonraker’s by their translation keys', () => {
    expect(printerEntities(hass, 'd-prusa')).toMatchObject({
      status: 'sensor.mk4',
      progress: 'sensor.mk4_progress',
      finish: 'sensor.mk4_print_finish',
      nozzle: 'sensor.mk4_nozzle_temperature',
      preview: 'camera.mk4_preview',
      stop: 'button.mk4_cancel_job',
    });
    expect(printerEntities(hass, 'd-bambu')).toMatchObject({
      status: 'sensor.p1s_print_status',
      remaining: 'sensor.p1s_remaining_time',
      layer: 'sensor.p1s_current_layer',
      layers: 'sensor.p1s_total_layer_count',
      preview: 'image.p1s_cover_image',
      camera: 'camera.p1s_camera',
      light: 'light.p1s_chamber_light',
    });
    const voron = printerEntities(hass, 'd-voron');
    expect(voron).toMatchObject({
      status: 'sensor.voron_current_print_state',
      stop: 'button.voron_cancel_print',
    });
    expect(Object.values(voron)).not.toContain('button.voron_emergency_stop');
  });

  it('reads the device off any of its entities, and a role named by hand wins', () => {
    expect(printerDevice(hass, undefined, 'sensor.p1s_print_progress')).toBe('d-bambu');
    expect(
      printerEntities(hass, 'd-bambu', [{ role: 'chamber', entity: 'sensor.enclosure' }]).chamber,
    ).toBe('sensor.enclosure');
    expect(
      printerEntities(hass, 'd-bambu', [{ role: 'nonsense', entity: 'sensor.x' }]),
    ).not.toHaveProperty('nonsense');
  });

  it('takes the entity it is given as the status when nothing else is known of it', () => {
    expect(printerEntities(hass, undefined, [], 'sensor.my_printer_state').status).toBe(
      'sensor.my_printer_state',
    );
  });

  it('finds Bambu Lab’s stage, error and filament, Moonraker’s time printed, and the AMS’s trays in order', () => {
    const bambu = printerEntities(hass, 'd-bambu');
    expect(bambu.stage).toBe('sensor.p1s_current_stage');
    expect(bambu.error).toBe('binary_sensor.p1s_print_error');
    expect(bambu.filament).toBe('sensor.p1s_active_tray');
    expect(printerEntities(hass, 'd-voron').elapsed).toBe('sensor.voron_print_duration');
    // the trays of the unit reached through the printer, never its humidity
    expect(printerTrays(hass, 'd-bambu')).toEqual([
      'sensor.p1s_ams_tray_1',
      'sensor.p1s_ams_tray_2',
    ]);
    expect(printerTrays(hass, 'd-prusa')).toEqual([]);
  });

  it('lists the house’s printers by their integrations', () => {
    expect(printerDevices(hass).sort()).toEqual(['d-bambu', 'd-octo', 'd-prusa', 'd-voron']);
  });

  it('never takes a system button for a role', () => {
    expect(
      roleOf({ id: 'button.x_reboot_system', domain: 'button', key: undefined }),
    ).toBeUndefined();
  });
});

describe('what a printer is doing', () => {
  it('folds every integration’s states into the card’s phases', () => {
    expect(printerPhase('printing')).toBe('printing');
    expect(printerPhase('running')).toBe('printing');
    expect(printerPhase('printing_sd')).toBe('printing');
    expect(printerPhase('prepare')).toBe('preparing');
    expect(printerPhase('pause')).toBe('paused');
    expect(printerPhase('finish')).toBe('finished');
    expect(printerPhase('complete')).toBe('finished');
    expect(printerPhase('cancelled')).toBe('stopped');
    expect(printerPhase('failed')).toBe('error');
    expect(printerPhase('offline_after_error')).toBe('error');
    expect(printerPhase('operational')).toBe('idle');
    expect(printerPhase('standby')).toBe('idle');
    expect(printerPhase('unavailable')).toBe('offline');
    expect(printerPhase(undefined, true)).toBe('printing');
    expect(busy('paused')).toBe(true);
    expect(busy('finished')).toBe(false);
  });

  it('reads a duration in its unit, and the time left from a remaining time or a finish time', () => {
    expect(durationSeconds(72, 'min')).toBe(4320);
    expect(durationSeconds(1.5, 'h')).toBe(5400);
    expect(durationSeconds(90, 's')).toBe(90);
    expect(durationSeconds(null, 'min')).toBeNull();
    const now = Date.parse('2026-09-17T12:00:00Z');
    expect(timeLeft(3600, null, now)).toEqual({ left: 3600, at: now + 3_600_000 });
    expect(timeLeft(null, now + 1_800_000, now)).toEqual({ left: 1800, at: now + 1_800_000 });
    expect(timeLeft(null, null, now)).toEqual({ left: null, at: null });
    // both known: the integration's finish time says when (it does not drift), its remaining time how long
    expect(timeLeft(3540, now + 3_600_000, now)).toEqual({ left: 3540, at: now + 3_600_000 });
  });

  it('says when a finished job finished, never now, and how long a job has run', () => {
    const now = Date.parse('2026-09-17T12:00:00Z');
    // the finish time the printer reported; else when its status changed
    expect(finishedAt(now - 1_800_000, now - 60_000, now)).toBe(now - 1_800_000);
    expect(finishedAt(null, now - 60_000, now)).toBe(now - 60_000);
    // a finish time still ahead (an estimate left over) is not when it finished
    expect(finishedAt(now + 3_600_000, now - 60_000, now)).toBe(now - 60_000);
    expect(elapsedSeconds(4200, null, now)).toBe(4200);
    expect(elapsedSeconds(null, now - 5_700_000, now)).toBe(5700);
    expect(elapsedSeconds(null, null, now)).toBeNull();
  });
});
