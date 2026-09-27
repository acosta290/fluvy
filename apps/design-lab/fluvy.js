/*
 * fluvy primitives — the single control language every sheet composes from.
 *
 *   ico        icon in a soft circle (44, glyph 20)
 *   knob       the one knob: white disc, tone ring, tone dot — on rulers and dials alike
 *   ruler      linear ruler with ticks (horizontal or vertical), active portion, knob
 *   dial       circular ruler: tick ring + soft disc + knob on the ring + optional stepper
 *   stepper    − | + pill (96×44), the fine adjust that accompanies any value control
 *   options    "option cards": label + value, one active (modes, sources, fan speeds)
 *   chips      pill filters (rooms, presets)
 *   listRow    60px row: icon circle, title/sub, trailing switch | chevron | value
 *   readout    LABEL (uppercase) + big tabular value + unit (+ trend)
 *   toggle     switch 48×28 inside a 56×44 hit area
 *   head       card head: ico + title/sub + trailing slot
 *
 * Everything is a multiple of 4 on the frame grid; continuous positions carry data-measure="value".
 */
(() => {
  'use strict';

  const svg = (body, attrs = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" ` +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs}>${body}</svg>`;

  const G = {
    bulb: svg(
      '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.9 10.6c.6.5.9 1.2.9 2V16h6v-.4c0-.8.3-1.5.9-2A6 6 0 0 0 12 3Z"/>',
    ),
    plug: svg(
      '<path d="M9 3v4"/><path d="M15 3v4"/><path d="M6.5 7h11v4a5.5 5.5 0 0 1-11 0Z"/><path d="M12 16.5V21"/>',
    ),
    blinds: svg(
      '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 9.3h16"/><path d="M4 14.7h16"/><path d="M8 20v1"/>',
    ),
    thermo: svg('<path d="M10 4.5a2 2 0 1 1 4 0v9.3a4 4 0 1 1-4 0Z"/><path d="M12 9v6.5"/>'),
    flame: svg(
      '<path d="M11.8 3C14.4 4.8 17 9.8 17 16a5 5 0 0 1-10 0c0-2.2.5-4.2 1.4-6 .4 1.1 1.1 1.8 2 2C10.2 8.6 10.4 5.6 11.8 3Z"/><path d="M12 13.8c1 .9 1.7 1.7 1.7 2.6a1.7 1.7 0 0 1-3.4 0c0-.9.7-1.7 1.7-2.6Z"/>',
    ),
    snow: svg(
      '<path d="M12 3v18"/><path d="M4.2 7.5l15.6 9"/><path d="M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 7l2.5-2.5"/><path d="M9.5 19.5 12 17l2.5 2.5"/>',
    ),
    auto: svg(
      '<path d="M4 12a8 8 0 0 1 13.7-5.6"/><path d="M20 12a8 8 0 0 1-13.7 5.6"/><path d="M17.5 3v3.8h-3.8"/><path d="M6.5 21v-3.8h3.8"/>',
    ),
    bolt: svg('<path d="M13 3 5 13.5h6L11 21l8-10.5h-6Z"/>'),
    speaker: svg(
      '<rect x="6" y="3" width="12" height="18" rx="3"/><circle cx="12" cy="14" r="3.2"/><circle cx="12" cy="7.5" r="1"/>',
    ),
    prev: svg('<path d="M6 5v14"/><path d="M18 6 9 12l9 6Z" fill="currentColor" stroke="none"/>'),
    next: svg('<path d="M18 5v14"/><path d="M6 6l9 6-9 6Z" fill="currentColor" stroke="none"/>'),
    pause: svg(
      '<rect x="7" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" stroke="none"/>',
    ),
    volume: svg(
      '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    ),
    sun: svg(
      '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5"/><path d="M12 19v2.5"/><path d="M2.5 12H5"/><path d="M19 12h2.5"/><path d="m5.3 5.3 1.8 1.8"/><path d="m16.9 16.9 1.8 1.8"/><path d="m5.3 18.7 1.8-1.8"/><path d="m16.9 7.1 1.8-1.8"/>',
    ),
    moon: svg(
      '<g transform="translate(-0.32 0.32)"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></g>',
    ),
    film: svg(
      '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 5v14"/><path d="M17 5v14"/><path d="M3 12h4"/><path d="M17 12h4"/>',
    ),
    chevron: svg('<path d="m9 6 6 6-6 6"/>'),
    chevronLeft: svg('<g transform="matrix(-1 0 0 1 24 0)"><path d="m9 6 6 6-6 6"/></g>'),
    minus: svg('<path d="M6 12h12"/>'),
    plus: svg('<path d="M12 6v12"/><path d="M6 12h12"/>'),
    home: svg(
      '<path d="M4 11 12 4l8 7v8.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5Z"/><path d="M9.5 21v-6h5v6"/>',
    ),
    grid: svg(
      '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    ),
    sliders: svg(
      '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h2"/><path d="M10 17h10"/><circle cx="8" cy="17" r="2"/>',
    ),
    trendUp: svg('<path d="M4 16l5-5 4 4 7-7"/><path d="M15 8h5v5"/>', 'stroke-width="2"'),
    trendDown: svg('<path d="M4 8l5 5 4-4 7 7"/><path d="M15 16h5v-5"/>', 'stroke-width="2"'),
    drop: svg('<path d="M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5Z"/>'),
    ban: svg('<circle cx="12" cy="12" r="8"/><path d="m6.5 6.5 11 11"/>'),
    signal: svg(
      '<path d="M4 18h2"/><path d="M9 18v-4"/><path d="M14 18v-8"/><path d="M19 18V6"/>',
      'stroke-width="2.2"',
    ),
    wifi: svg(
      '<path d="M3 9.5a13 13 0 0 1 18 0"/><path d="M6.5 13a8 8 0 0 1 11 0"/><path d="M10 16.5a3.2 3.2 0 0 1 4 0"/><circle cx="12" cy="19.5" r=".8" fill="currentColor"/>',
      'stroke-width="2"',
    ),
    battery: svg(
      '<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M21 11v2"/><rect x="5" y="10" width="10" height="4" rx="1" fill="currentColor" stroke="none"/>',
    ),
    dots: svg(
      '<circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    ),
    leaf: svg('<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19c3-5 6-8 10-10"/>'),
    clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    close: svg('<path d="m6.5 6.5 11 11"/><path d="m17.5 6.5-11 11"/>'),
    fan: svg(
      '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-4 1.5-6.5 4-6.5S19 6 19 8c0 1.5-2 2.5-7 2Z"/><path d="M14 12c4 0 6.5 1.5 6.5 4S18 19 16 19c-1.5 0-2.5-2-2-7Z"/><path d="M12 14c0 4-1.5 6.5-4 6.5S5 18 5 16c0-1.5 2-2.5 7-2Z"/><path d="M10 12c-4 0-6.5-1.5-6.5-4S6 5 8 5c1.5 0 2.5 2 2 7Z"/>',
    ),
    swing: svg(
      '<path d="M4 8h13"/><path d="m14 5 3 3-3 3"/><path d="M20 16H7"/><path d="m10 13-3 3 3 3"/>',
    ),
    heater: svg(
      '<path d="M8 4h8v13a4 4 0 0 1-8 0Z"/><path d="M12 9c1 1.2 1.8 2 1.8 3.2a1.8 1.8 0 1 1-3.6 0c0-1.2.8-2 1.8-3.2Z"/><path d="M10 21h4"/>',
    ),
    humid: svg(
      '<path d="M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5Z"/><path d="M9 15.5c1 .8 2 1 3 0s2-.8 3 0"/>',
    ),
    away: svg(
      '<circle cx="12" cy="5" r="1.8"/><path d="M9.5 21v-6l2-3-1.5-4.5L8 10"/><path d="M13 10.5 15.5 9"/><path d="m11.5 12 3 2 1.5 7"/>',
    ),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    note: svg(
      '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
    ),
    car: svg(
      '<g transform="translate(0 -1)"><path d="M5 18v2"/><path d="M19 18v2"/><path d="m4 12 1.7-4.6A2 2 0 0 1 7.6 6h8.8a2 2 0 0 1 1.9 1.4L20 12"/><rect x="3" y="12" width="18" height="6" rx="2"/><path d="M7 15h1"/><path d="M16 15h1"/></g>',
    ),
    backspace: svg(
      '<path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7Z"/><path d="m12 9 5 5"/><path d="m17 9-5 5"/>',
    ),
    power: svg('<path d="M12 3v8"/><path d="M6.6 6.6a7.5 7.5 0 1 0 10.8 0"/>'),
    lock: svg(
      '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>',
    ),
    unlock: svg(
      '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>',
    ),
    shield: svg(
      '<path d="M12 3 5 6v5c0 4.5 3 8.3 7 9.5 4-1.2 7-5 7-9.5V6Z"/><path d="m9.5 12 2 2 3.5-4"/>',
    ),
    camera: svg(
      '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.5"/>',
    ),
    vacuum: svg(
      '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v4"/><circle cx="12" cy="12" r="2"/><path d="M6 17.5 4 20"/><path d="m18 17.5 2 2.5"/>',
    ),
    stop: svg(
      '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
    ),
    dock: svg(
      '<g transform="translate(0 -1)"><path d="M4 20h16"/><path d="M6 20v-8l6-6 6 6v8"/><path d="M10 20v-5h4v5"/></g>',
    ),
    locate: svg(
      '<circle cx="12" cy="12" r="3"/><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><circle cx="12" cy="12" r="7"/>',
    ),
    expand: svg(
      '<path d="M14 4h6v6"/><path d="m20 4-7 7"/><path d="M10 20H4v-6"/><path d="m4 20 7-7"/>',
    ),
    snapshot: svg('<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="8.5"/>'),
    motion: svg(
      '<g transform="translate(2 0)"><circle cx="15" cy="5" r="1.8"/><path d="M11 21v-6l2.5-3-1.5-4L9 9.5"/><path d="M14 11.5 16.5 10"/><path d="m12 13.5 2.5 2 1.5 5.5"/><path d="M5 12 3 9"/><path d="M6 6.5 4 5"/></g>',
    ),
    tilt: svg('<path d="M4 6h16"/><path d="M6 10h12"/><path d="M8 14h8"/><path d="M10 18h4"/>'),
    key: svg(
      '<circle cx="8" cy="12" r="4"/><path d="M12 12h9"/><path d="M18 12v3"/><path d="M15 12v2.5"/>',
    ),
    up: svg('<path d="M6 15l6-6 6 6"/>'),
    down: svg('<path d="M6 9l6 6 6-6"/>'),
    cloud: svg(
      '<g transform="translate(-0.7 0)"><path d="M7 18h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18Z"/></g>',
    ),
    rain: svg(
      '<g transform="translate(-0.7 0)"><path d="M7 15h10a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15Z"/><path d="M9 18l-1 2.5"/><path d="M13 18l-1 2.5"/><path d="M17 18l-1 2.5"/></g>',
    ),
    wind: svg(
      '<path d="M4 10h11a2.5 2.5 0 1 0-2.5-2.5"/><path d="M4 14h13a2.5 2.5 0 1 1-2.5 2.5"/>',
    ),
    person: svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
    map: svg(
      '<path d="m4 6 5-2 6 2 5-2v14l-5 2-6-2-5 2Z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
    ),
    door: svg(
      '<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M4 21h16"/><circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none"/>',
    ),
    warn: svg(
      '<path d="M12 4 3 19h18Z"/><path d="M12 10v4"/><circle cx="12" cy="16.5" r=".9" fill="currentColor" stroke="none"/>',
    ),
    update: svg('<path d="M12 4v10"/><path d="m8 10 4 4 4-4"/><path d="M5 19h14"/>'),
    list: svg(
      '<path d="M9 7h11"/><path d="M9 12h11"/><path d="M9 17h11"/><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="17" r="1" fill="currentColor" stroke="none"/>',
    ),
    calendar: svg(
      '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16"/><path d="M9 3v4"/><path d="M15 3v4"/>',
    ),
    timer: svg(
      '<circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 1.5"/><path d="M10 3h4"/><path d="M12 3v2.5"/>',
    ),
    counter: svg('<path d="M4 12h16"/><path d="M12 4v16"/><circle cx="12" cy="12" r="9"/>'),
    text: svg('<path d="M5 6h14"/><path d="M12 6v13"/><path d="M9 19h6"/>'),
    script: svg(
      '<path d="M8 5h9a2 2 0 0 1 2 2v12H8"/><path d="M8 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2"/><path d="M11 9h5"/><path d="M11 13h5"/>',
    ),
    ha: svg('<path d="M4 12 12 4l8 8"/><path d="M6 10.5V20h12v-9.5"/><path d="M12 20v-5"/>'),
    updown: svg('<path d="m7 9 5-5 5 5"/><path d="m7 15 5 5 5-5"/>'),
    play: svg('<path d="M7 5.5v13l11-6.5Z" fill="currentColor" stroke="none"/>'),
    shuffle: svg(
      '<path d="M4 7h3.5l7 10H20"/><path d="M4 17h3.5l2.2-3.2"/><path d="M14.3 10.2 16.5 7H20"/><path d="m17.5 4.5 2.5 2.5-2.5 2.5"/><path d="m17.5 14.5 2.5 2.5-2.5 2.5"/>',
    ),
    repeat: svg(
      '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
    ),
  };

  /* ---------- text metrics (Inter is loaded before the sheets render) ---------- */
  let probe = null;
  const textWidth = (text, font = '600 13px Inter') => {
    if (!probe) {
      probe = document.createElement('span');
      probe.style.cssText =
        'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:nowrap;font-feature-settings:"cv11","ss01";font-optical-sizing:auto';
      document.body.appendChild(probe);
    }
    const [weight, size, ...family] = font.split(' '); // longhands: the `font` shorthand would reset the features
    probe.style.fontWeight = weight;
    probe.style.fontSize = size;
    probe.style.fontFamily = family.join(' ');
    probe.style.fontVariantNumeric = 'tabular-nums';
    probe.innerHTML = text;
    return probe.getBoundingClientRect().width;
  };
  const up4 = (n) => Math.ceil(n / 4) * 4;

  /* ---------- primitives ---------- */
  const ico = (glyph, tone = 'accent') =>
    `<span class="fv-ico fv-ico--${tone}" data-icon>${G[glyph]}</span>`;

  /* knob boxes land on whole CSS px so the 2px ring stays crisp at every DPR */
  const knob = (x, y, size = 36, tone = 'accent', extra = '') =>
    `<span class="fv-knob fv-knob--${tone} ${extra}" data-measure="value" style="left:${Math.round(x)}px;top:${Math.round(y)}px;width:${size}px;height:${size}px"></span>`;

  /* linear ruler. value 0..1; ticks by VALUE: minor every `minor` (fraction), major every `major`; magnify lifts ticks near the knob */
  const ruler = ({
    w = 320,
    h = 44,
    value = 0.7,
    tone = 'accent',
    minor = 0.05,
    major = 0.25,
    magnify = false,
    active = true,
    knobSize = 36,
    vertical = false,
    focus = false,
    className = '',
    marker = false,
  }) => {
    const len = vertical ? h : w;
    const pos = value * len;
    const steps = Math.round(1 / minor);
    const lines = [];
    const haloR = knobSize / 2 + 7; // ring + 4 px halo + the stroke's half width
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const p = Math.round(f * len); // ticks on whole CSS px: crisp at every DPR (max error 0.5 px)
      if (active && Math.abs(p - pos) < haloR) continue; // whole or absent, never bitten by the halo
      const isMajor = Math.abs(f / major - Math.round(f / major)) < 1e-6;
      let tick = isMajor ? 20 : 10;
      if (magnify) tick += 10 * Math.exp(-((p - pos) ** 2) / (2 * 22 * 22));
      const on = active && p <= pos + 0.5; // lit from the origin (left / bottom) up to the knob
      if (vertical) {
        const y = len - p;
        const x1 = w / 2 - tick / 2;
        lines.push(
          `<line x1="${x1.toFixed(2)}" y1="${y.toFixed(2)}" x2="${(x1 + tick).toFixed(2)}" y2="${y.toFixed(2)}" class="${on ? 'tk-on' : 'tk-off'}"/>`,
        );
      } else {
        const y1 = h / 2 - tick / 2;
        lines.push(
          `<line x1="${p.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${p.toFixed(2)}" y2="${(y1 + tick).toFixed(2)}" class="${on ? 'tk-on' : 'tk-off'}"/>`,
        );
      }
    }
    const extra = (focus ? 'is-focus ' : '') + (marker ? 'fv-knob--marker' : '');
    const size = knobSize;
    const k = active
      ? vertical
        ? knob(w / 2 - size / 2, len - pos - size / 2, size, tone, extra)
        : knob(pos - size / 2, (h - size) / 2, size, tone, extra)
      : '';
    return `<div class="fv-ruler fv-ruler--${tone} ${vertical ? 'fv-ruler--vertical' : ''} ${className}" data-control data-target style="width:${w}px;height:${h}px"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${lines.join('')}</svg>${k}</div>`;
  };

  const axis = (items, w = 320) =>
    `<div class="fv-axis" style="width:${w}px">${items
      .map(([f, t]) => {
        if (f <= 0) return `<span class="is-first" style="left:0">${t}</span>`;
        if (f >= 1) return `<span class="is-last" style="right:0">${t}</span>`;
        return `<span style="left:${(f * w).toFixed(2)}px">${t}</span>`;
      })
      .join('')}</div>`;

  const rulerLabels = (items, w) =>
    `<div class="fv-ruler-labels" style="width:${w}px">${items
      .map(([f, t]) => {
        if (f <= 0) return `<span class="is-first" style="left:0">${t}</span>`;
        if (f >= 1) return `<span class="is-last" style="right:0">${t}</span>`;
        return `<span style="left:${(f * w).toFixed(2)}px">${t}</span>`;
      })
      .join('')}</div>`;

  /*
   * dial: circular ruler. R = radius of the tick ring's inner edge. Ticks radiate outward.
   * Box width = 2·(R + tick + 12); the soft disc sits inside the ring; the knob rides the ring.
   * `from`/`to` are fractions of the 270° sweep (bottom-left → over the top → bottom-right).
   */
  const dial = ({
    R = 120,
    tick = 12,
    min = 0,
    max = 1,
    target = null,
    current = null,
    range = null,
    from = null,
    to = null,
    tone = 'heat',
    value = '21.5',
    unit = '°C',
    sub = '',
    minLabel = '15°',
    maxLabel = '30°',
    knobs = null,
    stepper = true,
    disabled = false,
    focusKnob = -1,
    large = null,
    disc = true,
    label = '',
  }) => {
    const norm = (v) => Math.min(1, Math.max(0, (v - min) / (max - min)));
    const targetF = target === null ? null : norm(target);
    const currentF = current === null ? null : norm(current);
    // active arc: a range shows lo→hi; heating shows min→target; cooling shows target→max; explicit from/to override
    let arcFrom = from;
    let arcTo = to;
    if (arcFrom === null || arcTo === null) {
      if (range) {
        arcFrom = norm(range[0]);
        arcTo = norm(range[1]);
      } else if (tone === 'cool' && targetF !== null) {
        arcFrom = targetF;
        arcTo = 1;
      } else {
        arcFrom = 0;
        arcTo = targetF === null ? 0 : targetF;
      }
    }
    const knobF =
      knobs ||
      (range ? [norm(range[0]), norm(range[1])] : targetF === null || disabled ? [] : [targetF]);
    // half-size on a 4px multiple so the box centres on the grid; disc radius a 4px multiple so its box does too
    const half = Math.ceil((R + tick + 12) / 4) * 4;
    const w = half * 2;
    const cx = w / 2;
    const cy = half;
    const endY = cy + (R + tick) * Math.SQRT1_2;
    const labelTop = Math.ceil((endY + 8) / 4) * 4;
    const stepTop = labelTop + 16 + 12;
    const h = stepper ? stepTop + 44 : labelTop + 16; // labels row, then the stepper pill on its own row
    const start = 135;
    const sweep = 270;
    const ang = (f) => ((start + f * sweep) * Math.PI) / 180;
    const steps = 54;
    const lines = [];
    for (let i = 0; i <= steps; i++) {
      const f = i / steps;
      const a = ang(f);
      const major = i % 9 === 0;
      const len = major ? tick : tick * 0.6;
      const on = !disabled && f >= arcFrom - 1e-6 && f <= arcTo + 1e-6;
      lines.push(
        `<line x1="${(cx + R * Math.cos(a)).toFixed(2)}" y1="${(cy + R * Math.sin(a)).toFixed(2)}" x2="${(cx + (R + len) * Math.cos(a)).toFixed(2)}" y2="${(cy + (R + len) * Math.sin(a)).toFixed(2)}" class="${on ? 'tk-on' : 'tk-off'}"/>`,
      );
    }
    let marker = '';
    if (currentF !== null) {
      const a = ang(currentF);
      marker = `<circle cx="${(cx + (R + tick + 6) * Math.cos(a)).toFixed(2)}" cy="${(cy + (R + tick + 6) * Math.sin(a)).toFixed(2)}" r="3" class="dl-current"/>`;
    }
    const isLarge = large === null ? R >= 100 : large;
    const knobSize = isLarge ? 36 : 28;
    const sizeClass = isLarge ? 'fv-dial--l' : 'fv-dial--s';
    const knobEls = knobF
      .map((f, i) => {
        const a = ang(f);
        return knob(
          cx + R * Math.cos(a) - knobSize / 2,
          cy + R * Math.sin(a) - knobSize / 2,
          knobSize,
          tone,
          i === focusKnob ? 'is-focus' : '',
        );
      })
      .join('');
    const discR = Math.floor((R - 10) / 4) * 4;
    const discEl =
      `<div class="fv-dial__disc ${disc ? '' : 'fv-dial__disc--bare'}" style="left:${cx - discR}px;top:${cy - discR}px;width:${discR * 2}px;height:${discR * 2}px">` +
      (label ? `<p class="fv-dial__label-in">${label}</p>` : '') +
      `<p class="fv-dial__value ${disabled ? 'is-off' : ''}"><span data-baseline="dial">${value}</span>${unit ? `<span class="fv-unit" data-baseline="dial">${unit}</span>` : ''}</p>` +
      (sub ? `<p class="fv-dial__sub">${sub}</p>` : '') +
      `</div>`;
    const labels =
      `<span class="fv-dial__label fv-dial__label--min" style="top:${labelTop}px;left:${(cx - (R + tick) * Math.SQRT1_2 - 8).toFixed(0)}px">${minLabel}</span>` +
      `<span class="fv-dial__label fv-dial__label--max" style="top:${labelTop}px;left:${(cx + (R + tick) * Math.SQRT1_2 - 32).toFixed(0)}px">${maxLabel}</span>`;
    const step = stepper
      ? `<div class="fv-stepper fv-dial__stepper" data-control style="left:${cx - 48}px;top:${stepTop}px">${stepperInner(disabled)}</div>`
      : '';
    return `<div class="fv-dial fv-dial--${tone} ${sizeClass} ${disabled ? 'is-off' : ''} ${disc ? '' : 'fv-dial--gauge'}" style="width:${w}px;height:${h}px"><svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${lines.join('')}${marker}</svg>${discEl}${knobEls}${labels}${step}</div>`;
  };

  const stepperInner = (disabled = false) =>
    `<button class="fv-stepper__half" data-target aria-label="Decrease" ${disabled ? 'disabled' : ''}>${G.minus}</button><button class="fv-stepper__half" data-target aria-label="Increase" ${disabled ? 'disabled' : ''}>${G.plus}</button>`;
  const stepper = (extra = '') =>
    `<div class="fv-stepper ${extra}" data-control>${stepperInner()}</div>`;

  /* option cards: [{label, value, tone, active, glyph}] with a fixed width each */
  /* stat tiles: the option anatomy, read-only (no target), tone fill when `active` */
  const tiles = (items, w, h = 84, fit = 320) =>
    options(items, w, h, fit)
      .replace(/class="fv-option /g, 'class="fv-option fv-option--stat ')
      .replace(/data-target/g, 'data-card');

  let rowSeq = 0;
  const rowGroup = () => `row${++rowSeq}`;

  /* bar row: icon circle · title/sub · value, with a 4 px bar under the text (plants, strings, meters) */
  const barRow = (
    {
      glyph,
      tone = 'neutral',
      title,
      sub = '',
      value = '',
      fraction = 0,
      barTone = tone,
      valueTone = '',
    },
    g = rowGroup(),
  ) =>
    `<div class="fv-row fv-row--bar">${ico(glyph, tone)}<span class="fv-row__text"><span class="fv-row__title" data-baseline="${g}">${title}</span>${sub ? `<span class="fv-row__sub">${sub}</span>` : ''}<span class="fv-bar"><span class="fv-bar__fill fv-bar--${barTone}" data-measure="value" style="width:${Math.round(fraction * 100)}%"></span></span></span><span class="fv-row__value ${valueTone ? `fv-row__value--${valueTone}` : ''}" data-baseline="${g}">${value}</span></div>`;

  /* stacked distribution: one bar of segments + legend rows with square swatches */
  const stack = (items, { w = 320 } = {}) => {
    const total = items.reduce((s, i) => s + i.value, 0);
    const bar =
      `<div class="fv-stack" style="width:${w}px">` +
      items
        .map(
          (i) =>
            `<span class="fv-stack__seg fv-bar--${i.tone}" data-measure="value" style="width:${((i.value / total) * 100).toFixed(2)}%"></span>`,
        )
        .join('') +
      `</div>`;
    const legend =
      `<div class="fv-legend">` +
      items
        .map(
          (i, n) =>
            `<div class="fv-legend__row"><i class="fv-swatch fv-bar--${i.tone}"></i><span class="fv-legend__name" data-baseline="legend${n}">${i.label}</span><span class="fv-legend__value" data-baseline="legend${n}">${i.display}</span></div>`,
        )
        .join('') +
      `</div>`;
    return bar + legend;
  };

  /* option tiles: a small outline glyph top-left, the label, the value; active = pastel fill only (no ring, no dots) */
  const options = (items, w, h = 84, fit = 320) => {
    const gap = items.length > 1 ? (fit - items.length * w) / (items.length - 1) : 0;
    return (
      `<div class="fv-options" style="grid-template-columns:repeat(${items.length}, ${w}px);gap:${gap}px">` +
      items
        .map(
          (o) =>
            `<button class="fv-option ${o.active ? `is-active fv-option--${o.tone || 'accent'}` : ''}" data-target style="height:${h}px">` +
            `<span class="fv-option__glyph">${G[o.glyph || 'dots']}</span>` +
            `<span class="fv-option__label">${o.label}</span>` +
            `<span class="fv-option__value">${o.value || ''}</span></button>`,
        )
        .join('') +
      `</div>`
    );
  };

  /* chips: 14 px sides (text + 28 → 4-grid); tab rows (rooms, views) use the 14 px face with 16 px sides */
  const chips = (items, { pad = 28, className = '' } = {}) =>
    `<div class="fv-chips ${className}">` +
    items
      .map(
        (c) =>
          `<button class="fv-chip ${c.active ? 'is-active' : ''}" data-target ${c.w ? `style="width:${c.w}px"` : `data-fit="${pad}"`}><span class="fv-chip__pill" data-control>${c.glyph ? G[c.glyph] : ''}${c.label}</span></button>`,
      )
      .join('') +
    `</div>`;

  /* fit(): after render, size every [data-fit] pill from its laid-out text (Range) + the side padding, rounded up to 4 */
  const fit = (root = document) => {
    root.querySelectorAll('[data-fit]').forEach((el) => {
      const textEl = el.querySelector('.fv-chip__pill') || el;
      const range = document.createRange();
      range.selectNodeContents(textEl);
      el.style.width = `${up4(range.getBoundingClientRect().width + Number(el.getAttribute('data-fit')))}px`;
    });
  };

  const toggle = (on, tone = 'accent') =>
    `<span class="fv-hit" data-target><span class="fv-switch fv-switch--${tone} ${on ? 'is-on' : ''}" data-control role="switch" aria-checked="${on}"><span class="fv-switch__thumb"></span></span></span>`;

  const listRow = ({
    glyph,
    title,
    sub = '',
    trailing = 'chevron',
    on = false,
    value = '',
    tone = 'neutral',
    valueTone = '',
    action = 'play',
    html = '',
  }) => {
    const g = trailing === 'value' && !sub ? rowGroup() : ''; // one-line rows share the title's baseline; two-line rows centre the value on the pair
    const tail =
      trailing === 'switch'
        ? toggle(on)
        : trailing === 'value'
          ? `<span class="fv-row__value ${valueTone ? `fv-row__value--${valueTone}` : ''}"${g ? ` data-baseline="${g}"` : ''}>${value}</span>`
          : trailing === 'action'
            ? round(action, 'fv-round--quiet', action)
            : trailing === 'html'
              ? html
              : `<span class="fv-row__chevron">${G.chevron}</span>`;
    return `<div class="fv-row"><span class="fv-ico fv-ico--${tone}" data-icon>${G[glyph]}</span><span class="fv-row__text"><span class="fv-row__title"${g ? ` data-baseline="${g}"` : ''}>${title}</span>${sub ? `<span class="fv-row__sub">${sub}</span>` : ''}</span>${tail}</div>`;
  };

  const readout = ({ label, value, unit = '', trend = null, size = 'm', group = 'r' }) =>
    `<div class="fv-readout fv-readout--${size}"><p class="fv-readout__label">${label}</p>` +
    `<p class="fv-readout__value"><span data-baseline="${group}">${value}</span>${unit ? `<span class="fv-unit" data-baseline="${group}">${unit}</span>` : ''}${trend ? `<span class="fv-trend ${trend === 'trendDown' ? 'fv-trend--down' : ''}">${G[trend]}</span>` : ''}</p></div>`;

  /* smooth curve (Catmull-Rom → cubic Bézier) with gradient fill, dashed cursor and dot */
  /* extent = fraction of the width the series covers (a 24 h axis at 21:47 → 0.908); cursor defaults to the series end ("now") */
  const curve = (
    values,
    {
      w = 320,
      h = 120,
      pad = 8,
      padTop = null,
      padX = 0,
      extent = 1,
      cursor = null,
      id = 'fv-fill',
    } = {},
  ) => {
    const max = Math.max(...values);
    const min = Math.min(...values);
    const top = padTop === null ? pad : padTop;
    const span = padX + (w - padX * 2) * extent;
    const pts = values.map((v, i) => [
      padX + (i / (values.length - 1)) * (span - padX),
      top + (1 - (v - min) / (max - min)) * (h - top - pad),
    ]);
    if (cursor === null) cursor = span / w;
    let d = `M${pts[0][0]},${pts[0][1].toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
    }
    const cx = cursor * w;
    const cf = Math.min(Math.max((cx - padX) / (span - padX), 0), 1);
    const seg = Math.min(Math.floor(cf * (values.length - 1)), values.length - 2);
    const t = cf * (values.length - 1) - seg;
    const cy = pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * t;
    return (
      `<svg class="fv-curve" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">` +
      `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="curve-fill-a"/><stop offset="1" class="curve-fill-b"/></linearGradient></defs>` +
      `<path d="${d} L${span.toFixed(2)},${h} L0,${h} Z" fill="url(#${id})" stroke="none"/><path d="${d}" class="curve-line"/>` +
      `<line x1="${cx}" y1="${Math.max(top, cy + 7)}" x2="${cx}" y2="${h}" class="curve-cursor"/><circle cx="${cx}" cy="${cy.toFixed(2)}" r="5" class="curve-dot"/></svg>`
    );
  };

  /* value bubble anchored above a knob at x (clamped inside the w wide row) */
  const bubble = (x, text, unit = '', w = 320, bw = 80) => {
    const left = Math.min(Math.max(x - bw / 2, 0), w - bw);
    return `<span class="fv-bubble" data-measure="value" style="left:${left.toFixed(2)}px;width:${bw}px;--tail:${Math.round(x - left - 6)}px"><b>${text}</b>${unit}</span>`;
  };

  /* buttons size from content (16 px sides → text + 32 → 4-grid) unless a width is given (paired actions) */
  const button = (text, kind = 'quiet', w = null) =>
    `<button class="fv-btn fv-btn--${kind}" data-control data-target ${w ? `style="width:${w}px"` : 'data-fit="32"'}>${text}</button>`;
  const badge = (text, tone, w = null) =>
    `<span class="fv-badge fv-badge--${tone}" data-control ${w ? `style="width:${w}px"` : 'data-fit="28"'}>${text}</span>`;
  /* action row: glyph buttons that share the column — equal widths on the 4 grid (2 × 152, 3 × 96, 4 × 68, gap 16), 44 tall, radius 12 */
  const actions = (items, fit = 320) => {
    const gap = 16;
    const w = (fit - gap * (items.length - 1)) / items.length;
    return (
      `<div class="fv-actions" style="grid-template-columns:repeat(${items.length}, ${w}px)">` +
      items
        .map(
          (i) =>
            `<button class="fv-action ${i.primary ? 'fv-action--accent' : ''}" data-control data-target aria-label="${i.label}">${G[i.glyph]}</button>`,
        )
        .join('') +
      `</div>`
    );
  };

  const round = (glyph, extra = '', label = '') =>
    `<button class="fv-round ${extra}" data-control data-target aria-label="${label}">${G[glyph]}</button>`;
  const head = ({ glyph, tone = 'accent', title, sub = '', trailing = '' }) =>
    `<div class="fv-card__head">${ico(glyph, tone)}<div class="fv-card__titles"><h3 class="fv-card__title">${title}</h3>${sub ? `<p class="fv-card__sub">${sub}</p>` : ''}</div>${trailing}</div>`;
  const label = (text) => `<p class="fv-label">${text}</p>`;

  globalThis.FLUVY = {
    actions,
    button,
    axis,
    textWidth,
    fit,
    tiles,
    barRow,
    stack,
    G,
    ico,
    knob,
    ruler,
    rulerLabels,
    dial,
    stepper,
    options,
    chips,
    toggle,
    listRow,
    readout,
    badge,
    round,
    head,
    label,
    curve,
    bubble,
  };
  globalThis.HOME_GLYPHS = G;
})();
