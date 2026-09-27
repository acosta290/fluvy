/* Calendar set (round 8 v2). ONE table of events drives every view — month dots, week counts, badges, the Tomorrow
   row, the timeline and the upcoming list — so the views cannot disagree. Thursday 17 September 2026, 21:47.
   Calendars never use the accent (accent = today, selection, now, the primary action): chores cool, family heat,
   Ona water, personal media, services grid. */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const card = (mode, body, cls = '') =>
    `<article class="fv-frame fv-card cd-card ${cls}" data-frame data-mode="${mode}" data-palette="linen" data-card>${body}</article>`;

  const TODAY = 17;
  const NOW = 21 + 47 / 60;
  /* date → events: [from, to, title, place, calendar tone]; times as decimal hours, null = all day */
  const DAYS = {
    3: [[10, 11, 'Dentist', 'Ona · Clínica Sants', 'water']],
    9: [[19, 20, 'Yoga', 'Online', 'media']],
    12: [[9, 12, 'Market', 'Sant Antoni', 'heat']],
    14: [[9.5, 10, 'Team call', 'Online', 'media']],
    16: [
      [19, 20, 'Yoga', 'Online', 'media'],
      [21, 21.5, 'Bins out', 'Glass', 'cool'],
    ],
    17: [
      [9.5, 10.25, 'Dentist', 'Ona · Clínica Sants', 'water'],
      [13, 14.5, 'Lunch with Pau', 'Casa Lola', 'heat'],
      [18.5, 19.5, 'Yoga', 'Online', 'media'],
      [22, 22.5, 'Bins out', 'Paper & cardboard', 'cool'],
    ],
    18: [
      [8.25, 9, 'School run', 'Ona', 'water'],
      [19, 21, 'Dinner with Marta & Pau', 'Home', 'heat'],
    ],
    19: [[null, null, 'Grandparents visit', 'Lleida', 'heat']],
    21: [[10, 12, 'Boiler service', 'Technician', 'grid']],
    25: [[18.5, 19.5, 'Yoga', 'Online', 'media']],
    28: [[9, 9.5, 'Team call', 'Online', 'media']],
  };
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dow = (d) => DOW[(d + 0) % 7]; // 1 Sep 2026 is a Tuesday → day d has weekday index (d) % 7 with Mon = 0
  const hm = (h) =>
    `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  const count = (d) => (DAYS[d] || []).length;

  /* event row: time column right-aligned in 20..60, a 4 px bar in the calendar's tone, title/sub; past events quiet */
  const eventRow = ([from, to, title, sub, tone], day = TODAY) => {
    const past = day < TODAY || (day === TODAY && to !== null && to <= NOW);
    const time =
      from === null
        ? `<span>All day</span>`
        : `<span>${hm(from)}</span><span class="cd-event__end">${hm(to)}</span>`;
    return `<div class="cd-event ${past ? 'is-past' : ''}"><span class="cd-event__time">${time}</span><span class="cd-event__bar fv-bar--${tone}"></span><span class="fv-row__text"><span class="fv-row__title">${title}</span><span class="fv-row__sub">${sub}</span></span></div>`;
  };

  /* 1 · agenda */
  const left = DAYS[TODAY].filter(([, to]) => to > NOW).length;
  const tomorrow = DAYS[TODAY + 1];
  const agendaCard = () =>
    card(
      'light',
      F.head({
        glyph: 'calendar',
        tone: 'accent',
        title: 'Today',
        sub: 'Thursday 17 September',
        trailing: F.badge(`${left} left`, 'accent'),
      }) +
        `<div class="cd-events">${DAYS[TODAY].map((e) => eventRow(e)).join('')}</div>` +
        `<div class="cd-rows">${F.listRow({ glyph: 'calendar', title: 'Tomorrow', sub: `${tomorrow.length} events · first at ${hm(tomorrow[0][0])}`, trailing: 'chevron', tone: 'neutral' })}</div>`,
    );

  /* 2 · month grid: 7 columns of 44, today filled, one dot per day with events */
  const monthGrid = () => {
    const first = 1; // offset of 1 Sep (Tuesday) from Monday
    let cells = '';
    for (let i = 0; i < 35; i++) {
      const d = i - first + 1;
      if (d < 1 || d > 30) {
        cells += `<span class="fv-day is-outside"></span>`;
        continue;
      }
      const weekend = i % 7 >= 5;
      cells += `<span class="fv-day ${d === TODAY ? 'is-today is-selected' : ''} ${weekend ? 'is-weekend' : ''}" data-target><span>${d}</span>${count(d) ? `<i class="fv-day__dot"></i>` : ''}</span>`;
    }
    return `<div class="fv-month"><div class="fv-dow">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => `<span>${d}</span>`).join('')}</div><div class="fv-days">${cells}</div></div>`;
  };
  const monthCard = (mode = 'light') =>
    card(
      mode,
      F.head({
        glyph: 'calendar',
        tone: 'accent',
        title: 'September',
        sub: '2026 · week 38',
        trailing: `<div class="cd-nav">${F.round('chevronLeft', 'fv-round--quiet', 'Previous month')}${F.round('chevron', 'fv-round--quiet', 'Next month')}</div>`,
      }) + monthGrid(),
    );

  /* 3 · week strip: seven 44 columns, today filled, one dot per day with events, then all of the selected day's events */
  const weekDays = [14, 15, 16, 17, 18, 19, 20];
  const weekTotal = weekDays.reduce((s, d) => s + count(d), 0);
  const weekCard = () =>
    card(
      'light',
      F.head({
        glyph: 'calendar',
        tone: 'accent',
        title: 'This week',
        sub: '14 – 20 September',
        trailing: F.badge(`${weekTotal} events`, 'neutral'),
      }) +
        `<div class="fv-days cd-week">${weekDays.map((d) => `<span class="fv-day cd-wday ${d === TODAY ? 'is-today is-selected' : ''} ${d % 7 === 5 || d % 7 === 6 ? 'is-weekend' : ''}" data-target><span class="cd-wday__n">${dow(d)}</span><span class="cd-wday__d">${d}</span><span class="cd-wday__dots">${count(d) ? '<i></i>' : ''}</span></span>`).join('')}</div>` +
        `<div class="cd-events">${DAYS[TODAY].map((e) => eventRow(e)).join('')}</div>`,
    );

  /* 3b · month + day: the whole month on top, the selected day's events underneath (the week card's idiom, a month tall) */
  const monthDayCard = (mode = 'light') =>
    card(
      mode,
      F.head({
        glyph: 'calendar',
        tone: 'accent',
        title: 'September',
        sub: '2026 · week 38',
        trailing: `<div class="cd-nav">${F.round('chevronLeft', 'fv-round--quiet', 'Previous month')}${F.round('chevron', 'fv-round--quiet', 'Next month')}</div>`,
      }) +
        monthGrid() +
        F.label(`Thursday 17 · ${DAYS[TODAY].length} events`) +
        `<div class="cd-events cd-events--after-label">${DAYS[TODAY].map((e) => eventRow(e)).join('')}</div>`,
    );

  /* 4 · day timeline: 24 px per hour (08:00–23:00 = 360), true block heights (12 px minimum), pastel blocks with dark
     ink and a 4 px tone bar, the now-line unrounded on the minute */
  const timelineCard = () => {
    const PPH = 24,
      START = 8;
    const y = (h) => (h - START) * PPH;
    const hours = [8, 10, 12, 14, 16, 18, 20, 22];
    const blocks = DAYS[TODAY].map(([a, b, t, , tone]) => {
      const top = Math.round(y(a) / 4) * 4;
      const h = Math.max(12, Math.floor((y(b) - y(a)) / 4) * 4); // snap the end down, never up
      return `<span class="cd-block cd-block--${tone} ${h <= 12 ? 'cd-block--thin' : ''}" style="top:${top}px;height:${h}px"><span class="cd-block__title">${t}</span></span>`;
    }).join('');
    return card(
      'light',
      F.head({
        glyph: 'clock',
        tone: 'accent',
        title: 'Timeline',
        sub: 'Thursday 17 September',
        trailing: F.badge('Now 21:47', 'accent'),
      }) +
        `<div class="cd-timeline" style="height:${y(23) + 16}px">${hours.map((h) => `<span class="cd-hour" style="top:${y(h)}px"><span class="cd-hour__label">${String(h).padStart(2, '0')}:00</span><span class="cd-hour__line" data-measure="value"></span></span>`).join('')}${blocks}<span class="cd-now" data-measure="value" style="top:${(y(NOW) - 1).toFixed(2)}px"></span></div>`,
    );
  };

  /* 5 · upcoming: the next days' events, the date stacked and right-aligned on the time column's edge */
  const upcomingCard = () => {
    const rows = [];
    for (let d = TODAY + 1; d <= TODAY + 7; d++) for (const e of DAYS[d] || []) rows.push([d, e]);
    return card(
      'light',
      F.head({
        glyph: 'list',
        tone: 'accent',
        title: 'Upcoming',
        sub: 'Next 7 days',
        trailing: F.round('plus', 'fv-round--accent', 'Add event'),
      }) +
        `<div class="cd-upcoming">${rows.map(([d, [from, , title, sub, tone]]) => `<div class="cd-up"><span class="cd-up__date"><span class="cd-up__wd">${dow(d)}</span><span class="cd-up__d">${d}</span></span><span class="cd-event__bar fv-bar--${tone}"></span><span class="fv-row__text"><span class="fv-row__title">${title}</span><span class="fv-row__sub">${from === null ? 'All day' : hm(from)} · ${sub}</span></span></div>`).join('')}</div>`,
    );
  };

  /* 6 · tiles: a mini day tile and the next-event tile, both on the tile head anatomy */
  const next = DAYS[TODAY].find(([from]) => from > NOW);
  const tiles = () => `
<div class="fv-frame cd-tiles" data-frame data-mode="light" data-palette="linen">
  <div class="fv-grid2">
    <article class="fv-tile cd-tile" data-card><div class="fv-tile__head"><span class="cd-tile__date"><span class="cd-tile__day" data-baseline="td">17</span><span class="cd-tile__month" data-baseline="td">Sep</span></span></div><p class="fv-tile__name">Thursday</p><p class="fv-tile__state">${DAYS[TODAY].length} events · ${left} left</p><p class="fv-tile__state cd-tile__meta">Week 38</p></article>
    <article class="fv-tile cd-tile" data-card><div class="fv-tile__head">${F.ico('calendar', 'accent')}<span class="fv-tile__value">${hm(next[0])}</span></div><p class="fv-tile__name">${next[2]}</p><p class="fv-tile__state">${next[3]}</p><p class="fv-tile__state cd-tile__meta">In ${Math.round((next[0] - NOW) * 60)} min</p></article>
  </div>
</div>`;

  globalThis.renderCalendar = (root) => {
    root.innerHTML =
      agendaCard() +
      monthCard('light') +
      weekCard() +
      monthDayCard('light') +
      timelineCard() +
      upcomingCard() +
      tiles() +
      monthDayCard('dark');
  };
})();
