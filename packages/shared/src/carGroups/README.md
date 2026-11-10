# packages/shared/src/carGroups

Car groups (BAJAOVRLAY-66): a graphic's manifest says which of its fields describe one car
(`v_baja.carGroups`), so the item editor shows one car picker in place of those fields.
Start at `carGroup.ts` (a group: id, pt-BR label, each field with its meaning, and for a
battle's second car the group it runs right behind), then `carGroupsOfManifest.ts` (the
Zod check against the manifest's data schema, refusing a group as a whole on any mistake).
`carGroupPaths.ts` writes the ordinary positions bindings a pick fills each field with
(`entryOfCar.<meaning>` by number, `entries.<index>.<meaning>` by place) and reads a stored
path back, so nothing about bindings, their storage or their resolution changes.
`index.ts` lists every export.
