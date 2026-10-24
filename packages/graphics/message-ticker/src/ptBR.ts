/**
 * pt-BR catalog: every word the message ticker puts on air of its own, every message it
 * answers a renderer with and every label of its preview page, never written inline
 * elsewhere. The label and the messages are the operator's; the manifest's field titles
 * are in message-ticker.ograf.json, since JSON cannot import. The flag words are the kit's.
 */
export const ptBR = {
  /** The accessible name of the page cell: "aviso 1 de 3". */
  pageCellName: (pageNumber: number, pageCount: number) => `aviso ${pageNumber} de ${pageCount}`,

  actionProblems: {
    notLoadedYet: 'O letreiro ainda não foi carregado (load).',
    alreadyLoaded: 'O letreiro já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O letreiro já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o letreiro tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O letreiro não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do letreiro.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — letreiro de avisos',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    nextPageButton: 'Próximo aviso',
    clockOnButton: 'Com relógio',
    clockOffButton: 'Sem relógio',
    oneMessageButton: 'Um aviso',
    threeMessagesButton: 'Três avisos',
    flagButton: (flagLabel: string) => `Bandeira: ${flagLabel}`,
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
