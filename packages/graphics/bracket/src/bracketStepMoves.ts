/**
 * The bracket's step moves: how a step comes on screen, and which pieces it brings in,
 * lifts out or shows at once, as GSAP timelines or at-once changes on the parts
 * (bracketAnimations.ts does the motion itself). bracket.ts owns the lifecycle and calls
 * these around each redraw; nothing here keeps any state.
 *
 * The four moves (motion.md, "Bracket"):
 * - enter: from off air, the head and the step's pieces come in (Entrar, or a take at a
 *   later step);
 * - new view: from a board to the next board page, or to the tree: the pieces on screen lift
 *   out together first, then the new view's come in, `--motion-lead` behind;
 * - add to the view: from one tree step to a later one: only what the step adds comes in
 *   (the next round's pills, the third place's), the lines into a round once its pills are
 *   in; what is on screen never moves;
 * - at once: a step back (a goto, or the server bringing the step within a bracket that
 *   shrank): the step is drawn with no motion.
 */
import {
  type BracketTimeline,
  buildCascadeInTimeline,
  buildLiftOutTogetherTimeline,
  hidePiecesAtOnce,
  type ResultChangesOnScreen,
  showPiecesAtOnce,
} from './bracketAnimations.js';
import type { BracketData } from './bracketModel.js';
import { describeStepOnScreen } from './bracketStepView.js';
import {
  type BracketParts,
  findResultCellOfCar,
  listEveryPieceOnScreen,
  listPiecesOnScreen,
} from './bracketView.js';
import { readOutcomeOfSignature } from './matchResults.js';

/** How a step comes on screen. */
export type StepMoveKind = 'enter' | 'newView' | 'addToTheView' | 'atOnce';

/** The step before the first: what "off air" counts as when a step is chosen. */
export const stepBeforeTheStart = -1;

/**
 * Chooses the move from the step on screen to the target: enter from off air, at once for
 * a step back, add to the view from one tree step to a later one, a new view otherwise.
 */
export function chooseStepMoveKind(
  data: BracketData,
  move: { stepBefore: number; targetStep: number; isEntering: boolean },
): StepMoveKind {
  if (move.isEntering) {
    return 'enter';
  }
  if (move.targetStep < move.stepBefore) {
    return 'atOnce';
  }
  const stepOnScreenBefore = describeStepOnScreen(data, move.stepBefore);
  const stepOnScreenAfter = describeStepOnScreen(data, move.targetStep);
  const isStayingInTheTree =
    stepOnScreenBefore.kind === 'tree' && stepOnScreenAfter.kind === 'tree';
  return isStayingInTheTree ? 'addToTheView' : 'newView';
}

/** The pieces on screen now, to tell, after a redraw, which ones the redraw added. */
export function rememberPiecesOnScreen(parts: BracketParts): Set<Element> {
  return new Set(listEveryPieceOnScreen(parts));
}

/** The lift-out of everything on the stage, and of the head too when it is leaving. */
export function buildLiftOutOfThePieces(parts: BracketParts, withHead: boolean): BracketTimeline {
  const pieces = listEveryPieceOnScreen(parts);
  return buildLiftOutTogetherTimeline(
    parts.tokensSource,
    withHead ? [parts.head, ...pieces] : pieces,
  );
}

/**
 * After the redraw of a step: hides the pieces that come in and builds their rise. On
 * "add to the view" only the pieces the redraw added come in (those not in
 * `piecesBefore`); on any other move every piece on the stage does.
 */
export function buildRiseOfTheStep(
  parts: BracketParts,
  moveKind: Exclude<StepMoveKind, 'atOnce'>,
  piecesBefore: Set<Element>,
): BracketTimeline {
  const isComingIn = (piece: Element) => moveKind !== 'addToTheView' || !piecesBefore.has(piece);
  const pieces = listPiecesOnScreen(parts);
  const atOnce = pieces.roundNames.filter(isComingIn);
  const cascade = [...pieces.matchCards, ...pieces.treeCarSlots].filter(isComingIn);
  const linesAfter = pieces.treeLines.filter(isComingIn);
  hidePiecesAtOnce(parts.tokensSource, [...atOnce, ...cascade, ...linesAfter]);
  return buildCascadeInTimeline(parts.tokensSource, {
    head: moveKind === 'enter' ? parts.head : undefined,
    atOnce,
    cascade,
    linesAfter,
    isCascadeLed: moveKind !== 'addToTheView',
  });
}

/** Shows every piece on the stage at once: a step drawn with no motion. */
export function showEveryPieceAtOnce(parts: BracketParts): void {
  showPiecesAtOnce(listEveryPieceOnScreen(parts));
}

/** Hides every piece on the stage at once: off air, ready for the next take. */
export function hideEveryPieceAtOnce(parts: BracketParts): void {
  hidePiecesAtOnce(parts.tokensSource, listEveryPieceOnScreen(parts));
}

/**
 * After an update redrawn on air: the pieces it added (a match listed in a round on
 * screen) are shown at once, in their place; nothing else changes.
 */
export function showPiecesAddedByAnUpdate(parts: BracketParts, piecesBefore: Set<Element>): void {
  const piecesAdded = listEveryPieceOnScreen(parts).filter((piece) => !piecesBefore.has(piece));
  showPiecesAtOnce(piecesAdded);
}

/**
 * The results an update changed on screen, from each car's result signature before and
 * after: their cells, the chips of the cars that became winners, and the cars (the board's
 * card side or the tree's pill) that became losers. A car that was not drawn before is
 * not a change: it is new, and appears with its piece.
 */
export function findResultChangesOnScreen(
  parts: BracketParts,
  signaturesBefore: Map<string, string>,
  signaturesAfter: Map<string, string>,
): ResultChangesOnScreen {
  const changes: ResultChangesOnScreen = { resultCells: [], winnerChipFills: [], losers: [] };
  for (const [carKey, signatureAfter] of signaturesAfter) {
    const signatureBefore = signaturesBefore.get(carKey);
    if (signatureBefore === undefined || signatureBefore === signatureAfter) {
      continue;
    }
    const cell = findResultCellOfCar(parts, carKey);
    const car = cell?.closest<HTMLElement>('[data-outcome]');
    if (cell === undefined || car === null || car === undefined) {
      continue;
    }
    changes.resultCells.push(cell);
    const outcomeBefore = readOutcomeOfSignature(signatureBefore);
    const outcomeAfter = car.dataset.outcome;
    if (outcomeAfter === 'winner' && outcomeBefore !== 'winner') {
      const fill = car.querySelector('[data-testid="bracket-chip-winner-fill"]');
      if (fill !== null) {
        changes.winnerChipFills.push(fill);
      }
    }
    if (outcomeAfter === 'loser' && outcomeBefore !== 'loser') {
      changes.losers.push(car);
    }
  }
  return changes;
}
