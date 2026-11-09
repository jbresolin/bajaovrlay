/**
 * pt-BR catalog: every word the logo bug puts on air, every message it answers a renderer
 * with and every label of its preview page, never written inline elsewhere. The manifest's
 * field titles and corner names are in logo-bug.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** The accessible name of the image; the logo carries no words of its own on air. */
  logoAlternativeText: 'Logo do canal',

  actionProblems: {
    notLoadedYet: 'O logo ainda não foi carregado (load).',
    alreadyLoaded: 'O logo já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O logo já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o logo tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O logo não tem ações personalizadas.`,
    /** The answer when the image fails with no logo before it: the corner stays empty. */
    imageDidNotLoad: (logoUrl: string) =>
      `A imagem do logo não carregou (${logoUrl}); o logo fica vazio. Escolha outra imagem.`,
    /** The answer when a new image fails: the logo already on screen stays there. */
    imageDidNotLoadKeepingThePreviousLogo: (logoUrl: string) =>
      `A imagem do logo não carregou (${logoUrl}); o logo anterior continua na tela. Escolha outra imagem.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do logo.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — logo do canal',
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
