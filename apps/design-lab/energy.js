/* Energy family on fluvy primitives: flow diagram, today, solar, battery, water & gas, appliances, dark. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const NOW = (21 * 60 + 47) / (24 * 60); // 21:47 on the 24 h axis (same clock as the Home sheet)

  /* flow diagram: sources stacked on the left, the house on the right; every link carries an arrowhead at its
     destination, so direction reads in a still (the real card animates the dashes the same way).
     Battery is charging → its link runs house → battery. */
  const flow = () => {
    const nodes = [
      {
        y: 22,
        glyph: 'sun',
        tone: 'solar',
        label: 'Solar',
        value: '3.2 kW',
        cls: 'solar',
        dir: 'in',
      },
      {
        y: 102,
        glyph: 'bolt',
        tone: 'grid',
        label: 'Grid',
        value: '0.4 kW',
        cls: 'grid',
        dir: 'in',
      },
      {
        y: 182,
        glyph: 'battery',
        tone: 'water',
        label: 'Battery · 78 %',
        value: '1.1 kW',
        cls: 'water',
        dir: 'out',
      },
    ];
    const house = { x: 298, y: 102 };
    /* contact points 6 px off the 22 ring (r = 28): solar meets it at −40°, grid at 180°, battery leaves at +40° */
    const R = 28;
    const at = (deg) => [
      house.x - R * Math.cos((deg * Math.PI) / 180),
      house.y + R * Math.sin((deg * Math.PI) / 180),
    ];
    const contact = { solar: at(-40), grid: at(0), water: at(40) };
    const defs = ['solar', 'grid', 'water']
      .map(
        (c) =>
          `<marker id="ef-arrow-${c}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M1.5 1 6.5 4 1.5 7" class="ef-arrow ef-arrow--${c}"/></marker>`,
      )
      .join('');
    const links = nodes
      .map((n) => {
        const [ex, ey] = contact[n.cls];
        return n.dir === 'in'
          ? `<path d="M176,${n.y} C220,${n.y} ${(ex - 36).toFixed(1)},${ey.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" class="ef-link ef-link--${n.cls}" stroke-dasharray="6 8" marker-end="url(#ef-arrow-${n.cls})"/>`
          : `<path d="M${ex.toFixed(1)},${ey.toFixed(1)} C${(ex - 36).toFixed(1)},${ey.toFixed(1)} 220,${n.y} 176,${n.y}" class="ef-link ef-link--${n.cls}" stroke-dasharray="6 8" marker-end="url(#ef-arrow-${n.cls})"/>`;
      })
      .join('');
    const nodeEls = nodes
      .map(
        (n) =>
          `<div class="ef-node" style="left:0;top:${n.y - 22}px">${F.ico(n.glyph, n.tone)}</div>` +
          `<div class="ef-node__text" style="left:56px;top:${n.y - 18}px"><span class="ef-node__label">${n.label}</span><span class="ef-node__value">${n.value}</span></div>`,
      )
      .join('');
    const houseEl =
      `<div class="ef-node ef-node--house" style="left:${house.x - 22}px;top:${house.y - 22}px">${F.ico('home', 'accent')}</div>` +
      `<div class="ef-node__text ef-node__text--house" style="right:0;top:${house.y + 30}px"><span class="ef-node__label">House</span><span class="ef-node__value">2.5 kW</span></div>`;
    return `<div class="ef-stage"><svg width="320" height="204" viewBox="0 0 320 204" aria-hidden="true"><defs>${defs}</defs>${links}</svg>${nodeEls}${houseEl}</div>`;
  };

  const card = (mode, body, extraClass = '') =>
    `<article class="fv-frame fv-card ef-card ${extraClass}" data-frame data-mode="${mode}" data-palette="linen" data-card>${body}</article>`;

  /* below the diagram: what it cannot show — today's totals */
  const flowCard = (mode = 'light') =>
    card(
      mode,
      F.head({
        glyph: 'bolt',
        tone: 'solar',
        title: 'Energy flow',
        sub: 'Live · 5 s ago',
        trailing: F.badge('84 % solar', 'solar'),
      }) +
        flow() +
        `<div class="ef-cols fv-cols">${F.readout({ label: 'Self-use', value: '88', unit: '%', size: 's', group: 'f' })}${F.readout({ label: 'Exported', value: '1.3', unit: 'kWh', size: 's', group: 'f' })}${F.readout({ label: 'Imported', value: '4.1', unit: 'kWh', size: 's', group: 'f' })}</div>`,
    );

  const todayCard = () =>
    card(
      'light',
      F.head({
        glyph: 'home',
        tone: 'accent',
        title: 'Consumption',
        sub: 'Today · vs yesterday',
        trailing: F.badge('−12 %', 'accent'),
      }) +
        `<div class="ef-top fv-value-row">${F.readout({ label: 'So far today', value: '9.8', unit: 'kWh', size: 'l', group: 'kwh' })}${F.badge('2.34 € today', 'accent').replace('fv-badge ', 'fv-badge ef-cost ')}</div>` +
        `<div class="ef-chart">${F.curve([0.6, 0.4, 0.3, 0.3, 0.5, 1.4, 2.1, 1.6, 1.2, 1.9, 2.8, 2.2, 2.5], { extent: NOW, padTop: 44, id: 'ef-fill-1' })}${F.bubble(NOW * 320, '2.5', ' kW')}</div>` +
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
        `<div class="ef-cols fv-cols">${F.readout({ label: 'Grid', value: '4.1', unit: 'kWh', size: 's', group: 'l' })}${F.readout({ label: 'Solar', value: '5.7', unit: 'kWh', size: 's', group: 'l' })}${F.readout({ label: 'Peak', value: '2.8', unit: 'kW', size: 's', group: 'l' })}</div>`,
    );

  /* a daytime moment: 14:10 on a 06:00–18:00 axis; the line ends at "now" = the RIGHT NOW readout */
  const SOLAR_NOW = (14 * 60 + 10 - 6 * 60) / (12 * 60);
  const solarCard = () =>
    card(
      'light',
      F.head({
        glyph: 'sun',
        tone: 'solar',
        title: 'Solar',
        sub: 'South roof · 5.4 kWp',
        trailing: F.badge('Producing', 'solar'),
      }) +
        `<div class="ef-top fv-value-row">${F.readout({ label: 'Right now', value: '3.2', unit: 'kW', size: 'l', group: 's' })}<div class="ef-top__side">${F.readout({ label: 'Today', value: '11.2', unit: 'kWh', size: 's', group: 's' })}</div></div>` +
        `<div class="ef-chart ef-chart--solar">${F.curve([0, 0.1, 0.3, 0.8, 1.5, 2.2, 2.9, 3.4, 3.8, 4.0, 4.1, 3.8, 3.2], { extent: SOLAR_NOW, padTop: 44, id: 'ef-fill-2' })}${F.bubble(SOLAR_NOW * 320, '3.2', ' kW')}</div>` +
        F.axis(
          [
            [0, '06:00'],
            [0.25, '09:00'],
            [0.5, '12:00'],
            [0.75, '15:00'],
            [1, '18:00'],
          ],
          320,
        ) +
        `<div class="ef-cols fv-cols">${F.readout({ label: 'Peak', value: '4.1', unit: 'kW', size: 's', group: 'p' })}${F.readout({ label: 'Peak at', value: '12:50', size: 's', group: 'p' })}${F.readout({ label: 'This month', value: '286', unit: 'kWh', size: 's', group: 'p' })}</div>`,
    );

  const batteryCard = () =>
    card(
      'light',
      F.head({
        glyph: 'battery',
        tone: 'water',
        title: 'Battery',
        sub: 'Garage · 10 kWh',
        trailing: F.badge('Charging', 'water'),
      }) +
        `<div class="ef-top fv-value-row">${F.readout({ label: 'State of charge', value: '78', unit: '%', size: 'l', group: 'b' })}<div class="ef-top__side">${F.readout({ label: 'Full in', value: '2 h', size: 's', group: 'b' })}</div></div>` +
        `<div class="ef-gauge">${F.ruler({ w: 320, h: 44, value: 0.78, tone: 'water', marker: true })}</div>` +
        F.rulerLabels(
          [
            [0, '0'],
            [0.25, '25'],
            [0.5, '50'],
            [0.75, '75'],
            [1, '100'],
          ],
          320,
        ) +
        F.label('Mode') +
        F.options(
          [
            { label: 'Auto', value: 'Solar first', tone: 'water', glyph: 'auto', active: true },
            { label: 'Charge', value: 'From grid', tone: 'grid', glyph: 'bolt' },
            { label: 'Hold', value: '20 %', tone: 'neutral', glyph: 'lock' },
          ],
          104,
        ),
    );

  const bar = (value, tone) =>
    `<span class="ef-bar"><span class="ef-bar__fill ef-bar__fill--${tone}" data-measure="value" style="width:${Math.round(value * 100)}%"></span></span>`;
  /* both below their typical day → both arrows point down (secondary ink; the bar carries the comparison) */
  const waterCard = () =>
    card(
      'light',
      F.head({
        glyph: 'drop',
        tone: 'water',
        title: 'Water & gas',
        sub: 'Today · vs typical day',
        trailing: F.round('dots', 'fv-round--quiet', 'More'),
      }) +
        `<div class="ef-meter">${F.readout({ label: 'Water', value: '84', unit: 'L', trend: 'trendDown', group: 'w' })}<div class="ef-meter__bars">${bar(0.56, 'water')}<span class="ef-meter__note" data-baseline="w">Typical 150 L</span></div></div>` +
        `<div class="ef-meter">${F.readout({ label: 'Gas', value: '2.7', unit: 'm³', trend: 'trendDown', group: 'g' })}<div class="ef-meter__bars">${bar(0.9, 'solar')}<span class="ef-meter__note" data-baseline="g">Typical 3.0 m³</span></div></div>` +
        `<div class="ef-rows">${F.listRow({ glyph: 'drop', title: 'Leak sensor', sub: 'Kitchen · checked 21:40', trailing: 'value', value: 'Dry', tone: 'neutral' })}${F.listRow({ glyph: 'sliders', title: 'Main valve', sub: 'Open', trailing: 'switch', on: true, tone: 'neutral' })}</div>`,
    );

  const appliancesCard = () =>
    card(
      'light',
      F.head({
        glyph: 'plug',
        tone: 'accent',
        title: 'Appliances',
        sub: 'Drawing now · 2.5 kW',
        trailing: F.badge('4 on', 'accent'),
      }) +
        `<div class="ef-rows">` +
        F.listRow({
          glyph: 'plug',
          title: 'Dishwasher',
          sub: 'Running · 42 min left',
          trailing: 'value',
          value: '1.4 kW',
          tone: 'accent',
        }) +
        F.listRow({
          glyph: 'thermo',
          title: 'Heat pump',
          sub: 'Heating',
          trailing: 'value',
          value: '0.9 kW',
          tone: 'heat',
        }) +
        F.listRow({
          glyph: 'speaker',
          title: 'Media',
          sub: 'Kitchen speaker',
          trailing: 'value',
          value: '0.1 kW',
          tone: 'media',
        }) +
        F.listRow({
          glyph: 'plug',
          title: 'Fridge',
          sub: 'Always on',
          trailing: 'value',
          value: '0.1 kW',
          tone: 'accent',
        }) +
        `</div>`,
    );

  globalThis.renderEnergy = (root) => {
    root.innerHTML =
      flowCard('light') +
      todayCard() +
      solarCard() +
      batteryCard() +
      waterCard() +
      appliancesCard() +
      flowCard('dark');
  };
})();
