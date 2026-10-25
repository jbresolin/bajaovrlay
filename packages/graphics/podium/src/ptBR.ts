/**
 * pt-BR catalog: every word the podium puts on air (the default title, the place, the step
 * line, the mark for an unknown place, the logos' names), every message it answers a
 * renderer with and every label of the preview page, never written inline elsewhere. The
 * manifest's field titles are in podium.ograf.json, since JSON cannot import. The styles
 * set the board in caps, and the face has no lowercase.
 */

export const ptBR = {
  /** The title when the item gives none (the manifest's default too). */
  defaultTitle: 'PÓDIO',
  /** The organiser's mark in the head. */
  logoAlternativeText: 'Baja SAE Brasil',
  /** A team's logo crowning its card, named for a screen reader. */
  teamLogoAlternativeText: (teamName: string) => `Logo da equipe ${teamName}`,
  /** A place as the card writes it: "1º", "3º". */
  placeText: (place: number) => `${place}º`,
  /** The place of an entry that has neither a position nor a rank (a disqualified team). */
  emptyMark: '—',
  /** The head's line once a place is revealed: how many of the three are shown ("2/3"). */
  stepLine: (revealedPlaceCount: number, placeCount: number) =>
    `${revealedPlaceCount}/${placeCount}`,

  actionProblems: {
    notLoadedYet: 'O pódio ainda não foi carregado (load).',
    alreadyLoaded: 'O pódio já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O pódio já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o pódio tem os passos 0 a 3.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O pódio não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do pódio.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — pódio',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    nextButton: 'Próximo',
    stopButton: 'Sair (stop)',
    withLogosButton: 'Com logos',
    withoutLogosButton: 'Sem logos',
    tieButton: 'Empate no 1º (geral)',
    sampleEventLine: 'ENDURO DE RESISTÊNCIA',
    overallTitle: 'PÓDIO · GERAL',
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
