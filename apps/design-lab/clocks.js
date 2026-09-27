/* Clock set (round 7 v2): analog faces as ONE component with a numerals option, digital as ONE component
   (seconds / 12 h), a hero clock + weather, a compact side face, and a 2 × 2 tile row. One state everywhere:
   21:47:12, Thursday 17 September, clear night, 18 °C. Plain clocks are accent; a weather clock takes the sky's tone
   (accent at night, solar by day). */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const H = 21,
    M = 47,
    S = 12;
  const card = (mode, body, cls = '') =>
    `<article class="fv-frame fv-card ck-card ${cls}" data-frame data-mode="${mode}" data-palette="linen" data-card>${body}</article>`;

  /* the face family scales with R: majors R/10, minors R/20 (majors only at R 56); hands 5 / 3.3 / 1.7 % of R,
     hour 0.52 R inside the numerals, minute 0.85 R and second 0.88 R end at the tick ring (over the numerals);
     the second hand carries a real counterweight (cap radius + 8); cap = the fluvy knob without halo or lift:
     28 at R ≥ 96, 20 at 72, 16 at 56 */
  const face = ({ R = 120, tone = 'accent', numerals = 'none', seconds = true, cls = '' }) => {
    const pad = 12;
    const w = (R + pad) * 2;
    const c = R + pad;
    const cap = R >= 96 ? 28 : R >= 72 ? 20 : 16;
    const majorLen = Math.round(R / 10);
    const minorLen = Math.round(R / 20);
    const widths = R >= 96 ? [6, 4, 2] : R >= 72 ? [5, 3, 2] : [4, 3, 2];
    const lines = [];
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      if (!major && R < 72) continue;
      const a = ((i * 6 - 90) * Math.PI) / 180;
      const len = major ? majorLen : minorLen;
      const r1 = R - len;
      lines.push(
        `<line x1="${(c + r1 * Math.cos(a)).toFixed(2)}" y1="${(c + r1 * Math.sin(a)).toFixed(2)}" x2="${(c + R * Math.cos(a)).toFixed(2)}" y2="${(c + R * Math.sin(a)).toFixed(2)}" class="${major ? 'ck-major' : 'ck-minor'}"/>`,
      );
    }
    const nums = [];
    const set =
      numerals === 'all'
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        : numerals === 'quarters'
          ? [12, 3, 6, 9]
          : [];
    for (const n of set) {
      const a = ((n * 30 - 90) * Math.PI) / 180;
      const r = R * 0.75; // the numeral ring scales with the family (R − 30 at R 120)
      nums.push(
        `<text x="${(c + r * Math.cos(a)).toFixed(2)}" y="${(c + r * Math.sin(a)).toFixed(2)}" class="ck-num ${R < 72 ? 'ck-num--s' : ''}" text-anchor="middle" dominant-baseline="central">${n}</text>`,
      );
    }
    const hand = (deg, len, width, cls2, tail = 0) => {
      const a = ((deg - 90) * Math.PI) / 180;
      return `<line x1="${(c - tail * Math.cos(a)).toFixed(2)}" y1="${(c - tail * Math.sin(a)).toFixed(2)}" x2="${(c + len * Math.cos(a)).toFixed(2)}" y2="${(c + len * Math.sin(a)).toFixed(2)}" class="${cls2}" stroke-width="${width}"/>`;
    };
    const hourDeg = ((H % 12) + M / 60) * 30;
    const minDeg = (M + S / 60) * 6;
    const secDeg = S * 6;
    const hands =
      hand(hourDeg, R * 0.52, widths[0], 'ck-hour') +
      hand(minDeg, R * 0.85, widths[1], 'ck-minute') +
      (seconds ? hand(secDeg, R * 0.88, widths[2], 'ck-second', cap / 2 + 8) : ''); // minute and second pass over the numerals and end at the tick ring
    const knob = F.knob(c - cap / 2, c - cap / 2, cap, tone);
    return (
      `<div class="ck-face ck-face--${tone} ${cls}" style="width:${w}px;height:${w}px">` +
      `<svg width="${w}" height="${w}" viewBox="0 0 ${w} ${w}" aria-hidden="true">${lines.join('')}${nums.join('')}${hands}</svg>${knob}</div>`
    );
  };

  const weatherRow = () =>
    `<div class="ck-cols fv-cols">${F.readout({ label: 'Outside', value: '18', unit: '°C', size: 's', group: 'w' })}${F.readout({ label: 'Tonight', value: '13', unit: '°C', size: 's', group: 'w' })}${F.readout({ label: 'Tomorrow', value: '23', unit: '°C', size: 's', group: 'w' })}</div>`;
  const big = (text, unit = '') =>
    `<p class="ck-big" data-align="optical"><span data-baseline="d">${text}</span>${unit ? `<span class="ck-big__unit" data-baseline="d">${unit}</span>` : ''}</p>`;

  /* --- analog: one component, the numerals option --- */
  const a1 = () =>
    card(
      'light',
      `<div class="ck-center">${face({ R: 120 })}</div><p class="ck-caption">Thursday 17 September</p>`,
    );
  const a2 = () =>
    card(
      'light',
      `<div class="ck-center">${face({ R: 120, numerals: 'quarters' })}</div><p class="ck-caption">Thursday 17 September</p>`,
    );
  const a3 = () =>
    card(
      'dark',
      `<div class="ck-center">${face({ R: 120, numerals: 'all' })}</div><p class="ck-caption">Thursday 17 September</p>`,
    );
  /* compact side face: the ring's outer edge on the column, 20 to the text; the next sun event, not the past one */
  const a4 = () =>
    card(
      'light',
      `<div class="ck-side">${face({ R: 72, seconds: false })}<div class="ck-side__text"><p class="ck-time" data-align="optical">21:47</p><p class="fv-card__sub">Thu 17 Sep</p><p class="fv-card__sub">Sunrise 07:31</p></div></div>`,
    );
  /* clock + weather as one object: face, one caption line, the readout row (no head, no badge) */
  const a5 = () =>
    card(
      'light',
      `<div class="ck-center">${face({ R: 96, numerals: 'quarters' })}</div><p class="ck-caption">Clear night · feels 16° · wind 12 km/h NW</p>` +
        weatherRow(),
    );
  const a6 = () =>
    card(
      'dark',
      `<div class="ck-side">${face({ R: 72, seconds: false })}<div class="ck-side__text"><p class="ck-time" data-align="optical">21:47</p><p class="fv-card__sub">Thu 17 Sep</p><p class="fv-card__sub">Clear night</p></div></div>` +
        weatherRow(),
    );

  /* --- digital: one component (seconds, 12 h by locale), the hero clock + weather, the readout foot --- */
  const d1 = () =>
    card(
      'light',
      `${big('21:47')}<p class="ck-caption ck-caption--left">Thursday 17 September</p>`,
    );
  const d2 = () =>
    card(
      'light',
      `${big('21:47', ':12')}<p class="ck-caption ck-caption--left">Thursday 17 September · week 38</p>`,
    );
  const d3 = () =>
    card(
      'dark',
      `${big('9:47', 'PM')}<p class="ck-caption ck-caption--left">Thursday, September 17</p>`,
    );
  const d4 = () =>
    card(
      'light',
      `<div class="ck-split"><div>${big('21:47')}<p class="ck-caption ck-caption--left" data-baseline="dt">Thursday 17 September</p></div><div class="ck-split__side">${F.ico('moon', 'accent').replace('fv-ico ', 'fv-ico fv-ico--hero ')}<p class="ck-temp"><span data-baseline="dt">18</span><span class="fv-unit" data-baseline="dt">°C</span></p></div></div>`,
    );
  const d5 = () =>
    card(
      'dark',
      `${big('21:47')}<p class="ck-caption ck-caption--left">Thursday 17 September · clear night</p>` +
        weatherRow(),
    );
  /* tiles: one anatomy for the digital pair (time · state · readout foot); analog tiles are the face alone */
  const d6 = () => `
<div class="fv-frame ck-tiles" data-frame data-mode="light" data-palette="linen">
  <div class="fv-grid2">
    <article class="fv-tile ck-tile" data-card><p class="ck-tile__time" data-baseline="tt" data-align="optical">21:47</p><p class="fv-tile__state">Thu 17 Sep</p><div class="fv-tile__foot">${F.readout({ label: 'Sunrise', value: '07:31', size: 'xs', group: 'tf' })}${F.readout({ label: 'Sunset', value: '20:12', size: 'xs', group: 'tf' })}</div></article>
    <article class="fv-tile ck-tile" data-card><p class="ck-tile__time" data-baseline="tt" data-align="optical">21:47</p><p class="fv-tile__state">Clear night</p><div class="fv-tile__foot">${F.readout({ label: 'Outside', value: '18', unit: '°C', size: 'xs', group: 'tf' })}${F.readout({ label: 'Tonight', value: '13', unit: '°C', size: 'xs', group: 'tf' })}</div></article>
  </div>
  <div class="fv-grid2 ck-tiles__row">
    <article class="fv-tile ck-tile ck-tile--analog" data-card>${face({ R: 56, seconds: false })}</article>
    <article class="fv-tile ck-tile ck-tile--analog" data-card>${face({ R: 56, numerals: 'quarters', seconds: false })}</article>
  </div>
</div>`;

  globalThis.renderClocks = (root) => {
    root.innerHTML =
      a1() + d1() + a2() + d2() + a3() + d3() + a4() + d4() + a5() + d5() + a6() + d6();
  };
})();
