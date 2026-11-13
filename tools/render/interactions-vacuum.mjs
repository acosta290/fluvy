#!/usr/bin/env node
/**
 * Interaction tests for the Vacuum card's drive pad (#178) on the playground's `vacuum` sheet: Drive starts the
 * robot's remote control and gives the battery's and the suction's room to the pad, the card exactly as tall as it
 * was; a tap on an arrow is one step, an arrow held repeats and stops the robot as it is let go, Stop stops it; the
 * keyboard's arrows drive from the moment Drive is pressed, and Escape is Done; Done ends remote control and the card
 * is as it was; a command that sends the robot home ends it first; ten seconds without a press end it; the compact
 * card drives from its sheet, which Escape closes; a robot of the person's own calls is driven by them; one with no
 * remote control gains no command, one out of reach a still one. Real cards on the playground's simulated hass. Exit
 * code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-vacuum.mjs
 */
import { calls, frame, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** A frame's card (its `n`th), the cell of its commands by name, its pad and the pad's arrows by name. */
const cardOf = (page, title, n = 0) => frame(page, title).locator('fluvy-vacuum-card').nth(n);
const cell = (card, label) => card.locator(`.fv-action[aria-label="${label}"]`);
const padOf = (card) => card.locator('fluvy-drive-pad');
const arrow = (within, label) => within.locator(`.fv-ring__arrow[aria-label="${label}"]`);
const height = (of) => of.evaluate((el) => el.getBoundingClientRect().height);
const said = async (page) => (await calls(page)).map((c) => c.s);
const moves = async (page) =>
  (await calls(page))
    .filter((c) => c.s === 'xiaomi_miio.vacuum_remote_control_move')
    .map((c) => `${c.d.velocity}/${c.d.rotation}`);

/* ---------- the mode: the card's size, the pad's place, the calls ---------- */
{
  // a phone's column: the card 360, its suction on one row
  const page = await suite.sheet('vacuum', { width: 392 });
  const card = cardOf(page, 'Drive');
  const before = await height(card);
  check(
    'a robot that can be driven gains Drive, last of its row',
    (await card.locator('.fv-action').last().getAttribute('aria-label')) === 'Drive',
  );
  await reset(page);
  await cell(card, 'Drive').click();
  await padOf(card).waitFor();
  await settle(page, 300);
  const pad = padOf(card);
  const driving = await height(card);
  check(
    'driven, the card is exactly as tall as it was',
    driving === before,
    `${before} ${driving}`,
  );
  check(
    '…and as tall as the frame that holds the mode',
    (await height(cardOf(page, 'Drive · driving'))) === before,
  );
  const ring = await pad.locator('.dp-ring').boundingBox();
  const head = await card.locator('.fv-card__head').boundingBox();
  const row = await card.locator('.fv-actions').boundingBox();
  const box = await card.boundingBox();
  check(
    'the pad is the remote’s 176 ring, centred, 20 under the head and 20 over the commands',
    ring.width === 176 &&
      ring.height === 176 &&
      Math.round(ring.x - box.x) === Math.round(box.x + box.width - ring.x - ring.width) &&
      Math.round(ring.y - head.y - head.height) === 20 &&
      Math.round(row.y - ring.y - ring.height) === 20,
    JSON.stringify({
      size: [ring.width, ring.height],
      above: ring.y - head.y - head.height,
      below: row.y - ring.y - ring.height,
    }),
  );
  check(
    'Done is the row’s one filled cell, where Drive stood',
    (await card.locator('.fv-action--accent').count()) === 1 &&
      (await card.locator('.fv-action').last().getAttribute('aria-label')) === 'Done',
  );
  check(
    'Drive starts the robot’s remote control, once',
    (await said(page)).join() === 'xiaomi_miio.vacuum_remote_control_start',
    (await said(page)).join(),
  );

  /* a tap: one step, and no stop after it */
  await reset(page);
  await arrow(pad, 'Left').click();
  await settle(page, 700);
  check(
    'a tap on an arrow is one step',
    (await moves(page)).join() === '0/60',
    (await moves(page)).join(),
  );

  /* a hold: the moves repeat, and letting go stops the robot */
  await reset(page);
  const forward = await arrow(pad, 'Forward').boundingBox();
  await page.mouse.move(forward.x + 22, forward.y + 22);
  await page.mouse.down();
  await page.waitForTimeout(1500);
  check('a held arrow lights its quadrant', (await pad.locator('.fv-ring__wedge').count()) === 1);
  await page.mouse.up();
  await settle(page, 300);
  const held = await moves(page);
  check(
    'an arrow held repeats, and stops the robot as it is let go',
    held.length >= 4 && held.slice(0, -1).every((m) => m === '0.19/0') && held.at(-1) === '0/0',
    held.join(' '),
  );
  await settle(page, 900);
  check('…and nothing moves after', (await moves(page)).length === held.length);

  /* Stop, and the keyboard */
  await reset(page);
  await pad.locator('.fv-ring__mid').click();
  await arrow(pad, 'Back').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await settle(page, 300);
  check(
    'Stop stops the robot; an arrow key is one step, Enter the focused arrow’s',
    (await moves(page)).join(' ') === '0/0 0/-60 -0.19/0',
    (await moves(page)).join(' '),
  );

  /* Done */
  await reset(page);
  await cell(card, 'Done').click();
  await settle(page, 300);
  check(
    'Done stops remote control, and the card is as it was',
    (await said(page)).join() === 'xiaomi_miio.vacuum_remote_control_stop' &&
      (await padOf(card).count()) === 0 &&
      (await height(card)) === before &&
      (await card.locator('.fv-action').last().getAttribute('aria-label')) === 'Drive',
    (await said(page)).join(),
  );

  /* a robot sent home is driven no more: remote control ends first */
  await page.evaluate(() => window.fluvyMock.set('vacuum.dr_robot', 'idle'));
  await settle(page, 200);
  await cell(card, 'Drive').click();
  await padOf(card).waitFor();
  await reset(page);
  await cell(card, 'Return to dock').click();
  await settle(page, 300);
  check(
    'Return to dock ends remote control first, then goes',
    (await said(page)).join() === 'xiaomi_miio.vacuum_remote_control_stop,vacuum.return_to_base' &&
      (await padOf(card).count()) === 0,
    (await said(page)).join(),
  );
  await page.close();
}

/* ---------- the keyboard: Drive, the arrows, Escape ---------- */
{
  const page = await suite.sheet('vacuum', { width: 392 });
  const card = cardOf(page, 'Drive');
  /** What has the focus, through every shadow root: its name. */
  const focused = () =>
    page.evaluate(() => {
      let label = '';
      for (let at = document.activeElement; at; at = at.shadowRoot?.activeElement)
        label = at.getAttribute('aria-label') ?? label;
      return label;
    });
  await cell(card, 'Drive').focus();
  await reset(page);
  await page.keyboard.press('Enter');
  await padOf(card).waitFor();
  await settle(page, 300);
  check('Drive hands the focus to the pad’s Stop', (await focused()) === 'Stop', await focused());
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(1100);
  await page.keyboard.up('ArrowUp');
  await settle(page, 200);
  const held = await moves(page);
  check(
    'an arrow key held drives as a finger does, and stops the robot as it is let go',
    held.length >= 3 && held.slice(0, -1).every((m) => m === '0.19/0') && held.at(-1) === '0/0',
    held.join(' '),
  );
  await page.keyboard.press('Escape');
  await settle(page, 300);
  check(
    'Escape is Done, and the focus is back on Drive',
    (await padOf(card).count()) === 0 &&
      (await focused()) === 'Drive' &&
      (await said(page)).at(-1) === 'xiaomi_miio.vacuum_remote_control_stop',
    `${await focused()} · ${(await said(page)).at(-1)}`,
  );
  await page.close();
}

/* ---------- ten seconds without a press ---------- */
{
  const page = await suite.sheet('vacuum', { clock: true });
  const card = cardOf(page, 'Drive');
  await cell(card, 'Drive').click();
  await padOf(card).waitFor();
  await reset(page);
  await page.clock.runFor(9000);
  const still = await padOf(card).count();
  await page.clock.runFor(1500);
  check(
    'ten seconds without a press end remote control by themselves',
    still === 1 &&
      (await padOf(card).count()) === 0 &&
      (await said(page)).join() === 'xiaomi_miio.vacuum_remote_control_stop',
    (await said(page)).join(),
  );
  await page.close();
}

/* ---------- the compact card: the pad in its sheet ---------- */
{
  const page = await suite.sheet('vacuum', { width: 392 });
  const card = cardOf(page, 'Drive · compact');
  await reset(page);
  await cell(card, 'Drive').click();
  const sheet = card.locator('fluvy-drive-sheet');
  await sheet.locator('dialog[open]').waitFor();
  await settle(page, 500);
  check(
    'a compact card opens its pad in a sheet, the card as it was under it',
    (await padOf(card).count()) === 1 && (await card.locator('.is-driving').count()) === 0,
  );
  const ring = await sheet.locator('.dp-ring').boundingBox();
  check('the sheet’s ring is the 176', ring.width === 176 && ring.height === 176);
  check(
    'the sheet opens with the focus on the pad’s Stop',
    await page.evaluate(() => {
      let at = document.activeElement;
      while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
      return at?.classList.contains('fv-ring__mid') ?? false;
    }),
  );
  await arrow(sheet, 'Forward').click();
  await settle(page, 200);
  await page.keyboard.press('Escape');
  await settle(page, 500);
  check(
    'the sheet drives the robot, and Escape closes it and stops remote control',
    (await said(page)).join() ===
      'xiaomi_miio.vacuum_remote_control_start,xiaomi_miio.vacuum_remote_control_move,xiaomi_miio.vacuum_remote_control_stop' &&
      (await card.locator('fluvy-drive-sheet').count()) === 0,
    (await said(page)).join(),
  );
  await page.close();
}

/* ---------- a robot's own calls; no remote control; out of reach ---------- */
{
  const page = await suite.sheet('vacuum');
  const own = cardOf(page, 'Drive · a robot’s own calls');
  await reset(page);
  await cell(own, 'Drive').click();
  await padOf(own).waitFor();
  await arrow(padOf(own), 'Forward').click();
  await arrow(padOf(own), 'Right').click();
  await cell(own, 'Done').click();
  await settle(page, 300);
  const c = await calls(page);
  check(
    'a robot of the person’s own calls is driven by them, the speed and the turn as numbers',
    c.map((x) => x.s).join() === 'script.robot_drive,script.robot_drive,script.robot_park' &&
      JSON.stringify(c.slice(0, 2).map((x) => x.d)) ===
        JSON.stringify([
          { velocity: 0.2, rotation: 0 },
          { velocity: 0, rotation: -45 },
        ]),
    JSON.stringify(c.map((x) => [x.s, x.d])),
  );
  check(
    'a robot whose integration has no remote control gains no command',
    (await cell(cardOf(page, 'Drive · no remote control'), 'Drive').count()) === 0,
  );
  const gone = cardOf(page, 'Drive · unavailable');
  await reset(page);
  await cell(gone, 'Drive').click({ force: true });
  await settle(page, 300);
  check(
    'out of reach the command stays, still',
    (await cell(gone, 'Drive').isDisabled()) && (await calls(page)).length === 0,
  );
  check(
    'a card with no room for the ring is driven from its sheet: its parts stay',
    (await cardOf(page, 'Drive · driving · no room in the card').locator('.is-driving').count()) ===
      0,
  );
  await page.close();
}

await suite.finish();
