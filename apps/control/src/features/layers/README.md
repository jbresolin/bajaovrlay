# apps/control/src/features/layers

The layer status panel: what is on every layer, at all times (operator rule 4 in
docs/00-concept.md §7). Start reading at `LayerStatusPanel.tsx`.

- `LayerStatusPanel.tsx` — one row per layer in z-order, read from the `layers`,
  `graphics` and `instances` slices; "Limpar" sends `clearLayer`.
- `LayerStatusRow.tsx` — one row: layer name, graphic name, "há 2 min", status badge,
  the button. An empty layer says "vazia".
- `useCurrentTime.ts` — redraws the rows every 10 s so the relative times keep up.
- `ItemLabelOnAir.tsx` — the label of the rundown item that put the graphic on air.

The panel lists the program output only; M0 has no preview. Instances stay in status
"carregando" until the renderer acknowledges takes (BAJAOVRLAY-12).
