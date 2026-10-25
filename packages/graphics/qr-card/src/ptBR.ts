/**
 * pt-BR catalog: every word the QR card puts on air, every message it answers a renderer
 * with and every label of its preview page, never written inline elsewhere. The manifest's
 * field titles are in qr-card.ograf.json, since JSON cannot import.
 */
export const ptBR = {
  /** The accessible name of the code: what a screen reader says instead of the squares. */
  codeAlternativeText: (address: string) => `Código QR do endereço ${address}`,

  actionProblems: {
    notLoadedYet: 'O cartão de QR ainda não foi carregado (load).',
    alreadyLoaded: 'O cartão de QR já foi carregado (load); crie outro para novos dados.',
    alreadyDisposed: 'O cartão de QR já foi descartado (dispose).',
    invalidPlayStep: 'Passo inválido para playAction: o cartão de QR tem só o passo 0.',
    unknownCustomAction: (actionId: string) =>
      `Ação personalizada desconhecida: "${actionId}". O cartão de QR não tem ações personalizadas.`,
  },

  validationProblems: {
    notAnObject: 'Dados inválidos: era esperado um objeto com os dados do cartão de QR.',
    missingField: (fieldName: string) => `Falta o campo obrigatório "${fieldName}".`,
    unknownField: (fieldName: string) => `Campo desconhecido nos dados: "${fieldName}".`,
    invalidField: (fieldName: string) => `Valor inválido no campo "${fieldName}".`,
  },

  addressProblems: {
    empty: 'O endereço do QR está vazio: o código precisa de um endereço para levar o celular.',
    tooLong: (length: number, longestLength: number) =>
      `O endereço do QR tem ${length} caracteres; no cartão cabe um código de no máximo ${longestLength}.`,
    notPlainText:
      'O endereço do QR só pode ter letras sem acento, números e os sinais de um endereço (sem espaços).',
  },

  preview: {
    pageTitle: 'Prévia — cartão de QR',
    controlsLabel: 'Controles da prévia',
    playButton: 'Entrar (play)',
    stopButton: 'Sair (stop)',
    shortAddressButton: 'Endereço curto',
    longestAddressButton: 'Endereço no limite',
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
