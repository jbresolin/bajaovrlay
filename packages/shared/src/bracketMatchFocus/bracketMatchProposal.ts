import type { BracketsShape } from '../dataShapes/index.js';
import type { BracketMatchFocus } from './bracketMatchFocus.js';
import { listBracketMatchesInPlayOrder } from './bracketMatchPlayOrder.js';
import { suggestBracketMatches, type SuggestedBracketMatches } from './bracketMatchSuggestions.js';
import { readFocusedBracketMatch } from './focusedBracketMatch.js';

/**
 * What "Usar sugestão" puts in "agora" and "a seguir" (BAJAOVRLAY-65, gate 2 of PR #60).
 * The operator's "a seguir" comes first: holding a match still to race, it moves up to
 * "agora", and "a seguir" takes the first match in play order still to race after it.
 * Otherwise (empty, decided, gone, or of another session) the play-order suggestion.
 * The page shows this and the server applies it, so the two always agree. Pure.
 */
export function proposeBracketMatches(
  brackets: BracketsShape,
  focus: BracketMatchFocus | undefined,
): SuggestedBracketMatches {
  const upNextReading = readFocusedBracketMatch(brackets, focus, 'upNext');
  if (upNextReading.status !== 'chosen') {
    return suggestBracketMatches(brackets.rounds);
  }
  const chosenUpNextMatch = upNextReading.matchInPlayOrder.match;
  const isChosenUpNextStillToRace = chosenUpNextMatch.winnerCarNumber === undefined;
  if (!isChosenUpNextStillToRace) {
    return suggestBracketMatches(brackets.rounds);
  }

  // "Still to race" is the suggestion's own rule: no winner yet (byes are never listed).
  const nextStillToRace = listBracketMatchesInPlayOrder(brackets.rounds).find(
    (entry) =>
      entry.match.winnerCarNumber === undefined &&
      entry.match.matchId !== chosenUpNextMatch.matchId,
  );
  return {
    currentMatchId: chosenUpNextMatch.matchId,
    upNextMatchId: nextStillToRace?.match.matchId,
  };
}
