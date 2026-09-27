/* Solar & sensors set: production gauge, capacity with stat tiles, hourly production, strings & inverter,
   distribution, humidity, plants. Round 6. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const card = (mode, body, cls = '') =>
    `<article class="fv-frame fv-card so-card ${cls}" data-frame data-mode="${mode}" data-palette="linen" data-card>${body}</article>`;

  /* 1 · production gauge: the tick ring lit to the current fraction, value in the open centre, min/max/avg below */
  const gaugeCard = (mode = 'light') =>
    card(
      mode,
      F.head({
        glyph: 'sun',
        tone: 'solar',
        title: 'Solar power',
        sub: 'South roof · 5.4 kWp',
        trailing: F.badge('Producing', 'solar'),
      }) +
        `<div class="so-gauge">${F.dial({ R: 96, tick: 12, large: true, disc: false, tone: 'solar', min: 0, max: 5.4, from: 0, to: 3.2 / 5.4, value: '3.2', unit: 'kW', label: 'Power', stepper: false, minLabel: '0.0', maxLabel: '5.4' })}</div>` +
        `<div class="so-cols fv-cols so-cols--center" data-align="center">${F.readout({ label: 'Min', value: '0.4', unit: 'kW', size: 's', group: 'g' })}${F.readout({ label: 'Max', value: '4.1', unit: 'kW', size: 's', group: 'g' })}${F.readout({ label: 'Average', value: '1.4', unit: 'kW', size: 's', group: 'g' })}</div>`,
    );

  /* 2 · capacity: performance badge, four stat tiles (the option anatomy, read-only) */
  const capacityCard = () =>
    card(
      'light',
      F.head({
        glyph: 'bolt',
        tone: 'solar',
        title: 'Total capacity',
        sub: '18 panels · 5.4 kWp',
        trailing: F.badge('Health 92 %', 'solar'),
      }) +
        `<div class="so-tiles">${F.tiles(
          [
            { label: 'Solar output', value: '3.2 kW', glyph: 'sun', tone: 'solar', active: true },
            { label: 'Grid export', value: '0.25 kW', glyph: 'bolt', tone: 'grid' },
          ],
          156,
          84,
          320,
        )}${F.tiles(
          [
            { label: 'Self-use', value: '88 %', glyph: 'home', tone: 'accent' },
            { label: 'To battery', value: '1.1 kW', glyph: 'battery', tone: 'water' },
          ],
          156,
          84,
          320,
        )}</div>` +
        `<div class="so-rows">${F.listRow({ glyph: 'leaf', title: 'CO₂ avoided', sub: 'This month', trailing: 'value', value: '142 kg', tone: 'neutral' })}</div>`,
    );

  /* 3 · production today: 24 hourly bars, forecast remainder in page-alt, readouts */
  const bars = () => {
    /* kWh per hour; 14:10 now → hour 14 is 10 min in. produced Σ = 11.2 (+6 % on the forecast's 10.55), forecast Σ = 18.4 */
    const produced = [
      0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.5, 1.0, 1.5, 2.0, 2.9, 2.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    const forecast = [
      0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.45, 0.9, 1.4, 1.9, 2.7, 2.4, 2.5, 2.0, 1.6, 1.2, 0.7, 0.3, 0, 0,
      0, 0,
    ];
    const max = 3;
    return (
      `<div class="so-bars">` +
      produced
        .map((v, i) => {
          const f = forecast[i];
          const fh = Math.round(((f / max) * 80) / 4) * 4;
          const ph = Math.round(((v / max) * 80) / 4) * 4;
          return `<span class="so-bar"><span class="so-bar__forecast" data-measure="value" style="height:${fh}px"></span><span class="so-bar__fill" data-measure="value" style="height:${ph}px"></span></span>`;
        })
        .join('') +
      `</div>`
    );
  };
  const productionCard = () =>
    card(
      'light',
      F.head({
        glyph: 'sun',
        tone: 'solar',
        title: 'Production',
        sub: 'Today · vs forecast',
        trailing: F.badge('+6 %', 'solar'),
      }) +
        `<div class="so-top fv-value-row">${F.readout({ label: 'So far today', value: '11.2', unit: 'kWh', size: 'l', group: 'p' })}<div class="so-top__side">${F.readout({ label: 'Forecast', value: '18.4', unit: 'kWh', size: 's', group: 'p' })}</div></div>` +
        bars() +
        F.axis(
          [
            [0, '00:00'],
            [0.25, '06:00'],
            [0.5, '12:00'],
            [0.75, '18:00'],
            [1, '24:00'],
          ],
          320,
        ) +
        `<div class="so-cols fv-cols">${F.readout({ label: 'Peak', value: '4.1', unit: 'kW', size: 's', group: 'pk' })}${F.readout({ label: 'Peak at', value: '12:50', size: 's', group: 'pk' })}${F.readout({ label: 'Sun hours', value: '7.4', unit: 'h', size: 's', group: 'pk' })}</div>`,
    );

  /* 4 · strings & inverter: one bar row per string, inverter row with temperature and efficiency */
  const stringsCard = () =>
    card(
      'light',
      F.head({
        glyph: 'sliders',
        tone: 'solar',
        title: 'Strings & inverter',
        sub: 'SolarEdge · 3 strings',
        trailing: F.badge('1 shaded', 'warning'),
      }) +
        `<div class="so-rows">
      ${F.barRow({ glyph: 'sun', tone: 'solar', title: 'East', sub: '6 panels · 38 °C', value: '1.4 kW', fraction: 0.78, barTone: 'solar' })}
      ${F.barRow({ glyph: 'sun', tone: 'solar', title: 'South', sub: '8 panels · 41 °C', value: '1.5 kW', fraction: 0.62, barTone: 'solar' })}
      ${F.barRow({ glyph: 'sun', tone: 'warning', title: 'West', sub: '4 panels · shaded until 14:30', value: '0.3 kW', fraction: 0.22, barTone: 'warning', valueTone: 'warning' })}
      ${F.listRow({ glyph: 'bolt', title: 'Inverter', sub: '41 °C · 97 % efficiency', trailing: 'value', value: '3.2 kW', tone: 'solar' })}
    </div>`,
    );

  /* 5 · distribution: stacked bar of what is drawing now, legend with square swatches */
  const distributionCard = () =>
    card(
      'light',
      F.head({
        glyph: 'plug',
        tone: 'accent',
        title: 'Distribution',
        sub: 'Drawing now',
        trailing: F.badge('2.5 kW', 'accent'),
      }) +
        F.stack([
          { label: 'Heat pump', display: '0.9 kW', value: 0.9, tone: 'heat' },
          { label: 'Dishwasher', display: '1.4 kW', value: 1.4, tone: 'accent' },
          { label: 'Media', display: '0.1 kW', value: 0.1, tone: 'media' },
          { label: 'Fridge', display: '0.1 kW', value: 0.1, tone: 'water' },
        ]),
    );

  /* 6 · humidity: big readout, comfort band on a marker ruler, dew point and trend */
  const humidityCard = () =>
    card(
      'light',
      F.head({
        glyph: 'humid',
        tone: 'water',
        title: 'Humidity',
        sub: 'Living room',
        trailing: F.badge('Comfortable', 'water'),
      }) +
        `<div class="so-top fv-value-row">${F.readout({ label: 'Relative humidity', value: '46', unit: '%', size: 'l', group: 'h' })}<div class="so-top__side">${F.readout({ label: 'Dew point', value: '9.4', unit: '°C', size: 's', group: 'h' })}</div></div>` +
        `<div class="so-band"><span class="so-band__zone" style="left:92px;width:104px"></span>${F.ruler({ w: 320, h: 44, value: 0.46, tone: 'water', marker: true })}</div>` +
        F.rulerLabels(
          [
            [0, 'Dry'],
            [0.3, '30'],
            [0.6, '60'],
            [1, 'Humid'],
          ],
          320,
        ) +
        `<div class="so-rows">${F.listRow({ glyph: 'trendUp', title: 'Trend', sub: 'Last 6 h', trailing: 'value', value: '+3 %', tone: 'neutral' })}${F.listRow({ glyph: 'humid', title: 'Humidifier', sub: 'Living room · 50 %', trailing: 'switch', on: true, tone: 'water' })}</div>`,
    );

  /* 7 · plants: soil moisture per plant, the dry one in warning */
  const plantsCard = () =>
    card(
      'light',
      F.head({
        glyph: 'leaf',
        tone: 'accent',
        title: 'Plants',
        sub: '4 plants · Living room',
        trailing: F.badge('1 dry', 'warning'),
      }) +
        `<div class="so-rows">
      ${F.barRow({ glyph: 'leaf', tone: 'neutral', title: 'Monstera', sub: 'Watered 3 days ago', value: '62 %', fraction: 0.62, barTone: 'water' })}
      ${F.barRow({ glyph: 'leaf', tone: 'warning', title: 'Ficus', sub: 'Water today', value: '18 %', fraction: 0.18, barTone: 'warning', valueTone: 'warning' })}
      ${F.barRow({ glyph: 'leaf', tone: 'neutral', title: 'Basil', sub: 'Watered yesterday', value: '45 %', fraction: 0.45, barTone: 'water' })}
      ${F.barRow({ glyph: 'leaf', tone: 'neutral', title: 'Olive', sub: 'Watered 6 days ago', value: '38 %', fraction: 0.38, barTone: 'water' })}
    </div>`,
    );

  globalThis.renderSolar = (root) => {
    root.innerHTML =
      gaugeCard('light') +
      capacityCard() +
      productionCard() +
      stringsCard() +
      distributionCard() +
      humidityCard() +
      plantsCard() +
      gaugeCard('dark');
  };
})();
