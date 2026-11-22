/**
 * pt-BR catalog: every word the image graphic puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere. The
 * manifest's field titles and anchor names are in image.ograf.json, since JSON cannot
 * import.
 */
export const ptBR = {
  /** The accessible name of the image; the graphic carries no words of its own on air. */
  imageAlternativeText: 'Imagem',

  actionProblems: {
    notLoadedYet: 'A imagem ainda não foi carregada (load).',
    alreadyLoaded: 'A imagem já foi carregada (load); crie outra para novos dados.',
    alreadyDisposed: 'A imagem já foi descartada (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: a imagem tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". A imagem não tem ações personalizadas.`,
    /** The answer when the file fails with no image before it: nothing is drawn. */
    imageDidNotLoad: (imageUrl: string) =>
      `O arquivo da imagem não carregou (${imageUrl}); nada aparece na tela. Escolha outra imagem.`,
    /** The answer when a new file fails: the image already on screen stays there. */
    imageDidNotLoadKeepingThePreviousImage: (imageUrl: string) =>
      `O arquivo da imagem não carregou (${imageUrl}); a imagem anterior continua na tela. Escolha outra imagem.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados da imagem.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — imagem',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    positionButton: (positionName: string) => `Posição: ${positionName}`,
    unreadableAddressData: 'O parâmetro ?data= do endereço não é um JSON válido.',
    lastAnswer: (actionName: string, statusCode: number, statusMessage: string | undefined) => {
      const statusText = `${actionName}: ${statusCode}`;
      const hasStatusMessage = statusMessage !== undefined && statusMessage !== '';
      if (!hasStatusMessage) {
        return statusText;
      }
      return `${statusText} — ${statusMessage}`;
    },
    /** The anchors' names on the preview's buttons, as the manifest names them in the form. */
    anchorNames: {
      'top-left': 'Superior esquerda',
      'top-center': 'Superior centro',
      'top-right': 'Superior direita',
      'middle-left': 'Meio esquerda',
      'middle-center': 'Centro',
      'middle-right': 'Meio direita',
      'bottom-left': 'Inferior esquerda',
      'bottom-center': 'Inferior centro',
      'bottom-right': 'Inferior direita',
    },
  },
} as const;
