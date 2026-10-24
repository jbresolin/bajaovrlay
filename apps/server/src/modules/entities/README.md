# apps/server/src/modules/entities

The entity library on the server (concept §4, BAJAOVRLAY-19): the teams, people, sponsors
and schedule an operator keeps on the "Cadastros" page. The records and their rules are
shared code (`packages/shared/src/entities/`); this module applies the commands and loads
the slices at boot.

Start at `reducers/reduceEntityCommand.ts`: `upsertEntity.ts` adds or replaces one record by
its key (a team by car number), `importEntities.ts` does the same for many in one change,
and `deleteEntity.ts` removes one; all three share `recordsByKey.ts` and
`entitySliceWrites.ts`. `loadEntitySlices.ts` reads the four rows at boot (nothing is
seeded), and `importEventLogPayload.ts` keeps an import's event-log row to its keys.
`index.ts` lists what core may use.
