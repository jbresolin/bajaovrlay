/**
 * pt-BR catalog, data sources part: the "Fontes de dados" page (features/dataSources) and
 * the health chip beside the connection badge. Kept in a file of its own so ptBR.ts stays
 * readable; ptBR.ts makes it `ptBR.dataSources`.
 * The flag and car status words are the page's own, in sentence case; the race clock
 * writes its flags on air in capitals from its own catalog, which the page never imports.
 */
export const ptBRDataSources = {
  pageTitle: 'Fontes de dados',
  sourceListLabel: 'Fontes de dados',
  noSources: 'Nenhuma fonte. Use "+ Fonte" para criar a primeira.',
  addSourceButton: '+ Fonte',
  // "+ Fonte" asks which kind first; each kind has a form of its own.
  newSourceKindQuestion: 'Que tipo de fonte?',
  kinds: {
    simulator: 'Simulador',
    replay: 'Reprodução',
  },

  // The status chip of each source (DataSourceStatusChip.tsx).
  statusChip: {
    ok: 'Ok',
    stale: 'Atrasada',
    // `timeSinceLastGoodData` is "há 40 s", "há 3 min"...
    staleSince: (timeSinceLastGoodData: string) => `Atrasada (${timeSinceLastGoodData})`,
    error: 'Erro',
    off: 'Desligada',
  },
  // Under a minute the general "agora" says too little about a late source.
  secondsAgo: (seconds: number) => `há ${seconds} s`,

  // The chip in the header: "Fontes: 2 ok · 1 atrasada · 1 com erro"
  // (DataSourcesHealthChip.tsx). Its name for screen readers carries the counts too.
  healthChip: {
    label: (countsText: string) => `Saúde das fontes de dados: ${countsText}`,
    countsText: (countTexts: string[]) => countTexts.join(' · '),
    text: (countsText: string) => `Fontes: ${countsText}`,
    okCount: (count: number) => `${count} ok`,
    staleCount: (count: number) => (count === 1 ? '1 atrasada' : `${count} atrasadas`),
    errorCount: (count: number) => `${count} com erro`,
  },

  // One row of the list (DataSourceRow.tsx).
  row: {
    // The label is a button that shows the source's data beside the list.
    lastGoodData: (time: string) => `Último dado: ${time}`,
    noGoodDataYet: 'Ainda sem dados',
    pollInterval: (seconds: string) => `Leitura a cada ${seconds} s`,
    enabledSwitch: 'Ligada',
    pollNowButton: 'Atualizar agora',
    // Simulators only: the simulated race starts again from its green flag.
    restartRaceButton: 'Reiniciar corrida',
    startRecordingButton: 'Gravar',
    stopRecordingButton: 'Parar gravação',
    recordingBadge: 'Gravando',
    editButton: 'Editar',
    deleteButton: 'Excluir',
    deleteConfirmButton: 'Confirmar: excluir',
  },

  // The selected source's data (DataSourceDetail.tsx and the parts it draws).
  detail: {
    regionLabel: (sourceLabel: string) => `Dados de ${sourceLabel}`,
    noSnapshot: 'Esta fonte ainda não tem dados.',
    staleBanner: (time: string) => `Dados de ${time} — fonte atrasada`,
    // A source turned off keeps its last data; the banner says it is not live.
    offBanner: (time: string) => `Dados de ${time} — fonte desligada`,
    showJsonButton: 'Exibir JSON',
    hideJsonButton: 'Ocultar JSON',
    // What a cell shows when the source does not know the value.
    unknownValue: '—',
  },
  sessionCard: {
    title: 'Sessão',
    flagLabel: 'Bandeira',
    flagStates: {
      pre: 'Pré-largada',
      green: 'Verde',
      yellow: 'Amarela',
      red: 'Vermelha',
      checkered: 'Quadriculada',
      finished: 'Encerrada',
    },
    clockModes: {
      elapsed: 'Tempo de prova',
      remaining: 'Tempo restante',
    },
    lapsOfLeaderLabel: 'Voltas do líder',
  },
  positionsTable: {
    label: 'Posições',
    columns: {
      position: 'Pos.',
      carNumber: 'Carro',
      teamName: 'Equipe',
      schoolName: 'Escola',
      laps: 'Voltas',
      lastLap: 'Última',
      bestLap: 'Melhor',
      gap: 'Diferença',
      status: 'Status',
    },
    // `seconds` arrives written for reading, with a decimal comma: "12,345".
    gapInSeconds: (seconds: string) => `+${seconds} s`,
    gapInLaps: (laps: number) => (laps === 1 ? '+1 volta' : `+${laps} voltas`),
    statuses: {
      running: 'Na pista',
      inPit: 'Nos boxes',
      stopped: 'Parado',
      retired: 'Abandonou',
      disqualified: 'Desclassificado',
      notStarted: 'Não largou',
    },
  },
  standingsTable: {
    label: 'Classificação',
    columns: {
      rank: 'Pos.',
      carNumber: 'Carro',
      teamName: 'Equipe',
      schoolName: 'Escola',
      points: 'Pontos',
    },
  },

  // The per-kind forms ("+ Fonte" and "Editar").
  form: {
    newSourceTitle: (kindName: string) => `Nova fonte: ${kindName}`,
    editSourceTitle: (sourceLabel: string) => `Editar fonte: ${sourceLabel}`,
    saveButton: 'Salvar fonte',
    cancelButton: 'Cancelar',
    fields: {
      label: 'Nome da fonte',
      pollIntervalSeconds: 'Intervalo de leitura (segundos)',
      seed: 'Semente da corrida',
      carCount: 'Carros',
      sessionDurationMinutes: 'Duração da sessão (minutos)',
      lapLengthKm: 'Comprimento da volta (km)',
      simulatorSpeed: 'Velocidade (vezes o tempo real)',
      isFailing: 'Falha simulada',
      recordingId: 'Gravação',
      replaySpeed: 'Velocidade da reprodução',
      isLooping: 'Recomeçar ao chegar ao fim',
      startOffsetSeconds: 'Começar em (segundos da gravação, opcional)',
    },
    // One recording in the replay form's list: whose, when, and how many readings.
    recordingOption: (sourceLabel: string, startedAt: string, snapshotCount: number) =>
      `${sourceLabel} — ${startedAt} (${snapshotCount} leituras)`,
    noEndedRecordings:
      'Nenhuma gravação encerrada. Grave uma fonte e pare a gravação para poder reproduzi-la.',
    nothingChosenPlaceholder: 'Escolha…',
    replaySpeedOption: (speed: number) => `${speed}×`,
    fieldErrors: {
      labelMissing: 'Informe o nome da fonte.',
      pollIntervalOutOfRange: 'Informe de 0,5 a 60 segundos.',
      seedOutOfRange: 'Informe a semente como um número inteiro de 0 a 4294967295.',
      carCountOutOfRange: 'Informe de 10 a 100 carros.',
      sessionDurationOutOfRange: 'Informe a duração em minutos, maior que zero e até 1440 (24 h).',
      lapLengthNotPositive: 'Informe um comprimento maior que zero.',
      simulatorSpeedOutOfRange: 'Informe um número inteiro de 1 a 60.',
      recordingMissing: 'Escolha a gravação.',
      replaySpeedNotOffered: 'Escolha uma das velocidades da lista.',
      startOffsetInvalid:
        'Informe os segundos como um número maior ou igual a zero, ou deixe em branco.',
    },
  },
} as const;
