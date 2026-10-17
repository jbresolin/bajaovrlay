/**
 * pt-BR catalog, "Edição rápida" part (features/playout/QuickEditPanel.tsx): the centre
 * panel that puts any graphic on air, previews it, and changes ONE instance in place.
 * Field labels come from each graphic's manifest; only the words around them are here.
 * Kept in a file of its own so ptBR.ts stays readable; ptBR.ts makes it
 * `ptBR.playout.quickEdit`.
 */
export const ptBRQuickEdit = {
  panelTitle: 'Edição rápida',
  // Not just "Gráfico": the item editor has a dropdown of that name on the same page.
  graphicLabel: 'Gráfico a editar',
  // Not just "Camada": the item editor has a dropdown of that name on the same page.
  layerLabel: 'Camada da nova entrada',
  noGraphicsOnServer: 'O servidor não enviou nenhum gráfico.',

  // The line at the top of the panel, saying what a press changes. With nothing loaded
  // from "Camadas" the panel makes a new entry and changes no stored item.
  newTakeHeader: 'Nova entrada — não altera nenhum item',
  // With one instance loaded by a row's "Editar": its layer, what it is, and where it is.
  editingHeader: (layerName: string, instanceLabel: string, outputWord: string) =>
    `Editando: ${layerName} · ${instanceLabel} · ${outputWord}`,
  onProgramWord: 'No ar',
  inPreviewWord: 'Em prévia',
  // Leaves the instance alone and goes back to making a new entry, keeping the form.
  stopEditingButton: 'Nova entrada',
  // Opens the item editor with this graphic, layer and fields, to keep them as an item.
  saveAsItemButton: 'Salvar como item',

  // One line, shown when the instance being edited is no longer there. The panel then
  // makes a new entry with the same values and never moves to another instance by itself.
  targetLeftProgram: (layerName: string) =>
    `O que você editava na camada ${layerName} saiu do ar. Os valores continuam no formulário, como nova entrada.`,
  targetReplacedOnProgram: (layerName: string) =>
    `O que você editava na camada ${layerName} foi substituído no ar. Os valores continuam no formulário, como nova entrada.`,
  targetLeftPreview: (layerName: string) =>
    `A prévia que você editava na camada ${layerName} saiu. Os valores continuam no formulário, como nova entrada.`,
  targetReplacedInPreview: (layerName: string) =>
    `A prévia que você editava na camada ${layerName} foi substituída. Os valores continuam no formulário, como nova entrada.`,
  // The instance is still there, but its graphic is no longer listed, so its form
  // cannot be drawn; the form becomes a new entry of another graphic.
  targetGraphicNoLongerListed: (layerName: string) =>
    `O gráfico do que você editava na camada ${layerName} não está mais na lista do servidor. O painel voltou a ser uma nova entrada.`,

  // Shown above the form while it could not show everything the instance holds. The
  // server checks the whole result of an "Atualizar", so it refuses one that leaves a
  // required field missing; only "Colocar no ar" gets out of that.
  fieldsOnAirThatCouldNotBeRead: (fieldLabels: string) =>
    `Estes campos do que está no ar não puderam ser lidos e aparecem com o valor inicial: ${fieldLabels}. "Atualizar" envia só o que você alterar, e o servidor recusa enquanto faltar um campo obrigatório no ar; "Colocar no ar" envia o formulário inteiro e substitui o que está no ar.`,
  // The same, for a loaded preview, whose buttons are "Prévia" and "Colocar no ar".
  fieldsInPreviewThatCouldNotBeRead: (fieldLabels: string) =>
    `Estes campos da prévia não puderam ser lidos e aparecem com o valor inicial: ${fieldLabels}. "Prévia" envia o formulário inteiro e substitui a prévia; "Colocar no ar" envia o formulário inteiro ao ar.`,
} as const;
