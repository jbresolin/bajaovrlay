/**
 * pt-BR catalog: every word the countdown puts on air, every message it answers a renderer
 * with and every label of its preview page, never written inline elsewhere. The manifest's
 * field titles are in countdown.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** The alternative text of the Baja SAE Brasil logo. */
  logoAlternativeText: 'Baja SAE Brasil',
  /** The card's caption over the count, where the race clock says "TEMPO RESTANTE". */
  cardCaption: 'LARGADA EM',
  /** The card's start time, where the race clock puts the laps: "ÀS 10:00". */
  cardStartTime: (timeOfDay: string) => `ÀS ${timeOfDay}`,
  /** The waiting screen's head title. */
  fullscreenTitle: 'PRÓXIMA SESSÃO',
  /** The waiting screen's start time under the count: "LARGADA ÀS 10:00". */
  fullscreenStartTime: (timeOfDay: string) => `LARGADA ÀS ${timeOfDay}`,

  actionProblems: {
    notLoadedYet: 'A contagem ainda não foi carregada (load).',
    alreadyLoaded: 'A contagem já foi carregada (load); crie outra para novos dados.',
    alreadyDisposed: 'A contagem já foi descartada (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: a contagem tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". A contagem não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados da contagem.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — contagem regressiva',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    cardButton: 'Cartão',
    fullscreenButton: 'Tela cheia',
    tenMinutesLaterButton: 'Largada 10 min depois',
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
