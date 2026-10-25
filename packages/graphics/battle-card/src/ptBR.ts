/**
 * pt-BR catalog: every word the battle card puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere.
 * The manifest's field titles are in battle-card.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** The laps cell, as the design writes it: "1 VOLTA", "33 VOLTAS". */
  lapsText: (laps: number) => (laps === 1 ? '1 VOLTA' : `${laps} VOLTAS`),
  /** The sign in front of the gap: the car behind is always behind. */
  plusSign: '+',
  /**
   * The typographic minus (U+2212) of a closing change, never the hyphen, which Bebas Neue
   * draws short and high (the standings' rule).
   */
  minusSign: '−',
  /** The trend's word, in the design's caps; none beside a gap of "—". */
  trendWords: {
    closing: 'FECHANDO',
    opening: 'ABRINDO',
    steady: 'ESTÁVEL',
    none: '',
  },
  /**
   * The gap when it is not these two cars' (none sent, or the cars not one place apart):
   * the dash every graphic writes for a missing value.
   */
  noGapText: '—',

  actionProblems: {
    notLoadedYet: 'A disputa de posição ainda não foi carregada (load).',
    alreadyLoaded: 'A disputa de posição já foi carregada (load); crie outra para novos dados.',
    alreadyDisposed: 'A disputa de posição já foi descartada (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: a disputa de posição tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". A disputa de posição não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados da disputa de posição.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — disputa de posição',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    updateButton: 'Atualizar (próxima volta)',
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
