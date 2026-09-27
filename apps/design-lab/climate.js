/* Climate family, composed from fluvy primitives: dial + stepper, option cards, chips, rows. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;

  // option rows fill the content column exactly: 3×104 + 2×4 = 320 (card), 3×112 + 2×12 = 360 (sheet)
  const modeOptions = (active, w = 104, fit = 320, heat = '21.5°', cool = '24°') =>
    F.options(
      [
        { label: 'Heat', value: heat, tone: 'heat', glyph: 'flame', active: active === 'Heat' },
        { label: 'Cool', value: cool, tone: 'cool', glyph: 'snow', active: active === 'Cool' },
        { label: 'Auto', value: 'Range', tone: 'accent', glyph: 'auto', active: active === 'Auto' },
      ],
      w,
      84,
      fit,
    );

  // chips are content-sized (14 px sides, same label → same width everywhere); a chip row is a set, it does not stretch
  const presetChips = (active) =>
    F.chips([
      { label: 'Eco', active: active === 'Eco' },
      { label: 'Comfort', active: active === 'Comfort' },
      { label: 'Away', active: active === 'Away' },
      { label: 'Boost', active: active === 'Boost' },
    ]);

  const fanChips = (active, max = false) =>
    F.chips([
      { label: 'Auto', active: active === 'Auto' },
      { label: 'Low', active: active === 'Low' },
      { label: 'Mid', active: active === 'Mid' },
      { label: 'High', active: active === 'High' },
      ...(max ? [{ label: 'Max', active: active === 'Max' }] : []),
    ]);

  const THERMO = { min: 15, max: 30, minLabel: '15°', maxLabel: '30°', unit: '°C' };

  const card = ({
    mode = 'light',
    tone,
    glyph = 'thermo',
    title = 'Thermostat',
    sub = 'Living room',
    badgeText,
    dialOpts,
    opts,
    extra = '',
  }) => `
<article class="fv-frame fv-card cl-card" data-frame data-mode="${mode}" data-palette="linen" data-card>
  ${F.head({ glyph, tone, title, sub, trailing: F.badge(badgeText, tone) })}
  <div class="cl-dial-row">${F.dial({ R: 84, tick: 10, tone, ...dialOpts })}</div>
  ${opts}
  ${extra}
</article>`;

  const sheet = () => `
<div class="fv-frame fv-sheet" data-frame data-mode="light" data-palette="linen">
  <div class="fv-sheet__grabber"><span></span></div>
  <div class="fv-sheet__head"><div class="fv-card__titles"><h2 class="fv-sheet__title">Living room</h2><p class="fv-card__sub">Thermostat · Heating</p></div>${F.toggle(true, 'heat')}</div>
  <div class="cl-dial-row cl-dial-row--l">${F.dial({ R: 120, tick: 12, tone: 'heat', ...THERMO, target: 21.5, current: 20.8, value: '21.5', sub: 'Heating to target' })}</div>
  <div class="cl-readouts">
    ${F.readout({ label: 'Current temp', value: '20.8', unit: '°C', trend: 'trendUp', group: 'cur' })}
    ${F.readout({ label: 'Humidity', value: '46', unit: '%', trend: 'trendDown', group: 'cur' })}
  </div>
  ${F.label('Mode')}
  ${modeOptions('Heat', 112, 360)}
  ${F.label('Preset')}
  ${presetChips('Comfort')}
  ${F.label('Fan')}
  ${fanChips('Auto', true)}
  <div class="cl-rows">
    ${F.listRow({ glyph: 'swing', title: 'Swing', sub: 'Vertical', trailing: 'switch', on: true })}
    ${F.listRow({ glyph: 'clock', title: 'Schedule', sub: 'Weekdays · 06:30 – 22:00', trailing: 'chevron' })}
  </div>
</div>`;

  const compact = () => `
<div class="fv-frame cl-compact" data-frame data-mode="light" data-palette="linen">
  <div class="fv-grid2">
    <article class="fv-tile fv-tile--heat is-on" data-card>
      <div class="fv-tile__head">${F.ico('thermo', 'heat')}<span class="fv-tile__value">21.5°</span></div>
      <h3 class="fv-tile__name">Living room</h3>
      <p class="fv-tile__state">Heating · 20.8°</p>
      ${F.ruler({ w: 140, h: 44, value: 0.433, tone: 'heat', minor: 1 / 15, major: 1 / 3, knobSize: 28 })}
    </article>
    <article class="fv-tile" data-card>
      <div class="fv-tile__head">${F.ico('thermo', 'neutral')}<span class="fv-tile__value fv-tile__value--quiet">19.2°</span></div>
      <h3 class="fv-tile__name">Bedroom</h3>
      <p class="fv-tile__state">Off</p>
      ${F.ruler({ w: 140, h: 44, value: 0.28, tone: 'neutral', minor: 1 / 15, major: 1 / 3, active: false, className: 'fv-ruler--off' })}
    </article>
  </div>
  <article class="fv-card cl-row" data-card>
    ${F.ico('thermo', 'heat')}
    <div class="fv-row__text"><span class="fv-row__title">Kitchen</span><span class="fv-row__sub">Heating · 21.1°</span></div>
    <span class="cl-row__value"><span data-baseline="row">22°</span></span>
    ${F.stepper()}
  </article>
</div>`;

  globalThis.renderClimate = (root) => {
    root.innerHTML =
      card({
        tone: 'heat',
        badgeText: 'Heating',
        sub: 'Living room · 46 % RH',
        dialOpts: { ...THERMO, target: 21.5, current: 20.8, value: '21.5', sub: 'Now 20.8°' },
        opts: F.label('Mode') + modeOptions('Heat'),
        extra: F.label('Preset') + presetChips('Comfort') + F.label('Fan') + fanChips('Auto'),
      }) +
      sheet() +
      card({
        tone: 'cool',
        badgeText: 'Cooling',
        dialOpts: { ...THERMO, target: 24, current: 26.1, value: '24.0', sub: 'Now 26.1°' },
        opts: F.label('Mode') + modeOptions('Cool'),
      }) +
      card({
        tone: 'accent',
        badgeText: 'Heat · Cool',
        dialOpts: {
          ...THERMO,
          range: [20, 24],
          current: 21.8,
          value: '20 – 24',
          sub: 'Now 21.8° · idle',
          focusKnob: 1,
        },
        opts: F.label('Mode') + modeOptions('Auto'),
      }) +
      card({
        tone: 'neutral',
        badgeText: 'Off',
        dialOpts: {
          ...THERMO,
          current: 20.8,
          value: 'Off',
          unit: '',
          sub: 'Now 20.8°',
          disabled: true,
        },
        opts:
          F.label('Mode') +
          F.options(
            [
              { label: 'Off', value: 'Standby', tone: 'neutral', glyph: 'power', active: true },
              { label: 'Heat', value: '21.5°', tone: 'heat', glyph: 'flame' },
              { label: 'Cool', value: '24°', tone: 'cool', glyph: 'snow' },
            ],
            104,
          ),
      }) +
      compact() +
      card({
        tone: 'heat',
        glyph: 'heater',
        title: 'Water heater',
        sub: 'Utility · ready 18:30',
        badgeText: 'Heating',
        dialOpts: {
          min: 40,
          max: 65,
          target: 50,
          current: 48,
          value: '50',
          unit: '°C',
          sub: 'Now 48°',
          minLabel: '40°',
          maxLabel: '65°',
        },
        opts:
          F.label('Mode') +
          F.options(
            [
              { label: 'Off', value: 'Standby', tone: 'neutral', glyph: 'power' },
              { label: 'Eco', value: '50°', tone: 'heat', glyph: 'leaf', active: true },
              { label: 'Boost', value: '65°', tone: 'heat', glyph: 'bolt' },
            ],
            104,
          ),
      }) +
      card({
        tone: 'water',
        glyph: 'humid',
        title: 'Humidifier',
        sub: 'Bedroom · tank 72 %',
        badgeText: 'Humidifying',
        dialOpts: {
          min: 30,
          max: 70,
          target: 50,
          current: 46,
          value: '50',
          unit: '%',
          sub: 'Now 46 %',
          minLabel: '30 %',
          maxLabel: '70 %',
        },
        opts:
          F.label('Mode') +
          F.options(
            [
              { label: 'Off', value: 'Standby', tone: 'neutral', glyph: 'power' },
              { label: 'Auto', value: '50 %', tone: 'water', glyph: 'auto', active: true },
              { label: 'Sleep', value: '45 %', tone: 'water', glyph: 'moon' },
            ],
            104,
          ),
      }) +
      card({
        mode: 'dark',
        tone: 'heat',
        badgeText: 'Heating',
        dialOpts: { ...THERMO, target: 21.5, current: 20.8, value: '21.5', sub: 'Now 20.8°' },
        opts: F.label('Mode') + modeOptions('Heat'),
      });
  };
})();
