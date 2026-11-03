/**
 * Brackets from a flat list of matches (BAJAOVRLAY-25). A source sends its matches as one
 * list, each naming its round, as the Baja app's `tournament` table does (a round code per
 * row, made a name by mapValues); the brackets shape holds rounds of matches. This groups
 * the mapped matches into rounds, in the order each round is first met, and keeps each
 * match's own order inside its round: the source's order is the draw's.
 *
 * It is lenient where real tables are, so the shape can stay strict (gate 2 of PR #30): a
 * table with integer defaults writes 0 wins on every row and fills a bye's empty slot with
 * nothing but those wins. Wins on a match that is not a best of N are dropped, and so is a
 * carB with no car number (a bye), rather than refusing the whole snapshot for them. A bye
 * on the first slot puts the lone car on carA, and a one-car match the mapping says
 * nothing of is a W.O. (gate 2 of PR #38).
 */

/** One round built from the matches: its name, the third-place mark, its matches. */
export type RoundOfMappedMatches = {
  name: string;
  isThirdPlace?: boolean;
  matches: Array<Record<string, unknown>>;
};

/**
 * One round as grouped, with what the contracts need (bracketRoundsContracts.ts): whether
 * a rule marked any of its matches incomplete, and its matches' 1-based lines.
 */
export type GroupedRound = {
  round: RoundOfMappedMatches;
  hasAnIncompleteMatch: boolean;
  matchLineNumbers: number[];
};

/**
 * How the mapped matches are tidied up. `isAOneCarMatchABye`: the mapping reads a carB, so
 * a match left with carA alone is a bye, a W.O. when the mapping says nothing of one; a
 * mapping reading carA only has one car on every match and no bye to tell.
 */
export type MatchTidyingOptions = { isAOneCarMatchABye: boolean };

/** The rounds, and the 1-based lines of the matches that named no round (left out). */
export type MappedMatchesGrouping = {
  groupedRounds: GroupedRound[];
  linesWithoutRoundName: number[];
};

/**
 * Groups the mapped matches by `roundName`, first met first. A round is the third place
 * when any of its matches says `roundIsThirdPlace` true, and holds an incomplete match
 * when `isMatchIncomplete` says so for any of them. The two round fields are taken off
 * each match, since the shape's matches do not carry them. A match with no round name (a
 * text, not empty) cannot be placed: its line is listed for the caller's problem line.
 */
export function groupMappedMatchesIntoRounds(
  matches: Array<Record<string, unknown>>,
  isMatchIncomplete: boolean[],
  options: MatchTidyingOptions,
): MappedMatchesGrouping {
  const groupedRounds: GroupedRound[] = [];
  const linesWithoutRoundName: number[] = [];

  matches.forEach((mappedMatch, matchIndex) => {
    const lineNumber = matchIndex + 1;
    const { roundName, roundIsThirdPlace, ...match } = mappedMatch;
    const isRoundNamed = typeof roundName === 'string' && roundName !== '';
    if (!isRoundNamed) {
      linesWithoutRoundName.push(lineNumber);
      return;
    }

    let groupedRound = groupedRounds.find((candidate) => candidate.round.name === roundName);
    if (groupedRound === undefined) {
      groupedRound = {
        round: { name: roundName, matches: [] },
        hasAnIncompleteMatch: false,
        matchLineNumbers: [],
      };
      groupedRounds.push(groupedRound);
    }
    if (roundIsThirdPlace === true) {
      groupedRound.round.isThirdPlace = true;
    }
    if (isMatchIncomplete[matchIndex] === true) {
      groupedRound.hasAnIncompleteMatch = true;
    }
    groupedRound.matchLineNumbers.push(lineNumber);
    groupedRound.round.matches.push(tidyUpAMappedMatch(match, options));
  });

  return { groupedRounds, linesWithoutRoundName };
}

/** One car of a mapped match, when it is an object (the mapping builds it from its rules). */
function readMappedCar(
  match: Record<string, unknown>,
  side: 'carA' | 'carB',
): Record<string, unknown> | undefined {
  const car = match[side];
  const isAnObject = typeof car === 'object' && car !== null && !Array.isArray(car);
  return isAnObject ? (car as Record<string, unknown>) : undefined;
}

/**
 * A mapped match without what a table writes by default: the cars' wins when the match has
 * no bestOf, and a carB with no carNumber (a bye's empty slot). A bye drawn on the first
 * slot leaves carA with no carNumber and the team as carB: that car becomes carA, as the
 * shape draws a bye (gate 2 of PR #38). With `isAOneCarMatchABye`, a match left with one
 * car is a W.O. when the mapping says nothing of one, since the shape refuses a bye that
 * is not. Anything else is passed on as mapped, for the shape to judge.
 */
function tidyUpAMappedMatch(
  match: Record<string, unknown>,
  options: MatchTidyingOptions,
): Record<string, unknown> {
  const tidied = dropWhatATableWritesByDefault(match);
  const carA = readMappedCar(tidied, 'carA');
  const carB = readMappedCar(tidied, 'carB');
  const isTheTeamOnTheBSideAlone = carA?.carNumber === undefined && carB !== undefined;
  if (isTheTeamOnTheBSideAlone) {
    tidied.carA = carB;
    delete tidied.carB;
  }
  const isAMatchOfOneCar = tidied.carB === undefined;
  if (options.isAOneCarMatchABye && isAMatchOfOneCar && tidied.walkover === undefined) {
    tidied.walkover = true;
  }
  return tidied;
}

/**
 * A mapped match without what a table writes by default: the cars' wins when the match has
 * no bestOf, and a carB with no carNumber (a bye's empty slot).
 */
function dropWhatATableWritesByDefault(match: Record<string, unknown>): Record<string, unknown> {
  const tidied: Record<string, unknown> = { ...match };
  const isASeries = match.bestOf !== undefined;
  for (const side of ['carA', 'carB'] as const) {
    const car = readMappedCar(match, side);
    if (car === undefined) {
      continue;
    }
    const tidiedCar = { ...car };
    if (!isASeries) {
      delete tidiedCar.wins;
    }
    tidied[side] = tidiedCar;
  }
  const carB = readMappedCar(tidied, 'carB');
  if (carB !== undefined && carB.carNumber === undefined) {
    delete tidied.carB;
  }
  return tidied;
}
