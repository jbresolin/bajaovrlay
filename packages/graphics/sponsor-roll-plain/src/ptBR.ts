/**
 * pt-BR catalog: every message the plain sponsor roll answers a renderer with and every
 * label of its preview page, never written inline elsewhere. The level headings on air are
 * the kit's (ptBRSponsorLevelHeadings); the manifest's field titles and corner names are in
 * sponsor-roll-plain.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** A sponsor's logo's alternative text: its name. */
  sponsorLogoAlternativeText: (sponsorName: string) => sponsorName,

  actionProblems: {
    notLoadedYet: 'Os patrocinadores (simples) ainda não foram carregados (load).',
    alreadyLoaded:
      'Os patrocinadores (simples) já foram carregados (load); crie outro para novos dados.',
    alreadyDisposed: 'Os patrocinadores (simples) já foram descartados (dispose).',
    invalidPlayStep:
      'Passo inválido para playAction: os patrocinadores (simples) têm só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". Os patrocinadores (simples) não têm ações personalizadas.`,
    /** No sponsor of the list has a logo: an empty card is never put on air. */
    noSponsorWithALogo: 'Nenhum patrocinador da lista tem logo; não há o que mostrar.',
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com a lista de patrocinadores.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — patrocinadores (simples)',
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
