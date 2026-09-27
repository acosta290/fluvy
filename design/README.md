# design

The approved design of Fluvy, and what it is judged against.

| Path | What |
| --- | --- |
| `language.md` | the design language: sizes, idioms, tones, copy rules. The specification every card is built and reviewed against. |
| `approved/` | the latest approved render of every sheet (`<sheet>-linen-<width>.png`), rendered from `apps/design-lab/sheets/` with `tools/render/render.mjs` |

The sheets themselves live in `apps/design-lab/` and their CSS is the production CSS (`packages/ui/styles/`): a sheet
is the specification of the cards it shows, pixel for pixel. Alignment reports for any sheet are regenerated with
`tools/render/measure.mjs` (they must say 0 violations). Every intermediate round of every sheet, with the independent
review it got, was kept outside this repository; what is here is what was approved.
