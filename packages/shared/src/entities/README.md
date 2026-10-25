# packages/shared/src/entities

The entity library (concept §4, BAJAOVRLAY-19): teams, people, sponsors and the schedule, kept
on "Cadastros" or imported from CSV. Start at `team.ts` (keyed by car number, the positions' key,
so a car and its team join with no mapping); `person.ts`, `sponsor.ts` (its level, in the round
order of the zod-free `sponsorLevels.ts`) and `scheduleSlot.ts` follow it. `scheduleSlotStatus.ts`
derives a slot's status from a moment; the commands are `upsertEntity.ts`, `deleteEntity.ts` and
`importEntities.ts`; refusals are pt-BR sentences naming the field (`ptBREntities.ts`). One
attribute of one record reaches an item through `entityFieldValue.ts` (kind `entity`),
`entityAttributes.ts`, `entityFitsGraphicField.ts` and `entityReferenceResolution.ts` (an image as
its /media URL); a whole list (every sponsor or slot, kind `entityList`, BAJAOVRLAY-46) through
`entityListFieldValue.ts`, `entityListItems.ts` (listed by hand), `entityListFitsGraphicField.ts`
and `entityListResolution.ts`. Both are always live. `index.ts` lists every export.
