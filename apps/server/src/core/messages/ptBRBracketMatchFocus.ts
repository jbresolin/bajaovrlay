/**
 * The server's pt-BR messages about the match focus of a Super Prime (BAJAOVRLAY-65),
 * reached as ptBR.bracketMatchFocus. Kept apart from ptBR.ts to keep that file short.
 */
export const ptBRBracketMatchFocus = {
  bracketsNotSent: (sourceLabel: string) => `A fonte ${sourceLabel} não manda chaves agora.`,
  sessionChanged: (sessionIdNow: string) =>
    `A chave mudou de sessão (agora ${sessionIdNow}); escolha a partida de novo.`,
  matchNotFound: (matchId: string) =>
    `A partida ${matchId} não está entre as partidas disputadas da chave.`,
  nothingToSuggest: 'Não há partida a sugerir: todas as partidas da chave já têm vencedor.',
};
