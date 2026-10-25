/**
 * pt-BR catalog: every word the sponsor roll puts on air (besides the level headings, the
 * kit's ptBRSponsorLevelHeadings), every message it answers a renderer with and every
 * label of its preview page, never written inline elsewhere. The manifest's field titles
 * are in sponsor-roll.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** The alternative text of the Baja SAE Brasil mark and logo. */
  markAlternativeText: 'Baja SAE Brasil',
  /** The full screen's head title. */
  fullscreenTitle: 'PATROCINADORES',
  /** The full screen's page line: "1/5". */
  pageLine: (pageNumber: number, pageCount: number) => `${String(pageNumber)}/${String(pageCount)}`,
  /** A sponsor's logo's alternative text: its name. */
  sponsorLogoAlternativeText: (sponsorName: string) => sponsorName,

  actionProblems: {
    notLoadedYet: 'O rodízio de patrocinadores ainda não foi carregado (load).',
    alreadyLoaded: 'O rodízio já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O rodízio já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o rodízio tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O rodízio não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do rodízio.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — rodízio de patrocinadores',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    nextPageButton: 'Atualizar (próxima página)',
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
