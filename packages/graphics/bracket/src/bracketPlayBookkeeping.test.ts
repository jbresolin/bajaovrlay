/**
 * The bracket's play and step bookkeeping (packages/graphics/bracket)
 *
 * What this module is for:
 *   Before anything moves, a play must know where it is going: off the end (a stop), to the
 *   step already on air (nothing to do), or to another step, by which kind of move. And while
 *   it moves, it must know whether a later press, a stop or a dispose has overtaken it, so it
 *   gives the bracket up instead of drawing over the newer step. bracketPlayBookkeeping.ts
 *   keeps both, with no page; bracket.ts asks it at each await.
 *
 * What these tests prove (on the real Super Prime, 7 steps: three boards, quartas, semis,
 * 3º lugar, final):
 *   - each kind of play the OGraf step rule gives, and the move each step change takes;
 *   - a step past the data's last is brought back to the last;
 *   - a move is overtaken by any later one, and by a dispose; a lift-out is marked running
 *     until its own play ends it, never by an older play's.
 *
 * What these tests deliberately do not cover:
 *   - That bracket.ts gives up when overtaken: bracketOverlappingMoves.test.ts.
 *   - The 4xx answers' wording: ptBR.ts, and bracket.test.ts on the real element.
 */
import { describe, expect, it } from 'vitest';

import {
  bringTheStepWithinTheData,
  createMoveBookkeeping,
  planThePlay,
} from './bracketPlayBookkeeping.js';
import { createTheRealSuperPrime } from './previewData.js';

describe('planning a play', () => {
  const playScenarios = [
    // Entrar: from off air, a play goes to step 0 and enters.
    {
      name: 'from off air, Entrar enters at the first board',
      request: { currentStep: undefined, isOnAir: false, goto: undefined, delta: undefined },
      expected: {
        kind: 'move',
        targetStep: 0,
        stepBefore: -1,
        isEntering: true,
        moveKind: 'enter',
      },
    },
    // Próximo between boards: the cards on screen lift out, the next page's come in.
    {
      name: 'Próximo from the first board to the second is a new view',
      request: { currentStep: 0, isOnAir: true, goto: undefined, delta: undefined },
      expected: {
        kind: 'move',
        targetStep: 1,
        stepBefore: 0,
        isEntering: false,
        moveKind: 'newView',
      },
    },
    // Próximo inside the tree: only what the step adds comes in.
    {
      name: 'Próximo from the quartas to the semis adds to the view',
      request: { currentStep: 3, isOnAir: true, goto: undefined, delta: undefined },
      expected: {
        kind: 'move',
        targetStep: 4,
        stepBefore: 3,
        isEntering: false,
        moveKind: 'addToTheView',
      },
    },
    // A goto back: the step is drawn with no motion.
    {
      name: 'a goto back from the final to the quartas is drawn at once',
      request: { currentStep: 6, isOnAir: true, goto: 3, delta: undefined },
      expected: {
        kind: 'move',
        targetStep: 3,
        stepBefore: 6,
        isEntering: false,
        moveKind: 'atOnce',
      },
    },
    // A second Entrar answered while already there: nothing moves.
    {
      name: 'a goto to the step on air is nothing to do',
      request: { currentStep: 2, isOnAir: true, goto: 2, delta: undefined },
      expected: { kind: 'alreadyOnIt', step: 2 },
    },
    // Próximo on the final: past the last step is the end, which stops the bracket.
    {
      name: 'Próximo on the final goes to the end',
      request: { currentStep: 6, isOnAir: true, goto: undefined, delta: undefined },
      expected: { kind: 'toTheEnd' },
    },
    // A delta back past the start is no step at all.
    {
      name: 'a step back from the first board is invalid',
      request: { currentStep: 0, isOnAir: true, goto: undefined, delta: -1 },
      expected: { kind: 'invalidStep' },
    },
  ];

  it.each(playScenarios)('$name', ({ request, expected }) => {
    // Arrange: the real Super Prime, and the row's step on air and press.
    const superPrime = createTheRealSuperPrime();

    // Act: plan the play.
    const plan = planThePlay({ data: superPrime, ...request });

    // Assert: the plan the step rule and the move rule give.
    expect(plan, 'the play must be planned by the step and move rules').toEqual(expected);
  });
});

describe('bringing a step within the data', () => {
  it('brings a step past the last back to the final, and leaves one within it alone', () => {
    // Arrange: the real Super Prime, whose last step is the final (6).
    const superPrime = createTheRealSuperPrime();

    // Act: bring a step past it and a step within it.
    const stepPastTheEnd = bringTheStepWithinTheData(9, superPrime);
    const stepWithin = bringTheStepWithinTheData(2, superPrime);

    // Assert: the first comes back to the final; the second stays.
    expect(stepPastTheEnd, 'a step the data no longer has must come back to the last').toBe(6);
    expect(stepWithin, 'a step the data has must stay').toBe(2);
  });
});

describe('the count of moves', () => {
  it('overtakes a play when a second press comes, and not the second press', () => {
    // Arrange: a first Próximo under way.
    const moves = createMoveBookkeeping();
    const firstPress = moves.startAMove();

    // Act: a second Próximo comes before the first has finished.
    const secondPress = moves.startAMove();

    // Assert: only the first is overtaken.
    expect(moves.isOvertaken(firstPress), 'the first press must give the bracket up').toBe(true);
    expect(moves.isOvertaken(secondPress), 'the second press owns the bracket').toBe(false);
  });

  it('overtakes the move under way on dispose', () => {
    // Arrange: a Próximo under way.
    const moves = createMoveBookkeeping();
    const press = moves.startAMove();

    // Act: the renderer disposes the bracket.
    moves.overtakeEveryMove();

    // Assert: the press gives the bracket up.
    expect(moves.isOvertaken(press), 'a dispose must overtake every move').toBe(true);
  });

  it('keeps a newer play’s lift-out marked running when an older play’s ends', () => {
    // Arrange: a first Próximo lifting out, then a second one lifting out too.
    const moves = createMoveBookkeeping();
    const firstPress = moves.startAMove();
    moves.startLiftOut(firstPress);
    const secondPress = moves.startAMove();
    moves.startLiftOut(secondPress);

    // Act: the first play's lift-out ends (cut short by the second).
    moves.endLiftOut(firstPress);
    const isRunningAfterTheFirstEnds = moves.isLiftingOutForANewView();
    moves.endLiftOut(secondPress);

    // Assert: still running after the first ends; over once the second's does.
    expect(isRunningAfterTheFirstEnds, 'the second press is still lifting out').toBe(true);
    expect(moves.isLiftingOutForANewView(), 'no lift-out is left once the second ends').toBe(false);
  });
});
