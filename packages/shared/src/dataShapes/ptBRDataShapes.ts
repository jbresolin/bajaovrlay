/**
 * The pt-BR texts of the canonical data shapes: the labels the binding picker shows for
 * each path, and the sentences that say why a payload was refused. Shared has no other
 * catalog; these live here because the paths and the validator both live in shared
 * (decision D3 of BAJAOVRLAY-17), and the server and the control page show them as they are.
 */
export const ptBRDataShapes = {
  /** Put between the parts of a label: "Posições › 1º colocado › Equipe". */
  labelSeparator: ' › ',

  /** The first part of every label: the shape's name. */
  shapeNames: {
    session: 'Sessão',
    positions: 'Posições',
    standings: 'Pontuação',
    brackets: 'Chaves',
    incidents: 'Incidentes',
  },

  /** "1º colocado", "10º colocado": positions, where every car has a place of its own. */
  placeLabel: (placeNumber: number) => `${placeNumber}º colocado`,

  /**
   * "1ª linha", "10ª linha": standings, where tied teams share a rank, so the 2nd row may
   * be a 1st place and "2º colocado" would be wrong (gate 2 on PR #16).
   */
  rowLabel: (rowNumber: number) => `${rowNumber}ª linha`,

  /** "Lista completa": a path that points at a whole list (the tower takes it all). */
  wholeListLabel: 'Lista completa',

  /**
   * The car a binding names by its number (`carNumber`), wherever it is in the list: a
   * team card or a battle card that follows one car.
   */
  carChosenByNumberLabel: 'Carro escolhido pelo número',

  /** One car, wherever it is listed: the first part of a car correction's label. */
  carLabel: 'Carro',

  /** The session fields a binding may point at. */
  sessionFieldLabels: {
    eventName: 'Evento',
    sessionName: 'Nome da sessão',
    sessionKind: 'Prova',
    state: 'Bandeira',
    /** The whole clock at once: the clock group that fills a graphic's four clock fields. */
    wholeClock: 'Relógio completo',
    clock: 'Relógio',
    scheduledDurationMs: 'Duração prevista',
    lapsCompletedByLeader: 'Voltas do líder',
  },

  /** The fields of the session clock. */
  clockFieldLabels: {
    clockMode: 'Modo',
    referenceTimeMs: 'Tempo de referência',
    referenceWallClockMs: 'Horário da referência',
    running: 'Correndo',
  },

  /** The fields of one car in the positions. */
  positionsEntryFieldLabels: {
    carNumber: 'Carro',
    teamName: 'Equipe',
    schoolName: 'Escola',
    laps: 'Voltas',
    lastLapMs: 'Última volta',
    bestLapMs: 'Melhor volta',
    bestLapNumber: 'Volta da melhor volta',
    gapToLeaderMs: 'Diferença para o líder (tempo)',
    gapToLeaderLaps: 'Diferença para o líder (voltas)',
    intervalMs: 'Intervalo para o carro à frente',
    pitStops: 'Paradas nos boxes',
    fuelStops: 'Abastecimentos',
    status: 'Situação',
  },

  /** The standings fields a binding may point at. */
  standingsFieldLabels: {
    scope: 'Abrangência',
  },

  /** The fields of one team in the standings. */
  standingsEntryFieldLabels: {
    carNumber: 'Carro',
    teamName: 'Equipe',
    schoolName: 'Escola',
    points: 'Pontos',
  },

  /** The brackets fields a binding may point at. */
  bracketsFieldLabels: {
    rounds: 'Todas as fases',
  },

  /** The fields of one incident, for the flex mapping's rows and problem lines. */
  incidentsEntryFieldLabels: {
    incidentId: 'Identificador do incidente',
    carNumber: 'Carro',
    teamName: 'Equipe',
    schoolName: 'Escola',
    kind: 'Tipo',
    reason: 'Motivo',
    penaltyText: 'Punição',
    lap: 'Volta',
    atMs: 'Momento',
  },

  /** Why a payload was refused, naming the path of the first bad field. */
  invalidDataAtPath: (path: string, reason: string) => `Dados inválidos em "${path}": ${reason}.`,

  /** The reason, by the kind of mistake Zod found. */
  validationReasons: {
    wrongTypeOrMissing: 'campo ausente ou de tipo errado',
    valueNotInList: 'valor fora da lista permitida',
    valueTooSmall: 'valor abaixo do mínimo',
    valueTooBig: 'valor acima do máximo',
    wrongFormat: 'formato errado',
    otherwiseWrong: 'valor errado',
  },

  /** The reasons for the rules a schema alone cannot say. */
  shapeRuleReasons: {
    positionOutOfOrder: (expectedPosition: number) =>
      `as posições devem vir em ordem, 1, 2, 3...; aqui era esperada a posição ${expectedPosition}`,
    carListedTwice: (carNumber: number) => `o carro ${carNumber} aparece mais de uma vez`,
    leaderWithGap: 'o líder não tem diferença para si mesmo',
    gapInBothMsAndLaps: 'um carro tem no máximo uma diferença para o líder, em tempo ou em voltas',
    gapInLapsOnLeaderLap:
      'um carro na mesma volta do líder tem a diferença em tempo, não em voltas',
    gapInMsWhenLapped:
      'um carro com menos voltas que o líder tem a diferença em voltas, não em tempo',
    gapInLapsNotMatchingLaps: (lapsBehindLeader: number) =>
      `a diferença em voltas deve ser igual às voltas atrás do líder, aqui ${lapsBehindLeader}`,
    gapOnCarWithMoreLapsThanLeader:
      'um carro com mais voltas que o líder não tem diferença para ele',
    moreLapsThanRacingCarAhead: (lapsOfRacingCarAhead: number) =>
      `um carro em prova não pode ter mais voltas que o carro em prova à frente dele, que tem ${lapsOfRacingCarAhead}`,
    leaderWithInterval: 'o líder não tem intervalo, porque não há carro à frente',
    firstRankNotOne: 'a pontuação começa pela posição 1',
    rankOutOfOrder: (rankAbove: number) =>
      `a pontuação deve vir em ordem de classificação; o colocado acima tem a posição ${rankAbove}`,
    sameCarOnBothSides: (carNumber: number) =>
      `o carro ${carNumber} não pode disputar contra si mesmo`,
    winnerNotInMatch: (carNumber: number) =>
      `o vencedor ${carNumber} não é nenhum dos dois carros da disputa`,
    incidentListedTwice: (incidentId: string) =>
      `o incidente ${incidentId} aparece mais de uma vez`,
  },
};
