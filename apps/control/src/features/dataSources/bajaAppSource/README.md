# apps/control/src/features/dataSources/bajaAppSource

"Adicionar fonte do app Baja" on Fontes (BAJAOVRLAY-54): a flex source made from a Baja app
preset in a few clicks. Start at `BajaAppSourcePicker.tsx`. The operator's guide is
`docs/bajaAppSources.md`; the presets themselves are in packages/shared
(`flexMapping/presets/bajaApp/`).

- `bajaAppSampleRequests.ts` — the reads made before a source exists (evento.php, a table's
  resultado.php, equipes.php for Cadastros), each sent through the server's sample route.
- `bajaAppAnswerReading.ts` — what the event offers (lap-counted races, tables, tournaments)
  and a table's ranking column and part columns, every name cleaned as the mapping cleans one.
- `BajaAppEventChoices.tsx`, `BajaAppChoiceOptions.tsx` — the three lists, the "Aceitar
  corrida simulada" box and a table's parts.
- `bajaAppSourceOfChoice.ts` — the choice as a filled-in preset, a name and a read interval,
  which the page opens in the ordinary flex form (`flexSource/`); "Salvar fonte" saves it.
