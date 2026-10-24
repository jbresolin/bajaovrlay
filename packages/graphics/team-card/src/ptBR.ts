/**
 * pt-BR catalog: every word the team card puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere.
 * The manifest's field titles are in team-card.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** Between the city and the state on the place line: "Campinas · SP". */
  placeLineSeparator: ' · ',
  /** Between the school and the place line; the design's middle dot, drawn with room around it. */
  detailsSeparator: '·',
  /** The accessible name of the car's photo. */
  carPhotoAlternativeText: (carNumber: number) => `Foto do carro ${carNumber}`,
  /** The accessible name of the team's logo. */
  logoAlternativeText: (teamName: string) => `Logo da equipe ${teamName}`,

  actionProblems: {
    notLoadedYet: 'O cartão de equipe ainda não foi carregado (load).',
    alreadyLoaded: 'O cartão de equipe já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O cartão de equipe já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o cartão de equipe tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O cartão de equipe não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do cartão de equipe.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — cartão de equipe',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    photoOnButton: 'Com foto',
    photoOffButton: 'Sem foto',
    logoOnButton: 'Com logo',
    logoOffButton: 'Sem logo',
    cityOnButton: 'Com cidade',
    cityOffButton: 'Sem cidade',
    plateOnButton: 'Logo sobre placa clara',
    plateOffButton: 'Logo sobre o painel',
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
