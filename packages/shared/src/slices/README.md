# packages/shared/src/slices

The state the server owns, one Zod schema per slice. Start reading at `slices.ts`,
which lists the four M0 slices; each has its own file:

- `layer.ts` — the fixed screen slots, bottom to top by `zIndex`.
- `graphic.ts` — graphics the operator can take (built OGraf packages).
- `instance.ts` — what is on each layer and output right now.
- `eventLogEntry.ts` — one line of the append-only command log.

The `rundowns` and `items` slices are listed in `slices.ts` too; their schemas live in
`../rundown/`. Data sources, overrides, entities, theme and macros arrive in M1/M2.
