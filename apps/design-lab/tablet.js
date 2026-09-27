/* Tablet / wall-panel composition. 1024 × 768 frame: HA's header (76, drawn as HA draws it: title, text tabs with the
   accent selection bar, bare icon buttons — only coloured by our tokens) and a sections dashboard of two 464 columns
   (content 424): tiles 208, rulers 424, options 3 × 136 + 2 × 8, readout columns 3 × 128 + 2 × 20.
   Type tiers for a panel read from 1–2 m: glance = clock 40 and the dial value 48; approach = 24 readouts and the 22 greeting (card titles stay 16);
   touch = 13 subs. Both columns end on one line (660 of content). */
(() => {
  'use strict';
  const F = globalThis.FLUVY;

  const header = () => `
<header class="tb-bar" data-expect-h="76">
  <h1 class="tb-bar__title" data-fit="0">Kitchen</h1>
  <nav class="tb-tabs" aria-label="Views" data-measure="skip">${[
    ['Overview', true],
    ['Rooms', false],
    ['Climate', false],
    ['Security', false],
  ]
    .map(
      ([t, on]) =>
        `<button class="tb-tab ${on ? 'is-active' : ''}" data-control data-target data-fit="24">${t}</button>`,
    )
    .join('')}</nav>
  <div class="tb-bar__actions">${F.round('locate', 'tb-iconbtn', 'Search')}${F.round('dots', 'tb-iconbtn', 'More')}</div>
</header>`;

  const tile = ({ glyph, name, state, on, kind, value, tone = 'accent' }) => {
    let foot = '';
    if (kind === 'light' || kind === 'cover')
      foot = F.ruler({
        w: 176,
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

  /* hello: the clock is the panel's most-read element → glance tier at the right; readouts at the approach tier */
  const helloCard = () => `
<article class="fv-card tb-hello" data-card>
  <div class="tb-hello__row"><div class="fv-card__titles"><h2 class="tb-hello__title">Good evening</h2><p class="fv-card__sub">Clear night · 2 of 3 home</p></div><div class="tb-clock"><span class="tb-clock__time" data-baseline="clk">21:47</span><span class="tb-clock__date" data-baseline="clk">Thu 17 Sep</span></div></div>
  <div class="tb-cols">${F.readout({ label: 'Outside', value: '18', unit: '°C', size: 'm', group: 'hs' })}${F.readout({ label: 'Inside', value: '20.8', unit: '°C', size: 'm', group: 'hs' })}${F.readout({ label: 'Power', value: '1.8', unit: 'kW', size: 'm', group: 'hs' })}</div>
  <div class="tb-scenes">${F.chips([{ label: 'Evening', active: true }, { label: 'Cinema' }, { label: 'Morning' }, { label: 'Away' }])}</div>
</article>`;

  const roomsCard = () => `
<article class="fv-card" data-card>
  ${F.head({ glyph: 'grid', tone: 'accent', title: 'Living room', sub: '4 devices · 3 on', trailing: F.round('chevron', 'fv-round--quiet', 'Open room') })}
  <div class="fv-grid2 tb-grid2">
    ${tile({ glyph: 'bulb', name: 'Ceiling', state: 'On · 70 %', on: true, kind: 'light', value: 0.7, tone: 'light' })}
    ${tile({ glyph: 'bulb', name: 'Reading', state: 'Off', on: false, kind: 'light', value: 0, tone: 'light' })}
    ${tile({ glyph: 'plug', name: 'Desk plug', state: 'On', on: true, kind: 'plug' })}
    ${tile({ glyph: 'blinds', name: 'Blinds', state: 'Open · 40 %', on: true, kind: 'cover', value: 0.4 })}
  </div>
</article>`;

  /* wall thermostat: the dial is the control (modes are a tap-through), drawn large (48 value, 36 knob) */
  const thermostatCard = () => `
<article class="fv-card" data-card>
  ${F.head({ glyph: 'thermo', tone: 'heat', title: 'Thermostat', sub: 'Living room · 46 % RH', trailing: F.badge('Heating', 'heat') })}
  <div class="tb-dial">${F.dial({ R: 88, tick: 12, large: true, tone: 'heat', min: 15, max: 30, target: 21.5, current: 20.8, value: '21.5', unit: '°C', sub: 'Now 20.8°', minLabel: '15°', maxLabel: '30°' })}</div>
</article>`;

  const securityCard = () => `
<article class="fv-card" data-card>
  ${F.head({ glyph: 'shield', tone: 'accent', title: 'Security', sub: 'Home · since 18:40', trailing: F.badge('Armed', 'accent') })}
  <div class="tb-rows">
    ${F.listRow({ glyph: 'lock', title: 'Front door', sub: '21:40 by Marta', trailing: 'value', value: 'Locked', tone: 'accent' })}
    ${F.listRow({ glyph: 'blinds', title: 'Kitchen window', sub: '14 min', trailing: 'value', value: 'Open', tone: 'warning', valueTone: 'warning' })}
    ${F.listRow({ glyph: 'camera', title: 'Driveway', sub: 'Person · 21:32', trailing: 'chevron', tone: 'neutral' })}
  </div>
</article>`;

  const frame = (mode) => `
<div class="fv-frame tb-frame" data-frame data-mode="${mode}" data-palette="linen">
  ${header()}
  <main class="tb-sections">
    <section class="tb-col">${helloCard()}${roomsCard()}</section>
    <section class="tb-col">${thermostatCard()}${securityCard()}</section>
  </main>
</div>`;

  globalThis.renderTablet = (root) => {
    root.innerHTML = frame('dark') + frame('light');
  };
})();
