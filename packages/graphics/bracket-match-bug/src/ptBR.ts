/**
 * pt-BR catalog: every word the match bug puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere. The
 * manifest's field titles and corner names are in bracket-match-bug.ograf.json, since JSON
 * cannot import.
 */
export const ptBR = {
  /** The tag of a series beside the round: "MD3" is "melhor de 3", as the scoring sheet has it. */
  seriesTag: (bestOf: number) => `MD${String(bestOf)}`,
  /** Between the two cars: "47 Corisco 1 × 2 Pequi 12". */
  versusMark: '×',
  /** The accessible name of the winner's chip. */
  winnerLabel: 'Vencedor',

  actionProblems: {
    notLoadedYet: 'A partida ainda não foi carregada (load).',
    alreadyLoaded: 'A partida já foi carregada (load); crie outra para novos dados.',
    alreadyDisposed: 'A partida já foi descartada (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: a partida tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". A partida não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados da partida.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — partida da chave',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    cornerButton: (cornerName: string) => `Canto: ${cornerName}`,
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
