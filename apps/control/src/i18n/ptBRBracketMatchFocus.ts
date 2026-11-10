/**
 * The pt-BR words of "Partidas da chave" on the console (BAJAOVRLAY-65): the match "agora"
 * and the match "a seguir" of each Super Prime, the proposal once "agora" has its winner,
 * and the list of every match to choose from. Reached as ptBR.bracketMatchFocus.
 */
export const ptBRBracketMatchFocus = {
  areaTitle: 'Partidas da chave',
  /** The panel's title for one source, when more than one sends a Super Prime. */
  sourceTitle: (sourceLabel: string) => `Partidas da chave — ${sourceLabel}`,
  /** "Pequi × Acauã (Quartas de final)". */
  matchText: (carAName: string, carBName: string, roundName: string) =>
    `${carAName} × ${carBName} (${roundName})`,
  slotNames: { current: 'Agora', upNext: 'A seguir' },
  emptySlot: 'Nenhuma partida',
  /** A chosen match the source stopped listing: the graphics show nothing for it. */
  goneSlot: (matchId: string) =>
    `A partida escolhida (${matchId}) saiu da chave; os gráficos não mostram nada. Escolha outra.`,
  proposal: {
    currentDecided: (winnerName: string) => `Partida encerrada: ${winnerName} venceu.`,
    nextSuggested: (matchText: string) => `Próxima sugerida: ${matchText}`,
    nothingLeft: 'Não há mais partidas a disputar.',
    nothingChosen: (matchText: string) => `Sugerida para agora: ${matchText}`,
  },
  useSuggestionButton: 'Usar sugestão',
  chooseAnotherButton: 'Escolher outra',
  chooseButton: 'Escolher partida',
  dialog: {
    title: 'Escolher partida',
    description:
      'Todas as partidas da chave, na ordem da fonte. Qualquer uma pode ir para "Agora" ou "A seguir".',
    putNowButton: 'Agora',
    putUpNextButton: 'A seguir',
    emptyNowButton: 'Esvaziar "Agora"',
    emptyUpNextButton: 'Esvaziar "A seguir"',
    /** The accessible name of a match's two buttons: "Agora: Pequi × Acauã (Quartas de final)". */
    putButtonLabel: (slotName: string, matchText: string) => `${slotName}: ${matchText}`,
    closeButton: 'Fechar',
  },
  progressLabels: {
    decided: 'encerrada',
    running: 'em andamento',
    notStarted: 'a definir',
  },
  suggestedLabels: { current: 'sugerida agora', upNext: 'sugerida a seguir' },
  /** The slot a match is in now, beside it in the list. */
  inSlotLabels: { current: 'agora', upNext: 'a seguir' },
};
