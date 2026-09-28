/* Rooms and the map (ambient family): a room's card in the area anatomy — its photo under the name pill, its
   readouts, its rows or its controls — and the map's zones as columns of faces. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const { G } = F;

  /* the living room's photo: a drawing, so the sheet fetches nothing */
  const PHOTO = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9c7a8"/><stop offset="1" stop-color="#8c6f4e"/></linearGradient><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b89a72" stop-opacity="0"/><stop offset="1" stop-color="#b89a72" stop-opacity="0.9"/></linearGradient></defs><rect width="320" height="200" fill="url(#g)"/><ellipse cx="120" cy="215" rx="230" ry="80" fill="url(#f)"/><circle cx="250" cy="70" r="30" fill="#f3e6c8" opacity="0.8"/></svg>',
  )}`;

  const frame = (mode, body, cls = '') =>
    `<div class="fv-frame rm-frame ${cls}" data-frame data-mode="${mode}" data-palette="linen">${body}</div>`;
  const areaCard = (body, cls = '') =>
    `<article class="fv-card am-card am-card--area ${cls}" data-card>${body}</article>`;

  const hero = (name, photo) =>
    `<div class="rm-hero ${photo ? 'rm-hero--tap' : ''}">${
      photo
        ? `<img class="fv-plate__img is-on" src="${photo}" alt="" draggable="false" /><span class="rm-hero__scrim" data-measure="skip"></span>`
        : ''
    }<span class="am-area__badge" data-fit="28">${G.home}${name}</span></div>`;

  const stats = (temperature, humidity, on, total) =>
    `<div class="am-area__stats" data-align="center">${F.readout({ label: 'Temperature', value: temperature, unit: '°C', group: 'a' })}${F.readout({ label: 'Humidity', value: humidity, unit: '%', group: 'a' })}${F.readout({ label: 'Devices on', value: on, unit: `of ${total}`, group: 'a' })}</div>`;

  const rows = () =>
    `<div class="am-rows">${F.listRow({ glyph: 'bulb', title: 'Lights', sub: '2 of 3 on', trailing: 'chevron', tone: 'light' })}${F.listRow({ glyph: 'thermo', title: 'Climate', sub: 'Heating to 21.5°', trailing: 'chevron', tone: 'heat' })}${F.listRow({ glyph: 'speaker', title: 'Media', sub: 'Off', trailing: 'chevron', tone: 'neutral' })}${F.listRow({ glyph: 'grid', title: 'All devices', sub: '1 unavailable', trailing: 'chevron', tone: 'neutral' })}</div>`;
  /* the kitchen at rest: nothing on, the heating idle */
  const quietRows = () =>
    `<div class="am-rows">${F.listRow({ glyph: 'bulb', title: 'Lights', sub: 'All off', trailing: 'chevron', tone: 'neutral' })}${F.listRow({ glyph: 'thermo', title: 'Climate', sub: 'Idle · 22.8°', trailing: 'chevron', tone: 'neutral' })}${F.listRow({ glyph: 'grid', title: 'All devices', sub: 'All off', trailing: 'chevron', tone: 'neutral' })}</div>`;

  const compactTile = (glyph, name, state, on, tone = 'light', inner = false) =>
    `<article class="fv-tile fv-tile--compact ${inner ? 'fv-tile--inner' : ''} fv-tile--${tone} fv-tile--tap ${on ? 'is-on' : ''}" data-card>${F.ico(glyph, on ? tone : inner ? 'accent' : 'neutral')}<div class="fv-tile__text"><h3 class="fv-tile__name">${name}</h3><p class="fv-tile__state">${state}</p></div></article>`;
  /* the room's controls: inner tiles (84, radius 12, page fill, no hairline; on = the tone's fill) */
  const controls = () =>
    `<div class="rm-controls">${compactTile('bulb', 'Ceiling', 'On · 70 %', true, 'light', true)}${compactTile('bulb', 'Reading lamp', 'Off', false, 'light', true)}${compactTile('bulb', 'Shelf', 'On', true, 'light', true)}${compactTile('plug', 'TV plug', 'On', true, 'accent', true)}</div>`;

  /* the room: photo · rows (the approved area card with its picture), tiles as controls, no photo */
  const roomPhoto = () =>
    areaCard(hero('Living room', PHOTO) + stats('21.4', '46', '4', '10') + rows());
  const roomTiles = () =>
    areaCard(hero('Living room', PHOTO) + stats('21.4', '46', '4', '10') + controls());
  const roomPlain = () =>
    areaCard(hero('Kitchen', '') + stats('22.8', '51', '0', '3') + quietRows());

  /* the tile variant: the head (its sub in the compact idiom, degrees without the unit; "opens" as the bare
     chevron of a row), then the controls */
  const roomTile = () =>
    `<article class="fv-card am-card" data-card>${F.head({ glyph: 'home', tone: 'accent', title: 'Living room', sub: '4 of 10 on · 21.4°', trailing: `<button class="fv-hit fv-head__open" aria-label="Living room">${G.chevron}</button>` })}${controls()}</article>`;

  /* the row variant: the card is one compact tile; the strategy lays two side by side (the state line is
     measured: at 176 the climate gives way and the count stays) */
  const roomRows = () =>
    `<div class="fv-tiles fv-tiles--2">${compactTile('home', 'Living room', '4 of 10 on', true, 'accent')}${compactTile('home', 'Bedroom', 'All off · 19.6°', false, 'accent')}</div>`;

  /* the map: the zones as columns of 80 — a 44 icon, the label, a stack of at most two faces; three or more fold
     to one face and a "+N" disc. The head is about the people; the map is what its round does. A zone without an
     icon of its own gets the pin; "unknown" is a person in the dashed ring */
  const face = (initials, presence = 'home', picture = false) =>
    `<button class="mp-face" aria-label="${initials}"><span class="am-avatar ${presence === 'home' ? 'is-home' : ''} ${picture ? '' : 'is-initials'} ${presence === 'off' ? 'is-off' : ''}" data-icon><span class="am-avatar__face" aria-hidden="true">${initials}</span>${presence === 'off' ? '' : '<i class="am-avatar__dot"></i>'}</span></button>`;
  const more = (count) => `<span class="mp-face mp-more">+${count}</span>`;
  const zone = (glyph, tone, label, faces) =>
    `<div class="mp-zone" data-target><span class="fv-ico fv-ico--${tone}" data-icon>${G[glyph]}</span><span class="mp-zone__label">${label}</span><div class="mp-stack ${faces ? '' : 'is-empty'}">${faces}</div></div>`;
  const mapHead = (sub) =>
    F.head({
      glyph: 'person',
      tone: 'accent',
      title: 'Where everyone is',
      sub,
      trailing: F.round('map', 'fv-round--quiet', 'Open the map'),
    });
  const mapZones = () =>
    `<article class="fv-card" data-card>${mapHead('2 of 5 home')}<div class="mp-zones" data-align="center" style="--mp-zones:4;--mp-col:80px;--mp-gap:0px">${zone('home', 'presence', 'Home', face('MA') + face('PA'))}${zone('pin', 'neutral', 'Work', face('ON', 'away'))}${zone('away', 'neutral', 'Away', face('JO', 'away'))}${zone('person', 'off', 'Unknown', face('NO', 'off'))}</div></article>`;
  const mapFolded = () =>
    `<article class="fv-card" data-card>${mapHead('4 of 6 home')}<div class="mp-zones" data-align="center" style="--mp-zones:3;--mp-col:104px;--mp-gap:4px">${zone('home', 'presence', 'Home', face('MA') + more(3))}${zone('pin', 'neutral', 'Work', face('ON', 'away'))}${zone('away', 'neutral', 'Away', face('JO', 'away'))}</div></article>`;

  const mapRows = () =>
    `<article class="fv-card" data-card>${mapHead('1 of 4 home')}<div class="am-rows">${[
      ['MA', 'Marta', 'Home', 'home'],
      ['ON', 'Ona', 'Work', 'away'],
      ['JO', 'Jan Oliver', 'Away · 26 km', 'away'],
      ['NO', 'Noa', 'Unknown', 'off'],
    ]
      .map(
        ([i, n, w, p]) =>
          `<div class="fv-row fv-row--tap" role="button" tabindex="0"><span class="am-avatar ${p === 'home' ? 'is-home' : ''} is-initials ${p === 'off' ? 'is-off' : ''}" data-icon><span class="am-avatar__face" aria-hidden="true">${i}</span>${p === 'off' ? '' : '<i class="am-avatar__dot"></i>'}</span><span class="fv-row__text"><span class="fv-row__title">${n}</span></span><span class="fv-row__value ${p === 'home' ? '' : 'fv-row__value--quiet'}">${w}</span></div>`,
      )
      .join('')}</div></article>`;

  globalThis.renderRooms = (root) => {
    root.innerHTML =
      frame('light', roomPhoto()) +
      frame('light', roomTiles()) +
      frame('light', roomPlain()) +
      frame('light', roomTile()) +
      frame('light', roomRows()) +
      frame('light', mapZones()) +
      frame('light', mapRows()) +
      frame('light', mapFolded()) +
      frame('dark', roomPhoto()) +
      frame('dark', roomPlain()) +
      frame('dark', mapZones());
  };
})();
