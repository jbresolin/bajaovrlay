# apps/server/src/modules/outputs

Outputs and editable layers (BAJAOVRLAY-49). An output is one renderer address OBS loads
as a browser source: `program` (/render/), which always exists, and any the operator adds
on "Saídas e camadas", such as `pip` (/render/?output=pip). Every layer belongs to one
output; the slice and command schemas are shared code (`packages/shared/src/outputs/`).

Start at `loadOutputAndLayerSlices.ts`: a new database is seeded with program and the
seven layers of `core/store/seedLayers.ts`; a database written before outputs gains
program with every layer it had assigned to it. From then on the layers are the
operator's own, and the seed is no longer caught up at boot.

`reducers/` holds the nine commands, one file each, behind `reduceOutputOrLayerCommand.ts`.
`layerUses.ts` says what is on a layer and what names it (the guards of deleteLayer and
moveLayerToOutput); `outputRefusals.ts` builds every refusal from `ptBR.outputs`.
`index.ts` lists what core may use.
