/**
 * Brackets from a flat list of matches (BAJAOVRLAY-25). A source sends its matches as one
 * list, each naming its round, as the Baja app's `tournament` table does (a round code per
 * row, made a name by mapValues); the brackets shape holds rounds of matches. This groups
 * the mapped matches into rounds, in the order each round is first met, and keeps each
 * match's own order inside its round: the source's order is the draw's.
 */

/** One round built from the matches: its name, the third-place mark, its matches. */
export type RoundOfMappedMatches = {
  name: string;
  isThirdPlace?: boolean;
  matches: Array<Record<string, unknown>>;
};

/** The rounds, and the 1-based lines of the matches that named no round (left out). */
export type MappedMatchesGrouping = {
  rounds: RoundOfMappedMatches[];
  linesWithoutRoundName: number[];
};

/**
 * Groups the mapped matches by `roundName`, first met first. A round is the third place
 * when any of its matches says `roundIsThirdPlace` true. The two round fields are taken off
 * each match, since the shape's matches do not carry them. A match with no round name (a
 * text, not empty) cannot be placed: its line is listed for the caller's problem line.
 */
export function groupMappedMatchesIntoRounds(
  matches: Array<Record<string, unknown>>,
): MappedMatchesGrouping {
  const rounds: RoundOfMappedMatches[] = [];
  const linesWithoutRoundName: number[] = [];

  matches.forEach((mappedMatch, matchIndex) => {
    const { roundName, roundIsThirdPlace, ...match } = mappedMatch;
    const isRoundNamed = typeof roundName === 'string' && roundName !== '';
    if (!isRoundNamed) {
      linesWithoutRoundName.push(matchIndex + 1);
      return;
    }

    let round = rounds.find((candidate) => candidate.name === roundName);
    if (round === undefined) {
      round = { name: roundName, matches: [] };
      rounds.push(round);
    }
    if (roundIsThirdPlace === true) {
      round.isThirdPlace = true;
    }
    round.matches.push(match);
  });

  return { rounds, linesWithoutRoundName };
}
