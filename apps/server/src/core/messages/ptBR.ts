import { ptBRBackup } from './ptBRBackup.js';
import { ptBRBindingErrors } from './ptBRBindings.js';
import { ptBREventErrors } from './ptBREvents.js';
import { ptBRMediaErrors } from './ptBRMedia.js';
import { ptBRObs } from './ptBRObs.js';
import { ptBROperatorLoginErrors } from './ptBROperatorLogin.js';
import { ptBROutputs } from './ptBROutputs.js';
import { ptBRProgramHistoryErrors } from './ptBRProgramHistory.js';
import { ptBRTriggers } from './ptBRTriggers.js';

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
    // GET /api/v1/event-log with a query it cannot read (BAJAOVRLAY-30).
    invalidEventLogQuery:
      'Consulta do histórico inválida: "limit" vai de 1 a 500, "before" é o número de uma linha e cada filtro aceita só os seus valores.',
    // A sample request ("Buscar da fonte") the config schema refused without a sentence of
    // its own; the schema's own pt-BR reason is sent whenever it has one.
    invalidSampleRequest: 'A requisição de exemplo é inválida.',
    // A body sent as JSON that cannot be parsed at all (cut off, or not JSON).
    malformedJsonBody: 'O corpo da requisição não é JSON válido.',
    // The command API (BAJAOVRLAY-28) with BAJAOVRLAY_API_TOKENS unset: it says how to turn it on.
    apiTurnedOff:
      'API de comandos desligada: defina BAJAOVRLAY_API_TOKENS, ou BAJAOVRLAY_API_OPEN=true numa rede só do estúdio.',
    // A request to the command API with no token, a wrong one, or another scheme than Bearer.
    apiTokenRefused: 'Token de API ausente ou errado: envie Authorization: Bearer <token>.',
    // POST /take-next with no rundown at all: the server seeds one, so only a damaged
    // database could leave none.
    noRundownToTakeFrom: 'Não há rundown no servidor para tomar o próximo item.',
    // POST /api/v1/commands with a body not sent as JSON (a form, plain text, no header).
    commandBodyNotJson: 'Envie o comando como JSON: Content-Type: application/json.',
    // POST /api/v1/commands with a body over 256 KB, refused before it is read in full.
    commandBodyTooLarge: 'O comando passa de 256 KB; um comando nunca precisa de tanto.',
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
    // "Próximo" on a layer with nothing on air, or on a graphic with no step left
    // (BAJAOVRLAY-47).
    nothingOnAirOnLayer: (layerName: string) => `Não há nada no ar na camada "${layerName}".`,
    stepAlreadyMoved: (graphicName: string, layerName: string, stepNumber: number) =>
      `"${graphicName}" em "${layerName}" já passou para o passo ${stepNumber}; o Próximo anterior já foi aplicado.`,
    noNextStep: (graphicName: string, layerName: string) =>
      `"${graphicName}" já está no último passo em "${layerName}". Use Limpar para tirá-lo do ar.`,
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
    channelLogo: 'Logo do canal',
    ticker: 'Letreiro',
    clock: 'Relógio',
    tower: 'Torre',
    lowerThird: 'Tarja',
    notice: 'Aviso',
    fullscreen: 'Tela cheia',
  },
  // Name of the one rundown seeded on the first boot, as the operator sees it.
  seededRundownName: 'Sessão principal',
  // Name of the one quick-fire panel seeded on the first boot, as the operator sees it.
  seededQuickFirePanelName: 'Atalhos',
  // Label of the channel logo item seeded once per database (BAJAOVRLAY-63).
  seededChannelLogoItemLabel: 'Logo do canal',
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
      `O campo "${fieldKey}" usa um valor do tipo "${fieldKind}", que este servidor não sabe resolver. Preencha o campo com um valor digitado, de uma fonte de dados ou dos cadastros.`,
  },
  // Refusals about item fields read from a data source (BAJAOVRLAY-20); see ptBRBindings.ts.
  bindingErrors: ptBRBindingErrors,
  // Refusals about the event inbox (BAJAOVRLAY-44); see ptBREvents.ts.
  eventErrors: ptBREventErrors,
  // Refusals of "Desfazer" and "Desfazer última" (BAJAOVRLAY-30); see ptBRProgramHistory.ts.
  programHistoryErrors: ptBRProgramHistoryErrors,
  // Refusals about the media store: uploads, serving, deleting (BAJAOVRLAY-19); ptBRMedia.ts.
  mediaErrors: ptBRMediaErrors,
  // The backup download: its refusals and its leia-me.txt (BAJAOVRLAY-33); ptBRBackup.ts.
  backup: ptBRBackup,
  // Outputs and the editing of layers: names and refusals (BAJAOVRLAY-49); ptBROutputs.ts.
  outputs: ptBROutputs,
  // OBS control: connection errors and the refusals of a scene switch (BAJAOVRLAY-27).
  obs: ptBRObs,
  // Triggers: refusals, and why one did not fire (BAJAOVRLAY-48); see ptBRTriggers.ts.
  triggers: ptBRTriggers,
  // The operator login (BAJAOVRLAY-29): PINs, the lockout, a missing session.
  operatorLoginErrors: ptBROperatorLoginErrors,
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
    // fire-shortcut/<panelId>/<n> of the command API with no button n (BAJAOVRLAY-28);
    // `buttonNumberAsSent` is the URL's text, which may be no number at all.
    buttonNotFound: (panelName: string, buttonNumberAsSent: string, numberOfButtons: number) =>
      numberOfButtons === 0
        ? `O painel "${panelName}" não tem botões.`
        : `O painel "${panelName}" não tem o botão "${buttonNumberAsSent}"; seus botões vão de 1 a ${numberOfButtons}.`,
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
    obsScene: (sceneName: string) => `trocar a cena do OBS para "${sceneName}"`,
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
      `Dados inválidos em "${shapeKey}": este formato de dados não existe (os formatos são session, positions, standings, brackets e incidents).`,
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
    // A replay poll called off (its timeout) while the recording is still being read into
    // memory: the read carries on and the next poll answers (gate 2 re-check on PR #16).
    recordingStillLoading: 'Carregando a gravação…',
    // A replay whose recording holds no line that can be replayed (stopped before the
    // first poll, or every line damaged).
    recordingHasNoData: (recordingId: string) =>
      `A gravação "${recordingId}" não tem nenhum dado para reproduzir.`,
    // A simulator source with "falha simulada" switched on: every poll fails on purpose,
    // so the operator can rehearse a late source.
    simulatedFailure: 'Falha simulada.',
  },
  // Why a request of a flex HTTP/JSON source failed (adapters/httpJson). Each names the
  // request by its id, and a host at most: never the whole address, whose query may carry
  // a value read from a BAJAOVRLAY_SOURCE_ variable, and never a header value.
  httpJsonErrors: {
    // The poll's signal fired. The poller records its own "Tempo esgotado" sentence, with
    // the seconds, in place of this one; this one is what a caller without it reads.
    requestTimedOut: (requestId: string) => `Tempo esgotado: ${requestId} não respondeu a tempo.`,
    // The sample route ("Buscar da fonte") gave up after its own timeout (10 s).
    sampleRequestTimedOut: (requestId: string, timeoutSeconds: number) =>
      `Tempo esgotado: ${requestId} não respondeu em ${timeoutSeconds.toLocaleString('pt-BR')} s.`,
    statusOutside2xx: (status: number, statusName: string, requestId: string) =>
      statusName === ''
        ? `A fonte respondeu ${String(status)} em ${requestId}`
        : `A fonte respondeu ${String(status)} (${statusName}) em ${requestId}`,
    notValidJson: (requestId: string) => `A resposta de ${requestId} não é JSON válido`,
    bodyOverCap: (requestId: string, megabytes: number) =>
      `A resposta de ${requestId} passou de ${megabytes.toLocaleString('pt-BR')} MB`,
    couldNotConnect: (host: string, requestId: string, reason: string) =>
      `Não consegui conectar a ${host} (${requestId}): ${reason}`,
    // BAJAOVRLAY_SOURCE_ALLOWED_HOSTS is set and this request's host is not on it: a poll,
    // a sample and a save (createDataSource, updateDataSource) are all refused with it.
    hostNotAllowed: (host: string, requestId: string) =>
      `O servidor não busca dados em ${host} (${requestId}): esse endereço não está em BAJAOVRLAY_SOURCE_ALLOWED_HOSTS.`,
    // BAJAOVRLAY_SOURCE_ALLOWED_HOSTS is not set and the request names a variable: no
    // variable's value is sent then. The variable is not named, so the answer is the
    // same whether it is set on the server or not.
    environmentVariableNeedsAllowedHosts: (requestId: string) =>
      `A requisição ${requestId} usa uma variável de ambiente, mas BAJAOVRLAY_SOURCE_ALLOWED_HOSTS não está definida no servidor; sem essa lista, nenhum valor de variável é enviado.`,
    environmentVariableNotSet: (variableName: string) =>
      `A variável de ambiente ${variableName} não está definida no servidor.`,
    environmentVariableWithLineBreak: (variableName: string) =>
      `A variável de ambiente ${variableName} tem uma quebra de linha e não pode ir num cabeçalho.`,
    environmentVariableWithCharacterHttpRefuses: (variableName: string) =>
      `A variável de ambiente ${variableName} tem um caractere que um cabeçalho HTTP não aceita, como um emoji ou uma letra fora do Latin-1.`,
    // The <reason> of couldNotConnect, by the code Node gives the network error.
    networkReasonsByCode: {
      ECONNREFUSED: 'conexão recusada',
      ECONNRESET: 'a conexão caiu',
      ENOTFOUND: 'endereço não encontrado',
      EAI_AGAIN: 'o nome do endereço não pôde ser resolvido agora',
      EHOSTUNREACH: 'a máquina não pode ser alcançada',
      ENETUNREACH: 'a rede não pode ser alcançada',
      ETIMEDOUT: 'a rede não respondeu',
      UND_ERR_SOCKET: 'a conexão caiu',
      UND_ERR_CONNECT_TIMEOUT: 'a conexão demorou demais para abrir',
    } as Record<string, string | undefined>,
    // A network error with a code not listed above, or with none.
    networkReasonWithCode: (code: string) => `falha de rede (${code})`,
    networkReasonWithoutCode: 'falha de rede sem detalhe',
  },
  // The names the race simulator gives its event and session. They can reach the air
  // through a binding, so they say plainly that the race is simulated.
  simulatorSession: {
    eventName: 'Baja SAE Brasil — Simulação',
    sessionName: 'Enduro de Resistência (simulado)',
  },
  // The column heads of the simulated overall standings, one per session kind it scores
  // (standingsFromRaceState.ts). Short caps like the real export's ("DINÂM.", "SEG."), so
  // each fits the standings graphic's 120 px part column.
  simulatorScorePartLabels: {
    acceleration: 'ACEL.',
    speed: 'VELOC.',
    traction: 'TRAÇÃO',
    suspension: 'SUSP.',
    maneuverability: 'MANOB.',
    enduro: 'ENDURO',
  },
  // The round names of the simulated Super Prime (simulatedBracket.ts, BAJAOVRLAY-25), as the
  // real results sheet names them; they reach the air on the bracket's head and pills.
  simulatorBracket: {
    final: 'Final',
    semifinal: 'Semifinal',
    quarterFinals: 'Quartas de final',
    roundOfSixteen: 'Oitavas de final',
    /** A round of 16 matches or more: "16 avos de final", "32 avos de final". */
    roundOfManyMatches: (matchCount: number) => `${String(matchCount)} avos de final`,
    thirdPlace: 'Disputa de 3º lugar',
  },
  // The simulated race direction's reasons (simulatedIncidents.ts): plausible, not the
  // rulebook. A penalty is written in words ("+30 segundos"), as PR #21's notice asks,
  // because the on-air face has no lowercase and "+30 s" would read "+30 S".
  simulatorIncidents: {
    penalties: [
      { reason: 'Velocidade acima do limite nos boxes', penaltyText: '+30 segundos' },
      { reason: 'Ultrapassagem sob bandeira amarela', penaltyText: '+60 segundos' },
      { reason: 'Corte de pista', penaltyText: 'Volta cancelada' },
      { reason: 'Reabastecimento com o motor ligado', penaltyText: '+120 segundos' },
      { reason: 'Conduta antidesportiva', penaltyText: 'Bandeira preta' },
    ],
    warnings: ['Bloqueio de ultrapassagem', 'Ignorou a bandeira azul', 'Contato com outro carro'],
  },
} as const;
