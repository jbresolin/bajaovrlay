# packages/shared/src/transforms

The transform registry (architecture rule 5): the named, pure functions a flex source's
mapping may apply to a value on its way into a canonical shape. Never a free-form
expression: what a mapping can do to a value is exactly what `transformRegistry.ts` lists.
Start there, then `transform.ts` (what an entry is: `id`, pt-BR `label` and `description`,
optional `parametersSchema`, and `apply`, which never throws and answers `{ ok, value }` or
`{ ok: false, reason }` with a pt-BR reason quoting the value).

Each group of transforms has its own file, named for the group; `transformRegistry.ts`
lists them. `checkTransformParameters.ts` is what a config schema runs, so an unknown id
or a bad table is refused at save time, and `ptBRTransforms.ts` holds every text. The
presentation transforms of concept §4 (`topN`, `formatLapTime`, `abbreviateUniversity`)
join this same registry with the bindings, BAJAOVRLAY-20.
