/**
 * pt-BR catalog, quick-fire part: the strip of tabs in the right column, its panels of
 * buttons (features/quickFire) and its "Macros" tab with the macro editor
 * (features/macros). Kept in a file of its own so ptBR.ts stays readable; ptBR.ts makes it
 * `ptBR.quickFire`.
 */
export const ptBRQuickFire = {
  // The area above the layer panel, and its row of tabs.
  areaTitle: 'Atalhos e macros',
  tabListLabel: 'Abas de atalhos',
  macrosTab: 'Macros',
  // The small "F1" written on a tab: the key that opens it, as keyboardMap.ts lists it
  // (only the tabs the map has a key for show one). Function keys keep their name in pt-BR.
  tabKey: (functionKey: string) => functionKey,

  // Making, renaming and deleting panels.
  addPanelButton: '+ Painel',
  newPanelNameLabel: 'Nome do novo painel',
  createPanelButton: 'Criar painel',
  renamePanelButton: 'Renomear',
  panelNameLabel: 'Novo nome do painel',
  savePanelNameButton: 'Salvar nome',
  deletePanelButton: 'Excluir painel',
  cancelButton: 'Cancelar',
  panelNameMissing: 'Informe o nome do painel.',

  // One panel: its grid of buttons.
  buttonGridLabel: (panelName: string) => `Atalhos de ${panelName}`,
  addItemToPanelButton: '+ Atalho',
  emptyPanel: 'Crie um item aqui para ter um atalho',
  // The "⋯" beside each button, and its menu (also opened by a right-click on the button).
  moreActionsButton: (itemLabel: string) => `Mais ações: ${itemLabel}`,
  moreActionsSymbol: '⋯',
  previewAction: 'Prévia',
  editAction: 'Editar',
  moveToRundownAction: 'Mover para rundown',

  // The "Macros" tab: its grid of buttons.
  macros: {
    gridLabel: 'Macros',
    emptyMacros: 'Nenhuma macro. Use "+ Macro" para criar a primeira.',
    addMacroButton: '+ Macro',
    // The macro running now: a word and the step it is on, such as "Rodando 2/3".
    runningBadge: (currentStepNumber: number, numberOfSteps: number) =>
      `Rodando ${currentStepNumber}/${numberOfSteps}`,
    // A macro with no step has no step to count: its run lasts a moment and says only this.
    runningBadgeWithoutSteps: 'Rodando',
    // After "Parar" was accepted, until the server's runner ends the run.
    stoppingBadge: 'Parando…',
    // "Parar" beside a running macro: named with the macro for a screen reader.
    stopMacroButton: (macroLabel: string) => `Parar macro: ${macroLabel}`,
    stopMacroSymbol: 'Parar',
    editMacroButton: (macroLabel: string) => `Editar macro: ${macroLabel}`,
    editMacroSymbol: 'Editar',
  },

  // The macro editor (features/macros/MacroEditorPanel.tsx).
  macroEditor: {
    panelLabel: 'Editor de macro',
    newMacroTitle: 'Nova macro',
    editMacroTitle: 'Editar macro',
    labelField: 'Rótulo da macro',
    colorField: 'Cor da macro',
    stepsTitle: 'Passos',
    stepListLabel: 'Passos da macro',
    noSteps: 'Nenhum passo ainda. Use "+ Passo" para acrescentar.',
    addStepButton: '+ Passo',
    stepRowLabel: (stepNumber: number) => `Passo ${stepNumber}`,
    // Each row's controls are named with the step's number, so a screen reader (and a
    // test) can tell the third step's "Remover" from the first's.
    stepKindLabel: (stepNumber: number) => `Tipo do passo ${stepNumber}`,
    itemPickerLabel: (stepNumber: number) => `Item do passo ${stepNumber}`,
    layerPickerLabel: (stepNumber: number) => `Camada do passo ${stepNumber}`,
    waitSecondsLabel: (stepNumber: number) => `Espera do passo ${stepNumber} (segundos)`,
    removeStepButton: (stepNumber: number) => `Remover passo ${stepNumber}`,
    removeStepSymbol: 'Remover',
    moveStepHandle: (stepNumber: number) => `Mover passo ${stepNumber}`,
    stepKindNames: {
      takeItem: 'Pôr item no ar',
      clearLayer: 'Limpar camada',
      clearAll: 'Limpar tudo',
      wait: 'Esperar',
    },
    // An item in the item picker: its label and where it lives, since two items of
    // different homes may share a label.
    itemOption: (itemLabel: string, homeName: string) => `${itemLabel} (${homeName})`,
    nothingChosenPlaceholder: 'Escolha…',
    saveButton: 'Salvar macro',
    deleteButton: 'Excluir macro',
    deleteConfirmButton: 'Confirmar: excluir macro',
    cancelButton: 'Cancelar',
    fieldErrors: {
      labelMissing: 'Informe o rótulo da macro.',
      itemMissing: 'Escolha o item deste passo.',
      layerMissing: 'Escolha a camada deste passo.',
      waitInvalid: 'Informe a espera em segundos, de 0,001 a 10 (por exemplo 0,5).',
    },
    // What a screen reader hears while a step is dragged; dnd-kit's own texts are English.
    dragAndDrop: {
      handleRoleDescription: 'passo que pode mudar de posição',
      keyboardInstructions:
        'Para mudar um passo de posição, pressione Espaço ou Enter, mova com as setas para cima e para baixo e pressione Espaço ou Enter de novo para soltar. Esc cancela.',
      pickedUp: (stepNumber: number) => `Passo ${stepNumber} levantado.`,
      movedOver: (stepNumber: number, otherStepNumber: number) =>
        `Passo ${stepNumber} sobre a posição do passo ${otherStepNumber}.`,
      overItsOwnPlace: (stepNumber: number) => `Passo ${stepNumber} no lugar de onde saiu.`,
      movedOutsideTheList: (stepNumber: number) => `Passo ${stepNumber} fora da lista.`,
      dropped: (stepNumber: number) => `Passo ${stepNumber} solto na nova posição.`,
      leftWhereItWas: (stepNumber: number) => `Passo ${stepNumber} continua onde estava.`,
    },
  },
} as const;
