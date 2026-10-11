# apps/control/src/features/layers

The layer status panel: what is on every layer, at all times (operator rule 4 in
docs/00-concept.md §7). Start reading at `LayerStatusPanel.tsx`.

- `LayerStatusPanel.tsx` — one row per layer in z-order, read from the `layers`,
  `graphics` and `instances` slices; "Limpar" sends `clearLayer`.
- `LayerStatusRow.tsx` — one row: layer name, graphic name, "há 2 min", status badge,
  the button. An empty layer says "vazia".
- `InstanceStatusBadge.tsx` — the status word in its colour: green "No ar", grey
  "Carregando", red "Falhou" with the renderer's detail in a tooltip.
- `useCurrentTime.ts` — redraws the rows every 10 s so the relative times keep up.

Program output only; there is no preview yet. A take starts as "Carregando"; a renderer's
report makes it "No ar" or (even after "No ar") "Falhou", which stays until cleared.
