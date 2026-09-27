/* Media family on fluvy primitives: player card, volume, sources/group, mini row, now-playing sheet, states. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const { G } = F;

  const art = (size, cls = '') =>
    `<span class="fv-art ${cls}" style="width:${size}px;height:${size}px"></span>`;
  /* seek bar: thin track + the compact (28) knob, centred in a 44 band */
  const progress = (value, w = 320) =>
    `<div class="md-progress" data-control style="width:${w}px"><span class="md-progress__fill" data-measure="value" style="width:${(value * w).toFixed(2)}px"></span>${F.knob(value * w - 14, 8, 28, 'accent')}</div>`;
  const times = (a, b) => `<div class="md-times"><span>${a}</span><span>${b}</span></div>`;
  /* one row of five equal rounds: shuffle · prev · play/pause · next · repeat (48 on cards, 56 on the sheet) */
  const transport = (playing = true, size = 48) =>
    `<div class="md-controls md-controls--${size}">${F.round('shuffle', 'fv-round--quiet', 'Shuffle')}${F.round('prev', 'fv-round--quiet', 'Previous')}${F.round(playing ? 'pause' : 'play', 'fv-round--accent', playing ? 'Pause' : 'Play')}${F.round('next', 'fv-round--quiet', 'Next')}${F.round('repeat', 'fv-round--quiet', 'Repeat')}</div>`;
  /* volume: label, ruler, mute at the right — same layout on card (256 + 20 + 44) and sheet (296 + 20 + 44) */
  const volume = (w) =>
    F.label('Volume') +
    `<div class="md-volume">${F.ruler({ w, h: 44, value: 0.42, tone: 'accent' })}${F.round('volume', 'fv-round--quiet', 'Mute')}</div>`;
  /* source chips are content-sized (14 px sides) */
  const sources = (active = 'Spotify') =>
    F.chips([
      { label: 'Spotify', active: active === 'Spotify' },
      { label: 'Radio', active: active === 'Radio' },
      { label: 'AirPlay', active: active === 'AirPlay' },
      { label: 'TV', active: active === 'TV' },
    ]);

  const playerCard = (mode = 'light', playing = true) => `
<article class="fv-frame fv-card md-card" data-frame data-mode="${mode}" data-palette="linen" data-card>
  <div class="md-now">${art(80)}<div class="md-now__text"><h3 class="fv-card__title md-title">Midnight Coda</h3><p class="fv-card__sub">Ola Gjeilo · Winter Songs</p><p class="fv-card__sub md-source">${G.speaker}Kitchen speaker</p></div>${F.round('dots', 'fv-round--quiet', 'More')}</div>
  <div class="md-seek">${progress(0.38)}${times('1:24', '3:42')}</div>
  ${transport(playing)}
  ${volume(256)}
</article>`;

  const sourcesCard = () => `
<article class="fv-frame fv-card md-card" data-frame data-mode="light" data-palette="linen" data-card>
  ${F.head({ glyph: 'speaker', tone: 'media', title: 'Speakers', sub: 'Play on · group', trailing: F.badge('2 playing', 'media') })}
  ${F.label('Playing on')}
  ${F.options(
    [
      { label: 'Kitchen', value: 'Playing', tone: 'media', glyph: 'speaker', active: true },
      { label: 'Living', value: 'Playing', tone: 'media', glyph: 'speaker', active: true },
      { label: 'Bedroom', value: 'Idle', tone: 'neutral', glyph: 'speaker' },
    ],
    104,
  )}
  ${F.label('Source')}
  ${sources('Spotify')}
  <div class="md-rows">
    ${F.listRow({ glyph: 'volume', title: 'Group volume', sub: 'Follows the master speaker', trailing: 'value', value: '42 %', tone: 'neutral' })}
    ${F.listRow({ glyph: 'sliders', title: 'Equaliser', sub: 'Warm · bass +2', trailing: 'chevron', tone: 'neutral' })}
  </div>
</article>`;

  /* compact cards: padding 16, rounds 44 (documented in the language) */
  const miniRows = () => `
<div class="fv-frame md-mini" data-frame data-mode="light" data-palette="linen">
  <article class="fv-card md-mini__card" data-card>
    <div class="md-mini__row">${art(44, 'md-art--s')}<div class="fv-row__text"><span class="fv-row__title">Midnight Coda</span><span class="fv-row__sub">Kitchen speaker · 1:24</span></div>${F.round('pause', 'fv-round--accent', 'Pause')}${F.round('next', 'fv-round--quiet', 'Next')}</div>
  </article>
  <article class="fv-card md-mini__card" data-card>
    <div class="md-mini__row">${F.ico('speaker', 'neutral')}<div class="fv-row__text"><span class="fv-row__title">Bedroom speaker</span><span class="fv-row__sub">Idle · last played 2 h ago</span></div>${F.round('play', 'fv-round--quiet', 'Play')}</div>
  </article>
  <article class="fv-tile fv-tile--off md-mini__off" data-card>${F.ico('ban', 'off')}<div class="fv-row__text"><span class="fv-row__title">Garden speaker</span><span class="fv-row__sub">Unavailable · since 09:12</span></div></article>
</div>`;

  const sheet = (mode = 'light') => `
<div class="fv-frame fv-sheet md-sheet" data-frame data-mode="${mode}" data-palette="linen">
  <div class="fv-sheet__grabber"><span></span></div>
  <div class="fv-sheet__head"><div class="fv-card__titles"><h2 class="fv-sheet__title">Now playing</h2><p class="fv-card__sub">Kitchen speaker · Spotify</p></div>${F.round('close', 'fv-round--quiet', 'Close')}</div>
  <div class="md-hero">${art(200, 'md-art--l')}</div>
  <div class="md-hero__text"><h3 class="md-hero__title">Midnight Coda</h3><p class="fv-card__sub">Ola Gjeilo · Winter Songs</p></div>
  <div class="md-seek md-seek--sheet">${progress(0.38, 360)}${times('1:24', '3:42')}</div>
  ${transport(true, 56)}
  ${volume(296)}
  ${F.label('Up next')}
  <div class="md-rows">
    ${F.listRow({ glyph: 'note', title: 'Northern Lights', sub: 'Ola Gjeilo · 4:12', trailing: 'action', action: 'play', tone: 'neutral' })}
    ${F.listRow({ glyph: 'note', title: 'Tundra', sub: 'Ola Gjeilo · 5:03', trailing: 'action', action: 'play', tone: 'neutral' })}
    ${F.listRow({ glyph: 'note', title: 'The Ground', sub: 'Ola Gjeilo · 3:38', trailing: 'action', action: 'play', tone: 'neutral' })}
  </div>
</div>`;

  const emptyCard = () => `
<article class="fv-frame fv-card md-card md-card--empty" data-frame data-mode="light" data-palette="linen" data-card>
  ${F.head({ glyph: 'speaker', tone: 'neutral', title: 'Living room speaker', sub: 'Last played 2 h ago', trailing: F.badge('Idle', 'neutral') })}
  <div class="fv-empty-state md-empty" role="status"><span class="fv-empty-state__ring">${G.speaker}</span><span class="fv-empty-state__text">Pick something to play</span></div>
  ${F.label('Source')}
  ${sources('')}
</article>`;

  globalThis.renderMedia = (root) => {
    root.innerHTML =
      playerCard('light') +
      sheet('light') +
      sourcesCard() +
      miniRows() +
      emptyCard() +
      playerCard('dark');
  };
})();
