#!/usr/bin/env node
/**
 * Interaction tests for the Slider card (#77) on the playground's `slider-card` sheet: a drag lands on its value and
 * sends it once, on release (`media_player.volume_set`, `fan.set_percentage` on the fan's floor); while dragging only
 * where `live_update` asks; the keyboard walks a number's steps (`number.set_value`), a burst of taps on the stepper is
 * one call (`input_number.set_value`); the mute round mutes at once (`media_player.volume_mute`); the head's switch
 * flips another entity (`toggle_entity`); the tile card and a tile of the card set a player's volume and a number on
 * their foot's ruler, and in half a section (156, 172) a number's tile says its figure, its room giving way, in en, de
 * and ja; out of reach nothing answers; the heights are the light card's at a 360 column.
 * Real cards on the playground's simulated hass. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-slider.mjs
 */
import { dragTo, mousePointer, rulerGeometry } from './lib/gestures.mjs';
import { calls, frame, reset, settle, startSuite, taps } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;
const page = await suite.sheet('slider-card');
const pointer = mousePointer(page);

/** The card of a frame (its `n`th), by its tag. */
const card = (title, n = 0, tag = 'fluvy-slider-card') => frame(page, title).locator(tag).nth(n);
/** A card's ruler and its geometry. */
const ruler = async (of) => {
  const box = of.locator('fluvy-ruler .fv-ruler').first();
  await box.scrollIntoViewIfNeeded();
  return rulerGeometry(box, of.locator('fluvy-ruler .fv-knob').first());
};
const said = (of, selector) =>
  of.evaluate((el, sel) => el.shadowRoot.querySelector(sel)?.textContent?.trim() ?? '', selector);
const height = (of) => of.evaluate((el) => Math.round(el.getBoundingClientRect().height));

/* ---------- the heights: the light card's, by the config alone ---------- */
{
  const drawn = [
    await height(card('Volume · full')),
    await height(card('Volume · compact')),
    await height(card('Volume · tiles')),
    await height(card('Out of reach · full')),
    await height(card('Out of reach · compact')),
  ];
  check(
    'full 268, compact 188, the tile 168 — out of reach the same',
    drawn.join(' ') === '268 188 168 268 188',
    drawn.join(' '),
  );
}

/* ---------- a drag: the value lands where the finger leaves it, sent once ---------- */
{
  await reset(page);
  const soundbar = card('Volume · full');
  const geo = await ruler(soundbar);
  await dragTo(pointer, geo, { from: 30, via: 60, to: 97 });
  await settle(page, 120);
  const sent = await calls(page);
  check(
    'a drag sends the volume once, on release: media_player.volume_set 0.97',
    sent.length === 1 &&
      sent[0].s === 'media_player.volume_set' &&
      Math.abs(sent[0].d.volume_level - 0.97) < 1e-9,
    JSON.stringify(sent),
  );
  check(
    'the big figure says what the finger set before the player answers',
    (await said(soundbar, '.fv-readout--l .fv-readout__value span')) === '97',
  );
  await settle(page, 600);
}

/* ---------- live update: sent while the finger moves ---------- */
{
  await reset(page);
  const kitchen = card('Volume · live update');
  const geo = await ruler(kitchen);
  await pointer.move(geo.at(45), geo.y);
  await pointer.down();
  await pointer.move(geo.at(60), geo.y, 8);
  await page.waitForTimeout(250);
  await pointer.move(geo.at(75), geo.y, 8);
  const during = await calls(page);
  await pointer.up();
  await settle(page, 120);
  const after = await calls(page);
  check(
    'live update: the volume is sent while dragging, and once more on release',
    during.length >= 1 &&
      during.every((c) => c.s === 'media_player.volume_set') &&
      after.length > during.length &&
      Math.abs(after.at(-1).d.volume_level - 0.75) < 1e-9,
    `${during.length} while dragging, ${after.length} in all, last ${JSON.stringify(after.at(-1)?.d)}`,
  );
  await settle(page, 600);
}

/* ---------- the keyboard walks a number's steps ---------- */
{
  await reset(page);
  const offset = card('Offset · full');
  const focus = offset.locator('fluvy-ruler .fv-ruler').first();
  await focus.focus();
  await page.keyboard.press('ArrowRight');
  await settle(page, 100);
  const sent = await calls(page);
  check(
    'a key takes a number one step (0.5): number.set_value −0.5',
    sent.length === 1 && sent[0].s === 'number.set_value' && sent[0].d.value === -0.5,
    JSON.stringify(sent),
  );
  check(
    'its figure with the typographic minus',
    (await said(offset, '.fv-readout--l .fv-readout__value')).replace(/\s+/g, '') === '−0.5°C',
  );
  const words = await offset.evaluate((el) =>
    [...el.shadowRoot.querySelectorAll('.fv-ruler-labels span')].map((s) => s.textContent),
  );
  check(
    'its words signed and brief: −2 −1 0 +1 +2',
    words.join(' ') === '−2 −1 0 +1 +2',
    words.join(' '),
  );
  await settle(page, 600);
}

/* ---------- the stepper: a burst of taps is one call ---------- */
{
  await reset(page);
  const pump = card('Pool pump · full');
  const plus = pump.locator('.fv-stepper__half').nth(1);
  await plus.scrollIntoViewIfNeeded();
  await taps(plus, 3);
  const early = await calls(page);
  await settle(page, 900);
  const sent = await calls(page);
  check(
    'three taps on + (a step of 5) are one call once they stop: input_number.set_value 80',
    early.length === 0 &&
      sent.length === 1 &&
      sent[0].s === 'input_number.set_value' &&
      sent[0].d.value === 80,
    JSON.stringify(sent),
  );
  await settle(page, 600);
}

/* ---------- the head: mute, and another entity's switch ---------- */
{
  await reset(page);
  const soundbar = card('Volume · compact');
  const round = soundbar.locator('.fv-card__head .fv-round');
  await round.click();
  const sent = await calls(page);
  check(
    'the mute round mutes: media_player.volume_mute true',
    sent.length === 1 &&
      sent[0].s === 'media_player.volume_mute' &&
      sent[0].d.is_volume_muted === true,
    JSON.stringify(sent),
  );
  check(
    'and says so at once: Unmute',
    (await round.getAttribute('aria-label')) === 'Unmute',
    await round.getAttribute('aria-label'),
  );
  await round.click();
  await settle(page, 600);

  await reset(page);
  const pump = card('Pool pump · compact');
  await pump.locator('.fv-card__head .fv-switch').click();
  const flipped = await calls(page);
  check(
    'the head’s switch is toggle_entity’s: switch.turn_off on switch.sl_pump',
    flipped.length === 1 &&
      flipped[0].s === 'switch.turn_off' &&
      flipped[0].t?.entity_id === 'switch.sl_pump',
    JSON.stringify(flipped),
  );
  await settle(page, 600);
  await pump.locator('.fv-card__head .fv-switch').click();
  await settle(page, 600);
}

/* ---------- a fan: its speeds' stops, sent on its floor ---------- */
{
  await reset(page);
  const fan = card('Fan · full');
  const geo = await ruler(fan);
  await dragTo(pointer, geo, { from: 66.6, via: 50, to: 33.3 });
  await settle(page, 120);
  const sent = await calls(page);
  check(
    'a drag to Low sends the fan its floor: fan.set_percentage 33',
    sent.length === 1 && sent[0].s === 'fan.set_percentage' && sent[0].d.percentage === 33,
    JSON.stringify(sent),
  );
  await settle(page, 600);
}

/* ---------- the tiles: a tile of the card, and the tile card's own volume and number ---------- */
{
  await reset(page);
  // the muted soundbar's tile: its volume still set while it does not sound
  const tile = card('Volume · tiles', 1);
  const geo = await ruler(tile);
  await dragTo(pointer, geo, { from: 30, via: 40, to: 50 });
  await settle(page, 120);
  let sent = await calls(page);
  check(
    'the card’s tile sets the volume on its foot, muted too: media_player.volume_set 0.5',
    sent.length === 1 &&
      sent[0].s === 'media_player.volume_set' &&
      Math.abs(sent[0].d.volume_level - 0.5) < 1e-9,
    JSON.stringify(sent),
  );
  await settle(page, 600);

  await reset(page);
  const number = card('Tile card · volume and number', 1, 'fluvy-tile-card');
  const focus = number.locator('fluvy-ruler .fv-ruler').first();
  await focus.scrollIntoViewIfNeeded();
  // a step down from where the offset stands now (the keys above moved it)
  const before = Number(await focus.getAttribute('aria-valuenow'));
  await focus.focus();
  await page.keyboard.press('ArrowLeft');
  await settle(page, 100);
  sent = await calls(page);
  check(
    'the tile card sets a number on its foot’s ruler, a step down: number.set_value',
    sent.length === 1 && sent[0].s === 'number.set_value' && sent[0].d.value === before - 0.5,
    `${before} → ${JSON.stringify(sent)}`,
  );
  await settle(page, 600);
}

/* ---------- half a section (156, 172): a number's large tile keeps its figure, its room gives way ---------- */
{
  const FIGURE = { en: '−1.0 °C', de: '−1,0 °C', ja: '−1.0 °C' };
  /** The state lines of a frame's card (its `n`th, by its tag), its tiles' in order. */
  const lines = (at, title, n, tag) =>
    frame(at, title)
      .locator(tag)
      .nth(n)
      .evaluate((el) =>
        [...el.shadowRoot.querySelectorAll('.fv-tile__state')].map((p) => p.textContent.trim()),
      );
  for (const lang of ['en', 'de', 'ja'])
    for (const width of [328, 360]) {
      const at = await suite.sheet('slider-card', { width, lang });
      const [tile] = await lines(at, 'Tile card · volume and number', 1, 'fluvy-tile-card');
      const [own] = await lines(at, 'Offset · tiles', 0, 'fluvy-slider-card');
      const [, pump] = await lines(at, 'Tiles group · volume and number', 0, 'fluvy-tiles-card');
      check(
        `${lang}, tiles of ${(width - 16) / 2}: the tile card’s number and the Slider’s say ${FIGURE[lang]}, the group’s ends in its figure`,
        tile === FIGURE[lang] && own === FIGURE[lang] && /(^| · )65 %$/.test(pump ?? ''),
        `${tile} | ${own} | ${pump}`,
      );
      await at.close();
    }
}

/* ---------- out of reach: nothing answers ---------- */
{
  await reset(page);
  const gone = card('Out of reach · full');
  const state = await gone.evaluate((el) => {
    const root = el.shadowRoot;
    return {
      role: root
        .querySelector('fluvy-ruler')
        ?.shadowRoot?.querySelector('.fv-ruler')
        ?.getAttribute('role'),
      stepper: [...root.querySelectorAll('.fv-stepper__half')].every((b) => b.disabled),
      round: root.querySelector('.fv-card__head .fv-round')?.disabled,
      figure: root.querySelector('.fv-readout__value')?.textContent?.trim(),
    };
  });
  check(
    'out of reach: the ruler a picture, the stepper and the round still, the figure a dash',
    state.role === 'img' && state.stepper && state.round === true && state.figure === '—',
    JSON.stringify(state),
  );
}

await suite.finish();
