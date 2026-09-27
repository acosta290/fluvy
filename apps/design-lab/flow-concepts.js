/* Three ways to draw the energy flow (exploration, 2026-09-18): ribbons, hub ring, rail. Same data as the user's card:
   solar 4.6 kW, grid 1.8 kW exported, house 2.8 kW. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const card = (body, cls = '') =>
    `<article class="fv-frame fv-card ef-card ${cls}" data-frame data-mode="light" data-palette="linen" data-card>${body}</article>`;
  const headOf = () =>
    F.head({
      glyph: 'bolt',
      tone: 'solar',
      title: 'Energy flow',
      sub: 'Live · 5 s ago',
      trailing: F.badge('100 % solar', 'solar'),
    });
  const totals = () =>
    `<div class="ef-cols fv-cols">${F.readout({ label: 'Self-use', value: '61', unit: '%', size: 's', group: 'f' })}${F.readout({ label: 'Exported', value: '1.3', unit: 'kWh', size: 's', group: 'f' })}${F.readout({ label: 'Imported', value: '0.2', unit: 'kWh', size: 's', group: 'f' })}</div>`;
  const node = (y, glyph, tone, label, value) =>
    `<div class="ef-node" style="left:0;top:${y - 22}px">${F.ico(glyph, tone)}</div><div class="ef-node__text" style="left:56px;top:${y - 18}px;width:120px"><span class="ef-node__label">${label}</span><span class="ef-node__value">${value}</span></div>`;
  const chevron = (x, y, cls, left) =>
    `<path d="M${left ? x + 5 : x - 5},${y - 4} L${x},${y} L${left ? x + 5 : x - 5},${y + 4}" class="fc-chev fc-chev--${cls}"/>`;
  const dots = (cls, points) =>
    points
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" class="fc-dot fc-dot--${cls}"/>`)
      .join('');

  /* 1 · ribbons: the thickness of each band is its power, so the mix reads without numbers; dots travel along the band */
  const ribbons = () => {
    const house = { x: 292, y: 82, r: 28 };
    const band = (y0, t0, s0, s1, cls) => {
      const x0 = 176,
        x1 = house.x - house.r - 2,
        c = 44;
      const top = `M${x0},${y0 - t0 / 2} C${x0 + c},${y0 - t0 / 2} ${x1 - c},${s0} ${x1},${s0}`;
      const bottom = `L${x1},${s1} C${x1 - c},${s1} ${x0 + c},${y0 + t0 / 2} ${x0},${y0 + t0 / 2} Z`;
      return `<path d="${top} ${bottom}" class="fc-band fc-band--${cls}"/>`;
    };
    // slots at the house: 36 px of band centred on it, solar (in) above, grid (out) below, proportional to power
    const total = 4.6 + 1.8;
    const hs = 36 * (4.6 / total);
    const hg = 36 - hs;
    const bands =
      band(42, 22, house.y - 18, house.y - 18 + hs, 'solar') +
      band(122, 10, house.y + 18 - hg, house.y + 18, 'grid');
    const d =
      dots('solar', [
        [204, 44],
        [232, 56],
      ]) +
      chevron(258, 66, 'solar', false) +
      dots('grid', [
        [252, 98],
        [226, 110],
      ]) +
      chevron(184, 121, 'grid', true);
    const houseEl =
      `<div class="ef-node ef-node--house fc-house" style="left:${house.x - 28}px;top:${house.y - 28}px">${F.ico('home', 'accent')}</div>` +
      `<div class="ef-node__text ef-node__text--house" style="right:0;top:${house.y + 36}px"><span class="ef-node__label">House</span><span class="ef-node__value">2.8 kW</span></div>`;
    return card(
      headOf() +
        `<div class="ef-stage" style="height:184px"><svg width="320" height="184" viewBox="0 0 320 184" aria-hidden="true">${bands}${d}</svg>${node(42, 'sun', 'solar', 'Solar', '4.6 kW')}${node(122, 'bolt', 'grid', 'Grid · export', '1.8 kW')}${houseEl}</div>` +
        totals(),
    );
  };

  /* 2 · hub: the house is a ring whose arcs are the mix; sources sit around it, short dotted arcs feed the ring */
  const hub = () => {
    const cx = 160,
      cy = 100,
      R = 44;
    const arc = (a0, a1, cls) => {
      const p = (a) => [
        cx + R * Math.cos((a * Math.PI) / 180),
        cy + R * Math.sin((a * Math.PI) / 180),
      ];
      const [x0, y0] = p(a0);
      const [x1, y1] = p(a1);
      return `<path d="M${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)},${y1.toFixed(1)}" class="fc-arc fc-arc--${cls}"/>`;
    };
    // the house is 100 % solar: the whole ring is solar; the exported share is drawn outside it as the grid's own arc
    const ring =
      `<circle cx="${cx}" cy="${cy}" r="${R}" class="fc-ring"/>` + arc(-90, 269, 'solar');
    const feed = (x0, y0, a, cls) => {
      const x1 = cx + (R + 8) * Math.cos((a * Math.PI) / 180),
        y1 = cy + (R + 8) * Math.sin((a * Math.PI) / 180);
      return `<path d="M${x0},${y0} Q${(x0 + x1) / 2 + 10},${(y0 + y1) / 2 - 14} ${x1.toFixed(1)},${y1.toFixed(1)}" class="fc-feed fc-feed--${cls}"/>`;
    };
    const svg = `<svg width="320" height="200" viewBox="0 0 320 200" aria-hidden="true">${ring}${feed(70, 42, -150, 'solar')}${feed(70, 158, 150, 'grid')}${dots(
      'solar',
      [
        [88, 48],
        [104, 60],
      ],
    )}${dots('grid', [
      [104, 140],
      [88, 152],
    ])}</svg>`;
    const src = (y, glyph, tone) =>
      `<div class="ef-node" style="left:0;top:${y - 22}px">${F.ico(glyph, tone)}</div>`;
    const text = (y, label, value) =>
      `<div class="ef-node__text" style="left:56px;top:${y - 18}px;width:100px"><span class="ef-node__label">${label}</span><span class="ef-node__value">${value}</span></div>`;
    const centre = `<div class="fc-hub" style="left:${cx - 32}px;top:${cy - 32}px"><span class="fc-hub__value">2.8<small> kW</small></span><span class="fc-hub__label">House</span></div>`;
    const right = `<div class="ef-node__text ef-node__text--house" style="right:0;top:${cy - 18}px"><span class="ef-node__label">Self-use</span><span class="ef-node__value">61 %</span></div>`;
    return card(
      headOf() +
        `<div class="ef-stage" style="height:200px">${svg}${src(42, 'sun', 'solar')}${text(42, 'Solar', '4.6 kW')}${src(158, 'bolt', 'grid')}${text(158, 'Grid · export', '1.8 kW')}${centre}${right}</div>` +
        totals(),
    );
  };

  /* 3 · rail: one straight rail to the house; each source joins it with a rounded connector; the dots of every source share the rail */
  const rail = () => {
    const y = 82,
      x0 = 176,
      xh = 292;
    const track = `<path d="M${x0 + 36},${y} H${xh - 28}" class="fc-rail"/>`;
    const join = (yy, cls, up) =>
      `<path d="M${x0},${yy} H${x0 + 24} a12,12 0 0 ${up ? 0 : 1} 12,${up ? -12 : 12} V${up ? y + 12 : y - 12} a12,12 0 0 ${up ? 1 : 0} 12,${up ? -12 : 12} H${xh - 28}" class="fc-line fc-line--${cls}"/>`;
    const svg = `<svg width="320" height="164" viewBox="0 0 320 164" aria-hidden="true">${track}${join(42, 'solar', false)}${join(122, 'grid', true)}${dots(
      'solar',
      [
        [194, 42],
        [212, 62],
        [238, 82],
      ],
    )}${chevron(262, 82, 'solar', false)}${dots('grid', [
      [250, 82],
      [212, 102],
    ])}${chevron(182, 122, 'grid', true)}</svg>`;
    const houseEl =
      `<div class="ef-node ef-node--house" style="left:${xh - 22}px;top:${y - 22}px">${F.ico('home', 'accent')}</div>` +
      `<div class="ef-node__text ef-node__text--house" style="right:0;top:${y + 30}px"><span class="ef-node__label">House</span><span class="ef-node__value">2.8 kW</span></div>`;
    return card(
      headOf() +
        `<div class="ef-stage" style="height:164px">${svg}${node(42, 'sun', 'solar', 'Solar', '4.6 kW')}${node(122, 'bolt', 'grid', 'Grid · export', '1.8 kW')}${houseEl}</div>` +
        totals(),
    );
  };

  globalThis.renderFlowConcepts = (root) => {
    void hub;
    root.innerHTML = [ribbons(), rail()]
      .map(
        (c, i) =>
          `<div class="lab-cell"><p class="lab-caption">${['A · Cintas: el grosor es la potencia', 'B · Raíl: una vía, puntos compartidos'][i]}</p>${c}</div>`,
      )
      .join('');
  };
})();
