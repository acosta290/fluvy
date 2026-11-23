#!/usr/bin/env node
/**
 * Interaction tests for templates in a row's text: a template renders to its text (never to itself), follows a state
 * change, two rows that ask the same template for the same entity share one subscription, a template Home Assistant
 * refuses says nothing, removing the cards releases every subscription, and a row whose answer is still to come keeps
 * its line, so nothing moves when the words land; the chips card's chips (#87), whose words, icon and colour are
 * templates, counted live, a chip stepping in and out of the row as it has something to say; and the Bars card's
 * limits and badge read from the house (#253), an entity's and a template's, live, one still to come warning of
 * nothing.
 * Real cards on the playground's simulated hass. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5187/ node interactions-templates.mjs
 */
import { frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/* ---------- a pending template holds its line: nothing moves when the answer lands ---------- */
{
  // the mock answers 3 s after the first paint here (a real socket takes 50–200 ms): the rows are pending for a while
  const slow = await suite.sheet('lists', { extra: '&template_delay=3000' });
  const card = frame(slow, 'Entities · templates').locator('fluvy-entities-card');
  const title = (n) => card.locator('.fv-row').nth(n).locator('.fv-row__title').boundingBox();
  const line = async (n) =>
    (await card.locator('.fv-row').nth(n).locator('.fv-row__sub').allTextContents()).join('');
  const [thermostat, broken] = await Promise.all([title(0), title(3)]);
  const held = await line(0);
  check(
    'pending: the row keeps a blank sub line (a non-breaking space), never the template',
    held === '\u00a0' && (await line(3)) === '\u00a0',
    JSON.stringify(held),
  );
  await slow.waitForTimeout(3000);
  const [thermostatAfter, brokenAfter] = await Promise.all([title(0), title(3)]);
  const text = await line(0);
  check(
    'the answer lands without moving the title',
    text === '22.5 °C' && thermostatAfter.y === thermostat.y,
    `${thermostat.y} → ${thermostatAfter.y}, "${text}"`,
  );
  check(
    'a broken template still ends with nothing: its line goes, the title sits centred',
    (await line(3)) === '' && brokenAfter.y > broken.y,
    `${broken.y} → ${brokenAfter.y}`,
  );
  await slow.close();
}

const page = await suite.sheet('lists');

/** Open `render_template` subscriptions on the mock. */
const templates = () => page.evaluate(() => window.fluvyMock.templates());
/** The second line of a card's `n`th row ('' when the row has none). */
const sub = async (card, n) =>
  (await card.locator('.fv-row').nth(n).locator('.fv-row__sub').allTextContents()).join('').trim();
const shadowText = (card) => card.evaluate((el) => el.shadowRoot?.textContent ?? '');

const entities = frame(page, 'Entities · templates').locator('fluvy-entities-card');
const lock = frame(page, 'Lock · template').locator('fluvy-lock-card');
const bars = frame(page, 'Bars · template').locator('fluvy-bars-card');

/* ---------- what the templates render to ---------- */
{
  const first = await sub(entities, 0);
  check('entities: a template renders to its text, the figure rounded', first === '22.5 °C', first);
  const two = await sub(entities, 1);
  check('entities: two entities on one line', two === '22.5 °C · 61 %', two);
  const who = await sub(entities, 2);
  check('entities: the person looking at the dashboard', who === 'Checked by Marta', who);
  const broken = await sub(entities, 3);
  const text = await shadowText(entities);
  check(
    'entities: a template Home Assistant refuses paints nothing, never its own text',
    broken === '' && !text.includes('{{') && !text.includes('nonsense'),
    JSON.stringify(broken),
  );
  const again = await sub(entities, 4);
  check(
    'entities: a second row asking the same template shows the same text',
    again === '22.5 °C',
    again,
  );
  const inside = await sub(lock, 0);
  check('lock: a row’s template renders', inside === '22.5 °C', inside);
  const watered = await sub(bars, 0);
  check(
    'bars: a row’s template renders, an attribute as an int',
    watered === 'Watered 3 days ago',
    watered,
  );
}

/* ---------- one subscription per template · entity pair ---------- */
{
  // the sheet asks seven template rows for six distinct pairs: the thermostat's two rows share one
  const count = await templates();
  check(
    'six distinct pairs on the sheet hold six subscriptions: two rows share one',
    count === 6,
    String(count),
  );
}

/* ---------- a state change re-renders ---------- */
{
  await page.evaluate(() => {
    window.fluvyMock.set('climate.ls_living', undefined, { current_temperature: 21.73 });
    window.fluvyMock.set('sensor.ls_temperature', '21.73');
  });
  await settle(page);
  const [first, two, again, inside] = await Promise.all([
    sub(entities, 0),
    sub(entities, 1),
    sub(entities, 4),
    sub(lock, 0),
  ]);
  check(
    'a state change re-renders every row that reads it, on every card',
    first === '21.7 °C' && two === '21.7 °C · 61 %' && again === '21.7 °C' && inside === '21.7 °C',
    `${first} | ${two} | ${again} | ${inside}`,
  );
  await page.evaluate(() => window.fluvyMock.set('sensor.ls_humidity', '58'));
  await settle(page);
  const humid = await sub(entities, 1);
  check('…and the other entity of a line too', humid === '21.7 °C · 58 %', humid);
  const count = await templates();
  check('the changes opened no further subscription', count === 6, String(count));
}

/* ---------- removing the cards releases the subscriptions ---------- */
{
  await entities.evaluate((el) => el.remove());
  await settle(page);
  const left = await templates();
  check('removing the entities card releases its four', left === 2, String(left));
  await page.evaluate(() =>
    document.querySelectorAll('fluvy-lock-card, fluvy-bars-card').forEach((el) => el.remove()),
  );
  await settle(page);
  const none = await templates();
  check('removing every card brings the count to 0', none === 0, String(none));
}

/* ---------- chips whose words, icon and colour are templates (#87) ---------- */
{
  const home = await suite.sheet('home-extras');
  const row = frame(home, 'Chips · templates (#87)').locator('fluvy-chips-card').first();
  const names = async () =>
    row.evaluate((el) =>
      [...(el.shadowRoot?.querySelectorAll('.fv-chip') ?? [])].map((chip) =>
        (chip.textContent ?? '').trim(),
      ),
    );
  const icon = async () =>
    row.evaluate((el) => el.shadowRoot?.querySelector('.fv-chip ha-icon')?.icon ?? '');
  const shown = await names();
  check(
    'chips: who is home and the rooms lit, counted by templates; a chip with something to say',
    JSON.stringify(shown) === JSON.stringify(['2 home', '2 rooms lit', 'Study lamp on']),
    JSON.stringify(shown),
  );
  const text = await row.evaluate((el) => el.shadowRoot?.textContent ?? '');
  check(
    'chips: never a template’s own text',
    !text.includes('{{'),
    text.replace(/\s+/g, ' ').trim(),
  );
  await home.evaluate(() => {
    window.fluvyMock.set('person.lena', 'not_home');
    window.fluvyMock.set('light.bedroom_lamp', 'on');
  });
  await settle(home);
  const after = await names();
  check(
    'chips: a state change counts again, and a chip with something to say steps into the row',
    JSON.stringify(after) ===
      JSON.stringify(['1 home', '3 rooms lit', 'Study lamp on', 'Bedroom lamp on']),
    JSON.stringify(after),
  );
  await home.evaluate(() => window.fluvyMock.set('light.study_lamp', 'off'));
  await settle(home);
  const out = await names();
  check(
    'chips: …and steps out of it when it has nothing more to say',
    JSON.stringify(out) === JSON.stringify(['1 home', '2 rooms lit', 'Bedroom lamp on']),
    JSON.stringify(out),
  );
  const glyph = await icon();
  check('chips: an icon named by a template', glyph === 'mdi:home-account', glyph);
  // three cards of these chips on the sheet, each its own subscriptions; removing them lets every one go
  const before = await home.evaluate(() => window.fluvyMock.templates());
  await home.evaluate(() =>
    document.querySelectorAll('fluvy-chips-card').forEach((el) => el.remove()),
  );
  await settle(home);
  const left = await home.evaluate(() => window.fluvyMock.templates());
  check(
    'chips: removing the rows releases their subscriptions',
    before > 0 && left === 0,
    `${before} → ${left}`,
  );
  await home.close();
}

/* ---------- a bar's limits and the badge from the house (#253) ---------- */
{
  const HUMIDITY = 'Bars · limits from the house (#253)';
  /** The rows of a card that warn, by name, and its badge's words ('' with none). */
  const look = (card) =>
    card.evaluate((el) => ({
      warned: [...(el.shadowRoot?.querySelectorAll('.fv-row') ?? [])]
        .filter((row) => row.querySelector('.fv-row__value--warning'))
        .map((row) => row.querySelector('.fv-row__title')?.textContent?.trim()),
      badge: el.shadowRoot?.querySelector('.fv-badge')?.textContent?.trim() ?? '',
    }));

  // the answers held for three seconds: the helper's low is read at once, the template's high is still to come
  const slow = await suite.sheet('bars', { extra: '&template_delay=3000' });
  const waiting = frame(slow, HUMIDITY).locator('fluvy-bars-card');
  const held = await look(waiting);
  check(
    'bars: a limit still to come warns of nothing, and the badge waits for the count',
    JSON.stringify(held) === JSON.stringify({ warned: ['Study'], badge: '' }),
    JSON.stringify(held),
  );
  await slow.waitForTimeout(3000);
  const landed = await look(waiting);
  check(
    'bars: …and once the answers land, the high warns and the badge says its template',
    JSON.stringify(landed) ===
      JSON.stringify({ warned: ['Bedroom', 'Bathroom', 'Study'], badge: 'Drying' }),
    JSON.stringify(landed),
  );
  await slow.close();

  const bars = await suite.sheet('bars');
  const card = frame(bars, HUMIDITY).locator('fluvy-bars-card');
  const count = () => bars.evaluate(() => window.fluvyMock.templates());
  // each full Humidity card (three) asks a high and a line for each of its rooms, and its badge (11); the compact one
  // no lines (6); the batteries' two limits that fail stay asked, as Home Assistant keeps listening
  const open = await count();
  check(
    'bars: the sheet holds one subscription per template · row pair',
    open === 41,
    String(open),
  );
  const set = async (id, state) => {
    await bars.evaluate(([entity, value]) => window.fluvyMock.set(entity, value), [id, state]);
    await settle(bars);
  };
  await set('input_number.bt_humidity_high', '70');
  const raised = await look(card);
  check(
    'bars: a template’s high moves with its helper: the bedroom and the bathroom are fine',
    JSON.stringify(raised) === JSON.stringify({ warned: ['Study'], badge: 'Drying' }),
    JSON.stringify(raised),
  );
  await set('switch.bt_dehumidifier', 'off');
  const resting = await look(card);
  check(
    'bars: a badge that says nothing leaves the card’s words, its count filled',
    resting.badge === '1 to air',
    resting.badge,
  );
  await set('input_number.bt_humidity_high', '60');
  const lowered = await look(card);
  check(
    'bars: the template’s high lowered again flips the bedroom and the bathroom to warn',
    JSON.stringify(lowered) ===
      JSON.stringify({ warned: ['Bedroom', 'Bathroom', 'Study'], badge: '3 to air' }),
    JSON.stringify(lowered),
  );
  await set('input_number.bt_humidity_low', '30');
  const study = await look(card);
  check(
    'bars: an entity’s low moves with it: the study is fine at 30 %',
    JSON.stringify(study.warned) === JSON.stringify(['Bedroom', 'Bathroom']),
    JSON.stringify(study),
  );
  const after = await count();
  check('bars: the changes opened no further subscription', after === open, `${open} → ${after}`);
  await bars.evaluate(() =>
    document.querySelectorAll('fluvy-bars-card').forEach((el) => el.remove()),
  );
  await settle(bars);
  const left = await count();
  check('bars: removing the cards releases every subscription', left === 0, String(left));
  await bars.close();
}

await suite.finish();
