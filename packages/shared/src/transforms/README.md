# packages/shared/src/transforms

The transform registry (architecture rule 5): named, pure functions applied to one value,
never a free-form expression. What a flex source's mapping or an item's binding can do to a
value is exactly what `transformRegistry.ts` lists. Start there, then `transform.ts` (what an
entry is: `id`, `family`, pt-BR `label` and `description`, optional `parametersSchema`, and
`apply`, which never throws and answers `{ ok, value }` or `{ ok: false, reason }` with a
pt-BR reason quoting the value).

Two families, each offered by one form only: **mapping** transforms bring a source's data
into the canonical shapes (number, duration, moment and text files, `mapValuesTransform.ts`);
**binding** transforms shape canonical data for a graphic and say which value types they
read and give (`topNTransform.ts`, `raceTimeTextTransforms.ts` for lap times and gaps cut to
the tenth, `schoolNameTransforms.ts`). `checkTransformParameters.ts` is what a config or an
item save runs, so an unknown id, the wrong family or bad parameters are refused when
saved; `ptBRTransforms.ts` holds every text.
