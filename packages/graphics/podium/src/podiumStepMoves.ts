/**
 * The podium's step moves: which cards a step reveals, hides or lifts out, as GSAP
 * timelines or at-once changes on the parts (podiumAnimations.ts does the motion itself).
 * podium.ts owns the lifecycle and calls these with the steps before and after; nothing
 * here keeps any state. Split from podium.ts at gate 2 of PR #27, to keep that file to its
 * one job.
 */
import {
  buildLiftOutTogetherTimeline,
  buildRiseInTimeline,
  hideCardsAtOnce,
  type PodiumTimeline,
  showCardsAtOnce,
} from './podiumAnimations.js';
import { listSlotsRevealedBetweenSteps, type PodiumSlot, revealStepOfSlot } from './podiumModel.js';
import { isCardOfSlotFilled, type PodiumParts } from './podiumView.js';

/** Every slot, for the moves that touch all three cards. */
export const everySlot: PodiumSlot[] = ['second', 'first', 'third'];

/** The step before the first: what "off air" counts as when choosing the cards to reveal. */
export const stepBeforeTheStart = -1;

/** The card elements of these slots, in the same order. */
export function listCardsOfSlots(parts: PodiumParts, slots: PodiumSlot[]): HTMLElement[] {
  return slots.map((slot) => parts.cardsBySlot[slot]);
}

/** Hides every card at once, with no motion: at load, and once the podium is off air. */
export function hideEveryCardAtOnce(parts: PodiumParts): void {
  hideCardsAtOnce(parts.tokensSource, listCardsOfSlots(parts, everySlot));
}

/** A `goto` back to an earlier step: the cards revealed after it are hidden at once. */
export function hideCardsPastStep(parts: PodiumParts, targetStep: number, stepBefore: number) {
  const slotsToHide = listSlotsRevealedBetweenSteps(targetStep, stepBefore);
  hideCardsAtOnce(parts.tokensSource, listCardsOfSlots(parts, slotsToHide));
}

/**
 * The rise of a step forward: the cards with an entry revealed between the two steps, and
 * the head with them when the podium is entering (from off air).
 */
export function buildRevealTimeline(
  parts: PodiumParts,
  move: { stepBefore: number; targetStep: number; isEntering: boolean },
): PodiumTimeline {
  const slotsToReveal = listSlotsRevealedBetweenSteps(move.stepBefore, move.targetStep).filter(
    (slot) => isCardOfSlotFilled(parts, slot),
  );
  return buildRiseInTimeline(parts.tokensSource, {
    head: move.isEntering ? parts.head : undefined,
    cards: listCardsOfSlots(parts, slotsToReveal),
  });
}

/** The stop-out: the head and the cards revealed at the step on air lift out together. */
export function buildStopOutTimeline(parts: PodiumParts, stepOnAir: number): PodiumTimeline {
  const revealedSlots = listSlotsRevealedBetweenSteps(stepBeforeTheStart, stepOnAir).filter(
    (slot) => isCardOfSlotFilled(parts, slot),
  );
  const piecesOnAir = [parts.head, ...listCardsOfSlots(parts, revealedSlots)];
  return buildLiftOutTogetherTimeline(parts.tokensSource, piecesOnAir);
}

/** The slots whose card has an entry now: read before an update, to compare after it. */
export function listFilledSlots(parts: PodiumParts): PodiumSlot[] {
  return everySlot.filter((slot) => isCardOfSlotFilled(parts, slot));
}

/**
 * After an update on air: a revealed slot that gained an entry shows its card at once,
 * one that lost its entry hides it at once. Slots not yet revealed stay hidden.
 */
export function showOrHideRevealedSlotsThatChanged(
  parts: PodiumParts,
  stepOnAir: number,
  slotsFilledBefore: PodiumSlot[],
): void {
  const cardsToShow: HTMLElement[] = [];
  const cardsToHide: HTMLElement[] = [];
  for (const slot of everySlot) {
    const wasFilled = slotsFilledBefore.includes(slot);
    const isFilled = isCardOfSlotFilled(parts, slot);
    const isRevealed = stepOnAir >= revealStepOfSlot[slot];
    if (isRevealed && isFilled && !wasFilled) {
      cardsToShow.push(parts.cardsBySlot[slot]);
    }
    if (wasFilled && !isFilled) {
      cardsToHide.push(parts.cardsBySlot[slot]);
    }
  }
  showCardsAtOnce(cardsToShow);
  hideCardsAtOnce(parts.tokensSource, cardsToHide);
}
