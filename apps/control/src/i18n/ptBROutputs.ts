import type { Layer } from '@bajaovrlay/shared';

/**
 * pt-BR catalog, "Saídas e camadas" part (features/outputsAndLayers, BAJAOVRLAY-49): the
 * settings page where the operator adds outputs (each a renderer address OBS loads) and
 * edits their layers, and the output choice of Camadas, the monitors and the layer
 * pickers. Kept in a file of its own so ptBR.ts stays readable; ptBR.ts makes it
 * `ptBR.outputs`.
 */
export const ptBROutputs = {
  pageTitle: 'Saídas e camadas',
  pageIntro:
    'Cada saída é um endereço do renderizador que o OBS carrega como fonte de navegador. A saída Programa é a fonte principal (/render/); uma cena com PiP pode ter a sua própria saída e as suas camadas.',
  // Adding an output.
  newOutputHeading: 'Nova saída',
  outputNameLabel: 'Nome',
  outputNamePlaceholder: 'PiP',
  outputIdLabel: 'Endereço',
  outputIdHint: 'Letras minúsculas sem acento, números e hífens: entra no endereço do OBS.',
  addOutputButton: 'Adicionar saída',
  // One output's card.
  rendererAddressLabel: 'Endereço para o OBS',
  copyAddressButton: 'Copiar',
  addressCopied: 'Endereço copiado.',
  addressNotCopied: 'Não foi possível copiar. Selecione o endereço e use Ctrl+C.',
  renameOutputLabel: (outputName: string) => `Nome da saída ${outputName}`,
  renameOutputButton: 'Renomear',
  deleteOutputButton: 'Excluir saída',
  deleteOutputConfirmButton: 'Confirmar: excluir saída',
  programCannotBeDeleted: 'A saída Programa é a fonte principal do OBS e não pode ser excluída.',
  // The layers of one output.
  layersHeading: 'Camadas, de baixo para cima',
  layersListLabel: (outputName: string) => `Camadas de ${outputName}`,
  noLayers: 'Nenhuma camada ainda. Adicione uma abaixo.',
  moveLayerHandle: 'Mover',
  layerHandleRoleDescription: 'camada que pode mudar de posição',
  layerHeight: (zIndex: number) => `Posição ${String(zIndex)}`,
  layerNameLabel: (layerName: string) => `Nome da camada ${layerName}`,
  saveLayerNameButton: 'Salvar nome',
  replacePolicyLabel: (layerName: string) => `Troca de gráfico em ${layerName}`,
  replacePolicyNames: {
    'out-then-in': 'Sai e depois entra',
    cut: 'Corte seco',
    crossfade: 'Fusão',
  } satisfies Record<Layer['replacePolicy'], string>,
  persistentLabel: 'Fica no ar entre itens',
  deleteLayerButton: 'Excluir',
  deleteLayerConfirmButton: 'Confirmar: excluir',
  /** Shown beside an armed "Excluir" when some graphic defaults to this layer. */
  graphicsDefaultingToLayer: (graphicCount: number) =>
    graphicCount === 1
      ? '1 gráfico usa esta camada como padrão; ele passa a usar a Tela cheia.'
      : `${String(graphicCount)} gráficos usam esta camada como padrão; eles passam a usar a Tela cheia.`,
  // Adding a layer to an output.
  newLayerNameLabel: (outputName: string) => `Nome da nova camada de ${outputName}`,
  newLayerNamePlaceholder: 'Moldura',
  addLayerButton: 'Adicionar camada',
  addLayerHint: 'A nova camada entra no topo da saída; arraste para mudar a posição.',
  // The drag, read out by a screen reader.
  dragInstructions:
    'Para mover uma camada, pressione espaço ou Enter na alça, use as setas e pressione espaço ou Enter para soltar.',
  dragOver: (draggedName: string, overName: string) =>
    `A camada ${draggedName} está sobre a camada ${overName}.`,
  dragDropped: (draggedName: string) => `A camada ${draggedName} foi solta.`,
  dragCancelled: (draggedName: string) => `A camada ${draggedName} voltou ao lugar.`,
  dragPickedUp: (draggedName: string) => `A camada ${draggedName} foi pega.`,
  // The output choice of Camadas, the monitors and the layer pickers.
  outputPickerLabel: (monitorName: string) => `Saída mostrada em ${monitorName}`,
  layerGroupLabel: (outputName: string) => `Saída ${outputName}`,
};
