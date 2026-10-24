/**
 * pt-BR catalog: every word the sponsor bug puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere.
 * The manifest's field titles are in sponsor-bug.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** The alternative text of the Baja SAE Brasil mark. */
  markAlternativeText: 'Baja SAE Brasil',
  /** The accessible name of the sponsor's logo; the caption says who presents. */
  sponsorLogoAlternativeText: 'Logo do patrocinador',

  actionProblems: {
    notLoadedYet: 'O bug ainda não foi carregado (load).',
    alreadyLoaded: 'O bug já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O bug já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o bug tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O bug não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do bug.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — bug do patrocinador',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    sponsorOnButton: 'Com patrocinador',
    sponsorOffButton: 'Sem patrocinador',
    eventWordOnButton: 'Com a palavra do evento',
    eventWordOffButton: 'Sem a palavra do evento',
    plateOnButton: 'Logo sobre placa clara',
    plateOffButton: 'Logo sobre o cartão',
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
