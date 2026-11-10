/**
 * pt-BR catalog: every word the Super Chat card puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere.
 * The manifest's field titles are in super-chat.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** The word at the left of the head: what this card is. */
  superChatBadge: 'SUPER CHAT',

  actionProblems: {
    notLoadedYet: 'O Super Chat ainda não foi carregado (load).',
    alreadyLoaded: 'O Super Chat já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O Super Chat já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o Super Chat tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O Super Chat não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do Super Chat.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — Super Chat',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    shortMessageButton: 'Mensagem curta',
    emptyMessageButton: 'Sem mensagem',
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
