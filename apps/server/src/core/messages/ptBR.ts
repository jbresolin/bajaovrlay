/**
 * pt-BR catalog for every message the server sends to people (error answers the
 * control page shows to the operator). Log messages stay in English: they are for
 * developers and are searched with tools, not read on air.
 */
export const ptBR = {
  errors: {
    routeNotFound: 'Endereço não encontrado no servidor.',
    unexpectedServerError:
      'Erro inesperado no servidor. Procure no log do servidor o request_id desta resposta.',
  },
  // Answers to commands and WebSocket messages; each goes with a stable code
  // (CommandErrorCodeSchema in @bajaovrlay/shared).
  commandErrors: {
    invalidCommandField: (fieldPath: string) =>
      `Comando inválido: o campo "${fieldPath}" está ausente ou tem um valor errado.`,
    invalidCommandShape: 'Comando inválido: envie um objeto com o campo "type".',
    unauthorizedCommand: 'Você não tem permissão para executar este comando.',
    layerNotFound: (layerId: string) => `A camada "${layerId}" não existe.`,
    graphicNotFound: (graphicId: string) => `O gráfico "${graphicId}" não está registrado.`,
    invalidMessage: 'Mensagem inválida: o servidor aceita apenas mensagens JSON do protocolo.',
    unexpectedServerError:
      'Erro inesperado no servidor ao executar o comando. Procure o erro no log do servidor.',
  },
  // Names of the layers seeded on the first boot, as the operator sees them.
  seededLayerNames: {
    bug: 'Logo',
    ticker: 'Letreiro',
    clock: 'Relógio',
    lowerThird: 'Tarja',
    fullscreen: 'Tela cheia',
  },
} as const;
