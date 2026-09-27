/* View backgrounds: three-stop mesh gradients in the palette's own hues (no photos, ≤ 8 KB of CSS), shown under real
   cards so legibility is judged, not the gradient. Light: warm paper. Dark: charcoal with an amber breath. Wall: the dark
   mesh one step deeper for a panel that is always on. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;

  const tile = ({ glyph, name, state, on, tone = 'accent' }) =>
    `<article class="fv-tile fv-tile--${tone} ${on ? 'is-on' : ''}" data-card><div class="fv-tile__head">${F.ico(glyph, on ? tone : 'accent')}${F.toggle(on, tone)}</div><h3 class="fv-tile__name">${name}</h3><p class="fv-tile__state">${state}</p></article>`;

  const cards = () => `
<div class="bg-cards">
  <div class="fv-grid2">${tile({ glyph: 'bulb', name: 'Ceiling', state: 'On · 70 %', on: true, tone: 'light' })}${tile({ glyph: 'bulb', name: 'Reading', state: 'Off', on: false, tone: 'light' })}</div>
  <article class="fv-card" data-card>
    ${F.head({ glyph: 'thermo', tone: 'heat', title: 'Thermostat', sub: 'Living room · 46 % RH', trailing: F.badge('Heating', 'heat') })}
    <div class="bg-rows">${F.listRow({ glyph: 'clock', title: 'Schedule', sub: 'Weekdays · 06:30 – 22:00', trailing: 'chevron', tone: 'neutral' })}</div>
  </article>
  <article class="fv-tile fv-tile--off bg-off" data-card>${F.ico('ban', 'off')}<div class="fv-row__text"><span class="fv-row__title">Porch light</span><span class="fv-row__sub">Unavailable · 2 h</span></div></article>
</div>`;

  const view = (mode, kind, name, blurb) => `
<div class="fv-frame bg-frame bg-frame--${kind}" data-frame data-mode="${mode}" data-palette="linen">
  <div class="bg-caption"><span class="bg-caption__name">${name}</span><span class="bg-caption__blurb">${blurb}</span></div>
  <div class="bg-viewport">
    <header class="bg-bar"><span class="bg-bar__title">Home</span><span class="bg-bar__time">21:47</span></header>
    ${cards()}
  </div>
</div>`;

  globalThis.renderBackgrounds = (root) => {
    root.innerHTML =
      view('light', 'paper', 'Paper', 'Linen light · page + a warm mesh, 3 stops') +
      view('dark', 'charcoal', 'Charcoal', 'Linen dark · page + an amber breath, 3 stops') +
      view('light', 'plain', 'Plain', 'Linen light · the page colour alone (default)') +
      view('dark', 'wall', 'Wall', 'Linen dark, one step deeper · always-on panel');
  };
})();
