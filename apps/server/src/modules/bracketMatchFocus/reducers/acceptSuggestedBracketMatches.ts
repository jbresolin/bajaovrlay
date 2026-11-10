import {
  type AcceptSuggestedBracketMatchesCommand,
  type BracketMatchFocus,
  findBracketMatchFocusOfSource,
  proposeBracketMatches,
} from '@bajaovrlay/shared';

import { ptBR } from '../../../core/messages/ptBR.js';
import type {
  ReducerOutcome,
  SlicesChangedByCommands,
} from '../../../core/store/reducers/reducerTypes.js';
import { readBracketsTheCommandNames } from './bracketsTheCommandNames.js';
import { replaceFocusOfTheSource } from './focusOfTheSource.js';

/**
 * acceptSuggestedBracketMatches ("Usar sugestão", BAJAOVRLAY-65): "agora" and "a seguir"
 * become the proposal (shared's proposeBracketMatches: the Produtor's "a seguir" moved up
 * first, else the play-order suggestion); whatever was in either slot is replaced. The
 * proposal is worked out here, from the brackets and the focus the server holds when the
 * command arrives, and must be the one the page showed: a winner arriving between the
 * page drawing it and the press is refused (BRACKET_PROPOSAL_CHANGED) rather than putting
 * on air a match the Produtor never saw. Also refused as readBracketsTheCommandNames
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
  // A focus of another session reads as empty inside proposeBracketMatches.
  const focusBefore = findBracketMatchFocusOfSource(slices.bracketMatchFocuses, command.sourceId);
  const proposal = proposeBracketMatches(bracketsOfTheCommand.brackets, focusBefore);
  const proposedCurrentMatchId = proposal.currentMatchId;
  if (proposedCurrentMatchId === undefined) {
    return {
      status: 'refused',
      error: {
        code: 'NO_SUGGESTED_BRACKET_MATCH',
        message: ptBR.bracketMatchFocus.nothingToSuggest,
      },
    };
  }
  const upNextMatchIdShown = command.upNextMatchId ?? undefined;
  const isTheProposalShown =
    command.currentMatchId === proposedCurrentMatchId &&
    upNextMatchIdShown === proposal.upNextMatchId;
  if (!isTheProposalShown) {
    return {
      status: 'refused',
      error: {
        code: 'BRACKET_PROPOSAL_CHANGED',
        message: ptBR.bracketMatchFocus.proposalChanged(
          proposedCurrentMatchId,
          proposal.upNextMatchId,
        ),
      },
    };
  }

  const focusAfter: BracketMatchFocus = {
    sourceId: command.sourceId,
    sessionId: command.sessionId,
    currentMatchId: proposedCurrentMatchId,
  };
  if (proposal.upNextMatchId !== undefined) {
    focusAfter.upNextMatchId = proposal.upNextMatchId;
  }
  return {
    status: 'applied',
    slices: {
      ...slices,
      bracketMatchFocuses: replaceFocusOfTheSource(slices.bracketMatchFocuses, focusAfter),
    },
  };
}
