#!/usr/bin/env node
/**
 * Colour per card, in a real Chromium against the playground's `colours` sheet. Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5183/ node interactions-colours.mjs
 * What it proves: a card's `color` becomes its accent — six charts in six colours, each line the computed accent
 * of its own card, all distinct, each at least 3:1 on the card; a card without a colour keeps the palette's; a red
 * card's lit light turns red (the accent's twin) while its fan keeps its tone and its off light stays quiet; the
 * colours are derived again in dark mode and on another palette; a page without the theme derives on Linen, as
 * the theme would.
 */
import { contrastRatio, toHex } from './lib/colour.mjs';
import { frame, startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** A computed custom property on the first child of a card's shadow root (where a card's colour is written). */
const varOf = (card, name) =>
  card.evaluate((el, prop) => {
    const inner = el.shadowRoot?.firstElementChild;
    return inner ? getComputedStyle(inner).getPropertyValue(prop).trim() : '';
  }, name);
const styleOf = (locator, prop) => locator.evaluate((el, p) => getComputedStyle(el)[p], prop);

/* ---------- six charts, six colours ---------- */
{
  const page = await suite.sheet('colours', { width: 412 });
  const cards = frame(page, 'Six colours').locator('fluvy-sensor-card');
  check('six sensor cards', (await cards.count()) === 6);
  const accents = [];
  for (let i = 0; i < 6; i += 1) {
    const card = cards.nth(i);
    const accent = toHex(await varOf(card, '--fluvy-accent'));
    const surface = toHex(await varOf(card, '--fluvy-card'));
    const line = toHex(await styleOf(card.locator('.curve-line').first(), 'stroke'));
    const dot = toHex(await styleOf(card.locator('.curve-dot').first(), 'fill'));
    const ico = toHex(await styleOf(card.locator('.fv-ico').first(), 'color'));
    check(`chart ${i + 1}: the line is the card's accent`, line === accent, `${line} vs ${accent}`);
    check(
      `chart ${i + 1}: the dot and the icon circle too`,
      dot === accent && ico === accent,
      `${dot} ${ico}`,
    );
    check(
      `chart ${i + 1}: readable on the card (≥ 3:1)`,
      accent && surface && contrastRatio(accent, surface) >= 3,
      `${accent} on ${surface}: ${accent && surface ? contrastRatio(accent, surface).toFixed(2) : '?'}`,
    );
    accents.push(accent);
  }
  check('six different accents', new Set(accents).size === 6, accents.join(' '));
  const plain = frame(page, 'No colour').locator('fluvy-sensor-card');
  const palette = toHex(await varOf(plain, '--fluvy-accent'));
  const pageAccent = toHex(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--fluvy-accent'),
    ),
  );
  check(
    'a card without a colour keeps the palette’s accent',
    palette === pageAccent,
    `${palette} vs ${pageAccent}`,
  );
  check(
    'the coloured cards differ from it',
    accents.every((a) => a !== palette),
  );
  // the card reads which palette it wears from the page
  check(
    'the page says which palette it wears',
    (await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--fluvy-palette').trim(),
    )) === 'linen',
  );
  await page.close();
}

/* ---------- a red card: the lit light turns red, the fan keeps its tone ---------- */
{
  const page = await suite.sheet('colours');
  const red = frame(page, 'Red tiles').locator('fluvy-tiles-card');
  const plain = frame(page, 'Plain tiles').locator('fluvy-tiles-card');
  const lightFill = toHex(await varOf(red, '--fluvy-state-light-active-fill'));
  const plainLightFill = toHex(await varOf(plain, '--fluvy-state-light-active-fill'));
  const redLamp = red.locator('.fv-tile--light.is-on').first();
  const plainLamp = plain.locator('.fv-tile--light.is-on').first();
  check(
    'the red card’s lit light fills with its own colour',
    toHex(await styleOf(redLamp, 'backgroundColor')) === lightFill && lightFill !== plainLightFill,
    `${lightFill} vs ${plainLightFill}`,
  );
  check(
    'the plain card’s lit light keeps the palette’s',
    toHex(await styleOf(plainLamp, 'backgroundColor')) === plainLightFill,
  );
  const redFan = red.locator('.fv-tile--fan.is-on').first();
  const plainFan = plain.locator('.fv-tile--fan.is-on').first();
  const fanFill = toHex(await styleOf(redFan, 'backgroundColor'));
  check(
    'a fan that is on has a fill of its own tone',
    fanFill !== null && fanFill !== toHex(await varOf(red, '--fluvy-card')),
    `${fanFill}`,
  );
  check(
    'the fan’s tone is not the card’s colour',
    fanFill === toHex(await styleOf(plainFan, 'backgroundColor')) && fanFill !== lightFill,
  );
  const off = red.locator('.fv-tile--light:not(.is-on)').first();
  check('an off light stays quiet', toHex(await styleOf(off, 'backgroundColor')) !== lightFill);
  await page.close();
}

/* ---------- a tile's own colour ---------- */
{
  const page = await suite.sheet('colours');
  const group = frame(page, 'Tiles with their own colours').locator('fluvy-tiles-card');
  const coloured = group.locator('[data-accent]');
  check('a tile with a colour carries it as data-accent', (await coloured.count()) === 2);
  // a colour without a tone is the accent: the coloured lamp and speaker are accent tiles in their own colours
  const lamp = coloured.nth(0);
  const speaker = coloured.nth(1);
  const ownFill = (tile) =>
    tile.evaluate((el) => getComputedStyle(el).getPropertyValue('--fluvy-accent-fill').trim());
  const groupFill = toHex(await varOf(group, '--fluvy-accent-fill'));
  for (const [name, tile] of [
    ['lamp', lamp],
    ['speaker', speaker],
  ]) {
    const fill = toHex(await styleOf(tile, 'backgroundColor'));
    check(
      `the ${name} is drawn in its own colour (an accent tile, filled with its own accent fill)`,
      (await tile.evaluate(
        (el) => el.classList.contains('fv-tile--accent') && el.classList.contains('is-on'),
      )) &&
        fill === toHex(await ownFill(tile)) &&
        fill !== groupFill,
      `${fill} vs group ${groupFill}`,
    );
  }
  check('the two colours differ', (await ownFill(lamp)) !== (await ownFill(speaker)));
  const fan = group.locator('.fv-tile--fan.is-on').first();
  check(
    'the fan keeps its tone',
    toHex(await styleOf(fan, 'backgroundColor')) ===
      toHex(await varOf(group, '--fluvy-state-climate-fan-fill')),
  );
  await page.close();
}

/* ---------- a status under a colour ---------- */
{
  const page = await suite.sheet('colours');
  const tile = await frame(page, 'A status under a colour')
    .locator('fluvy-tiles-card .fv-tile')
    .first()
    .evaluate((el) => [...el.classList].filter((c) => /^fv-tile--|^is-/.test(c)));
  const rows = await frame(page, 'A status under a colour')
    .locator('fluvy-entities-card .fv-row .fv-ico')
    .evaluateAll((els) => els.map((el) => [...el.classList].find((c) => /^fv-ico--/.test(c))));
  check(
    'an open window stays the warning’s under a colour (tile and row); a tone asked for by name is honoured',
    tile.includes('fv-tile--warning') &&
      tile.includes('is-on') &&
      rows[0] === 'fv-ico--warning' &&
      rows[1] === 'fv-ico--accent',
    JSON.stringify({ tile, rows }),
  );
  await page.close();
}

/* ---------- derived again: dark mode, another palette, no theme ---------- */
{
  const light = await suite.sheet('colours', { width: 412 });
  const dark = await suite.sheet('colours', { width: 412, extra: '&mode=dark' });
  const volt = await suite.sheet('colours', { width: 412, extra: '&palette=volt' });
  const off = await suite.sheet('colours', { width: 412, extra: '&theme=off' });
  const first = (page) => frame(page, 'Six colours').locator('fluvy-sensor-card').first();
  const on = {
    light: toHex(await varOf(first(light), '--fluvy-accent')),
    dark: toHex(await varOf(first(dark), '--fluvy-accent')),
    volt: toHex(await varOf(first(volt), '--fluvy-accent')),
    off: toHex(await varOf(first(off), '--fluvy-accent')),
  };
  check(
    'dark mode derives the colour again',
    on.dark !== on.light && on.dark !== null,
    JSON.stringify(on),
  );
  check('another palette derives it again', on.volt !== on.light && on.volt !== null);
  check('a page without the theme derives on Linen, as the theme would', on.off === on.light);
  const darkLine = toHex(await styleOf(first(dark).locator('.curve-line').first(), 'stroke'));
  check('the dark line is the dark accent', darkLine === on.dark);
  const darkCard = toHex(await varOf(first(dark), '--fluvy-card'));
  check(
    'and readable on the dark card',
    contrastRatio(on.dark, darkCard) >= 3,
    `${on.dark} on ${darkCard}`,
  );
  for (const page of [light, dark, volt, off]) await page.close();
}

/* ---------- tint: an item's colour at rest (the comment on issue #26) ---------- */
for (const mode of ['light', 'dark', 'volt']) {
  const page = await suite.sheet('colours', {
    width: 412,
    extra: mode === 'dark' ? '&mode=dark' : mode === 'volt' ? '&palette=volt' : '',
  });
  const surfaces = (title, card, item) =>
    frame(page, title)
      .locator(card)
      .first()
      .evaluate(
        (el, selector) =>
          [...el.shadowRoot.querySelectorAll(selector)].map((node) => {
            const style = getComputedStyle(node);
            return {
              cls: node.className,
              bg: style.backgroundColor,
              edge: style.boxShadow,
            };
          }),
        item,
      );
  const tiles = await surfaces('Tint · tiles at rest', 'fluvy-tiles-card', '.fv-tile');
  const plain = await surfaces('Plain tiles', 'fluvy-tiles-card', '.fv-tile');
  const lit = tiles[0];
  const rest = tiles[1];
  const plainOff = plain.find((t) => !t.cls.includes('is-on'));
  check(
    `tint (${mode}): a tile with a colour washes it at rest (the wash its words read on), a hairline of it round; on it keeps the full fill, never alike`,
    !lit.cls.includes('is-tinted') &&
      rest.cls.includes('is-tinted') &&
      rest.bg !== plainOff?.bg &&
      rest.bg !== lit.bg &&
      rest.edge !== plainOff?.edge &&
      !plain.some((t) => t.cls.includes('is-tinted')),
    JSON.stringify({ lit: lit.bg, rest: rest.bg, plain: plainOff?.bg }),
  );
  const scenes = await surfaces('Tint · scenes and tabs', 'fluvy-scenes-card', '.am-scene');
  check(
    `tint (${mode}): every scene in its own colour at rest, the last run full`,
    new Set(scenes.map((t) => t.bg)).size === scenes.length &&
      scenes.some((t) => t.cls.includes('is-on')),
    JSON.stringify(scenes.map((t) => t.bg)),
  );
  const pills = await surfaces('Tint · scenes and tabs', 'fluvy-chips-card', '.fv-chip__pill');
  check(
    `tint (${mode}): a tab with a colour washes it at rest; one without stays the card’s`,
    pills.length === 3 && pills[1].bg !== pills[2].bg && pills[0].bg !== pills[1].bg,
    JSON.stringify(pills.map((t) => t.bg)),
  );
  await page.close();
}

await suite.finish();
