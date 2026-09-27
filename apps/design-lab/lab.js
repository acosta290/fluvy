/*
 * Design lab runtime.
 *
 * A classic script on purpose: Chromium blocks `fetch()` and ES modules over `file://`,
 * and the lab has to open by double-clicking a file. The token build emits its payload as
 * `globalThis.__DESIGN_TOKENS__` for exactly that reason.
 *
 * Query parameters drive the render tool:
 *   ?palette=sand&mode=dark&width=412  → one sheet, chrome hidden, page framed
 *   (none)                             → every palette × mode, with a switcher
 */
(() => {
  'use strict';

  const DATA = globalThis.__DESIGN_TOKENS__;
  const MODES = ['light', 'dark'];

  const ICONS = globalThis.LAB_GLYPHS;

  /** 24 samples of a plausible indoor temperature curve, as percentages of the card height. */
  const SPARK = [
    34, 30, 27, 25, 24, 26, 31, 40, 52, 61, 66, 70, 74, 79, 84, 88, 82, 73, 64, 57, 50, 45, 41, 37,
  ];

  const ENERGY_CHIPS = [
    { key: 'energy-grid', label: 'Grid', value: '6.4 kWh' },
    { key: 'energy-solar', label: 'Solar', value: '11.2 kWh' },
    { key: 'energy-battery', label: 'Battery', value: '3.1 kWh' },
    { key: 'energy-home', label: 'House', value: '9.8 kWh' },
    { key: 'energy-gas', label: 'Gas', value: '2.7 m³' },
    { key: 'energy-water', label: 'Water', value: '84 L' },
  ];

  const STATE_LABELS = {
    'light-active': 'Light on',
    'climate-heat': 'Heat',
    'climate-cool': 'Cool',
    'climate-dry': 'Dry',
    'climate-fan': 'Fan',
    'media-playing': 'Playing',
    'presence-home': 'Home',
    'security-armed': 'Armed',
    'energy-grid': 'Grid',
    'energy-solar': 'Solar',
    'energy-battery': 'Battery',
    'energy-home': 'House',
    'energy-gas': 'Gas',
    'energy-water': 'Water',
  };

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

  /** "4.82:1 ≥ 4.5", with a marker when a gate is missed so a bad sheet is obvious. */
  const ratioText = (contrast, id) => {
    const entry = contrast[id];
    if (!entry) return '';
    return `${entry.ratio.toFixed(2)}:1 ${entry.pass ? '≥' : '✕'} ${entry.min}`;
  };

  const passes = (contrast, ids) => ids.every((id) => !contrast[id] || contrast[id].pass);

  /** Bare ratio, for places where the gate is stated once in the group heading. */
  const ratio = (contrast, id) => (contrast[id] ? contrast[id].ratio.toFixed(2) : '—');

  const swatch = (name, token, hex, meta) => {
    const node = el('div', 'swatch');
    node.appendChild(setVars(el('div', 'swatch__chip'), { '--swatch-color': `var(${token})` }));
    node.appendChild(el('span', 'swatch__name', name));
    node.appendChild(el('span', 'swatch__hex', hex));
    if (meta) node.appendChild(el('span', 'swatch__ratio', meta));
    return node;
  };

  const group = (title, body) => {
    const node = el('section', 'group');
    node.appendChild(el('h3', 'group__title', title));
    node.appendChild(body);
    return node;
  };

  const swatchRow = (entries) => {
    const row = el('div', 'swatches');
    entries.forEach((entry) => row.appendChild(swatch(entry[0], entry[1], entry[2], entry[3])));
    return row;
  };

  /** A filled plate with its own ink — the shape every "on" state takes in this system. */
  const rolePill = (label, prefix, role, contrast, inkId, onFillId) => {
    const node = setVars(el('div', 'pill'), {
      '--pill-fill': `var(${prefix}-fill)`,
      '--pill-border': `var(${prefix}-fill-border)`,
      '--pill-ink': `var(${prefix}-on-fill)`,
      '--pill-dot': `var(${prefix})`,
    });
    const line = el('span', 'pill__label');
    line.appendChild(el('span', 'pill__dot'));
    line.appendChild(el('span', null, label));
    node.appendChild(line);
    node.appendChild(
      el(
        'span',
        'pill__ratio',
        `ink ${ratio(contrast, inkId)} · on-fill ${ratio(contrast, onFillId)}`,
      ),
    );
    if (!passes(contrast, [inkId, onFillId])) node.classList.add('pill--fail');
    node.title = `ink ${role.ink} · fill ${role.fill} · on-fill ${role.onFill}`;
    return node;
  };

  // ------------------------------------------------------------- mini mock-up

  const tile = (name, state, iconKey, vars, extraClass) => {
    const node = setVars(el('div', `tile${extraClass ? ` ${extraClass}` : ''}`), vars);
    const icon = el('div', 'tile__icon');
    icon.innerHTML = ICONS[iconKey];
    node.appendChild(icon);
    const text = el('div', 'tile__text');
    text.appendChild(el('span', 'tile__name', name));
    text.appendChild(el('span', 'tile__state', state));
    node.appendChild(text);
    return node;
  };

  const lightCard = () => {
    const card = el('article', 'mock-card');
    card.appendChild(el('h4', 'mock-card__title', 'Lighting'));
    card.appendChild(
      tile('Living room', 'On · 70%', 'lamp', {
        '--tile-fill': 'var(--fluvy-state-light-active-fill)',
        '--tile-border': 'var(--fluvy-state-light-active-fill-border)',
        '--tile-ink': 'var(--fluvy-state-light-active-on-fill)',
        '--tile-icon-bg': 'var(--fluvy-state-light-active-fill-border)',
      }),
    );

    const ruler = setVars(el('div', 'ruler'), { '--ruler-value': '70%' });
    ruler.appendChild(el('div', 'ruler__fill'));
    ruler.appendChild(el('div', 'ruler__ticks'));
    ruler.appendChild(el('span', 'ruler__value', '70%'));
    card.appendChild(ruler);

    card.appendChild(tile('Porch', 'Unavailable', 'off', {}, 'tile--unavailable'));
    return card;
  };

  const sensorCard = () => {
    const card = el('article', 'mock-card');
    card.appendChild(el('h4', 'mock-card__title', 'Study · temperature'));

    const stat = el('div', 'stat');
    const value = el('div', 'stat__value');
    value.appendChild(el('span', null, '21.4'));
    value.appendChild(el('span', 'stat__unit', ' °C'));
    stat.appendChild(value);
    stat.appendChild(el('div', 'stat__meta', 'min 19.8 · max 23.1 · updated 2 min ago'));
    card.appendChild(stat);

    const spark = el('div', 'spark');
    SPARK.forEach((height) => {
      spark.appendChild(setVars(el('div', 'spark__bar'), { '--bar-height': `${height}%` }));
    });
    card.appendChild(spark);
    return card;
  };

  const energyCard = () => {
    const card = el('article', 'mock-card');
    card.appendChild(el('h4', 'mock-card__title', 'Energy today'));
    const chips = el('div', 'chips');
    ENERGY_CHIPS.forEach((entry) => {
      const chip = setVars(el('div', 'chip'), {
        '--chip-fill': `var(--fluvy-state-${entry.key}-fill)`,
        '--chip-border': `var(--fluvy-state-${entry.key}-fill-border)`,
        '--chip-ink': `var(--fluvy-state-${entry.key}-on-fill)`,
        '--chip-dot': `var(--fluvy-state-${entry.key})`,
      });
      chip.appendChild(el('span', 'chip__dot'));
      chip.appendChild(el('span', null, entry.label));
      chip.appendChild(el('span', 'chip__value', entry.value));
      chips.appendChild(chip);
    });
    card.appendChild(chips);
    return card;
  };

  // ------------------------------------------------------------------- sheet

  const buildSheet = (palette, mode) => {
    const entry = palette.modes[mode];
    const c = entry.colors;
    const ratios = entry.contrast;
    const structural = entry.structural || {};

    // Dark mode separates card from page by a lightness lift, not by a contrast ratio,
    // so the sheet prints the number that is actually gated.
    const cardSeparation =
      mode === 'dark' && structural['dark/card-lift']
        ? `lift ${structural['dark/card-lift'].detail}`
        : ratioText(ratios, 'surface/card-on-page');

    const sheet = el('section', 'sheet');
    sheet.dataset.sheet = `${palette.name}-${mode}`;
    sheet.dataset.palette = palette.name;
    sheet.dataset.mode = mode;

    const head = el('header', 'sheet__head');
    const title = el('h2', 'sheet__title');
    title.appendChild(el('span', null, palette.title));
    title.appendChild(el('span', 'sheet__mode', mode));
    head.appendChild(title);
    head.appendChild(el('p', 'sheet__note', palette.description));
    sheet.appendChild(head);

    sheet.appendChild(
      group(
        'Surfaces',
        swatchRow([
          ['page', '--fluvy-page', c.surface.page],
          ['page-alt', '--fluvy-page-alt', c.surface.pageAlt],
          ['card', '--fluvy-card', c.surface.card, cardSeparation],
          ['card-elevated', '--fluvy-card-elevated', c.surface.cardElevated],
          [
            'border',
            '--fluvy-border',
            c.surface.border,
            ratioText(ratios, 'surface/border-on-card'),
          ],
          ['border-strong', '--fluvy-border-strong', c.surface.borderStrong],
        ]),
      ),
    );

    const inkPanel = el('div', 'ink-panel');
    [
      ['Primary text', '--fluvy-text', c.text.primary, 'text/primary-on-card'],
      ['Secondary text', '--fluvy-text-secondary', c.text.secondary, 'text/secondary-on-card'],
      ['Disabled · 70%', '--fluvy-text-disabled', c.text.disabled, 'text/disabled-on-card'],
      ['Accent / link', '--fluvy-accent', c.accent.ink, 'accent/ink-on-card'],
    ].forEach((row) => {
      const line = el('div', 'ink-row');
      const sample = setVars(el('span', 'ink-row__sample', row[0]), { color: `var(${row[1]})` });
      line.appendChild(sample);
      line.appendChild(el('span', 'ink-row__meta', `${row[2]} · ${ratioText(ratios, row[3])}`));
      inkPanel.appendChild(line);
    });
    sheet.appendChild(group('Ink on card', inkPanel));

    sheet.appendChild(
      group(
        'Accent',
        swatchRow([
          ['accent', '--fluvy-accent', c.accent.ink, ratioText(ratios, 'accent/ink-on-page')],
          ['hover', '--fluvy-accent-hover', c.accent.hover],
          ['fill', '--fluvy-accent-fill', c.accent.fill],
          [
            'fill-border',
            '--fluvy-accent-fill-border',
            c.accent.fillBorder,
            ratioText(ratios, 'accent/fill-border'),
          ],
          [
            'on-fill',
            '--fluvy-accent-on-fill',
            c.accent.onFill,
            ratioText(ratios, 'accent/on-fill'),
          ],
          [
            'on-accent',
            '--fluvy-text-on-accent',
            c.text.onAccent,
            ratioText(ratios, 'accent/text-on-accent'),
          ],
        ]),
      ),
    );

    const statusPills = el('div', 'pills');
    Object.keys(c.semantic).forEach((role) => {
      statusPills.appendChild(
        rolePill(
          role,
          `--fluvy-${role}`,
          c.semantic[role],
          ratios,
          `status/${role}-ink-on-card`,
          `status/${role}-on-fill`,
        ),
      );
    });
    sheet.appendChild(group('Status — ink ≥ 4.5:1 on card, ink on fill ≥ 4.5:1', statusPills));

    const statePills = el('div', 'pills');
    Object.keys(c.state).forEach((key) => {
      statePills.appendChild(
        rolePill(
          STATE_LABELS[key] || key,
          `--fluvy-state-${key}`,
          c.state[key],
          ratios,
          `state/${key}-ink-on-card`,
          `state/${key}-on-fill`,
        ),
      );
    });
    sheet.appendChild(group('Domain states — ink ≥ 3:1 on card, ink on fill ≥ 4.5:1', statePills));

    const graph = el('div', 'graph');
    c.graph.forEach((hex, index) => {
      const item = el('div', 'graph__item');
      item.title = hex;
      item.appendChild(
        setVars(el('div', 'graph__chip'), { '--swatch-color': `var(--fluvy-graph-${index + 1})` }),
      );
      item.appendChild(el('span', 'graph__meta', `${index + 1} · ${hex}`));
      item.appendChild(
        el('span', 'graph__meta', `${ratio(ratios, `graph/${index + 1}-on-card`)}:1`),
      );
      graph.appendChild(item);
    });
    sheet.appendChild(group('Graph series — ≥ 3:1 on card, ΔE2000 ≥ 8 apart', graph));

    const mock = el('div', 'mock');
    mock.appendChild(lightCard());
    mock.appendChild(sensorCard());
    mock.appendChild(energyCard());
    sheet.appendChild(group('Mini dashboard', mock));

    return sheet;
  };

  // -------------------------------------------------------------------- boot

  const params = new URLSearchParams(window.location.search);
  const wantedPalette = params.get('palette');
  const wantedMode = params.get('mode');
  const wantedWidth = params.get('width');
  const filtered = Boolean(wantedPalette && wantedMode);

  const root = document.documentElement;
  root.dataset.palette = wantedPalette || DATA.palettes[0].name;
  root.dataset.mode = wantedMode || 'light';
  if (wantedWidth) root.style.setProperty('--lab-frame', `${wantedWidth}px`);
  document.body.dataset.filtered = filtered ? '1' : '0';

  const host = document.getElementById('sheets');
  DATA.palettes.forEach((palette) => {
    MODES.forEach((mode) => {
      if (filtered && (palette.name !== wantedPalette || mode !== wantedMode)) return;
      host.appendChild(buildSheet(palette, mode));
    });
  });

  const switcher = document.getElementById('switcher');
  if (switcher && !filtered) {
    const jump = el('select');
    jump.appendChild(el('option', null, 'all palettes'));
    DATA.palettes.forEach((palette) => {
      MODES.forEach((mode) => {
        const option = el('option', null, `${palette.title} · ${mode}`);
        option.value = `${palette.name}:${mode}`;
        jump.appendChild(option);
      });
    });
    jump.addEventListener('change', () => {
      if (!jump.value) {
        window.location.search = '';
        return;
      }
      const [palette, mode] = jump.value.split(':');
      window.location.search = `?palette=${palette}&mode=${mode}`;
    });
    switcher.appendChild(jump);
  }

  // The render tool waits on this instead of a sleep.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.dataset.labReady = '1';
    });
  });
})();
