# apps/control/src/features/dataSources/bajaAppSource

"Adicionar fonte do app Baja" on Fontes (BAJAOVRLAY-54): a flex source made from a Baja app
preset in a few clicks. Start at `BajaAppSourcePicker.tsx`. The operator's guide is
`docs/bajaAppSources.md`; the presets themselves are in packages/shared
(`flexMapping/presets/bajaApp/`).

- `bajaAppTypedIds.ts` — the checks of what is typed (the API's address, the event id, a
  result's id) against the API's patterns, before anything is read; Cadastros uses them too.
- `bajaAppSampleRequests.ts` — the reads made before a source exists (evento.php, a table's
  resultado.php, a tournament's torneio.php, equipes.php for Cadastros), each sent through
  the server's sample route.
- `bajaAppAnswerReading.ts` — what the event offers (lap-counted races, tables, tournaments),
  a table's points column (the one flagged `ranking: true`) and part columns, a tournament's
  name and the API's `wrong_type`, every name cleaned as the mapping cleans one.
- `bajaAppResultById.ts` — "Outro resultado (digite o id)": a result read as a table, or as a
  tournament when the API answers `wrong_type`.
- `BajaAppEventChoices.tsx`, `BajaAppChoiceOptions.tsx`, `BajaAppOtherResultOption.tsx` — the
  lists, the "Aceitar corrida simulada" box, a table's parts and the id to type.
- `bajaAppSourceOfChoice.ts` — the choice as a filled-in preset, a name and a read interval,
  which the page opens in the ordinary flex form (`flexSource/`); "Salvar fonte" saves it.
