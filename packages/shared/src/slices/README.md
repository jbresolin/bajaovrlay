# packages/shared/src/slices

The state the server owns, one Zod schema per slice. Start reading at `slices.ts`,
which lists all ten slices; five have a file here:

- `layer.ts` — the fixed screen slots, bottom to top by `zIndex`.
- `graphic.ts` — graphics the operator can take (built OGraf packages), with the
  manifest fields the server reads: the data `schema` and our `v_baja` vendor field
  (default layer, category, and the name of the rule its updates run through).
- `instance.ts` — what is on each layer and output, its status (`failed` has the renderer's reason
  in `statusDetail`), a preview's fields to stamp again at the take and who asked for it (`previewOrigin`).
- `previewClearedLayerIds.ts` — the layers marked "will be cleared", which Prévia shows
  empty; kept in the server's memory only.
- `eventLogEntry.ts` — one line of the append-only command log.

The `rundowns` and `items` slices live in `../rundown/`, `quickFirePanels` in
`../quickFire/`, `macros` and `macroRuns` in `../macros/`. Data sources, overrides,
entities and theme arrive in M2.
