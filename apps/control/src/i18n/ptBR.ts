/**
 * pt-BR catalog: every string the operator reads on the control page comes from here,
 * never written inline in a component, so the wording can be reviewed in one place.
 */
export const ptBR = {
  app: {
    title: 'BajaOvrLay',
    rundownAreaTitle: 'Rundown',
    playoutAreaTitle: 'Programa e relógio',
    layersAreaTitle: 'Camadas',
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
  layers: {
    emptyLayer: 'vazia',
    clearLayerButton: 'Limpar',
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
  },
  playout: {
    raceClockPanelTitle: 'Relógio de prova',
    fields: {
      sessionName: 'Nome da sessão',
      state: 'Bandeira',
      clockMode: 'Modo do relógio',
      running: 'Relógio correndo',
      referenceTime: 'Tempo de referência (mm:ss)',
      lapsCompletedByLeader: 'Voltas do líder (opcional)',
    },
    // What the session name field opens with. It repeats the `default` the race clock's
    // manifest declares for `sessionName`, and goes on air if the operator leaves it.
    defaultSessionName: 'Enduro de Resistência',
    // The same six labels the race clock's manifest gives its `state` values.
    flagStateLabels: {
      pre: 'Pré-largada',
      green: 'Verde',
      yellow: 'Amarela',
      red: 'Vermelha',
      checkered: 'Quadriculada',
      finished: 'Encerrada',
    },
    clockModeLabels: {
      elapsed: 'Tempo decorrido',
      remaining: 'Tempo restante',
    },
    fieldErrors: {
      sessionNameMissing: 'Informe o nome da sessão.',
      stateMissing: 'Escolha a bandeira.',
      clockModeMissing: 'Escolha o modo do relógio.',
      runningMissing: 'Diga se o relógio está correndo ou parado.',
      referenceTimeMissing: 'Informe o tempo de referência.',
      referenceTimeInvalid: 'Use minutos e segundos no formato mm:ss, por exemplo 12:30.',
      lapsCompletedByLeaderInvalid: 'Informe as voltas como um número inteiro ou deixe em branco.',
      // "Atualizar" changes fields of the clock on air; it cannot take one away.
      lapsCannotBeRemovedByUpdate:
        '"Atualizar" não tira as voltas do ar. Use "Colocar no ar" para isso.',
    },
    takeButton: 'Colocar no ar',
    updateButton: 'Atualizar',
    clearAllButton: 'Limpar tudo',
    clearAllConfirmButton: 'Confirmar: limpar tudo',
  },
  programMonitor: {
    title: 'Programa',
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
    fields: {
      graphic: 'Gráfico',
      layer: 'Camada',
      label: 'Rótulo',
      color: 'Cor',
      notes: 'Observações',
      autoOutAfterSeconds: 'Saída automática (segundos, opcional)',
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
      lapsCannotBeRemoved:
        'As voltas de um item salvo não podem ser apagadas. Informe um número ou exclua o item e crie outro.',
    },
    graphicAndLayerCannotChange:
      'O gráfico e a camada de um item salvo não mudam. Para trocá-los, exclua o item e crie outro.',
    genericEditorComesLater:
      'Editor genérico chega em BAJAOVRLAY-14. Até lá, os campos deste gráfico não podem ser preenchidos aqui.',
    fieldsThatCouldNotBeRead: (fieldLabels: string) =>
      `Estes campos do item não puderam ser lidos e aparecem com o valor padrão; salvar grava o que está no formulário: ${fieldLabels}.`,
    saveButton: 'Salvar item',
    cancelButton: 'Cancelar',
  },
  // The rundown column (features/rundown): the list of prepared items and its buttons.
  rundown: {
    noRundownOnServer: 'O servidor não enviou nenhum rundown.',
    emptyRundown: 'Nenhum item neste rundown. Use "+ Item" para preparar o primeiro.',
    addItemButton: '+ Item',
    itemListLabel: (rundownName: string) => `Itens de ${rundownName}`,
    // The mark on the row at the cursor: the item Space puts on air.
    nextItemBadge: 'Próximo',
    takeItemButton: 'Disparar',
    editItemButton: 'Editar',
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
