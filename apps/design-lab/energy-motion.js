/* Energy, next — the motion prototype (round 2): the flow card animated the way the product will do it.
   Pulses travel at constant px/s, 24 → 72 px/s with the flow's share of the house's peak (a long lane is not faster
   than a short one), one to three per lane and never more than eight on a card; a flow that stops rests (its lane at
   50 %, its pulses fade, its node turns neutral) so the diagram never reshuffles; the arcs round the house slide to
   the new mix; a figure changes only when its text does. Transform and opacity only, sampled once per path — the
   arcs' dash is the one exception (three SVG circles, 700 ms). */
(() => {
  'use strict';
  const { F, lane, d, on, node, words, up4, wordsWidth, blockH, w, arrow, endAngle, HEAD } =
    globalThis.EN;

  const W = 320;
  const TOP = 42;
  const PITCH = 80;
  const hc = [W - 28, TOP + PITCH];
  const R = 34;
  const PEAK_KW = 6; // the house's peak (`max_power`): the pace is a share of it
  const MAX_PULSES = 8;

  const ROWS = [
    { key: 'solar', glyph: 'sun', tone: 'solar', label: 'Solar' },
    { key: 'grid', glyph: 'tower', tone: 'grid', label: 'Grid' },
    { key: 'battery', glyph: 'battery', tone: 'battery', label: 'Battery · 62 %' },
  ];

  /*
   * The lanes, drawn once. The sun's only runs in. The battery's and the grid's reverse: one lane whose arrowhead end
   * swaps (by opacity) and whose colour crossfades to the new origin in 400 ms. A grid set up as "in + out" gets a
   * second lane that fades in only while it imports and exports at once. A scene gives each lane a signed power
   * (+ toward the house) and the origin's tone.
   */
  const LANES = [
    { key: 'solar', row: 0 },
    { key: 'grid', row: 1, dy: -8 },
    { key: 'gridOut', row: 1, dy: 8, second: true },
    { key: 'battery', row: 2 },
  ];

  const SCENES = [
    {
      name: 'Midday, the #19 house: importing on two phases, exporting on the third',
      sub: 'Live · 5 s ago',
      badge: ['54 % solar', 'solar'],
      p: {
        solar: [3.2, 'solar'],
        grid: [1.9, 'grid'],
        gridOut: [-0.4, 'solar'],
        battery: [-0.6, 'solar'],
      },
      words: {
        solar: w('Solar', '3.2', 'kW'),
        grid: w('Grid', '1.9', 'kW', 'in', { value: '0.4', unit: 'kW', dir: 'out' }),
        battery: w('Battery · 62 %', '0.6', 'kW', 'charging'),
        house: w('House', '4.1', 'kW'),
      },
      shares: { solar: 0.54, battery: 0, grid: 0.46 },
    },
    {
      name: 'Noon, all sun: the battery fills and the rest goes to the grid',
      sub: 'Live · 5 s ago',
      badge: ['100 % solar', 'solar'],
      p: {
        solar: [4.8, 'solar'],
        grid: [-1.9, 'solar'],
        gridOut: [0, 'solar'],
        battery: [-1.4, 'solar'],
      },
      words: {
        solar: w('Solar', '4.8', 'kW'),
        grid: w('Grid', '1.9', 'kW', 'out'),
        battery: w('Battery · 71 %', '1.4', 'kW', 'charging'),
        house: w('House', '1.5', 'kW'),
      },
      shares: { solar: 1, battery: 0, grid: 0 },
    },
    {
      name: 'Evening: the battery runs the house, the grid tops it up',
      sub: 'Live · 5 s ago',
      badge: ['On the battery', 'battery'],
      p: {
        solar: [0, 'solar'],
        grid: [0.4, 'grid'],
        gridOut: [0, 'solar'],
        battery: [1.2, 'battery'],
      },
      words: {
        solar: w('Solar', '0', 'W'),
        grid: w('Grid', '0.4', 'kW', 'in'),
        battery: w('Battery · 58 %', '1.2', 'kW', 'discharging'),
        house: w('House', '1.6', 'kW'),
      },
      shares: { solar: 0, battery: 0.75, grid: 0.25 },
    },
  ];

  // the tails: 12 px after the widest words any scene shows, so the geometry never moves between scenes
  let TAIL = 0; // measured in build(), once the fonts are in

  /** Every lane drawn toward the house; a flow out runs its pulses backwards and shows its head at the tail. */
  const lanePath = (l, i, n) => {
    const y = TOP + l.row * PITCH + (l.dy || 0);
    if (l.dy && Math.abs(TOP + l.row * PITCH - hc[1]) <= 12) {
      const p = [hc[0] - Math.sqrt(R * R - l.dy * l.dy), hc[1] + l.dy]; // a pair level with the house arrives level
      return lane([TAIL, y], 0, p, 0, (p[0] - TAIL) * 0.45);
    }
    const up = Math.min(60, 16 * (n - 1));
    const down = Math.min(48, 16 * (n - 1));
    const deg = 180 + up - ((up + down) / (n - 1)) * i;
    const p = on(hc, R, deg);
    return lane([TAIL, y], 0, p, deg - 180, (p[0] - TAIL) * 0.45);
  };

  const build = (root) => {
    TAIL = up4(
      56 + Math.max(...SCENES.flatMap((s) => ROWS.map((r) => wordsWidth(s.words[r.key])))) + 12,
    );
    const H = TOP + 2 * PITCH + 50;
    const lanes = LANES.map((l, i) => {
      const path = lanePath(l, i, LANES.length);
      // one lane, two possible heads: its tip at the house for a flow in, at the tail for a flow out; the lane is
      // trimmed (by its dash) at whichever end the head is, so it stops inside the head
      const back = { a: path.b, c1: path.c2, c2: path.c1, b: path.a };
      return (
        `<g class="mo-lane ${l.second ? 'is-second' : ''}" data-lane="${l.key}"><path d="${d(path)}" class="en-lane mo-tone" style="stroke-width:6px"/>` +
        arrow(path.b, endAngle(path), 'solar').replace(
          'class="en-head',
          'class="mo-tone mo-head mo-head--in en-head',
        ) +
        arrow(back.b, endAngle(back), 'solar').replace(
          'class="en-head',
          'class="mo-tone mo-head mo-head--out en-head',
        ) +
        `</g>`
      );
    }).join('');
    const circ = 2 * Math.PI * 26.5;
    const arcs = ['solar', 'battery', 'grid']
      .map(
        (tone) =>
          `<circle cx="${hc[0]}" cy="${hc[1]}" r="26.5" class="en-arc en-arc--${tone} mo-arc" data-arc="${tone}" stroke-dasharray="0 ${circ.toFixed(2)}" transform="rotate(-90 ${hc[0]} ${hc[1]})"/>`,
      )
      .join('');
    root.innerHTML =
      `<figure class="en-figure"><figcaption id="mo-caption"></figcaption>` +
      `<article class="fv-frame fv-card ef-card en-card" data-frame data-mode="${root.dataset.mode || 'light'}" data-palette="${root.dataset.palette || 'linen'}" data-card style="width:360px">` +
      F.head({
        glyph: 'bolt',
        tone: 'accent',
        title: 'Energy flow',
        sub: '<span id="mo-sub"></span>',
        trailing: '<span class="fv-badge mo-badge" data-fit="28" id="mo-badge"></span>',
      }) +
      `<div class="en-stage" id="mo-stage" style="height:${H}px"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${lanes}<circle cx="${hc[0]}" cy="${hc[1]}" r="26.5" class="en-arc-track"/>${arcs}</svg>` +
      ROWS.map(
        (row, i) =>
          node([22, TOP + i * PITCH], row.glyph, row.tone, `mo-node" data-node="${row.key}`) +
          `<div class="en-place mo-words" data-words="${row.key}" style="left:56px;top:${TOP + i * PITCH - 18}px"></div>`,
      ).join('') +
      node(hc, 'home', 'neutral') +
      `<div class="en-place mo-words" data-words="house" style="right:0;top:${hc[1] + 36}px"></div>` +
      `</div></article></figure>`;
  };

  /* ------------------------------------------------------------ the animator */

  const SAMPLES = 48;
  const comets = new Map();
  const pace = (kw) => 24 + 48 * Math.sqrt(Math.min(1, kw / PEAK_KW));
  const density = (kw) => (kw < 0.05 ? 0 : kw < 1 ? 1 : kw < 3 ? 2 : 3);

  const framesOf = (path, reversed) => {
    const len = path.getTotalLength();
    const frames = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const run = len - HEAD.lane.trim; // the lane's length up to the head
      const s = reversed ? len - (i / SAMPLES) * run : (i / SAMPLES) * run;
      const p = path.getPointAtLength(s);
      const q = path.getPointAtLength(reversed ? Math.max(0, s - 1) : Math.min(len, s + 1));
      const r = path.getPointAtLength(reversed ? Math.min(len, s + 1) : Math.max(0, s - 1));
      const a = (Math.atan2(q.y - r.y, q.x - r.x) * 180) / Math.PI;
      const f = i / SAMPLES;
      const fade = f < 0.1 ? f / 0.1 : f > 0.86 ? (1 - f) / 0.14 : 1;
      // the head (the cap's centre, 23 px into the 26 px comet) sits on the path
      frames.push({
        transform: `translate(${(p.x - 23).toFixed(2)}px, ${(p.y - 3).toFixed(2)}px) rotate(${a.toFixed(2)}deg)`,
        opacity: fade.toFixed(3),
      });
    }
    return { frames, len };
  };

  const setText = (el, html, first) => {
    if (el.dataset.html === html) return; // a figure moves only when its text changes
    el.dataset.html = html;
    if (first) {
      el.innerHTML = html;
      return;
    }
    el.animate(
      [
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(-4px)' },
      ],
      { duration: 140, easing: 'ease-in' },
    ).finished.then(() => {
      el.innerHTML = html;
      if (el.id === 'mo-badge') F.fit(el.parentElement);
      el.animate(
        [
          { opacity: 0, transform: 'translateY(4px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 200, easing: 'ease-out' },
      );
    });
  };

  const apply = (scene, first = false) => {
    const stage = document.getElementById('mo-stage');
    document.getElementById('mo-caption').textContent = scene.name;
    setText(document.getElementById('mo-sub'), scene.sub, first);
    const badge = document.getElementById('mo-badge');
    badge.className = `fv-badge fv-badge--${scene.badge[1]} mo-badge`;
    setText(badge, scene.badge[0], first);
    ROWS.forEach((row) => {
      const el = stage.querySelector(`[data-words="${row.key}"]`);
      setText(el, words(scene.words[row.key]), first);
      el.style.top = `${TOP + ROWS.indexOf(row) * PITCH - blockH(scene.words[row.key]) / 2}px`; // centred on its circle
      const idle = Object.entries(scene.p)
        .filter(([k]) => k.startsWith(row.key))
        .every(([, v]) => Math.abs(v[0]) < 0.05);
      const ico = stage.querySelector(`[data-node="${row.key}"] .fv-ico`);
      ico.classList.toggle(`fv-ico--${row.tone}`, !idle);
      ico.classList.toggle('fv-ico--neutral', idle);
      stage.querySelector(`[data-words="${row.key}"]`).classList.toggle('is-resting', idle);
    });
    setText(
      stage.querySelector('[data-words="house"]'),
      words({ ...scene.words.house, align: 'right' }),
      first,
    );

    // the budget: at most eight pulses on the card, the strongest flows first
    const wanted = LANES.map((l) => ({ l, kw: Math.abs(scene.p[l.key][0]) })).sort(
      (a, b) => b.kw - a.kw,
    );
    let budget = MAX_PULSES;
    const counts = new Map();
    for (const { l, kw } of wanted) {
      const g = stage.querySelector(`[data-lane="${l.key}"]`);
      const len = g.querySelector('path').getTotalLength();
      const n = Math.min(budget, density(kw) * Math.max(1, Math.round(len / 140)));
      budget -= n;
      counts.set(l.key, n);
    }

    stage.querySelectorAll('.mo-lane').forEach((g) => {
      const key = g.dataset.lane;
      const [signed, tone] = scene.p[key];
      const kw = Math.abs(signed);
      const out = signed < 0;
      const n = counts.get(key) || 0;
      // the origin's colour (crossfades), the head at the arriving end, the second grid lane only while needed
      g.querySelectorAll('.mo-tone').forEach((el) => {
        el.classList.remove(
          'en-lane--solar',
          'en-lane--grid',
          'en-lane--battery',
          'en-head--solar',
          'en-head--grid',
          'en-head--battery',
        );
        el.classList.add(
          el.classList.contains('en-lane') ? `en-lane--${tone}` : `en-head--${tone}`,
        );
      });
      const lanePathEl = g.querySelector('path.en-lane');
      const L = lanePathEl.getTotalLength();
      const cut = HEAD.lane.trim;
      lanePathEl.style.strokeDasharray = `${(L - cut).toFixed(2)} ${(L + cut).toFixed(2)}`;
      lanePathEl.style.strokeDashoffset = out ? `${(-cut).toFixed(2)}` : '0';
      g.classList.toggle('is-out', out);
      g.classList.toggle('is-resting', n === 0);
      if (g.classList.contains('is-second')) g.classList.toggle('is-hidden', kw < 0.05);
      const old = comets.get(key);
      const same = old && old.list.length === n && old.out === out && old.tone === tone;
      if (n === 0 || (old && !same)) {
        (old?.list || []).forEach((a) =>
          a.effect.target.animate([{ opacity: 1 }, { opacity: 0 }], {
            duration: 400,
            fill: 'forwards',
            composite: 'replace',
          }),
        );
        const doomed = old?.list || [];
        globalThis.setTimeout(() => doomed.forEach((a) => a.effect.target.remove()), 420);
        comets.delete(key);
        if (n === 0) return;
      }
      const path = g.querySelector('path');
      const { frames, len } = framesOf(path, out);
      const duration = (len / pace(kw)) * 1000;
      if (same) {
        old.list.forEach((a) => a.updatePlaybackRate(a.effect.getTiming().duration / duration)); // no jump: WAAPI syncs the position
        return;
      }
      const list = [];
      for (let i = 0; i < n; i++) {
        const el = document.createElement('i');
        el.className = `mo-comet mo-comet--${tone}`;
        stage.appendChild(el);
        const anim = el.animate(frames, {
          duration,
          iterations: Infinity,
          delay: -(duration * i) / n,
          easing: 'linear',
        });
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, composite: 'add' });
        list.push(anim);
      }
      comets.set(key, { list, out, tone });
    });

    const circ = 2 * Math.PI * 26.5;
    const live = Object.values(scene.shares).filter((v) => v > 0).length;
    const gap = live > 1 ? 4 : 0;
    let offset = 0;
    ['solar', 'battery', 'grid'].forEach((tone) => {
      const v = scene.shares[tone];
      const arc = stage.querySelector(`[data-arc="${tone}"]`);
      arc.style.strokeDasharray = `${Math.max(0, v * circ - (v > 0 ? gap : 0)).toFixed(2)} ${circ.toFixed(2)}`;
      arc.style.strokeDashoffset = `${(-offset).toFixed(2)}`;
      offset += v * circ;
    });
  };

  globalThis.renderEnergyMotion = (root, { cycle = true, scene = 0 } = {}) => {
    build(root);
    let i = scene;
    apply(SCENES[i], true);
    if (cycle)
      globalThis.setInterval(() => {
        i = (i + 1) % SCENES.length;
        apply(SCENES[i]);
      }, 4200);
  };
})();
