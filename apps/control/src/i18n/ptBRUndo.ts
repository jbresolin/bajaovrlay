/**
 * pt-BR catalog, undo part (features/undo, BAJAOVRLAY-30): "Desfazer" on each Camadas row,
 * "Desfazer última" beside "Limpar tudo", and their tooltips saying what comes back. Kept in
 * a file of its own so ptBR.ts stays readable; ptBR.ts makes it `ptBR.undo`.
 */
export const ptBRUndo = {
  undoOnLayerButton: 'Desfazer',
  undoLastChangeButton: 'Desfazer última',
  // "Desfazer última" with nothing remembered: on screen all the same, off, with this reason.
  nothingToUndo: 'Nada para desfazer no ar.',
  // What one layer shows again after the undo: an item by its label, or nothing.
  itemComesBack: (itemLabel: string) => `"${itemLabel}"`,
  layerComesBackEmpty: 'camada vazia',
  // "Volta: …" opens every tooltip; "Desfazer última" lists "<camada>: <o que volta>".
  whatComesBack: (whatComesBackText: string) => `Volta: ${whatComesBackText}`,
  layerAndWhatComesBack: (layerName: string, whatComesBackText: string) =>
    `${layerName}: ${whatComesBackText}`,
  layersSeparator: ' · ',
};
