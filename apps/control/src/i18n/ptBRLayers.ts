/**
 * pt-BR catalog, "Camadas" part (features/layers): the layer panel in the right column,
 * one row per layer with what is on it, which item it came from, whether it was changed
 * on air, and its buttons. Kept in a file of its own so ptBR.ts stays readable; ptBR.ts
 * makes it `ptBR.layers`.
 */
export const ptBRLayers = {
  emptyLayer: 'vazia',
  // The small mark on a layer that holds something on the preview output.
  inPreviewChip: 'em prévia',
  // The small mark on a layer the next take will clear (previewClearLayer): Prévia
  // already shows it empty.
  willClearChip: 'vai limpar',
  clearLayerButton: 'Limpar',
  // On a layer with something on air: show in Prévia what the screen looks like once
  // this layer is cleared, without clearing it yet.
  previewClearLayerButton: 'Prévia: limpar',
  // Loads that very instance into "Edição rápida": the one on air, or the one in preview.
  editInstanceButton: 'Editar',
  editPreviewInstanceButton: 'Editar prévia',
  // The word on each row's status badge. "Carregando" is what the server sets at the
  // take; "No ar" and "Falhou" are what the renderer reports back.
  instanceStatus: {
    loading: 'Carregando',
    ready: 'Pronto',
    'on-air': 'No ar',
    stopping: 'Saindo',
    failed: 'Falhou',
  },
  // The tooltip on a "Falhou" badge when the renderer gave no detail of its own.
  failedWithoutDetail: 'O renderizador não informou o motivo da falha.',

  // Where the item's label goes when there is no item to name: one put on air by hand
  // before BAJAOVRLAY-37, or one whose item was deleted while it stayed on air.
  withoutItem: 'sem item',
  itemDeleted: 'item excluído',
  // The mark on a row whose instance was changed on air ("Atualizar" in "Edição rápida"),
  // and its tooltip naming the fields by their titles.
  changedOnAirChip: 'alterado no ar',
  changedOnAirTooltip: (fieldTitles: string) => `Alterado no ar: ${fieldTitles}`,
  // The same chip beside "em prévia", for a preview changed with "Atualizar prévia".
  changedInPreviewTooltip: (fieldTitles: string) => `Alterado na prévia: ${fieldTitles}`,
  // Keeps the change on air for the next takes of the item.
  saveIntoItemButton: 'Salvar no item',
  // For an instance with no item: opens the item editor filled with what is on air.
  saveAsItemButton: 'Salvar como item',

  // The question asked before saving a clock's wall-clock moment into an item.
  wallClockChoice: {
    title: 'Como guardar o relógio no item?',
    description:
      'O relógio no ar conta a partir de um momento. O item pode guardar esse momento ou começar a contar quando entrar no ar.',
    // Each take shows this very race time, running on: right for a clock cleared and
    // brought back.
    keepMomentButton: 'Continuar este relógio',
    // Each take starts the clock when it goes on air: right for a reusable item.
    atTakeButton: 'Começar na entrada no ar',
    cancelButton: 'Cancelar',
    closeDialogButton: 'Fechar',
  },
} as const;
