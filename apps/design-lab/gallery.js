/*
 * Palette gallery: one sheet per palette, two phone frames side by side (light and dark)
 * showing the same realistic dashboard.
 *
 * This is the taste sheet. `sheets/palettes.html` stays the spec sheet — every token and
 * every ratio — while this one answers the only question that matters in the end: does it
 * look good? Everything below is CSS on tokens; the only JavaScript is DOM assembly.
 *
 * Both modes render from one DOM because the token blocks are attribute-scoped
 * (`[data-palette][data-mode]`), so a frame can carry its own mode without touching <html>.
 *
 * Classic script, like the rest of the lab: Chromium blocks modules over `file://`.
 */
(() => {
  'use strict';

  const DATA = globalThis.__DESIGN_TOKENS__;
  const GLYPHS = globalThis.LAB_GLYPHS;

  /** 24 hourly samples, as a percentage of the sparkline height. */
  const SPARK = [
    14, 12, 11, 10, 10, 13, 22, 38, 52, 61, 68, 74, 81, 88, 92, 84, 71, 58, 66, 78, 62, 41, 27, 19,
  ];

  /* The unit is hoisted into the card title: three chips repeating "kWh" is noise, and at
     11px the repetition is also what pushes the row past the card. */
  const ENERGY = [
    { key: 'energy-grid', label: 'Grid', value: '6.4' },
    { key: 'energy-solar', label: 'Solar', value: '11.2' },
    { key: 'energy-home', label: 'House', value: '9.8' },
  ];

  const STATS = [
    { label: 'Temp', value: '21.4', unit: '°C', trend: 'trendUp' },
    { label: 'Humidity', value: '46', unit: '%', trend: 'trendDown' },
    { label: 'Power', value: '1.8', unit: 'kW', trend: 'trendUp' },
  ];

  const NAV = ['home', 'areas', 'bolt', 'sliders'];

  /** Strip order: the seven structural colours, then the states the phone actually shows. */
  const STRIP = [
    { name: 'page', token: '--fluvy-page', get: (c) => c.surface.page },
    { name: 'card', token: '--fluvy-card', get: (c) => c.surface.card },
    { name: 'border', token: '--fluvy-border', get: (c) => c.surface.border },
    { name: 'text', token: '--fluvy-text', get: (c) => c.text.primary },
    { name: 'accent', token: '--fluvy-accent', get: (c) => c.accent.ink },
    { name: 'fill', token: '--fluvy-accent-fill', get: (c) => c.accent.fill },
    { name: 'on-fill', token: '--fluvy-accent-on-fill', get: (c) => c.accent.onFill },
    {
      name: 'light on',
      token: '--fluvy-state-light-active',
      get: (c) => c.state['light-active'].ink,
    },
    { name: 'heat', token: '--fluvy-state-climate-heat', get: (c) => c.state['climate-heat'].ink },
    { name: 'cool', token: '--fluvy-state-climate-cool', get: (c) => c.state['climate-cool'].ink },
    {
      name: 'playing',
      token: '--fluvy-state-media-playing',
      get: (c) => c.state['media-playing'].ink,
    },
    { name: 'grid', token: '--fluvy-state-energy-grid', get: (c) => c.state['energy-grid'].ink },
    { name: 'solar', token: '--fluvy-state-energy-solar', get: (c) => c.state['energy-solar'].ink },
  ];

  // ------------------------------------------------------------------ helpers

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  const setVars = (node, vars) => {
    Object.keys(vars).forEach((name) => node.style.setProperty(name, vars[name]));
    return node;
  };

  const glyph = (name, className) => {
    const node = el('span', className ? `ico ${className}` : 'ico');
    node.innerHTML = GLYPHS[name];
    return node;
  };

  const append = (parent, ...children) => {
    children.forEach((child) => parent.appendChild(child));
    return parent;
  };

  /** A state's four tokens as the `--ph-*` names the phone CSS reads. */
  const stateVars = (key) => ({
    '--ph-fill': `var(--fluvy-state-${key}-fill)`,
    '--ph-fill-border': `var(--fluvy-state-${key}-fill-border)`,
    '--ph-ink': `var(--fluvy-state-${key}-on-fill)`,
  });

  const chipVars = (key) => ({
    '--ph-chip-fill': `var(--fluvy-state-${key}-fill)`,
    '--ph-chip-border': `var(--fluvy-state-${key}-fill-border)`,
    '--ph-chip-ink': `var(--fluvy-state-${key}-on-fill)`,
    '--ph-chip-dot': `var(--fluvy-state-${key})`,
  });

  // -------------------------------------------------------------------- parts

  const meter = (value, vars) => {
    const track = setVars(el('div', 'ph-meter'), vars || {});
    const fill = setVars(el('div', 'ph-meter__fill'), { '--ph-value': value });
    return append(track, fill, el('div', 'ph-meter__ticks'));
  };

  const tile = ({ icon, name, state, modifier, vars, foot }) => {
    const node = setVars(el('div', `ph-tile${modifier ? ` ${modifier}` : ''}`), vars || {});
    append(node, glyph(icon, 'ph-iconbox'));
    const text = el('div', 'ph-tile__text');
    append(text, el('span', 'ph-tile__name', name), el('span', 'ph-tile__state', state));
    append(node, text, foot);
    return node;
  };

  const statusBar = () => {
    const bar = el('div', 'ph-status');
    append(bar, el('span', null, '21:47'));
    const icons = el('span', 'ph-status__icons');
    append(icons, glyph('signal'), glyph('wifi'), glyph('battery'));
    return append(bar, icons);
  };

  const greeting = () => {
    const row = el('div', 'ph-greet');
    const text = el('div', 'ph-greet__text');
    append(
      text,
      el('span', 'ph-greet__hello', 'Good evening, Marta'),
      el('span', 'ph-greet__date', 'Thursday 17 September'),
    );
    const weather = el('div', 'ph-weather');
    append(weather, glyph('sun'), el('span', null, '18° Clear'));
    return append(row, text, weather);
  };

  const tileGrid = () => {
    const grid = el('div', 'ph-tiles');

    // No value chip here: the state line already reads "On · 70%", and a second 70% in a
    // neutral pill would sit on the filled plate as the one grey thing in a warm tile.
    const onFoot = el('div', 'ph-tile__foot');
    append(
      onFoot,
      meter('70%', {
        '--ph-track': 'var(--fluvy-state-light-active-fill-border)',
        '--ph-meter-fill': 'var(--fluvy-state-light-active-fill)',
        '--ph-meter-ink': 'var(--fluvy-state-light-active)',
      }),
    );

    const plugFoot = el('div', 'ph-tile__foot');
    append(plugFoot, setVars(el('span', 'ph-chip', '142 W'), chipVars('energy-grid')));

    const coverFoot = el('div', 'ph-tile__foot');
    append(
      coverFoot,
      meter('40%'),
      glyph('chevronUp', 'ph-ghost'),
      glyph('chevronDown', 'ph-ghost'),
    );

    const offFoot = el('div', 'ph-tile__foot');
    append(offFoot, meter('0%'));

    return append(
      grid,
      tile({
        icon: 'lamp',
        name: 'Ceiling',
        state: 'On · 70%',
        modifier: 'ph-tile--on',
        vars: stateVars('light-active'),
        foot: onFoot,
      }),
      tile({ icon: 'lamp', name: 'Reading', state: 'Off', foot: offFoot }),
      tile({ icon: 'plug', name: 'Desk plug', state: 'On', foot: plugFoot }),
      tile({ icon: 'blinds', name: 'Blinds', state: 'Open 40%', foot: coverFoot }),
    );
  };

  const climateCard = () => {
    const card = el('article', 'ph-card');
    append(card, el('h4', 'ph-card__title', 'Thermostat · Living room'));

    const body = el('div', 'ph-climate__body');
    // 21.5° inside a 7-30° range is 63% of the 270° sweep.
    const ring = setVars(el('div', 'ph-ring'), { '--ph-arc': '0.4725turn' });
    append(ring, el('div', 'ph-ring__arc'), glyph('flame', 'ph-ring__icon'));

    const read = el('div', 'ph-climate__read');
    const value = el('div', 'ph-climate__value');
    append(value, el('span', 'ph-climate__num', '21.5'), el('span', 'ph-climate__unit', '°C'));
    append(read, value, el('span', 'ph-climate__now', 'Now 20.8 °C · heating'));
    append(body, ring, read);

    const modes = el('div', 'ph-modes');
    const mode = (label, icon, active) => {
      const chip = el('span', `ph-mode${active ? ' ph-mode--active' : ''}`);
      return append(chip, glyph(icon), el('span', null, label));
    };
    append(
      modes,
      mode('Heat', 'flame', true),
      mode('Cool', 'snow', false),
      mode('Auto', 'auto', false),
    );

    return append(card, body, modes);
  };

  const mediaCard = () => {
    const card = el('article', 'ph-card');
    append(card, el('h4', 'ph-card__title', 'Playing · Kitchen'));

    const body = el('div', 'ph-media__body');
    const meta = el('div', 'ph-media__meta');
    const times = el('div', 'ph-media__times');
    append(times, el('span', null, '1:24'), el('span', null, '3:42'));
    const progress = el('div', 'ph-progress');
    append(progress, el('div', 'ph-progress__fill'));
    append(
      meta,
      el('span', 'ph-media__title', 'Midnight Coda'),
      el('span', 'ph-media__artist', 'Ola Gjeilo'),
      progress,
      times,
    );
    append(body, el('div', 'ph-art'), meta);

    const transport = el('div', 'ph-transport');
    append(
      transport,
      glyph('prev', 'ph-transport__btn'),
      glyph('pause', 'ph-transport__btn ph-transport__btn--primary'),
      glyph('next', 'ph-transport__btn'),
    );

    return append(card, body, transport);
  };

  const energyCard = () => {
    const card = el('article', 'ph-card');
    append(card, el('h4', 'ph-card__title', 'Energy today · kWh'));

    const chips = el('div', 'ph-energy__chips');
    ENERGY.forEach((entry) => {
      const chip = setVars(el('span', 'ph-echip'), chipVars(entry.key));
      const value = el('b', null, entry.value);
      append(chip, el('span', 'ph-echip__dot'), el('span', null, entry.label), value);
      chips.appendChild(chip);
    });

    const spark = el('div', 'ph-spark');
    SPARK.forEach((height) => {
      spark.appendChild(setVars(el('div', 'ph-spark__bar'), { '--ph-bar': `${height}%` }));
    });

    return append(card, chips, spark);
  };

  const statRow = () => {
    const row = el('div', 'ph-stats');
    STATS.forEach((entry) => {
      const stat = el('div', 'ph-stat');
      const label = el('div', 'ph-stat__label');
      append(label, el('span', null, entry.label), glyph(entry.trend));
      const value = el('div', 'ph-stat__value');
      append(
        value,
        el('span', 'ph-stat__num', entry.value),
        el('span', 'ph-stat__unit', entry.unit),
      );
      row.appendChild(append(stat, label, value));
    });
    return row;
  };

  const unavailableTile = () => {
    const node = el('div', 'ph-unavail');
    append(node, glyph('off', 'ph-iconbox'));
    const text = el('div', 'ph-tile__text');
    append(text, el('span', 'ph-tile__name', 'Porch'), el('span', 'ph-tile__state', 'Unavailable'));
    return append(node, text);
  };

  const navBar = () => {
    const nav = el('div', 'ph-nav');
    const pill = el('div', 'ph-navpill');
    NAV.forEach((name, index) => {
      pill.appendChild(glyph(name, `ph-navitem${index === 0 ? ' ph-navitem--active' : ''}`));
    });
    return append(nav, pill);
  };

  const buildPhone = (paletteName, mode) => {
    const phone = el('div', 'phone');
    phone.dataset.palette = paletteName;
    phone.dataset.mode = mode;

    const body = el('div', 'ph-body');
    append(
      body,
      greeting(),
      el('h3', 'ph-section', 'Living room'),
      tileGrid(),
      climateCard(),
      mediaCard(),
      energyCard(),
      statRow(),
      unavailableTile(),
    );

    return append(phone, statusBar(), body, navBar());
  };

  const swatchStrip = (palette, mode) => {
    const colors = palette.modes[mode].colors;
    const strip = el('div', 'gal-strip');
    strip.dataset.palette = palette.name;
    strip.dataset.mode = mode;
    append(strip, el('div', 'gal-strip__mode', mode));

    const items = el('div', 'gal-strip__items');
    STRIP.forEach((entry) => {
      const swatch = el('div', 'gal-swatch');
      append(
        swatch,
        setVars(el('div', 'gal-swatch__chip'), { '--swatch-color': `var(${entry.token})` }),
        el('div', 'gal-swatch__name', entry.name),
        el('div', 'gal-swatch__hex', entry.get(colors)),
      );
      items.appendChild(swatch);
    });

    return append(strip, items);
  };

  const buildSheet = (palette) => {
    const sheet = el('section', 'gal-sheet');
    sheet.dataset.sheet = palette.name;
    sheet.dataset.palette = palette.name;
    sheet.dataset.mode = 'light';

    const head = el('header', 'gal-head');
    append(head, el('h2', 'gal-title', palette.title), el('p', 'gal-note', palette.description));

    const cols = el('div', 'gal-cols');
    ['light', 'dark'].forEach((mode) => {
      const col = el('div', 'gal-col');
      append(col, el('span', 'gal-col__label', mode), buildPhone(palette.name, mode));
      cols.appendChild(col);
    });

    const strips = el('div', 'gal-strips');
    append(strips, swatchStrip(palette, 'light'), swatchStrip(palette, 'dark'));

    return append(sheet, head, cols, strips);
  };

  // -------------------------------------------------------------------- boot

  const params = new URLSearchParams(window.location.search);
  const wantedPalette = params.get('palette');

  const root = document.documentElement;
  root.dataset.palette = wantedPalette || DATA.palettes[0].name;
  root.dataset.mode = 'light';
  document.body.dataset.filtered = wantedPalette ? '1' : '0';

  const host = document.getElementById('sheets');
  DATA.palettes.forEach((palette) => {
    if (wantedPalette && palette.name !== wantedPalette) return;
    host.appendChild(buildSheet(palette));
  });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.dataset.labReady = '1';
    });
  });
})();
