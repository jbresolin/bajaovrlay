import {
  type AcceptSuggestedBracketMatchesCommand,
  type BracketMatchFocus,
  suggestBracketMatches,
} from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { readBracketsTheCommandNames } from './bracketsTheCommandNames.js';
import { replaceFocusOfTheSource } from './focusOfTheSource.js';

/**
 * acceptSuggestedBracketMatches ("Usar sugestão", BAJAOVRLAY-65): "agora" becomes the
 * suggested match and "a seguir" the one after it, or empty when none is left; whatever
 * was in either slot is replaced. The suggestion is worked out here, from the brackets
 * the server holds when the command arrives, never taken from the page, so a page drawn
 * a poll ago cannot put an older suggestion on air. Refused as readBracketsTheCommandNames
 * says, and when every match has its winner (NO_SUGGESTED_BRACKET_MATCH).
 */
export function reduceAcceptSuggestedBracketMatches(
  slices: SlicesChangedByCommands,
  command: AcceptSuggestedBracketMatchesCommand,
): ReducerOutcome {
  const bracketsOfTheCommand = readBracketsTheCommandNames(
    slices,
    command.sourceId,
    command.sessionId,
  );
  if (!bracketsOfTheCommand.isUsable) {
    return { status: 'refused', error: bracketsOfTheCommand.error };
  }
  const suggestion = suggestBracketMatches(bracketsOfTheCommand.brackets.rounds);
  if (suggestion.currentMatchId === undefined) {
    return {
      status: 'refused',
      error: {
        code: 'NO_SUGGESTED_BRACKET_MATCH',
        message: ptBR.bracketMatchFocus.nothingToSuggest,
      },
    };
  }

  const focusAfter: BracketMatchFocus = {
    sourceId: command.sourceId,
    sessionId: command.sessionId,
    currentMatchId: suggestion.currentMatchId,
  };
  if (suggestion.upNextMatchId !== undefined) {
    focusAfter.upNextMatchId = suggestion.upNextMatchId;
  }
  return {
    status: 'applied',
    slices: {
      ...slices,
      bracketMatchFocuses: replaceFocusOfTheSource(slices.bracketMatchFocuses, focusAfter),
    },
  };
}
