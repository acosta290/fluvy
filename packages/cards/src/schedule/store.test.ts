import type { HomeAssistant } from '@fluvy/core';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_WEEK, helperDays, startWeek, withDay } from './plan.js';
import { PlanStore } from './store.js';

/**
 * A house on a connection of its own, answering the socket as `answer` says; `heard: false`, one without the schedule
 * integration, whose collection cannot be heard.
 */
function house(answer: (message: Record<string, unknown>) => unknown, admin = true, heard = true) {
  const callWS = vi.fn(async (message: Record<string, unknown>) => answer(message));
  const hass = {
    user: { is_admin: admin },
    connection: {
      subscribeMessage: vi.fn(async () => {
        if (!heard) throw { code: 'unknown_command', message: 'Unknown command.' };
        return () => undefined;
      }),
    },
    callWS,
  } as unknown as HomeAssistant;
  return { store: PlanStore.for(hass), callWS };
}

describe('the schedule helpers’ store', () => {
  it('writes only an administrator’s week, and only one Home Assistant takes', async () => {
    const guest = house(() => ({}), false);
    await expect(
      guest.store.create('Bedroom heating', 'mdi:calendar-clock', startWeek('comfort')),
    ).rejects.toThrow('only an administrator');
    const admin = house(() => ({}));
    const overlapping = withDay(EMPTY_WEEK, 'monday', [
      { from: 360, to: 500, preset: 'comfort' },
      { from: 480, to: 600, preset: 'eco' },
    ]);
    await expect(admin.store.create('x', 'mdi:calendar-clock', overlapping)).rejects.toThrow(
      'not a week Home Assistant takes',
    );
    expect(guest.callWS).not.toHaveBeenCalled();
    expect(admin.callWS).not.toHaveBeenCalled();
  });

  it('makes a helper with every day and finds its entity by the registry, the one its id names first', async () => {
    const week = startWeek('comfort');
    const { store, callWS } = house((message) => {
      if (message['type'] === 'schedule/create') return { id: 'kids_room_heating', ...message };
      if (message['type'] === 'config/entity_registry/get')
        return { unique_id: 'kids_room_heating' };
      return undefined;
    });
    const made = await store.create('Kids’ room heating', 'mdi:calendar-clock', week);
    expect(made.entity).toBe('schedule.kids_room_heating');
    expect(callWS.mock.calls[0]?.[0]).toEqual({
      type: 'schedule/create',
      name: 'Kids’ room heating',
      icon: 'mdi:calendar-clock',
      ...helperDays(week),
    });
    expect(store.helper('schedule.kids_room_heating')?.week.monday).toEqual(week.monday);
  });

  it('finds the entity in the registry’s list where the one its id names is another’s', async () => {
    const { store } = house((message) => {
      if (message['type'] === 'schedule/create') return { id: 'hall_heating', ...message };
      if (message['type'] === 'config/entity_registry/get') return { unique_id: 'someone_else' };
      if (message['type'] === 'config/entity_registry/list')
        return [
          { entity_id: 'schedule.hall_heating', platform: 'schedule', unique_id: 'someone_else' },
          { entity_id: 'schedule.hall_heating_2', platform: 'schedule', unique_id: 'hall_heating' },
        ];
      return undefined;
    });
    expect((await store.create('Hall heating', 'mdi:calendar-clock', EMPTY_WEEK)).entity).toBe(
      'schedule.hall_heating_2',
    );
  });

  it('writes a helper’s week with its name and icon kept: Home Assistant replaces what it is sent', async () => {
    const { store, callWS } = house((message) => ({ id: message['schedule_id'], ...message }));
    const item = { id: 'bedroom_heating', name: 'Bedroom heating', week: EMPTY_WEEK };
    await store.update(item, startWeek('comfort'));
    expect(callWS.mock.calls[0]?.[0]).toMatchObject({
      type: 'schedule/update',
      schedule_id: 'bedroom_heating',
      name: 'Bedroom heating',
      sunday: [{ from: '08:00:00', to: '23:00:00', data: { preset: 'comfort' } }],
    });
    expect(callWS.mock.calls[0]?.[0]).not.toHaveProperty('icon');
  });

  it('asks a schedule entity’s week of the entity once where it is no helper of the collection, and says when it is settled', async () => {
    const { store, callWS } = house(
      (message) => {
        if (message['type'] === 'config/entity_registry/get') return { unique_id: 'study' };
        if (message['type'] === 'call_service')
          return { response: { 'schedule.study': helperDays(startWeek('eco')) } };
        return undefined;
      },
      true,
      false,
    );
    expect(store.settled('schedule.study')).toBe(false);
    // the collection cannot be heard here: every week is asked of its entity
    store.subscribe(() => undefined);
    await new Promise((resolve) => setTimeout(resolve));
    await store.load('schedule.study');
    await store.load('schedule.study');
    expect(store.week('schedule.study')?.monday).toHaveLength(2);
    expect(store.settled('schedule.study')).toBe(true);
    expect(callWS.mock.calls.filter((call) => call[0]['type'] === 'call_service')).toHaveLength(1);
    expect(store.helper('schedule.study')).toBeUndefined();
  });

  it('reads a helper again as Home Assistant holds it now, whatever was heard, and forgets one that is gone', async () => {
    let listed = [
      { id: 'bedroom_heating', name: 'Bedroom heating', ...helperDays(startWeek('eco')) },
    ];
    const { store } = house((message) => {
      if (message['type'] === 'config/entity_registry/get') return { unique_id: 'bedroom_heating' };
      if (message['type'] === 'schedule/list') return listed;
      return undefined;
    });
    await store.load('schedule.bedroom_heating');
    expect((await store.reread('schedule.bedroom_heating'))?.week.monday).toHaveLength(2);
    expect(store.helper('schedule.bedroom_heating')?.week.monday).toHaveLength(2);
    listed = [];
    expect(await store.reread('schedule.bedroom_heating')).toBeUndefined();
    expect(store.helper('schedule.bedroom_heating')).toBeUndefined();
  });
});
