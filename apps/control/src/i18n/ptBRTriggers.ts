/**
 * The control page's pt-BR texts about triggers (BAJAOVRLAY-48), reached as ptBR.triggers:
 * "Gatilhos" on the "Eventos" page (features/triggers), the firings that ask in the
 * "Eventos" tab, "Pausar gatilhos" in the header, and a take step's "Dado do gatilho" in
 * the macro editor.
 */
export const ptBRTriggers = {
  openButton: 'Gatilhos',
  dialog: {
    title: 'Gatilhos',
    description:
      'Um gatilho roda uma macro quando algo acontece fora das mãos do operador: uma cena do OBS, uma chamada HTTP, um evento da caixa de entrada ou um horário da programação.',
    closeButton: 'Fechar',
    listLabel: 'Lista de gatilhos',
    noTriggers: 'Nenhum gatilho ainda. Use "+ Gatilho" para criar o primeiro.',
    addButton: '+ Gatilho',
    editButton: (triggerName: string) => `Editar ${triggerName}`,
    editWord: 'Editar',
    enabledWord: 'Ligado',
    disabledWord: 'Desligado',
    intervalText: (seconds: number) => `a cada ${seconds} s no mínimo`,
    macroMissing: 'macro excluída',
  },
  editor: {
    newTitle: 'Novo gatilho',
    editTitle: (triggerName: string) => `Editar gatilho: ${triggerName}`,
    nameLabel: 'Nome do gatilho',
    enabledLabel: 'Gatilho ligado',
    kindLabel: 'Quando',
    kindNames: {
      obsScene: 'Cena do OBS',
      http: 'Chamada HTTP',
      dataEvent: 'Evento da caixa de entrada',
      schedule: 'Horário',
    },
    sceneChangeLabel: 'Entrou ou saiu',
    sceneChangeNames: { entered: 'Entrou na cena', left: 'Saiu da cena' },
    sceneNameLabel: 'Cena do OBS',
    sceneNameHint:
      'Escreva o nome como o OBS o mostra; as cenas do OBS conectado aparecem como sugestão.',
    dataEventKindLabel: 'Tipo de evento',
    dataEventKindNames: {
      penalty: 'Penalidade',
      fastestLap: 'Volta mais rápida',
      leaderChange: 'Troca de líder',
      incident: 'Incidente',
    },
    scheduleMomentKindLabel: 'Tipo de horário',
    scheduleMomentKindNames: {
      timeOfDay: 'Hora do dia',
      slotStart: 'Antes ou depois de uma sessão',
    },
    timeOfDayLabel: 'Hora (HH:MM, horário de Brasília)',
    minutesLabel: 'Minutos',
    slotDirectionLabel: 'Antes ou depois',
    slotDirectionNames: { before: 'antes do início', after: 'depois do início' },
    slotLabel: 'Sessão da programação',
    everySlot: 'Todas as sessões',
    macroLabel: 'Macro',
    modeLabel: 'Modo',
    modeNames: { auto: 'Automático', ask: 'Perguntar' },
    intervalLabel: 'Intervalo mínimo entre disparos (segundos)',
    nothingChosenPlaceholder: 'Escolha…',
    saveButton: 'Salvar gatilho',
    deleteButton: 'Excluir gatilho',
    deleteConfirmButton: 'Confirmar: excluir gatilho',
    backButton: 'Voltar à lista',
    problems: {
      nameMissing: 'Informe o nome do gatilho.',
      sceneMissing: 'Informe a cena do OBS.',
      timeOfDayInvalid: 'Informe o horário como HH:MM, de 00:00 a 23:59 (por exemplo 07:30).',
      minutesInvalid: 'Informe os minutos como um número inteiro de 0 a 720.',
      macroMissing: 'Escolha a macro do gatilho.',
      intervalInvalid: 'Informe o intervalo mínimo em segundos, de 1 a 3600.',
    },
  },
  /** One trigger's `when` in words, for the list. */
  whenText: {
    obsScene: (change: 'entered' | 'left', sceneName: string) =>
      change === 'entered' ? `Entrou na cena "${sceneName}"` : `Saiu da cena "${sceneName}"`,
    http: 'Chamada HTTP',
    dataEvent: (eventKindName: string) => `Evento: ${eventKindName}`,
    timeOfDay: (timeOfDay: string) => `Às ${timeOfDay}`,
    slotStart: (minutes: number, isBefore: boolean, slotName: string) =>
      `${minutes} min ${isBefore ? 'antes' : 'depois'} de ${slotName}`,
    everySlot: 'cada sessão',
    slotMissing: 'uma sessão excluída',
  },
  http: {
    addressLabel: 'Endereço do gatilho',
    curlLabel: 'Exemplo com curl',
    explanation:
      'Chame este endereço com POST, com o token da API (ou com a API aberta na rede). O corpo, opcional, é um objeto JSON simples de textos e números, até 8 KB: vira o dado do gatilho.',
    addressAfterSave: 'O endereço aparece depois de salvar o gatilho.',
  },
  firings: {
    listLabel: 'Gatilhos esperando',
    title: (triggerName: string, macroLabel: string) => `Gatilho: ${triggerName} → ${macroLabel}`,
    dataLabel: 'Dado do gatilho',
    dataEntry: (key: string, value: string) => `${key}: ${value}`,
    noData: 'sem dado',
    autoRunRefusal: (reason: string) => `Não rodou sozinho: ${reason}`,
    runButton: 'Rodar',
    dismissButton: 'Descartar',
    recentlyDismissedListLabel: 'Gatilhos descartados agora há pouco',
    dismissedWord: 'descartado',
    undoDismissButton: 'Desfazer',
  },
  // The pause of every trigger: an entry of the header's menu, and the header's chip
  // while paused (BAJAOVRLAY-62).
  pause: {
    pauseMenuEntry: 'Pausar gatilhos',
    resumeMenuEntry: 'Retomar gatilhos',
    pausedChip: 'Gatilhos pausados',
    resumeButton: 'Retomar',
  },
  takeStep: {
    showFieldsButton: 'Campos do gatilho',
    showFieldsButtonLabel: (stepNumber: number) => `Campos do gatilho do passo ${stepNumber}`,
    fieldsLegend: (stepNumber: number) => `Campos do item no passo ${stepNumber}`,
    noFields: 'O gráfico deste item não tem campos para preencher.',
    fieldSourceLabel: (fieldTitle: string, stepNumber: number) =>
      `Origem de ${fieldTitle} no passo ${stepNumber}`,
    fieldSourceNames: { item: 'Valor do item', triggerData: 'Dado do gatilho' },
    keyLabel: (fieldTitle: string, stepNumber: number) =>
      `Chave do gatilho para ${fieldTitle} no passo ${stepNumber}`,
    keyPrefix: 'Dado do gatilho ›',
    requiredMark: '(obrigatório)',
    byHandNote:
      'Rodada à mão, a macro não tem dado de gatilho: se um campo obrigatório vem do gatilho, a macro para neste passo; um campo opcional fica de fora.',
    keyInvalid: 'Escreva a chave de cada campo que vem do gatilho (de 1 a 64 caracteres).',
  },
} as const;
