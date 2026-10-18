import { ptBRFlexMapping } from './ptBRFlexMapping.js';

/**
 * The most problem lines a failed mapping lists. Someone writing a mapping wants to fix
 * them in one go, so more than one; a 60-car response with one wrong column would give 60
 * near-identical lines, so not all of them.
 */
export const mostProblemLinesListed = 20;

/**
 * The problems found while applying a mapping: the first lines, up to the cap, and how
 * many there were in all. Built fresh for every mapping and filled by addProblemLine.
 */
export type FlexMappingProblems = {
  lines: string[];
  totalCount: number;
};

/** Starts an empty list of problems for one mapping. */
export function startFlexMappingProblems(): FlexMappingProblems {
  return { lines: [], totalCount: 0 };
}

/** Counts one more problem, and keeps its line while fewer than the cap are kept. */
export function addProblemLine(problems: FlexMappingProblems, line: string): void {
  problems.totalCount += 1;
  if (problems.lines.length < mostProblemLinesListed) {
    problems.lines.push(line);
  }
}

/**
 * The one line the poll error stores: the first problem, then "(e mais N problemas)" when
 * there were more, counting every problem and not only the ones listed.
 */
export function summarizeFlexMappingProblems(problems: FlexMappingProblems): string {
  const firstLine = problems.lines[0] ?? '';
  const moreProblemCount = problems.totalCount - 1;
  if (moreProblemCount <= 0) {
    return firstLine;
  }
  return ptBRFlexMapping.summaryWithMoreProblems(firstLine, moreProblemCount);
}
