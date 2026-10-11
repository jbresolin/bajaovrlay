# apps/control/src/features/layers

The layer status panel: what is on every layer, at all times (operator rule 4 in
docs/00-concept.md §7). Start reading at `LayerStatusPanel.tsx`.

- `LayerStatusPanel.tsx` — one row per layer in z-order, read from the `layers`,
  `graphics` and `instances` slices; "Limpar" sends `clearLayer`.
- `LayerStatusRow.tsx` — one row: layer, graphic, "há 2 min", badge, button; or "vazia".
- `InstanceStatusBadge.tsx` — green "No ar", grey "Carregando", red "Falhou" + why (tooltip).
- `useCurrentTime.ts` — redraws the rows every 10 s so the relative times keep up.

Program output only; there is no preview yet. A take starts as "Carregando"; a renderer's
report makes it "No ar" or (even after "No ar") "Falhou", which stays until cleared. With
no OBS connected the badge stays "Carregando" until a renderer reports (the program
monitor never does); that is correct behaviour, not a fault.
