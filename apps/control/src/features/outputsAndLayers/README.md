# apps/control/src/features/outputsAndLayers

"Saídas e camadas" (#/saidas, BAJAOVRLAY-49): the settings page where the operator adds
outputs (each a renderer address OBS loads as a browser source, such as a PiP scene's
/render/?output=pip) and edits their layers. Opened from the header's "Saídas" in a new
tab, like Cadastros. It keeps nothing of its own: it reads the `outputs`, `layers` and
`graphics` slices and sends commands.

Start at `OutputsAndLayersPage.tsx`: `AddOutputForm.tsx` (the address follows the name,
`outputIdFromName.ts`), then one `OutputCard.tsx` per output, program first, with
`RendererAddressField.tsx` (the address and "Copiar", `addressCopy.ts`), `OutputLayerList.tsx`
(drag to reorder, as the rundown) of `OutputLayerRow.tsx` rows, and `AddLayerForm.tsx`
(a new layer goes on top, `heightOfANewLayer.ts`). Each card shows the refusal of its own
newest command. The server's rules live in apps/server/src/modules/outputs.
