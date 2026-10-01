/* Energy, next (1.4 design round 2) — the drawing engine and the flow card in every case.

   One colour rule: a lane is coloured by where its energy came from (the sun's surplus to the grid is gold, the
   grid charging the battery is lilac); destinations are ink (the house, every consumer); figures and words are
   never coloured — the direction lives in the unit slot ("0.4 kW out") in the secondary ink. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;

  /* glyphs this round needs (20 grid, 1.75 stroke, like the set) */
  const svg = (body) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  Object.assign(F.G, {
    swap: svg(
      '<path d="M4 8h14"/><path d="M15 5l3 3-3 3"/><path d="M20 16H6"/><path d="M9 13l-3 3 3 3"/>',
    ),
    generator: svg(
      '<path d="M7 4h6l5 5v10.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19.5V5a1 1 0 0 1 1-1Z"/><path d="M9.5 4V2.5h3V4"/><path d="M9 11.5l6 5"/><path d="M15 11.5l-6 5"/>',
    ),
    oven: svg(
      '<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M4 8h16"/><rect x="7.5" y="11" width="9" height="6" rx="1.5"/><path d="M8 5.75h.01M11 5.75h.01"/>',
    ),
    tower: svg(
      '<path d="M12 3 7.5 21"/><path d="M12 3l4.5 18"/><path d="M6 7.5h12"/><path d="M8.2 13h7.6"/><path d="M9.6 7.5 15 13"/><path d="M14.4 7.5 9 13"/><path d="M8.9 18.5 12 16l3.1 2.5"/>',
    ),
  });

  /* ------------------------------------------------------------------ geometry */

  const cubic = (p0, p1, p2, p3, t) => {
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  };
  const at = (l, t) => cubic(l.a, l.c1, l.c2, l.b, t);
  const d = (l) =>
    `M${l.a[0].toFixed(1)},${l.a[1].toFixed(1)} C${l.c1[0].toFixed(1)},${l.c1[1].toFixed(1)} ${l.c2[0].toFixed(1)},${l.c2[1].toFixed(1)} ${l.b[0].toFixed(1)},${l.b[1].toFixed(1)}`;
  const rad = (deg) => (deg * Math.PI) / 180;
  /** The point at `deg` on a circle (0° = right, 90° = down, the SVG convention). */
  const on = (c, r, deg) => [c[0] + r * Math.cos(rad(deg)), c[1] + r * Math.sin(rad(deg))];
  /** Leaves a along `degA`, arrives at b travelling along `degB` (SVG angles), with the same pull at both ends. */
  const lane = (a, degA, b, degB, pull) => ({
    a,
    c1: [a[0] + pull * Math.cos(rad(degA)), a[1] + pull * Math.sin(rad(degA))],
    c2: [b[0] - pull * Math.cos(rad(degB)), b[1] - pull * Math.sin(rad(degB))],
    b,
  });
  const reverse = (l) => ({ a: l.b, c1: l.c2, c2: l.c1, b: l.a });

  /* ------------------------------------------------------------- the pieces */

  /* the arrowhead: a solid rounded triangle in the source's ink, 9 long and 11 wide (the 6 px lane is 3 inside it on
     either side). Its tip IS the flow's end point (6 px off what it reaches); the lane stops 7 px before the tip, so
     its round cap ends inside the head and nothing shows beyond it. For a 2.5 px rail: 6 long, 7 wide, lane 5 short. */
  const HEAD = { lane: { len: 9, half: 5.5, trim: 7 }, rail: { len: 6, half: 3.5, trim: 5 } };
  const headPath = (h) =>
    `M-0.75,0 L${-(h.len - 0.75)},${-h.half + 0.75} L${-(h.len - 0.75)},${h.half - 0.75} Z`;
  const arrow = (tip, deg, tone, { size = 'lane', idle = false } = {}) =>
    `<path d="${headPath(HEAD[size])}" transform="translate(${tip[0].toFixed(2)},${tip[1].toFixed(2)}) rotate(${deg.toFixed(2)})" class="en-head en-head--${tone} ${idle ? 'is-idle' : ''}"/>`;

  /** Arc length along a cubic, sampled; `tAt(l, s)` the parameter at length s. */
  const SAMPLE = 96;
  const measure = (l) => {
    const acc = [0];
    let prev = at(l, 0);
    for (let i = 1; i <= SAMPLE; i++) {
      const p = at(l, i / SAMPLE);
      acc.push(acc[i - 1] + Math.hypot(p[0] - prev[0], p[1] - prev[1]));
      prev = p;
    }
    return acc;
  };
  const tAt = (acc, s) => {
    const total = acc[acc.length - 1];
    const target = Math.max(0, Math.min(total, s));
    let i = 1;
    while (i < acc.length && acc[i] < target) i++;
    const f = (target - acc[i - 1]) / (acc[i] - acc[i - 1] || 1);
    return (i - 1 + f) / SAMPLE;
  };
  /** The part of a cubic from 0 to t (de Casteljau): the lane drawn up to where the head begins. */
  const upTo = (l, t) => {
    const mix = (p, q) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const p01 = mix(l.a, l.c1);
    const p12 = mix(l.c1, l.c2);
    const p23 = mix(l.c2, l.b);
    const p012 = mix(p01, p12);
    const p123 = mix(p12, p23);
    return { a: l.a, c1: p01, c2: p012, b: mix(p012, p123) };
  };
  /** The tangent's angle at the very end, from the last control point (exact, not sampled). */
  const endAngle = (l) => {
    const from = Math.hypot(l.b[0] - l.c2[0], l.b[1] - l.c2[1]) > 0.01 ? l.c2 : l.c1;
    return (Math.atan2(l.b[1] - from[1], l.b[0] - from[0]) * 180) / Math.PI;
  };

  let uid = 0;
  /**
   * One flow. `stream`: a 6 px lane (the source's colour at 40 % over the card) with pulses of light in it — the
   * pulse's head is the lane's round cap in full ink, its tail fades into the lane; pulses end where the lane does.
   * `rest`: a resting lane (the flow is idle, or motion is reduced): 50 %, no pulse, the head at 35 %.
   * `hairline`: an unavailable source, a 1 px dashed line and no head.
   */
  const flow = (
    l,
    tone,
    { style = 'stream', power = 0.5, width = 6, idle = false, pulses = null, chevron = true } = {},
  ) => {
    if (style === 'hairline') return `<path d="${d(l)}" class="en-hairline"/>`;
    const id = `en-g${++uid}`;
    const out = [];
    const resting = idle || style === 'rest';
    const size = width < 4 ? 'rail' : 'lane';
    const acc = measure(l);
    const total = acc[acc.length - 1];
    const tEnd = chevron ? tAt(acc, total - HEAD[size].trim) : 1;
    const body = upTo(l, tEnd);
    out.push(
      `<path d="${d(body)}" class="en-lane en-lane--${tone} ${resting ? 'is-idle' : ''}" style="stroke-width:${width}px"/>`,
    );
    if (!resting && style === 'stream') {
      const count = pulses ?? Math.max(1, Math.min(3, Math.round(power * 3)));
      for (let i = 0; i < count; i++) {
        const t = (0.32 + (i / count) * 0.58) * tEnd; // on the lane, never into the head
        const t0 = Math.max(0, t - 0.18 * tEnd);
        const headP = at(l, t);
        const tailP = at(l, t0);
        out.push(
          `<defs><linearGradient id="${id}-${i}" gradientUnits="userSpaceOnUse" x1="${tailP[0].toFixed(1)}" y1="${tailP[1].toFixed(1)}" x2="${headP[0].toFixed(1)}" y2="${headP[1].toFixed(1)}"><stop offset="0" class="en-tail-a en-tail--${tone}"/><stop offset="1" class="en-tail-b en-tail--${tone}"/></linearGradient></defs>`,
        );
        const pts = [];
        for (let k = 0; k <= 10; k++) pts.push(at(l, t0 + (k / 10) * (t - t0)));
        out.push(
          `<polyline points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')}" class="en-pulse" stroke="url(#${id}-${i})"/>`,
        );
      }
    }
    if (chevron) out.push(arrow(l.b, endAngle(l), tone, { size, idle: resting }));
    return out.join('');
  };

  /** The house: a 44 disc in the neutral, its supply as 3 px arcs at r 26.5 (outer edge 28), sources' colours. */
  const HOUSE_R = 26.5;
  const houseArcs = (c, shares, dim = false) => {
    const circ = 2 * Math.PI * HOUSE_R;
    const live = shares.filter((s) => s.value > 0);
    const gap = live.length > 1 ? 4 : 0;
    let offset = 0;
    const arcs = live
      .map((s) => {
        const len = Math.max(0, s.value * circ - gap);
        const arc = `<circle cx="${c[0]}" cy="${c[1]}" r="${HOUSE_R}" class="en-arc en-arc--${s.tone}" stroke-dasharray="${len.toFixed(2)} ${circ.toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 ${c[0]} ${c[1]})"/>`;
        offset += s.value * circ;
        return arc;
      })
      .join('');
    return (
      `<circle cx="${c[0]}" cy="${c[1]}" r="${HOUSE_R}" class="en-arc-track"/>` +
      (dim ? `<g opacity="0.5">${arcs}</g>` : arcs)
    );
  };

  const node = (c, glyph, tone, extra = '') =>
    `<div class="en-node ${extra}" style="left:${c[0] - 22}px;top:${c[1] - 22}px">${F.ico(glyph, tone)}</div>`;

  /**
   * A node's words: LABEL (11/600 caps) · value 16/600 with its unit and direction 12/600 in the secondary ink ·
   * an optional second value for the other direction. Lines 16 · 20 · 20; the block is centred on its circle.
   */
  const words = ({
    label,
    value,
    unit,
    dir = '',
    second = null,
    align = 'left',
    dim = false,
    dirLine = false,
  }) => {
    const val = (v, u, wd) =>
      `<span class="en-words__value">${v}<small>${u}${wd && !dirLine ? ` ${wd}` : ''}</small></span>` +
      (wd && dirLine ? `<span class="en-words__dir">${wd}</span>` : '');
    return (
      `<span class="en-words en-words--${align} ${dim ? 'is-dim' : ''}"><span class="en-words__label">${label}</span>` +
      val(value, unit, dir) +
      (second ? val(second.value, second.unit, second.dir) : '') +
      `</span>`
    );
  };
  const blockH = (wd) =>
    16 +
    20 +
    (wd.second ? 20 : 0) +
    (wd.dirLine ? (wd.dir ? 16 : 0) + (wd.second && wd.second.dir ? 16 : 0) : 0);
  const place = (x, y, html, anchor = 'left', width = null) =>
    `<div class="en-place" style="${anchor === 'right' ? `right:${x}px` : `left:${x}px`};top:${y}px${width ? `;width:${width}px` : ''}">${html}</div>`;

  /** How wide a node's words are (every lane starts 12 px after the widest words). */
  const wordsWidth = (wd) => {
    const label = F.textWidth(wd.label.toUpperCase(), '600 11px Inter') + wd.label.length * 0.66;
    const line = (v, u, dir) =>
      F.textWidth(v, '600 16px Inter') +
      3 +
      F.textWidth(`${u}${dir ? ` ${dir}` : ''}`, '600 12px Inter');
    return Math.max(
      label,
      line(wd.value, wd.unit, wd.dir),
      wd.second ? line(wd.second.value, wd.second.unit, wd.second.dir) : 0,
    );
  };
  const up4 = (v) => Math.ceil(v / 4) * 4;

  const card = ({ mode = 'light', palette = 'linen', width = 360, body, title, cls = '' }) =>
    `<figure class="en-figure" style="max-width:${Math.max(width, 360)}px"><figcaption>${title}</figcaption><article class="fv-frame fv-card ef-card en-card ${cls}" data-frame data-mode="${mode}" data-palette="${palette}" data-card style="width:${width}px">${body}</article></figure>`;

  const cols = (items, group) =>
    `<div class="ef-cols fv-cols">${items.map((i) => F.readout({ ...i, size: 's', group })).join('')}</div>`;

  /* ------------------------------------------------------------ rows (default) */

  const TOP = 42; // the first node sits one pitch under the head's icon centre
  const PITCH = 80;
  const TEXT = 56;

  /**
   * Sources stacked on the left, the house on the right (or in the middle, consumers on the right). A source can
   * carry two flows at once (the grid importing and exporting): each gets its own lane and contact point.
   * `sources[i].flows` = [{ dir: 'in'|'out', tone, power, idle }].
   */
  const rows = ({ W = 320, sources, house, consumers = null, style = 'stream', dim = false }) => {
    const ys = sources.map((_, i) => TOP + i * PITCH);
    const last = ys[ys.length - 1];
    const hc = [consumers ? W / 2 : W - 28, Math.round((TOP + last) / 2 / 4) * 4];
    const tail = up4(TEXT + Math.max(...sources.map((s) => wordsWidth(s.words))) + 12);
    const R = 34; // the ring's 28 + 6
    // the narrow rule: a lane shorter than 56 px is no lane — the card becomes its list
    if (!consumers && hc[0] - R - tail < 56)
      return list(
        [
          ...sources.map((s) => ({
            glyph: s.glyph,
            tone: s.idle || dim ? 'neutral' : s.tone,
            words: s.words,
          })),
          { glyph: 'home', tone: 'neutral', words: house.words },
        ],
        W,
      );
    const PX = (px) => (px / R) * (180 / Math.PI); // arc px on the 34 ring → degrees
    const slots = sources.map((s, i) => ({ s, row: ys[i], pair: s.flows.length > 1 }));
    const gapOf = (a, b) => 20 + (a.pair ? 8 : 0) + (b.pair ? 8 : 0);
    let need = slots.slice(1).reduce((sum, b, k) => sum + gapOf(slots[k], b), 0);
    let share = false;
    if (PX(need) > 138) {
      share = true; // pairs collapse to one contact each
      need = 20 * (slots.length - 1);
    }
    // centred on the house's left point, at most 48° below it (its words hang there), at most 90° above
    const upDeg = Math.min(90, PX(need) - Math.min(48, PX(need) / 2));
    // walk the slots from the top: the first sits `upDeg` above the left point
    let at0 = 180 + upDeg;
    const contacts = [];
    slots.forEach((slot, k) => {
      if (k > 0) at0 -= PX(share ? 20 : gapOf(slots[k - 1], slot));
      const centre = on(hc, R, at0);
      const tangent = [Math.sin(rad(at0)), -Math.cos(rad(at0))]; // along the ring, clockwise
      slot.s.flows.forEach((f, j) => {
        const off = slot.pair && !share ? (j === 0 ? -8 : 8) : 0;
        const level = slot.pair && Math.abs(slot.row - hc[1]) <= 12;
        const p = level
          ? [hc[0] - Math.sqrt(R * R - (j === 0 ? 64 : 64)), hc[1] + (j === 0 ? -8 : 8)]
          : [centre[0] + tangent[0] * off, centre[1] + tangent[1] * off];
        contacts.push({
          ...f,
          y: slot.row + (slot.pair ? (j === 0 ? -8 : 8) : 0),
          p,
          arrive: level ? 0 : at0 - 180,
          outage: slot.s.outage,
        });
      });
    });
    const lanes = [];
    let rail = '';
    const tx = tail + 32;
    contacts.forEach((c) => {
      const { y, p, arrive } = c;
      const l = lane([tail, y], 0, p, arrive, (p[0] - tail) * 0.45);
      if (c.outage) {
        lanes.push(flow(l, c.tone, { style: 'hairline' }));
        return;
      }
      if (style !== 'rail') {
        lanes.push(
          flow(c.dir === 'in' ? l : reverse(l), c.tone, {
            style,
            power: c.power,
            idle: c.idle || dim,
          }),
        );
        return;
      }
      // rail: what comes in joins one 2.5 px track into the house; what goes out keeps its own connector, its
      // chevron 6 px before the words
      if (c.dir === 'in') {
        const k = y < hc[1] ? 1 : y > hc[1] ? -1 : 0;
        const path = k
          ? `M${tail},${y} H${tx - 12} Q${tx},${y} ${tx},${y + 12 * k} V${hc[1]}`
          : `M${tail},${y} H${tx}`;
        rail += `<path d="${path}" class="en-rail en-rail--${c.tone} ${c.idle ? 'is-idle' : ''}"/>`;
      } else {
        const back = reverse(lane([tail + 6, y], 0, p, arrive, (p[0] - tail) * 0.45));
        const acc = measure(back);
        rail += `<path d="${d(upTo(back, tAt(acc, acc[acc.length - 1] - HEAD.rail.trim)))}" class="en-rail en-rail--${c.tone}"/>`;
        rail += arrow(back.b, endAngle(back), c.tone, { size: 'rail' });
      }
    });
    if (style === 'rail')
      rail += flow(
        { a: [tx, hc[1]], c1: [tx + 20, hc[1]], c2: [hc[0] - 54, hc[1]], b: [hc[0] - R, hc[1]] },
        'home',
        { style: 'stream', power: 0.6, width: 2.5, pulses: 0 },
      );
    let right = '';
    let rightBottom = 0;
    if (consumers) {
      const cys = consumers.map((_, i) =>
        consumers.length === 1 ? hc[1] : TOP + ((last - TOP) / (consumers.length - 1)) * i,
      );
      const ctail = W - up4(TEXT + Math.max(...consumers.map((c) => wordsWidth(c.words))) + 12);
      const m = consumers.length;
      const cup = m === 1 ? 0 : Math.min(60, 16 * (m - 1));
      const cdown = m === 1 ? 0 : Math.min(48, 16 * (m - 1));
      consumers.forEach((c, i) => {
        const deg = m === 1 ? 0 : -cup + ((cup + cdown) / (m - 1)) * i;
        const p = on(hc, R, deg);
        lanes.push(
          flow(lane(p, deg, [ctail, cys[i]], 0, (ctail - p[0]) * 0.45), 'home', {
            style,
            power: c.power,
            idle: c.idle,
          }),
        );
        right +=
          node([W - 22, cys[i]], c.glyph, 'neutral') +
          place(56, cys[i] - blockH(c.words) / 2, words({ ...c.words, align: 'right' }), 'right');
        rightBottom = Math.max(rightBottom, cys[i] + Math.max(22, blockH(c.words) / 2));
      });
    }
    // the stage ends at its last words (the card's own 20 px padding follows)
    const H = up4(
      Math.max(
        last + Math.max(22, blockH(sources[sources.length - 1].words) / 2),
        hc[1] + 36 + blockH(house.words),
        rightBottom,
      ),
    );
    return (
      `<div class="en-stage" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${rail}${lanes.join('')}${houseArcs(hc, house.shares, dim)}</svg>` +
      sources
        .map(
          (s, i) =>
            node(
              [22, ys[i]],
              s.glyph,
              s.idle || dim ? 'neutral' : s.tone,
              s.outage ? 'is-outage' : '',
            ) + place(TEXT, ys[i] - blockH(s.words) / 2, words({ ...s.words, dim: s.idle || dim })),
        )
        .join('') +
      node(hc, 'home', 'neutral') +
      (consumers
        ? place(hc[0] - 60, hc[1] + 36, words({ ...house.words, align: 'center' }), 'left', 120)
        : place(0, hc[1] + 36, words({ ...house.words, align: 'right' }), 'right')) +
      right +
      `</div>`
    );
  };

  /* ---------------------------------------------------------------- the cross */

  /**
   * Home Assistant's arrangement in our idiom: the sun above, the grid left, the house right, the battery below.
   * Each source's lane into the house is always there (at rest when idle); the lanes BETWEEN sources (sun → grid,
   * sun → battery, grid ↔ battery) appear while they carry energy. Mirror-symmetric about x 157 (between the grid's
   * and the house's centres): every diagonal leaves at ±45° and arrives radially with one pull; every chevron sits
   * 6 px off what it reaches; the grid→house lane bridges the sun→battery lane where they cross.
   */
  const cross = ({ W = 320, sun, grid, battery, house, flows }) => {
    const G = [22, 150];
    const Hc = [W - 28, 150];
    const mid = (G[0] + Hc[0]) / 2;
    const S = [mid, 30];
    const B = [mid, 270];
    const r44 = 28;
    const rH = 34;
    const pull = 44;
    const paths = {
      sunGrid: lane(on(S, 22, 135), 135, on(G, r44, -45), 135, pull),
      sunHouse: lane(on(S, 22, 45), 45, on(Hc, rH, -135), 45, pull),
      sunBattery: lane([S[0], S[1] + 22], 90, [B[0], B[1] - r44], 90, 60),
      gridHouse: lane([G[0] + 22, G[1]], 0, [Hc[0] - rH, Hc[1]], 0, 80),
      gridBattery: lane(on(G, 22, 45), 45, on(B, r44, -135), 45, pull),
      batteryHouse: lane(on(B, 22, -45), -45, on(Hc, rH, 135), -45, pull),
    };
    const resting = { sunHouse: 'solar', gridHouse: 'grid', batteryHouse: 'battery' };
    const out = [];
    for (const key of [
      'sunBattery',
      'sunGrid',
      'gridBattery',
      'sunHouse',
      'batteryHouse',
      'gridHouse',
    ]) {
      const f = flows[key] || (resting[key] ? { tone: resting[key], idle: true } : null);
      if (!f) continue;
      let l = paths[key];
      if (f.reverse)
        l =
          key === 'gridBattery'
            ? lane(on(B, 22, -135), -135, on(G, r44, 45), -135, pull)
            : reverse(l);
      if (key === 'gridHouse' && flows.sunBattery)
        out.push(`<path d="${d(l)}" class="en-knockout"/>`);
      out.push(flow(l, f.tone, { power: f.power, idle: f.idle }));
    }
    const H = B[1] + 22;
    return (
      `<div class="en-stage" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${out.join('')}${houseArcs(Hc, house.shares)}</svg>` +
      node(S, 'sun', sun.idle ? 'neutral' : 'solar') +
      place(S[0] + 34, S[1] - blockH(sun.words) / 2, words({ ...sun.words, dim: sun.idle })) +
      node(G, 'tower', grid.idle ? 'neutral' : 'grid') +
      place(0, G[1] + 30, words(grid.words)) +
      node(Hc, 'home', 'neutral') +
      place(0, Hc[1] + 36, words({ ...house.words, align: 'right' }), 'right') +
      node(B, 'battery', battery.idle ? 'neutral' : 'battery') +
      place(B[0] + 34, B[1] - blockH(battery.words) / 2, words(battery.words)) +
      `</div>`
    );
  };

  /* ------------------------------------------------------------ half a column */

  const fill = (items) =>
    `<div class="fv-chips fv-chips--fill" style="grid-template-columns:repeat(${items.length}, minmax(0, 1fr))">${items
      .map(
        (c) =>
          `<button class="fv-chip ${c.active ? 'is-active' : ''}" data-target><span class="fv-chip__pill" data-control>${c.label}</span></button>`,
      )
      .join('')}</div>`;

  const list = (items, W = 320) =>
    `<div class="en-list">${items
      .map((r) => {
        const line = (v, u, dir) =>
          F.textWidth(v, '600 16px Inter') +
          3 +
          F.textWidth(`${u}${dir ? ` ${dir}` : ''}`, '600 12px Inter');
        const room = W - 56;
        const wraps =
          line(r.words.value, r.words.unit, r.words.dir) > room ||
          (r.words.second &&
            line(r.words.second.value, r.words.second.unit, r.words.second.dir) > room);
        return `<div class="en-list__row">${F.ico(r.glyph, r.tone)}${words({ ...r.words, dirLine: wraps })}</div>`;
      })
      .join('')}</div>`;

  /* ---------------------------------------------------------------- the cases */

  const head = (o) => F.head({ glyph: 'bolt', tone: 'accent', title: 'Energy flow', ...o });
  const w = (label, value, unit, dir = '', second = null) => ({ label, value, unit, dir, second });

  /** The #19 house at midday: 3.2 kW of sun, the grid 1.9 in and 0.4 out, the battery charging 0.6 from the sun. */
  const H19 = {
    sources: [
      {
        glyph: 'sun',
        tone: 'solar',
        words: w('Solar', '3.2', 'kW'),
        flows: [{ dir: 'in', tone: 'solar', power: 0.6 }],
      },
      {
        glyph: 'tower',
        tone: 'grid',
        words: w('Grid', '1.9', 'kW', 'in', { value: '0.4', unit: 'kW', dir: 'out' }),
        flows: [
          { dir: 'in', tone: 'grid', power: 0.4 },
          { dir: 'out', tone: 'solar', power: 0.15 },
        ],
      },
      {
        glyph: 'battery',
        tone: 'battery',
        words: w('Battery · 62 %', '0.6', 'kW', 'charging'),
        flows: [{ dir: 'out', tone: 'solar', power: 0.2 }],
      },
    ],
    house: {
      words: w('House', '4.1', 'kW'),
      shares: [
        { tone: 'solar', value: 0.54 },
        { tone: 'grid', value: 0.46 },
      ],
    },
  };
  const live = () => ({ sub: 'Live · 5 s ago', trailing: F.badge('54 % solar', 'solar') });

  const flow19 = () =>
    head(live()) +
    rows(H19) +
    cols(
      [
        { label: 'Self-powered', value: '72', unit: '%' },
        { label: 'Exported', value: '1.3', unit: 'kWh' },
        { label: 'Imported', value: '4.1', unit: 'kWh' },
      ],
      'f19',
    );

  const cross19 = () =>
    head(live()) +
    cross({
      sun: { words: w('Solar', '3.2', 'kW') },
      grid: { words: w('Grid', '1.9', 'kW', 'in', { value: '0.4', unit: 'kW', dir: 'out' }) },
      battery: { words: w('Battery · 62 %', '0.6', 'kW', 'charging') },
      house: H19.house,
      flows: {
        sunHouse: { tone: 'solar', power: 0.6 },
        sunGrid: { tone: 'solar', power: 0.15 },
        sunBattery: { tone: 'solar', power: 0.25 },
        gridHouse: { tone: 'grid', power: 0.4 },
      },
    });

  const crossNight = () =>
    head({ sub: 'Cheap hours · until 05:00', trailing: F.badge('Charging', 'grid') }) +
    cross({
      sun: { idle: true, words: w('Solar', '0', 'W') },
      grid: { words: w('Grid', '4.2', 'kW', 'in') },
      battery: { words: w('Battery · 38 %', '3.6', 'kW', 'charging') },
      house: { words: w('House', '0.6', 'kW'), shares: [{ tone: 'grid', value: 1 }] },
      flows: { gridHouse: { tone: 'grid', power: 0.2 }, gridBattery: { tone: 'grid', power: 0.6 } },
    });

  const crossPeak = () =>
    head({ sub: 'Peak price · 0.42 €/kWh', trailing: F.badge('Selling', 'battery') }) +
    cross({
      sun: { idle: true, words: w('Solar', '0', 'W') },
      grid: { words: w('Grid', '2.1', 'kW', 'out') },
      battery: { words: w('Battery · 71 %', '3.0', 'kW', 'discharging') },
      house: { words: w('House', '0.9', 'kW'), shares: [{ tone: 'battery', value: 1 }] },
      flows: {
        batteryHouse: { tone: 'battery', power: 0.3 },
        gridBattery: { tone: 'battery', power: 0.5, reverse: true },
      },
    });

  const flowWide = () =>
    head({ sub: 'Live · 5 s ago', trailing: F.badge('79 % solar', 'solar') }) +
    rows({
      W: 696,
      sources: [
        {
          glyph: 'sun',
          tone: 'solar',
          words: w('Solar', '4.6', 'kW'),
          flows: [{ dir: 'in', tone: 'solar', power: 0.8 }],
        },
        {
          glyph: 'tower',
          tone: 'grid',
          words: w('Grid', '0.9', 'kW', 'in'),
          flows: [{ dir: 'in', tone: 'grid', power: 0.3 }],
        },
        {
          glyph: 'battery',
          tone: 'battery',
          words: w('Battery · 48 %', '0.3', 'kW', 'discharging'),
          flows: [{ dir: 'in', tone: 'battery', power: 0.15 }],
        },
      ],
      house: {
        words: w('House', '5.8', 'kW'),
        shares: [
          { tone: 'solar', value: 0.79 },
          { tone: 'battery', value: 0.05 },
          { tone: 'grid', value: 0.16 },
        ],
      },
      consumers: [
        { glyph: 'car', words: w('Car · 64 %', '3.7', 'kW'), power: 0.7 },
        { glyph: 'heater', words: w('Heat pump', '1.2', 'kW'), power: 0.35 },
        { glyph: 'plug', words: w('Rest of the house', '0.9', 'kW'), power: 0.2 },
      ],
    });

  const flowIsland = () =>
    F.head({
      glyph: 'bolt',
      tone: 'accent',
      title: 'Cabin',
      sub: 'Off grid',
      trailing: F.badge('Generator', 'gas'),
    }) +
    rows({
      sources: [
        {
          glyph: 'sun',
          tone: 'solar',
          words: w('Solar', '0.8', 'kW'),
          flows: [{ dir: 'in', tone: 'solar', power: 0.2 }],
        },
        {
          glyph: 'generator',
          tone: 'gas',
          words: w('Generator', '2.0', 'kW'),
          flows: [{ dir: 'in', tone: 'gas', power: 0.5 }],
        },
        {
          glyph: 'battery',
          tone: 'battery',
          words: w('Battery · 64 %', '1.4', 'kW', 'discharging'),
          flows: [{ dir: 'in', tone: 'battery', power: 0.35 }],
        },
      ],
      house: {
        words: w('House', '4.2', 'kW'),
        shares: [
          { tone: 'solar', value: 0.19 },
          { tone: 'gas', value: 0.48 },
          { tone: 'battery', value: 0.33 },
        ],
      },
    });

  const flowToday = () =>
    F.head({
      glyph: 'bolt',
      tone: 'accent',
      title: 'Today',
      sub: 'Since midnight',
      trailing: F.badge('72 % self-powered', 'solar'),
    }) +
    `<div class="en-period">${fill([{ label: 'Day', active: true }, { label: 'Week' }, { label: 'Month' }])}</div>` +
    rows({
      style: 'rest',
      sources: [
        {
          glyph: 'sun',
          tone: 'solar',
          words: w('Solar', '11.2', 'kWh'),
          flows: [{ dir: 'in', tone: 'solar' }],
        },
        {
          glyph: 'tower',
          tone: 'grid',
          words: w('Grid', '4.1', 'kWh', 'in', { value: '1.3', unit: 'kWh', dir: 'out' }),
          flows: [
            { dir: 'in', tone: 'grid' },
            { dir: 'out', tone: 'solar' },
          ],
        },
        {
          glyph: 'battery',
          tone: 'battery',
          words: w('Battery', '2.4', 'kWh', 'discharged', {
            value: '3.0',
            unit: 'kWh',
            dir: 'charged',
          }),
          flows: [
            { dir: 'in', tone: 'battery' },
            { dir: 'out', tone: 'solar' },
          ],
        },
      ],
      house: {
        words: w('House', '13.4', 'kWh'),
        shares: [
          { tone: 'solar', value: 0.51 },
          { tone: 'battery', value: 0.18 },
          { tone: 'grid', value: 0.31 },
        ],
      },
    }).replaceAll('is-idle', 'is-total');

  const flowMany = () =>
    head({ sub: 'Live · 5 s ago', trailing: F.badge('88 % solar', 'solar') }) +
    rows({
      sources: [
        {
          glyph: 'sun',
          tone: 'solar',
          words: w('East roof', '2.1', 'kW'),
          flows: [{ dir: 'in', tone: 'solar', power: 0.5 }],
        },
        {
          glyph: 'sun',
          tone: 'solar',
          words: w('West roof', '1.4', 'kW'),
          flows: [{ dir: 'in', tone: 'solar', power: 0.35 }],
        },
        {
          glyph: 'tower',
          tone: 'grid',
          words: w('Grid', '0.3', 'kW', 'in'),
          flows: [{ dir: 'in', tone: 'grid', power: 0.1 }],
        },
        {
          glyph: 'battery',
          tone: 'battery',
          words: w('Garage · 72 %', '0.8', 'kW', 'charging'),
          flows: [{ dir: 'out', tone: 'solar', power: 0.25 }],
        },
        {
          glyph: 'battery',
          tone: 'battery',
          words: w('Basement · 40 %', '0.5', 'kW', 'discharging'),
          flows: [{ dir: 'in', tone: 'battery', power: 0.15 }],
        },
      ],
      house: {
        words: w('House', '3.5', 'kW'),
        shares: [
          { tone: 'solar', value: 0.77 },
          { tone: 'battery', value: 0.14 },
          { tone: 'grid', value: 0.09 },
        ],
      },
    });

  const flowOutage = () =>
    head({ sub: 'Grid down since 14:02', trailing: F.badge('Outage', 'warning') }) +
    rows({
      sources: [
        {
          glyph: 'sun',
          tone: 'solar',
          words: w('Solar', '1.8', 'kW'),
          flows: [{ dir: 'in', tone: 'solar', power: 0.4 }],
        },
        {
          glyph: 'tower',
          tone: 'grid',
          idle: true,
          outage: true,
          words: w('Grid', '—', ''),
          flows: [{ dir: 'in', tone: 'grid', idle: true }],
        },
        {
          glyph: 'battery',
          tone: 'battery',
          words: w('Battery · 81 %', '0.9', 'kW', 'discharging'),
          flows: [{ dir: 'in', tone: 'battery', power: 0.25 }],
        },
      ],
      house: {
        words: w('House', '2.7', 'kW'),
        shares: [
          { tone: 'solar', value: 0.67 },
          { tone: 'battery', value: 0.33 },
        ],
      },
    });

  const flowStale = () =>
    head({ sub: 'Updated 12 min ago', trailing: '' }) + rows({ ...H19, dim: true });

  const flowV2H = () =>
    head({ sub: 'Live · 5 s ago', trailing: F.badge('On the car', 'water') }) +
    rows({
      sources: [
        {
          glyph: 'sun',
          tone: 'solar',
          idle: true,
          words: w('Solar', '0', 'W'),
          flows: [{ dir: 'in', tone: 'solar', idle: true }],
        },
        {
          glyph: 'tower',
          tone: 'grid',
          words: w('Grid', '0.2', 'kW', 'in'),
          flows: [{ dir: 'in', tone: 'grid', power: 0.1 }],
        },
        {
          glyph: 'car',
          tone: 'water',
          words: w('Car · 58 %', '2.4', 'kW', 'discharging'),
          flows: [{ dir: 'in', tone: 'water', power: 0.5 }],
        },
      ],
      house: {
        words: w('House', '2.6', 'kW'),
        shares: [
          { tone: 'water', value: 0.92 },
          { tone: 'grid', value: 0.08 },
        ],
      },
    });

  const flowRail = () => head(live()) + rows({ ...H19, style: 'rail' });
  const flowStill = () =>
    head(live()) + rows({ ...H19, style: 'rest' }).replaceAll('is-idle', 'is-still');

  const flowWall = () =>
    F.head({
      glyph: 'bolt',
      tone: 'accent',
      title: 'Energiefluss',
      sub: 'Live · vor 5 s',
      trailing: F.badge('54 % Solar', 'solar'),
    }) +
    rows({
      W: 424,
      sources: [
        { ...H19.sources[0], words: w('Solar', '3,2', 'kW') },
        {
          ...H19.sources[1],
          words: w('Netz', '1,9', 'kW', 'Bezug', { value: '0,4', unit: 'kW', dir: 'Einspeisung' }),
        },
        { ...H19.sources[2], words: w('Batterie · 62 %', '0,6', 'kW', 'lädt') },
      ],
      house: { words: w('Haus', '4,1', 'kW'), shares: H19.house.shares },
    });

  const flowDesk = () => head(live()) + rows({ ...H19, W: 312 });
  const flowNarrowest = () => head({ sub: 'Live · 5 s ago' }) + rows({ ...H19, W: 248 });

  const flowHalf = () =>
    F.head({ glyph: 'bolt', tone: 'accent', title: 'Energy', sub: '' }) +
    list(
      [
        { glyph: 'sun', tone: 'solar', words: w('Solar', '3.2', 'kW') },
        {
          glyph: 'tower',
          tone: 'grid',
          words: w('Grid', '1.9', 'kW', 'in', { value: '0.4', unit: 'kW', dir: 'out' }),
        },
        { glyph: 'battery', tone: 'battery', words: w('Battery', '0.6', 'kW', 'charging') },
        { glyph: 'home', tone: 'neutral', words: w('House', '4.1', 'kW') },
      ],
      132,
    );

  globalThis.EN = {
    arrow,
    measure,
    tAt,
    upTo,
    endAngle,
    HEAD,
    list,
    fill,
    F,
    lane,
    at,
    d,
    on,
    flow,
    node,
    words,
    place,
    card,
    cols,
    houseArcs,
    up4,
    wordsWidth,
    blockH,
    rows,
    cross,
    w,
    H19,
  };

  globalThis.renderEnergyFlow = (root) => {
    root.innerHTML =
      card({
        title: '1 · Flow — the #19 house: the grid imports and exports at once',
        body: flow19(),
      }) +
      card({ title: '2 · Flow — cross: the flows between sources', body: cross19() }) +
      card({
        title: '3 · Flow — the #19 house, dark, Volt',
        mode: 'dark',
        palette: 'volt',
        body: flow19(),
      }) +
      card({
        title: '4 · Flow — where it goes: consumers (desktop span, 736)',
        width: 736,
        body: flowWide(),
      }) +
      card({
        title: '5 · Flow — cheap hours: the grid charges the battery (cross, dark, Mint)',
        mode: 'dark',
        palette: 'mint',
        body: crossNight(),
      }) +
      card({ title: '6 · Flow — peak price: the battery sells to the grid', body: crossPeak() }) +
      card({
        title: '7 · Flow — two roofs and two batteries, each its own node',
        body: flowMany(),
      }) +
      card({ title: '8 · Flow — off grid: the generator', body: flowIsland() }) +
      card({ title: '9 · Flow — the grid is down', body: flowOutage() }) +
      card({ title: '10 · Flow — stale: nothing new for 12 min', body: flowStale() }) +
      card({ title: '11 · Flow — the car powers the house (V2H)', body: flowV2H() }) +
      card({ title: '12 · Flow — today in kWh, with the period', body: flowToday() }) +
      card({ title: '13 · Flow — rail style', body: flowRail() }) +
      card({ title: '14 · Flow — reduced motion (the still)', body: flowStill() }) +
      card({
        title: '15 · Flow — a wall tablet column (464), German',
        width: 464,
        body: flowWall(),
      }) +
      card({ title: '16 · Flow — a desktop column (352)', width: 352, body: flowDesk() }) +
      card({
        title: '16b · Flow — the narrowest column (288): lanes under 56 px become the list',
        width: 288,
        body: flowNarrowest(),
      }) +
      card({ title: '17 · Flow — half a phone column (172)', width: 172, body: flowHalf() });
  };
})();
