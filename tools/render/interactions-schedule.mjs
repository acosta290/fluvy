#!/usr/bin/env node
/**
 * Interaction tests for the Heating schedule card (#229) and its sheet, on the playground's simulated hass and its
 * in-memory Home Assistant (the helpers' collection, the registry, the automations' config API). Exit code 1 on any
 * failure.
 *   PLAYGROUND=http://127.0.0.1:5318/ node interactions-schedule.mjs
 * What it proves: the bedroom's week draws as the issue drew it and holds its declared height; a tap on Monday's line
 * opens the sheet on Monday; a time added lands in the day's first room from the morning; Monday copied to Tuesday–
 * Friday says so; Comfort half a degree warmer; Save writes the helper (`schedule/update`, every day, its name and icon
 * kept) and the automation (one POST, the shape Fluvy reads back) exactly as expected, closes the sheet and runs the
 * automation once so the time it is now takes effect; Cancel writes nothing; two times that overlap are refused in
 * words and Save stays disabled; the switch turns the automation off, and on again with a run; a guest's sheet reads
 * the week and writes nothing; "Create a schedule" makes a helper named after the room and its automation, and the
 * card then draws the new week; Escape closes the sheet and the focus returns to the card; no interval is left behind.
 * The row: 76 as it declares, its line the preset in force, its target and the next change (or why it cannot say
 * them), its switch acting alone, a tap opening the sheet on today, a guest's saying no change into a preset it
 * cannot know and opening the plan to read.
 */
import { apiCalls, calls, frame, PAGE_INTERVALS, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** The WebSocket messages the cards sent of one type, since the last reset. */
const ws = (page, type) =>
  page.evaluate(
    (asked) => window.fluvyMock.wsCalls.filter((c) => c.type === asked).map((c) => c.message),
    type,
  );

const helper = (from, to, preset = 'comfort') => ({ from, to, data: { preset } });
const WORKDAY = [helper('06:00:00', '08:00:00'), helper('17:00:00', '22:00:00')];
const WEEKEND = [helper('08:00:00', '22:00:00')];
/** Monday with a time added (two hours from 08:00, the first room from the morning, in Comfort), copied to Friday. */
const MONDAY = [WORKDAY[0], helper('08:00:00', '10:00:00'), WORKDAY[1]];
const EXPECTED_HELPER = {
  type: 'schedule/update',
  schedule_id: 'bedroom_heating',
  name: 'Bedroom heating',
  icon: 'mdi:calendar-clock',
  monday: MONDAY,
  tuesday: MONDAY,
  wednesday: MONDAY,
  thursday: MONDAY,
  friday: MONDAY,
  saturday: WEEKEND,
  sunday: WEEKEND,
};

const SCHEDULE = 'schedule.bedroom_heating';
const CLIMATE = 'climate.bedroom_radiator';
const branch = (alias, key, temperature) => ({
  alias,
  conditions: [{ condition: 'state', entity_id: SCHEDULE, attribute: 'preset', state: key }],
  sequence: [
    { action: 'climate.set_temperature', target: { entity_id: CLIMATE }, data: { temperature } },
  ],
});
/** The bedroom's automation with Comfort at 21.5: its alias and description kept, the rest as Fluvy builds it. */
const EXPECTED_AUTOMATION = {
  id: 'fluvy_b3d7a0c1e2f4',
  alias: 'Heating schedule · Bedroom',
  description:
    'Written by Fluvy’s Heating schedule card: it sets Bedroom radiator by the times of Bedroom heating. Change it in the card: edited here, the card shows it but no longer changes it.',
  triggers: [
    { trigger: 'state', entity_id: SCHEDULE },
    { trigger: 'homeassistant', event: 'start' },
  ],
  conditions: [{ condition: 'state', entity_id: SCHEDULE, state: ['on', 'off'] }],
  actions: [
    {
      choose: [
        branch('Eco', 'eco', 18),
        branch('Comfort', 'comfort', 21.5),
        branch('Away', 'away', 16),
      ],
      default: [
        {
          alias: 'Eco',
          action: 'climate.set_temperature',
          target: { entity_id: CLIMATE },
          data: { temperature: 18 },
        },
      ],
    },
  ],
  mode: 'restart',
};

/** JSON with every object's keys in order: what Home Assistant receives, whatever order it was typed in. */
const canonical = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );

/* ---------- the week, the sheet, a save ---------- */
{
  const page = await suite.sheet('schedule', { width: 412 });
  const card = frame(page, 'Bedroom heating plan').locator('fluvy-schedule-card');
  const sheet = card.locator('fluvy-heating-sheet');
  const dialog = sheet.locator('dialog');

  const seen = await card.evaluate((el) => {
    const root = el.shadowRoot;
    return {
      days: [...root.querySelectorAll('.sc-day')].map((d) => d.textContent.trim()),
      blocks: root.querySelectorAll('.sc-block').length,
      legend: [...root.querySelectorAll('.sc-item')].map((i) =>
        i.textContent.replace(/\s+/g, ' ').trim(),
      ),
      sub: root.querySelector('.fv-card__sub')?.textContent.trim(),
      height: Math.round(root.querySelector('[data-card]').getBoundingClientRect().height),
      declared: el.constructor.layoutHeight(el.config),
    };
  });
  check(
    'the bedroom’s week: seven lines, twelve times, the presets with their temperatures',
    seen.days.length === 7 &&
      seen.blocks === 12 &&
      seen.legend.join('|') === 'Eco 18°|Comfort 21°|Away 16°',
    JSON.stringify(seen),
  );
  check(
    'the head says what the thermostat does and the preset in force',
    /^Heating · Comfort 21°/.test(seen.sub),
    seen.sub,
  );
  check(
    'the card is as tall as it declares',
    seen.height === seen.declared,
    `${seen.height} vs ${seen.declared}`,
  );

  // a tap on Monday's line opens the sheet on Monday
  const monday = card.locator('.sc-track').nth(seen.days.indexOf('Mon'));
  await monday.click();
  await settle(page, 500);
  const pressed = await dialog
    .locator('.hs-days')
    .first()
    .locator('.is-active')
    .getAttribute('aria-label');
  check(
    'a tap on Monday’s line opens the sheet on Monday',
    (await dialog.isVisible()) && pressed === 'Monday',
    pressed,
  );

  // Cancel writes nothing
  await reset(page);
  await dialog.locator('.dv-actions .fv-btn--quiet').click();
  await settle(page, 400);
  check(
    'Cancel closes the sheet and writes nothing',
    !(await dialog.isVisible()) &&
      (await ws(page, 'schedule/update')).length === 0 &&
      (await apiCalls(page)).length === 0,
  );

  await monday.click();
  await settle(page, 500);
  // a time added: two hours from 08:00, the day's first room from the morning
  await dialog.getByRole('button', { name: 'Add a time' }).click();
  await settle(page, 200);
  const times = await dialog.locator('.hs-block').count();
  check('a time added to Monday', times === 3, String(times));

  // two times that overlap are refused in words, and Save waits
  const save = dialog.locator('.dv-actions .fv-btn--accent');
  const until = dialog.locator('.hs-block').nth(1).locator('fluvy-time-field').nth(1);
  await until.evaluate((field) =>
    field.dispatchEvent(
      new CustomEvent('fluvy-time', { detail: { value: 18 * 60 }, bubbles: true, composed: true }),
    ),
  );
  await settle(page, 200);
  const error = (await dialog.locator('.hs-error').textContent())?.trim();
  check(
    'two times that overlap are refused in words, and Save waits',
    error === '08:00–18:00 overlaps 17:00–22:00' && (await save.isDisabled()),
    error,
  );
  await until.evaluate((field) =>
    field.dispatchEvent(
      new CustomEvent('fluvy-time', { detail: { value: 10 * 60 }, bubbles: true, composed: true }),
    ),
  );
  await settle(page, 200);

  // Monday copied to Tuesday–Friday
  const copy = dialog.locator('.hs-copy-section');
  for (const day of ['Tuesday', 'Wednesday', 'Thursday', 'Friday'])
    await copy.locator(`.fv-chip[aria-label="${day}"]`).click();
  await copy.getByRole('button', { name: 'Copy', exact: true }).click();
  await settle(page, 200);
  const copied = (await copy.locator('.hs-note').textContent())?.trim();
  check('Monday copied to Tuesday–Friday, and said so', copied === 'Copied to Tue–Fri', copied);

  // Comfort half a degree warmer
  const comfort = dialog.locator('.hs-preset', { hasText: 'Comfort' });
  await comfort.locator('.fv-stepper__half').nth(1).click();
  await settle(page, 200);
  check(
    'Comfort half a degree warmer',
    (await comfort.locator('.fv-row__sub').textContent())?.includes('21.5'),
  );

  await reset(page);
  await save.click();
  await settle(page, 900);
  const [update] = await ws(page, 'schedule/update');
  check(
    'Save writes the helper: every day, its name and icon kept, Monday on Tuesday–Friday',
    canonical(update) === canonical(EXPECTED_HELPER),
    JSON.stringify(update),
  );
  const posts = (await apiCalls(page)).filter((c) => c.method === 'POST');
  check(
    '…and the automation, once, in the shape Fluvy reads back',
    posts.length === 1 &&
      posts[0].path === 'config/automation/config/fluvy_b3d7a0c1e2f4' &&
      canonical(posts[0].body) === canonical(EXPECTED_AUTOMATION),
    JSON.stringify(posts),
  );
  check('…and closes the sheet', !(await dialog.isVisible()));
  const runs = (await calls(page)).filter((c) => c.s === 'automation.trigger');
  check(
    '…and runs the automation once, so the time it is now takes effect',
    runs.length === 1 &&
      runs[0].t.entity_id === 'automation.heating_schedule_bedroom' &&
      runs[0].d.skip_condition === false,
    JSON.stringify(runs),
  );
  const after = await card.evaluate((el) => el.shadowRoot.querySelectorAll('.sc-block').length);
  check('the card draws the week as it was written', after === 17, String(after));

  // the switch: off, then on again with a run
  await reset(page);
  await card.locator('.fv-card__head .fv-hit').click();
  await settle(page, 300);
  let c = await calls(page);
  check(
    'the switch turns the schedule’s automation off',
    c.length === 1 && c[0].s === 'automation.turn_off',
    JSON.stringify(c),
  );
  await reset(page);
  await card.locator('.fv-card__head .fv-hit').click();
  await settle(page, 300);
  c = await calls(page);
  check(
    '…and on again, running it once',
    c.map((each) => each.s).join() === 'automation.turn_on,automation.trigger',
    JSON.stringify(c),
  );

  // Escape closes the sheet, the focus back on the card
  await card.locator('.fv-card__title').click();
  await settle(page, 400);
  await page.keyboard.press('Escape');
  await settle(page, 400);
  const focus = await card.evaluate((el) => el.shadowRoot.activeElement?.className ?? '');
  check(
    'Escape closes the sheet and the focus returns to the card',
    !(await dialog.isVisible()) && focus.includes('fv-card__tap'),
    focus,
  );

  await page.close();
}

/* ---------- a guest reads; a new plan is made ---------- */
{
  const page = await suite.sheet('schedule', { width: 412 });
  const guest = frame(page, 'Guest').locator('fluvy-schedule-card');
  await guest.locator('.fv-card__title').click();
  await settle(page, 500);
  const dialog = guest.locator('fluvy-heating-sheet dialog');
  const read = await dialog.evaluate((el) => ({
    note: el.querySelector('.hs-note')?.textContent.trim(),
    fields: el.querySelectorAll('fluvy-time-field').length,
    save: el.querySelectorAll('.fv-btn--accent').length,
  }));
  check(
    'a guest’s sheet reads the week and offers nothing to write',
    read.note === 'Only an administrator can change the schedule' &&
      read.fields === 0 &&
      read.save === 0,
    JSON.stringify(read),
  );
  await page.keyboard.press('Escape');
  await settle(page, 300);
  const asked = await page.evaluate(() => window.__guestApi ?? []);
  check('a guest reads no automation’s config', asked.length === 0, JSON.stringify(asked));

  const kids = frame(page, 'No schedule yet').locator('fluvy-schedule-card');
  await reset(page);
  await kids.getByRole('button', { name: 'Create a schedule' }).click();
  await settle(page, 500);
  const sheet = kids.locator('fluvy-heating-sheet dialog');
  check(
    '“Create a schedule” opens a new plan',
    (await sheet.locator('.fv-sheet__title').textContent())?.trim() === 'New heating schedule',
  );
  await sheet.locator('.dv-actions .fv-btn--accent').click();
  await settle(page, 1200);
  const [create] = await ws(page, 'schedule/create');
  check(
    'Save makes a helper named after the room, the start week in it',
    create?.name === 'Kids’ room heating' &&
      create.icon === 'mdi:calendar-clock' &&
      canonical(create.monday) ===
        canonical([helper('06:30:00', '08:30:00'), helper('17:00:00', '22:30:00')]) &&
      canonical(create.sunday) === canonical([helper('08:00:00', '23:00:00')]),
    JSON.stringify(create),
  );
  const post = (await apiCalls(page)).find((c) => c.method === 'POST');
  check(
    '…and its automation under a new Fluvy id, on the helper Home Assistant made',
    /^config\/automation\/config\/fluvy_[0-9a-f]{12}$/.test(post?.path ?? '') &&
      post.body.alias === 'Heating schedule · Kids’ room' &&
      post.body.triggers[0].entity_id === 'schedule.kids_room_heating' &&
      post.body.actions[0].choose.map((b) => b.alias).join() === 'Comfort,Eco,Away',
    JSON.stringify(post),
  );
  await settle(page, 800);
  const drawn = await kids.evaluate((el) => ({
    blocks: el.shadowRoot.querySelectorAll('.sc-block').length,
    empty: Boolean(el.shadowRoot.querySelector('.sc-empty')),
    switch: Boolean(el.shadowRoot.querySelector('.fv-switch')),
  }));
  check(
    'the card then draws the new week, with its switch',
    drawn.blocks === 12 && !drawn.empty && drawn.switch,
    JSON.stringify(drawn),
  );

  const intervals = await page.evaluate(() => window.__intervals());
  check('the cards leave no interval behind', intervals <= PAGE_INTERVALS, String(intervals));
  await page.close();
}

/* ---------- the row ---------- */
{
  const page = await suite.sheet('schedule', { width: 1400 });
  const rows = frame(page, 'Row · half').locator('fluvy-schedule-card');
  const seen = await rows.evaluateAll((cards) =>
    cards.map((el) => {
      const root = el.shadowRoot;
      return {
        title: root.querySelector('.fv-row__title')?.textContent.trim(),
        line: root.querySelector('.fv-row__sub')?.textContent.trim(),
        height: Math.round(root.querySelector('[data-card]').getBoundingClientRect().height),
        declared: el.constructor.layoutHeight(el.config),
        switch: Boolean(root.querySelector('.fv-switch')),
      };
    }),
  );
  check(
    'each row is the house’s 76, as it declares',
    seen.length === 6 && seen.every((row) => row.height === 76 && row.declared === 76),
    JSON.stringify(seen.map((row) => [row.height, row.declared])),
  );
  check(
    'a row says the preset in force, its target and the next change, or why it cannot',
    seen.map((row) => row.line).join(' | ') ===
      [
        'Comfort · 21° · Eco at 22:00',
        'Comfort · 21.0° · Sleep at 22:30',
        'Schedule off · 18°',
        'No heating schedule yet',
        '18° · Comfort Fri at 07:00',
        'Unavailable',
      ].join(' | '),
    seen.map((row) => row.line).join(' | '),
  );
  // a guest's row: the gaps' preset unknown, no change said into it
  const guest = frame(page, 'Row · guest').locator('fluvy-schedule-card').first();
  const line = await guest.evaluate((el) =>
    el.shadowRoot.querySelector('.fv-row__sub')?.textContent.trim(),
  );
  check(
    'a guest’s row says no change into a preset it cannot know',
    line === 'Comfort · 21°',
    line,
  );
  check(
    'the switch stands at the end of a row with a schedule, none where there is none',
    seen.map((row) => row.switch).join() === 'true,true,true,false,true,true',
    seen.map((row) => row.switch).join(),
  );

  // the switch acts on its own: the schedule off, no sheet opened
  const bedroom = rows.first();
  const dialog = bedroom.locator('fluvy-heating-sheet dialog');
  await reset(page);
  await bedroom.locator('.fv-hit').click();
  await settle(page, 300);
  const c = await calls(page);
  check(
    'the row’s switch turns the schedule’s automation off, and opens nothing',
    c.length === 1 && c[0].s === 'automation.turn_off' && !(await dialog.isVisible()),
    JSON.stringify(c),
  );
  // a tap anywhere else (the cover over the row) opens the sheet on today
  await bedroom.locator('.sc-row > .fv-tile__tap').click();
  await settle(page, 500);
  const pressed = await dialog
    .locator('.hs-days')
    .first()
    .locator('.is-active')
    .getAttribute('aria-label');
  check(
    'a tap on the row opens the sheet on today',
    (await dialog.isVisible()) && pressed === 'Thursday',
    pressed,
  );
  await page.keyboard.press('Escape');
  await settle(page, 400);

  // a guest's row reads the plan on a tap
  await guest.locator('.sc-row > .fv-tile__tap').click();
  await settle(page, 500);
  const note = await guest
    .locator('fluvy-heating-sheet dialog .hs-note')
    .first()
    .textContent()
    .catch(() => '');
  check(
    'a guest’s tap on the row opens the plan to read',
    note?.trim() === 'Only an administrator can change the schedule',
    note,
  );
  await page.close();
}

await suite.finish();
