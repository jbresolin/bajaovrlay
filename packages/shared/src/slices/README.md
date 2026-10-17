# packages/shared/src/slices

The state the server owns, one Zod schema per slice. Start reading at `slices.ts`,
which lists all ten slices; five have a file here:

- `layer.ts` — the fixed screen slots, bottom to top by `zIndex`; `graphic.ts` — the graphics the operator can take (built OGraf packages), with the
  manifest fields the server reads (the data `schema`, our `v_baja` vendor field).
- `instance.ts` — what is on each layer and output, its status and, on a preview, what it carries.
- `previewClearedLayerIds.ts` — the layers marked "will be cleared"; in the server's memory only.
- `eventLogEntry.ts` — one line of the append-only command log.
- `changedSlices.ts` — the slices one state change changed (the WS `slices` message), and
  `mergeChangedSlicesIntoSlices`, how a client takes them in one step.

`rundowns` and `items` live in `../rundown/`, `quickFirePanels` in `../quickFire/`, `macros`
and `macroRuns` in `../macros/`. Data sources, overrides, entities and theme arrive in M2.
