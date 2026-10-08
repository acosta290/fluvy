#!/usr/bin/env node
/**
 * The 3D printer card, 1.6 (issue #27), on the playground's `printer` sheet (real cards, simulated hass). Exit code 1
 * on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-printer.mjs
 * What it proves: each integration's printer is found from its device (Bambu Lab and PrusaLink by their keys, OctoPrint
 * by its ids from one entity, Moonraker at rest), never with its system buttons; the job, its progress, its time left,
 * when it is ready and how long it has run; the heaters (both figures from 3° off their target, back within 1°, the
 * layout never moving), the layers said once; the AMS's trays, the one printing marked; pause presses the printer's
 * own button, resume while paused, stop asks first in Home Assistant's dialog; the light toggles; a readout opens its
 * entity; a failed printer says why under its head; a finished one says when, never now; the stage while it prepares;
 * an offline printer; the row's 76 and its ring.
 */
import { calls, frame, moreInfo, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const card = (page, title, n = 0) => frame(page, title).locator('fluvy-printer-card').nth(n);

/** What a card says: its head, its progress, its readouts, its buttons. */
const read = (c) =>
  c.evaluate((el) => {
    const root = el.shadowRoot;
    const t = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {
      title: t(root.querySelector('.fv-card__title')),
      sub: t(root.querySelector('.fv-card__sub')),
      badge: t(root.querySelector('.fv-badge')),
      progress: t(root.querySelector('.pr-top .fv-readout')),
      left: t(root.querySelector('.pr-top__side .fv-readout')),
      note: t(root.querySelector('.pr-note')),
      trays: [...root.querySelectorAll('.pr-tray')].map(
        (tray) => `${t(tray)}${tray.classList.contains('is-active') ? '*' : ''}`,
      ),
      height: Math.round(root.querySelector('article')?.getBoundingClientRect().height ?? 0),
      glyph:
        root
          .querySelector('.fv-card__head .fv-ico, .pr-ring .fv-ico')
          ?.innerHTML.includes('M12 4') ?? false,
      headTone:
        [...(root.querySelector('.fv-card__head .fv-ico')?.classList ?? [])].find((c) =>
          c.startsWith('fv-ico--'),
        ) ?? '',
      barTone:
        [...(root.querySelector('.pr-progress')?.classList ?? [])].find((c) =>
          c.startsWith('fv-tone--'),
        ) ?? '',
      active: [...root.querySelectorAll('.pr-tray')].map(
        (t) => t.getAttribute('aria-current') ?? '',
      ),
      trayCells: [...root.querySelectorAll('.pr-tray')].map((t) =>
        Math.round(t.getBoundingClientRect().width),
      ),
      rounds: root.querySelectorAll('.pr-card--row .fv-round').length,
      bar: root.querySelector('.fv-bar')?.getAttribute('aria-valuenow') ?? null,
      meta: t(root.querySelector('.pr-meta')),
      readouts: [...root.querySelectorAll('.pr-cols .fv-readout')].map(t),
      buttons: [...root.querySelectorAll('.pr-actions .fv-action')].map((b) => ({
        key: b.dataset.action,
        primary: b.classList.contains('fv-action--accent'),
        on: b.classList.contains('is-on'),
      })),
      picture: root.querySelector('.pr-plate')?.className ?? null,
      offline: root.querySelector('article')?.classList.contains('is-unavailable') ?? false,
      row: t(root.querySelector('.pr-card--row .fv-row__sub')),
      ring: root.querySelector('.pr-ring__fill')?.getAttribute('stroke-dashoffset') ?? null,
    };
  });

const page = await suite.sheet('printer');
await page.evaluate(() => {
  window.__handed = [];
  document.body.addEventListener('hass-action', (event) => window.__handed.push(event.detail));
});

/* ---------- Bambu Lab, printing ---------- */
const p1s = card(page, 'Bambu Lab · printing');
const bambu = await read(p1s);
check(
  'Bambu Lab: found from its device by its keys — the job, 62 %, 1 h 12 min left, ready at its end time, 1 h 35 min so far (the layer is its readout’s, said once)',
  bambu.title === 'P1S' &&
    bambu.sub === 'Benchy' &&
    /^Progress 62 ?%$/.test(bambu.progress) &&
    /^Left 1 h 12 ?min$/.test(bambu.left) &&
    bambu.bar === '62' &&
    /^Ready at \d{1,2}:\d{2} · 1 h 35 min so far$/.test(bambu.meta),
  JSON.stringify(bambu),
);
check(
  'Bambu Lab: its AMS’s four trays, on a device of their own — the one printing marked, the empty one said so',
  bambu.trays.join('|') === 'PLA*|PETG|PLA|Empty',
  JSON.stringify(bambu.trays),
);
check(
  'Bambu Lab: the heaters at their targets read alone, the chamber, the layers; its camera above',
  bambu.readouts.join('|') === 'Nozzle 220°C|Bed 60°C|Chamber 32°C|Layer 112 / 240' &&
    bambu.picture !== null &&
    !bambu.picture.includes('is-preview'),
  JSON.stringify(bambu.readouts),
);
check(
  'Bambu Lab: pause (the primary), stop, and its chamber light, lit',
  JSON.stringify(bambu.buttons) ===
    JSON.stringify([
      { key: 'pause', primary: true, on: false },
      { key: 'stop', primary: false, on: false },
      { key: 'light', primary: false, on: true },
    ]),
  JSON.stringify(bambu.buttons),
);
await reset(page);
await p1s.locator('[data-action="pause"]').click();
await settle(page, 200);
let done = await calls(page);
check(
  'pause presses the printer’s own button',
  done.length === 1 &&
    done[0].s === 'button.press' &&
    done[0].d.entity_id === 'button.p1s_pause_printing',
  JSON.stringify(done),
);
await reset(page);
await p1s.locator('[data-action="stop"]').click();
await settle(page, 200);
const handed = await page.evaluate(() => window.__handed.splice(0));
done = await calls(page);
check(
  'stop asks first: it goes to Home Assistant’s own dialog, nothing is pressed yet',
  done.length === 0 &&
    handed.length === 1 &&
    handed[0]?.config?.tap_action?.confirmation !== undefined &&
    JSON.stringify(handed[0].config.tap_action).includes('button.p1s_stop_printing'),
  JSON.stringify(handed),
);
await reset(page);
await p1s.locator('[data-action="light"]').click();
await settle(page, 200);
done = await calls(page);
check(
  'the light toggles',
  done.length === 1 &&
    done[0].s === 'light.toggle' &&
    done[0].d.entity_id === 'light.p1s_chamber_light',
  JSON.stringify(done),
);

await reset(page);
await p1s.locator('.pr-stat').first().click();
await settle(page, 200);
check(
  'a readout opens its entity (the nozzle’s)',
  (await moreInfo(page)).at(-1) === 'sensor.p1s_nozzle_temperature',
  JSON.stringify(await moreInfo(page)),
);

/* ---------- PrusaLink, paused ---------- */
const mk4 = card(page, 'PrusaLink · paused');
const prusa = await read(mk4);
check(
  'PrusaLink: paused — the warning badge, the time left from its finish time, a heater on its way says both, the job’s preview',
  prusa.badge === 'Paused' &&
    /^Left 2 h 06 ?min$/.test(prusa.left) &&
    prusa.readouts.includes('Bed 52 / 60°C') &&
    prusa.readouts.includes('Nozzle 170°C') &&
    prusa.picture?.includes('is-preview'),
  JSON.stringify(prusa),
);
check(
  'paused: resume is the primary, stop beside it',
  prusa.buttons.map((b) => `${b.key}${b.primary ? '*' : ''}`).join() === 'resume*,stop',
  JSON.stringify(prusa.buttons),
);
await reset(page);
await mk4.locator('[data-action="resume"]').click();
await settle(page, 200);
done = await calls(page);
check(
  'resume presses the printer’s resume button',
  done.length === 1 && done[0].d.entity_id === 'button.mk4_resume_job',
  JSON.stringify(done),
);

/* ---------- OctoPrint, from one entity ---------- */
const ender = await read(card(page, 'OctoPrint · printing, by its ids'));
check(
  'OctoPrint: from one entity, its device’s sensors known by their ids — never its system buttons',
  ender.title === 'Ender 3' &&
    ender.sub === 'bracket_v2' &&
    /^Progress 18 ?%$/.test(ender.progress) &&
    ender.readouts.join('|') === 'Nozzle 205°C|Bed 60°C' &&
    ender.buttons.map((b) => b.key).join() === 'pause,stop',
  JSON.stringify(ender),
);

/* ---------- Moonraker at rest, a failed printer, an offline one ---------- */
const voron = await read(card(page, 'Moonraker · at rest'));
check(
  'Moonraker at rest: no progress, no buttons (nothing to pause), its heaters cold — never its emergency stop',
  voron.progress === '' &&
    voron.bar === null &&
    voron.buttons.length === 0 &&
    voron.readouts.join('|') === 'Nozzle 27°C|Bed 26°C',
  JSON.stringify(voron),
);
const failed = await read(card(page, 'Failed · and offline', 0));
const gone = await read(card(page, 'Failed · and offline', 1));
check(
  'a failed print: its state, the warning’s glyph, its job and where its bar stopped, and why under its head; an offline printer wears the unavailable skin with nothing to read, its state said',
  /Failed/.test(`${failed.badge} ${failed.sub}`) &&
    failed.glyph &&
    /Hook/.test(failed.sub) &&
    failed.bar === '7' &&
    failed.note === 'Filament ran out. Load new filament and resume.' &&
    failed.buttons.length === 0 &&
    gone.offline &&
    /Unavailable/.test(`${gone.badge} ${gone.sub}`) &&
    gone.readouts.length === 0,
  JSON.stringify({ failed, gone }),
);

/* ---------- heating up, finished ---------- */
const x1c = card(page, 'Heating up · a long name');
const heating = await read(x1c);
check(
  'preparing: the stage it is at, the heaters both their figures on their way, the time left',
  /Heatbed preheating/.test(heating.sub) &&
    heating.readouts.includes('Nozzle 142 / 220°C') &&
    heating.readouts.includes('Bed 45 / 60°C') &&
    /^Left 3 h 04 ?min$/.test(heating.left),
  JSON.stringify(heating),
);
const drift = async (value) => {
  await page.evaluate((v) => window.fluvyMock.set('sensor.x1c_nozzle_temperature', v), value);
  await settle(page, 150);
  return read(x1c);
};
const near = await drift('219');
const back = await drift('218');
const off = await drift('216');
check(
  'a heater reaches its target: 1° off reads alone, 2° off stays alone (no flicker), 4° off says both again — and the card never moves',
  near.readouts.includes('Nozzle 219°C') &&
    back.readouts.includes('Nozzle 218°C') &&
    off.readouts.includes('Nozzle 216 / 220°C') &&
    new Set([heating.height, near.height, back.height, off.height]).size === 1,
  JSON.stringify([near.readouts, back.readouts, off.readouts, heating.height, off.height]),
);
const mini = await read(card(page, 'Finished · its filament by name'));
check(
  'finished: when it finished, from its finish time — never now — the full bar, its filament by name',
  /^Finished at 21:17$/.test(mini.meta) &&
    mini.bar === '100' &&
    mini.readouts.includes('Filament PETG'),
  JSON.stringify(mini),
);

/* ---------- a colour of its own, other days, its own words, half a column ---------- */
const teal = await read(card(page, 'A colour of its own · failed and paused', 0));
const tealPaused = await read(card(page, 'A colour of its own · failed and paused', 1));
check(
  'a card’s own colour is the accent’s, never a status’s: failed and paused keep the warning (circle and bar)',
  teal.headTone === 'fv-ico--warning' &&
    tealPaused.headTone === 'fv-ico--warning' &&
    tealPaused.barTone === 'fv-tone--warning',
  JSON.stringify({ teal, tealPaused }),
);
const lastNight = await read(card(page, 'Days · by the calendar, not the hours', 0));
const twoMornings = await read(card(page, 'Days · by the calendar, not the hours', 1));
check(
  'the days are the calendar’s, not the hours’: 23 h after last night’s job is yesterday, 35 h after it two days ago',
  /Finished yesterday/.test(lastNight.meta) && /Finished 2 days ago/.test(twoMornings.meta),
  JSON.stringify([lastNight.meta, twoMornings.meta]),
);
const houseDay = await read(card(page, 'Days · on the house’s calendar', 0));
check(
  'the days are the house’s: a job finished the same Auckland morning is "Finished at", though the browser’s day turned',
  /Finished at \d/.test(houseDay.meta) && !/yesterday/.test(houseDay.meta),
  houseDay.meta,
);
const before = await read(card(page, 'Days · finished before, ready tomorrow', 0));
const tomorrow = await read(card(page, 'Days · finished before, ready tomorrow', 1));
check(
  'another day: a job finished two days before says so by the calendar; one ready after midnight says its weekday',
  /Finished 2 days ago/.test(before.meta) && /Ready Fri at 0?2:34/.test(tomorrow.meta),
  JSON.stringify([before.meta, tomorrow.meta]),
);
check(
  'the tray printing is marked for a reader too (aria-current), the others are not',
  bambu.active.join('|') === 'true|||',
  JSON.stringify(bambu.active),
);
const own = await read(card(page, 'Its own words · a row without buttons', 0));
const quiet = await read(card(page, 'Its own words · a row without buttons', 1));
check(
  'an extra readout says its own words, not the printer’s name again; a row without its buttons has no round',
  own.readouts.includes('Aux fan 40%') && quiet.rounds === 0,
  JSON.stringify({ readouts: own.readouts, rounds: quiet.rounds }),
);
const narrow = await read(card(page, 'Half a column · trays and readouts'));
check(
  'half a column: each heater alone, the layer as "112" with "/ 240" for its unit, swatches at 44 at least',
  narrow.readouts.includes('Nozzle 220°C') &&
    narrow.readouts.some((r) => /^Layer 112 ?\/ ?240$/.test(r)) &&
    narrow.trayCells.length === 4 &&
    narrow.trayCells.every((w) => w >= 44),
  JSON.stringify({ readouts: narrow.readouts, trays: narrow.trayCells }),
);

/* ---------- compact and the row ---------- */
const compact = await read(card(page, 'Compact'));
check(
  'compact: the bar and one line under it (progress, time left, when it is ready), no picture, no buttons',
  compact.bar === '62' &&
    /^62 % · 1 h 12 min left · Ready at \d{1,2}:\d{2}( · .+)?$/.test(compact.meta) &&
    compact.picture === null &&
    compact.buttons.length === 0,
  JSON.stringify(compact),
);
const row = await read(card(page, 'Rows', 0));
const restRow = await read(card(page, 'Rows', 2));
check(
  'the row: 76 tall, the ring round the printer follows the job, its line says what it does; at rest no ring',
  row.height === 76 &&
    /^Running · 62 %( · 1 h 12 min left)?$/.test(row.row) &&
    row.ring !== null &&
    restRow.ring === null &&
    restRow.row === 'Standby',
  JSON.stringify({ row, restRow }),
);
await reset(page);
await card(page, 'Rows', 1).locator('.pr-card--row .fv-round').click();
await settle(page, 200);
done = await calls(page);
check(
  'the row’s round resumes a paused printer',
  done.length === 1 && done[0].d.entity_id === 'button.mk4_resume_job',
  JSON.stringify(done),
);

await page.close();

/* ---------- narrow and wide: the row's order, two readouts a row, the cells on whole pixels ---------- */
{
  const cut = [];
  for (const lang of ['en', 'de', 'fr', 'tr']) {
    for (const width of [168, 200]) {
      const p = await suite.sheet('printer', { width, lang });
      const rows = await p.locator('fluvy-printer-card').evaluateAll((els) =>
        els
          .map((el) => el.shadowRoot.querySelector('.pr-card--row .fv-row__sub'))
          .filter(Boolean)
          .filter((sub) => sub.scrollWidth > sub.clientWidth + 1)
          .map((sub) => sub.textContent.trim()),
      );
      for (const r of rows) cut.push(`${lang} ${width} "${r}"`);
      await p.close();
    }
  }
  check(
    'a printer row at half a column (168, 200) never cuts its state: the percentage, then the round, give way first',
    cut.length === 0,
    cut.join(' · '),
  );
  const long = await suite.sheet('printer');
  const bare = await card(long, 'Row · a long state word', 0).evaluate((el) => {
    const row = el.shadowRoot.querySelector('.pr-card--row');
    const sub = row?.querySelector('.fv-row__sub');
    return {
      bare: row?.classList.contains('is-bare') ?? false,
      button: row?.getAttribute('role') ?? '',
      sub: sub?.textContent.trim() ?? '',
      cut: sub ? sub.scrollWidth > sub.clientWidth + 1 : true,
    };
  });
  check(
    'a state too long beside the circle: the circle gives way and the row is the button, the state whole',
    bare.bare && bare.button === 'button' && !bare.cut && bare.sub.startsWith('Fehlgeschlagen'),
    JSON.stringify(bare),
  );
  await long.close();
  const phone = await suite.sheet('printer', { width: 264 });
  const cols = await card(phone, 'Bambu Lab · printing', 0).evaluate(
    (el) => el.shadowRoot.querySelector('.pr-cols')?.style.getPropertyValue('--pr-cols') ?? '',
  );
  check(
    'a phone’s card (264) lays the readouts two a row, chosen by measure',
    cols.trim() === '2',
    cols,
  );
  await phone.close();
  const wide = await suite.sheet('printer', { width: 1400 });
  const cells = await card(wide, 'Bambu Lab · printing', 0).evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('.pr-trays > *, .pr-actions > *')].map(
      (c) => c.getBoundingClientRect().width,
    ),
  );
  check(
    'at 1400 the trays and the buttons sit on whole pixels, one gap of 8 to 16 between them',
    cells.length > 0 && cells.every((w) => Math.abs(w - Math.round(w)) < 0.02),
    JSON.stringify(cells),
  );
  await wide.close();
}

await suite.finish();
