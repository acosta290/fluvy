#!/usr/bin/env node
/**
 * A view Home Assistant themed with the theme named Fluvy (#72), on the playground's `?viewtheme=`: the frames' wrapper
 * themed as Home Assistant's `applyThemesOnElement` themes a view, a section or a card's `theme:` (its record, then the
 * shipped `fluvy.yaml`'s variables inline: Linen's colours), the look by the bundle's engine and its watch on the
 * records (`look/themed.ts`). Exit code 1 on any failure.
 *   PLAYGROUND=http://127.0.0.1:5184/ node interactions-view-theme.mjs
 * What it proves: on Volt, light and dark, every card in a Fluvy-themed view reads each variable the theme file wrote as
 * the page around the view reads it (none of Linen's shows through) — in a view with a shadow root of its own (Home
 * Assistant's `hui-view-container`) and in a wrapper without one (a section); a view in another theme (the same file
 * under a name of the person's own) keeps that theme's colours; the mark follows the view's theme as Home Assistant
 * changes it, and the cards follow the palette and the mode as the settings change them, Home Assistant writing nothing
 * again; in the `dashboards` scope the view wears the dashboard's look while the page wears none.
 */
import { startSuite } from './lib/suite.mjs';

const suite = await startSuite();
const { check } = suite;

/** Linen's accent, light and dark: what the theme file writes. */
const LINEN = { light: '#856529', dark: '#cebb9c' };

const open = async (query) => {
  const page = await suite.page(`palette=volt&width=360&${query}`, {
    viewport: { width: 1280, height: 900 },
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  return { page, errors };
};

/**
 * The view and where the look is around it (the page, or in the `dashboards` scope the dashboard it marked), and every
 * card in the view: each variable Home Assistant wrote on the view (but its build key and its own triplets of our
 * colours, which nothing reads) that a card reads otherwise than the look there does.
 */
const read = (page) =>
  page.evaluate(() => {
    const root = document.querySelector('hui-root');
    const view = root ? root.shadowRoot.querySelector('#view') : document.getElementById('stage');
    const panel = root?.hasAttribute('fluvy-look') ? root : null;
    const around = getComputedStyle(panel ?? document.documentElement);
    const names = [...view.style]
      .filter((name) => name.startsWith('--'))
      .filter((name) => name !== '--fluvy-theme-build' && !name.startsWith('--rgb-fluvy-'));
    const cards = [
      ...view.querySelectorAll('.pg-frame > *'),
      ...(root?.querySelectorAll('.pg-frame > *') ?? []),
    ];
    const value = (style, name) => style.getPropertyValue(name).trim();
    const differ = [];
    for (const card of cards) {
      const own = getComputedStyle(card);
      for (const name of names)
        if (value(own, name) !== value(around, name))
          differ.push(`${card.localName} ${name}: ${value(own, name)} ≠ ${value(around, name)}`);
    }
    const first = cards[0] ? getComputedStyle(cards[0]) : around;
    return {
      marked: view.hasAttribute('fluvy-themed'),
      written: view.style.getPropertyValue('--fluvy-accent'),
      names: names.length,
      cards: cards.length,
      differ,
      around: {
        accent: value(around, '--fluvy-accent'),
        palette: value(around, '--fluvy-palette'),
      },
      card: {
        accent: value(first, '--fluvy-accent'),
        surface: value(first, '--fluvy-card'),
        palette: value(first, '--fluvy-palette'),
        theme: value(first, '--fluvy-theme'),
      },
      page: value(getComputedStyle(document.documentElement), '--fluvy-palette'),
    };
  });

/** Every card in the view wears what is around it, and the theme file was written on the view. */
const wearsAround = (s, mode) =>
  s.marked &&
  s.written === LINEN[mode] &&
  s.names > 300 &&
  s.cards > 8 &&
  s.differ.length === 0 &&
  s.card.palette === 'volt' &&
  s.card.accent !== LINEN[mode];
const detail = (s) =>
  JSON.stringify({ ...s, differ: s.differ.slice(0, 4), differing: s.differ.length });

/* ---------- a dashboard's view in the Fluvy theme, light and dark ---------- */
for (const mode of ['light', 'dark']) {
  const { page, errors } = await open(`dashboard=home&viewtheme=Fluvy&mode=${mode}`);
  const s = await read(page);
  check(
    `${mode}: a view in the Fluvy theme (Linen written on it) wears the page's Volt on every card, each variable as around the view`,
    wearsAround(s, mode),
    detail(s),
  );
  check(`${mode}: no page error`, errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ---------- a wrapper without a shadow root of its own (a section) ---------- */
{
  const { page, errors } = await open('sheet=home&viewtheme=Fluvy');
  const s = await read(page);
  check(
    'a section in the Fluvy theme (no shadow root of its own) wears the page’s Volt on every card',
    wearsAround(s, 'light'),
    detail(s),
  );
  check('a section: no page error', errors.length === 0, errors.join(' | '));
  await page.close();
}

/* ---------- another theme, the view's theme changed, the look changed ---------- */
{
  const { page, errors } = await open('dashboard=home&viewtheme=Sandstone');
  let s = await read(page);
  check(
    'a view in another theme (the same file under the person’s own name) keeps its colours: no mark, Linen on its cards',
    !s.marked &&
      s.card.accent === LINEN.light &&
      s.card.palette === 'linen' &&
      s.around.palette === 'volt',
    detail(s),
  );
  /** Home Assistant themes the view again (the person changed its theme), or the settings apply another look. */
  const theme = (name) =>
    page.evaluate(
      (name) =>
        window.fluvyApplyTheme(
          document.querySelector('hui-root').shadowRoot.querySelector('#view'),
          name,
        ),
      name,
    );
  const look = (next) => page.evaluate((next) => window.fluvyLook(next), next);
  await theme('Fluvy');
  s = await read(page);
  check(
    'the view’s theme changed to Fluvy: marked, the page’s Volt on every card',
    wearsAround(s, 'light'),
    detail(s),
  );
  await theme('Sandstone');
  s = await read(page);
  check(
    '…and back to another theme: the mark comes off, its colours return',
    !s.marked && s.card.accent === LINEN.light,
    detail(s),
  );
  await theme(undefined);
  s = await read(page);
  check(
    '…and to none: the page’s look, nothing of a theme left on the view',
    !s.marked && s.names === 0 && s.card.accent === s.around.accent && s.card.palette === 'volt',
    detail(s),
  );
  await theme('Fluvy');
  await look({ look: { palette: 'mint', shape: 'soft', pills: 'round' } });
  s = await read(page);
  check(
    'the palette changed in the settings: the view follows (Mint), Home Assistant writing nothing again',
    s.marked && s.differ.length === 0 && s.card.palette === 'mint' && s.written === LINEN.light,
    detail(s),
  );
  const light = s.card.surface;
  await look({ dark: true });
  s = await read(page);
  check(
    '…and the mode (a wall at night): the view follows to the dark surface, its Linen still the light one Home Assistant wrote',
    s.marked && s.differ.length === 0 && s.card.surface !== light && s.written === LINEN.light,
    detail(s),
  );
  check(
    'the view’s theme and the look changed: no page error',
    errors.length === 0,
    errors.join(' | '),
  );
  await page.close();
}

/* ---------- the dashboards scope: the look on the dashboard alone ---------- */
{
  const { page, errors } = await open(
    'dashboard=home&viewtheme=Fluvy&lookscope=dashboards&theme=off',
  );
  const s = await read(page);
  check(
    'the dashboards scope: the page wears no look, the dashboard’s Fluvy-themed view wears its Volt on every card',
    wearsAround(s, 'light') && s.page !== 'volt',
    detail(s),
  );
  check('the dashboards scope: no page error', errors.length === 0, errors.join(' | '));
  await page.close();
}

await suite.finish();
