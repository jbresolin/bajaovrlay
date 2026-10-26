/**
 * The pt-BR sentences of the outputs and layers schemas (BAJAOVRLAY-49): what the server
 * logs when a stored row fails, and what a page shows when a form's value does not fit.
 */
export const ptBROutputs = {
  outputIdNotAnAddress:
    'O endereço da saída usa só letras minúsculas sem acento, números e hífens entre palavras (por exemplo "pip" ou "camera-2").',
  outputListedTwice: (outputId: string) => `A saída "${outputId}" aparece duas vezes.`,
  programOutputMissing: 'A saída "program" (Programa) precisa existir sempre.',
  layerListedTwice: (layerId: string) => `A camada "${layerId}" aparece duas vezes.`,
  zIndexTakenInOutput: (layerName: string, zIndex: number, outputId: string) =>
    `A camada "${layerName}" está na mesma posição (${String(zIndex)}) que outra camada da saída "${outputId}".`,
};
