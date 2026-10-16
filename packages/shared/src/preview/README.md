# packages/shared/src/preview

The seven commands of the preview output, where the operator sees the screen as it will
be after the take. One file per command, all in the `Command` union of `../commands/command.ts`:

- `previewItem.ts` — an item on the preview output of its layer (`origin: 'auto'` also
  discards every other `auto` preview); `previewGraphic.ts` — the same for hand-typed data.
- `stopPreview.ts` — throw the preview of one layer away, or of every layer (`layerId: null`).
- `takePreview.ts` — send what is previewed on a layer to program, exactly as it was seen.
- `previewClearLayer.ts` — mark a layer "will be cleared" (`previewClearedLayerIds` slice).
- `takeAllPreviews.ts` — "Tomar tudo": every preview and every marker to program in one cut.
- `previewMacro.ts` — a macro's end state on the preview output, program untouched.

A preview is an instance with `target: 'preview'` (`../slices/instance.ts`). The rules live in
the server's reducers (apps/server/src/core/store/reducers/). `index.ts` lists every export.
