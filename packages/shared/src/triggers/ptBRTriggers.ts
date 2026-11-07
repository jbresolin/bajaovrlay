/**
 * The pt-BR texts of the triggers' shared code: why an HTTP trigger's body was refused,
 * and the labels the server and the page both use. Shown as they are.
 */
export const ptBRTriggers = {
  httpBodyReasons: {
    tooLarge: 'O corpo da chamada passa de 8 KB.',
    notJson: 'O corpo da chamada não é JSON válido.',
    notAnObject:
      'O corpo da chamada precisa ser um objeto JSON simples, como {"nome": "Ana Souza"}.',
    notTextOrNumber: (key: string) =>
      `O campo "${key}" precisa ser texto ou número (objetos, listas, true/false e null não são aceitos).`,
    forbiddenKey: (key: string) => `O nome de campo "${key}" não é aceito.`,
    badKey: 'Cada nome de campo precisa ter de 1 a 64 caracteres.',
  },
  /** What a data event trigger's `tipo` says, by kind. */
  dataEventKindLabels: {
    penalty: 'Penalidade',
    fastestLap: 'Volta mais rápida',
    leaderChange: 'Troca de líder',
    incident: 'Incidente',
  },
  /** A slot's `prova`, by the session kind of Programação. */
  sessionKindLabels: {
    enduro: 'Enduro',
    acceleration: 'Aceleração',
    speed: 'Velocidade',
    traction: 'Tração',
    suspension: 'Suspensão',
    maneuverability: 'Manobrabilidade',
    other: 'Outra',
  },
};
