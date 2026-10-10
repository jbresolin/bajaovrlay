# packages/shared/src/slices

The state the server owns, one Zod schema per slice. Start reading at `slices.ts`,
which lists the four M0 slices; each has its own file:

- `layer.ts` — the fixed screen slots, bottom to top by `zIndex`.
- `graphic.ts` — graphics the operator can take (built OGraf packages), with the
  manifest fields the server reads: the data `schema` and our `v_baja` vendor field.
- `instance.ts` — what is on each layer and output right now, and its status
  (`failed` carries the renderer's reason in `statusDetail`).
- `eventLogEntry.ts` — one line of the append-only command log.

Rundowns, items, data sources, overrides, entities, theme and macros arrive in M1/M2.
