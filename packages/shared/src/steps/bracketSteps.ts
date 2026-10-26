/**
 * A bracket's steps, from its rounds alone (BAJAOVRLAY-25, catalogue entry 4). The bracket
 * graphic and the server both import this module: the graphic to know what each step
 * draws, the server to count the steps Camadas offers ("Passo 2 de 7"). It imports no Zod
 * and reads only what it names below, so a graphic bundles it without the shared schemas.
 *
 * The rule: a round of more than four matches is a round board, 32 matches a page, one
 * step a page; the rounds of four matches or fewer (the quarter-finals down) are the tree,
 * one step a round, each step adding its round to those already shown; the third-place
 * round is not a column of the tree but gets its own step just before the final's, as it
 * runs before the final.
 */

/** How many matches a round board shows on one page (two columns of 16). */
export const matchesPerBoardPage = 32;

/** The most matches a round of the tree has: the quarter-finals. More makes a board. */
export const mostMatchesOfATreeRound = 4;

/** What the plan reads of a round: whether it is the third place, and how many matches. */
export type BracketRoundForSteps = {
  isThirdPlace?: boolean | undefined;
  matches: readonly unknown[];
};

/** One step of a bracket: a page of a round board, or the tree with some of its rounds. */
export type BracketStep =
  | {
      kind: 'board';
      /** The round of the board, by its index in the brackets' rounds. */
      roundIndex: number;
      /** This page, from 1, of the round's pages. */
      pageNumber: number;
      pageCount: number;
      /** The page's first match, by its index in the round, and how many it shows. */
      firstMatchIndex: number;
      matchCount: number;
    }
  | {
      kind: 'tree';
      /** How many of the tree's rounds are shown, first first (listTreeOfBracket's columns). */
      treeRoundsShown: number;
      isThirdPlaceShown: boolean;
    };

/** Which rounds the tree draws: its columns, first first, and the third place under the last. */
export type BracketTree = {
  /** The rounds of the tree's columns, by their index in the brackets' rounds. */
  columnRoundIndexes: number[];
  /** The third-place round's index, when the brackets have one. */
  thirdPlaceRoundIndex: number | undefined;
};

/**
 * The tree's rounds: every round of four matches or fewer that is not the third place, in
 * the brackets' order, and the third-place round apart.
 */
export function listTreeOfBracket(rounds: readonly BracketRoundForSteps[]): BracketTree {
  const columnRoundIndexes: number[] = [];
  let thirdPlaceRoundIndex: number | undefined;
  rounds.forEach((round, roundIndex) => {
    if (round.isThirdPlace === true) {
      thirdPlaceRoundIndex = roundIndex;
      return;
    }
    if (round.matches.length <= mostMatchesOfATreeRound) {
      columnRoundIndexes.push(roundIndex);
    }
  });
  return { columnRoundIndexes, thirdPlaceRoundIndex };
}

/**
 * Lists the steps: first a step for every page of every board round, in round order, then
 * one tree step per tree round, the third place's step just before the last (the final's).
 * Empty when there are no rounds. The brackets shape puts a third place after a round of
 * two matches, so the tree always has a round for it to come before.
 */
export function planBracketSteps(rounds: readonly BracketRoundForSteps[]): BracketStep[] {
  const steps: BracketStep[] = [];
  rounds.forEach((round, roundIndex) => {
    const isBoardRound =
      round.isThirdPlace !== true && round.matches.length > mostMatchesOfATreeRound;
    if (!isBoardRound) {
      return;
    }
    const pageCount = Math.ceil(round.matches.length / matchesPerBoardPage);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const firstMatchIndex = (pageNumber - 1) * matchesPerBoardPage;
      const matchCount = Math.min(matchesPerBoardPage, round.matches.length - firstMatchIndex);
      steps.push({ kind: 'board', roundIndex, pageNumber, pageCount, firstMatchIndex, matchCount });
    }
  });

  const tree = listTreeOfBracket(rounds);
  const hasThirdPlace = tree.thirdPlaceRoundIndex !== undefined;
  const treeRoundCount = tree.columnRoundIndexes.length;
  for (let treeRoundsShown = 1; treeRoundsShown <= treeRoundCount; treeRoundsShown += 1) {
    const isTheFinalsStep = treeRoundsShown === treeRoundCount;
    if (isTheFinalsStep && hasThirdPlace) {
      steps.push({ kind: 'tree', treeRoundsShown: treeRoundsShown - 1, isThirdPlaceShown: true });
    }
    steps.push({
      kind: 'tree',
      treeRoundsShown,
      isThirdPlaceShown: isTheFinalsStep && hasThirdPlace,
    });
  }
  return steps;
}

/**
 * How many steps the bracket has: one per step of the plan, and 1 when the plan is empty
 * (the head alone), since a graphic on air is always on some step.
 */
export function countBracketSteps(rounds: readonly BracketRoundForSteps[]): number {
  return Math.max(1, planBracketSteps(rounds).length);
}
