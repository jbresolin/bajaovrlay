/**
 * What each step of the bracket puts on screen, from the shared step plan
 * (`@bajaovrlay/shared/bracketSteps`, the one the server counts "Passo n de N" with): a round
 * board (the round, its page's matches, the head's event line naming the round and page)
 * or the tree (how many of its rounds, and whether the third place, are shown). Pure.
 */
import {
  countBracketSteps,
  listTreeOfBracket,
  planBracketSteps,
} from '@bajaovrlay/shared/bracketSteps';

import type { BracketData, BracketMatchData, BracketRoundData } from './bracketModel.js';
import { ptBR } from './ptBR.js';
import { countColumnsOfTree } from './treeLayout.js';

/** One step as the graphic draws it. */
export type StepOnScreen =
  | { kind: 'headAlone' }
  | {
      kind: 'board';
      /** The round of the board, by its index in the rounds (keys a board page's identity). */
      roundIndex: number;
      pageNumber: number;
      /** The head's event line: the round's name, and the page when it has several. */
      eventLine: string;
      matches: BracketMatchData[];
    }
  | { kind: 'tree'; treeRoundsShown: number; isThirdPlaceShown: boolean };

/** The tree's rounds: its columns first first, the third place apart, the columns it keeps. */
export type TreeOfBracket = {
  columnRounds: BracketRoundData[];
  thirdPlaceRound: BracketRoundData | undefined;
  /** The columns drawn: the rounds listed, or more, kept for the rounds still to come. */
  columnCount: number;
  /**
   * Every column's name, from the tree's first step: a listed round's own, or, for a round
   * still to come, the name its size implies ("Semifinal", "Final"; gate 2 of PR #30,
   * contract B). A round still to come has its name and no match and no step.
   */
  columnNames: string[];
};

/** How many steps the bracket has: the server's count, from the same shared function. */
export function countStepsOfBracket(data: BracketData): number {
  return countBracketSteps(data.rounds);
}

/**
 * The step at `stepIndex` (from 0). A step past the last is drawn as the last: data that
 * shrank on air never leaves the graphic on a step it does not have (the server brings
 * its own step back the same way). Brackets with no round are the head alone.
 */
export function describeStepOnScreen(data: BracketData, stepIndex: number): StepOnScreen {
  const steps = planBracketSteps(data.rounds);
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  if (step === undefined) {
    return { kind: 'headAlone' };
  }
  if (step.kind === 'tree') {
    return {
      kind: 'tree',
      treeRoundsShown: step.treeRoundsShown,
      isThirdPlaceShown: step.isThirdPlaceShown,
    };
  }
  const round = data.rounds[step.roundIndex];
  const roundName = round?.name ?? '';
  const eventLine =
    step.pageCount > 1
      ? ptBR.boardRoundOnPage(roundName, step.pageNumber, step.pageCount)
      : roundName;
  const lastMatchIndex = step.firstMatchIndex + step.matchCount;
  return {
    kind: 'board',
    roundIndex: step.roundIndex,
    pageNumber: step.pageNumber,
    eventLine,
    matches: (round?.matches ?? []).slice(step.firstMatchIndex, lastMatchIndex),
  };
}

/** The head's line at the right: the step on air of the bracket's steps, "3/7". */
export function writeStepLineOfBracket(stepIndex: number, stepCount: number): string {
  return ptBR.stepLine(Math.min(stepIndex, stepCount - 1) + 1, stepCount);
}

/** The tree's rounds, by the shared rule (four matches or fewer, the third place apart). */
export function describeTreeOfBracket(data: BracketData): TreeOfBracket {
  const tree = listTreeOfBracket(data.rounds);
  const columnRounds = tree.columnRoundIndexes.flatMap((roundIndex) => {
    const round = data.rounds[roundIndex];
    return round === undefined ? [] : [round];
  });
  const thirdPlaceRound =
    tree.thirdPlaceRoundIndex === undefined ? undefined : data.rounds[tree.thirdPlaceRoundIndex];
  const firstRoundMatchCount = columnRounds[0]?.matches.length ?? 0;
  const columnCount = countColumnsOfTree(firstRoundMatchCount, columnRounds.length);
  const columnNames: string[] = [];
  let impliedMatchCount = firstRoundMatchCount;
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    const listedRound = columnRounds[columnIndex];
    columnNames.push(listedRound?.name ?? nameRoundByTheSizeItWillHave(impliedMatchCount));
    impliedMatchCount = Math.ceil(impliedMatchCount / 2);
  }
  return { columnRounds, thirdPlaceRound, columnCount, columnNames };
}

/**
 * The name a tree round still to come is drawn with, from the matches it will have: one is
 * the final, two the semifinals, more (a tree starts at four at most) the quarter-finals.
 */
function nameRoundByTheSizeItWillHave(matchCount: number): string {
  if (matchCount <= 1) {
    return ptBR.roundsStillToCome.final;
  }
  if (matchCount === 2) {
    return ptBR.roundsStillToCome.semifinal;
  }
  return ptBR.roundsStillToCome.quarterFinals;
}
