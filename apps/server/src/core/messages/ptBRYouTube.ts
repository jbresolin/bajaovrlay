/**
 * The pt-BR errors of the YouTube live chat source (BAJAOVRLAY-35): what the operator
 * reads on the source's row when a poll fails. None ever quotes the API key or an address
 * that carries it.
 */
export const ptBRYouTube = {
  apiKeyMissing:
    'Falta a chave BAJAOVRLAY_YOUTUBE_API_KEY no servidor: veja docs/youtube.md para criar uma.',
  apiKeyRefused:
    'Chave da API do YouTube recusada: confira BAJAOVRLAY_YOUTUBE_API_KEY e se a YouTube Data API v3 está ativada no projeto.',
  videoNotFound: 'Vídeo não encontrado no YouTube: confira o endereço da transmissão.',
  noActiveLiveChat: 'Esta transmissão não tem chat ao vivo ativo.',
  liveChatEnded: 'A transmissão terminou: o chat ao vivo foi encerrado.',
  liveChatDisabled: 'O chat ao vivo está desativado nesta transmissão.',
  liveChatNotFound:
    'O YouTube não encontrou o chat desta transmissão; ele é procurado de novo na próxima leitura.',
  liveChatForbidden: 'O YouTube não deixa esta chave ler o chat desta transmissão.',
  googleQuotaExceeded:
    'O YouTube recusou: a cota diária da chave acabou no Google (volta à meia-noite do Pacífico).',
  rateLimited: 'O YouTube pediu para ler o chat mais devagar; a próxima leitura tenta de novo.',
  dailyUnitsNotANumber:
    'BAJAOVRLAY_YOUTUBE_DAILY_UNITS deve ser um número inteiro de 1 a 10000 (vazio: 9000).',
  /** The server's own budget (BAJAOVRLAY_YOUTUBE_DAILY_UNITS) is spent; "volta às 5h". */
  dailyBudgetSpent: (brasiliaHourOfTheReset: number) =>
    `Cota diária do YouTube esgotada; volta às ${String(brasiliaHourOfTheReset)}h`,
  /** Any other refusal, by its HTTP status and Google's reason word (never its message). */
  otherRefusal: (httpStatus: number, reason: string) =>
    `O YouTube recusou a leitura do chat (HTTP ${String(httpStatus)}, ${reason}).`,
  noConnection: 'Sem conexão com o YouTube.',
  /**
   * The simulator's Super Chats (simulatedSuperChats.ts): fictional viewers and messages,
   * never a real person's name, so a rehearsal never puts someone on air by mistake.
   */
  simulatedSuperChats: {
    viewerNames: [
      'Torcida Pequi Off-Road',
      'Torcida Carnaúba Baja',
      'Família do Piloto 31',
      'Galera do Paddock',
      'Ex-integrante da Acauã',
      'Torcida Gralha Azul',
      'Amigos da Oficina',
      'Fã de Baja de Piracicaba',
    ],
    messages: [
      'Vai, Pequi! Abraço de Goiânia',
      'Força, equipe! O box inteiro está torcendo',
      'Que corrida! Mandem um abraço pra Escola de Engenharia',
      'Bora, bora! Mais uma volta sem quebra',
      'Parabéns a todas as equipes pelo enduro',
      '',
    ],
    /** The amounts drawn, in whole reais, with YouTube's tier for each. */
    amounts: [
      { reais: 5, tier: 1 },
      { reais: 10, tier: 2 },
      { reais: 20, tier: 3 },
      { reais: 50, tier: 4 },
      { reais: 100, tier: 5 },
      { reais: 200, tier: 6 },
    ],
  },
  answerNotUnderstood: 'O YouTube respondeu algo que o servidor não entendeu.',
};
