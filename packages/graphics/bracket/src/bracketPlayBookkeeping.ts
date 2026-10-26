/**
 * The bracket's play and step bookkeeping (split from bracket.ts at the merge round of PR
 * #30, as the podium keeps podiumStepMoves.ts): what a play asks for before anything moves,
 * a step brought within the data on screen, and the count of moves that lets a play or a
 * stop overtaken by a later one give the bracket up, and the answers that follow from the
 * lifecycle. bracket.ts owns the lifecycle and runs the motions; nothing here touches the
 * page.
 *
 * The steps (stepCount -1 in the manifest, counted from the rounds: one per round-board
 * page, one per tree round, one for the third place): play from off air goes to step 0
 * (Entrar), each further play to the next (Próximo); a play past the last is the end and
 * takes the bracket off air. A `goto` forward brings the steps' pieces in; a `goto` back
 * draws the step at once, with no motion.
 */
import type {
  OGrafPlayActionReturnPayload,
  OGrafReturnPayload,
} from '@bajaovrlay/graphics-kit/ografGraphicTypes';
import { choosePlayActionTarget } from '@bajaovrlay/graphics-kit/playSteps';

import type { BracketData } from './bracketModel.js';
import { chooseStepMoveKind, stepBeforeTheStart, type StepMoveKind } from './bracketStepMoves.js';
import { countStepsOfBracket } from './bracketStepView.js';
import { ptBR } from './ptBR.js';

/** Where the bracket is in its OGraf lifecycle. */
export type LifecycleStage = 'unloaded' | 'loading' | 'offAir' | 'onAir' | 'disposed';

/** Builds a 4xx answer with a pt-BR message; OGraf actions answer errors, never throw. */
export function buildRefusalAnswer(statusCode: number, statusMessage: string): OGrafReturnPayload {
  return { statusCode, statusMessage };
}

/** The 409 a load answers after dispose or after a first load; none before the first. */
export function refuseASecondLoad(lifecycle: LifecycleStage): OGrafReturnPayload | undefined {
  if (lifecycle === 'disposed') {
    return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
  }
  if (lifecycle !== 'unloaded') {
    return buildRefusalAnswer(409, ptBR.actionProblems.alreadyLoaded);
  }
  return undefined;
}

/** The 409 an action answers before load has finished or after dispose; none otherwise. */
export function refuseUnlessLoaded(lifecycle: LifecycleStage): OGrafReturnPayload | undefined {
  if (lifecycle === 'unloaded' || lifecycle === 'loading') {
    return buildRefusalAnswer(409, ptBR.actionProblems.notLoadedYet);
  }
  if (lifecycle === 'disposed') {
    return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
  }
  return undefined;
}

/** The answer of a play another play, a stop or a dispose took over: the step on air now. */
export function answerAfterAnotherMoveTookOver(
  lifecycleNow: LifecycleStage,
  stepOnAirNow: number | undefined,
): OGrafPlayActionReturnPayload {
  if (lifecycleNow === 'disposed') {
    return buildRefusalAnswer(409, ptBR.actionProblems.alreadyDisposed);
  }
  return { statusCode: 200, currentStep: stepOnAirNow };
}

/** What a play asks for, decided from the data and the step on air before anything moves. */
export type PlayPlan =
  | { kind: 'invalidStep' }
  | { kind: 'toTheEnd' }
  | { kind: 'alreadyOnIt'; step: number }
  | {
      kind: 'move';
      targetStep: number;
      stepBefore: number;
      isEntering: boolean;
      moveKind: StepMoveKind;
    };

/**
 * Plans a play by the OGraf step rule (the kit's playSteps): a step before the start is
 * invalid, one past the last is the end (stop), the step on air already is nothing to do;
 * any other is a move, entering from off air, and of the kind bracketStepMoves chooses.
 */
export function planThePlay(request: {
  data: BracketData;
  currentStep: number | undefined;
  isOnAir: boolean;
  goto: number | undefined;
  delta: number | undefined;
}): PlayPlan {
  const target = choosePlayActionTarget({
    currentStep: request.currentStep,
    stepCount: countStepsOfBracket(request.data),
    goto: request.goto,
    delta: request.delta,
  });
  if (target.outcome === 'invalidStep') {
    return { kind: 'invalidStep' };
  }
  if (target.outcome === 'goToEnd') {
    return { kind: 'toTheEnd' };
  }
  const isEntering = !request.isOnAir;
  const stepBefore = isEntering ? stepBeforeTheStart : (request.currentStep ?? 0);
  if (target.step === stepBefore) {
    return { kind: 'alreadyOnIt', step: target.step };
  }
  const moveKind = chooseStepMoveKind(request.data, {
    stepBefore,
    targetStep: target.step,
    isEntering,
  });
  return { kind: 'move', targetStep: target.step, stepBefore, isEntering, moveKind };
}

/**
 * The step brought within the data's steps: its last when the data has fewer, as the server
 * brings its own step back (instanceStepsWithinTheirCount.ts).
 */
export function bringTheStepWithinTheData(step: number, data: BracketData): number {
  return Math.min(step, countStepsOfBracket(data) - 1);
}

/** The count of moves, and the play whose lift-out to a new view is running. */
export type MoveBookkeeping = {
  /** Starts a play or a stop: every move before it is overtaken. Returns its number. */
  startAMove: () => number;
  /** Whether a later move (a play, a stop, a dispose) has come since this one started. */
  isOvertaken: (moveNumber: number) => boolean;
  /** Overtakes every move under way: dispose, or the element leaving the page. */
  overtakeEveryMove: () => void;
  /** Marks this play's lift-out to a new view running: an update meanwhile is only kept. */
  startLiftOut: (moveNumber: number) => void;
  /** Marks it over, unless a later play's has started meanwhile. */
  endLiftOut: (moveNumber: number) => void;
  /** Whether a play's lift-out to a new view is running now. */
  isLiftingOutForANewView: () => boolean;
};

/** Creates the bookkeeping with no move made. */
export function createMoveBookkeeping(): MoveBookkeeping {
  let lastMoveNumber = 0;
  let moveLiftingOut: number | undefined;
  return {
    startAMove: () => {
      lastMoveNumber += 1;
      return lastMoveNumber;
    },
    isOvertaken: (moveNumber) => moveNumber !== lastMoveNumber,
    overtakeEveryMove: () => {
      lastMoveNumber += 1;
    },
    startLiftOut: (moveNumber) => {
      moveLiftingOut = moveNumber;
    },
    endLiftOut: (moveNumber) => {
      if (moveLiftingOut === moveNumber) {
        moveLiftingOut = undefined;
      }
    },
    isLiftingOutForANewView: () => moveLiftingOut !== undefined,
  };
}
