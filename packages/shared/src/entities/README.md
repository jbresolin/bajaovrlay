# packages/shared/src/entities

The entity library (concept §4, BAJAOVRLAY-19): teams, people, sponsors and the schedule,
kept on the "Cadastros" page or imported from CSV. Start at `team.ts`: a team is keyed by
its car number, the key of the positions, so a car in the race and its team join with no
mapping; `person.ts`, `sponsor.ts`, `scheduleSlot.ts` follow it, each slice holding a key
once. `scheduleSlotStatus.ts` derives the status from a moment; the commands are
`upsertEntity.ts`, `deleteEntity.ts`, `importEntities.ts`; refusals are pt-BR sentences
naming the field (`ptBREntities.ts`). Item fields read it through `entityFieldValue.ts`
(the kind `entity`, always live), `entityAttributes.ts`, `entityFitsGraphicField.ts` (an
image only on a `v_baja.role: imageUrl` field) and `entityReferenceResolution.ts` (an image
as its /media URL). Logos in a list (one per tower row) need a list join, which a later
item adds as a named binding transform (`withTeamLogos`), never a free-form expression.
`index.ts` lists every export.
