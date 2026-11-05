/**
 * The server's pt-BR messages about undo on program (BAJAOVRLAY-30), reached as
 * ptBR.programHistoryErrors. Kept apart from ptBR.ts to keep that file short.
 */
export const ptBRProgramHistoryErrors = {
  nothingToUndoOnLayer: (layerName: string) =>
    `A camada "${layerName}" não tem nada para desfazer.`,
  nothingToUndoAnywhere: 'Não há nada no ar para desfazer.',
  itemDeletedSince: (itemLabel: string) =>
    `Não dá para desfazer: o item "${itemLabel}", que estava na camada antes, foi excluído.`,
  graphicNoLongerListed: (graphicId: string, itemLabel: string) =>
    `Não dá para desfazer: o gráfico "${graphicId}" do item "${itemLabel}" não está mais registrado.`,
};
