/**
 * The step counters: named pure functions that count the steps of a graphic whose count
 * depends on its data (BAJAOVRLAY-25). A manifest asks for one with `stepCount: -1` (OGraf's
 * "dynamic") and `v_baja.stepCounter`, like `v_baja.updateRule` names an update rule: a
 * registry of named functions, never an expression (architecture rule 5). A counter is
 * handed the instance's resolved data and never throws; data it cannot read counts 1.
 */
import { type BracketRoundForSteps, countBracketSteps } from './bracketSteps.js';

/** Counts the steps of one instance from its resolved data: a whole number of 1 or more. */
export type StepCounter = (resolvedData: unknown) => number;

/**
 * The bracket's steps from its `rounds` field (packages/graphics/bracket). Rounds that are
 * not objects with a list of matches are passed over: the server checked the data against
 * the manifest's schema before it reached here, so this only keeps a counter from throwing.
 */
function countStepsOfBracketData(resolvedData: unknown): number {
  const isObject = typeof resolvedData === 'object' && resolvedData !== null;
  const rounds: unknown = isObject && 'rounds' in resolvedData ? resolvedData.rounds : undefined;
  if (!Array.isArray(rounds)) {
    return 1;
  }
  const readableRounds: BracketRoundForSteps[] = [];
  for (const round of rounds) {
    const isRoundReadable =
      typeof round === 'object' &&
      round !== null &&
      'matches' in round &&
      Array.isArray(round.matches);
    if (isRoundReadable) {
      const isThirdPlace = 'isThirdPlace' in round && round.isThirdPlace === true;
      readableRounds.push({ isThirdPlace, matches: round.matches });
    }
  }
  return countBracketSteps(readableRounds);
}

/** Every step counter, by the name a manifest's `v_baja.stepCounter` gives it. */
const stepCountersByName: Readonly<Record<string, StepCounter>> = {
  bracketSteps: countStepsOfBracketData,
};

/** The step counter of that name, or undefined when there is none. */
export function findStepCounter(stepCounterName: string): StepCounter | undefined {
  if (!Object.hasOwn(stepCountersByName, stepCounterName)) {
    return undefined;
  }
  return stepCountersByName[stepCounterName];
}
