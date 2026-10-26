/**
 * The bracket's live updates: what an update changes on the stage while the bracket is on
 * air, found by comparing the stage before and after the redraw (split from
 * bracketStepMoves.ts at gate 2 of PR #30). bracket.ts takes a snapshot of the stage, lets
 * Lit redraw it with the new data, then asks what changed: the pieces the redraw added are
 * shown at once, in their place, and a result that changed on a car already on screen gives
 * the crossfade of its cells, its winner's chip and its loser (motion.md: nothing moves).
 * A result of a match not on screen (another board page, a round not reached) changes
 * nothing that is drawn, so it starts no motion.
 */
import {
  type BracketTimeline,
  buildResultCrossfadeTimeline,
  type ResultChangesOnScreen,
  showPiecesAtOnce,
} from './bracketAnimations.js';
import {
  type BracketParts,
  findResultCellOfCar,
  listEveryPieceOnScreen,
  readResultSignaturesOnScreen,
} from './bracketView.js';
import { readOutcomeOfSignature } from './matchResults.js';

/** The stage before an update: its moving pieces and each car's result signature. */
export type StageSnapshot = {
  pieces: Set<Element>;
  resultSignatures: Map<string, string>;
};

/** Notes the stage as it is now, to compare with after the update's redraw. */
export function takeSnapshotOfTheStage(parts: BracketParts): StageSnapshot {
  return {
    pieces: new Set(listEveryPieceOnScreen(parts)),
    resultSignatures: readResultSignaturesOnScreen(parts),
  };
}

/**
 * After the redraw: shows at once the pieces the update added, and gives the crossfade of
 * the results it changed on screen, or undefined when no result on screen changed.
 */
export function showWhatTheUpdateChanged(
  parts: BracketParts,
  before: StageSnapshot,
): BracketTimeline | undefined {
  showPiecesAddedByAnUpdate(parts, before.pieces);
  const changes = findResultChangesOnScreen(
    parts,
    before.resultSignatures,
    readResultSignaturesOnScreen(parts),
  );
  if (changes.resultCells.length === 0) {
    return undefined;
  }
  return buildResultCrossfadeTimeline(parts.tokensSource, changes);
}

/**
 * After an update redrawn on air: the pieces it added (a match listed in a round on
 * screen) are shown at once, in their place; nothing else changes.
 */
function showPiecesAddedByAnUpdate(parts: BracketParts, piecesBefore: Set<Element>): void {
  const piecesAdded = listEveryPieceOnScreen(parts).filter((piece) => !piecesBefore.has(piece));
  showPiecesAtOnce(piecesAdded);
}

/**
 * The results an update changed on screen, from each car's result signature before and
 * after: their cells, the chips of the cars that became winners, and the cars (the board's
 * card side or the tree's pill) that became losers. A car that was not drawn before is
 * not a change: it is new, and appears with its piece.
 */
function findResultChangesOnScreen(
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
