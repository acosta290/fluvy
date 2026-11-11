#!/usr/bin/env node
/**
 * The room and the map, in a real Chromium against the playground. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-rooms.mjs
 * What it proves: a room's photo cross-fades in once decoded; its rows and its hero go to the room's path; a
 * compact tile inside it toggles before the mock answers; a room without a path shows no chevron; a missing
 * area says so; #39's rooms read what they hold — the sensors an area names even diagnostic, a thermostat alone,
 * the working sensor past a dead one, a sensor that comes late — and an empty one keeps its photo, its way in and,
 * for an administrator only, why it is empty; a room counts what is on once (its readout and its rows alike); at 211
 * a tile head gives its circle to a name that would be cut and the hint runs three lines at most, in every language;
 * a room's quick actions (#113) end its row, its head and its picture — its lights' round turns them all off in one
 * call, its blinds' closes them (a roof that only tilts by its slats, a screen that can do neither left out), asked
 * first in one question for the blinds and the roof alike, both moving at its yes, a hold on
 * a set of several opens the room and on an entity its details, one that cannot be read or act takes no tap, and half
 * a section holds as many as the name leaves room for; its picture's pill fits its glyph and its name whole as the card's
 * width moves, its glyph coming and going with the room; its name at the photo's top (#159) leaves the foot to the
 * rounds — four on the reporter's 328, two in half a section — each keeping its own tap, the name the room's; its
 * readouts stand on one row there in Dutch, their icons over whole figures, 60 shorter than wrapped as before, two and
 * one in half a section and one row at 211 in every language, nothing past its column, a reading out of reach keeping
 * the row of the card that reads;
 * the map's zones hold the right faces, a person nobody can place stands in Unknown, the rows say
 * the distance only for someone away with a fix, and Home Assistant's map, which the playground cannot make,
 * gives way to the zones silently.
 */
import { everyLanguage } from './lib.mjs';
import { calls, frame, moreInfo, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

const watchNavigation = (page) =>
  page.evaluate(() => {
    window.__navigations = [];
    window.addEventListener('location-changed', () =>
      window.__navigations.push(window.location.pathname),
    );
  });
const navigations = (page) => page.evaluate(() => window.__navigations.splice(0));

/* ---------- the room ---------- */
{
  const page = await suite.sheet('rooms');
  await watchNavigation(page);
  const photo = frame(page, 'Room · photo').locator('fluvy-room-card').first();
  await settle(page, 600);
  check(
    'the photo is on the hero, shown once decoded',
    (await photo.locator('.rm-hero .fv-plate__img.is-on').count()) === 1 &&
      (await photo.locator('.am-area__badge').textContent()).includes('Living room'),
  );
  check(
    'the readouts say the climate and what is on',
    (await photo.locator('.am-area__stats .fv-readout').count()) === 3,
  );
  const rows = photo.locator('.am-rows .fv-row');
  check('the category rows: lights, climate, media, every device', (await rows.count()) === 4);
  await rows.first().click();
  await settle(page, 200);
  let went = await navigations(page);
  check(
    'a row goes to the room',
    went.length === 1 && went[0] === '/fluvy-auto/room-rm_living',
    went.join(' '),
  );
  await photo.locator('.rm-hero').click();
  await settle(page, 200);
  went = await navigations(page);
  check('so does the hero', went.length === 1 && went[0] === '/fluvy-auto/room-rm_living');

  const tiles = frame(page, 'Room · tiles').locator('fluvy-room-card').first();
  check(
    'the controls as tiles: the lights first, four at most',
    (await tiles.locator('.rm-controls .fv-tile').count()) === 4,
  );
  await reset(page);
  await tiles.locator('.rm-controls .fv-tile').nth(1).click(); // the reading lamp, off
  await settle(page, 200);
  const sent = await calls(page);
  check(
    'a tile inside the room toggles at once and sends one call',
    sent.length === 1 &&
      sent[0].s === 'light.turn_on' &&
      (await tiles.locator('.rm-controls .fv-tile').nth(1).getAttribute('class')).includes('is-on'),
    JSON.stringify(sent.map((x) => x.s)),
  );

  const bare = frame(page, 'Room · no photo').locator('fluvy-room-card').first();
  check(
    'without a picture the hero is the gradient',
    (await bare.locator('.fv-plate__img').count()) === 0,
  );
  await bare.locator('.am-rows .fv-row').first().click();
  await settle(page, 200);
  went = await navigations(page);
  check(
    "without a path an admin's rows go to the area's settings",
    went.length === 1 && went[0] === '/config/areas/area/rm_kitchen',
    went.join(' '),
  );
  const empty = frame(page, 'Room · empty, missing').locator('fluvy-room-card');
  check(
    'an empty area says so; an area that is not there says that',
    (await empty.nth(0).locator('.fv-empty-state__text').textContent()).trim() ===
      'Nothing in this room yet' &&
      (await empty.nth(1).locator('.fv-empty').textContent()).trim() === 'Area not found',
  );

  /* #39: a room finds what is in it */
  const values = (card) =>
    card
      .locator('.am-area__stats .fv-readout__value')
      .allTextContents()
      .then((all) => all.map((text) => text.replace(/\s+/g, '')));
  const reported = frame(page, 'Room · four areas, two sensors each (#39)').locator(
    'fluvy-room-card',
  );
  const [garten, gaste, kuche] = await Promise.all([0, 1, 2].map((n) => values(reported.nth(n))));
  check(
    'the plain rooms read their two sensors, and the kitchen the diagnostic ones its area names',
    garten.join() === '16.4°C,92%' &&
      gaste.join() === '22.1°C,53%' &&
      kuche.join() === '21.3°C,48%',
    `${garten} | ${gaste} | ${kuche}`,
  );
  const living = reported.nth(3);
  check(
    'a room whose sensors are hidden keeps its photo and says it is empty',
    (await living.locator('.rm-hero').count()) === 1 &&
      (await living.locator('.fv-empty-state__text').textContent()).trim() ===
        'Nothing in this room yet',
  );
  const why = frame(page, 'Room · hidden sensors, why it is empty').locator('fluvy-room-card');
  const hint = (await why.nth(0).locator('.fv-empty-state__hint').textContent()).trim();
  check(
    'an administrator reads why, and where to choose its sensors',
    hint === '2 hidden or diagnostic entities · choose its sensors in the area’s settings',
    hint,
  );
  await why.nth(0).locator('.rm-hero').click();
  await settle(page, 200);
  went = await navigations(page);
  check(
    'the empty room still opens: its photo',
    went.length === 1 && went[0] === '/fluvy-auto/room-rm_wohnzimmer',
    went.join(' '),
  );
  await why.nth(1).locator('.fv-head__open').click();
  await settle(page, 200);
  went = await navigations(page);
  check(
    'and its chevron',
    went.length === 1 && went[0] === '/fluvy-auto/room-rm_wohnzimmer',
    went.join(' '),
  );
  const guest = frame(page, 'Room · hidden sensors, not an administrator').locator(
    'fluvy-room-card',
  );
  check(
    'someone who is not an administrator sees the panel without the hint',
    (await guest.locator('.fv-empty-state').count()) === 1 &&
      (await guest.locator('.fv-empty-state__hint').count()) === 0,
  );
  const store = frame(page, 'Room · registry without state').locator('fluvy-room-card');
  check(
    'entries without a state are neither shown nor counted',
    (await store.locator('.fv-empty-state').count()) === 1 &&
      (await store.locator('.fv-empty-state__hint').count()) === 0,
  );
  const alone = frame(page, 'Room · thermostat only').locator('fluvy-room-card');
  check(
    'a thermostat alone gives the room its readings, and is the one device on in its readout as in its rows',
    (await values(alone)).join() === '20.5°C,44%,1of1' &&
      (
        await alone.locator('.am-rows .fv-row').last().locator('.fv-row__sub').textContent()
      ).trim() === '1 of 1 on',
    (await values(alone)).join(),
  );
  check(
    'the working sensor is read when the first one is dead',
    (await values(frame(page, 'Room · unavailable first').locator('fluvy-room-card'))).join() ===
      '19.8°C',
  );
  const late = frame(page, 'Room · a sensor that arrives late').locator('fluvy-room-card');
  const before = await late.locator('.fv-empty-state').count();
  await page.evaluate(() =>
    window.fluvyMock.add([
      'sensor.rm_late_temperature',
      '19.6',
      { device_class: 'temperature', unit_of_measurement: '°C' },
    ]),
  );
  await settle(page, 300);
  check(
    'a sensor that comes late fills its room, with the same registries',
    before === 1 &&
      (await late.locator('.fv-empty-state').count()) === 0 &&
      (await values(late)).join() === '19.6°C',
    (await values(late)).join(),
  );
  await page.close();
}

/* ---------- #113: a room's quick actions ---------- */
{
  const page = await suite.sheet('rooms');
  await watchNavigation(page);
  const ids = (call) => [].concat(call?.d?.entity_id ?? call?.t?.entity_id ?? []);
  /** A finger's press on a round: a tap, or held for 700 ms. */
  const press = async (round, hold = false) => {
    await round.scrollIntoViewIfNeeded();
    const box = await round.boundingBox();
    await page.mouse.move(box.x + 22, box.y + 22);
    await page.mouse.down();
    if (hold) await page.waitForTimeout(700);
    await page.mouse.up();
    await settle(page, 200);
  };
  const quick = frame(page, 'Room · quick actions (#113)').locator('fluvy-room-card');
  const living = quick.nth(0).locator('.rm-quick .lt-bulb');
  check(
    'a row ends in the room’s lights, then its blinds',
    (await living.count()) === 2 &&
      (await living.nth(0).getAttribute('aria-label')) === 'Lights' &&
      (await living.nth(1).getAttribute('aria-label')) === 'Blinds',
  );
  await reset(page);
  await press(living.nth(0));
  const lights = await calls(page);
  check(
    'its lights’ round turns every light of the room off in one call, under the finger, and never the room’s own tap',
    lights.length === 1 &&
      lights[0].s === 'light.turn_off' &&
      ids(lights[0]).length === 3 &&
      (await living.nth(0).getAttribute('aria-checked')) === 'false' &&
      (await navigations(page)).length === 0,
    JSON.stringify(lights),
  );
  await reset(page);
  await press(living.nth(1));
  const blinds = await calls(page);
  check(
    'its blinds’ round closes the open blinds',
    blinds.length === 1 &&
      blinds[0].s === 'cover.close_cover' &&
      ids(blinds[0]).join() === 'cover.rm_blinds',
    JSON.stringify(blinds),
  );
  const fan = quick.nth(1).locator('.rm-quick .lt-bulb').nth(1);
  await reset(page);
  await press(fan);
  check(
    'the bedroom’s fans’ round turns its fan off',
    JSON.stringify((await calls(page)).map((call) => call.s)) === '["fan.turn_off"]',
  );
  // a hold on a set of several opens the room; on one of a single entity, its details
  await reset(page);
  await press(quick.nth(2).locator('.rm-quick .lt-bulb').first(), true);
  const opened = await navigations(page);
  check(
    'a hold on the den’s lights (three) opens the room, and turns nothing',
    opened.join() === '/fluvy-auto/room-rm_den' && (await calls(page)).length === 0,
    `${opened.join(' ')} ${JSON.stringify(await calls(page))}`,
  );
  const own = frame(page, 'Room · quick actions of one’s own (#113)')
    .locator('fluvy-room-card')
    .first();
  const hero = own.locator('.rm-hero .rm-quick .lt-bulb');
  check(
    'the picture ends in the person’s own, as many as it holds: the kettle by its name, the porch that cannot be read, one not there',
    (await hero.count()) === 3 &&
      (await hero.nth(0).getAttribute('aria-label')) === 'Kettle' &&
      (await hero.nth(1).getAttribute('aria-disabled')) === 'true' &&
      (await hero.nth(2).getAttribute('aria-disabled')) === 'true',
  );
  await reset(page);
  await press(hero.nth(0), true);
  check(
    'a hold on the kettle opens its details, never the room',
    JSON.stringify(await moreInfo(page)) === '["switch.rm_kettle"]' &&
      (await navigations(page)).length === 0,
    JSON.stringify(await moreInfo(page)),
  );
  await reset(page);
  await press(hero.nth(0));
  await press(hero.nth(1));
  const kettle = await calls(page);
  check(
    'a tap on the kettle switches it, on the picture, and the porch that cannot be read takes none',
    kettle.length === 1 &&
      kettle[0].s === 'switch.turn_off' &&
      ids(kettle[0]).join() === 'switch.rm_kettle',
    JSON.stringify(kettle),
  );
  const half = frame(page, 'Room · quick actions in half a section (#113)').locator(
    'fluvy-room-card',
  );
  const counts = await Promise.all(
    [0, 1, 2, 3].map((n) => half.nth(n).locator('.rm-quick .lt-bulb').count()),
  );
  const pills = await Promise.all(
    [0, 1].map((n) => half.nth(n).locator('.am-area__badge:not(.is-cut) svg').count()),
  );
  check(
    'in half a phone’s section none: the picture’s pill keeps its glyph and its name whole',
    counts.join() === '0,0,0,0' && pills.join() === '1,1',
    `${counts.join()} · ${pills.join()}`,
  );
  const sunroom = frame(page, 'Room · blinds that only tilt among its covers').locator(
    '.rm-quick .lt-bulb',
  );
  await reset(page);
  await press(sunroom.nth(0));
  await press(sunroom.nth(1));
  const shut = (await calls(page)).map((call) => `${call.s} ${ids(call).join()}`);
  check(
    'the sunroom’s blinds’ round closes the blinds and tilts the roof shut, one call each, never the screen; its radio, which can do nothing, takes no tap',
    shut.join(' | ') ===
      'cover.close_cover cover.rm_sunroom_blinds | cover.close_cover_tilt cover.rm_sunroom_roof' &&
      (await sunroom.nth(1).getAttribute('aria-disabled')) === 'true',
    shut.join(' | '),
  );
  // asked first: one action handed to Home Assistant's dialog for all of the set; its yes (the action handed back as
  // `ll-custom` from the element that asked, as Home Assistant does) moves the blinds and the roof alike, once
  await page.evaluate(() => {
    window.__asked = [];
    document.addEventListener('hass-action', (event) =>
      window.__asked.push({
        node: event.composedPath()[0],
        action: event.detail.config.tap_action,
      }),
    );
    window.__yes = () =>
      window.__asked[0].node.dispatchEvent(
        new CustomEvent('ll-custom', {
          detail: window.__asked[0].action,
          bubbles: true,
          composed: true,
        }),
      );
  });
  await reset(page);
  await press(
    frame(page, 'Room · blinds that only tilt among its covers, asked first')
      .locator('.rm-quick .lt-bulb')
      .first(),
  );
  const asked = await page.evaluate(() => window.__asked.map(({ action }) => action));
  const before = (await calls(page)).length;
  await page.evaluate(() => window.__yes());
  await settle(page, 200);
  await page.evaluate(() => window.__yes());
  await settle(page, 200);
  const answered = (await calls(page)).map((call) => `${call.s} ${ids(call).join()}`);
  check(
    'asked first, a set of blinds and a roof that only tilts is one question, and both move at its yes, once',
    asked.length === 1 &&
      asked[0]?.action === 'fire-dom-event' &&
      typeof asked[0]?.confirmation?.text === 'string' &&
      before === 0 &&
      answered.join(' | ') ===
        'cover.close_cover cover.rm_sunroom_blinds | cover.close_cover_tilt cover.rm_sunroom_roof',
    JSON.stringify({ asked, before, answered }),
  );
  await page.close();
}

/* ---------- the room's pill as its card's width moves: its glyph comes and goes, the pill fits what it holds ---------- */
{
  // half of a 260 section (122): "Garten" holds its pill without its glyph; at 152 with it, and back again
  const page = await suite.sheet('rooms', { width: 260, lang: 'hu' });
  const garden = frame(page, 'Room · four areas, two sensors each (#39)')
    .locator('fluvy-room-card')
    .first();
  const pill = () =>
    garden.evaluate((card) => {
      const badge = card.shadowRoot.querySelector('.am-area__badge');
      const glyph = badge.querySelector(':scope > svg, :scope > .fv-haicon');
      const name = badge.querySelector('.fv-chip__name');
      return {
        glyph: glyph ? Math.round(glyph.getBoundingClientRect().width * 100) / 100 : 0,
        whole: name.scrollWidth <= name.clientWidth + 0.5,
        held: badge.scrollWidth <= badge.clientWidth + 0.5,
      };
    });
  const widths = [];
  for (const width of ['', '152px', '122px']) {
    await garden.evaluate((card, w) => (card.style.width = w), width);
    await settle(page, 300);
    widths.push(await pill());
  }
  check(
    'a room’s pill fits what it holds as its card’s width moves: its glyph whole where it comes, its name whole',
    widths.map((p) => p.glyph).join() === '0,20,0' && widths.every((p) => p.whole && p.held),
    JSON.stringify(widths),
  );
  await page.close();
}

/* ---------- #159: the name at the photo's top, the readouts on one row ---------- */

/**
 * The photo rooms of the #159 frames as a page draws them: where the pill and the rounds stand on the photo, and the
 * readouts' row — its rows, how its labels are written, its figures, and how many lines run past their column.
 */
const photoRooms = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-frame$="(#159)"] fluvy-room-card')].map((card) => {
      const root = card.shadowRoot;
      const hero = root.querySelector('.rm-hero').getBoundingClientRect();
      const pill = root.querySelector('.am-area__badge').getBoundingClientRect();
      const rounds = [...root.querySelectorAll('.rm-hero .rm-quick .lt-bulb')].map((round) =>
        round.getBoundingClientRect(),
      );
      const last = rounds.at(-1);
      const cells = [...(root.querySelector('.am-area__stats')?.children ?? [])];
      /** What a line draws, from its first part to its last (a label's words, a figure and its unit). */
      const ink = (line) => {
        const parts = [...line.children].filter((part) => !part.classList.contains('fv-sr'));
        if (parts.length)
          return parts.at(-1).getBoundingClientRect().right - parts[0].getBoundingClientRect().left;
        const range = document.createRange();
        range.selectNodeContents(line);
        return range.getBoundingClientRect().width;
      };
      return {
        frame: card.closest('[data-frame]').dataset.frame.split('/')[1],
        width: Math.round(card.getBoundingClientRect().width),
        height: Math.round(card.getBoundingClientRect().height),
        // the pill from the photo's start, its top and its foot
        pill: [pill.left - hero.left, pill.top - hero.top, hero.bottom - pill.bottom].map(
          Math.round,
        ),
        rounds: rounds.length,
        // the last round from the photo's end and its foot
        foot: last ? [hero.right - last.right, hero.bottom - last.bottom].map(Math.round) : [],
        clash: rounds.some(
          (round) =>
            round.left < pill.right &&
            round.right > pill.left &&
            round.top < pill.bottom &&
            round.bottom > pill.top,
        ),
        cells: cells.length,
        rows: new Set(cells.map((cell) => Math.round(cell.getBoundingClientRect().top))).size,
        labels: cells.map((cell) =>
          cell.querySelector('.fv-readout__label--icon')
            ? 'icon'
            : cell.querySelector('.fv-readout__label')
              ? 'word'
              : 'none',
        ),
        figures: cells.map((cell) =>
          cell.querySelector('.fv-readout__value').textContent.replace(/\s+/g, ''),
        ),
        over: cells.filter((cell) =>
          [...cell.querySelectorAll('.fv-readout__label, .fv-readout__value')].some(
            (line) => ink(line) > cell.getBoundingClientRect().width + 0.5,
          ),
        ).length,
      };
    }),
  );
const of = (rooms, title) => rooms.filter((room) => room.frame === title);

{
  // the reporter's phone, in his language: a 328 card in Dutch
  const page = await suite.sheet('rooms', { width: 328, lang: 'nl' });
  await watchNavigation(page);
  const title = 'Room · the reporter’s card at 328 (#159)';
  const [top, before] = of(await photoRooms(page), title);
  check(
    'the name at the top: its pill 20 / 16 from the photo’s corner, four rounds at the foot’s end, none under it',
    top.pill[0] === 20 &&
      top.pill[1] === 16 &&
      top.rounds === 4 &&
      top.foot.join() === '20,12' &&
      !top.clash,
    JSON.stringify(top),
  );
  check(
    'the reporter’s three readouts stand on one row in Dutch at 328, their icons over figures as whole as before',
    top.rows === 1 &&
      top.labels.join() === 'icon,icon,icon' &&
      top.figures.join() === '17,4°C,51%,5van7' &&
      top.over === 0 &&
      top.height === 244,
    JSON.stringify(top),
  );
  check(
    'wrapped, the card is as it was: the name at the foot beside two rounds, the words whole, two and one, 60 taller',
    before.pill[2] === 16 &&
      before.rounds === 2 &&
      before.rows === 2 &&
      before.labels.join() === 'word,word,word' &&
      before.over === 0 &&
      before.height === 304,
    JSON.stringify(before),
  );
  const card = frame(page, title).locator('fluvy-room-card').first();
  await reset(page);
  await card.locator('.rm-hero .rm-quick .lt-bulb').nth(3).click();
  await settle(page, 200);
  const plug = await calls(page);
  check(
    'a round at the foot takes its own tap: the plug goes off, and the room does not open',
    plug.length === 1 && plug[0].s === 'switch.turn_off' && (await navigations(page)).length === 0,
    JSON.stringify(plug),
  );
  await card.locator('.rm-hero').click({ position: { x: 60, y: 34 } });
  await settle(page, 200);
  const went = await navigations(page);
  check(
    'a tap on the name at the top opens the room, as the photo does',
    went.join() === '/fluvy-auto/room-rm_living',
    went.join(' '),
  );
  await page.close();
}
{
  // half a phone's section (152): the foot holds two rounds the name left no room for; three readouts are two and one
  const page = await suite.sheet('rooms', { width: 320 });
  const rooms = await photoRooms(page);
  const [named, long, beside] = of(rooms, 'Room · the name at the top in half a section (#159)');
  check(
    'in half a section the name at the top gives the foot two rounds, where beside the name it holds none',
    named.rounds === 2 && !named.clash && long.rounds === 2 && !long.clash && beside.rounds === 0,
    `${named.rounds} ${long.rounds} ${beside.rounds}`,
  );
  const [three, two] = of(rooms, 'Room · readouts on one row in half a section (#159)');
  check(
    'there three readouts stand two and one with their icons and short units, two keep their row, nothing past its column',
    three.rows === 2 &&
      three.figures.join() === '17.4°,51%,5/7' &&
      two.rows === 1 &&
      rooms.every((room) => room.over === 0),
    JSON.stringify([three, two]),
  );
  const [, icons, none] = of(rooms, 'Room · a reading out of reach on the row (#159)');
  check(
    'a reading out of reach keeps its row: a dash, the same rows and the same height as the card that reads',
    icons.figures[0] === '—' &&
      icons.rows === three.rows &&
      icons.height === three.height &&
      none.labels.join() === 'none,none,none',
    JSON.stringify([icons, none]),
  );
  await page.close();
}

/* ---------- the room at 211, every language: its tile head, its hint and its readouts' row ---------- */
{
  const languages = await everyLanguage();
  const heads = [];
  const hints = [];
  const rows = [];
  for (const lang of languages) {
    const page = await suite.sheet('rooms', { width: 211, lang });
    const found = await page.evaluate(() =>
      [...document.querySelectorAll('fluvy-room-card')].map((card) => {
        const root = card.shadowRoot;
        const name = root.querySelector('.fv-card__head .fv-card__title');
        const hint = root.querySelector('.fv-empty-state__hint');
        return {
          frame: card.closest('[data-frame]').dataset.frame.split('/')[1],
          name: name?.textContent.trim(),
          cut: name ? name.scrollWidth > name.clientWidth + 0.5 : false,
          circle: Boolean(root.querySelector('.fv-card__head .fv-ico')),
          hint: hint?.textContent.trim(),
          lines: hint
            ? Math.round(
                hint.getBoundingClientRect().height / parseFloat(getComputedStyle(hint).lineHeight),
              )
            : 0,
        };
      }),
    );
    for (const card of found) {
      // a name cut beside its circle: the circle had to give way first
      if (card.cut && card.circle) heads.push(`${lang} "${card.name}" cut beside its circle`);
      // the hint says its count, wherever the language puts it ("2 hidden…", "…エンティティ2件")
      if (card.hint !== undefined && (card.lines > 3 || !/\b2\b/.test(card.hint)))
        hints.push(`${lang} ${card.lines} lines: "${card.hint}"`);
    }
    if (lang === 'en' || lang === 'de')
      for (const name of ['Living room', 'Wohnzimmer', 'Storeroom'])
        if (!found.some((card) => card.name === name && !card.cut && !card.circle))
          heads.push(`${lang} "${name}" not whole without its circle`);
    // #159, the cards that span the 211: three readouts on one row whatever the language's words, nothing past its
    // column, and with the name at the top three rounds at the foot
    for (const room of (await photoRooms(page)).filter((each) => each.width === 211)) {
      if (room.over) rows.push(`${lang} "${room.frame}" ${room.over} past their column`);
      if (room.frame === 'Room · readouts on one row (#159)' && room.rows !== 1)
        rows.push(`${lang} ${room.cells} readouts on ${room.rows} rows`);
      if (room.frame === 'Room · the name at the top (#159)' && room.cells === 3 && room.clash)
        rows.push(`${lang} a round under the pill`);
    }
    await page.close();
  }
  check(
    `at 211 a photo’s readouts stand on one row, none past its column, in ${languages.length} languages`,
    rows.length === 0,
    rows.slice(0, 6).join(' · '),
  );
  check(
    'at 211 a tile head gives its circle to a name that would be cut: "Living room", "Wohnzimmer", "Storeroom" whole',
    heads.length === 0,
    heads.slice(0, 6).join(' · '),
  );
  check(
    `at 211 an administrator’s hint keeps its why in three lines at most, in ${languages.length} languages`,
    hints.length === 0,
    hints.slice(0, 6).join(' · '),
  );
}

/* ---------- the map ---------- */
{
  const page = await suite.sheet('ambient');
  const zones = frame(page, 'Map · zones').locator('fluvy-map-card').first();
  const labels = await zones.locator('.mp-zone__label').allTextContents();
  const faces = await zones
    .locator('.mp-zone')
    .evaluateAll((columns) =>
      columns.map((column) => column.querySelectorAll('.mp-face:not(.mp-more)').length),
    );
  check(
    'the zones as columns: home, the zone Ona is in, away, and unknown for Noa — two faces at home, one elsewhere',
    labels.map((l) => l.trim().toLowerCase()).join(',') === 'home,school,away,unknown' &&
      faces.join(',') === '2,1,1,1' &&
      (await zones.locator('.mp-more').count()) === 0,
    `${labels.join(',')} · ${faces.join(',')}`,
  );
  const rows = frame(page, 'Map · rows').locator('fluvy-map-card').first();
  const words = await rows.locator('.fv-row__value').allTextContents();
  check(
    'the rows say where each person is, and how far only for someone away with a fix',
    words.length === 5 &&
      words[0].trim() === 'Home' &&
      words[1].trim() === 'School' &&
      /^Away · \d+(\.\d)? km$/.test(words[2].trim()) &&
      words[3].trim() === 'Unknown' &&
      words[4].trim() === 'Unknown',
    words.join(' | '),
  );
  const map = frame(page, 'Map · map').locator('fluvy-map-card').first();
  await settle(page, 400);
  check(
    "Home Assistant's map cannot be made here: the zones stand in, silently",
    (await map.locator('.mp-zones').count()) === 1 &&
      (await map.locator('.mp-plate').count()) === 0,
  );
  const chosen = frame(page, 'Map · chosen zones, empty ones kept')
    .locator('fluvy-map-card')
    .first();
  const chosenLabels = await chosen.locator('.mp-zone__label').allTextContents();
  check(
    'the zones asked for, in that order and by the names given, the empty one kept',
    chosenLabels.map((l) => l.trim().toLowerCase()).join(',') === 'home,office,school',
    chosenLabels.join(','),
  );
  await page.close();
}

await suite.finish();
