/**
 * pt-BR catalog: every word the "a seguir" card puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere. The
 * manifest's field titles are in bracket-match-card.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** The card's head word, before the round: "A SEGUIR · SEMIFINAL". */
  upNextWord: 'A seguir',
  /** Between the head word and the round, and between the parts of a details line. */
  detailsSeparator: ' · ',
  /** The tag of a series beside the round: "MD3" is "melhor de 3", as the scoring sheet has it. */
  seriesTag: (bestOf: number) => `MD${String(bestOf)}`,
  /** Between the two teams, alone before the match starts and inside the score after. */
  versusMark: '×',
  /** The accessible name of a team's logo. */
  logoAlternativeText: (teamName: string) => `Logo da equipe ${teamName}`,

  actionProblems: {
    notLoadedYet: 'O card "a seguir" ainda não foi carregado (load).',
    alreadyLoaded: 'O card "a seguir" já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O card "a seguir" já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o card "a seguir" tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O card "a seguir" não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados da partida.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — partida a seguir',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    unreadableAddressData: 'O parâmetro ?data= do endereço não é um JSON válido.',
    lastAnswer: (actionName: string, statusCode: number, statusMessage: string | undefined) => {
      const statusText = `${actionName}: ${statusCode}`;
      const hasStatusMessage = statusMessage !== undefined && statusMessage !== '';
      if (!hasStatusMessage) {
        return statusText;
      }
      return `${statusText} — ${statusMessage}`;
    },
  },
} as const;
