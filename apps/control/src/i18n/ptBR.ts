import { ptBRBindings } from './ptBRBindings';
import { ptBRDataSources } from './ptBRDataSources';
import { ptBREntityLibrary } from './ptBREntityLibrary';
import { ptBRKeyboard } from './ptBRKeyboard';
import { ptBRLayers } from './ptBRLayers';
import { ptBRQuickEdit } from './ptBRQuickEdit';
import { ptBRQuickFire } from './ptBRQuickFire';

/**
 * pt-BR catalog: every string the operator reads on the control page comes from here,
 * never written inline in a component, so the wording can be reviewed in one place.
 * Some parts live in files of their own to keep this one readable, and are reached
 * through here like the rest: `ptBR.keyboard` (ptBRKeyboard.ts), `ptBR.quickFire`
 * (ptBRQuickFire.ts, the quick-fire panels and the macros), `ptBR.layers`
 * (ptBRLayers.ts), `ptBR.playout.quickEdit` (ptBRQuickEdit.ts, "Edição rápida"),
 * `ptBR.dataSources` (ptBRDataSources.ts, the "Fontes de dados" page), `ptBR.entityLibrary`
 * (ptBREntityLibrary.ts, the "Cadastros" page) and `ptBR.bindings` (ptBRBindings.ts,
 * fields read from a source and corrections of a source).
 */
export const ptBR = {
  keyboard: ptBRKeyboard,
  bindings: ptBRBindings,
  quickFire: ptBRQuickFire,
  app: {
    title: 'BajaOvrLay',
    rundownAreaTitle: 'Rundown',
    playoutAreaTitle: 'Programa e edição rápida',
    layersAreaTitle: 'Camadas',
    // The two pages of the control page, linked from the header (src/app/currentPage.ts).
    pageLinks: {
      navigationLabel: 'Páginas do controle',
      console: 'Console',
      dataSources: 'Fontes',
      entityLibrary: 'Cadastros',
    },
  },
  serverHealth: {
    checkButton: 'Verificar servidor',
    checking: 'Verificando o servidor…',
    online: (version: string) => `Servidor no ar, versão ${version}.`,
    unreachable: 'Não foi possível falar com o servidor.',
  },
  connection: {
    statusLabel: 'Conexão com o servidor',
    status: {
      connecting: 'Conectando…',
      connected: 'Conectado',
      reconnecting: 'Reconectando…',
    },
    // The tooltip on every action button while the server cannot be reached.
    actionsDisabledReason: 'Sem conexão com o servidor. Os comandos voltam quando ela voltar.',
  },
  // Why a command did not happen, when the reason is on this side and not the server's.
  commandFailures: {
    notConnected: 'Sem conexão com o servidor. O comando não foi enviado.',
    timedOut:
      'O servidor não respondeu em 5 segundos. Confira nas camadas se o comando foi aplicado.',
  },
  // The layer panel, "Camadas" (features/layers), in ptBRLayers.ts.
  layers: ptBRLayers,
  // The "Fontes de dados" page and the header chip (features/dataSources), in ptBRDataSources.ts.
  dataSources: ptBRDataSources,
  // The "Cadastros" page (features/entityLibrary), in ptBREntityLibrary.ts.
  entityLibrary: ptBREntityLibrary,
  // Putting graphics on air and taking them off (features/playout).
  playout: {
    // "Edição rápida" (features/playout/QuickEditPanel.tsx), in ptBRQuickEdit.ts.
    quickEdit: ptBRQuickEdit,
    // Changes the instance on air that "Edição rápida" has loaded, in place.
    updateButton: 'Atualizar',
    clearAllButton: 'Limpar tudo',
    clearAllConfirmButton: 'Confirmar: limpar tudo',
  },
  // The two monitors in the centre and the lines under "Prévia" (features/outputMonitors).
  outputMonitors: {
    previewTitle: 'Prévia',
    programTitle: 'Programa',
    // The accessible name of the list of layers that hold a preview.
    previewedLayersListLabel: 'Em prévia',
    nothingInPreview: 'Nada em prévia.',
    // On each line: send that layer's preview to air, or throw it away.
    takePreviewButton: 'Tomar',
    discardPreviewButton: 'Descartar',
    // What the line of a layer marked "will be cleared" says in place of a graphic.
    willClearLabel: 'vai limpar',
    // Shown while more than one layer has a preview or a mark: every line at once, in
    // one change on the server (takeAllPreviews), or every line thrown away.
    takeAllPreviewsButton: 'Tomar tudo',
    discardAllPreviewsButton: 'Descartar tudo',
  },
  // How long ago something happened, as formatRelativeTimePtBR writes it.
  relativeTime: {
    justNow: 'agora',
    minutesAgo: (minutes: number) => `há ${minutes} min`,
    hoursAgo: (hours: number) => `há ${hours} h`,
    daysAgo: (days: number) => (days === 1 ? 'há 1 dia' : `há ${days} dias`),
  },
  // The item editor (features/items): preparing a new item and changing a saved one.
  itemEditor: {
    panelLabel: 'Editor de item',
    newItemTitle: 'Novo item',
    editItemTitle: 'Editar item',
    // Under the title of a saved item only: a save changes the item, so it shows from the
    // next take on; what is on air now changes only with "Atualizar no ar".
    savedItemNote: 'Item salvo — vale para os próximos disparos',
    fields: {
      graphic: 'Gráfico',
      layer: 'Camada',
      label: 'Rótulo',
      color: 'Cor',
      notes: 'Observações',
      autoOutAfterSeconds: 'Saída automática (segundos, opcional)',
      // Where a new item goes: the rundown on screen or one of the quick-fire panels.
      home: 'Onde',
    },
    // "Gráfico" of a new item until the operator chooses one. None is chosen for them:
    // the order the server lists the graphics in (their package folders) means nothing.
    graphicPlaceholder: 'Escolha um gráfico…',
    // Beside the save buttons of a new item while they are off for want of a graphic.
    saveNeedsAGraphic: 'Escolha um gráfico para salvar o item.',
    homeOptions: {
      rundown: (rundownName: string) => `Rundown: ${rundownName}`,
      quickFirePanel: (panelName: string) => `Painel de atalhos: ${panelName}`,
    },
    // One name per colour of ItemColorSchema, so a colour is never told by colour alone.
    colorNames: {
      neutral: 'Neutra',
      info: 'Informação',
      success: 'Sucesso',
      warning: 'Atenção',
      danger: 'Perigo',
      highlight: 'Destaque',
    },
    fieldErrors: {
      graphicMissing: 'Escolha o gráfico.',
      layerMissing: 'Escolha a camada.',
      labelMissing: 'Informe o rótulo do item.',
      colorMissing: 'Escolha a cor.',
      autoOutAfterSecondsInvalid:
        'Informe os segundos como um número inteiro maior que zero ou deixe em branco.',
    },
    // Beside the read-only graphic of a saved item: another graphic has other fields, so
    // it is another item. (The layer of a saved item can be changed.)
    graphicCannotChange: 'Para outro gráfico, crie um novo item',
    // Shown in place of the graphic's fields when a saved item names a graphic the
    // server no longer has, so there is no manifest to generate the fields from.
    graphicOfItemNotRegistered:
      'O gráfico deste item não está registrado no servidor, então os campos dele não aparecem aqui. Rótulo, cor, observações e saída automática ainda podem ser alterados.',
    fieldsThatCouldNotBeRead: (fieldLabels: string) =>
      `Estes campos do item não puderam ser lidos e aparecem com o valor padrão; salvar grava o que está no formulário: ${fieldLabels}.`,
    saveButton: 'Salvar item',
    // Save the item, then put it on air (takeItem) or in preview (previewItem): the way a
    // graphic made on the spot goes up, since everything on air comes from an item.
    saveAndTakeButton: 'Salvar e disparar',
    saveAndPreviewButton: 'Salvar e prévia',
    // Offered only while the saved item being edited is on air: saves the item and
    // changes its instance on the program output without a new take.
    updateOnAirButton: 'Atualizar no ar',
    cancelButton: 'Cancelar',
  },
  // The form generated from a graphic's manifest (features/schemaForm). Field labels,
  // help texts and dropdown options come from the manifest itself; only the words the
  // form adds around them are here.
  schemaForm: {
    // Shown next to the label of a field the manifest requires.
    requiredMarker: '*',
    requiredMarkerHint: 'Campo obrigatório',
    clearFieldButton: 'limpar',
    // The clear button's accessible name: a form has one per optional field.
    clearFieldButtonLabel: (fieldLabel: string) => `Limpar ${fieldLabel}`,
    // Shown under an optional field that has no value at all.
    clearedFieldNote: 'Sem valor',
    nothingChosenPlaceholder: 'Escolha…',
    durationPlaceholder: 'mm:ss',
    // The small dropdown that says where a field's value comes from.
    kindSelectorLabel: (fieldLabel: string) => `Como preencher ${fieldLabel}`,
    kindLabels: {
      literal: 'Valor digitado',
      takeTime: 'Momento da entrada no ar',
      binding: 'Fonte',
      wholeClock: 'Relógio da fonte',
    },
    // A list field (drawn read-only) that may also read a source: its value as it is.
    listKindAsItIs: 'Valor como está',
    takeTimeNote: 'Preenchido pelo servidor no momento em que entra no ar.',
    unsupportedPropertyNote:
      'O formulário ainda não sabe editar este campo. O valor abaixo é só para leitura e segue como está.',
    unsupportedPropertyWithoutValueNote:
      'O formulário ainda não sabe editar este campo, e ele está sem valor.',
    unsupportedWholeDataLabel: 'Dados do gráfico',
    unsupportedWholeDataNote:
      'O formulário ainda não sabe editar os dados deste gráfico. O que aparece abaixo é só para leitura e segue como está.',
    fieldErrors: {
      required: (fieldLabel: string) => `O campo "${fieldLabel}" é obrigatório.`,
      notText: (fieldLabel: string) => `O campo "${fieldLabel}" precisa ser um texto.`,
      tooShort: (fieldLabel: string, minimumLength: number) =>
        minimumLength === 1
          ? `O campo "${fieldLabel}" precisa ter pelo menos 1 caractere.`
          : `O campo "${fieldLabel}" precisa ter pelo menos ${minimumLength} caracteres.`,
      tooLong: (fieldLabel: string, maximumLength: number) =>
        maximumLength === 1
          ? `O campo "${fieldLabel}" pode ter no máximo 1 caractere.`
          : `O campo "${fieldLabel}" pode ter no máximo ${maximumLength} caracteres.`,
      notOneOfTheOptions: (fieldLabel: string) => `Escolha uma das opções de "${fieldLabel}".`,
      notADateAndTime: (fieldLabel: string) =>
        `O campo "${fieldLabel}" precisa de uma data e hora válidas.`,
      notANumber: (fieldLabel: string) => `O campo "${fieldLabel}" precisa ser um número.`,
      notAWholeNumber: (fieldLabel: string) =>
        `O campo "${fieldLabel}" precisa ser um número inteiro.`,
      // `limit` arrives already written for reading: "0", "1,5" or, for a time, "0:00".
      belowMinimum: (fieldLabel: string, limit: string) =>
        `O campo "${fieldLabel}" não pode ser menor que ${limit}.`,
      aboveMaximum: (fieldLabel: string, limit: string) =>
        `O campo "${fieldLabel}" não pode ser maior que ${limit}.`,
      notMinutesAndSeconds: (fieldLabel: string) =>
        `Use minutos e segundos no formato mm:ss em "${fieldLabel}", por exemplo 12:30.`,
      notOnOrOff: (fieldLabel: string) =>
        `O campo "${fieldLabel}" precisa estar ligado ou desligado.`,
    },
  },
  // The rundown column (features/rundown): the list of prepared items and its buttons.
  rundown: {
    noRundownOnServer: 'O servidor não enviou nenhum rundown.',
    emptyRundown: 'Nenhum item neste rundown. Use "+ Item" para preparar o primeiro.',
    // Shown when there are items but the cursor is on nothing, so Space has nothing to
    // take until the operator places the cursor. The first only after the last item was
    // taken at the cursor (the server marks the rundown); the second in every other case.
    endOfRundownHint: 'Fim do rundown — clique num item para posicionar o cursor',
    placeTheCursorHint: 'Clique num item para posicionar o cursor',
    addItemButton: '+ Item',
    itemListLabel: (rundownName: string) => `Itens de ${rundownName}`,
    // The mark on the row at the cursor: the item Space puts on air.
    nextItemBadge: 'Próximo',
    takeItemButton: 'Disparar',
    // Shows the row's item on the preview output, without putting it on air.
    previewItemButton: 'Prévia',
    // The switch at the top of the rundown: while it is on, moving the cursor by hand
    // (an arrow key or a click on a label) also previews the item the cursor lands on.
    autoPreviewToggle: 'Prévia automática',
    // "Editar item", not "Editar": it changes the stored item (its next takes), which
    // "Edição rápida" (one instance on air) does not.
    editItemButton: 'Editar item',
    // The "⋯" of each row, and its menu (also opened by a right-click on the row).
    moreActionsButton: (itemLabel: string) => `Mais ações: ${itemLabel}`,
    moreActionsSymbol: '⋯',
    // With one quick-fire panel the entry is the action alone; with several, one entry
    // per panel, named with it.
    moveToShortcutsAction: 'Mover para atalhos',
    moveToShortcutsPanelAction: (panelName: string) => `Mover para atalhos: ${panelName}`,
    deleteItemButton: 'Excluir',
    // What "Excluir" reads for 3 seconds after its first press, while it waits for the second.
    deleteItemConfirmButton: 'Confirmar: excluir',
    // The accessible name of a row's label, which is a button that puts the cursor on
    // that row. The eye sees only the label itself.
    setCursorToItemButton: (itemLabel: string) => `Marcar como próximo: ${itemLabel}`,
    moveItemHandle: 'Mover',
    // What a screen reader hears while a row is dragged. dnd-kit's own texts are in
    // English, so every one of them is replaced here.
    dragAndDrop: {
      handleRoleDescription: 'item que pode mudar de posição',
      keyboardInstructions:
        'Para mudar um item de posição, pressione Espaço ou Enter, mova com as setas para cima e para baixo e pressione Espaço ou Enter de novo para soltar. Esc cancela.',
      pickedUp: (itemLabel: string) => `Item ${itemLabel} levantado.`,
      movedOver: (itemLabel: string, otherItemLabel: string) =>
        `Item ${itemLabel} sobre a posição de ${otherItemLabel}.`,
      // dnd-kit reports a row as "over itself" right after it is picked up, and again
      // whenever it is brought back to where it started.
      overItsOwnPlace: (itemLabel: string) => `Item ${itemLabel} no lugar de onde saiu.`,
      movedOutsideTheList: (itemLabel: string) => `Item ${itemLabel} fora da lista.`,
      dropped: (itemLabel: string) =>
        `Item ${itemLabel} solto. A nova ordem aparece quando o servidor confirmar.`,
      leftWhereItWas: (itemLabel: string) => `Item ${itemLabel} continua onde estava.`,
    },
  },
} as const;
