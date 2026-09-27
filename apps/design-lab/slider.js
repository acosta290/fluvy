/* Precision slider sheet on fluvy primitives: five card states, dark card, dark vertical ruler, gesture legend. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const PCT = [
    [0, '0'],
    [0.25, '25'],
    [0.5, '50'],
    [0.75, '75'],
    [1, '100'],
  ];
  const FINE = [
    [0, '90'],
    [0.2, '92'],
    [0.4, '94'],
    [0.6, '96'],
    [0.8, '98'],
    [1, '100'],
  ];

  const valueRow = (v, unit = '%', off = false) =>
    `<div class="sl-value fv-value-row">${F.readout({ label: 'Brightness', value: v, unit, size: 'l', group: 'v' })}${off ? '' : F.stepper()}</div>`;

  const card = (mode, state) => {
    const chip = {
      dragging: ['Dragging', 'light'],
      fine: ['Fine · 1 % steps', 'light'],
      focus: ['Keyboard', 'neutral'],
      disabled: ['Unavailable', 'off'],
    }[state];
    let body = '';
    if (state === 'idle')
      body = `${valueRow('70')}<div class="sl-bubble-row"></div>${F.ruler({ value: 0.7, tone: 'light' })}${F.rulerLabels(PCT, 320)}`;
    if (state === 'dragging')
      body = `${valueRow('97')}<div class="sl-bubble-row">${F.bubble(0.97 * 320, '97', '%')}</div>${F.ruler({ value: 0.97, tone: 'light', magnify: true })}${F.rulerLabels(PCT, 320)}`;
    if (state === 'fine')
      body = `${valueRow('97')}<div class="sl-bubble-row">${F.bubble(0.7 * 320, '97', '%')}</div>${F.ruler({ value: 0.7, tone: 'light', magnify: true, minor: 0.1, major: 0.2, className: 'sl-band--fine' })}${F.rulerLabels(FINE, 320)}`;
    if (state === 'focus')
      body = `${valueRow('70')}<div class="sl-bubble-row"><span class="sl-hint">← → 1 % · Shift 5 % · PgUp/PgDn 10 % · Home/End</span></div>${F.ruler({ value: 0.7, tone: 'light', focus: true })}${F.rulerLabels(PCT, 320)}`;
    if (state === 'disabled')
      body = `${valueRow('—', '', true)}<div class="sl-bubble-row"></div>${F.ruler({ value: 0, tone: 'neutral', active: false, className: 'fv-ruler--off' })}${F.rulerLabels(PCT, 320)}`;
    return (
      `<article class="fv-frame fv-card sl-card ${state === 'disabled' ? 'is-off' : ''}" data-frame data-mode="${mode}" data-palette="linen" data-card>` +
      F.head({
        glyph: 'bulb',
        tone: state === 'disabled' ? 'off' : 'light',
        title: 'Ceiling',
        sub: 'Living room',
        trailing: chip ? F.badge(chip[0], chip[1]) : '',
      }) +
      body +
      `</article>`
    );
  };

  const dark = () => `
<div class="fv-frame sl-dark" data-frame data-mode="dark" data-palette="linen">
  <div class="fv-card__titles"><h3 class="fv-card__title">Brightness</h3><p class="fv-card__sub">Ceiling · Living room</p></div>
  <div class="sl-dark__body">
    <div class="sl-vlabels"><span style="top:0">100</span><span style="top:80px">75</span><span style="top:160px">50</span><span style="top:240px">25</span><span style="top:320px">0</span></div>
    ${F.ruler({ w: 44, h: 320, value: 0.72, tone: 'light', vertical: true, magnify: true })}
    <div class="sl-dark__readout" data-measure="value" style="top:${(320 - 0.72 * 320 - 36).toFixed(0)}px"><p class="sl-huge"><span data-baseline="d">72</span><span class="sl-huge__unit" data-baseline="d">%</span></p>${F.stepper()}</div>
  </div>
  <div class="sl-dark__foot"><p class="fv-card__sub">Hold for the fine scale · slide away to slow down</p></div>
</div>`;

  const gestures = () => {
    const track = (extra) =>
      `<svg viewBox="0 0 120 64" width="120" height="64" aria-hidden="true" class="sl-diagram"><line x1="8" y1="40" x2="112" y2="40" class="dg-track"/><line x1="8" y1="40" x2="64" y2="40" class="dg-on"/>${extra}</svg>`;
    const knob = `<circle cx="64" cy="40" r="9" class="dg-knob"/><circle cx="64" cy="40" r="3.5" class="dg-knob-dot"/>`;
    const finger = (x, y) => `<circle cx="${x}" cy="${y}" r="7" class="dg-finger"/>`;
    const arrow = (x1, y1, x2, y2) =>
      `<path d="M${x1} ${y1} L${x2} ${y2}" class="dg-arrow"/><path d="M${x2 - 5} ${y2 - 4} L${x2} ${y2} L${x2 - 5} ${y2 + 4}" class="dg-arrow" transform="rotate(${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI} ${x2} ${y2})"/>`;
    const rows = [
      [
        track(`${knob}${finger(36, 24)}${arrow(44, 24, 72, 24)}`),
        'Relative drag',
        'Touch anywhere near the ruler and slide: the knob moves with your finger from where it is, it never jumps to the touch point.',
      ],
      [
        track(
          `${knob}${finger(64, 12)}${arrow(64, 34, 64, 20)}<text x="76" y="16" class="dg-text">×10</text>`,
        ),
        'Slide away to slow down',
        "Slide away from the ruler while dragging: a finger's width halves the speed, three widths make it ten times finer.",
      ],
      [
        track(
          `${knob}<circle cx="64" cy="40" r="15" class="dg-hold"/><text x="82" y="26" class="dg-text">450 ms</text>`,
        ),
        'Hold for the fine scale',
        'Hold for half a second: the ruler zooms to 1&nbsp;% ticks with a haptic tick per step. Double-tap the value to type it.',
      ],
    ];
    return (
      `<div class="fv-frame sl-gestures" data-frame data-mode="light" data-palette="linen"><div class="fv-card__titles"><h3 class="fv-card__title">How the dimmer feels</h3><p class="fv-card__sub">Gesture model · same on phone and tablet</p></div>` +
      rows
        .map(
          ([svg, t, d]) =>
            `<div class="sl-gesture">${svg}<div class="sl-gesture__text"><h4>${t}</h4><p>${d}</p></div></div>`,
        )
        .join('') +
      `</div>`
    );
  };

  globalThis.renderSlider = (root) => {
    root.innerHTML =
      ['idle', 'dragging', 'fine', 'focus', 'disabled'].map((s) => card('light', s)).join('') +
      card('dark', 'dragging') +
      dark() +
      gestures();
  };
})();
