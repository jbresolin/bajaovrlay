/**
 * pt-BR catalog: every string the operator reads on the control page comes from here,
 * never written inline in a component, so the wording can be reviewed in one place.
 */
export const ptBR = {
  app: {
    title: 'BajaOvrLay',
    rundownAreaTitle: 'Rundown',
    rundownPlaceholder: 'Rundown — M1',
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
    instanceStatus: {
      loading: 'carregando',
      ready: 'pronto',
      'on-air': 'no ar',
      stopping: 'saindo',
      // PLACEHOLDER (BAJAOVRLAY-12): added with the shared `failed` status so the layer
      // row still compiles; the control work of the same task settles the wording and
      // the badge colours.
      failed: 'falhou',
    },
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
} as const;
