/**
 * pt-BR catalog: every word the intermission board puts on air (besides the level headings,
 * the kit's ptBRSponsorLevelHeadings), every message it answers a renderer with and every
 * label of its preview page, never written inline elsewhere. The manifest's field titles
 * are in intermission-board.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** The alternative text of the Baja SAE Brasil logo. */
  logoAlternativeText: 'Baja SAE Brasil',
  /** The head's title. */
  title: 'INTERVALO',
  /** The caption over the next session. */
  nextCaption: 'A SEGUIR',
  /** The start time under the count: "LARGADA ÀS 10:00". */
  startTime: (timeOfDay: string) => `LARGADA ÀS ${timeOfDay}`,
  /** The top five's head. */
  topFiveCaption: 'CLASSIFICAÇÃO GERAL · 5 PRIMEIROS',
  /** The rank cell of a disqualified team, which has none. */
  emptyMark: '—',
  /** A sponsor's logo's alternative text: its name. */
  sponsorLogoAlternativeText: (sponsorName: string) => sponsorName,

  actionProblems: {
    notLoadedYet: 'O quadro do intervalo ainda não foi carregado (load).',
    alreadyLoaded: 'O quadro do intervalo já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O quadro do intervalo já foi descartado (dispose).',
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
    pageTitle: 'Prévia — quadro do intervalo',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    topFiveOnButton: 'Com os 5 primeiros',
    topFiveOffButton: 'Sem os 5 primeiros',
    sponsorsOnButton: 'Com patrocinadores',
    sponsorsOffButton: 'Sem patrocinadores',
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
