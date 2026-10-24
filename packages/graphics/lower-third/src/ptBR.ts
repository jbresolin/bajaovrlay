/**
 * pt-BR catalog: every mark the lower third puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere.
 * The manifest's field titles are in lower-third.ograf.json, since JSON cannot import.
 * The name, the role and the team line themselves are the operator's words, drawn as sent.
 */
export const ptBR = {
  /** The dot between the role and the team line in the role pill ("CAPITÃ · BAJA UFPR"). */
  teamLineSeparator: '·',

  actionProblems: {
    notLoadedYet: 'A tarja ainda não foi carregada (load).',
    alreadyLoaded: 'A tarja já foi carregada (load); crie outra para novos dados.',
    alreadyDisposed: 'A tarja já foi descartada (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: a tarja tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". A tarja não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados da tarja.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — tarja',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    withRoleButton: 'Exemplo: com função',
    withRoleAndTeamLineButton: 'Exemplo: com função e equipe',
    nameOnlyButton: 'Exemplo: só o nome',
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
