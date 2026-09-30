# @fluvy/cards — how a card is built

Every card is one folder: `src/<name>/<name>-card.ts` and its parts; its words are `strings('<name>')` in the file
that says them (the catalogues in `packages/core/src/i18n/locales/`). The approved design sheets are the
specification; a card is that sheet's markup, rendered by Lit, fed by Home Assistant.

## The contract

| Piece | Where | Rule |
| --- | --- | --- |
| Base class | `src/shared/base.ts` → `Card<Config>` | gives `hass`, `config`, `width` / `contentWidth` (measured), `entity(id)`, `stateOf(view)` + `expect(id, state)` (optimistic), `call(domain, service, data, entityId?)`, `tap(entityId?, action?)` and `hold(entityId?, action?)` (the `tap_action` / `hold_action`, more-info by default), `t(key)`, `renderEmpty()`. Implement `renderCard()`; override `prepare()` to validate, `watched()` when you read more than `entity` / `entities`. |
| Config | `src/shared/config.ts` | The shared vocabulary: `subtitle`, `variant`, `columns` (`Columns`, `columnsOf`), `secondary` (`Secondary`), `<x>_style` (`RowStyle`), `show_*`, `hours`, `tone` + `color` on the card and on an item; a bare id or `{ entity, name, icon, tone, color, … }` in a list. An older name is an alias: read, never written — `static aliases: AliasSpec` (`Move`s; `inverted()` for a `hide_*`), applied by the base on `setConfig` so the card only ever sees the newer names. |
| Styles | `static styles = [...(Card.styles as CSSResultGroup[]), sheetStyles.<sheet>, css\`…\`]` | The sheet CSS in `packages/ui/styles/<sheet>.css` is THE design — reuse its classes verbatim. Add local `css` only for fluid overrides (a fixed height the sheet needed, a px width). Never a literal colour: tokens only (`var(--fluvy-*)`, tone variables). |
| Markup | `@fluvy/ui` parts: `head` (`onIconTap` = the tap, `onHold` = a still press on the whole head), `ico`, `badge`, `readout`, `label`, `toggle`, `stepper`, `options`, `chips`, `actions`, `round`, `button`, `listRow`, `barRow`, `stack`, `axis`, `rulerLabels` (given the width, a ruler under 240 keeps three labels), `curve`, `bars`, `clockFace`, `glyph`; controls `<fluvy-ruler>`, `<fluvy-dial>`; `src/shared/`: `chipRow(items, onSelect, style)` for a `<x>_style` row, `secondaryText(hass, view, secondary)` for the line under a row's name | Same class names and structure as `apps/design-lab/<sheet>.js`. Keep the measurer hooks the sheets carry (`data-card` on surfaces, `data-control` / `data-target` on controls, `data-icon`, `data-measure="value"` on value-positioned boxes, `data-align="center"` on deliberately centred text). |
| Width | `this.contentWidth` (card width − 40) | Nothing is drawn at a constant 320: rulers get `.length`, curves get `w`, grids are `minmax(0, 1fr)`. The card must hold from 300 to 520 px wide without clipping or overflow. |
| States | `unavailable`, `unknown`, `missing` are first-class: `stateSkin(view, tone)` in `src/shared/domain.ts` | A card's only entity `missing` → `renderEmpty()`. Otherwise the skin: `unknown` is a live surface in the neutral tone showing `—`; `unavailable` / `missing` wear `is-unavailable is-off` (tone `off`, controls inert) and show `—`. Every attribute may be `null` or absent: read with `view.attr<T | null>()` and check. |
| Numbers | `formatNumber`, `valueParts`, `formatTime`, `formatDate`, `relativeTime` from `@fluvy/core` | Tabular, locale aware; value and unit are separate spans (`readout`). Percent is "46 %". Names may ellipsize, values never. |
| Strings | `this.t('common.on')` for the shared words, `strings('cover')` from `@fluvy/core` for a card's own (the catalogues in `packages/core/src/i18n/locales/`, one per language) | Every language, the same keys, English behind them; `pnpm i18n` checks the catalogues. Entity states come translated from `stateText(hass, view)`. |
| Actions | `this.call(...)`, `toggleEntity`, `this.tap()` | Flip UI first with `this.expect(id, 'on')`, then call. Sliders/dials are already optimistic. Send on release, not per frame. A configured action goes through `this.tap()` / `this.hold()` (`runAction`), which hands one with a `confirmation`, or `assist`, to Home Assistant (`hass-action`): never flip the UI for an action that is to be asked about first. |
| Editor | `static getConfigForm()` with the builders of `src/shared/form.ts` (`entityField`, `textField`, `iconField`, `boolField`, `numberField`, `selectField` — its values must have a word in the catalogue's `option` table —, `toneField`, `actionFields`, `fieldRow`, `formLabels` / `editorLabels`); `static lists` (`RowsListSpec`: a list edited item by item), `static defaults` (what the card does for a key left out), `static aliases`; `static keys = configKeys<Config>()([…])` and `static base` name what the editor shows | The base builds the editor (`getConfigElement`) from the form, the lists, the defaults and the aliases: never write one by hand. `src/shared/editors.test.ts` holds every card to the contract: what the form and the lists show is exactly `base ∪ keys`, a default is for a field shown, no older name is shown. Also `static getStubConfig(hass, entities)` so the card picker shows a live preview. |
| Layout | `getGridOptions()`, `static layoutHeight(config)` | Full cards: `{ columns: 12, rows: 'auto', min_columns: 6+ }`. Tiles: `{ columns: 6, rows: 'auto' }`. `getCardSize()` ≈ height / 50. `layoutHeight` is the card's height at a 360 column for that config (the automatic dashboards cut their columns with it; `tools/render/heights.mjs` measures the drift). |
| Registration | `src/index.ts` | `registerCard({ tag, name, description }, Class)` — synchronous, at module top level. Tag = `fluvy-<name>-card`. |

## Motion (already wired by `interaction.css`)

Entrance, press (`:active` scale), hover (only `@media (hover: hover)`), focus ring, switch thumb spring, knob lift,
tick lighting, curve draw-in, bar growth, reduced motion. A card adds motion only by using the right classes:
`fv-tile--tap` / `fv-row--tap` / `fv-ico--tap` on tappable surfaces; `fv-swap` on text that replaces itself
(wrap in Lit `keyed`). Animate only transform / opacity / colour.

## Verify (all four, every card)

```sh
pnpm --filter @fluvy/playground dev                       # http://127.0.0.1:5183/?sheet=<sheet>&mode=dark&width=360&lang=es&theme=off
node tools/render/shot.mjs --sheet <sheet> [--mode dark] [--width 320]      # screenshot → apps/playground/out/
node tools/render/measure.mjs --page "http://127.0.0.1:5183/?sheet=<sheet>" --frame '[data-frame]' --width 1400 \
     --out apps/playground/out/measure/<sheet>.json --md apps/playground/out/measure/<sheet>.md   # must be 0 violations
npx tsc --noEmit -p packages/cards/tsconfig.json
```

Add the card to `apps/playground/src/sheets/<sheet>.ts` with the same content the design sheet shows
(`design/approved/<sheet>-linen-900.png` is the reference), plus the hard states: unavailable, nulls.
