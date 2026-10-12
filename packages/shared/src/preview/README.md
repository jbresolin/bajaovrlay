# packages/shared/src/preview

The four commands of the preview output, where the operator sees a graphic before it goes
on air. One file per command, all in the `Command` union of `../commands/command.ts`:

- `previewItem.ts` — show an item on the preview output of its layer (resolved as a take).
- `previewGraphic.ts` — the same for hand-typed data; a takeGraphic that cannot go on air.
- `stopPreview.ts` — throw the preview of one layer away, or of every layer (`layerId: null`).
- `takePreview.ts` — send what is previewed on a layer to program, exactly as it was seen.

A preview is an instance with `target: 'preview'` (`../slices/instance.ts`); such an
instance may carry `takeTimeFieldKeys`, the fields takePreview stamps again with the
moment of the take. The rules live in the server's reducers
(apps/server/src/core/store/reducers/). `index.ts` lists every export of this folder.
