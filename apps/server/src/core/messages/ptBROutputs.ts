/**
 * The server's pt-BR messages about outputs and the editing of layers (BAJAOVRLAY-49),
 * reached as ptBR.outputs. Kept apart from ptBR.ts to keep that file short. Every refusal
 * names what blocks it, so the operator knows what to change without asking anyone.
 */
export const ptBROutputs = {
  /** The name of the output seeded in every database. */
  programOutputName: 'Programa',
  outputNotFound: (outputId: string) =>
    `A saída "${outputId}" não existe; ela pode ter sido excluída.`,
  outputAlreadyExists: (outputId: string, outputName: string) =>
    `Já existe uma saída com o endereço "${outputId}" ("${outputName}"). Escolha outro endereço para a nova saída.`,
  programOutputKept: (programName: string) =>
    `A saída "${programName}" não pode ser excluída: ela é a fonte principal do OBS (/render/).`,
  outputHasLayers: (outputName: string, layerNames: string[]) =>
    `A saída "${outputName}" ainda tem ${countInWords(layerNames.length, 'camada', 'camadas')}: ${quoteEach(layerNames)}. Exclua as camadas ou mude-as de saída antes de excluir a saída.`,
  outputsNotAPermutation: 'A nova ordem das saídas precisa trazer cada saída exatamente uma vez.',
  layerAlreadyExists: (layerId: string, layerName: string) =>
    `Já existe uma camada com o id "${layerId}" ("${layerName}").`,
  zIndexTaken: (zIndex: number, outputName: string, takenByName: string, layerName: string) =>
    `A posição ${String(zIndex)} da saída "${outputName}" já é da camada "${takenByName}". Escolha outra posição para "${layerName}".`,
  fallbackLayerKept: (layerName: string, programName: string) =>
    `A camada ${layerName} é a camada padrão dos gráficos e fica na saída ${programName}.`,
  layersNotAPermutation: (outputName: string) =>
    `A nova ordem das camadas de "${outputName}" precisa trazer cada camada dessa saída uma vez.`,
  /** What a delete or a move of a layer was trying to do, ending "não pode …". */
  layerActions: {
    delete: 'ser excluída',
    move: 'mudar de saída',
  },
  /** What is on a layer that stops a delete or a move. */
  thingsOnALayer: {
    onAir: 'tem um gráfico no ar',
    inPreview: 'tem um gráfico em prévia',
    markedToClear: 'está marcada "vai limpar" na Prévia',
  },
  layerNotEmpty: (layerName: string, action: string, whatIsOnIt: string[]) =>
    `A camada "${layerName}" não pode ${action}: ${whatIsOnIt.join(' e ')}. Limpe a camada antes.`,
  /** One kind of use of a layer, counted, with the names: `2 itens: "A", "B"`. */
  usesOfAKind: {
    items: (names: string[]) =>
      `${countInWords(names.length, 'item', 'itens')}: ${quoteEach(names)}`,
    shortcuts: (names: string[]) =>
      `${countInWords(names.length, 'atalho', 'atalhos')}: ${quoteEach(names)}`,
    eventTemplates: (names: string[]) =>
      `${countInWords(names.length, 'modelo de evento', 'modelos de evento')}: ${quoteEach(names)}`,
    macros: (names: string[]) =>
      `${countInWords(names.length, 'macro', 'macros')}: ${quoteEach(names)}`,
    eventRules: (names: string[]) =>
      `${countInWords(names.length, 'regra de eventos', 'regras de eventos')}: ${quoteEach(names)}`,
  },
  layerInUse: (layerName: string, usesOfEachKind: string[]) =>
    `A camada "${layerName}" não pode ser excluída. Usada por ${usesOfEachKind.join('; ')}. Mude ou exclua o que usa a camada antes.`,
};

/** "1 camada" or "3 camadas". */
function countInWords(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${String(count)} ${plural}`;
}

/** `"Moldura", "Legenda"`. */
function quoteEach(names: string[]): string {
  return names.map((name) => `"${name}"`).join(', ');
}
