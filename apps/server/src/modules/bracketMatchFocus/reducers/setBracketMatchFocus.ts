import {
  type BracketMatchFocus,
  findBracketMatchFocusOfSource,
  listBracketMatchesInPlayOrder,
  type SetBracketMatchFocusCommand,
} from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { readBracketsTheCommandNames } from './bracketsTheCommandNames.js';
import { replaceFocusOfTheSource } from './focusOfTheSource.js';

/**
 * setBracketMatchFocus ("Escolher partida", BAJAOVRLAY-65): puts a match in "agora" or "a
 * seguir", or empties that slot (`matchId: null`). Any raced match of the session may go
 * in either slot, one listed after a match not yet run included (the final run before
 * the third place listed ahead of it). A match already in the other slot moves, emptying
 * that one: the bug and the card never show the same match. A focus of an earlier
 * session is dropped first, so nothing of another day is kept. Refused as
 * readBracketsTheCommandNames says, and for a match the brackets do not list as raced
 * (BRACKET_MATCH_NOT_FOUND; a bye is not raced). The refresher then rewrites the bound graphics on air.
 */
export function reduceSetBracketMatchFocus(
  slices: SlicesChangedByCommands,
  command: SetBracketMatchFocusCommand,
): ReducerOutcome {
  const bracketsOfTheCommand = readBracketsTheCommandNames(
    slices,
    command.sourceId,
    command.sessionId,
  );
  if (!bracketsOfTheCommand.isUsable) {
    return { status: 'refused', error: bracketsOfTheCommand.error };
  }
  const chosenMatchId = command.matchId;
  if (chosenMatchId !== null) {
    const isRacedMatch = listBracketMatchesInPlayOrder(bracketsOfTheCommand.brackets.rounds).some(
      (entry) => entry.match.matchId === chosenMatchId,
    );
    if (!isRacedMatch) {
      return {
        status: 'refused',
        error: {
          code: 'BRACKET_MATCH_NOT_FOUND',
          message: ptBR.bracketMatchFocus.matchNotFound(chosenMatchId),
        },
      };
    }
  }

  const focusBefore = findBracketMatchFocusOfSource(slices.bracketMatchFocuses, command.sourceId);
  const isFocusOfThisSession = focusBefore?.sessionId === command.sessionId;
  const currentMatchIdBefore = isFocusOfThisSession ? focusBefore.currentMatchId : undefined;
  const upNextMatchIdBefore = isFocusOfThisSession ? focusBefore.upNextMatchId : undefined;
  const newMatchId = chosenMatchId ?? undefined;

  let currentMatchId = currentMatchIdBefore;
  let upNextMatchId = upNextMatchIdBefore;
  if (command.slot === 'current') {
    currentMatchId = newMatchId;
    if (newMatchId !== undefined && upNextMatchId === newMatchId) {
      upNextMatchId = undefined;
    }
  } else {
    upNextMatchId = newMatchId;
    if (newMatchId !== undefined && currentMatchId === newMatchId) {
      currentMatchId = undefined;
    }
  }

  const focusAfter: BracketMatchFocus = {
    sourceId: command.sourceId,
    sessionId: command.sessionId,
  };
  if (currentMatchId !== undefined) {
    focusAfter.currentMatchId = currentMatchId;
  }
  if (upNextMatchId !== undefined) {
    focusAfter.upNextMatchId = upNextMatchId;
  }
  return {
    status: 'applied',
    slices: {
      ...slices,
      bracketMatchFocuses: replaceFocusOfTheSource(slices.bracketMatchFocuses, focusAfter),
    },
  };
}
