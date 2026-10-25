/**
 * pt-BR catalog: every word the sessions board puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere. The
 * manifest's field titles are in sessions-board.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** The alternative text of the Baja SAE Brasil logo. */
  logoAlternativeText: 'Baja SAE Brasil',
  /** The word of each state at the right of a slot, as the design writes them. */
  statusWords: {
    finished: 'CONCLUÍDA',
    inProgress: 'EM ANDAMENTO',
    upcoming: 'A SEGUIR',
  },

  actionProblems: {
    notLoadedYet: 'O quadro da programação ainda não foi carregado (load).',
    alreadyLoaded: 'O quadro da programação já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O quadro da programação já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o quadro tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O quadro não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do quadro.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — quadro da programação',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    endTheSlotInProgressButton: 'Encerrar a sessão em andamento',
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
