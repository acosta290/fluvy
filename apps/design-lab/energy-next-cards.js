/* Energy, next (round 2) — the companion cards. Figures and words in ink; sources in their colours; a meter that
   cannot know where its energy came from (the grid's phases, a signed gauge) draws the grid's colour both ways. */
(() => {
  'use strict';
  const { F, card, cols, on, fill } = globalThis.EN;

  const unit = (u) => `<span class="en-unit">${u}</span>`;
  const num = (v, u) => `${v}${unit(u)}`;

  /* ------------------------------------------------ bar + legend (Distribution's idiom) */

  const bar12 = (items) => {
    const sum = items.reduce((s, i) => s + i.value, 0);
    return `<div class="en-bar12" data-measure="drawn">${items.map((i) => `<span class="en-fill--${i.tone}" style="flex:${(i.value / sum).toFixed(4)}"></span>`).join('')}</div>`;
  };
  const legend = (items, u) =>
    `<div class="en-legend">${items
      .map(
        (i) =>
          `<span class="en-legend__item"><span class="en-legend__name"><i class="en-sq en-fill--${i.tone}"></i>${i.name}</span><span class="en-legend__value">${num(i.value.toFixed(1), u)}</span></span>`,
      )
      .join('')}</div>`;
  const block = (title, total, u, items) =>
    `<div class="en-block"><div class="en-block__head"><span class="en-block__title">${title}</span><span class="en-block__total">${num(total, u)}</span></div>${bar12(items)}${legend(items, u)}</div>`;

  /** A phase: centred on zero; the grid's colour both ways (a meter does not know the energy's origin). */
  const phase = (name, value, max, { u = 'kW', sub = '' } = {}) => {
    const f = Math.min(1, Math.abs(value) / max) * 50;
    const side = value < 0 ? 'out' : 'in';
    return (
      `<div class="en-phase"><span class="en-phase__name">${name}${sub ? `<small>${sub}</small>` : ''}</span>` +
      `<span class="en-phase__bar" data-measure="drawn"><i class="en-phase__zero"></i><span class="en-phase__fill en-phase__fill--${side}" style="${side === 'out' ? 'right:50%' : 'left:50%'};width:${f.toFixed(1)}%"></span></span>` +
      `<span class="en-phase__value">${num(Math.abs(value).toFixed(1), `${u} ${side}`)}</span></div>`
    );
  };
  const phaseAxis = () => `<div class="en-phase-axis"><span>← out</span><span>in →</span></div>`;
  const phases19 = (sub = false) =>
    `<div class="en-phases">${phase('L1', -0.4, 2, { sub: sub ? '229 V' : '' })}${phase('L2', 1.0, 2, { sub: sub ? '232 V' : '' })}${phase('L3', 0.9, 2, { sub: sub ? '231 V' : '' })}</div>` +
    phaseAxis();

  /* ------------------------------------------------------------------ balance */

  const balance = () =>
    F.head({
      glyph: 'swap',
      tone: 'accent',
      title: 'Energy balance',
      sub: 'Live · 5 s ago',
      trailing: F.badge('Import + export', 'grid'),
    }) +
    block('Coming in', '5.1', 'kW', [
      { name: 'Solar', value: 3.2, tone: 'solar' },
      { name: 'Grid', value: 1.9, tone: 'grid' },
    ]) +
    block('Going out', '5.1', 'kW', [
      { name: 'House', value: 4.1, tone: 'home' },
      { name: 'Battery', value: 0.6, tone: 'battery' },
      { name: 'Grid', value: 0.4, tone: 'grid' },
    ]) +
    `<div class="en-block"><div class="en-block__head"><span class="en-block__title">Per phase</span></div>${phases19()}</div>`;

  const balanceToday = () =>
    F.head({
      glyph: 'swap',
      tone: 'accent',
      title: 'Energy balance',
      sub: 'Today · since midnight',
    }) +
    `<div class="en-period">${fill([{ label: 'Day', active: true }, { label: 'Week' }, { label: 'Month' }])}</div>` +
    block('Came in', '17.7', 'kWh', [
      { name: 'Solar', value: 11.2, tone: 'solar' },
      { name: 'Grid', value: 4.1, tone: 'grid' },
      { name: 'Battery', value: 2.4, tone: 'battery' },
    ]) +
    block('Went out', '17.7', 'kWh', [
      { name: 'House', value: 13.4, tone: 'home' },
      { name: 'Battery', value: 3.0, tone: 'battery' },
      { name: 'Grid', value: 1.3, tone: 'grid' },
    ]) +
    cols(
      [
        { label: 'Cost', value: '1.27', unit: '€' },
        { label: 'Feed-in', value: '0.10', unit: '€' },
        { label: 'Net', value: '1.17', unit: '€' },
      ],
      'bt',
    );

  /* --------------------------------------------------------------------- grid */

  const grid = () =>
    F.head({
      glyph: 'tower',
      tone: 'grid',
      title: 'Grid',
      sub: '3 phases · 231 V',
      trailing: F.badge('Importing', 'grid'),
    }) +
    `<div class="ef-top fv-value-row en-top--end">${F.readout({ label: 'Net import', value: '1.5', unit: 'kW', size: 'l', group: 'gn' })}` +
    `<div class="en-inout"><span>In</span><b>${num('1.9', 'kW')}</b><span>Out</span><b>${num('0.4', 'kW')}</b></div></div>` +
    `<div class="en-block">${phases19(true)}</div>` +
    `<div class="ef-rows">${F.listRow({ glyph: 'clock', title: 'Price now', sub: 'Cheapest 02:00–05:00', trailing: 'value', value: '0.31 €/kWh', tone: 'neutral' })}</div>` +
    cols(
      [
        { label: 'Imported', value: '4.1', unit: 'kWh' },
        { label: 'Exported', value: '1.3', unit: 'kWh' },
        { label: 'Net cost', value: '1.17', unit: '€' },
      ],
      'gd',
    );

  /* ---------------------------------------------------------------- batteries */

  const batteries = () =>
    F.head({
      glyph: 'battery',
      tone: 'battery',
      title: 'Batteries',
      sub: '2 batteries · 20 kWh',
      trailing: F.badge('Charging', 'battery'),
    }) +
    `<div class="ef-top fv-value-row">${F.readout({ label: 'State of charge', value: '64', unit: '%', size: 'l', group: 'bt' })}<div class="ef-top__side">${F.readout({ label: 'Full in', value: `2${unit('h')} 10`, unit: 'min', size: 's', group: 'bt' })}</div></div>` +
    `<div class="ef-gauge en-mark" style="--at:64px">${F.ruler({ w: 320, h: 44, value: 0.64, tone: 'battery', marker: true })}</div>` +
    F.rulerLabels(
      [
        [0, '0'],
        [0.2, 'Reserve'],
        [0.5, '50'],
        [1, '100'],
      ],
      320,
    ) +
    `<div class="ef-rows">` +
    F.barRow({
      glyph: 'battery',
      tone: 'battery',
      title: 'Garage',
      sub: '10 kWh · charging 0.4 kW',
      value: '72 %',
      fraction: 0.72,
    }) +
    F.barRow({
      glyph: 'battery',
      tone: 'battery',
      title: 'Basement',
      sub: '10 kWh · charging 0.2 kW',
      value: '56 %',
      fraction: 0.56,
    }) +
    `</div>`;

  /* ---------------------------------------------------------------------- car */

  const car = () =>
    F.head({
      glyph: 'car',
      tone: 'accent',
      title: 'Wallbox',
      sub: 'Charging · Model 3',
      trailing: F.badge('7.4 kW', 'accent'),
    }) +
    `<div class="ef-top fv-value-row">${F.readout({ label: 'Car', value: '64', unit: '%', size: 'l', group: 'ev' })}<div class="ef-top__side">${F.readout({ label: '80 % by', value: '07:00', size: 's', group: 'ev' })}</div></div>` +
    `<div class="ef-gauge en-mark" style="--at:256px">${F.ruler({ w: 320, h: 44, value: 0.64, tone: 'accent', marker: true })}</div>` +
    F.rulerLabels(
      [
        [0, '0'],
        [0.5, '50'],
        [0.8, 'Target'],
        [1, '100'],
      ],
      320,
    ) +
    cols(
      [
        { label: 'Added', value: '12.4', unit: 'kWh' },
        { label: 'For', value: `2${unit('h')} 03`, unit: 'min' },
        { label: 'From the sun', value: '96', unit: '%' },
      ],
      'evc',
    ) +
    F.label('Mode') +
    F.options(
      [
        { label: 'Off', value: 'Paused', glyph: 'power' },
        { label: 'Sun', value: 'Surplus', glyph: 'sun', tone: 'solar', active: true },
        { label: 'Fast', value: '11 kW', glyph: 'bolt' },
      ],
      104,
    );

  /* ------------------------------------------------------------------- sankey */

  /**
   * Today from where to where, top to bottom: one px-per-kWh scale for every bar and ribbon (true proportions),
   * rows ordered so no ribbon crosses another, each row's words packed by their measured width (anchored at the
   * bar's start, else its end, else a second tier), links out of the house in the house's ink.
   */
  const sankey = () => {
    const W = 320;
    const GAP = 8;
    const BAR = 8;
    const total = 17.7;
    const scale = (n) => (W - GAP * (n - 1)) / total;
    const lay = (items) => {
      const s = scale(items.length);
      let x = 0;
      return items.map((i) => {
        const o = { ...i, x, w: i.value * s };
        x += o.w + GAP;
        return o;
      });
    };
    const top = lay([
      { key: 'grid', name: 'Grid', value: 4.1, tone: 'grid' },
      { key: 'bat', name: 'Battery', value: 2.4, tone: 'battery' },
      { key: 'solar', name: 'Solar', value: 11.2, tone: 'solar' },
    ]);
    const mid = lay([
      { key: 'house', name: 'House', value: 13.4, tone: 'home' },
      { key: 'charge', name: 'Charged', value: 3.0, tone: 'battery' },
      { key: 'export', name: 'Exported', value: 1.3, tone: 'grid' },
    ]);
    const house = mid[0];
    const hs = house.w / 13.4;
    let kx = 0;
    const kids = [
      { name: 'Heat pump', value: 5.1 },
      { name: 'Car', value: 3.8 },
      { name: 'Kitchen', value: 2.1 },
      { name: 'Other', value: 2.4, dashed: true },
    ].map((k) => {
      const o = { ...k, tone: 'home', x: kx, w: k.value * hs };
      kx += o.w + GAP;
      return o;
    });
    // label packing: measured widths; tier 0 anchored at the bar's start, else its end, else tier 1
    const labelW = (n) =>
      Math.max(
        F.textWidth(n.name.toUpperCase(), '600 11px Inter') + n.name.length * 0.66,
        F.textWidth(n.value.toFixed(1), '600 16px Inter') +
          3 +
          F.textWidth('kWh', '600 12px Inter'),
      );
    const pack = (row) => {
      const tiers = [[], []];
      const fits = (t, a, b) =>
        tiers[t].every(([s, e]) => b + 16 <= s || a >= e + 16) && a >= 0 && b <= W;
      return row.map((n) => {
        const lw = Math.ceil(labelW(n));
        for (const t of [0, 1])
          for (const end of [false, true]) {
            // on the 4 grid: a label anchored at its bar's end keeps its right edge there, its box starts on the grid
            const right = n.x + n.w;
            if (end === 'slide') {
              // to the right, on the 4 grid, up to the column's edge: the first free place
              for (let a = Math.floor(n.x / 4) * 4; a + lw <= W; a += 4)
                if (fits(t, a, a + lw)) {
                  tiers[t].push([a, a + lw]);
                  return { ...n, lx: a, lw, tier: t, end: false };
                }
              continue;
            }
            const a = end ? Math.floor((right - lw) / 4) * 4 : Math.floor(n.x / 4) * 4;
            const width = end ? Math.round(right - a) : lw;
            if (fits(t, a, a + width)) {
              tiers[t].push([a, a + width]);
              return { ...n, lx: a, lw: width, tier: t, end };
            }
          }
        return { ...n, lx: n.x, lw, tier: 1, end: false };
      });
    };
    const ribbon = (x0, w0, y0, x1, w1, y1, tone) => {
      const my = (y0 + y1) / 2;
      return `<path d="M${x0.toFixed(1)},${y0} C${x0.toFixed(1)},${my} ${x1.toFixed(1)},${my} ${x1.toFixed(1)},${y1} L${(x1 + w1).toFixed(1)},${y1} C${(x1 + w1).toFixed(1)},${my} ${(x0 + w0).toFixed(1)},${my} ${(x0 + w0).toFixed(1)},${y0} Z" class="en-ribbon en-fill--${tone}"/>`;
    };
    // vertical bands: labels (tiers of 36) · 8 · bar · ribbons 88 · bar · 8 · labels · …
    const topL = pack(top);
    const midL = pack(mid);
    const kidL = pack(kids);
    const tiersOf = (l) => 1 + Math.max(...l.map((n) => n.tier));
    const y0 = tiersOf(topL) * 36 + 8;
    const y1 = y0 + BAR + 88;
    const midLabels = y1 + BAR + 8;
    const leave = midLabels + tiersOf(midL) * 36 + 12; // the house's ribbons leave under its words' band
    const y2 = leave + 88;
    const kidLabels = y2 + BAR + 8;
    const H = kidLabels + tiersOf(kidL) * 36;
    const s = scale(3);
    const alloc = [
      ['grid', 'house', 4.1],
      ['bat', 'house', 2.4],
      ['solar', 'house', 6.9],
      ['solar', 'charge', 3.0],
      ['solar', 'export', 1.3],
    ];
    const outOff = {};
    const inOff = {};
    const ribbons = alloc
      .map(([a, b, v]) => {
        const src = top.find((n) => n.key === a);
        const dst = mid.find((n) => n.key === b);
        const wv = v * s;
        const x0 = src.x + (outOff[a] || 0);
        const x1 = dst.x + (inOff[b] || 0);
        outOff[a] = (outOff[a] || 0) + wv;
        inOff[b] = (inOff[b] || 0) + wv;
        return ribbon(x0, wv, y0 + BAR, x1, wv, y1, src.tone);
      })
      .join('');
    let hx = 0;
    const kidRibbons = kids
      .map((k) => {
        const r = ribbon(house.x + hx, k.w, leave, k.x, k.w, y2, 'home');
        hx += k.w;
        return r;
      })
      .join('');
    // the house's bar continues under its words: a quiet stem from the bar to where its ribbons leave
    const stem = `<rect x="${house.x.toFixed(1)}" y="${leave - 4}" width="${house.w.toFixed(1)}" height="4" rx="2" class="en-node-bar en-fill--home" opacity="0.5"/>`;
    const bars = (row, y) =>
      row
        .map(
          (n) =>
            `<rect x="${n.x.toFixed(1)}" y="${y}" width="${n.w.toFixed(1)}" height="${BAR}" rx="4" class="en-node-bar en-fill--${n.tone} ${n.dashed ? 'is-dashed' : ''}"/>`,
        )
        .join('');
    const labels = (row, yBase, above) =>
      row
        .map((n) => {
          const y = above ? yBase - (n.tier + 1) * 36 : yBase + n.tier * 36;
          return `<span class="en-sk-label ${n.end ? 'is-end' : ''}" style="left:${n.lx.toFixed(1)}px;top:${y}px;width:${n.lw}px"><span class="en-sk-name">${n.name}</span><span class="en-sk-value">${num(n.value.toFixed(1), 'kWh')}</span></span>`;
        })
        .join('');
    return (
      F.head({ glyph: 'swap', tone: 'accent', title: 'Where it went', sub: 'Today · 17.7 kWh' }) +
      `<div class="en-sankey" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true" data-measure="drawn">${ribbons}${stem}${kidRibbons}${bars(top, y0)}${bars(mid, y1)}${bars(kids, y2)}</svg>` +
      labels(topL, y0 - 8, true) +
      labels(midL, midLabels, false) +
      labels(kidL, kidLabels, false) +
      `</div>`
    );
  };

  /* -------------------------------------------------------------------- score */

  const ring = (value, label) => {
    const r = 36;
    const c = 2 * Math.PI * r;
    return (
      `<div class="en-score"><svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true"><circle cx="44" cy="44" r="${r}" class="en-score__track"/><circle cx="44" cy="44" r="${r}" class="en-score__arc" stroke-dasharray="${(value * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 44 44)"/></svg>` +
      `<span class="en-score__value">${num(Math.round(value * 100), '%')}</span><span class="en-score__label">${label}</span></div>`
    );
  };
  const score = () =>
    F.head({ glyph: 'leaf', tone: 'accent', title: 'Energy score', sub: 'Today' }) +
    `<div class="en-scores">${ring(0.72, 'Self-powered')}${ring(0.88, 'Sun used')}${ring(0.64, 'Low-carbon')}</div>` +
    cols(
      [
        { label: 'Imported', value: '4.1', unit: 'kWh' },
        { label: 'Exported', value: '1.3', unit: 'kWh' },
        { label: 'Net', value: '2.8', unit: 'kWh' },
      ],
      'sc',
    );

  /* ----------------------------------------------------- the house's power by source */

  const stacked = () => {
    const W = 320;
    const Hc = 160;
    const zero = 116;
    const NOW = (21 * 60 + 47) / (24 * 60);
    const n = 97; // 15-minute points over the day, drawn up to now
    const upto = Math.floor(NOW * (n - 1));
    const hour = (i) => (i / (n - 1)) * 24;
    const sun = (h) => Math.max(0, Math.sin(((h - 6.5) / 13) * Math.PI));
    const series = {
      solar: (h) => 2.4 * sun(h) * (h > 8 && h < 17 ? 0.9 : 1),
      battery: (h) => 0.5 * Math.exp(-((h - 21) ** 2) / 2.5),
      grid: (h) =>
        0.12 +
        0.45 * Math.exp(-((h - 19) ** 2) / 3) +
        0.35 * Math.exp(-((h - 3) ** 2) / 12) +
        0.25 * Math.exp(-((h - 7.5) ** 2) / 1.5),
      out: (h) =>
        -Math.max(0, 1.0 * Math.sin(((h - 10) / 6) * Math.PI)) * (h > 10 && h < 16 ? 1 : 0),
    };
    const k = 30;
    const x = (i) => (i / (n - 1)) * W;
    const y = (v) => zero - v * k;
    const idx = Array.from({ length: upto + 1 }, (_, i) => i);
    const s1 = idx.map((i) => series.solar(hour(i)));
    const s2 = idx.map((i, j) => s1[j] + series.battery(hour(i)));
    const s3 = idx.map((i, j) => s2[j] + series.grid(hour(i)));
    const out = idx.map((i) => series.out(hour(i)));
    const zeros = idx.map(() => 0);
    const pts = (arr) => arr.map((v, j) => `${x(j).toFixed(1)},${y(v).toFixed(1)}`);
    const area = (lo, hi, tone) =>
      `<path d="M${pts(hi).join(' L')} L${pts(lo).reverse().join(' L')} Z" class="en-area en-fill--${tone}"/><polyline points="${pts(hi).join(' ')}" class="en-area-line en-fill--${tone}"/>`;
    const outArea = `<path d="M${pts(zeros).join(' L')} L${pts(out).reverse().join(' L')} Z" class="en-area en-fill--solar" opacity="0.6"/><polyline points="${pts(out).join(' ')}" class="en-area-line en-fill--solar" opacity="0.6"/>`;
    const cx = x(upto);
    const svg =
      `<svg width="${W}" height="${Hc}" viewBox="0 0 ${W} ${Hc}" aria-hidden="true" data-measure="drawn">` +
      area(s2, s3, 'grid') +
      area(s1, s2, 'battery') +
      area(zeros, s1, 'solar') +
      outArea +
      `<line x1="0" y1="${zero}" x2="${W}" y2="${zero}" class="en-zero"/>` +
      `<line x1="${cx.toFixed(1)}" y1="12" x2="${cx.toFixed(1)}" y2="${Hc}" class="en-cursor"/><circle cx="${cx.toFixed(1)}" cy="${y(s3[upto]).toFixed(1)}" r="5" class="en-cursor-dot"/>` +
      `</svg>`;
    return (
      F.head({
        glyph: 'home',
        tone: 'accent',
        title: 'House power',
        sub: 'Today · by source',
        trailing: F.round('dots', 'fv-round--quiet', 'More'),
      }) +
      `<div class="ef-top fv-value-row">${F.readout({ label: 'Right now', value: '1.2', unit: 'kW', size: 'l', group: 'st' })}</div>` +
      `<div class="en-chart">${svg}<span class="en-chart__tag en-chart__tag--left" style="top:0">Used</span><span class="en-chart__tag en-chart__tag--left" style="top:128px">Exported</span></div>` +
      F.axis(
        [
          [0, '00:00'],
          [0.25, '06:00'],
          [0.5, '12:00'],
          [0.75, '18:00'],
          [1, '24:00'],
        ],
        320,
      ) +
      `<div class="en-legend">${[
        ['Solar', 'solar', '6.9'],
        ['Battery', 'battery', '2.4'],
        ['Grid', 'grid', '4.1'],
        ['Exported', 'solar', '1.3'],
      ]
        .map(
          ([name, tone, v]) =>
            `<span class="en-legend__item"><span class="en-legend__name"><i class="en-sq en-fill--${tone}" ${name === 'Exported' ? 'style="opacity:.6"' : ''}></i>${name}</span><span class="en-legend__value">${num(v, 'kWh')}</span></span>`,
        )
        .join('')}</div>`
    );
  };

  /* ----------------------------------------------------- where it goes, nested */

  const inkRow = (o) =>
    F.barRow({ ...o, tone: 'neutral', barTone: 'neutral' }).replace(
      'fv-bar--neutral',
      'fv-bar--neutral en-bar--ink',
    );
  const nested = () =>
    F.head({
      glyph: 'plug',
      tone: 'accent',
      title: 'Where it goes',
      sub: 'Today · 13.4 kWh',
      trailing: F.badge('82 % measured', 'neutral'),
    }) +
    `<div class="ef-rows en-tree">` +
    inkRow({
      glyph: 'heater',
      title: 'Heat pump',
      sub: '38 % of the house',
      value: '5.1 kWh',
      fraction: 0.38,
    }) +
    inkRow({
      glyph: 'car',
      title: 'Car',
      sub: '28 % · charged to 64 %',
      value: '3.8 kWh',
      fraction: 0.28,
    }) +
    inkRow({
      glyph: 'plug',
      title: 'Kitchen',
      sub: '16 % · 3 devices',
      value: '2.1 kWh',
      fraction: 0.16,
    }) +
    `<div class="en-tree__kids">` +
    inkRow({
      glyph: 'oven',
      title: 'Oven',
      sub: '43 % of the kitchen',
      value: '0.9 kWh',
      fraction: 0.07,
    }) +
    inkRow({
      glyph: 'plug',
      title: 'Dishwasher',
      sub: '33 % of the kitchen',
      value: '0.7 kWh',
      fraction: 0.05,
    }) +
    inkRow({
      glyph: 'dots',
      title: 'Not measured',
      sub: '24 % of the kitchen',
      value: '0.5 kWh',
      fraction: 0.04,
    }) +
    `</div>` +
    inkRow({
      glyph: 'dots',
      title: 'Not measured',
      sub: '18 % · the rest of the house',
      value: '2.4 kWh',
      fraction: 0.18,
    }) +
    `</div>`;

  /* -------------------------------------------------------- production by array */

  const arrays = () => {
    const east = [
      0, 0, 0, 0, 0, 0, 0.1, 0.4, 0.8, 1.0, 0.9, 0.7, 0.5, 0.3, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    const west = [
      0, 0, 0, 0, 0, 0, 0, 0.1, 0.2, 0.3, 0.5, 0.7, 0.9, 1.0, 0.8, 0.5, 0.2, 0.1, 0, 0, 0, 0, 0, 0,
    ];
    const now = 15;
    const bw = 8;
    const step = 320 / 24;
    const H = 112;
    const max = 1.6;
    const bars = east
      .map((e, i) => {
        const wv = west[i];
        const x = i * step + (step - bw) / 2;
        const he = (e / max) * H;
        const hw = (wv / max) * H;
        const future = i > now ? 'is-future' : '';
        return (
          (hw
            ? `<rect x="${x.toFixed(1)}" y="${(H - hw).toFixed(1)}" width="${bw}" height="${hw.toFixed(1)}" rx="3" class="en-bar en-bar--b ${future}"/>`
            : '') +
          (he
            ? `<rect x="${x.toFixed(1)}" y="${(H - hw - he - (hw ? 2 : 0)).toFixed(1)}" width="${bw}" height="${he.toFixed(1)}" rx="3" class="en-bar en-bar--a ${future}"/>`
            : '')
        );
      })
      .join('');
    return (
      F.head({
        glyph: 'sun',
        tone: 'solar',
        title: 'Production',
        sub: 'Today · vs forecast',
        trailing: F.badge('+6 %', 'solar'),
      }) +
      `<div class="ef-top fv-value-row">${F.readout({ label: 'So far today', value: '11.2', unit: 'kWh', size: 'l', group: 'pa' })}<div class="ef-top__side">${F.readout({ label: 'Forecast', value: '18.4', unit: 'kWh', size: 's', group: 'pa' })}</div></div>` +
      `<div class="en-chart"><svg width="320" height="${H}" viewBox="0 0 320 ${H}" aria-hidden="true" data-measure="drawn">${bars}</svg></div>` +
      F.axis(
        [
          [0, '00:00'],
          [0.25, '06:00'],
          [0.5, '12:00'],
          [0.75, '18:00'],
          [1, '24:00'],
        ],
        320,
      ) +
      `<div class="en-legend">${[
        ['East', 'en-bar--a', '5.2'],
        ['West', 'en-bar--b', '6.0'],
      ]
        .map(
          ([name, cls, v]) =>
            `<span class="en-legend__item"><span class="en-legend__name"><i class="en-sq ${cls}"></i>${name}</span><span class="en-legend__value">${num(v, 'kWh')}</span></span>`,
        )
        .join('')}</div>`
    );
  };

  /* ------------------------------------------------------------- signed gauge */

  const signedGauge = () => {
    const R = 104;
    const c = [160, 124];
    const N = 40;
    const value = -1.8 / 5;
    const ticks = [];
    for (let i = 0; i <= N; i++) {
      const f = -1 + (2 * i) / N;
      const deg = f * 135 - 90;
      const major = i % 10 === 0;
      const len = major ? 16 : 8;
      const a = on(c, R, deg);
      const b = on(c, R - len, deg);
      const lit = (value < 0 && f <= 0 && f >= value) || (value > 0 && f >= 0 && f <= value);
      ticks.push(
        `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" class="en-tick ${lit || i === N / 2 ? 'is-lit' : ''}"/>`,
      );
    }
    return (
      F.head({
        glyph: 'tower',
        tone: 'grid',
        title: 'Grid power',
        sub: 'Live · 5 s ago',
        trailing: F.badge('Exporting', 'grid'),
      }) +
      `<div class="en-gauge"><svg width="320" height="220" viewBox="0 0 320 220" aria-hidden="true">${ticks.join('')}</svg>` +
      `<span class="en-gauge__label">Net</span><span class="en-gauge__value">1.8<small>kW out</small></span>` +
      `<span class="en-gauge__end en-gauge__end--l">5 kW out</span><span class="en-gauge__zero">0</span><span class="en-gauge__end en-gauge__end--r">5 kW in</span></div>` +
      cols(
        [
          { label: 'In', value: '0.4', unit: 'kW' },
          { label: 'Out', value: '2.2', unit: 'kW' },
          { label: 'Today · net', value: '2.8', unit: 'kWh in' },
        ],
        'sg',
      )
    );
  };

  /* -------------------------------------------------------------- gas & water */

  const meter = (label, value, u, now, typical, tone, fraction) =>
    `<div class="ef-meter">${F.readout({ label, value, unit: u, group: label })}<div class="ef-meter__bars"><span class="ef-bar"><span class="ef-bar__fill ef-bar__fill--${tone}" data-measure="value" style="width:${Math.round(fraction * 100)}%"></span></span><span class="ef-meter__note" data-baseline="${label}">${now} · typical ${typical}</span></div></div>`;
  const gasWater = () =>
    F.head({
      glyph: 'drop',
      tone: 'water',
      title: 'Water & gas',
      sub: 'Today · vs a typical day',
      trailing: F.round('dots', 'fv-round--quiet', 'More'),
    }) +
    meter('Water', '84', 'L', '6 L/min now', '150 L', 'water', 0.56) +
    meter('Gas', '2.7', 'm³', '0.4 m³/h now', '3.0 m³', 'gas', 0.9) +
    `<div class="ef-rows">${F.listRow({ glyph: 'drop', title: 'Leak sensor', sub: 'Kitchen · checked 21:40', trailing: 'value', value: 'Dry', tone: 'neutral' })}${F.listRow({ glyph: 'sliders', title: 'Main valve', sub: 'Open', trailing: 'switch', on: true, tone: 'neutral' })}</div>`;

  /* ------------------------------------------------------------------- editor */

  const editor = () =>
    F.head({
      glyph: 'sliders',
      tone: 'accent',
      title: 'Energy flow · Grid',
      sub: 'Editing a node',
    }) +
    `<div class="en-editor">` +
    F.label('Power') +
    fill([{ label: 'One sensor' }, { label: 'In + out', active: true }, { label: 'Per phase' }]) +
    `<div class="en-field" style="margin-top:8px">sensor.grid_import_power<small>In</small></div>` +
    `<div class="en-field" style="margin-top:8px">sensor.grid_export_power<small>Out</small></div>` +
    F.label('Colour') +
    `<div class="en-field"><span class="en-field__lead"><i class="en-sq en-fill--grid"></i>Grid colour</span><small>Default</small></div>` +
    `<p class="en-hint">Any Home Assistant colour, or #rrggbb</p>` +
    F.label('Direction') +
    fill([{ label: 'As measured', active: true }, { label: 'Inverted' }]) +
    F.label('Arrows') +
    fill([{ label: 'At arrival', active: true }, { label: 'Both ends' }, { label: 'None' }]) +
    F.label('Show') +
    fill([{ label: 'Always', active: true }, { label: 'When active' }, { label: 'Never' }]) +
    `<pre class="en-yaml">type: custom:fluvy-energy-flow-card
layout: rows      # cross · list
style: stream     # ribbons · legs · rail
motion: full      # calm · off
grid:
  import: sensor.grid_in
  export: sensor.grid_out
  # power: [sensor.l1, sensor.l2, …]
  # color: indigo   (or #rrggbb)
  arrows: arrival
  show: always</pre>` +
    `</div>`;

  globalThis.renderEnergyCards = () =>
    card({ title: '18 · Balance — the #19 house, live, per phase', body: balance() }) +
    card({ title: '19 · Balance — today, with the period and the money', body: balanceToday() }) +
    card({
      title: '20 · Grid — three phases, import and export at once, the price',
      body: grid(),
    }) +
    card({ title: '21 · Batteries — two, one state of charge (by capacity)', body: batteries() }) +
    card({ title: '22 · Car charger — the sun only, the target by 07:00', body: car() }) +
    card({ title: '23 · Sankey — today, true proportions, no crossings', body: sankey() }) +
    card({ title: '24 · Score — self-powered, sun used, low-carbon', body: score() }) +
    card({ title: '25 · House power — by source, and what went to the grid', body: stacked() }) +
    card({
      title: '26 · Where it goes — nested, the unmeasured shown, one scale',
      body: nested(),
    }) +
    card({ title: '27 · Production — two arrays', body: arrays() }) +
    card({ title: '28 · Grid power — a signed gauge', body: signedGauge() }) +
    card({ title: '29 · Water & gas — today and right now', body: gasWater() }) +
    card({ title: '30 · Editor — a node, and the YAML it writes', body: editor() }) +
    card({ title: '31 · Balance — dark, Blaze', mode: 'dark', palette: 'blaze', body: balance() }) +
    card({ title: '32 · Car — dark, Iris', mode: 'dark', palette: 'iris', body: car() });
})();
