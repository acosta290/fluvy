/* Devices family: cover, fan, vacuum, lock, alarm (+keypad sheet), camera. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const { G } = F;
  const card = (mode, body, cls = '') =>
    `<article class="fv-frame fv-card dv-card ${cls}" data-frame data-mode="${mode}" data-palette="linen" data-card>${body}</article>`;

  /* Blinds: badge = state, readouts carry the numbers; the position knob (65 %) sits in the gap between the two
     readouts; tilt has its own stepper; the command row runs full width below the ruler like the vacuum's. */
  const coverCard = () =>
    card(
      'light',
      F.head({
        glyph: 'blinds',
        tone: 'accent',
        title: 'Blinds',
        sub: 'Living room · window',
        trailing: F.badge('Open', 'accent'),
      }) +
        `<div class="dv-cover">
      <div class="dv-cover__ruler"><div class="dv-vlabels" style="height:160px"><span style="top:0">Open</span><span style="top:160px">Closed</span></div>${F.ruler({ w: 44, h: 160, value: 0.65, tone: 'accent', vertical: true })}</div>
      <div class="dv-cover__side">
        ${F.readout({ label: 'Position', value: '65', unit: '%', group: 'c' })}
        <div class="dv-cover__tilt">${F.readout({ label: 'Tilt', value: '15', unit: '°', group: 'c2' })}${F.stepper()}</div>
      </div>
    </div>
    ${F.actions([
      { glyph: 'up', label: 'Open' },
      { glyph: 'stop', label: 'Stop' },
      { glyph: 'down', label: 'Close' },
    ])}` +
        F.label('Favourites') +
        F.chips([{ label: 'Morning · 60 %' }, { label: 'Night · closed' }]),
    );

  const fanCard = () =>
    card(
      'light',
      F.head({
        glyph: 'fan',
        tone: 'fan',
        title: 'Ceiling fan',
        sub: 'Bedroom',
        trailing: F.toggle(true, 'fan'),
      }) +
        `<div class="dv-value fv-value-row">${F.readout({ label: 'Speed', value: '60', unit: '%', size: 'l', group: 'f' })}${F.stepper()}</div>` +
        F.ruler({ w: 320, h: 44, value: 0.6, tone: 'fan' }) +
        F.rulerLabels(
          [
            [0, 'Off'],
            [0.25, 'Low'],
            [0.5, 'Mid'],
            [0.75, 'High'],
            [1, 'Max'],
          ],
          320,
        ) +
        `<div class="dv-rows">${F.listRow({ glyph: 'swing', title: 'Oscillate', sub: '90°', trailing: 'switch', on: true, tone: 'fan' })}${F.listRow({ glyph: 'auto', title: 'Direction', sub: 'Summer · downdraft', trailing: 'chevron', tone: 'neutral' })}</div>`,
    );

  /* Vacuum: the gauge is labelled (BATTERY) and sits directly under its label; the readouts carry the rest */
  const vacuumCard = () =>
    card(
      'light',
      F.head({
        glyph: 'vacuum',
        tone: 'accent',
        title: 'Vacuum',
        sub: 'Kitchen · started 21:29',
        trailing: F.badge('Cleaning', 'accent'),
      }) +
        `<div class="dv-cols fv-cols">${F.readout({ label: 'Area', value: '24', unit: 'm²', size: 's', group: 'v' })}${F.readout({ label: 'Elapsed', value: '18', unit: 'min', size: 's', group: 'v' })}${F.readout({ label: 'Remaining', value: '42', unit: 'min', size: 's', group: 'v' })}</div>` +
        F.label('Battery · 78 %') +
        `<div class="dv-gauge">${F.ruler({ w: 320, h: 44, value: 0.78, tone: 'accent', marker: true })}</div>` +
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
        F.actions([
          { glyph: 'pause', label: 'Pause', primary: true },
          { glyph: 'stop', label: 'Stop' },
          { glyph: 'dock', label: 'Return to dock' },
          { glyph: 'locate', label: 'Locate' },
        ]) +
        F.label('Suction') +
        F.chips([
          { label: 'Quiet' },
          { label: 'Standard', active: true },
          { label: 'Turbo' },
          { label: 'Max' },
        ]),
    );

  /* Lock: a dedicated slide track — no ticks, the knob at the true start, a destination ring with the unlock glyph,
     the instruction centred in the track. Rows: state once (trailing), time in the sub. */
  const slide = () =>
    `<div class="dv-slide" data-control>${F.knob(4, 4, 36, 'accent')}<span class="dv-slide__hint">Slide to unlock</span><span class="dv-slide__end">${G.unlock}</span></div>`;
  const lockCard = () =>
    card(
      'light',
      F.head({
        glyph: 'lock',
        tone: 'accent',
        title: 'Front door',
        sub: '21:40 by Marta',
        trailing: F.badge('Locked', 'accent'),
      }) +
        slide() +
        `<div class="dv-rows">${F.listRow({ glyph: 'clock', title: 'Auto-lock', sub: 'After 5 min', trailing: 'switch', on: true, tone: 'accent' })}${F.listRow({ glyph: 'door', title: 'Door sensor', sub: 'Since 19:12', trailing: 'value', value: 'Closed', tone: 'neutral' })}${F.listRow({ glyph: 'key', title: 'Guest code', sub: 'Valid until Sunday', trailing: 'chevron', tone: 'neutral' })}</div>`,
    );

  /* Alarm: label = mode, value = its setting (same grammar as climate) */
  const alarmCard = () =>
    card(
      'light',
      F.head({
        glyph: 'shield',
        tone: 'accent',
        title: 'Alarm',
        sub: 'Since 20:10',
        trailing: F.badge('Armed', 'accent'),
      }) +
        F.label('Mode') +
        F.options(
          [
            { label: 'Disarmed', value: 'Off', tone: 'neutral', glyph: 'unlock' },
            { label: 'Home', value: 'Perimeter', tone: 'accent', glyph: 'home', active: true },
            { label: 'Away', value: 'All zones', tone: 'accent', glyph: 'away' },
          ],
          104,
        ) +
        `<div class="dv-rows">${F.listRow({ glyph: 'motion', title: 'Living room motion', sub: '4 min ago', trailing: 'value', value: 'Clear', tone: 'neutral' })}${F.listRow({ glyph: 'door', title: 'Back door', sub: '2 h ago', trailing: 'value', value: 'Closed', tone: 'neutral' })}</div>`,
    );

  /* Keypad: the key cluster and the action pair share one 264 extent (3×72 + 2×24 = 2×124 + 16), centred */
  const keypad = () => `
<div class="fv-frame fv-sheet dv-sheet" data-frame data-mode="light" data-palette="linen">
  <div class="fv-sheet__grabber"><span></span></div>
  <div class="fv-sheet__head"><div class="fv-card__titles"><h2 class="fv-sheet__title">Disarm</h2><p class="fv-card__sub">Enter your code · 30 s</p></div>${F.round('close', 'fv-round--quiet', 'Close')}</div>
  <div class="dv-code"><span class="dv-code__dot is-on"></span><span class="dv-code__dot is-on"></span><span class="dv-code__dot"></span><span class="dv-code__dot"></span></div>
  <div class="dv-keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'].map((k) => (k === '' ? '<span></span>' : k === 'backspace' ? `<button class="dv-key dv-key--quiet" data-control data-target aria-label="Delete">${G.backspace}</button>` : `<button class="dv-key" data-control data-target>${k}</button>`)).join('')}</div>
  <div class="dv-actions">${F.button('Arm away', 'quiet', 124)}${F.button('Disarm', 'accent', 124)}</div>
</div>`;

  /* Camera: LIVE pill inside the frame (dark translucent, warning dot), timestamp, vignette; rows are events → neutral */
  const cameraCard = () =>
    card(
      'light',
      F.head({
        glyph: 'camera',
        tone: 'accent',
        title: 'Driveway',
        sub: 'Front of house · 1080p',
        trailing: F.round('dots', 'fv-round--quiet', 'More'),
      }) +
        `<div class="dv-cam"><span class="dv-cam__pill dv-cam__live"><i></i>Live</span><span class="dv-cam__pill dv-cam__time">21:47:12</span><div class="dv-cam__actions">${F.round('snapshot', 'fv-round--quiet', 'Snapshot')}${F.round('expand', 'fv-round--quiet', 'Fullscreen')}</div></div>` +
        `<div class="dv-rows">${F.listRow({ glyph: 'person', title: 'Person detected', sub: '21:32 · 8 s clip', trailing: 'chevron', tone: 'neutral' })}${F.listRow({ glyph: 'car', title: 'Vehicle', sub: '19:05 · 12 s clip', trailing: 'chevron', tone: 'neutral' })}</div>`,
    );

  globalThis.renderDevices = (root) => {
    root.innerHTML =
      coverCard() + fanCard() + vacuumCard() + lockCard() + alarmCard() + keypad() + cameraCard();
  };
})();
