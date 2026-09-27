/* Inputs & utilities: number/select/text, buttons & scripts, updates, to-do, calendar, timer & counter, date/time.
   Copy rule: subs carry context or time, never entity domains; one x for every title (icon column 44 + 12). */
(() => {
  'use strict';
  const F = globalThis.FLUVY;
  const { G } = F;
  const card = (mode, body, cls = '') =>
    `<article class="fv-frame fv-card in-card ${cls}" data-frame data-mode="${mode}" data-palette="linen" data-card>${body}</article>`;
  const field = (title, sub, control = '', top = false) =>
    `<div class="in-field ${top ? 'in-field--top' : ''}"><div class="in-field__text"><span class="fv-row__title">${title}</span>${sub ? `<span class="fv-row__sub">${sub}</span>` : ''}</div>${control}</div>`;

  const inputsCard = () =>
    card(
      'light',
      F.head({
        glyph: 'sliders',
        tone: 'accent',
        title: 'Helpers',
        sub: 'Living room · 4 inputs',
        trailing: F.round('dots', 'fv-round--quiet', 'More'),
      }) +
        field(
          'Target brightness',
          'Living room lights',
          `<div class="in-field__control"><span class="in-field__value"><span data-baseline="n">65</span><span class="fv-unit" data-baseline="n">%</span></span>${F.stepper()}</div>`,
        ) +
        F.ruler({ w: 320, h: 44, value: 0.65, tone: 'accent' }) +
        field('House mode', '', '', true) +
        F.chips([
          { label: 'Home', active: true },
          { label: 'Away' },
          { label: 'Night' },
          { label: 'Guests' },
        ]) +
        field('Welcome message', 'Shown on arrival', '', true) +
        `<div class="fv-field in-text" data-control><span class="fv-field__input">Welcome home, Marta</span>${G.text}</div>` +
        `<div class="in-rows">${F.listRow({ glyph: 'moon', title: 'Guest mode', sub: 'Since Monday', trailing: 'switch', on: false, tone: 'neutral' })}</div>`,
    );

  /* actions run on tap: a bare 20 glyph in the 44 icon column (no circle on a page-filled surface), title at 76, a play affordance at the right */
  const actionsCard = () =>
    card(
      'light',
      F.head({
        glyph: 'bolt',
        tone: 'accent',
        title: 'Actions',
        sub: 'Buttons & scripts',
        trailing: F.round('dots', 'fv-round--quiet', 'More'),
      }) +
        `<div class="in-actions">${[
          ['sun', 'Good morning', 'Lights & blinds · ran 07:00'],
          ['moon', 'Good night', 'Lights & lock · ran 23:10'],
          ['ha', 'Restart HA', 'Core & add-ons · 3 days ago'],
          ['script', 'Backup now', 'Full backup · ran 03:00'],
        ]
          .map(
            ([g, n, m]) =>
              `<button class="in-action" data-card data-target><span class="in-action__glyph">${G[g]}</span><span class="fv-row__text"><span class="fv-row__title">${n}</span><span class="fv-row__sub">${m}</span></span><span class="in-action__go">${G.play}</span></button>`,
          )
          .join('')}</div>`,
    );

  const updatesCard = () =>
    card(
      'light',
      F.head({
        glyph: 'update',
        tone: 'accent',
        title: 'Updates',
        sub: 'Checked 21:30',
        trailing: F.badge('3 available', 'accent'),
      }) +
        `<div class="in-rows">
      <div class="fv-row in-row--progress">${F.ico('ha', 'accent')}<span class="fv-row__text"><span class="fv-row__title">Home Assistant Core</span><span class="fv-row__sub">2026.9.2 → 2026.10.0 · installing 62 %</span><span class="in-progress"><span class="in-progress__fill" data-measure="value" style="width:62%"></span></span></span></div>
      ${F.listRow({ glyph: 'plug', title: 'Sonoff plug firmware', sub: '1.4.2 → 1.4.3', trailing: 'html', html: F.button('Install', 'link'), tone: 'neutral' })}
      ${F.listRow({ glyph: 'vacuum', title: 'Vacuum', sub: '3.5.8 → 3.6.0', trailing: 'html', html: F.button('Install', 'link'), tone: 'neutral' })}
    </div>` +
        `<div class="in-rows">${F.listRow({ glyph: 'clock', title: 'Auto-update at night', sub: '03:00 · backup first', trailing: 'switch', on: true, tone: 'accent' })}</div>`,
    );

  /* to-do: the check ring sits centred in the 44 icon column; labels share the 76 title column */
  const todoCard = () =>
    card(
      'light',
      F.head({
        glyph: 'list',
        tone: 'accent',
        title: 'Groceries',
        sub: '3 of 5 left',
        trailing: F.round('plus', 'fv-round--accent', 'Add'),
      }) +
        `<div class="in-todo">${[
          ['Oat milk', false],
          ['Coffee beans · 1 kg', false],
          ['Lemons', false],
          ['Dish tabs', true],
          ['Bread', true],
        ]
          .map(
            ([t, done]) =>
              `<div class="in-todo__row ${done ? 'is-done' : ''}"><span class="in-check-hit" data-target><span class="in-check ${done ? 'is-on' : ''}" data-control>${done ? G.check : ''}</span></span><span class="in-todo__text">${t}</span></div>`,
          )
          .join('')}</div>`,
    );

  /* calendar: time right-aligned in 20..60, bar 64..68, title at 76 */
  const calendarCard = () =>
    card(
      'light',
      F.head({
        glyph: 'calendar',
        tone: 'accent',
        title: 'Today',
        sub: 'Thursday 17 September',
        trailing: F.badge('3 events', 'neutral'),
      }) +
        `<div class="in-events">${[
          ['09:30', 'Dentist', 'Ona · 45 min', 'water'],
          ['13:00', 'Lunch with Pau', 'Casa Lola', 'heat'],
          ['18:30', 'Yoga', 'Online · 1 h', 'media'],
        ]
          .map(
            ([t, n, m, tone]) =>
              `<div class="in-event"><span class="in-event__time">${t}</span><span class="in-event__bar in-event__bar--${tone}"></span><span class="fv-row__text"><span class="fv-row__title">${n}</span><span class="fv-row__sub">${m}</span></span></div>`,
          )
          .join('')}</div>` +
        `<div class="in-rows">${F.listRow({ glyph: 'calendar', title: 'Tomorrow', sub: '2 events · first at 08:15', trailing: 'chevron', tone: 'neutral' })}</div>`,
    );

  const timerFrame = () => `
<div class="fv-frame in-stack" data-frame data-mode="light" data-palette="linen">
  <article class="fv-card" data-card>
    ${F.head({ glyph: 'timer', tone: 'accent', title: 'Kitchen timer', sub: 'Ends 22:05', trailing: F.badge('Running', 'accent') })}
    <div class="in-timer fv-value-row">${F.readout({ label: 'Remaining', value: '12:34', size: 'l', group: 'tm' })}<div class="in-timer__cmds">${F.round('pause', 'fv-round--accent', 'Pause')}${F.round('stop', 'fv-round--quiet', 'Cancel')}</div></div>
    ${F.label('Elapsed')}
    <div class="in-gauge">${F.ruler({ w: 320, h: 44, value: 0.42, tone: 'accent', marker: true })}</div>
  </article>
  <article class="fv-card in-compact" data-card>
    ${F.ico('counter', 'accent')}
    <div class="fv-row__text"><span class="fv-row__title">Coffee counter</span><span class="fv-row__sub">Resets at 00:00</span></div>
    <span class="in-compact__value"><span data-baseline="ct">3</span></span>
    ${F.stepper()}
  </article>
</div>`;

  /* editable values wear the link-button shape; read-only state ("Up") stays plain */
  const dateCard = () =>
    card(
      'light',
      F.head({
        glyph: 'clock',
        tone: 'accent',
        title: 'Schedules',
        sub: 'Date & time helpers',
        trailing: F.round('dots', 'fv-round--quiet', 'More'),
      }) +
        `<div class="in-rows">
      ${F.listRow({ glyph: 'clock', title: 'Wake-up', sub: 'Weekdays', trailing: 'html', html: F.button('06:45', 'link'), tone: 'neutral' })}
      <div class="in-quick">${F.chips([{ label: '06:15' }, { label: '06:45', active: true }, { label: '07:15' }])}</div>
      ${F.listRow({ glyph: 'calendar', title: 'Holiday start', sub: 'In 16 days', trailing: 'html', html: F.button('3 Oct', 'link'), tone: 'neutral' })}
      ${F.listRow({ glyph: 'sun', title: 'Sun', sub: 'Sets at 20:12 · rises 07:48', trailing: 'value', value: 'Up', tone: 'solar' })}
    </div>`,
    );

  globalThis.renderInputs = (root) => {
    root.innerHTML =
      inputsCard() +
      actionsCard() +
      updatesCard() +
      todoCard() +
      calendarCard() +
      timerFrame() +
      dateCard();
  };
})();
