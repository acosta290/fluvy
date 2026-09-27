/* The fluvy mark ("Current", chosen 2026-09-17; the Dial and Initial routes were dropped). The mark is one path on a 24-unit grid, stroke 2 (drawn as filled outlines where a
   stroke would not survive 16 px), rendered at 16 → 512, on light and dark, inverted, and blurred ("squint"). */
(() => {
  'use strict';

  /* "Current": a rounded tile (the card) with a flowing wave carved through it (even-odd). */
  const A = `<path fill="currentColor" fill-rule="evenodd" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5ZM3.04,12.95 L3.44,13.36 L3.86,13.77 L4.29,14.18 L4.74,14.57 L5.21,14.93 L5.71,15.26 L6.23,15.54 L6.80,15.76 L7.39,15.90 L8.00,15.95 L8.61,15.90 L9.20,15.76 L9.77,15.54 L10.29,15.26 L10.79,14.93 L11.26,14.57 L11.71,14.18 L12.14,13.77 L12.56,13.36 L12.96,12.95 L13.36,12.55 L13.74,12.17 L14.11,11.82 L14.46,11.51 L14.79,11.26 L15.09,11.06 L15.37,10.91 L15.60,10.82 L15.81,10.77 L16.00,10.75 L16.19,10.77 L16.40,10.82 L16.63,10.91 L16.91,11.06 L17.21,11.26 L17.54,11.51 L17.89,11.82 L18.26,12.17 L18.64,12.55 L19.04,12.95 A1.35,1.35 0 0 1 20.96,11.05 L20.96,11.05 L20.56,10.64 L20.14,10.23 L19.71,9.82 L19.26,9.43 L18.79,9.07 L18.29,8.74 L17.77,8.46 L17.20,8.24 L16.61,8.10 L16.00,8.05 L15.39,8.10 L14.80,8.24 L14.23,8.46 L13.71,8.74 L13.21,9.07 L12.74,9.43 L12.29,9.82 L11.86,10.23 L11.44,10.64 L11.04,11.05 L10.64,11.45 L10.26,11.83 L9.89,12.18 L9.54,12.49 L9.21,12.74 L8.91,12.94 L8.63,13.09 L8.40,13.18 L8.19,13.23 L8.00,13.25 L7.81,13.23 L7.60,13.18 L7.37,13.09 L7.09,12.94 L6.79,12.74 L6.46,12.49 L6.11,12.18 L5.74,11.83 L5.36,11.45 L4.96,11.05 A1.35,1.35 0 0 1 3.04,12.95 Z"/>`;

  const routes = [['A', 'Current', 'The card, with the flow running through it.', A]];

  const mark = (body, size, cls = '') =>
    `<svg class="lg-mark ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const sizes = [16, 24, 32, 48, 64, 128];

  const row = (body) =>
    `<div class="lg-sizes">${sizes.map((s) => `<span class="lg-cell" style="width:${Math.max(s, 44)}px">${mark(body, s)}</span>`).join('')}</div>`;

  const route = ([, name, blurb, body]) => `
<article class="fv-card lg-route" data-card>
  <div class="lg-head"><span class="lg-key">${mark(body, 20)}</span><div class="fv-card__titles"><h3 class="fv-card__title">${name}</h3><p class="fv-card__sub">${blurb}</p></div></div>
  <div class="lg-hero">
    <span class="lg-app">${mark(body, 56)}</span>
    <span class="lg-lockup">${mark(body, 32)}<span class="lg-word">fluvy</span></span>
    <span class="lg-lockup lg-lockup--inv">${mark(body, 32)}<span class="lg-word">fluvy</span></span>
  </div>
  ${row(body)}
  <div class="lg-squint">${mark(body, 24, 'is-blur')}${mark(body, 48, 'is-blur')}${mark(body, 96, 'is-blur')}<span class="fv-card__sub">squint · 2 px blur</span></div>
</article>`;

  const frame = (mode) => `
<div class="fv-frame lg-frame" data-frame data-mode="${mode}" data-palette="linen">
  ${routes.map((r) => route(r)).join('')}
</div>`;

  globalThis.renderLogo = (root) => {
    root.innerHTML = frame('light') + frame('dark');
  };
})();
