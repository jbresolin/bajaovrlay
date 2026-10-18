/**
 * pt-BR catalog, "Edição rápida" part (features/playout/QuickEditPanel.tsx): the centre
 * panel that changes ONE instance in place, on air or in preview. Since BAJAOVRLAY-37 it
 * puts nothing new up; a new graphic is a new item ("Novo gráfico…"). Field labels come
 * from each graphic's manifest; only the words around them are here. Kept in a file of
 * its own so ptBR.ts stays readable; ptBR.ts makes it `ptBR.playout.quickEdit`.
 */
export const ptBRQuickEdit = {
  panelTitle: 'Edição rápida',

  // With nothing loaded: how to load something, and the way to make a new graphic.
  nothingLoadedHint: 'Use Editar numa camada para alterar o que está no ar',
  // Opens the item editor for a new item on the shortcuts panel shown.
  newGraphicButton: 'Novo gráfico…',

  // The line at the top of the panel with one instance loaded by a row's "Editar": its
  // layer, what it is, and where it is.
  editingHeader: (layerName: string, instanceLabel: string, outputWord: string) =>
    `Editando: ${layerName} · ${instanceLabel} · ${outputWord}`,
  onProgramWord: 'No ar',
  inPreviewWord: 'Em prévia',
  // Lets go of the instance; the panel goes back to having nothing loaded.
  stopEditingButton: 'Parar de editar',
  // The one send of a loaded instance on air ("Atualizar") lives in ptBR.playout; this is
  // the one of a loaded preview.
  updatePreviewButton: 'Atualizar prévia',

  // One line, shown when the instance being edited is no longer there. The panel then has
  // nothing loaded (the values typed are dropped) and never moves to another instance by
  // itself.
  targetLeftProgram: (layerName: string) => `O que você editava na camada ${layerName} saiu do ar.`,
  targetReplacedOnProgram: (layerName: string) =>
    `O que você editava na camada ${layerName} foi substituído no ar.`,
  targetLeftPreview: (layerName: string) =>
    `A prévia que você editava na camada ${layerName} saiu.`,
  targetReplacedInPreview: (layerName: string) =>
    `A prévia que você editava na camada ${layerName} foi substituída.`,
  // The instance is still there, but its graphic is no longer listed, so its form cannot
  // be drawn.
  targetGraphicNoLongerListed: (layerName: string) =>
    `O gráfico do que você editava na camada ${layerName} não está mais na lista do servidor.`,

  // Shown above the form while it could not show everything the instance holds. The
  // server checks the whole result of an update, so it refuses one that leaves a required
  // field missing; the operator gets out of that by typing the field, which sends it.
  fieldsOnAirThatCouldNotBeRead: (fieldLabels: string) =>
    `Estes campos do que está no ar não puderam ser lidos e aparecem com o valor inicial: ${fieldLabels}. "Atualizar" envia só o que você alterar; preencha estes campos para enviá-los.`,
  // The same, for a loaded preview, whose button is "Atualizar prévia".
  fieldsInPreviewThatCouldNotBeRead: (fieldLabels: string) =>
    `Estes campos da prévia não puderam ser lidos e aparecem com o valor inicial: ${fieldLabels}. "Atualizar prévia" envia só o que você alterar; preencha estes campos para enviá-los.`,
} as const;
