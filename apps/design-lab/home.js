/* Home dashboard, composed from fluvy primitives; rendered twice (light, dark) from one template. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const { G } = F;
  const NOW = (21 * 60 + 47) / (24 * 60); // 21:47 on a 24 h axis

  const tile = ({ glyph, name, state, on, kind, value, tone = 'accent' }) => {
    let foot = '';
    if (kind === 'light' || kind === 'cover')
      foot = F.ruler({
        w: 140,
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
    const control = F.toggle(on, tone);
    return `<article class="fv-tile fv-tile--${tone} ${on ? 'is-on' : ''}" data-card><div class="fv-tile__head">${F.ico(glyph, on ? tone : 'accent')}${control}</div><h3 class="fv-tile__name">${name}</h3><p class="fv-tile__state">${state}</p>${foot}</article>`;
  };

  const scene = (glyph, name, meta) =>
    `<button class="fv-scene" data-card data-target>${F.ico(glyph)}<span class="fv-row__text"><span class="fv-row__title">${name}</span><span class="fv-row__sub">${meta}</span></span></button>`;

  const phone = (mode) => `
<div class="fv-frame fv-phone" data-frame data-mode="${mode}" data-palette="linen">
  <header class="hm-status" data-measure="skip"><span>21:47</span><span class="hm-status__icons">${G.signal}${G.wifi}${G.battery}</span></header>
  <section class="hm-hello">
    <div class="hm-hello__text"><h1 class="hm-hello__title">Good evening, Marta</h1><p class="hm-hello__meta"><span>Thursday 17 September</span><span class="hm-hello__weather">${G.moon}18° Clear</span></p></div>
    <span class="hm-avatar" data-icon aria-label="Profile"></span>
  </section>
  <nav class="hm-rooms" aria-label="Rooms">${F.chips([{ label: 'All', active: true }, { label: 'Living' }, { label: 'Kitchen' }, { label: 'Bedroom' }], { pad: 32 }).replace('fv-chip is-active', 'fv-chip fv-chip--ink is-active')}</nav>
  <div class="hm-section"><h2 class="hm-section__title">Living room</h2><span class="hm-section__meta">4 devices${G.chevron}</span></div>
  <div class="fv-grid2">
    ${tile({ glyph: 'bulb', name: 'Ceiling', state: 'On · 70 %', on: true, kind: 'light', value: 0.7, tone: 'light' })}
    ${tile({ glyph: 'bulb', name: 'Reading', state: 'Off', on: false, kind: 'light', value: 0, tone: 'light' })}
    ${tile({ glyph: 'plug', name: 'Desk plug', state: 'On', on: true, kind: 'plug' })}
    ${tile({ glyph: 'blinds', name: 'Blinds', state: 'Open · 40 %', on: true, kind: 'cover', value: 0.4 })}
  </div>
  <article class="fv-card" data-card>
    ${F.head({ glyph: 'thermo', tone: 'heat', title: 'Thermostat', sub: 'Living room · 46 % RH', trailing: F.badge('Heating', 'heat') })}
    <div class="hm-dial">${F.dial({ R: 84, tick: 10, tone: 'heat', min: 15, max: 30, target: 21.5, current: 20.8, value: '21.5', unit: '°C', sub: 'Now 20.8°', minLabel: '15°', maxLabel: '30°' })}</div>
    ${F.label('Mode')}
    ${F.options(
      [
        { label: 'Heat', value: '21.5°', tone: 'heat', glyph: 'flame', active: true },
        { label: 'Cool', value: '24°', tone: 'cool', glyph: 'snow' },
        { label: 'Auto', value: 'Range', tone: 'accent', glyph: 'auto' },
      ],
      104,
    )}
  </article>
  <article class="fv-card" data-card>
    ${F.head({ glyph: 'bolt', tone: 'solar', title: 'Energy', sub: 'Home · today', trailing: F.round('dots', 'fv-round--quiet', 'More') })}
    <div class="hm-energy__top fv-value-row">${F.readout({ label: 'Right now', value: '1.8', unit: 'kW', size: 'l', group: 'kw' })}<div class="hm-energy__side">${F.readout({ label: 'Cost', value: '0.27', unit: '$/h', size: 's', group: 'kw' })}</div></div>
    <div class="hm-chart">${F.curve([0.4, 0.3, 0.3, 0.3, 0.5, 1.2, 2.4, 1.6, 1.1, 2.1, 4.6, 2.8, 1.8], { extent: NOW, padTop: 44 })}${F.bubble(NOW * 320, '1.8', ' kW')}</div>
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
    <div class="hm-legend fv-cols">
      ${F.readout({ label: 'Grid', value: '6.4', unit: 'kWh', size: 's', group: 'kwh' })}
      ${F.readout({ label: 'Solar', value: '11.2', unit: 'kWh', size: 's', group: 'kwh' })}
      ${F.readout({ label: 'House', value: '9.8', unit: 'kWh', size: 's', group: 'kwh' })}
    </div>
  </article>
  <article class="fv-card hm-media" data-card>
    <span class="fv-art hm-art"></span>
    <div class="hm-media__titles"><h3 class="fv-card__title hm-media__title">Midnight Coda</h3><p class="fv-card__sub">Ola Gjeilo · Kitchen speaker</p></div>
    <div class="hm-progress"><span class="hm-progress__fill" data-measure="value" style="width:38%"></span></div>
    <div class="hm-times"><span>1:24</span><span>3:42</span></div>
    <div class="hm-transport">${F.round('prev', 'fv-round--quiet hm-transport__btn', 'Previous')}${F.round('pause', 'fv-round--accent hm-transport__btn', 'Pause')}${F.round('next', 'fv-round--quiet hm-transport__btn', 'Next')}${F.round('volume', 'fv-round--quiet hm-transport__btn hm-transport__volume', 'Volume')}</div>
  </article>
  <article class="fv-card hm-stats" data-card>
    ${F.readout({ label: 'Temperature', value: '20.8', unit: '°C', trend: 'trendUp', group: 'stat' })}
    ${F.readout({ label: 'Humidity', value: '46', unit: '%', trend: 'trendDown', group: 'stat' })}
    ${F.readout({ label: 'Power', value: '1.8', unit: 'kW', trend: 'trendUp', group: 'stat' })}
  </article>
  <div class="hm-section"><h2 class="hm-section__title">Scenes</h2><span class="hm-section__meta">Edit</span></div>
  <div class="fv-grid2 hm-scenes">${scene('moon', 'Evening', '5 devices')}${scene('film', 'Cinema', '4 devices')}</div>
  <article class="fv-tile fv-tile--off hm-off" data-card>${F.ico('ban', 'off')}<div class="fv-row__text"><h3 class="fv-tile__name">Porch light</h3><p class="fv-tile__state">Unavailable · 2 h</p></div></article>
  <nav class="hm-nav" aria-label="Sections"><button class="hm-nav__item is-active" data-control data-target aria-label="Home">${G.home}</button><button class="hm-nav__item" data-control data-target aria-label="Rooms">${G.grid}</button><button class="hm-nav__item" data-control data-target aria-label="Energy">${G.bolt}</button><button class="hm-nav__item" data-control data-target aria-label="Settings">${G.sliders}</button></nav>
</div>`;

  globalThis.renderHome = (root) => {
    root.innerHTML = phone('light') + phone('dark');
  };
})();
