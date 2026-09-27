#!/usr/bin/env node
/**
 * Interaction tests for the media cards: media (transport, seek, volume, sources, the clock) and now-playing — the
 * seek bar and volume send once per gesture, bursts coalesce.
 * Real cards on the playground's simulated hass. Exit code 1 on any failure.
 *   node interactions-media.mjs            (expects the playground dev server on :5183)
 */
import { calls, frame, moreInfo, PAGE_INTERVALS, reset, settle, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;
const open = (sheet, options) => suite.sheet(sheet, options);

/* ---------- media: transport, seek, volume, sources, the clock ---------- */
{
  const page = await open('media');
  const card = frame(page, 'Playing').locator('fluvy-media-card');
  const play = card.locator('.md-controls .fv-round').nth(2);
  await play.click();
  check(
    'media: play/pause flips the glyph at once',
    (await play.getAttribute('aria-label')) === 'Play',
  );
  await settle(page, 300);
  let c = await calls(page);
  check(
    '…and sends media_play_pause once',
    c.length === 1 && c[0].s === 'media_player.media_play_pause',
    JSON.stringify(c.map((x) => x.s)),
  );
  await reset(page);
  await card.locator('.md-controls .fv-round').nth(0).click(); // shuffle
  await card.locator('.md-controls .fv-round').nth(1).click(); // prev
  await card.locator('.md-controls .fv-round').nth(3).click(); // next
  await card.locator('.md-controls .fv-round').nth(4).click(); // repeat
  await settle(page, 300);
  c = await calls(page);
  check(
    'media: shuffle · prev · next · repeat each send their service',
    c.map((x) => x.s).join() ===
      'media_player.shuffle_set,media_player.media_previous_track,media_player.media_next_track,media_player.repeat_set' &&
      c[0].d.shuffle === true &&
      c[3].d.repeat === 'all',
    JSON.stringify(c),
  );
  await reset(page);

  // seek: one drag → one media_seek at the release point; the knob never leaves the column
  const seek = card.locator('.md-progress');
  const sb = await seek.boundingBox();
  const sy = sb.y + sb.height / 2;
  await page.mouse.move(sb.x + sb.width * 0.3, sy);
  await page.mouse.down();
  await page.mouse.move(sb.x + sb.width * 0.5, sy, { steps: 6 });
  await page.mouse.move(sb.x + sb.width * 0.75, sy, { steps: 6 });
  const during = await seek.locator('.fv-knob').boundingBox();
  await page.mouse.up();
  await settle(page, 200);
  c = await calls(page);
  const target = Math.round(0.75 * 222);
  check(
    'media: a seek drag sends one media_seek at the release point',
    c.length === 1 &&
      c[0].s === 'media_player.media_seek' &&
      Math.abs(c[0].d.seek_position - target) <= 2,
    JSON.stringify(c.map((x) => x.d)),
  );
  check(
    '…and the knob followed the finger while dragging',
    Math.abs(during.x + during.width / 2 - (sb.x + sb.width * 0.75)) < 3,
    `knob at ${(during.x + during.width / 2 - sb.x).toFixed(1)} of ${sb.width}`,
  );
  await reset(page);
  await page.mouse.move(sb.x + sb.width * 0.2, sy);
  await page.mouse.down();
  await page.mouse.move(sb.x, sy, { steps: 6 });
  await page.mouse.move(sb.x - 60, sy, { steps: 6 });
  const atStart = await seek.locator('.fv-knob').boundingBox();
  await page.mouse.up();
  await settle(page, 200);
  check(
    'media: at the start the seek knob stays flush with the column (4 px overhang, not half outside)',
    atStart.x >= sb.x - 4.5 && atStart.x <= sb.x - 3,
    `left overhang ${(sb.x - atStart.x).toFixed(1)} px`,
  );
  await reset(page);
  await seek.focus();
  await page.keyboard.press('ArrowRight');
  await settle(page, 200);
  c = await calls(page);
  check(
    'media: the keyboard seeks by 10 s',
    c.length === 1 && c[0].s === 'media_player.media_seek' && c[0].d.seek_position === 10,
    JSON.stringify(c.map((x) => x.d)),
  );
  await reset(page);

  const vol = card.locator('.md-volume fluvy-ruler .fv-ruler');
  const vb = await vol.boundingBox();
  await page.mouse.click(vb.x + vb.width * 0.5, vb.y + vb.height / 2);
  await settle(page, 200);
  c = await calls(page);
  check(
    'media: the volume ruler sends volume_set as a 0–1 level, once',
    c.length === 1 &&
      c[0].s === 'media_player.volume_set' &&
      Math.abs(c[0].d.volume_level - 0.5) <= 0.02,
    JSON.stringify(c.map((x) => x.d)),
  );
  await reset(page);
  await card.locator('.md-volume .fv-round').click();
  await settle(page, 300);
  c = await calls(page);
  check(
    'media: mute sends volume_mute true',
    c.length === 1 && c[0].s === 'media_player.volume_mute' && c[0].d.is_volume_muted === true,
    JSON.stringify(c),
  );
  await reset(page);

  const tv = frame(page, 'TV · sources').locator('fluvy-media-card');
  await tv.locator('.fv-chip').nth(1).click();
  await settle(page, 300);
  c = await calls(page);
  check(
    'media: a source chip sends select_source',
    c.length === 1 && c[0].s === 'media_player.select_source' && c[0].d.source === 'Netflix',
    JSON.stringify(c),
  );
  await reset(page);

  const mini = frame(page, 'Mini').locator('fluvy-media-card').first();
  await mini.locator('.fv-round').first().click();
  await settle(page, 300);
  c = await calls(page);
  check(
    'media: the mini row play/pause sends media_play_pause',
    c.length === 1 && c[0].s === 'media_player.media_play_pause',
    JSON.stringify(c.map((x) => x.s)),
  );
  await reset(page);

  // the position clock: only playing cards tick; a removed card leaves no interval behind
  const before = await page.evaluate(() => window.__intervals());
  await page.evaluate(() => {
    document.querySelectorAll('fluvy-media-card').forEach((el) => el.remove());
  });
  await settle(page, 200);
  const after = await page.evaluate(() => window.__intervals());
  check(
    'media: removing every media card releases every interval',
    before > 0 && after === PAGE_INTERVALS,
    `${before} → ${after}`,
  );
  // a hass update after removal (the dashboard still pushes one) must not start a clock nobody stops
  await page.evaluate(() => {
    window.fluvyMock.calls.length = 0;
  });
  await page.evaluate(() =>
    window.fluvyMock
      .hass()
      .callService(
        'media_player',
        'volume_set',
        { volume_level: 0.5 },
        { entity_id: 'media_player.kitchen' },
      ),
  );
  await settle(page, 400);
  check(
    'media: a hass update after removal starts no interval',
    (await page.evaluate(() => window.__intervals())) === PAGE_INTERVALS,
  );
  await page.close();
}

/* ---------- now-playing ---------- */
{
  const page = await open('home-extras');
  const card = frame(page, 'A Home').locator('fluvy-now-playing-card');
  const rounds = card.locator('.hm-transport .fv-round');
  await rounds.nth(1).click();
  check(
    'now-playing: play/pause flips at once',
    (await rounds.nth(1).getAttribute('aria-label')) === 'Play',
  );
  await settle(page, 300);
  let c = await calls(page);
  check(
    '…and sends one media_play_pause',
    c.length === 1 && c[0].s === 'media_player.media_play_pause',
    JSON.stringify(c.map((x) => x.s)),
  );
  await reset(page);
  await rounds.nth(0).click();
  await rounds.nth(2).click();
  await settle(page, 300);
  c = await calls(page);
  check(
    'now-playing: previous and next send their services',
    c.map((x) => x.s).join() === 'media_player.media_previous_track,media_player.media_next_track',
    JSON.stringify(c.map((x) => x.s)),
  );
  await reset(page);
  await rounds.nth(3).click();
  check(
    'now-playing: the volume round opens more-info, no service',
    (await moreInfo(page)).join() === 'media_player.kitchen_speaker' &&
      (await calls(page)).length === 0,
  );
  const radio = frame(page, 'F Player').locator('fluvy-now-playing-card').nth(1);
  check(
    'now-playing: unsupported previous / next are disabled',
    (await radio.locator('.hm-transport .fv-round').nth(0).isDisabled()) &&
      (await radio.locator('.hm-transport .fv-round').nth(2).isDisabled()),
  );
  const before = await page.evaluate(() => window.__intervals());
  await page.evaluate(() => {
    document.querySelectorAll('fluvy-now-playing-card').forEach((el) => el.remove());
  });
  await settle(page, 200);
  check(
    'now-playing: removing the cards releases their clocks',
    before > 0 && (await page.evaluate(() => window.__intervals())) === PAGE_INTERVALS,
    `${before} → ${await page.evaluate(() => window.__intervals())}`,
  );
  await page.close();
}

await suite.finish();
