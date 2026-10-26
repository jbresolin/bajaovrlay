# packages/shared/src/outputs

Outputs and the editing of layers (BAJAOVRLAY-49). An output is one renderer address OBS
loads as a browser source: `program` (/render/), which always exists, and any the operator
adds on "Saídas e camadas", such as `pip` (/render/?output=pip). Every layer names its
output (`outputId` in `../slices/layer.ts`), and a zIndex is unique within an output.

Start reading at `output.ts` (the `outputs` slice and `programOutputId`). The pt-BR
sentences of the two slices' checks are in `ptBROutputs.ts`.

`index.ts` lists every export of this folder; the package's `src/index.ts` re-exports it.
