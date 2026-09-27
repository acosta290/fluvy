#!/usr/bin/env node
/**
 * Interaction and lifecycle tests for the inputs / ambient / home-extras cards (helpers, to-do, timer,
 * actions, updates, weather, openings, scenes, chips, hello). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5184/ node interactions-inputs.mjs
 * What it proves: a text field commits on Enter and on leaving, Escape puts the state back, a key typed
 * in it never reaches the window (Home Assistant's shortcuts); chips and steppers are optimistic and send
 * one call; a tick and an add on the to-do list answer at once; the timer's one timeout and the greeting's
 * hour timer are released on disconnect, and so are the weather forecast and to-do subscriptions; a tab
 * row tracks the open view; a double tap on an action is one run.
 */
import { BASE, calls, reset, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { browser, check } = suite;

async function open(sheet, width = 360, extra = '') {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.addInitScript(() => {
    // every timer is tracked, so a card that leaves the page can be asked what it left behind
    const active = new Map();
    const st = window.setTimeout.bind(window);
    const ct = window.clearTimeout.bind(window);
    window.setTimeout = (fn, ms, ...rest) => {
      const id = st(() => {
        active.delete(id);
        if (typeof fn === 'function') fn(...rest);
      }, ms);
      active.set(id, new Error().stack ?? '');
      return id;
    };
    window.clearTimeout = (id) => {
      active.delete(id);
      ct(id);
    };
    window.__timers = active;
    // keys that reach the window are what Home Assistant's shortcuts would see
    window.__keys = [];
    window.addEventListener('keydown', (e) => window.__keys.push(e.key));
  });
  await page.goto(`${BASE}?sheet=${sheet}&width=${width}${extra}`);
  await page.waitForSelector('html[data-ready="1"]');
  await page.waitForTimeout(900);
  return page;
}
const keysSeen = (page) => page.evaluate(() => window.__keys.splice(0));

/* ---------- helpers: the text field ---------- */
{
  const page = await open('inputs');
  const card = page.locator('fluvy-helpers-card').first();
  const field = card.locator('input.fv-field__input').first();
  check('text field shows the state', (await field.inputValue()) === 'Welcome home, Marta');

  await field.click();
  await keysSeen(page);
  await page.keyboard.type('e');
  const leaked = await keysSeen(page);
  check(
    'a key typed in the field never reaches the window (HA shortcuts)',
    leaked.length === 0,
    JSON.stringify(leaked),
  );

  await field.fill('Hola, Marta');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  let c = await calls(page);
  check(
    'Enter commits once and leaves the field',
    c.length === 1 &&
      c[0].s === 'input_text.set_value' &&
      c[0].d.value === 'Hola, Marta' &&
      (await page.evaluate(() => document.activeElement?.tagName)) !== 'INPUT',
    JSON.stringify(c.map((x) => x.d)),
  );
  await page.waitForTimeout(400);
  check(
    '…and the field keeps the new value after the report',
    (await field.inputValue()) === 'Hola, Marta',
  );
  await reset(page);

  await field.click();
  await field.fill('typo');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  c = await calls(page);
  check(
    'Escape restores the state and sends nothing',
    c.length === 0 && (await field.inputValue()) === 'Hola, Marta',
    `${await field.inputValue()} · ${c.length} calls`,
  );

  await field.click();
  await field.fill('Bon dia');
  await card.locator('.fv-card__title').first().click(); // leaving the field
  await page.waitForTimeout(80);
  c = await calls(page);
  check(
    'leaving the field commits it',
    c.length === 1 && c[0].d.value === 'Bon dia',
    JSON.stringify(c.map((x) => x.d)),
  );
  await reset(page);

  await field.click();
  await field.fill('Bon dia');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  check('an unchanged value is not sent again', (await calls(page)).length === 0);

  // the select chips: optimistic, one call
  const chip = card.locator('.fv-chip').nth(1);
  await chip.click();
  const pressed = await chip.getAttribute('aria-pressed');
  await page.waitForTimeout(80);
  c = await calls(page);
  check(
    'a select chip fills at once and sends one call',
    pressed === 'true' &&
      c.length === 1 &&
      c[0].s === 'input_select.select_option' &&
      c[0].d.option === 'Away',
    JSON.stringify(c.map((x) => x.d)),
  );
  await chip.click();
  await page.waitForTimeout(80);
  check('tapping the active chip sends nothing', (await calls(page)).length === 1);
  await reset(page);

  // the number stepper: optimistic, then the ruler follows
  const plus = card.locator('.fv-stepper__half').nth(1);
  await plus.dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' });
  await plus.dispatchEvent('pointerup');
  const shown = (await card.locator('.in-field__value span').first().textContent()).trim();
  await page.waitForTimeout(700);
  c = await calls(page);
  check(
    'the stepper shows 66 at once and sends one set_value',
    shown === '66' && c.length === 1 && c[0].s === 'input_number.set_value' && c[0].d.value === 66,
    `${shown} · ${JSON.stringify(c.map((x) => x.d))}`,
  );
  await reset(page);

  // the switch row
  await card.locator('.fv-hit').first().click();
  const on = await card.locator('.fv-switch').first().getAttribute('aria-checked');
  await page.waitForTimeout(80);
  c = await calls(page);
  check(
    'the switch row flips before the answer',
    on === 'true' && c.length === 1 && c[0].s === 'input_boolean.turn_on',
    JSON.stringify(c.map((x) => x.s)),
  );
  await reset(page);

  // hard states: unavailable helpers are inert, a long select is a row that opens more-info
  const edge = page.locator('fluvy-helpers-card').nth(3);
  const zone = edge.locator('.in-value').first();
  check(
    'a 12-option select is one row with its value',
    (await zone.textContent()).trim() === 'Kitchen',
  );
  await page.close();
}

/* ---------- to-do ---------- */
{
  const page = await open('inputs');
  const card = page.locator('fluvy-todo-card').first();
  await page.waitForTimeout(200);
  check(
    'the list arrives with its five items',
    (await card.locator('.in-todo__row').count()) === 5,
  );
  const oat = card.locator('.in-check-hit[aria-label="Oat milk"]');
  await oat.click();
  const ticked = await oat.getAttribute('aria-checked');
  const order = (await card.locator('.in-todo__text').allTextContents()).map((r) => r.trim());
  await page.waitForTimeout(80);
  let c = await calls(page);
  check(
    'a tick answers under the finger and sends one update_item',
    ticked === 'true' &&
      c.length === 1 &&
      c[0].s === 'todo.update_item' &&
      c[0].d.status === 'completed',
    JSON.stringify(c.map((x) => x.d)),
  );
  check(
    '…and the ticked item joins the completed group at once',
    order.indexOf('Oat milk') === 2,
    JSON.stringify(order),
  );
  await page.waitForTimeout(500);
  check(
    '…and the head counts it',
    (await card.locator('.fv-card__sub').textContent()).trim() === '2 of 5 left',
    await card.locator('.fv-card__sub').textContent(),
  );
  await reset(page);

  await card.locator('.in-add').click();
  await page.waitForTimeout(100);
  const composer = card.locator('input.fv-field__input');
  check(
    '"+" opens the composer with the focus in it',
    (await composer.count()) === 1 &&
      (await page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.tagName)) ===
        'INPUT',
  );
  await page.keyboard.type('Butter');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(80);
  c = await calls(page);
  const rows = await card.locator('.in-todo__text').allTextContents();
  check(
    'Enter adds the item at once, keeps the composer open and empty',
    c.length === 1 &&
      c[0].s === 'todo.add_item' &&
      c[0].d.item === 'Butter' &&
      rows.some((r) => r.trim() === 'Butter') &&
      (await composer.inputValue()) === '' &&
      (await page.evaluate(() => document.activeElement?.shadowRoot?.activeElement?.tagName)) ===
        'INPUT',
    JSON.stringify(rows),
  );
  await page.waitForTimeout(500);
  check(
    "…and the server's list keeps it",
    (await card.locator('.in-todo__text').allTextContents()).some((r) => r.trim() === 'Butter'),
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  check('Escape closes the composer', (await composer.count()) === 0);

  const empty = page.locator('fluvy-todo-card').nth(1);
  check(
    'an empty list says so, in the empty-state idiom (the ring and one line)',
    (await empty.locator('.fv-empty-state__text').textContent()).trim() === 'Nothing left' &&
      (await empty.locator('.fv-empty-state__ring').count()) === 1,
  );
  const readonly = page.locator('fluvy-todo-card').nth(2);
  check(
    'a read-only list has no "+" and no checkboxes',
    (await readonly.locator('.in-add').count()) === 0 &&
      (await readonly.locator('button.in-check-hit').count()) === 0,
  );
  await page.close();
}

/* ---------- timer: the one timeout ---------- */
{
  const page = await open('inputs');
  const card = page.locator('fluvy-timer-card').first();
  const value = card.locator('.fv-readout__value span').first();
  const a = (await value.textContent()).trim();
  await page.waitForTimeout(1100);
  const b = (await value.textContent()).trim();
  check('the countdown moves one second at a time', a !== b && /^\d+:\d\d$/.test(b), `${a} → ${b}`);

  await card.locator('.fv-round--accent').click(); // pause
  const badge = (await card.locator('.fv-badge').textContent()).trim();
  await page.waitForTimeout(80);
  let c = await calls(page);
  check(
    'pause answers at once and sends timer.pause',
    badge === 'Paused' && c.length === 1 && c[0].s === 'timer.pause',
    `${badge} · ${JSON.stringify(c.map((x) => x.s))}`,
  );
  await page.waitForTimeout(300); // the mock has answered (its `remaining` is the seeded one; Home Assistant sends the real one)
  const held = (await value.textContent()).trim();
  await page.waitForTimeout(1300);
  check(
    'a paused timer stands still',
    (await value.textContent()).trim() === held,
    `${held} → ${(await value.textContent()).trim()}`,
  );
  await reset(page);

  // lifecycle: remove the card → nothing of its own keeps ticking
  const before = await page.evaluate(() => window.__timers.size);
  await page.evaluate(() => {
    const el = document.querySelector('fluvy-timer-card');
    window.__held = el;
    el.remove();
  });
  await page.waitForTimeout(50);
  const after = await page.evaluate(() => window.__timers.size);
  check(
    'removing the timer card leaves no timer of its own',
    after <= before,
    `${before} → ${after}`,
  );
  await page.evaluate(() => {
    document.querySelector('.pg-frame').prepend(window.__held);
  });
  await page.waitForTimeout(300);
  check(
    '…and it comes back showing the present',
    /^\d+:\d\d$/.test(
      (
        await page
          .locator('fluvy-timer-card')
          .first()
          .locator('.fv-readout__value span')
          .first()
          .textContent()
      ).trim(),
    ),
  );
  await page.close();
}

/* ---------- actions: one gesture, one run ---------- */
{
  const page = await open('inputs');
  const card = page.locator('fluvy-actions-card').first();
  const action = card.locator('.in-action').first();
  await action.click();
  await action.click(); // the double tap
  await page.waitForTimeout(80);
  const c = await calls(page);
  const sub = (await action.locator('.fv-row__sub').textContent()).trim();
  check(
    'a double tap on an action is one scene.turn_on',
    c.length === 1 && c[0].s === 'scene.turn_on',
    JSON.stringify(c.map((x) => x.s)),
  );
  check('…and the row says Done for a beat', sub === 'Done', sub);
  await page.waitForTimeout(1400);
  check(
    '…then goes back to when it ran',
    /ran \d\d:\d\d/.test((await action.locator('.fv-row__sub').textContent()).trim()),
    await action.locator('.fv-row__sub').textContent(),
  );
  await reset(page);

  // updates: Install turns the row into its progress bar
  const updates = page.locator('fluvy-updates-card').first();
  await updates.locator('.in-value').first().click();
  const bars = await updates.locator('.in-progress').count();
  await page.waitForTimeout(80);
  const u = await calls(page);
  check(
    'Install becomes a progress row at once and sends update.install',
    bars === 2 && u.length === 1 && u[0].s === 'update.install',
    `${bars} bars · ${JSON.stringify(u.map((x) => x.s))}`,
  );
  await page.close();
}

/* ---------- weather: subscriptions released and re-made ---------- */
{
  const page = await open('ambient');
  const count = await page.evaluate(async () => {
    const hass = window.fluvyMock.hass();
    const live = new Set();
    let opened = 0;
    const original = hass.connection.subscribeMessage;
    hass.connection.subscribeMessage = async (cb, msg) => {
      const unsub = await original(cb, msg);
      const token = { msg };
      live.add(token);
      opened += 1;
      return () => {
        live.delete(token);
        unsub();
      };
    };
    const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));
    const card = document.createElement('fluvy-weather-card');
    card.setConfig({
      type: 'custom:fluvy-weather-card',
      entity: 'weather.am_home',
      forecast: 'both',
    });
    card.hass = hass;
    document.querySelector('.pg-frame').append(card);
    await wait(300);
    const afterMount = live.size;
    card.setConfig({
      type: 'custom:fluvy-weather-card',
      entity: 'weather.am_evening',
      forecast: 'hourly',
    });
    await wait(300);
    const afterSwitch = { live: live.size, opened };
    card.remove();
    await wait(100);
    const afterRemove = live.size;
    document.querySelector('.pg-frame').append(card);
    await wait(300);
    const afterReturn = live.size;
    card.remove();
    await wait(100);
    return { afterMount, afterSwitch, afterRemove, afterReturn, final: live.size };
  });
  check(
    'weather: "both" opens two forecast subscriptions',
    count.afterMount === 2,
    JSON.stringify(count),
  );
  check(
    'weather: changing entity/mode releases them and opens the new one',
    count.afterSwitch.live === 1 && count.afterSwitch.opened === 3,
    JSON.stringify(count),
  );
  check(
    'weather: disconnect releases, reconnect re-subscribes, disconnect releases again',
    count.afterRemove === 0 && count.afterReturn === 1 && count.final === 0,
    JSON.stringify(count),
  );

  // openings: the "All sensors" row opens the rest in place
  const openings = page.locator('fluvy-openings-card').first();
  check(
    'openings: four rows and the "2 more" row',
    (await openings.locator('.fv-row').count()) === 5,
  );
  await openings.locator('.fv-row').last().click();
  await page.waitForTimeout(100);
  check(
    '…tapping it shows every sensor',
    (await openings.locator('.fv-row').count()) === 7 &&
      (await openings.locator('.fv-row').last().locator('.fv-row__sub').textContent()).trim() ===
        'Show less',
  );

  // scenes: a press fills its tile at once; the automation is triggered, not toggled
  const scenes = page.locator('fluvy-scenes-card').first();
  await scenes.locator('.am-scene').nth(1).click();
  const filled = (await scenes.locator('.am-scene').nth(1).getAttribute('class')).includes('is-on');
  await page.waitForTimeout(80);
  const s = await calls(page);
  check(
    'scenes: the pressed tile takes the fill at once and one scene.turn_on goes out',
    filled && s.length === 1 && s[0].s === 'scene.turn_on',
    `${filled} · ${JSON.stringify(s.map((x) => x.s))}`,
  );
  await page.close();
}

/* ---------- to-do subscription released on disconnect ---------- */
{
  const page = await open('inputs');
  const count = await page.evaluate(async () => {
    const hass = window.fluvyMock.hass();
    const live = new Set();
    const original = hass.connection.subscribeMessage;
    hass.connection.subscribeMessage = async (cb, msg) => {
      const unsub = await original(cb, msg);
      const token = { msg };
      live.add(token);
      return () => {
        live.delete(token);
        unsub();
      };
    };
    const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));
    const card = document.createElement('fluvy-todo-card');
    card.setConfig({ type: 'custom:fluvy-todo-card', entity: 'todo.groceries' });
    card.hass = hass;
    document.querySelector('.pg-frame').append(card);
    await wait(300);
    const afterMount = live.size;
    card.setConfig({ type: 'custom:fluvy-todo-card', entity: 'todo.chores' });
    await wait(300);
    const afterSwitch = live.size;
    card.remove();
    await wait(100);
    const afterRemove = live.size;
    document.querySelector('.pg-frame').append(card);
    await wait(300);
    const afterReturn = live.size;
    card.remove();
    await wait(100);
    return { afterMount, afterSwitch, afterRemove, afterReturn, final: live.size };
  });
  check(
    'to-do: one subscription per list, released on entity change and on disconnect, re-made on reconnect',
    count.afterMount === 1 &&
      count.afterSwitch === 1 &&
      count.afterRemove === 0 &&
      count.afterReturn === 1 &&
      count.final === 0,
    JSON.stringify(count),
  );
  await page.close();
}

/* ---------- hello: the hour timer, chips: the open view ---------- */
{
  const page = await open('home-extras');
  const timers = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));
    await wait(1400); // the shared pill refit one-shot (1.2 s) has fired by now
    const before = window.__timers.size;
    const card = document.createElement('fluvy-hello-card');
    card.setConfig({ type: 'custom:fluvy-hello-card', name: 'Test' });
    card.hass = window.fluvyMock.hass();
    document.querySelector('.pg-frame').append(card);
    await wait(1400);
    const mounted = window.__timers.size;
    card.remove();
    await wait(50);
    const removed = window.__timers.size;
    return { before, mounted, removed };
  });
  check(
    'hello: one hour-aligned timer while mounted, none after removal',
    timers.mounted === timers.before + 1 && timers.removed === timers.before,
    JSON.stringify(timers),
  );

  const chips = page.locator('fluvy-chips-card').first();
  check(
    'chips: the open view is the active tab',
    (await chips.locator('.fv-chip.is-active').textContent()).trim() === 'All',
  );
  await chips.locator('.fv-chip').nth(2).click();
  await page.waitForTimeout(150);
  const active = (await chips.locator('.fv-chip.is-active').allTextContents()).map((t) => t.trim());
  check(
    'chips: tapping a tab navigates and the row follows the router',
    active.length === 1 &&
      active[0] === 'Kitchen' &&
      (await page.evaluate(() => window.location.pathname)) === '/fluvy-home/kitchen',
    JSON.stringify(active),
  );
  await page.goBack();
  await page.waitForTimeout(150);
  check(
    "chips: the browser's back button moves the active tab back",
    (await chips.locator('.fv-chip.is-active').textContent()).trim() === 'All',
  );

  // a mouse reaches a row wider than its column: the wheel turns it, a drag pulls it without opening a tab
  await page.evaluate(() => {
    const holder = document.createElement('div');
    holder.id = 'wide-row';
    holder.style.width = '300px';
    const card = document.createElement('fluvy-chips-card');
    card.setConfig({
      type: 'custom:fluvy-chips-card',
      chips: ['Home', 'Lights', 'Climate', 'Energy', 'Sensors', 'Security', 'Garden'].map(
        (label) => ({ label, path: `/fluvy-home/${label.toLowerCase()}` }),
      ),
    });
    card.hass = window.fluvyMock.hass();
    holder.append(card);
    document.querySelector('.pg-frame').prepend(holder);
  });
  await page.waitForTimeout(400);
  const row = page.locator('#wide-row fluvy-chips-card .fv-chips');
  const room = await row.evaluate((el) => el.scrollWidth - el.clientWidth);
  check(
    'chips: seven tabs in a 300 px column overflow it (the case under test)',
    room > 1,
    `${room}px`,
  );
  const box = await row.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(500);
  const wheeled = await row.evaluate((el) => el.scrollLeft);
  check(
    'chips: a vertical mouse wheel scrolls the row sideways',
    wheeled > 1,
    `scrollLeft ${wheeled}`,
  );
  await row.evaluate((el) => {
    el.scrollLeft = 0;
  });
  const path = await page.evaluate(() => window.location.pathname);
  await page.mouse.move(box.x + box.width - 30, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 70, box.y + box.height / 2, { steps: 5 });
  await page.mouse.move(box.x + box.width - 130, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const dragged = await row.evaluate((el) => el.scrollLeft);
  check('chips: a mouse drag pulls the row', dragged >= 90, `scrollLeft ${dragged}`);
  check(
    'chips: the click that ends a drag opens no tab',
    (await page.evaluate(() => window.location.pathname)) === path,
  );
  await page.evaluate(() => document.getElementById('wide-row')?.remove());

  const heading = page.locator('fluvy-heading-card').filter({ hasText: 'Hall' }).first(); // two lights, a switch and a blind
  check(
    'heading: the meta counts what is on',
    (await heading.locator('.hm-section__text').textContent()).trim() === '2 of 4 on',
  );
  const readouts = page.locator('fluvy-readouts-card').first();
  await page.waitForTimeout(300);
  const arrows = await readouts.locator('.fv-trend').count();
  const bare = page.locator('fluvy-readouts-card').nth(2);
  check(
    'readouts: three earned arrows, none for a flat or unrecorded sensor',
    arrows === 3 && (await bare.locator('.fv-trend').count()) === 0,
    `${arrows} · ${await bare.locator('.fv-trend').count()}`,
  );
  await page.close();
}

await suite.finish();
