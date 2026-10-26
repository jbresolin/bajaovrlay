/**
 * pt-BR catalog: every word the bracket puts on air (the default title, the step and page
 * lines, the "×", the "—", the W.O. tag, the empty slot of a bye, the winner's mark's
 * name), every message it answers a renderer with and every label of the preview page,
 * never written inline elsewhere. The manifest's field titles are in bracket.ograf.json,
 * since JSON cannot import. The styles set the board in caps, and the face has no lowercase.
 */

export const ptBR = {
  /** The title when the item gives none (the manifest's default too). */
  defaultTitle: 'CHAVEAMENTO',
  /** The organiser's mark in the head. */
  logoAlternativeText: 'Baja SAE Brasil',
  /** The head's line at the right: the step on air of the bracket's steps ("3/7"). */
  stepLine: (stepNumber: number, stepCount: number) => `${stepNumber}/${stepCount}`,
  /** The head's event line on a round of several board pages ("64 avos de final · página 1/2"). */
  boardRoundOnPage: (roundName: string, pageNumber: number, pageCount: number) =>
    `${roundName} · página ${pageNumber}/${pageCount}`,
  /** Between the two cars of a board's match card. */
  versus: '×',
  /** A result not known yet, and the other car of a W.O. */
  emptyMark: '—',
  /** The outlined tag of a winner who advanced without racing. */
  walkoverTag: 'W.O.',
  /** The empty slot of a bye, which must never read as a car. */
  noOpponent: 'SEM ADVERSÁRIO',
  /**
   * The name pill of a tree round not listed yet, by the matches it will have (gate 2 of
   * PR #30, contract B): every round name shows from the tree's first step.
   */
  roundsStillToCome: {
    quarterFinals: 'Quartas de final',
    semifinal: 'Semifinal',
    final: 'Final',
  },
  /** The winner's mark of a plain win, named for a screen reader. */
  winnerMarkLabel: 'Venceu',

  actionProblems: {
    notLoadedYet: 'O chaveamento ainda não foi carregado (load).',
    alreadyLoaded: 'O chaveamento já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O chaveamento já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: os passos começam em 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O chaveamento não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do chaveamento.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — chaveamento',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    nextButton: 'Próximo',
    stopButton: 'Sair (stop)',
    superPrimeButton: 'Super Prime real',
    resultsBoardButton: 'Resultados (quadro)',
    resultsTreeButton: 'Resultados (árvore)',
    liveResultButton: 'Resultado ao vivo',
    sampleTitle: 'SUPER PRIME',
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
