import { describe, expect, it } from 'vitest';
import type { EnergyPrefs } from '../energy-model/prefs.js';
import { findEnergyRoles } from './energy-roles.js';
import { HomeRegistry } from './home-registry.js';

/** A reading of that class, as Home Assistant hands it over, of that integration where one is named. */
const reading = (
  id: string,
  friendly_name: string,
  state: string,
  device_class: 'power' | 'energy',
  platform?: string,
) => ({ id, friendly_name, state, device_class, platform });

/** A house of those readings, nothing else, with the energy dashboard's preferences where it has them. */
function roles(readings: readonly ReturnType<typeof reading>[], prefs: EnergyPrefs | null = null) {
  const home = new HomeRegistry({
    states: Object.fromEntries(
      readings.map(({ id, friendly_name, state, device_class }) => [
        id,
        {
          entity_id: id,
          state,
          attributes: {
            friendly_name,
            device_class,
            state_class: device_class === 'energy' ? 'total_increasing' : 'measurement',
            unit_of_measurement: device_class === 'energy' ? 'kWh' : 'W',
          },
          last_changed: '',
          last_updated: '',
          context: { id: '', parent_id: null, user_id: null },
        },
      ]),
    ),
    entities: Object.fromEntries(
      readings.map(({ id, platform }) => [
        id,
        { entity_id: id, ...(platform ? { platform } : {}) },
      ]),
    ),
    devices: {},
    areas: {},
    language: 'en',
  } as never);
  return findEnergyRoles(home, prefs);
}

describe('findEnergyRoles — a forecast is not a reading (#170)', () => {
  it('takes the day’s counter for today’s production over a forecast also named for the sun and today', () => {
    expect(
      roles([
        reading(
          'sensor.solcast_pv_forecast_forecast_today',
          'Solcast PV Forecast Forecast today',
          '85.3',
          'energy',
        ),
        reading('sensor.today_pv_yield', 'Today PV yield', '48.1', 'energy'),
      ]).solarToday,
    ).toBe('sensor.today_pv_yield');
  });

  it('takes no forecast for today’s production, even where the house has nothing else', () => {
    for (const forecast of [
      reading('sensor.solar_forecast_today', 'Solar forecast today', '85.3', 'energy'),
      reading('sensor.solar_forecast_next_hour', 'Solar forecast next hour', '13.3', 'energy'),
      // Forecast.Solar's, whose name says no forecast: its integration does
      reading(
        'sensor.energy_production_today',
        'Solar Estimated energy production - today',
        '31.0',
        'energy',
        'forecast_solar',
      ),
      // Solcast's, by its integration
      reading('sensor.solar_today_estimate', 'Solar today', '30.2', 'energy', 'solcast_solar'),
    ])
      expect(roles([forecast]).solarToday, forecast.id).toBeUndefined();
  });

  it('reads a forecast in every language the words cover, never as the sun’s', () => {
    const forecasts = [
      reading('sensor.pv_prognose_heute', 'PV Prognose heute', '20', 'energy'),
      reading('sensor.produccion_solar_hoy', 'Previsión producción solar hoy', '20', 'energy'),
      reading(
        'sensor.production_solaire',
        'Prévision production solaire aujourd’hui',
        '20',
        'energy',
      ),
      reading('sensor.taiyoukou_yosoku', '太陽光発電 予測 今日', '20', 'energy'),
      reading('sensor.guangfu_yuce', '光伏 今日 预测发电量', '20', 'energy'),
      reading('sensor.solnechnaya', 'Прогноз солнечной генерации сегодня', '20', 'energy'),
    ];
    for (const forecast of forecasts)
      expect(roles([forecast]).solarToday, forecast.friendly_name).toBeUndefined();
  });

  it('never takes a forecast of power for the sun’s, the grid’s, the battery’s or the house’s', () => {
    const found = roles([
      reading(
        'sensor.solcast_pv_forecast_power_now',
        'Solcast PV Forecast Power now',
        '2100',
        'power',
      ),
      reading('sensor.solar_power_forecast', 'Solar power forecast', '2400', 'power'),
      reading('sensor.grid_power_forecast', 'Grid power forecast', '300', 'power'),
      reading('sensor.house_load_prediction', 'House load prediction', '800', 'power'),
      reading('sensor.inverter_power', 'Inverter power', '1900', 'power'),
    ]);
    expect(found).toMatchObject({
      solarPowers: [{ id: 'sensor.inverter_power' }],
      gridPower: undefined,
      homePower: undefined,
    });
  });

  it('reads a day’s counter in Chinese and Japanese by its words, never yesterday’s nor a lifetime’s (#170)', () => {
    const day = (id: string, name: string) => reading(id, name, '18.6', 'energy');
    // an inverter's day beside its lifetime, as Chinese integrations name them
    expect(
      roles([
        day('sensor.inverter_e1_leiji', '逆变器 E1 累计发电量'),
        day('sensor.inverter_e1_ri', '逆变器 E1 日发电总量'),
      ]).solarToday,
    ).toBe('sensor.inverter_e1_ri');
    for (const name of ['光伏日发电量', '逆变器 日总发电量', '太阳能 每日发电量'])
      expect(roles([day('sensor.pv_ri', name)]).solarToday, name).toBe('sensor.pv_ri');
    for (const name of [
      '逆变器 昨日发电量',
      '逆变器 累计发电量',
      '光伏 月发电量',
      '逆变器 明日发电量',
    ])
      expect(roles([day('sensor.pv_ri', name)]).solarToday, name).toBeUndefined();
    // and as Japanese ones do
    for (const name of ['太陽光 日発電量', 'パワコン 日間発電量'])
      expect(roles([day('sensor.pv_hi', name)]).solarToday, name).toBe('sensor.pv_hi');
    for (const name of ['太陽光 前日発電量', '太陽光 昨日発電量', '太陽光 積算発電量'])
      expect(roles([day('sensor.pv_hi', name)]).solarToday, name).toBeUndefined();
  });

  it('takes the energy dashboard’s solar meter for today’s production first, then the day’s counter', () => {
    const house = [
      reading('sensor.inverter_total_yield', 'Inverter total yield', '9120', 'energy'),
      reading('sensor.pv_today', 'PV today', '48.1', 'energy'),
    ];
    const prefs: EnergyPrefs = {
      energy_sources: [{ type: 'solar', stat_energy_from: 'sensor.inverter_total_yield' }],
    };
    expect(roles(house, prefs).solarToday).toBe('sensor.inverter_total_yield');
    expect(roles(house).solarToday).toBe('sensor.pv_today');
    // a meter the house no longer has is none
    expect(roles(house.slice(1), prefs).solarToday).toBe('sensor.pv_today');
  });

  it('takes every array’s meter the energy dashboard names, in its order, for today’s production (#183)', () => {
    const house = [
      reading('sensor.e1_energy', 'Inverter E1 累计发电量', '9120', 'energy'),
      reading('sensor.e2_energy', 'Inverter E2 累计发电量', '8450', 'energy'),
    ];
    const prefs: EnergyPrefs = {
      energy_sources: [
        { type: 'solar', stat_energy_from: 'sensor.e1_energy' },
        { type: 'grid', stat_energy_from: 'sensor.grid_in' },
        { type: 'solar', stat_energy_from: 'sensor.e2_energy' },
        { type: 'solar', stat_energy_from: 'sensor.gone_energy' },
      ],
    };
    expect(roles(house, prefs)).toMatchObject({
      solarToday: 'sensor.e1_energy',
      solarMeters: ['sensor.e1_energy', 'sensor.e2_energy'],
    });
    expect(roles(house).solarMeters).toEqual([]);
  });

  it('keeps a meter a utility imports, with its list’s kind, where an entity the house no longer has is left (#181)', () => {
    const prefs: EnergyPrefs = {
      energy_sources: [
        { type: 'water', stat_energy_from: 'sensor.gone_water' },
        { type: 'gas', stat_energy_from: 'opower:pge_gas' },
      ],
    };
    expect(roles([], prefs).meters).toEqual([{ entity: 'opower:pge_gas', kind: 'gas' }]);
  });
});
