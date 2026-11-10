import type { BracketRound } from '../dataShapes/index.js';
import { listBracketMatchesInPlayOrder } from './bracketMatchPlayOrder.js';

/** The matches the system suggests, each by its id, or undefined when there is none. */
export type SuggestedBracketMatches = {
  currentMatchId: string | undefined;
  upNextMatchId: string | undefined;
};

/**
 * The suggested "agora" and "a seguir" (BAJAOVRLAY-65): in play order, the first match
 * without a winner, then the next match without a winner after it. Byes are never
 * suggested. It reads the brackets alone, never the operator's choice: a match skipped on
 * track stays suggested until the source gives it a winner, which the operator overrides
 * by picking another. Pure.
 */
export function suggestBracketMatches(rounds: readonly BracketRound[]): SuggestedBracketMatches {
  const undecidedMatches = listBracketMatchesInPlayOrder(rounds).filter(
    (entry) => entry.match.winnerCarNumber === undefined,
  );
  const [firstUndecided, secondUndecided] = undecidedMatches;
  return {
    currentMatchId: firstUndecided?.match.matchId,
    upNextMatchId: secondUndecided?.match.matchId,
  };
}
