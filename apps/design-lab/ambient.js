/* Ambient family: weather, sensors, binary sensors, presence, area, scenes, confirm sheet, toast. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const { G } = F;
  const card = (mode, body, cls = '') =>
    `<article class="fv-frame fv-card am-card ${cls}" data-frame data-mode="${mode}" data-palette="linen" data-card>${body}</article>`;

  /* Weather is a hero variant: no standard header; the condition uses the hero icon circle (64 / 32) */
  const weatherCard = () =>
    card(
      'light',
      `<div class="am-weather__hero">
      <div class="am-weather__now">${F.readout({ label: 'Outside · Clear', value: '18', unit: '°C', size: 'l', group: 'w' })}<p class="fv-card__sub">Feels 16° · Wind 12 km/h NW</p></div>
      ${F.ico('sun', 'solar').replace('fv-ico ', 'fv-ico fv-ico--hero ')}
    </div>
    <div class="am-hours">${[
      ['Now', 'sun', '18°'],
      ['22', 'sun', '16°'],
      ['23', 'cloud', '15°'],
      ['00', 'cloud', '14°'],
      ['01', 'rain', '13°'],
    ]
      .map(
        ([t, g, v]) =>
          `<div class="am-hour"><span class="am-hour__t">${t}</span>${G[g]}<span class="am-hour__v">${v}</span></div>`,
      )
      .join('')}</div>
    <div class="am-days">
      ${F.listRow({ glyph: 'sun', title: 'Friday', sub: 'Sunny', trailing: 'value', value: '23° / 12°', tone: 'neutral' })}
      ${F.listRow({ glyph: 'cloud', title: 'Saturday', sub: 'Cloudy', trailing: 'value', value: '20° / 13°', tone: 'neutral' })}
      ${F.listRow({ glyph: 'rain', title: 'Sunday', sub: 'Showers · 60 %', trailing: 'value', value: '17° / 11°', tone: 'neutral' })}
    </div>`,
    );

  /* sensor tiles: 44 head + 12 + 48 readout + 8 + 24 spark = 136 → 168 with padding; the spark is inset 4 px so the end dot is whole */
  const spark = (values, id, cls = '') =>
    `<div class="am-spark ${cls}">${F.curve(values, { w: 140, h: 24, pad: 4, padX: 4, id })}</div>`;
  const sensorsFrame = () => `
<div class="fv-frame am-sensors" data-frame data-mode="light" data-palette="linen">
  <div class="fv-grid2">
    <article class="fv-tile" data-card><div class="fv-tile__head">${F.ico('thermo', 'heat')}<span class="fv-trend am-tile__trend">${G.trendUp}</span></div>${F.readout({ label: 'Temperature', value: '21.4', unit: '°C', group: 't' })}${spark([20.1, 20.4, 20.9, 21.5, 21.2, 21.4], 'am-s1', 'fv-tone--heat')}</article>
    <article class="fv-tile" data-card><div class="fv-tile__head">${F.ico('drop', 'water')}<span class="fv-trend fv-trend--down am-tile__trend">${G.trendDown}</span></div>${F.readout({ label: 'Humidity', value: '46', unit: '%', group: 'h' })}${spark([52, 50, 49, 47, 48, 46], 'am-s2', 'fv-tone--water')}</article>
  </div>
  <article class="fv-card am-wide" data-card>
    ${F.head({ glyph: 'thermo', tone: 'heat', title: 'Living room', sub: 'Temperature · last 24 h', trailing: F.round('dots', 'fv-round--quiet', 'More') })}
    <div class="am-chart fv-tone--heat">${F.curve([19.8, 19.5, 19.2, 19.4, 20.2, 21.1, 21.8, 22.4, 22.0, 21.6, 21.2, 21.4, 21.4], { extent: (21 * 60 + 47) / (24 * 60), padTop: 44, id: 'am-c1' })}${F.bubble(((21 * 60 + 47) / (24 * 60)) * 320, '21.4', ' °C')}</div>
    ${F.axis(
      [
        [0, '00:00'],
        [0.25, '06:00'],
        [0.5, '12:00'],
        [0.75, '18:00'],
        [1, '24:00'],
      ],
      320,
    )}
    <div class="am-cols fv-cols">${F.readout({ label: 'Min', value: '19.2', unit: '°C', size: 's', group: 'm' })}${F.readout({ label: 'Max', value: '22.4', unit: '°C', size: 's', group: 'm' })}${F.readout({ label: 'Average', value: '20.9', unit: '°C', size: 's', group: 'm' })}</div>
  </article>
</div>`;

  /* Openings: header counts what is open (warning tone); rows carry the state once, the time in the sub; a see-all row */
  const binaryCard = () =>
    card(
      'light',
      F.head({
        glyph: 'door',
        tone: 'warning',
        title: 'Openings & motion',
        sub: '6 sensors · 2 rooms',
        trailing: F.badge('1 open', 'warning'),
      }) +
        `<div class="am-rows">${F.listRow({ glyph: 'door', title: 'Front door', sub: '2 h ago', trailing: 'value', value: 'Closed', tone: 'neutral' })}${F.listRow({ glyph: 'blinds', title: 'Kitchen window', sub: '14 min', trailing: 'value', value: 'Open', tone: 'warning', valueTone: 'warning' })}${F.listRow({ glyph: 'motion', title: 'Hallway motion', sub: '4 min ago', trailing: 'value', value: 'Clear', tone: 'neutral' })}${F.listRow({ glyph: 'drop', title: 'Kitchen leak', sub: 'Checked 21:40', trailing: 'value', value: 'Dry', tone: 'neutral' })}${F.listRow({ glyph: 'list', title: 'All sensors', sub: '2 more', trailing: 'chevron', tone: 'neutral' })}</div>`,
    );

  const presenceCard = () =>
    card(
      'light',
      F.head({
        glyph: 'person',
        tone: 'accent',
        title: 'Who is home',
        sub: '2 of 3 · updated now',
        trailing: F.round('map', 'fv-round--quiet', 'Map'),
      }) +
        `<div class="am-people fv-cols">${[
          ['Marta', 'Home · 18:40', 'home'],
          ['Pau', 'Home · 19:05', 'home'],
          ['Ona', 'Away · school', 'away'],
        ]
          .map(
            ([n, s, st]) =>
              `<div class="am-person"><span class="am-avatar ${st === 'home' ? 'is-home' : ''}" data-icon><i class="am-avatar__dot"></i></span><span class="am-person__name">${n}</span><span class="am-person__state">${s}</span></div>`,
          )
          .join('')}</div>`,
    );

  /* Area: domain summaries are navigation rows (icon circle filled = something on), not a mode selector */
  const areaCard = () =>
    card(
      'light',
      `<div class="am-area__hero"><span class="am-area__badge" style="width:152px">${G.home}Living room</span></div>
    <div class="am-area__stats">${F.readout({ label: 'Temperature', value: '21.4', unit: '°C', group: 'a' })}${F.readout({ label: 'Humidity', value: '46', unit: '%', group: 'a' })}${F.readout({ label: 'Devices on', value: '4', unit: 'of 9', group: 'a' })}</div>
    <div class="am-rows">${F.listRow({ glyph: 'bulb', title: 'Lights', sub: '3 of 5 on', trailing: 'chevron', tone: 'light' })}${F.listRow({ glyph: 'thermo', title: 'Climate', sub: 'Heating to 21.5°', trailing: 'chevron', tone: 'heat' })}${F.listRow({ glyph: 'speaker', title: 'Media', sub: 'Idle', trailing: 'chevron', tone: 'neutral' })}${F.listRow({ glyph: 'grid', title: 'All devices', sub: '2 unavailable', trailing: 'chevron', tone: 'neutral' })}</div>`,
      'am-card--area',
    );

  const scenesFrame = () => `
<div class="fv-frame am-scenes" data-frame data-mode="light" data-palette="linen">
  <div class="fv-grid2">${[
    ['sun', 'Morning', '7 devices', 'accent', true],
    ['film', 'Cinema', '4 devices', 'neutral', false],
    ['moon', 'Night', 'All off', 'neutral', false],
    ['away', 'Away', 'Lock & arm', 'neutral', false],
  ]
    .map(
      ([g, n, m, , on]) =>
        `<button class="fv-tile am-scene ${on ? 'is-on fv-tile--accent' : ''}" data-card data-target>${F.ico(g, on ? 'accent' : 'neutral')}<span class="fv-row__text"><span class="fv-row__title">${n}</span><span class="fv-row__sub">${m}</span></span></button>`,
    )
    .join('')}</div>
</div>`;

  /* confirm sheet: hero icon (64) with the action's glyph — ⚠ stays reserved for alerts */
  const confirmSheet = () => `
<div class="fv-frame fv-sheet am-sheet" data-frame data-mode="light" data-palette="linen">
  <div class="fv-sheet__grabber"><span></span></div>
  <div class="am-confirm">${F.ico('power', 'accent').replace('fv-ico ', 'fv-ico fv-ico--hero ')}<h2 class="am-confirm__title">Turn off all lights?</h2><p class="fv-card__sub am-confirm__sub">7 lights in 4 rooms will switch off. The porch light is unavailable and will be skipped.</p></div>
  <div class="am-actions">${F.button('Cancel', 'quiet', 172)}${F.button('Turn off', 'accent', 172)}</div>
</div>`;

  const toasts = () => `
<div class="fv-frame am-toasts" data-frame data-mode="light" data-palette="linen">
  <div class="am-toast">${F.ico('check', 'accent')}<span class="fv-row__text"><span class="fv-row__title">Morning scene applied</span><span class="fv-row__sub">7 devices · just now</span></span>${F.button('Undo', 'link')}</div>
  <div class="am-toast am-toast--warn">${F.ico('warn', 'warning')}<span class="fv-row__text"><span class="fv-row__title">Porch light offline</span><span class="fv-row__sub">Retrying · check power</span></span>${F.button('Details', 'link')}</div>
</div>`;

  globalThis.renderAmbient = (root) => {
    root.innerHTML =
      weatherCard() +
      sensorsFrame() +
      binaryCard() +
      presenceCard() +
      areaCard() +
      scenesFrame() +
      confirmSheet() +
      toasts();
  };
})();
