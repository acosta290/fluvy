#!/usr/bin/env node
/**
 * Interaction tests for the template card (#59) on the playground's `template` sheet: while Home Assistant has not
 * answered, a tile shows its entity's own glyph, palette and fill and a blank line where each templated text will land
 * (never the template, never a cut), and nothing moves when the words land; once answered, the fill follows `active`;
 * a state change redraws the words and the colour without a blank or a flash between; one subscription per template
 * and entity, none left once the cards leave the page; a template that fails shows nothing of itself, and a reader
 * still hears the tile's entity.
 * Real cards on the playground's simulated hass. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5251/ node interactions-template-card.mjs
 */
import { frame, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** The `n`th template card of a frame. */
const card = (page, title, n = 0) => frame(page, title).locator('fluvy-template-card').nth(n);
/** A part of a card's tile: its text as drawn (a pending line is a no-break space). */
const part = (locator, selector) =>
  locator.evaluate((el, sel) => el.shadowRoot.querySelector(sel)?.textContent ?? null, selector);
const name = (locator) => part(locator, '.fv-tile__name');
const line = async (locator) => (await part(locator, '.fv-tile__state'))?.trim() ?? null;
const rawLine = (locator) => part(locator, '.fv-tile__state');
const lit = (locator) =>
  locator.evaluate((el) => el.shadowRoot.querySelector('.fv-tile').classList.contains('is-on'));
const titleY = (locator) =>
  locator.evaluate((el) => el.shadowRoot.querySelector('.fv-tile__name').getBoundingClientRect().y);
/** What the circle draws: Home Assistant's icon by its id, or a glyph of Fluvy's. */
const circle = (locator) =>
  locator.evaluate((el) => {
    const ico = el.shadowRoot.querySelector('.fv-tile .fv-ico');
    return ico.querySelector('ha-icon')?.icon ?? (ico.querySelector('svg') ? 'glyph' : 'none');
  });

/* ---------- pending: the entity's own, a blank line where the words land, nothing moves ---------- */
{
  // the mock answers 3 s after the first paint here (a real socket takes 50–200 ms): the tiles are pending a while
  const slow = await suite.sheet('template', { extra: '&template_delay=3000' });
  const desk = card(slow, 'Compact', 0);
  const washer = card(slow, 'Large', 0);
  const busy = card(slow, 'Active by a number', 0);
  const before = await titleY(desk);
  const held = {
    deskLine: await rawLine(desk),
    deskIcon: await circle(desk),
    washerName: await name(washer),
    busyOn: await lit(busy),
  };
  check(
    'pending: a templated line and name are a blank line each (a no-break space), never the template',
    held.deskLine === '\u00a0' && held.washerName === '\u00a0',
    JSON.stringify(held),
  );
  check(
    'pending: the circle is the entity’s own glyph, the fill the entity’s own (a sensor: off)',
    held.deskIcon === 'glyph' && held.busyOn === false,
    JSON.stringify(held),
  );
  const shadows = await slow.evaluate(() =>
    [...document.querySelectorAll('fluvy-template-card')]
      .map((el) => el.shadowRoot?.textContent ?? '')
      .join(' '),
  );
  check(
    'pending: no tile shows a template’s own text',
    !shadows.includes('{{') && !shadows.includes('{%'),
  );
  await slow.waitForTimeout(3200);
  const after = await titleY(desk);
  const answered = {
    deskLine: await line(desk),
    deskIcon: await circle(desk),
    washerName: await name(washer),
    busyOn: await lit(busy),
  };
  check(
    'answered: the words land where the blank line was, and the name does not move',
    answered.deskLine === '21.4 °C here' && answered.washerName === 'Washing' && after === before,
    `${before} → ${after}, ${JSON.stringify(answered)}`,
  );
  check(
    'answered: the icon is the template’s, the fill follows `active` (a number not 0 is on)',
    answered.deskIcon === 'mdi:lamp' && answered.busyOn === true,
    JSON.stringify(answered),
  );
  await slow.close();
}

const page = await suite.sheet('template');
const templates = () => page.evaluate(() => window.fluvyMock.templates());

/* ---------- what the sheet's templates say ---------- */
{
  const washer = card(page, 'Compact', 1);
  check('a template line, its figure rounded', (await line(washer)) === '1240 W');
  check(
    'a colour template that gives a tone: the washer draws the warning while it draws a lot',
    await washer.evaluate((el) =>
      el.shadowRoot.querySelector('.fv-tile').classList.contains('fv-tile--warning'),
    ),
  );
  const ifs = [
    await line(card(page, 'If · elif · else', 0)),
    await circle(card(page, 'If · elif · else', 0)),
    await name(card(page, 'If · elif · else', 1)),
  ];
  check(
    '{% if %} · {% elif %} · {% else %}: the branch that holds',
    ifs[0] === 'Washing' && ifs[1] === 'mdi:flash' && ifs[2] === 'Door open',
    JSON.stringify(ifs),
  );
  const mushroom = [
    await name(card(page, 'Mini · Mushroom’s', 0)),
    await name(card(page, 'Mini · Mushroom’s', 1)),
    await name(card(page, 'Mini · Mushroom’s', 2)),
    await card(page, 'Mini · Mushroom’s', 0).evaluate((el) =>
      el.shadowRoot.querySelector('.fv-tile').classList.contains('fv-tile--mini'),
    ),
  ];
  check(
    'Mushroom’s cards pasted in: `primary` is the name, `vertical: true` the mini tile',
    mushroom.join('|') === 'Desk|Open|Hi Marta|true',
    JSON.stringify(mushroom),
  );
  const [busy, idle] = [
    await lit(card(page, 'Active by a number', 0)),
    await lit(card(page, 'Active by a number', 1)),
  ];
  check('active by a number: 1240 is on, 0 is off', busy && !idle, `${busy} ${idle}`);
}

/* ---------- a template that fails, and a tile of nothing ---------- */
{
  const broken = card(page, 'A template that fails', 0);
  const parts = [await name(broken), await line(broken)];
  const label = await broken.evaluate((el) =>
    el.shadowRoot.querySelector('.fv-tile__tap')?.getAttribute('aria-label'),
  );
  // the name keeps its blank line: the large tile's line stays under it, in its place
  const nameHeight = await broken.evaluate((el) =>
    Math.round(el.shadowRoot.querySelector('.fv-tile__name').getBoundingClientRect().height),
  );
  check(
    'a template that fails shows nothing of itself, its name’s line kept blank; a reader hears the entity',
    parts[0] === ' ' && parts[1] === '' && nameHeight === 20 && label === 'Desk lamp',
    `${JSON.stringify(parts)} ${nameHeight} ${label}`,
  );
  const odd = card(page, 'A template that fails', 1);
  check(
    'an icon it does not know and a colour no palette knows: the entity’s own',
    (await circle(odd)) === 'glyph' &&
      (await odd.evaluate((el) => !el.shadowRoot.querySelector('.fv-tile').dataset.accent)),
  );
  const [hello, night] = [card(page, 'No entity', 0), card(page, 'No entity', 1)];
  const nothing = {
    helloLabel: await hello.evaluate((el) =>
      el.shadowRoot.querySelector('.fv-tile__tap')?.getAttribute('aria-label'),
    ),
    nightButton: await night.evaluate((el) =>
      Boolean(el.shadowRoot.querySelector('.fv-tile__tap')),
    ),
    nightOn: await lit(night),
    skin: await night.evaluate((el) =>
      el.shadowRoot.querySelector('.fv-tile').classList.contains('fv-tile--off'),
    ),
  };
  check(
    'a tile of nothing: a button only for what runs (navigate), on when asked, never the off skin',
    nothing.helloLabel === 'Hello, Marta' &&
      !nothing.nightButton &&
      nothing.nightOn &&
      !nothing.skin,
    JSON.stringify(nothing),
  );
  // with no icon, the template's code braces: never the three dots a "more" round wears, and no button
  const bare = await card(page, 'No entity', 2).evaluate((el) => ({
    paths: [...el.shadowRoot.querySelectorAll('.fv-tile .fv-ico svg path')].map((p) =>
      p.getAttribute('d'),
    ),
    dots: el.shadowRoot.querySelectorAll('.fv-tile .fv-ico svg circle').length,
    button: Boolean(el.shadowRoot.querySelector('.fv-tile__tap')),
    line: el.shadowRoot.querySelector('.fv-tile__state').textContent.trim(),
  }));
  check(
    'a tile of nothing with no icon draws the code braces; its words a template’s sum',
    bare.paths.length === 3 && bare.dots === 0 && !bare.button && bare.line === 'Heating at 17 °C',
    JSON.stringify(bare),
  );
  check(
    'Mushroom’s brightness in per cent renders: `(state_attr(entity, "brightness") / 2.55) | round(0)`',
    (await line(card(page, 'Mini · Mushroom’s', 0))) === '70 %',
    await line(card(page, 'Mini · Mushroom’s', 0)),
  );
  const narrow = card(page, 'Narrow pairs', 0);
  const words = await narrow.evaluate((el) => {
    const state = el.shadowRoot.querySelector('.fv-tile__state');
    return { text: state.textContent.trim(), name: state.hasAttribute('data-name') };
  });
  check(
    'the person’s own words at 152: they lose their last part, and what is left ends in an ellipsis as a name does',
    words.text === '1240 W' && words.name,
    JSON.stringify(words),
  );
}

/* ---------- a state change: the words and the colour redraw with no blank and no flash between ---------- */
{
  const washer = card(page, 'Compact', 1);
  await washer.evaluate((el) => {
    const seen = [];
    const tile = () => el.shadowRoot.querySelector('.fv-tile');
    const note = () =>
      seen.push(
        `${tile().querySelector('.fv-tile__state').textContent}|${tile().classList.contains('fv-tile--warning')}`,
      );
    window.__seen = seen;
    window.__observer = new MutationObserver(note);
    window.__observer.observe(el.shadowRoot, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
  });
  const before = await templates();
  await page.evaluate(() => window.fluvyMock.set('sensor.tp_power', '400'));
  await settle(page, 600);
  const seen = await page.evaluate(() => {
    window.__observer.disconnect();
    return window.__seen;
  });
  const states = [...new Set(seen)];
  check(
    'the line goes from one reading to the next, the colour from the warning to the accent: nothing blank between',
    states.every((s) => !s.startsWith('\u00a0|') && !s.startsWith('|')) &&
      states.at(-1) === '400 W|false',
    JSON.stringify(states),
  );
  check('the change opened no further subscription', (await templates()) === before, `${before}`);
}

/* ---------- one subscription per template and entity of a card; none once the cards leave ---------- */
{
  // each card holds its own (two cards that ask the same template each keep theirs, as two rows of a card do not)
  const pairs = await page.evaluate(() => {
    let count = 0;
    for (const el of document.querySelectorAll('fluvy-template-card')) {
      const keys = new Set();
      for (const field of ['name', 'icon', 'secondary', 'active', 'color']) {
        const text = el.config?.[field];
        if (typeof text === 'string' && (text.includes('{{') || text.includes('{%')))
          keys.add(`${el.config.entity ?? ''}\n${text}`);
      }
      count += keys.size;
    }
    return count;
  });
  const open = await templates();
  check(
    'one subscription per template and entity of each card',
    open === pairs && pairs > 20,
    `${open} open, ${pairs} pairs`,
  );
  await page.evaluate(() =>
    document.querySelectorAll('fluvy-template-card').forEach((el) => el.remove()),
  );
  await settle(page);
  const left = await templates();
  check('removing the cards releases every subscription', left === 0, String(left));
}

await suite.finish();
