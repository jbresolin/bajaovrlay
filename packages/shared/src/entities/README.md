# packages/shared/src/entities

The entity library (concept §4, BAJAOVRLAY-19): our own small tables of teams, people,
sponsors and the day's schedule, edited on the "Cadastros" page or imported from CSV,
which item fields can reference. Start at `team.ts`: a team is keyed by its car number,
the key of the positions shape, so a car in the race and its team join with no mapping.
`person.ts`, `sponsor.ts` and `scheduleSlot.ts` follow the same pattern, each with its
slice schema (each key once, `entityKeysListedOnce.ts`).

`scheduleSlotStatus.ts` works out "concluída", "em andamento" or "a seguir" from a moment;
the status is never stored. The commands are `upsertEntity.ts`, `deleteEntity.ts` and
`importEntities.ts` (one batch per import). Every refusal is a pt-BR sentence naming its
field (`ptBREntities.ts`), which the CSV preview shows beside the line number. Images are
media ids (`../media/`). `index.ts` lists every export.
