/**
 * pt-BR catalog for every message the server sends to people (error answers the
 * control page shows to the operator). Log messages stay in English: they are for
 * developers and are searched with tools, not read on air.
 */
export const ptBR = {
  errors: {
    routeNotFound: 'Endereço não encontrado no servidor.',
    unexpectedServerError:
      'Erro inesperado no servidor. Procure no log do servidor o request_id desta resposta.',
    invalidStateRole: 'O parâmetro "role" aceita apenas "renderer" ou "monitor".',
  },
  // Answers to commands and WebSocket messages; each goes with a stable code
  // (CommandErrorCodeSchema in @bajaovrlay/shared).
  commandErrors: {
    invalidCommandField: (fieldPath: string) =>
      `Comando inválido: o campo "${fieldPath}" está ausente ou tem um valor errado.`,
    invalidCommandShape: 'Comando inválido: envie um objeto com o campo "type".',
    commandNotAllowed: 'Você não tem permissão para executar este comando.',
    layerNotFound: (layerId: string) => `A camada "${layerId}" não existe.`,
    graphicNotFound: (graphicId: string) => `O gráfico "${graphicId}" não está registrado.`,
    instanceNotFound: (instanceId: string) =>
      `A instância "${instanceId}" não existe; o gráfico pode já ter saído do ar.`,
    // "Tomar" was pressed for a layer whose preview is empty (already taken or discarded).
    layerPreviewEmpty: (layerName: string) =>
      `Não há nada em prévia na camada "${layerName}" para colocar no ar.`,
    // The four ways a take's or an update's data can fail the graphic's manifest
    // schema. The first three name the field, so the operator knows what to correct.
    graphicDataFieldMissing: (graphicId: string, fieldPath: string) =>
      `Dados inválidos para o gráfico "${graphicId}": o campo "${fieldPath}" é obrigatório e não foi enviado.`,
    graphicDataFieldUnknown: (graphicId: string, fieldPath: string) =>
      `Dados inválidos para o gráfico "${graphicId}": o campo "${fieldPath}" não existe neste gráfico.`,
    graphicDataFieldValueInvalid: (graphicId: string, fieldPath: string) =>
      `Dados inválidos para o gráfico "${graphicId}": o campo "${fieldPath}" tem um valor que o gráfico não aceita.`,
    graphicDataSchemaUnusable: (graphicId: string) =>
      `O gráfico "${graphicId}" tem um esquema de dados que o servidor não consegue ler. Corrija o manifesto do gráfico e reinicie o servidor.`,
    // A command asked the server to write its own moment into a field that the
    // graphic's manifest does not mark as a wall-clock moment.
    graphicFieldCannotBeStamped: (graphicId: string, fieldKey: string) =>
      `O gráfico "${graphicId}" não aceita que o servidor preencha o campo "${fieldKey}" com o momento do comando: o manifesto do gráfico não marca esse campo como um horário (número inteiro com v_baja.role "wallClock").`,
    // The two ways the update rule a manifest names (v_baja.updateRule) cannot be run.
    // Both are mistakes in the manifest, so both say what to correct and where.
    graphicUpdateRuleUnknown: (graphicId: string, ruleName: string) =>
      `O gráfico "${graphicId}" não pode ser atualizado no ar: o manifesto dele pede a regra de atualização "${ruleName}", que o servidor não conhece. Corrija o manifesto do gráfico e reinicie o servidor.`,
    graphicUpdateRuleFieldsMissing: (
      graphicId: string,
      ruleName: string,
      missingFieldKeys: string[],
    ) =>
      `O gráfico "${graphicId}" não pode ser atualizado no ar: o manifesto dele pede a regra de atualização "${ruleName}", mas o esquema de dados não declara os campos de que ela precisa (${missingFieldKeys.join(', ')}). Corrija o manifesto do gráfico e reinicie o servidor.`,
    invalidMessage: 'Mensagem inválida: o servidor aceita apenas mensagens JSON do protocolo.',
    unexpectedServerError:
      'Erro inesperado no servidor ao executar o comando. Procure o erro no log do servidor.',
  },
  // Names of the layers seeded on the first boot, as the operator sees them.
  seededLayerNames: {
    bug: 'Logo',
    ticker: 'Letreiro',
    clock: 'Relógio',
    lowerThird: 'Tarja',
    fullscreen: 'Tela cheia',
  },
  // Name of the one rundown seeded on the first boot, as the operator sees it.
  seededRundownName: 'Sessão principal',
  // Name of the one quick-fire panel seeded on the first boot, as the operator sees it.
  seededQuickFirePanelName: 'Atalhos',
  // Refusals of the rundown and item commands; each goes with a stable code, like
  // commandErrors above. A rundown and an item are named by what the
  // operator reads on screen (name, label) whenever the server has it, and by id when
  // the id is all there is because the thing was not found.
  rundownCommandErrors: {
    itemNotFound: (itemId: string) => `O item "${itemId}" não existe; ele pode ter sido excluído.`,
    rundownNotFound: (rundownId: string) => `O rundown "${rundownId}" não existe.`,
    itemNotInRundown: (itemLabel: string, rundownName: string) =>
      `O item "${itemLabel}" pertence a outro rundown, não a "${rundownName}".`,
    // moveCursor named a quick-fire panel button: it can never be the rundown's "next".
    itemIsAQuickFireButton: (itemLabel: string, rundownName: string) =>
      `O item "${itemLabel}" é um botão do painel de atalhos, não um item do rundown "${rundownName}".`,
    itemsNotAPermutation: (rundownName: string) =>
      `A nova ordem do rundown "${rundownName}" não confere com os itens dele: ela precisa trazer todos os itens do rundown, cada um uma única vez.`,
    rundownCursorEmpty: (rundownName: string) =>
      `O rundown "${rundownName}" não tem próximo item: o cursor não está em nenhum item. Escolha o próximo item antes de colocar no ar.`,
    unsupportedFieldKind: (fieldKey: string, fieldKind: string) =>
      `O campo "${fieldKey}" usa um valor do tipo "${fieldKind}", que o servidor só vai saber resolver no marco M2 (BAJAOVRLAY-20). Por enquanto, preencha o campo com um valor literal.`,
  },
  // Refusals about what was changed on air and saving it into the item (BAJAOVRLAY-37);
  // each goes with a stable code. The layer is named as the operator reads it.
  onAirChangeErrors: {
    instanceWithoutItem: (layerName: string) =>
      `O que está na camada ${layerName} não veio de um item. Use "Salvar como item".`,
    previewWithoutItem: (layerName: string) =>
      `A prévia da camada ${layerName} não veio de um item e não pode ir ao ar. Descarte-a e use um item.`,
    nothingChangedOnAir: (itemLabel: string) =>
      `Nada foi alterado no ar desde que o item "${itemLabel}" entrou; não há o que salvar.`,
  },
  // Refusals of the quick-fire panel commands; each goes with a stable code. A panel is
  // named by its name when the server has it, and by id when it was not found.
  quickFirePanelErrors: {
    panelNotFound: (panelId: string) => `O painel de atalhos "${panelId}" não existe.`,
    panelNotEmpty: (panelName: string, numberOfItems: number) =>
      `O painel "${panelName}" ainda tem ${numberOfItems === 1 ? '1 item' : `${numberOfItems} itens`}. Mova ou exclua os itens dele antes de excluir o painel.`,
    lastPanel: (panelName: string) =>
      `O painel "${panelName}" é o único painel de atalhos e não pode ser excluído. Crie outro painel antes.`,
  },
  // Refusals of "Tomar tudo" (takeAllPreviews) and of a macro's "Prévia" (previewMacro).
  // When one layer or one step cannot be done, the whole command is refused: the message
  // says so, names the layer or the step, and ends with the reason of that layer or step.
  previewErrors: {
    nothingInPreview:
      'Não há nada em prévia para colocar no ar: nenhuma camada tem prévia nem está marcada para limpar.',
    takeAllRefusedAtLayer: (layerName: string, reasonOfTheLayer: string) =>
      `"Tomar tudo" não foi feito e nada mudou: a camada "${layerName}" não pode ir ao ar. ${reasonOfTheLayer}`,
    previewMacroRefusedAtStep: (
      macroLabel: string,
      stepPosition: number,
      stepDescription: string,
      reasonOfTheStep: string,
    ) =>
      `A prévia da macro "${macroLabel}" não foi feita e nada mudou: o passo ${stepPosition} (${stepDescription}) não pode ser mostrado. ${reasonOfTheStep}`,
    previewMacroWhileAMacroRuns: (macroLabel: string, runningMacroLabel: string) =>
      `A prévia da macro "${macroLabel}" não pode ser feita enquanto a macro "${runningMacroLabel}" está rodando.`,
  },
  // A macro step in words, for the messages above. An item is named by its label and a
  // layer by its name when the server has them, by id when not.
  macroStepDescriptions: {
    takeItem: (itemLabel: string) => `pôr no ar o item "${itemLabel}"`,
    clearLayer: (layerName: string) => `limpar a camada "${layerName}"`,
    clearAll: 'limpar tudo',
    wait: (milliseconds: number) => `esperar ${milliseconds} ms`,
  },
  // Refusals of the macro commands; each goes with a stable code. A macro is named by
  // its label when the server has it, and by id when it was not found.
  macroErrors: {
    macroNotFound: (macroId: string) => `A macro "${macroId}" não existe.`,
    anotherMacroRunning: (macroLabel: string, runningMacroLabel: string) =>
      `A macro "${macroLabel}" não pode começar enquanto a macro "${runningMacroLabel}" está rodando.`,
    macroIsRunning: (macroLabel: string) =>
      `A macro "${macroLabel}" está rodando agora. Espere ela terminar para alterá-la ou excluí-la.`,
  },
  // Name of the one data source seeded on a database with none, as the operator sees it.
  seededDataSourceLabel: 'Simulador — Enduro',
  // Refusals of the data-source commands, each with a stable code, and the errors a poll
  // can leave on a source. A source is named by its label when the server has it, and by
  // id when it was not found.
  dataSourceErrors: {
    dataSourceNotFound: (sourceId: string) =>
      `A fonte de dados "${sourceId}" não existe; ela pode ter sido excluída.`,
    invalidConfigField: (fieldPath: string) =>
      `A configuração da fonte é inválida: o campo "${fieldPath}" está ausente ou tem um valor errado.`,
    dataSourceDisabled: (sourceLabel: string) =>
      `A fonte de dados "${sourceLabel}" está desligada. Ligue-a antes.`,
    dataSourceNotASimulator: (sourceLabel: string) =>
      `A fonte de dados "${sourceLabel}" não é um simulador; só um simulador tem corrida para reiniciar.`,
    recordingNotFound: (recordingId: string) =>
      `A gravação "${recordingId}" não existe ou ainda está sendo gravada.`,
    // A poll answered a shape name that is none of the four canonical shapes: a bug in
    // the adapter. Worded like the shape validator's errors, naming the path.
    unknownShapeKey: (shapeKey: string) =>
      `Dados inválidos em "${shapeKey}": este formato de dados não existe (os formatos são session, positions, standings e brackets).`,
    // A "good" poll that carried no shape at all: an adapter that answered nothing. Kept
    // as a failure so the last good data stays on air (rule 4).
    noShapesInPoll: 'A fonte respondeu sem nenhum dado.',
    // A failed poll whose adapter gave no reason (an Error with no message).
    failedPollWithoutReason: 'A leitura da fonte falhou sem dizer o motivo.',
    // The poller called a poll off: the source took longer than min(interval, 10 s).
    pollTimedOut: (timeoutSeconds: number) =>
      `Tempo esgotado: a fonte não respondeu em ${timeoutSeconds.toLocaleString('pt-BR')} s.`,
    // The poller's stale watch: no good poll for longer than staleAfterMs, typically
    // because a poll hangs and ignores the timeout.
    noNewDataFor: (seconds: number) => `Sem dados novos há ${String(seconds)} s.`,
    // A source of a kind the server has no adapter for (a bug, or a kind not built yet).
    noAdapterForKind: (kind: string) => `O servidor ainda não sabe ler fontes do tipo "${kind}".`,
    // GET /api/v1/data-sources/{sourceId}/snapshot on a source that never polled well.
    dataSnapshotNotFound: (sourceLabel: string) =>
      `A fonte de dados "${sourceLabel}" ainda não tem dados.`,
    // The recorder could not append a line (disk full, folder without permission): the
    // recording stops with this reason on the source, which keeps polling (D9).
    recordingWriteFailed:
      'A gravação parou: o servidor não conseguiu escrever o arquivo (disco cheio ou sem permissão).',
    // A recording reached its duration cap (6 h) and stopped itself, so a recording left
    // running overnight cannot fill the disk (gate 2 on PR #16).
    recordingDurationCapReached: (hours: number) =>
      `A gravação parou sozinha: chegou a ${hours.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} h, o limite de duração de uma gravação.`,
    // A recording's next line would have taken its file past the size cap (300 MB).
    recordingSizeCapReached: (megabytes: number) =>
      `A gravação parou sozinha: chegou a ${megabytes.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} MB, o limite de tamanho de uma gravação.`,
    // A replay reached a recorded line whose shapes fail today's schema (hand-edited, or
    // recorded before a rule got stricter): that poll fails, naming the first problem.
    recordedLineInvalid: (recordingId: string, reason: string) =>
      `Uma linha da gravação "${recordingId}" é inválida: ${reason}`,
    // A replay whose recording file is gone from the recordings folder (deleted by hand).
    recordingFileNotFound: (recordingId: string) =>
      `O arquivo da gravação "${recordingId}" não foi encontrado.`,
    // A replay whose recording file exists but could not be read (permissions, a folder).
    recordingFileUnreadable: (recordingId: string) =>
      `O arquivo da gravação "${recordingId}" não pôde ser lido.`,
    // A replay whose recording holds no line that can be replayed (stopped before the
    // first poll, or every line damaged).
    recordingHasNoData: (recordingId: string) =>
      `A gravação "${recordingId}" não tem nenhum dado para reproduzir.`,
    // A simulator source with "falha simulada" switched on: every poll fails on purpose,
    // so the operator can rehearse a late source.
    simulatedFailure: 'Falha simulada.',
  },
  // The names the race simulator gives its event and session. They can reach the air
  // through a binding, so they say plainly that the race is simulated.
  simulatorSession: {
    eventName: 'Baja SAE Brasil — Simulação',
    sessionName: 'Enduro de Resistência (simulado)',
  },
} as const;
