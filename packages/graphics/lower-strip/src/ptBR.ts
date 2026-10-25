/**
 * pt-BR catalog: every word the lower strip puts on air, every message it answers a
 * renderer with and every label of its preview page, never written inline elsewhere.
 * The manifest's field titles are in lower-strip.ograf.json, since JSON cannot import.
 * The flag words are the kit's (`@bajaovrlay/graphics-kit/ptBRFlagWords`), shared with
 * the race clock.
 */
export const ptBR = {
  /** A car's position with the ordinal sign, as the strip writes it: "1º", "13º". */
  positionWithOrdinal: (position: number) => `${position}º`,
  /** The accessible name of a car's pill. */
  carPillName: (position: number, carNumber: number, schoolName: string) =>
    `${position}º, carro ${carNumber}, ${schoolName}`,
  /** The accessible name of the page cell: "página 1 de 6". */
  pageCellName: (pageNumber: number, pageCount: number) => `página ${pageNumber} de ${pageCount}`,
  /** The accessible name of the list of cars. */
  carListName: 'Ordem de corrida',

  actionProblems: {
    notLoadedYet: 'A faixa ainda não foi carregada (load).',
    alreadyLoaded: 'A faixa já foi carregada (load); crie outra para novos dados.',
    alreadyDisposed: 'A faixa já foi descartada (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: a faixa tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". A faixa não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados da faixa.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  preview: {
    pageTitle: 'Prévia — faixa inferior',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    nextPageButton: 'Próxima página',
    clockOnButton: 'Com relógio',
    clockOffButton: 'Sem relógio',
    swapLeadersButton: 'Trocar 1º e 2º',
    flagButton: (flagLabel: string) => `Bandeira: ${flagLabel}`,
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
