/* The glyph sets of 1.23 (#226): every new glyph by its family, with its `fluvy:` name, at 16, 20 (a circle's, on its
   tone's fill) and 24, light and dark — the strokes `FLUVY.GLYPH_SETS` keeps, the same as the cards'. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;

  const TITLES = {
    levels: 'Levels: a battery, a signal, a valve',
    energy: 'Energy',
    devices: 'Devices',
    climate: 'Climate and air',
    safety: 'Water and safety',
    outdoor: 'Outdoors',
    home: 'Home',
    rooms: 'Rooms',
  };

  const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

  const glyph = (name, svg) =>
    `<figure class="ic-glyph"><div class="ic-sizes"><span class="ic-bare ic-bare--16">${svg}</span><span class="fv-ico fv-ico--accent">${svg}</span><span class="ic-bare ic-bare--24">${svg}</span></div><figcaption class="ic-name">${kebab(name)}</figcaption></figure>`;

  const family = (key, glyphs) =>
    `<article class="fv-card ic-family" data-card><div class="fv-card__titles"><h3 class="fv-card__title">${TITLES[key]}</h3><p class="fv-card__sub">fluvy:&lt;name&gt; · 16, 20 and 24</p></div><div class="ic-grid">${Object.entries(
      glyphs,
    )
      .map(([name, svg]) => glyph(name, svg))
      .join('')}</div></article>`;

  const frame = (mode) =>
    `<div class="fv-frame ic-frame" data-frame data-mode="${mode}" data-palette="linen">${Object.entries(
      F.GLYPH_SETS,
    )
      .map(([key, glyphs]) => family(key, glyphs))
      .join('')}</div>`;

  globalThis.renderIcons = (root) => {
    root.innerHTML = frame('light') + frame('dark');
  };
})();
