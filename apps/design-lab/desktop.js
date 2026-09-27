/* Desktop composition: HA shell (sidebar + toolbar, themed by our tokens) and a sections dashboard of fluvy cards.
   1440 × 1024 frame: sidebar 256, toolbar 76, content 1184 with 32 padding → three 352 columns and 32 gaps (sections grid). */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const { G } = F;
  const NOW = (21 * 60 + 47) / (24 * 60);

  /* --- HA shell, drawn as HA draws it and only COLOURED by our tokens (sidebar surface/text/icon/selection,
         header background, tab indicator). The HA logo is a fixed image, the tabs are text with a selection bar,
         the toolbar buttons are bare icons, the nav items keep HA's geometry (40 high, radius 4, 12 % tint). --- */
  const HA_LOGO = `<svg class="dk-logo" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="#18bcf2" d="M12 2 2.5 11.2v10.3h7.2v-5.6h4.6v5.6h7.2V11.2Z"/><path fill="#ffffff" d="M12 7.4 8.8 10.6l.9.9L12 9.2l2.3 2.3.9-.9Z"/></svg>`;
  const sidebar = () => `
<aside class="dk-sidebar" data-measure="skip">
  <div class="dk-sidebar__brand">${HA_LOGO}<span class="dk-sidebar__title">Home Assistant</span></div>
  <nav class="dk-nav">
    ${[
      ['home', 'Home', true],
      ['bolt', 'Energy', false],
      ['map', 'Map', false],
      ['list', 'Logbook', false],
      ['clock', 'History', false],
      ['speaker', 'Media', false],
      ['check', 'To-do', false],
    ]
      .map(
        ([g, t, on]) =>
          `<button class="dk-nav__item ${on ? 'is-active' : ''}" data-control data-target>${G[g]}<span>${t}</span></button>`,
      )
      .join('')}
  </nav>
  <div class="dk-sidebar__foot">
    <button class="dk-nav__item" data-control data-target>${G.sliders}<span>Settings</span></button>
    <button class="dk-nav__item" data-control data-target><span class="dk-avatar"></span><span>Marta</span></button>
  </div>
</aside>`;

  /* dashboard title = the dashboard's name (as HA shows it); views are not panels: Overview · Rooms · Climate · Security */
  const toolbar = () => `
<header class="dk-toolbar">
  <h1 class="dk-toolbar__title" data-fit="0">Home</h1>
  <nav class="dk-tabs" aria-label="Views" data-measure="skip">${[
    ['Overview', true],
    ['Rooms', false],
    ['Climate', false],
    ['Security', false],
  ]
    .map(
      ([t, on]) =>
        `<button class="dk-tab ${on ? 'is-active' : ''}" data-control data-target data-fit="24">${t}</button>`,
    )
    .join('')}</nav>
  <div class="dk-toolbar__actions">${F.round('locate', 'dk-iconbtn', 'Search')}${F.round('dots', 'dk-iconbtn', 'More')}</div>
</header>`;

  /* --- cards (352 wide → content 312: tiles 152, rulers 312, options 3 × 96 + 2 × 12) --- */
  const tile = ({ glyph, name, state, on, kind, value, tone = 'accent' }) => {
    let foot = '';
    if (kind === 'light' || kind === 'cover')
      foot = F.ruler({
        w: 120,
        h: 44,
        value,
        tone: on ? tone : 'neutral',
        minor: 1 / 12,
        major: 1 / 4,
        active: on,
        knobSize: 28,
        className: on ? '' : 'fv-ruler--off',
      });
    if (kind === 'plug')
      foot = `<div class="fv-tile__foot">${F.readout({ label: 'Power', value: '142', unit: 'W', size: 'xs', group: 'plug' })}${F.readout({ label: 'Today', value: '1.2', unit: 'kWh', size: 'xs', group: 'plug' })}</div>`;
    return `<article class="fv-tile fv-tile--${tone} ${on ? 'is-on' : ''}" data-card><div class="fv-tile__head">${F.ico(glyph, on ? tone : 'accent')}${F.toggle(on, tone)}</div><h3 class="fv-tile__name">${name}</h3><p class="fv-tile__state">${state}</p>${foot}</article>`;
  };

  const helloCard = () => `
<article class="fv-card dk-hello" data-card>
  <div class="dk-hello__row"><div class="fv-card__titles"><h2 class="dk-hello__title">Good evening, Marta</h2><p class="fv-card__sub">Thursday 17 September · clear night</p></div>${F.ico('moon', 'accent')}</div>
  <div class="dk-hello__stats">${F.readout({ label: 'Outside', value: '18', unit: '°C', size: 's', group: 'hs' })}${F.readout({ label: 'Inside', value: '20.8', unit: '°C', size: 's', group: 'hs' })}${F.readout({ label: 'Power', value: '1.8', unit: 'kW', size: 's', group: 'hs' })}</div>
</article>`;

  const roomsCard = () => `
<article class="fv-card" data-card>
  ${F.head({ glyph: 'grid', tone: 'accent', title: 'Living room', sub: '4 devices · 3 on', trailing: F.round('chevron', 'fv-round--quiet', 'Open room') })}
  <div class="fv-grid2 dk-grid2">
    ${tile({ glyph: 'bulb', name: 'Ceiling', state: 'On · 70 %', on: true, kind: 'light', value: 0.7, tone: 'light' })}
    ${tile({ glyph: 'bulb', name: 'Reading', state: 'Off', on: false, kind: 'light', value: 0, tone: 'light' })}
    ${tile({ glyph: 'plug', name: 'Desk plug', state: 'On', on: true, kind: 'plug' })}
    ${tile({ glyph: 'blinds', name: 'Blinds', state: 'Open · 40 %', on: true, kind: 'cover', value: 0.4 })}
  </div>
</article>`;

  const thermostatCard = () => `
<article class="fv-card" data-card>
  ${F.head({ glyph: 'thermo', tone: 'heat', title: 'Thermostat', sub: 'Living room · 46 % RH', trailing: F.badge('Heating', 'heat') })}
  <div class="dk-dial">${F.dial({ R: 84, tick: 10, tone: 'heat', min: 15, max: 30, target: 21.5, current: 20.8, value: '21.5', unit: '°C', sub: 'Now 20.8°', minLabel: '15°', maxLabel: '30°' })}</div>
  ${F.label('Mode')}
  ${F.options(
    [
      { label: 'Heat', value: '21.5°', tone: 'heat', glyph: 'flame', active: true },
      { label: 'Cool', value: '24°', tone: 'cool', glyph: 'snow' },
      { label: 'Auto', value: 'Range', tone: 'accent', glyph: 'auto' },
    ],
    96,
    84,
    312,
  )}
</article>`;

  const energyCard = () => `
<article class="fv-card" data-card>
  ${F.head({ glyph: 'bolt', tone: 'solar', title: 'Energy', sub: 'Home · today', trailing: F.round('dots', 'fv-round--quiet', 'More') })}
  <div class="dk-energy__top">${F.readout({ label: 'Right now', value: '1.8', unit: 'kW', size: 'l', group: 'kw' })}<div class="dk-energy__side">${F.readout({ label: 'Cost', value: '0.27', unit: '$/h', size: 's', group: 'kw' })}</div></div>
  <div class="dk-chart">${F.curve([0.4, 0.3, 0.3, 0.3, 0.5, 1.2, 2.4, 1.6, 1.1, 2.1, 4.6, 2.8, 1.8], { w: 312, h: 148, extent: NOW, padTop: 44, id: 'dk-fill' })}${F.bubble(NOW * 312, '1.8', ' kW', 312)}</div>
  ${F.axis(
    [
      [0, '00:00'],
      [0.25, '06:00'],
      [0.5, '12:00'],
      [0.75, '18:00'],
      [1, '24:00'],
    ],
    312,
  )}
  <div class="dk-cols">${F.readout({ label: 'Grid', value: '6.4', unit: 'kWh', size: 's', group: 'kwh' })}${F.readout({ label: 'Solar', value: '11.2', unit: 'kWh', size: 's', group: 'kwh' })}${F.readout({ label: 'House', value: '9.8', unit: 'kWh', size: 's', group: 'kwh' })}</div>
</article>`;

  const mediaCard = () => `
<article class="fv-card dk-media" data-card>
  <span class="dk-art"></span>
  <div class="dk-media__titles"><h3 class="fv-card__title dk-media__title">Midnight Coda</h3><p class="fv-card__sub">Ola Gjeilo · Kitchen speaker</p></div>
  <div class="dk-progress"><span class="dk-progress__fill" data-measure="value" style="width:38%"></span></div>
  <div class="dk-times"><span>1:24</span><span>3:42</span></div>
  <div class="dk-transport">${F.round('shuffle', 'fv-round--quiet', 'Shuffle')}${F.round('prev', 'fv-round--quiet', 'Previous')}${F.round('pause', 'fv-round--accent', 'Pause')}${F.round('next', 'fv-round--quiet', 'Next')}${F.round('repeat', 'fv-round--quiet', 'Repeat')}</div>
</article>`;

  const scenesCard = () => `
<article class="fv-card" data-card>
  ${F.head({ glyph: 'film', tone: 'accent', title: 'Scenes', sub: 'Evening is active', trailing: F.round('plus', 'fv-round--quiet', 'Add scene') })}
  <div class="dk-scenes">${[
    ['moon', 'Evening', '5 devices', true],
    ['film', 'Cinema', '4 devices', false],
    ['sun', 'Morning', '7 devices', false],
    ['away', 'Away', 'Lock & arm', false],
  ]
    .map(
      ([g, n, m, on]) =>
        `<button class="fv-tile dk-scene ${on ? 'is-on fv-tile--accent' : ''}" data-card data-target>${F.ico(g, on ? 'accent' : 'neutral')}<span class="fv-row__text"><span class="fv-row__title">${n}</span><span class="fv-row__sub">${m}</span></span></button>`,
    )
    .join('')}</div>
</article>`;

  const securityCard = () => `
<article class="fv-card" data-card>
  ${F.head({ glyph: 'shield', tone: 'accent', title: 'Security', sub: 'Home · since 18:40', trailing: F.badge('Armed', 'accent') })}
  <div class="dk-rows">
    ${F.listRow({ glyph: 'lock', title: 'Front door', sub: '21:40 by Marta', trailing: 'value', value: 'Locked', tone: 'accent' })}
    ${F.listRow({ glyph: 'blinds', title: 'Kitchen window', sub: '14 min', trailing: 'value', value: 'Open', tone: 'warning', valueTone: 'warning' })}
    ${F.listRow({ glyph: 'camera', title: 'Driveway', sub: 'Person · 21:32', trailing: 'chevron', tone: 'neutral' })}
  </div>
</article>`;

  const presenceCard = () => `
<article class="fv-card" data-card>
  ${F.head({ glyph: 'person', tone: 'accent', title: 'Who is home', sub: '2 of 3 · updated now', trailing: F.round('map', 'fv-round--quiet', 'Map') })}
  <div class="dk-rows">${[
    ['Marta', '18:40', 'Home', true],
    ['Pau', '19:05', 'Home', true],
    ['Ona', 'School', 'Away', false],
  ]
    .map(
      ([n, s, v, home]) =>
        `<div class="fv-row"><span class="dk-avatar dk-avatar--l ${home ? 'is-home' : ''}" data-icon><i class="dk-avatar__dot"></i></span><span class="fv-row__text"><span class="fv-row__title">${n}</span><span class="fv-row__sub">${s}</span></span><span class="fv-row__value ${home ? '' : 'fv-row__value--quiet'}">${v}</span></div>`,
    )
    .join('')}</div>
</article>`;

  const offTile = () =>
    `<article class="fv-tile fv-tile--off dk-off" data-card>${F.ico('ban', 'off')}<div class="fv-row__text"><h3 class="fv-tile__name">Porch light</h3><p class="fv-tile__state">Unavailable · 2 h</p></div></article>`;

  const frame = (mode) => `
<div class="fv-frame dk-frame" data-frame data-mode="${mode}" data-palette="linen">
  ${sidebar()}
  <div class="dk-main">
    ${toolbar()}
    <main class="dk-sections">
      <section class="dk-col">${helloCard()}${roomsCard()}${presenceCard()}</section>
      <section class="dk-col">${thermostatCard()}${energyCard()}</section>
      <section class="dk-col">${mediaCard()}${securityCard()}${scenesCard()}${offTile()}</section>
    </main>
  </div>
</div>`;

  globalThis.renderDesktop = (root) => {
    root.innerHTML = frame('light') + frame('dark');
  };
})();
