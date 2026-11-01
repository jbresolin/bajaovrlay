/**
 * Brackets' contracts A and C, applied on our side (BAJAOVRLAY-53), for any source whose
 * tournament lists pending slots mid-way or its third place after the final, as the Baja
 * app's does. The shape stays strict: it still refuses a pending slot or a reversed order
 * from a hand-written source.
 * - Contract C: a third-place round listed after the final is moved just before it.
 * - Contract A: the first round holding an incomplete match (marked by the mapping's
 *   entryIsIncompleteWhen) is left out, with every round after it. The third place is
 *   judged alone, since no round depends on it: an incomplete third place is left out by
 *   itself, and a finished final is kept. So a finished round is never lost.
 */
import type { GroupedRound } from './bracketRoundsOfMappedMatches.js';

/**
 * Applies contract C, then contract A, to the grouped rounds; gives back the rounds kept,
 * in their new order, so the caller can report problems for their matches only.
 */
export function keepWholeRoundsWithTheThirdPlaceBeforeTheFinal(
  groupedRounds: GroupedRound[],
): GroupedRound[] {
  const roundsInOrder = moveTheThirdPlaceBeforeTheFinal(groupedRounds);
  return leaveOutRoundsFromTheFirstIncompleteOne(roundsInOrder);
}

/**
 * Moves a third-place round that comes after the final (the last round that is not the
 * third place) to just before it; any other order is kept as it is.
 */
function moveTheThirdPlaceBeforeTheFinal(groupedRounds: GroupedRound[]): GroupedRound[] {
  const thirdPlaceIndex = groupedRounds.findIndex((grouped) => grouped.round.isThirdPlace === true);
  const finalIndex = groupedRounds.findLastIndex((grouped) => grouped.round.isThirdPlace !== true);
  const isThirdPlaceAfterTheFinal =
    thirdPlaceIndex !== -1 && finalIndex !== -1 && thirdPlaceIndex > finalIndex;
  if (!isThirdPlaceAfterTheFinal) {
    return groupedRounds;
  }
  const thirdPlace = groupedRounds[thirdPlaceIndex];
  if (thirdPlace === undefined) {
    return groupedRounds;
  }
  const roundsWithoutTheThirdPlace = groupedRounds.filter((_, index) => index !== thirdPlaceIndex);
  roundsWithoutTheThirdPlace.splice(finalIndex, 0, thirdPlace);
  return roundsWithoutTheThirdPlace;
}

/**
 * Keeps the rounds before the first incomplete one that is not the third place, and the
 * third place among them only when it is complete.
 */
function leaveOutRoundsFromTheFirstIncompleteOne(groupedRounds: GroupedRound[]): GroupedRound[] {
  const firstIncompleteIndex = groupedRounds.findIndex(
    (grouped) => grouped.hasAnIncompleteMatch && grouped.round.isThirdPlace !== true,
  );
  const roundsUpToTheCut =
    firstIncompleteIndex === -1 ? groupedRounds : groupedRounds.slice(0, firstIncompleteIndex);
  return roundsUpToTheCut.filter(
    (grouped) => !(grouped.round.isThirdPlace === true && grouped.hasAnIncompleteMatch),
  );
}
