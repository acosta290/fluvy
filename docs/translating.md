# Translating Fluvy

Fluvy speaks the languages below in every card, page, dialog and editor form. Home Assistant's own words — entity
states, attribute values, its dialogs — come from Home Assistant's translations; Fluvy's words come from one
catalogue per language, and a person may choose theirs in the panel's *Preferences* whatever Home Assistant speaks.

| Code | Language | Catalogue |
| --- | --- | --- |
| `en` | English | `packages/core/src/i18n/locales/en.json` — the source every other language mirrors |
| `es` | Spanish | `packages/core/src/i18n/locales/es.json` |
| `de` | German | `packages/core/src/i18n/locales/de.json` |
| `nl` | Dutch | `packages/core/src/i18n/locales/nl.json` |
| `fr` | French | `packages/core/src/i18n/locales/fr.json` |
| `it` | Italian | `packages/core/src/i18n/locales/it.json` |
| `pt-BR` | Portuguese (Brazil) | `packages/core/src/i18n/locales/pt-BR.json` — `pt` and `pt-PT` read it too |
| `tr` | Turkish | `packages/core/src/i18n/locales/tr.json` |

## How a language works

- **One catalogue per language**, `packages/core/src/i18n/locales/<code>.json`: a table per namespace (the shared
  words — `common`, `climate`, `editor` — and one per card or page — `cover`, `panel`, `history`), each key with its
  text. Placeholders are `{name}`; every key of `en.json` exists in every other language, with the same placeholders.
- **English ships inline**; every other language is fetched the first time it is needed (a chunk of its own), so a
  dashboard pays for the language it speaks and no other.
- **`words`**: the stems the automatic dashboard reads a house by (what people call their lights, their garden, the
  solar inverter, the grid meter). Every language's stems are merged into `packages/cards/src/strategy/words.generated.ts`
  (`pnpm i18n build`), because a house is named in its own language, not the UI's.
- **The registry**, `packages/core/src/i18n/languages.ts`: the code (as Home Assistant reports `hass.language`), the
  language's own name, its English name, and when its day's parts begin (the greeting's "morning", "afternoon",
  "evening", "night").
- **The integration** has a translation of its own texts (the Repairs it raises, its setup dialog) in
  `custom_components/fluvy/translations/<code>.json`, key for key with `strings.json`.

## Improving a translation

Edit the language's catalogue and open a pull request. `pnpm i18n` checks every language against English (missing
keys, keys English lacks, empty texts, placeholders, the word stems) and prints how many keys each language has;
`pnpm i18n --release` refuses a release with anything missing. The playground shows any sheet in any language:
`http://127.0.0.1:5183/?sheet=climate&lang=de`. Keep a card's words short — a chip, a tile label and a readout have
a fixed width — and keep Home Assistant's register: the same word Home Assistant uses on the same screen, the same
form of address.

## Adding a language

1. `pnpm i18n scaffold <code>` writes `<code>.json` key for key from English, in English: translate it.
2. Add the language to `LANGUAGE_CODES` and `LANGUAGES` in `packages/core/src/i18n/languages.ts` (its names and its
   day parts), and its loader to `LOADERS` in `packages/core/src/i18n/index.ts`.
3. Fill `words` with the stems people use in that language, then `pnpm i18n build`.
4. Add `custom_components/fluvy/translations/<code>.json`, key for key with `strings.json`.
5. Add the language to the table above. `pnpm i18n` is the check; `pnpm check` runs it.

A right-to-left language needs a design pass first (the rulers and the layouts are written for left-to-right
reading); none ships yet.
