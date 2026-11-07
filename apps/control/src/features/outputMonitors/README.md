# apps/control/src/features/outputMonitors

The two monitors of the centre column and what is in preview. Start reading at
`PreviewAndProgramMonitors.tsx` ("Prévia" above "Programa", stacked since BAJAOVRLAY-59).

- `OutputMonitor.tsx` — one `<iframe>` on the renderer page at 1920x1080, scaled into a 16:9 box:
  `/render/?monitor=1` ("Programa") or `/render/?target=preview&monitor=1` ("Prévia"). With more
  than one output each monitor offers an output picker (BAJAOVRLAY-49), program by default, the
  choice kept in this browser (`monitoredOutputInBrowserStorage.ts`); another output adds
  `&output=<id>` to the frame's address.
- `monitorWidthForColumnWidth.ts` — the one width both boxes get: the centre column's (measured
  by `useWidthOfElement.ts`), 640 px at most, so they shrink together on a narrower window.
- `PreviewedLayersList.tsx` — under "Prévia": a line per previewed or "vai limpar" layer
  (`previewedLayers.ts`), with "Tomar" (`takePreview` via `features/autoPreview/`, like Space) and
  "Descartar" (`stopPreview`); from two lines on `TakeAllAndDiscardAllButtons.tsx` ("Tomar tudo").
- `useBackspaceToStopPreview.ts` — Backspace discards the most recent preview and nothing else.

`monitor=1` pages never report: only OBS (plain `/render/`, built by `pnpm build`) turns a badge to "No ar".
