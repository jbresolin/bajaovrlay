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
} as const;
